import assert from 'node:assert/strict'
import { mkdtemp } from 'node:fs/promises'
import { readFileSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import { ProjectFileRoot, ProjectStore } from './store.ts'

/**
 * T-007 — source-level construction-site check (not a runtime path scanner).
 *
 * What it sees:
 *   - any `new ProjectStore(` in src/server product files
 *   - any `ProjectStore.open(` in http.ts / index.ts (must use fileRoot.open*)
 *
 * What it cannot see:
 *   - a path laundered through a helper that still calls ProjectFileRoot.open*
 *     with an outside path — covered by open()/switchFile/owns() unit tests
 *   - a second ProjectFileRoot minted for the same physical tree (T-007 probe arm)
 *
 * Mechanism: ProjectStore construction is factory-only (OPEN_TOKEN + ProjectStore.open).
 * Product code must go through ProjectFileRoot.openDefault / openId.
 */
const serverDir = dirname(fileURLToPath(import.meta.url))

function listTsFiles(dir: string): string[] {
  const out: string[] = []
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, name.name)
    if (name.isDirectory()) out.push(...listTsFiles(path))
    else if (name.name.endsWith('.ts') && !name.name.endsWith('.test.ts')) out.push(path)
  }
  return out
}

function isStoreFactory(file: string): boolean {
  return file.replaceAll('\\', '/').endsWith('/server/store.ts')
}

test('T-007 source: no product new ProjectStore( outside store.ts factory', () => {
  const offenders: string[] = []
  for (const file of listTsFiles(serverDir)) {
    if (isStoreFactory(file)) continue
    const text = readFileSync(file, 'utf8')
    if (/new\s+ProjectStore\s*\(/.test(text)) offenders.push(file)
  }
  assert.deepEqual(offenders, [], `bare ProjectStore construction:\n${offenders.join('\n')}`)
})

test('T-007 source: http + index never call ProjectStore.open directly', () => {
  // MUT-4: assert.match(http, /fileRoot.openId/) only proved a good call exists.
  // A sibling ProjectStore.open(fileRoot, outsidePath) stayed green. Forbid the bypass.
  const http = readFileSync(join(serverDir, 'http.ts'), 'utf8')
  const index = readFileSync(join(serverDir, 'index.ts'), 'utf8')
  assert.match(http, /store\.root/)
  assert.match(http, /fileRoot\.openId/)
  assert.doesNotMatch(http, /new\s+ProjectStore\s*\(/)
  assert.doesNotMatch(http, /ProjectStore\.open\s*\(/)
  assert.match(index, /new\s+ProjectFileRoot\s*\(/)
  assert.match(index, /\.openDefault\s*\(/)
  assert.doesNotMatch(index, /new\s+ProjectStore\s*\(/)
  assert.doesNotMatch(index, /ProjectStore\.open\s*\(/)
})

test('T-007 OPEN_TOKEN: forged constructor token is rejected', () => {
  const root = new ProjectFileRoot(join(tmpdir(), 'storylint-t007-token', 'project.json'))
  assert.throws(
    () =>
      new (ProjectStore as unknown as {
        new (
          root: ProjectFileRoot,
          path: string,
          fallback: undefined,
          token: symbol,
        ): ProjectStore
      })(root, root.defaultPath, undefined, Symbol('nope')),
    /use ProjectFileRoot\.openDefault/,
  )
  // Legitimate open still works.
  assert.equal(root.openDefault().filePath, root.defaultPath)
})

test('T-007 owns() rejects nested/foreign paths; pathFor rejects bad ids', () => {
  const root = new ProjectFileRoot(join(tmpdir(), 'storylint-t007-trav', 'project.json'))
  // resolve(projects/../project.json) collapses to defaultPath — same string key, owns is true.
  assert.equal(root.owns(join(root.projectsDirectory, '..', 'project.json')), true)
  assert.equal(root.owns(join(root.projectsDirectory, 'nested', 'x.json')), false)
  assert.equal(root.owns(join(root.dataDirectory, 'other.json')), false)
  assert.equal(root.owns(root.pathFor('harbor')), true)
  assert.throws(() => root.pathFor('../etc'), /Invalid project id/)
  assert.throws(
    () => ProjectStore.open(root, join(root.dataDirectory, 'leak.json')),
    /must derive from ProjectFileRoot/,
  )
})

test('T-007 switchFile and open share the same root (async)', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'storylint-t007-share-'))
  const root = new ProjectFileRoot(join(dir, 'project.json'))
  const store = root.openDefault()
  await store.save({
    schemaVersion: 2,
    title: 'A',
    chapters: [{ id: 'chapter-1', title: '', body: '', craftTags: [], revision: 0 }],
    sheets: [],
    proposals: [],
    rejectedFingerprints: [],
    marks: [],
    researchNotes: [],
    lab: { boards: [{ id: 'lab-board-bench', title: 'Bench', cardIds: [] }], cards: [] },
  })
  await root.openId('second').save({
    schemaVersion: 2,
    title: 'B',
    chapters: [],
    sheets: [],
    proposals: [],
    rejectedFingerprints: [],
    marks: [],
    researchNotes: [],
    lab: { boards: [{ id: 'lab-board-bench', title: 'Bench', cardIds: [] }], cards: [] },
  })
  await store.switchFile(root.pathFor('second'))
  assert.equal((await store.load()).title, 'B')
})
