import { mkdtemp, writeFile, readFile, rename, mkdir } from 'node:fs/promises'
import { join, resolve, dirname } from 'node:path'
import { tmpdir } from 'node:os'
import { writeFileSync, mkdirSync } from 'node:fs'

const OUT = 'e2e/proofs/t005-eperm-path-lock'
mkdirSync(OUT, { recursive: true })

// --- Path key equivalence ---
const samples = [
  'data/projects/foo.json',
  './data/projects/foo.json',
  'data\\projects\\foo.json',
  join(process.cwd(), 'data', 'projects', 'foo.json'),
  join(process.cwd(), 'data', 'projects', '..', 'projects', 'foo.json'),
]
const keys = samples.map((s) => resolve(s))
const unique = new Set(keys)

const pathChains = new Map()
function withPathLock(filePath, run) {
  const key = resolve(filePath)
  const previous = pathChains.get(key) ?? Promise.resolve()
  let release
  const gate = new Promise((r) => {
    release = r
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

class MutatedStore {
  constructor(filePath) {
    this.filePath = filePath
  }
  // MUTATION: load OFF lock (the pre-fix hole)
  async load() {
    return JSON.parse(await readFile(this.filePath, 'utf8'))
  }
  async save(obj) {
    const path = this.filePath
    await withPathLock(path, async () => {
      const tmp = path + '.tmp'
      await mkdir(dirname(path), { recursive: true })
      await writeFile(tmp, JSON.stringify(obj) + '\n', 'utf8')
      await rename(tmp, path)
    })
  }
}

class FixedStore {
  constructor(filePath) {
    this.filePath = filePath
  }
  async load() {
    const path = this.filePath
    return withPathLock(path, async () => JSON.parse(await readFile(path, 'utf8')))
  }
  async save(obj) {
    const path = this.filePath
    await withPathLock(path, async () => {
      const tmp = path + '.tmp'
      await mkdir(dirname(path), { recursive: true })
      await writeFile(tmp, JSON.stringify(obj) + '\n', 'utf8')
      await rename(tmp, path)
    })
  }
}

function tally(errors) {
  const by = {}
  for (const e of errors) {
    const c = e.code || 'other'
    by[c] = (by[c] || 0) + 1
  }
  return by
}

const dir = await mkdtemp(join(tmpdir(), 't005-mut-load-'))
const file = join(dir, 'proj.json')
await writeFile(file, JSON.stringify({ n: 0 }) + '\n', 'utf8')

const mutErrors = []
const N = 500
const jobs = []
for (let i = 0; i < N; i++) {
  const s1 = new MutatedStore(file)
  const s2 = new MutatedStore(file)
  jobs.push(s1.save({ n: i, w: 'a' }).catch((e) => mutErrors.push(e)))
  jobs.push(s2.save({ n: i, w: 'b' }).catch((e) => mutErrors.push(e)))
  jobs.push(s1.load().catch((e) => mutErrors.push(e)))
  jobs.push(s2.load().catch((e) => mutErrors.push(e)))
}
await Promise.all(jobs)

const file2 = join(dir, 'proj2.json')
await writeFile(file2, JSON.stringify({ n: 0 }) + '\n', 'utf8')
const fixErrors = []
const jobs2 = []
for (let i = 0; i < N; i++) {
  const s1 = new FixedStore(file2)
  const s2 = new FixedStore(file2)
  jobs2.push(s1.save({ n: i, w: 'a' }).catch((e) => fixErrors.push(e)))
  jobs2.push(s2.save({ n: i, w: 'b' }).catch((e) => fixErrors.push(e)))
  jobs2.push(s1.load().catch((e) => fixErrors.push(e)))
  jobs2.push(s2.load().catch((e) => fixErrors.push(e)))
}
await Promise.all(jobs2)

const report = {
  when: new Date().toISOString(),
  pathKeys: { samples, keys, uniqueCount: unique.size, allSame: unique.size === 1 },
  mutationLoadUnlocked: {
    total: mutErrors.length,
    byCode: tally(mutErrors),
    sample: mutErrors.slice(0, 3).map((e) => ({ code: e.code, msg: e.message })),
    claim: 'Removing lock from load only must return nonzero EPERM (or related race errors)',
  },
  controlFullLock: {
    total: fixErrors.length,
    byCode: tally(fixErrors),
    sample: fixErrors.slice(0, 3).map((e) => ({ code: e.code, msg: e.message })),
  },
  pass:
    unique.size === 1 &&
    mutErrors.length > 0 &&
    fixErrors.length === 0 &&
    (tally(mutErrors).EPERM > 0 || tally(mutErrors).ENOENT > 0),
}
writeFileSync(join(OUT, 'MUTATION-load-unlocked.json'), JSON.stringify(report, null, 2) + '\n')
console.log(JSON.stringify(report, null, 2))
if (!report.pass) process.exit(1)
