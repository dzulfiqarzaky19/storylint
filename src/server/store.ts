import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises'
import { dirname, resolve, sep } from 'node:path'
import type { Project } from '../domain/types.ts'
import { parseProject } from './validation.ts'

/**
 * One exclusive chain per resolved file path, within this process only.
 * Covers every read and write so Windows rename(tmp→dest) cannot race an open handle
 * (T-005: EPERM when load() or a second ProjectStore touched the file mid-save).
 * Cross-process writers are out of scope for this lock (T-008).
 *
 * PRECONDITION (T-007): the lock key is path-string identity after resolve(), not
 * physical file identity. resolve() does not collapse Windows junctions, so two
 * spellings of one file are two chains and the lock silently stops existing.
 * Every ProjectStore path must therefore derive from one ProjectFileRoot.
 * Do not "fix" this with realpath() here — seeding saveDirect runs before the
 * destination exists. A second root is a product decision that owns identity.
 */
const pathChains = new Map<string, Promise<void>>()

function withPathLock<T>(filePath: string, run: () => Promise<T>): Promise<T> {
  const key = resolve(filePath)
  const previous = pathChains.get(key) ?? Promise.resolve()
  let release!: () => void
  const gate = new Promise<void>((resolveGate) => {
    release = resolveGate
  })
  pathChains.set(
    key,
    previous.then(
      () => gate,
      () => gate,
    ),
  )
  return previous.then(run, run).finally(release)
}

const PROJECT_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/**
 * Single root for project file paths in one server process.
 * All ProjectStore instances must be opened through this type so lock keys stay
 * on one derivation tree (default file + projects/<id>.json under the same data dir).
 */
export class ProjectFileRoot {
  readonly defaultPath: string
  readonly dataDirectory: string
  readonly projectsDirectory: string

  constructor(defaultProjectPath: string) {
    this.defaultPath = resolve(defaultProjectPath)
    this.dataDirectory = dirname(this.defaultPath)
    this.projectsDirectory = resolve(this.dataDirectory, 'projects')
  }

  pathFor(id: string): string {
    if (id === 'default') return this.defaultPath
    if (!PROJECT_ID.test(id)) throw new Error('Invalid project id')
    return resolve(this.projectsDirectory, `${id}.json`)
  }

  owns(filePath: string): boolean {
    const path = resolve(filePath)
    if (path === this.defaultPath) return true
    const prefix = this.projectsDirectory.endsWith(sep)
      ? this.projectsDirectory
      : `${this.projectsDirectory}${sep}`
    if (!path.startsWith(prefix) || !path.endsWith('.json')) return false
    const name = path.slice(prefix.length, -'.json'.length)
    if (name.includes(sep) || name.includes('/') || name.includes('\\')) return false
    return PROJECT_ID.test(name)
  }

  openDefault(fallback?: Project): ProjectStore {
    return ProjectStore.open(this, this.defaultPath, fallback)
  }

  openId(id: string, fallback?: Project): ProjectStore {
    return ProjectStore.open(this, this.pathFor(id), fallback)
  }
}

const OPEN_TOKEN = Symbol('ProjectStore.open')

/** Serializes read-modify-write mutations and commits each project with atomic rename. */
export class ProjectStore {
  readonly root: ProjectFileRoot
  filePath: string
  private readonly fallback?: Project

  /**
   * @internal Use ProjectFileRoot.openDefault / openId. Runtime token stops JS callers
   * from bypassing the TypeScript private constructor (TS emits a public ctor).
   */
  private constructor(
    root: ProjectFileRoot,
    filePath: string,
    fallback: Project | undefined,
    token: symbol,
  ) {
    if (token !== OPEN_TOKEN) {
      throw new Error('ProjectStore: use ProjectFileRoot.openDefault/openId or ProjectStore.open')
    }
    this.root = root
    this.filePath = filePath
    this.fallback = fallback
  }

  /** Only construction path. Rejects paths outside the given root (T-007). */
  static open(root: ProjectFileRoot, filePath: string, fallback?: Project): ProjectStore {
    const path = resolve(filePath)
    if (!root.owns(path)) {
      throw new Error(
        `ProjectStore path must derive from ProjectFileRoot (got ${path}; root default ${root.defaultPath})`,
      )
    }
    return new ProjectStore(root, path, fallback, OPEN_TOKEN)
  }

  /**
   * Hold the lock for the path observed at call time and perform IO on that same path.
   * switchFile can repoint `this.filePath` only after draining this path's chain, so an
   * in-flight RMW finishes on the file it started against (see switchFile test).
   */
  private runLocked<T>(fn: (path: string) => Promise<T>): Promise<T> {
    const path = this.filePath
    return withPathLock(path, () => fn(path))
  }

  async switchFile(filePath: string): Promise<void> {
    const path = resolve(filePath)
    if (!this.root.owns(path)) {
      throw new Error(
        `switchFile path must derive from the store's ProjectFileRoot (got ${path})`,
      )
    }
    // Drain ops on the current path before repointing so in-flight RMW stays on the old file.
    await withPathLock(this.filePath, async () => {
      this.filePath = path
    })
  }

  async load(): Promise<Project> {
    return this.runLocked(async (path) => {
      try {
        return parseProject(JSON.parse(await readFile(path, 'utf8')))
      } catch (error) {
        if (
          this.fallback &&
          typeof error === 'object' &&
          error !== null &&
          'code' in error &&
          error.code === 'ENOENT'
        ) {
          const seeded = structuredClone(this.fallback)
          await this.saveDirect(path, seeded)
          return structuredClone(this.fallback)
        }
        throw error
      }
    })
  }

  async save(project: Project): Promise<void> {
    const valid = parseProject(project)
    await this.runLocked((path) => this.saveDirect(path, valid))
  }

  async update(mutate: (project: Project) => Project): Promise<Project> {
    return this.updateAsync(async (project) => mutate(project))
  }

  async updateAsync(mutate: (project: Project) => Promise<Project>): Promise<Project> {
    return this.runLocked(async (path) => {
      const project = await this.loadDirect(path)
      const result = parseProject(await mutate(project))
      await this.saveDirect(path, result)
      return result
    })
  }

  private async loadDirect(path: string): Promise<Project> {
    try {
      return parseProject(JSON.parse(await readFile(path, 'utf8')))
    } catch (error) {
      if (
        this.fallback &&
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'ENOENT'
      ) {
        return structuredClone(this.fallback)
      }
      throw error
    }
  }

  private async saveDirect(path: string, project: Project): Promise<void> {
    const directory = dirname(path)
    const temporary = `${path}.tmp`
    await mkdir(directory, { recursive: true })
    try {
      await writeFile(temporary, `${JSON.stringify(project, null, 2)}\n`, 'utf8')
      await rename(temporary, path)
    } catch (error) {
      await unlink(temporary).catch(() => undefined)
      throw error
    }
  }
}
