// T-008 proof probe — the T-005 lock is per-PROCESS.
//
// `pathChains` is a module-level Map, so the exclusive chain lives in one process's module
// instance. A second process has its own and the two do not see each other. This is a
// legitimate scope boundary, not a defect: a cross-process lock is a different design with
// its own failure modes (stale owners, crash recovery, timeouts). See docs/tickets/T-008.md.
//
// It matters because T-005's own repro runs the calm harness ALONGSIDE a dev server. That is
// this shape. So the likeliest future "T-005 came back" report is this limit being met for
// the first time, by someone who does not know it exists.
//
// TRIAGE, and the reason this probe is worth keeping: a multi-process EPERM is T-008 firing.
// A SINGLE-process EPERM on the atomic rename is a T-005 regression and reopens it. The two
// arms below are exactly that distinction, measured rather than argued.
//
// Asserts on the PROPERTY, not on an error count — the count is nondeterministic (falcon
// measured 1 EPERM + 14 ENOENT on one run). What is deterministic: multi-process races,
// single-process does not.
//
// Run: node --experimental-strip-types e2e/proofs/t008-per-process-lock/probe.mjs
// Exit 0 = boundary is where T-008 says. Exit 1 = a premise changed; read the output.
import { mkdtemp, writeFile, readFile } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const run = promisify(execFile)
const dir = await mkdtemp(join(tmpdir(), 'falcon-t008-'))
const file = join(dir, 'shared.json')
const child = join(dir, 'writer.mjs')
const storeUrl = new URL('../../../src/server/store.ts', import.meta.url).href

const seedLiteral = JSON.stringify({
  schemaVersion: 2,
  title: 'seed',
  chapters: [{ id: 'chapter-1', title: '', body: '', craftTags: [], revision: 0 }],
  sheets: [],
  proposals: [],
  rejectedFingerprints: [],
  marks: [],
  researchNotes: [],
  lab: { boards: [{ id: 'lab-board-bench', title: 'Bench', cardIds: [] }], cards: [] },
})

await writeFile(
  child,
  `
import { ProjectFileRoot } from ${JSON.stringify(storeUrl)}
const file = ${JSON.stringify(file)}
const tag = process.argv[2]
const rounds = Number(process.argv[3])
const seed = () => (${seedLiteral})
const errors = []
const jobs = []
for (let i = 0; i < rounds; i += 1) {
  jobs.push(new ProjectFileRoot(file).openDefault().save({ ...seed(), title: tag + '-' + i }).catch((e) => errors.push(String(e))))
  jobs.push(new ProjectFileRoot(file).openDefault().load().catch((e) => errors.push(String(e))))
}
await Promise.all(jobs)
console.log(JSON.stringify({ tag, total: errors.length, eperm: errors.filter((e) => /EPERM/i.test(e)).length, sample: errors.slice(0, 1) }))
`,
)

async function spawnWriters(tags, rounds) {
  await writeFile(file, seedLiteral)
  const out = await Promise.all(
    tags.map((tag) =>
      run(process.execPath, ['--experimental-strip-types', child, tag, String(rounds)])
        .then((r) => JSON.parse(r.stdout.trim()))
        .catch((e) => ({ tag, crashed: String(e).slice(0, 200), total: -1 })),
    ),
  )
  return out
}

// ARM 1 — three processes, one file. No shared chain, so they race.
const multi = await spawnWriters(['p1', 'p2', 'p3'], 120)
const multiErrors = multi.reduce((n, r) => n + Math.max(r.total, 0), 0)
for (const r of multi) console.log(`  multi ${r.tag}: ${JSON.stringify(r)}`)

// ARM 2 — control. ONE process, same total write volume. The chain applies.
const single = await spawnWriters(['solo'], 360)
const singleErrors = single.reduce((n, r) => n + Math.max(r.total, 0), 0)
for (const r of single) console.log(`  single ${r.tag}: ${JSON.stringify(r)}`)

let parses = true
try {
  JSON.parse(await readFile(file, 'utf8'))
} catch {
  parses = false
}

console.log(`\nmulti-process errors:  ${multiErrors}  (3 processes x 120 rounds)`)
console.log(`single-process errors: ${singleErrors}  <- control, same volume, lock applies`)
console.log(`final file parses: ${parses}`)

const problems = []
if (multi.some((r) => r.crashed)) {
  problems.push(`a writer crashed rather than collecting errors: ${multi.find((r) => r.crashed).crashed}`)
}
if (multiErrors === 0) {
  problems.push(
    'multi-process produced NO errors. Either a cross-process lock was added (then update T-008 ' +
      'and store.ts, this is now stale) or the workload no longer races.',
  )
}
if (singleErrors > 0) {
  problems.push(
    `CONTROL FAILED: single-process produced ${singleErrors} errors. The in-process lock is not ` +
      'holding, which is a T-005 REGRESSION, not T-008. Reopen T-005 before touching this ticket.',
  )
}

if (problems.length > 0) {
  console.error('\nPREMISE CHANGED:')
  for (const p of problems) console.error(`  - ${p}`)
  process.exit(1)
}
console.log('\nPASS: races across processes, clean within one. The lock boundary is per-process, as T-008 states.')
