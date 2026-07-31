import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  classifyTestGreen,
  compareFailures,
  gateNoWorseDecision,
  inspectWorktreePrep,
  parseFailures,
} from './land-gate.mjs'
import { existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')

// --- prep ---

test('inspectWorktreePrep: missing node_modules is not ok', () => {
  const dir = mkdtempSync(join(tmpdir(), 'land-prep-'))
  try {
    writeFileSync(join(dir, 'package.json'), '{}')
    const r = inspectWorktreePrep(dir)
    assert.equal(r.ok, false)
    assert.ok(r.reasons.includes('missing-node_modules'))
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('inspectWorktreePrep: node_modules without typescript is not ok', () => {
  const dir = mkdtempSync(join(tmpdir(), 'land-prep-'))
  try {
    writeFileSync(join(dir, 'package.json'), '{}')
    mkdirSync(join(dir, 'node_modules'))
    const r = inspectWorktreePrep(dir)
    assert.equal(r.ok, false)
    assert.ok(r.reasons.includes('missing-typescript-tsc'))
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('inspectWorktreePrep: current repo worktree is prepared', () => {
  const r = inspectWorktreePrep(process.cwd())
  assert.equal(r.ok, true, `expected prepared, got ${r.reasons.join(',')}`)
})

// --- the rat incident: tsc not recognized, both sides identical void ---

const TSC_NOT_RECOGNIZED = `
> storylint@0.0.0 test:green
> node e2e/guard-helpers.mjs && npm run build && npm test && node e2e/all-smoke.mjs && node e2e/calm-budget.mjs

guard-helpers: PASS

> storylint@0.0.0 build
> tsc -b && vite build

'tsc' is not recognized as an internal or external command,
operable program or batch file.
`

// Realistic full green evidence — requires calm TERMINAL markers (FINGERPRINT / HARD fails)
const FULL_GREEN_LOG = `
> node e2e/guard-helpers.mjs && npm run build && npm test && node e2e/all-smoke.mjs && node e2e/calm-budget.mjs
PASS: e2e helper convention
> tsc -b && vite build
vite v6.0.0 building for production...
✓ built in 1.2s
✔ unit one (1ms)
ℹ tests 1
ℹ pass 1
ℹ fail 0
PASS  e2e/slice-a-smoke.mjs
PASS: all 10 feature smokes
[PASS] calm-check (HARD) ok
HARD fails: 0
FINGERPRINT eddd76a4
calm-budget: done
`

test('tsc-not-recognized is NOT-MEASURED, never opaque:exit-1', () => {
  const report = classifyTestGreen(TSC_NOT_RECOGNIZED, 1)
  assert.equal(report.measurement, 'not-measured')
  assert.ok(report.notMeasuredReasons.some((r) => r.includes('tsc-not-recognized')))
  assert.ok([...report.failures].some((f) => f === 'infra:tsc-not-recognized'))
  assert.ok(![...report.failures].some((f) => f.startsWith('opaque:')))
})

test('identical void baseline+candidate must HARD ABORT, not no-worse pass', () => {
  const baseline = classifyTestGreen(TSC_NOT_RECOGNIZED, 1)
  const candidate = classifyTestGreen(TSC_NOT_RECOGNIZED, 1)
  // Old bug: both got opaque:test-green-exit-1 → introduced=0 → pass.
  const decision = gateNoWorseDecision(baseline, candidate)
  assert.equal(decision.ok, false)
  assert.equal(decision.code, 'baseline-not-measured')
})

test('candidate-only void also hard aborts', () => {
  const green = classifyTestGreen(FULL_GREEN_LOG, 0)
  const voidRun = classifyTestGreen(TSC_NOT_RECOGNIZED, 1)
  assert.equal(green.measurement, 'measured')
  const decision = gateNoWorseDecision(green, voidRun)
  assert.equal(decision.ok, false)
  assert.equal(decision.code, 'candidate-not-measured')
})

// --- hawk LG-B1: exit 0 never measures from status alone ---

test('LG-B1: empty log exit 0 is NOT-MEASURED (never measured green)', () => {
  const report = classifyTestGreen('', 0)
  assert.equal(report.measurement, 'not-measured')
  assert.ok(report.notMeasuredReasons.includes('not-measured:green-exit-without-stage-evidence'))
  const decision = gateNoWorseDecision(report, report)
  assert.equal(decision.ok, false)
  assert.equal(decision.code, 'baseline-not-measured')
})

test('LG-B1: npm header only exit 0 is NOT-MEASURED', () => {
  const log = '> storylint@0.0.0 test:green\n> node e2e/guard-helpers.mjs && npm run build\n'
  const report = classifyTestGreen(log, 0)
  assert.equal(report.measurement, 'not-measured')
  assert.ok(report.notMeasuredReasons.includes('not-measured:green-exit-without-stage-evidence'))
})

test('LG-B1: guard PASS only then kill exit 0 is NOT-MEASURED', () => {
  const log = 'PASS: e2e helper convention\nguard-helpers: PASS\n'
  const report = classifyTestGreen(log, 0)
  assert.equal(report.measurement, 'not-measured')
  assert.ok(!report.stagesPassed.calm)
})

// --- hawk LG-B2: infra branch must fire at exit 0 (not only exit 1) ---

test('LG-B2: EADDRINUSE at exit 0 is NOT-MEASURED via infra branch', () => {
  // Full green body + port conflict: must still be not-measured because of infra signal.
  // If someone disables `if (infra.length)`, this test goes red (would look measured-green).
  const log = FULL_GREEN_LOG + '\nError: listen EADDRINUSE: address already in use :::4173\n'
  const report = classifyTestGreen(log, 0)
  assert.equal(report.measurement, 'not-measured')
  assert.ok(report.notMeasuredReasons.includes('infra:port-in-use'))
  assert.ok(report.failures.has('infra:port-in-use'))
  // And the infra reason is what blocks no-worse, not a missing-stage reason alone.
  const decision = gateNoWorseDecision(report, report)
  assert.equal(decision.ok, false)
  assert.equal(decision.code, 'baseline-not-measured')
})

test('LG-B2: tsc-not-recognized at exit 0 is NOT-MEASURED (infra, not exit-1 second branch)', () => {
  const report = classifyTestGreen(TSC_NOT_RECOGNIZED, 0)
  assert.equal(report.measurement, 'not-measured')
  assert.ok(report.notMeasuredReasons.some((r) => r.includes('tsc-not-recognized')))
})

// --- granular product identities ---

const UNIT_FAIL_LOG = `
> npm test
✖ network volume regime boundary (1.2ms)
✖ other test (0.5ms)
ℹ tests 2
ℹ pass 0
ℹ fail 2
`

test('unit failures parse to unit:name identities', () => {
  const report = classifyTestGreen(UNIT_FAIL_LOG, 1)
  assert.equal(report.measurement, 'measured')
  assert.ok(report.failures.has('unit:network volume regime boundary'))
  assert.ok(report.failures.has('unit:other test'))
})

const SMOKE_FAIL_LOG = `
PASS  e2e/slice-a-smoke.mjs
FAIL  e2e/slice-j-smoke.mjs  (exit 1)
PASS  e2e/slice-k-smoke.mjs
`

test('smoke failures parse to smoke:path', () => {
  const report = classifyTestGreen(SMOKE_FAIL_LOG, 1)
  assert.equal(report.measurement, 'measured')
  assert.ok(report.failures.has('smoke:e2e/slice-j-smoke.mjs'))
  assert.ok(!report.failures.has('smoke:e2e/slice-a-smoke.mjs'))
})

const CALM_FAIL_LOG = `
[PASS] something (HARD) ok
[FAIL] B3-inbox-wall@volume (HARD) over budget
[WARN] soft-thing (WARN) ignored for land
`

test('calm HARD fails parse; WARN does not', () => {
  const report = classifyTestGreen(CALM_FAIL_LOG, 1)
  assert.equal(report.measurement, 'measured')
  assert.ok(report.failures.has('calm:B3-inbox-wall@volume'))
  assert.ok(![...report.failures].some((f) => f.includes('soft-thing')))
})

const BUILD_TS_LOG = `
> tsc -b && vite build
src/foo.ts(1,2): error TS2304: Cannot find name 'x'.
`

test('TypeScript product errors are build:TS identities (measured)', () => {
  const report = classifyTestGreen(BUILD_TS_LOG, 1)
  assert.equal(report.measurement, 'measured')
  assert.ok([...report.failures].some((f) => f.startsWith('build:TS2304:')))
})

const GUARD_FAIL_LOG = `
FAIL: e2e helper convention — raw page.click found
`

test('guard failure identity', () => {
  const report = classifyTestGreen(GUARD_FAIL_LOG, 1)
  assert.equal(report.measurement, 'measured')
  assert.ok(report.failures.has('guard:e2e-helper-convention'))
})

// --- no-worse product compare still works when measured ---

test('no-worse: introduced product failure aborts', () => {
  const baseline = classifyTestGreen(UNIT_FAIL_LOG.replace('✖ other test (0.5ms)\n', ''), 1)
  // baseline only has one unit fail; candidate adds smoke
  const candidateLog = UNIT_FAIL_LOG + '\n' + SMOKE_FAIL_LOG
  const candidate = classifyTestGreen(candidateLog, 1)
  const decision = gateNoWorseDecision(baseline, candidate)
  assert.equal(decision.ok, false)
  assert.equal(decision.code, 'introduced-failures')
  assert.ok(decision.introduced.some((id) => id.startsWith('smoke:')))
})

test('no-worse: same product failures is pass (pre-existing)', () => {
  const baseline = classifyTestGreen(UNIT_FAIL_LOG, 1)
  const candidate = classifyTestGreen(UNIT_FAIL_LOG, 1)
  const decision = gateNoWorseDecision(baseline, candidate)
  assert.equal(decision.ok, true)
  assert.equal(decision.introduced.length, 0)
  assert.ok(decision.preExisting.length >= 1)
})

test('no-worse: fully green both sides passes', () => {
  const baseline = classifyTestGreen(FULL_GREEN_LOG, 0)
  const candidate = classifyTestGreen(FULL_GREEN_LOG, 0)
  assert.equal(baseline.measurement, 'measured')
  assert.ok(baseline.stagesPassed.calm, 'green body requires calm terminal')
  const decision = gateNoWorseDecision(baseline, candidate)
  assert.equal(decision.ok, true)
  assert.equal(decision.introduced.length, 0)
})

// exit without identity is NOT-MEASURED, not opaque tie fuel
test('exit 1 empty log is NOT-MEASURED, not opaque:test-green-exit-1', () => {
  const report = classifyTestGreen('', 1)
  assert.equal(report.measurement, 'not-measured')
  assert.ok(![...report.failures].some((f) => f.startsWith('opaque:')))
  assert.ok(report.notMeasuredReasons.length >= 1)
})

test('parseFailures back-compat returns a Set', () => {
  const set = parseFailures(UNIT_FAIL_LOG, 1)
  assert.ok(set instanceof Set)
  assert.ok(set.has('unit:network volume regime boundary'))
})

test('compareFailures identity subtract', () => {
  const { introduced, fixed, preExisting } = compareFailures(
    new Set(['unit:a', 'smoke:x']),
    new Set(['unit:a', 'smoke:y']),
  )
  assert.deepEqual(preExisting, ['unit:a'])
  assert.deepEqual(introduced, ['smoke:y'])
  assert.deepEqual(fixed, ['smoke:x'])
})

// playwright missing browser
test('missing playwright browser is NOT-MEASURED infra', () => {
  const log = `
PASS: e2e helper convention
✓ built in 1s
ℹ tests 1
ℹ fail 0
Executable doesn't exist at C:\\\\foo\\\\chrome
browserType.launch: Executable doesn't exist
`
  const report = classifyTestGreen(log, 1)
  assert.equal(report.measurement, 'not-measured')
  assert.ok(report.notMeasuredReasons.includes('infra:playwright-browser-missing'))
})

// --- buffalo specimen: calm started, no terminal, exit 1 ---
// Permanent path: e2e/proofs/buffalo-land-opaque-on-green.output
// (also e2e/proofs/land-gate/buffalo-calm-incomplete.output once copied)

test('buffalo incomplete-calm fixture is NOT-MEASURED stage-died:calm, never opaque', () => {
  const paths = [
    join(root, 'e2e', 'proofs', 'land-gate', 'buffalo-calm-incomplete.output'),
    join(root, 'e2e', 'proofs', 'buffalo-land-opaque-on-green.output'),
  ]
  const path = paths.find((p) => existsSync(p))
  assert.ok(path, `buffalo fixture missing; tried ${paths.join(' | ')}`)
  const raw = readFileSync(path, 'utf8')
  // Prefer the test:green slice if the file is a full land transcript
  let slice = raw
  const start = raw.indexOf('> storylint@')
  const end = raw.indexOf('land: full log also at')
  if (start >= 0) {
    slice = raw.slice(start, end > start ? end : undefined)
  }
  const report = classifyTestGreen(slice, 1)
  assert.equal(report.measurement, 'not-measured')
  assert.ok(
    report.notMeasuredReasons.some(
      (r) =>
        r === 'not-measured:stage-died-without-identity:calm' ||
        r === 'not-measured:calm-started-without-terminal-marker',
    ),
    `unexpected reasons: ${report.notMeasuredReasons.join(',')}`,
  )
  assert.ok(![...report.failures].some((f) => f.startsWith('opaque:')))
  // Identical incomplete-calm on both sides must HARD ABORT (not theatre pass)
  const decision = gateNoWorseDecision(report, report)
  assert.equal(decision.ok, false)
  assert.equal(decision.code, 'baseline-not-measured')
})

test('calm self-tests without FINGERPRINT/HARD fails is incomplete even at exit 0', () => {
  const log = `
PASS: e2e helper convention
✓ built in 1.2s
ℹ tests 1
ℹ fail 0
PASS: all 10 feature smokes
visibility-self-test: ok
[PASS] visibility (HARD) ok
`
  const report = classifyTestGreen(log, 0)
  assert.equal(report.measurement, 'not-measured')
  assert.ok(report.notMeasuredReasons.includes('not-measured:calm-started-without-terminal-marker'))
  assert.equal(report.stagesSeen.calm, true)
  assert.equal(report.stagesPassed.calm, false)
})
