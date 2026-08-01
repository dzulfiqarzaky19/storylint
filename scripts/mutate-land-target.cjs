/**
 * MANUAL DIAGNOSTIC — Gate B for land-target.test.mjs.
 *
 * Not in a runner by design: it mutates scripts/land.mjs on disk, so running it
 * concurrently with another agent's land would corrupt a live tool. Run by hand
 * when land-target.test.mjs changes:
 *   node scripts/mutate-land-target.cjs
 *
 * A test file that has never failed is not evidence. Each mutant below breaks
 * ONE real property; the suite must reject each one. If a mutant survives, the
 * corresponding assertion is decorative and the gate is fake.
 *
 * Leg discipline (Gate B): for every mutant we require
 *   1. the anchor text was actually found (else we mutated nothing)
 *   2. the property is verifiably gone from the mutated source
 *   3. the suite RAN (parsed nonzero test count), not errored out
 *   4. the suite FAILED
 */
const fs = require('fs')
const { spawnSync } = require('child_process')

const SRC = 'scripts/land.mjs'
const SUITE = 'scripts/land-target.test.mjs'
const original = fs.readFileSync(SRC, 'utf8')

const mutants = [
  {
    id: 'MUT-1',
    what: 'push ignores --into and always writes dev',
    anchor: "return run('git', ['push', 'origin', `HEAD:${TARGET}`], { allowFail: true })",
    replace: "return run('git', ['push', 'origin', 'HEAD:dev'], { allowFail: true })",
    gone: (s) =>
      // The banner and the error message also mention HEAD:${TARGET}, so a
      // whole-file check is wrong. The property that must disappear is the
      // PUSH REFSPEC being derived from TARGET. This mutant is the nastiest
      // realistic bug: the banner still announces the feature branch while the
      // push writes dev, so the log reads correct and the branch is wrong.
      !s.includes("['push', 'origin', `HEAD:${TARGET}`]"),
  },
  {
    id: 'MUT-2',
    what: 'baseline measured on dev while pushing to the feature branch',
    anchor: "  run('git', ['checkout', '--detach', TARGET_REF])\r\n  discardGeneratedNoise()",
    replace: "  run('git', ['checkout', '--detach', 'origin/dev'])\r\n  discardGeneratedNoise()",
    gone: (s) => s.includes("'origin/dev'"),
  },
  {
    id: 'MUT-3',
    what: 'main accepted as a land target',
    anchor: "  if (!/^(dev|feature-[0-9]{2,}(-[A-Za-z0-9._-]+)?)$/.test(into)) {",
    replace: '  if (false) {',
    gone: (s) =>
      // The topic-shape validation (FEATURE_BRANCH) uses the same regex
      // fragment, so a whole-file check would find it and wrongly report the
      // mutation failed. What must disappear is the TARGET check specifically.
      !s.includes('.test(into)'),
  },
  {
    id: 'MUT-4',
    what: 'TARGET_REF drifts from TARGET (push and read-back name different branches)',
    anchor: "  TARGET_REF = 'origin/' + branch",
    replace: "  TARGET_REF = 'origin/dev'",
    gone: (s) => !s.includes("TARGET_REF = 'origin/' + branch"),
  },
  {
    id: 'MUT-5',
    what: 'setTarget never called, so --into parses but does nothing',
    anchor: '  setTarget(into)',
    replace: '  void into',
    gone: (s) => !s.includes('setTarget(into)'),
  },
]

function runSuite() {
  const res = spawnSync(process.execPath, ['--test', SUITE], {
    encoding: 'utf8',
    timeout: 120_000,
  })
  const out = `${res.stdout ?? ''}${res.stderr ?? ''}`
  // Leg 3: the suite must have RUN. Parse the counts it prints.
  const passM = out.match(/^# pass (\d+)$/m) || out.match(/pass (\d+)/)
  const failM = out.match(/^# fail (\d+)$/m) || out.match(/fail (\d+)/)
  const pass = passM ? Number(passM[1]) : null
  const fail = failM ? Number(failM[1]) : null
  const ran = pass !== null && fail !== null && pass + fail > 0
  return { status: res.status, pass, fail, ran, out }
}

let allOk = true

// Control: unmutated suite must be green, or every "mutant caught" is meaningless.
{
  const r = runSuite()
  const ok = r.ran && r.fail === 0 && r.status === 0
  console.log(
    `CONTROL  ran=${r.ran} pass=${r.pass} fail=${r.fail} exit=${r.status}  ${ok ? 'OK' : 'BROKEN'}`,
  )
  if (!ok) {
    console.log(r.out.slice(-2000))
    allOk = false
  }
}

for (const m of mutants) {
  // Leg 1: anchor must exist.
  if (!original.includes(m.anchor)) {
    console.log(`${m.id}  ANCHOR-NOT-FOUND — mutated nothing. ${m.what}`)
    allOk = false
    continue
  }
  const mutated = original.replace(m.anchor, m.replace)

  // Leg 2: the property must be verifiably gone.
  if (!m.gone(mutated)) {
    console.log(`${m.id}  PROPERTY-STILL-PRESENT — mutation did not take. ${m.what}`)
    allOk = false
    fs.writeFileSync(SRC, original)
    continue
  }

  fs.writeFileSync(SRC, mutated)
  const r = runSuite()
  fs.writeFileSync(SRC, original)

  // Legs 3 + 4: suite ran, and rejected the mutant.
  const caught = r.ran && r.fail > 0
  console.log(
    `${m.id}  ran=${r.ran} pass=${r.pass} fail=${r.fail} exit=${r.status}  ` +
      `${caught ? 'CAUGHT' : 'SURVIVED  <-- assertion is decorative'}  ${m.what}`,
  )
  if (!caught) allOk = false
}

// Restore is unconditional above, but prove it.
const restored = fs.readFileSync(SRC, 'utf8') === original
console.log(`\nrestored=${restored}`)
if (!restored) {
  console.log('FATAL: source not restored')
  process.exit(2)
}
console.log(allOk ? 'GATE B: PASS — every mutant rejected' : 'GATE B: FAIL')
process.exit(allOk ? 0 : 1)
