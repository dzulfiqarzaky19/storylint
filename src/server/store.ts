import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import type { Project } from '../domain/types.ts'
import { parseProject } from './validation.ts'

/** Serializes read-modify-write mutations and commits each project with atomic rename. */
export class ProjectStore {
  #queue: Promise<void> = Promise.resolve()
  filePath: string
  private readonly fallback?: Project

  constructor(filePath: string, fallback?: Project) {
    this.filePath = filePath
    this.fallback = fallback
  }

  async switchFile(filePath: string): Promise<void> {
    const run = async () => {
      this.filePath = filePath
    }
    const next = this.#queue.then(run, run)
    this.#queue = next.then(
      () => undefined,
      () => undefined,
    )
    await next
  }

  async load(): Promise<Project> {
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
        await this.save(this.fallback)
        return structuredClone(this.fallback)
      }
      throw error
    }
  }

  async save(project: Project): Promise<void> {
    const valid = parseProject(project)
    const write = async () => {
      const directory = dirname(this.filePath)
      const temporary = `${this.filePath}.tmp`
      await mkdir(directory, { recursive: true })
      try {
        await writeFile(temporary, `${JSON.stringify(valid, null, 2)}\n`, 'utf8')
        await rename(temporary, this.filePath)
      } catch (error) {
        await unlink(temporary).catch(() => undefined)
        throw error
      }
    }
    const next = this.#queue.then(write, write)
    this.#queue = next.then(
      () => undefined,
      () => undefined,
    )
    return next
  }

  async update(mutate: (project: Project) => Project): Promise<Project> {
    return this.updateAsync(async (project) => mutate(project))
  }

  async updateAsync(mutate: (project: Project) => Promise<Project>): Promise<Project> {
    let result: Project | undefined
    const run = async () => {
      const project = await this.loadDirect()
      result = parseProject(await mutate(project))
      await this.saveDirect(result)
    }
    const next = this.#queue.then(run, run)
    this.#queue = next.then(
      () => undefined,
      () => undefined,
    )
    await next
    if (!result) throw new Error('Project update failed')
    return result
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
