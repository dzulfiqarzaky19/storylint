/**
 * MANUAL DIAGNOSTIC — Gate B for standing-rules-addresses.test.mjs.
 *
 * Mutates docs/decisions/STANDING_RULES.md on disk, so it is not in a runner:
 * a concurrent agent reading the rules mid-run would see a corrupted page.
 * Run by hand when the address test changes:
 *   node scripts/mutate-standing-rules.cjs
 *
 * Legs per mutant: anchor found, property verifiably gone, suite RAN with a
 * parsed nonzero count, suite FAILED.
 */
const fs = require('fs')
const { spawnSync } = require('child_process')

const SRC = 'docs/decisions/STANDING_RULES.md'
const SUITE = 'scripts/standing-rules-addresses.test.mjs'
const original = fs.readFileSync(SRC, 'utf8')

const mutants = [
  {
    id: 'MUT-1',
    what: 'reintroduce the exact bug: pipeline block restarts at 26 (dup 26 and 35)',
    apply: (s) => {
      // Walk the pipeline block back to its old numbers.
      const lines = s.split('\r\n')
      let inPipeline = false
      for (let i = 0; i < lines.length; i++) {
        const h = lines[i].match(/^##\s+(.*)/)
        if (h) {
          inPipeline = /^Pipeline \+ tickets/.test(h[1])
          continue
        }
        if (!inPipeline) continue
        const m = lines[i].match(/^(\d+)\.\s/)
        if (!m) continue
        const n = Number(m[1])
        if (n >= 40 && n <= 53) lines[i] = lines[i].replace(/^\d+\./, n - 14 + '.')
      }
      return lines.join('\r\n')
    },
    gone: (s) => {
      // The duplicate must actually be back.
      const ids = [...s.matchAll(/^(\d+[a-z]?)\.\s+\*\*/gm)].map((m) => m[1])
      return ids.filter((x) => x === '26').length > 1
    },
  },
  {
    id: 'MUT-2',
    what: 'redirect table deleted (old citations silently resolve to the wrong rule)',
    apply: (s) => s.replace('| Old cite | Now |', '| Something Else | Column |'),
    gone: (s) => !s.includes('| Old cite | Now |'),
  },
  {
    id: 'MUT-3',
    what: 'daily set cites a rule that does not exist',
    apply: (s) => s.replace('| 49 | One land per feature', '| 991 | One land per feature'),
    gone: (s) => s.includes('| 991 |'),
  },
  {
    id: 'MUT-4',
    what: 'redirect points at a nonexistent target rule',
    apply: (s) => s.replace('| 30 (review ≠ verify) | **44** |', '| 30 (review ≠ verify) | **944** |'),
    gone: (s) => s.includes('**944**'),
  },
  {
    id: 'MUT-5',
    what: 'usage/daily-set section removed entirely',
    apply: (s) => s.replace('## How to use this page', '## Some Other Heading'),
    gone: (s) => !s.includes('## How to use this page'),
  },
]

function runSuite() {
  const res = spawnSync(process.execPath, ['--test', SUITE], {
    encoding: 'utf8',
    timeout: 120_000,
  })
  const out = `${res.stdout ?? ''}${res.stderr ?? ''}`
  const passM = out.match(/^# pass (\d+)$/m) || out.match(/pass (\d+)/)
  const failM = out.match(/^# fail (\d+)$/m) || out.match(/fail (\d+)/)
  const pass = passM ? Number(passM[1]) : null
  const fail = failM ? Number(failM[1]) : null
  return { status: res.status, pass, fail, ran: pass !== null && fail !== null && pass + fail > 0, out }
}

let allOk = true

{
  const r = runSuite()
  const ok = r.ran && r.fail === 0 && r.status === 0
  console.log(`CONTROL  ran=${r.ran} pass=${r.pass} fail=${r.fail} exit=${r.status}  ${ok ? 'OK' : 'BROKEN'}`)
  if (!ok) {
    console.log(r.out.slice(-1500))
    allOk = false
  }
}

for (const m of mutants) {
  const mutated = m.apply(original)
  if (mutated === original) {
    console.log(`${m.id}  ANCHOR-NOT-FOUND — mutated nothing. ${m.what}`)
    allOk = false
    continue
  }
  if (!m.gone(mutated)) {
    console.log(`${m.id}  PROPERTY-STILL-PRESENT — mutation did not take. ${m.what}`)
    allOk = false
    continue
  }

  fs.writeFileSync(SRC, mutated)
  const r = runSuite()
  fs.writeFileSync(SRC, original)

  const caught = r.ran && r.fail > 0
  console.log(
    `${m.id}  ran=${r.ran} pass=${r.pass} fail=${r.fail} exit=${r.status}  ` +
      `${caught ? 'CAUGHT' : 'SURVIVED  <-- assertion is decorative'}  ${m.what}`,
  )
  if (!caught) allOk = false
}

const restored = fs.readFileSync(SRC, 'utf8') === original
console.log(`\nrestored=${restored}`)
if (!restored) {
  console.log('FATAL: STANDING_RULES.md not restored')
  process.exit(2)
}
console.log(allOk ? 'GATE B: PASS — every mutant rejected' : 'GATE B: FAIL')
process.exit(allOk ? 0 : 1)
