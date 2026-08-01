/**
 * T-005 path-lock mutation probe.
 *
 * BEFORE (pre-fix MiniStore / raw rename, recorded 2026-08-01):
 *   thrash concurrent writers+loads: 988 EPERM / 9 ENOENT
 *   open handle on dest during rename (unique tmp): 50/50 EPERM
 *   same-instance queued: 0 errors
 *
 * AFTER (this script, uses ProjectStore path-keyed lock):
 *   two-instance thrash load+save must be 0 errors
 *   concurrent load while save must be 0 errors
 *
 * Open-handle OUTSIDE the store is still Windows EPERM by design — not a product path.
 * Product never holds a durable FD across await rename; only store IO goes through the lock.
 */
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs'
import { mkdtemp, readFile, readdir, writeFile, rename, unlink } from 'node:fs/promises'
import { openSync, closeSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { pathToFileURL } from 'node:url'
import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'

const OUT = process.argv[2] || 'e2e/proofs/t005-eperm-path-lock'
mkdirSync(OUT, { recursive: true })

// Load ProjectStore via strip-types runner
const root = process.cwd()
const storeUrl = pathToFileURL(join(root, 'src/server/store.ts')).href
const { ProjectStore } = await import(storeUrl)

const seed = {
  schemaVersion: 2,
  title: 'probe',
  chapters: [{ id: 'c1', title: '', body: '', craftTags: [], revision: 0 }],
  sheets: [],
  proposals: [],
  rejectedFingerprints: [],
  marks: [],
  researchNotes: [],
  lab: { boards: [{ id: 'lab-board-bench', title: 'Bench', cardIds: [] }], cards: [] },
}

function codes(arr) {
  const m = {}
  for (const e of arr) {
    const c = e?.code || (String(e.message || e).match(/\b(EPERM|ENOENT|EACCES)\b/) || [])[0] || 'other'
    m[c] = (m[c] || 0) + 1
  }
  return m
}

const dir = await mkdtemp(join(tmpdir(), 't005-probe-'))
const file = join(dir, 'proj.json')
await new ProjectStore(file).save(seed)

// Shape A: two-instance thrash (was 988 EPERM pre-fix with unqueued MiniStore)
const thrashErrors = []
const N = 500
const jobs = []
for (let i = 0; i < N; i++) {
  const s1 = new ProjectStore(file)
  const s2 = new ProjectStore(file)
  jobs.push(s1.save({ ...seed, title: `a-${i}` }).catch((e) => thrashErrors.push(e)))
  jobs.push(s2.save({ ...seed, title: `b-${i}` }).catch((e) => thrashErrors.push(e)))
  jobs.push(s1.load().catch((e) => thrashErrors.push(e)))
  jobs.push(s2.load().catch((e) => thrashErrors.push(e)))
}
await Promise.all(jobs)

// Shape B: many readers during many writers
const mixErrors = []
const writers = Array.from({ length: 80 }, () => new ProjectStore(file))
const readers = Array.from({ length: 80 }, () => new ProjectStore(file))
await Promise.all([
  ...writers.map((s, i) => s.save({ ...seed, title: `w-${i}` }).catch((e) => mixErrors.push(e))),
  ...readers.map((s) => s.load().catch((e) => mixErrors.push(e))),
])

// Control: raw open-handle rename STILL EPERMs (documents Windows, not product regression)
const controlFile = join(dir, 'control.json')
await writeFile(controlFile, '{}\n', 'utf8')
const controlErrors = []
for (let i = 0; i < 20; i++) {
  const fd = openSync(controlFile, 'r')
  const tmp = `${controlFile}.${i}.tmp`
  try {
    await writeFile(tmp, `${i}\n`, 'utf8')
    try {
      await rename(tmp, controlFile)
    } catch (e) {
      controlErrors.push(e)
      await unlink(tmp).catch(() => {})
    }
  } finally {
    closeSync(fd)
  }
}

const report = {
  when: new Date().toISOString(),
  afterFix: true,
  storePath: 'src/server/store.ts path-keyed lock',
  beforeRecorded: {
    thrashEPERM: 988,
    thrashENOENT: 9,
    openHandleUniqueTmpEPERM: 50,
    openHandleUniqueTmpTotal: 50,
    note: 'See BEFORE.json from pre-fix MiniStore probe on 2026-08-01',
  },
  after: {
    twoInstanceThrash: { total: thrashErrors.length, byCode: codes(thrashErrors), sample: thrashErrors.slice(0, 3).map(String) },
    readerWriterMix: { total: mixErrors.length, byCode: codes(mixErrors), sample: mixErrors.slice(0, 3).map(String) },
    controlOpenHandleStillEPERM: {
      total: controlErrors.length,
      byCode: codes(controlErrors),
      note: 'Expected non-zero: external FD not going through ProjectStore',
    },
    leftover: await readdir(dir),
  },
  pass:
    thrashErrors.length === 0 &&
    mixErrors.length === 0 &&
    controlErrors.length > 0,
}

writeFileSync(join(OUT, 'AFTER.json'), JSON.stringify(report, null, 2) + '\n')
console.log(JSON.stringify(report, null, 2))
if (!report.pass) process.exit(1)
