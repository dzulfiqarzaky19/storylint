/**
 * T-009 / standing rule 11a — no EPERM retry on atomic rename.
 *
 * octopus MUT-6 (open-handle EPERM for whole call) proves "does not swallow".
 * It cannot see "retried first": every attempt still fails, save still rejects.
 *
 * This test fails rename ONCE then succeeds (falcon probe mechanism):
 *   no-retry → 1 attempt, save rejects, dest untouched
 *   retry    → 2 attempts, save resolves, must-not-land on disk
 *
 * Asserts on observable effect, not source spelling. Requires
 * --experimental-test-module-mocks (wired on npm test; blast radius measured 230/230).
 *
 * Cheap HERE because this Node has module mocking. Not generally cheap — do not
 * treat mock.module as a free default for every seam.
 */
import assert from 'node:assert/strict'
import { mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { mock, test } from 'node:test'
import type { Project } from '../domain/types.ts'

function seed(title: string): Project {
  return {
    schemaVersion: 2,
    title,
    chapters: [{ id: 'chapter-1', title: '', body: '', craftTags: [], revision: 0 }],
    sheets: [],
    proposals: [],
    rejectedFingerprints: [],
    marks: [],
    researchNotes: [],
    lab: { boards: [{ id: 'lab-board-bench', title: 'Bench', cardIds: [] }], cards: [] },
  }
}

test('saveDirect does not retry a once-failed atomic rename (rule 11a)', async () => {
  assert.equal(
    typeof mock.module,
    'function',
    'module mocking unavailable — npm test must pass --experimental-test-module-mocks',
  )

  // Import real fs first, then mock rename, then load store so it binds the mock.
  // Must be a dedicated file so store.ts is not already cached with the real rename.
  const realFs = await import('node:fs/promises')
  let renameCalls = 0
  mock.module('node:fs/promises', {
    exports: {
      ...realFs,
      rename: async (from: string, to: string) => {
        renameCalls += 1
        if (renameCalls === 1) {
          const error = new Error(`EPERM: operation not permitted, rename '${from}' -> '${to}'`) as NodeJS.ErrnoException
          error.code = 'EPERM'
          throw error
        }
        return realFs.rename(from, to)
      },
    },
  })

  const { ProjectStore } = await import('./store.ts')
  const dir = await mkdtemp(join(tmpdir(), 'storylint-rule11a-'))
  const file = join(dir, 'project.json')
  const store = new ProjectStore(file)

  let rejected: unknown = null
  try {
    await store.save(seed('must-not-land'))
  } catch (error) {
    rejected = error
  }

  let onDiskTitle = '(no file)'
  try {
    onDiskTitle = (JSON.parse(await readFile(file, 'utf8')) as Project).title
  } catch {
    /* rename never succeeded — expected */
  }

  assert.equal(renameCalls, 1, `expected exactly one rename attempt, saw ${renameCalls}`)
  assert.ok(rejected, 'save must reject after the single EPERM')
  assert.equal((rejected as NodeJS.ErrnoException).code, 'EPERM')
  assert.equal(onDiskTitle, '(no file)', 'dest must stay untouched — a retry would land must-not-land')
})
