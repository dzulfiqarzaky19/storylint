// T-009 proof probe — does the shipped saveDirect RETRY a failed atomic rename?
//
// Standing rule 11a: no EPERM retry. Hiding the symptom is not a fix.
// The suite cannot see a violation: inserting a 50ms sleep-then-retry into saveDirect's
// catch leaves it fully green (224/224 measured at df405c8). octopus's MUT-6 test holds an
// open handle for the whole call, so every retry also fails and the save still rejects —
// it proves "does not swallow", it cannot see "retried first".
//
// This probe catches a retry by its OBSERVABLE EFFECT rather than its spelling, so it is
// indifferent to a differently-named helper or an inlined loop:
//
//   fail rename ONCE, then let it succeed.
//     no-retry code -> 1 attempt, save REJECTS, dest unchanged      -> exit 0
//     retry code    -> 2 attempts, save RESOLVES, bad bytes on disk -> exit 1
//
// LOAD-BEARING PRECONDITION, before you copy this pattern: a retry is genuinely NOT observable
// from the end state. What makes it observable here is a MID-CALL SEAM - choosing the
// environment's behaviour partway through the call, then relenting. That is a property of this
// runtime (Node supplies mock.module), not a general insight about retries. Without an
// equivalent seam this approach is not available and a labelled tripwire or an honest written
// admission is the correct answer instead. See docs/tickets/T-009.md.
//
// Run: node --experimental-strip-types --experimental-test-module-mocks e2e/proofs/t009-rule11a-no-check/probe.mjs
import { mock } from 'node:test'
import { mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

if (typeof mock.module !== 'function') {
  console.error('FAIL: module mocking unavailable — rerun with --experimental-test-module-mocks')
  process.exit(1)
}

const realFs = await import('node:fs/promises')
let renameCalls = 0
mock.module('node:fs/promises', {
  exports: {
    ...realFs,
    rename: async (from, to) => {
      renameCalls += 1
      if (renameCalls === 1) {
        const error = new Error(`EPERM: operation not permitted, rename '${from}' -> '${to}'`)
        error.code = 'EPERM'
        throw error
      }
      return realFs.rename(from, to)
    },
  },
})

const { ProjectStore } = await import('../../../src/server/store.ts')
const dir = await mkdtemp(join(tmpdir(), 'falcon-t009-'))
const file = join(dir, 'project.json')
const store = new ProjectStore(file)

let rejected = false
try {
  await store.save({
    schemaVersion: 2,
    title: 'must-not-land',
    chapters: [{ id: 'chapter-1', title: '', body: '', craftTags: [], revision: 0 }],
    sheets: [],
    proposals: [],
    rejectedFingerprints: [],
  })
} catch (error) {
  rejected = true
  console.log(`save rejected with: ${error.code ?? error.message}`)
}

let onDisk = '(no file)'
try {
  onDisk = JSON.parse(await readFile(file, 'utf8')).title
} catch {
  /* rename never succeeded — expected for no-retry code */
}

console.log(`rename attempts observed: ${renameCalls}`)
console.log(`save rejected: ${rejected}`)
console.log(`on-disk title: ${onDisk}`)

const retried = renameCalls > 1 || !rejected || onDisk === 'must-not-land'
if (retried) {
  console.error(
    'FAIL (rule 11a): saveDirect RETRIED a failed atomic rename. ' +
      'The write landed after an EPERM the caller was never told about.',
  )
  process.exit(1)
}
console.log('PASS: exactly one rename attempt, save rejected, dest untouched. No retry.')
