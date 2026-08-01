import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import type { Project } from '../domain/types.ts'
import { parseProject } from './validation.ts'

/**
 * One exclusive chain per resolved file path, within this process only.
 * Covers every read and write so Windows rename(tmp→dest) cannot race an open handle
 * (T-005: EPERM when load() or a second ProjectStore touched the file mid-save).
 * Cross-process writers are out of scope for this lock.
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

/** Serializes read-modify-write mutations and commits each project with atomic rename. */
export class ProjectStore {
  filePath: string
  private readonly fallback?: Project

  constructor(filePath: string, fallback?: Project) {
    this.filePath = filePath
    this.fallback = fallback
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
    // Drain ops on the current path before repointing so in-flight RMW stays on the old file.
    await withPathLock(this.filePath, async () => {
      this.filePath = filePath
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
