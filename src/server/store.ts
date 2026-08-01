import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import type { Project } from '../domain/types.ts'
import { parseProject } from './validation.ts'

/**
 * One exclusive chain per resolved file path.
 * Covers every read and write so Windows rename(tmp→dest) cannot race an open handle
 * (T-005: EPERM when load() or a second ProjectStore touched the file mid-save).
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

  async switchFile(filePath: string): Promise<void> {
    // Drain ops on the current path before repointing so in-flight RMW stays on the old file.
    await withPathLock(this.filePath, async () => {
      this.filePath = filePath
    })
  }

  async load(): Promise<Project> {
    return withPathLock(this.filePath, async () => {
      try {
        return parseProject(JSON.parse(await readFile(this.filePath, 'utf8')))
      } catch (error) {
        if (
          this.fallback &&
          typeof error === 'object' &&
          error !== null &&
          'code' in error &&
          error.code === 'ENOENT'
        ) {
          const seeded = structuredClone(this.fallback)
          await this.saveDirect(seeded)
          return structuredClone(this.fallback)
        }
        throw error
      }
    })
  }

  async save(project: Project): Promise<void> {
    const valid = parseProject(project)
    await withPathLock(this.filePath, () => this.saveDirect(valid))
  }

  async update(mutate: (project: Project) => Project): Promise<Project> {
    return this.updateAsync(async (project) => mutate(project))
  }

  async updateAsync(mutate: (project: Project) => Promise<Project>): Promise<Project> {
    return withPathLock(this.filePath, async () => {
      const project = await this.loadDirect()
      const result = parseProject(await mutate(project))
      await this.saveDirect(result)
      return result
    })
  }

  private async loadDirect(): Promise<Project> {
    try {
      return parseProject(JSON.parse(await readFile(this.filePath, 'utf8')))
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

  private async saveDirect(project: Project): Promise<void> {
    const directory = dirname(this.filePath)
    const temporary = `${this.filePath}.tmp`
    await mkdir(directory, { recursive: true })
    try {
      await writeFile(temporary, `${JSON.stringify(project, null, 2)}\n`, 'utf8')
      await rename(temporary, this.filePath)
    } catch (error) {
      await unlink(temporary).catch(() => undefined)
      throw error
    }
  }
}
