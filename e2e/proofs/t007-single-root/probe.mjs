// T-007 proof probe — path identity is not file identity on Windows.
//
// The T-005 lock is keyed on the path STRING in a module-level Map, so two spellings of one
// physical file are two independent chains and the exclusion silently stops existing. This
// probe demonstrates that, and — more importantly — demonstrates the CONTROL: the same
// workload through a single spelling is clean. The difference between the two arms is the
// whole finding.
//
// This is NOT a request to support junctions. See docs/tickets/T-007.md: the guard is the
// single-rooted derivation of every ProjectStore path, not a resolve()/realpath() call.
// Junctions are just the cheapest way to produce two spellings of one file.
//
// Product code opens stores only through ProjectFileRoot. The split arm deliberately builds
// two roots (one per spelling) to show why that rule exists — product cannot mint a second
// root for the same physical tree without a deliberate second ProjectFileRoot.
//
// Asserts on the PROPERTY, not on an error count. The error count is nondeterministic —
// falcon measured 21 on one run and 26 on another — so a fixed number would be a flake
// waiting to happen and would say nothing about why. What is deterministic: split-spelling
// produces errors, single-spelling produces none.
//
// Run: node --experimental-strip-types e2e/proofs/t007-single-root/probe.mjs
// Exit 0 = claim holds (split breaks, control clean). Exit 1 = a premise changed; read the output.
import { mkdtemp, writeFile, readFile, mkdir } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { ProjectFileRoot } from '../../../src/server/store.ts'

const seed = () => ({
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

const ROUNDS = 60

async function thrash(spellingA, spellingB) {
  // Each spelling is its own ProjectFileRoot default — two roots, two lock keys.
  // Product code cannot do this; the probe is measuring why the single-root rule exists.
  const rootA = new ProjectFileRoot(spellingA)
  const rootB = new ProjectFileRoot(spellingB)
  const errors = []
  const jobs = []
  for (let i = 0; i < ROUNDS; i += 1) {
    jobs.push(rootA.openDefault().save({ ...seed(), title: `a-${i}` }).catch((e) => errors.push(String(e))))
    jobs.push(rootB.openDefault().save({ ...seed(), title: `b-${i}` }).catch((e) => errors.push(String(e))))
    jobs.push(rootB.openDefault().load().catch((e) => errors.push(String(e))))
    jobs.push(rootA.openDefault().load().catch((e) => errors.push(String(e))))
  }
  await Promise.all(jobs)
  return errors
}

const base = await mkdtemp(join(tmpdir(), 'falcon-t007-'))
const real = join(base, 'real')
const link = join(base, 'link')
await mkdir(real, { recursive: true })

try {
  execFileSync('cmd', ['/c', 'mklink', '/J', link, real], { stdio: 'ignore' })
} catch {
  console.log('SKIP: could not create a junction (needs Windows). Nothing measured.')
  process.exit(0)
}

const viaReal = join(real, 'project.json')
const viaLink = join(link, 'project.json')
await writeFile(viaReal, JSON.stringify(seed(), null, 2))

const keysDiffer = resolve(viaReal) !== resolve(viaLink)
console.log(`resolve(real)  = ${resolve(viaReal)}`)
console.log(`resolve(link)  = ${resolve(viaLink)}`)
console.log(`lock keys differ for one physical file: ${keysDiffer}`)

// ARM 1 — two spellings. Two lock chains, so the lock does not apply.
const split = await thrash(viaReal, viaLink)
// ARM 2 — control, one spelling. One lock chain, so the T-005 lock applies.
await writeFile(viaReal, JSON.stringify(seed(), null, 2))
const single = await thrash(viaReal, viaReal)

console.log(`split-spelling errors:  ${split.length}${split[0] ? `  e.g. ${split[0].slice(0, 90)}` : ''}`)
console.log(`single-spelling errors: ${single.length}  <- control, the lock working`)
console.log(`final on-disk title: ${JSON.parse(await readFile(viaReal, 'utf8')).title}`)

const problems = []
if (!keysDiffer) {
  problems.push(
    'resolve() now COLLAPSES junction spellings. That would make path-string keying safe here — ' +
      'good news, but T-007 rests on the opposite, so re-read the ticket before trusting it.',
  )
}
if (split.length === 0) {
  problems.push(
    'split-spelling produced NO errors. Either the lock stopped being path-string keyed, or this ' +
      'workload no longer races. Either way T-007 needs re-deriving.',
  )
}
if (single.length > 0) {
  problems.push(
    `CONTROL FAILED: single-spelling produced ${single.length} errors. The T-005 lock is not holding ` +
      'even for one spelling, which is a bigger problem than T-007 — check T-005 first.',
  )
}

if (problems.length > 0) {
  console.error('\nPREMISE CHANGED:')
  for (const p of problems) console.error(`  - ${p}`)
  process.exit(1)
}
console.log('\nPASS: two spellings of one file bypass the lock; one spelling does not. T-007 stands.')
