/**
 * E1 locks around step labelling.
 *
 * Layers (standing 8c — name the production symbol each exercises):
 *
 * 1) RUNTIME call-site lock (primary MUT-2 closure):
 *    Production symbols = makeStep invocations inside slice-k/l.
 *    makeStep records step.calls on every real invoke; smokes call
 *    assertStepPhases(step, SLICE_*_PHASES) at PASS. A skipped step() call
 *    fails the smoke. Unit tests below lock makeStep.calls + assertStepPhases
 *    with a skip-one-call mutation (if (false) step(...) still fails because
 *    the call never happens — unlike source greps).
 *
 * 2) STRUCTURAL module coupling (EXECUTES shared lock, not grep of prove text):
 *    checkShippingMakeStepImports against real k/l sources AND against
 *    negative fixture dirs (reject direction). Multi-specifier imports allowed.
 *    prove-step-stall is MANUAL DIAGNOSTIC; its static half uses the same lock.
 *    LOCAL_STEP_RE is imported from the lock — no second definition.
 *
 * 3) SOURCE TRIPWIRE only:
 *    Import present / no local STEP_T0 / phase strings appear as live lines.
 *    Green here is NOT proof of wiring (LG-B3: text can match comments or
 *    dead branches). Keep for fast accidental-refactor signal.
 *
 * Phase list lives in e2e/step-phases.mjs SEPARATE from the smokes. Removing
 * a step() call and also deleting its list entry would stay green — that is
 * the "loosen to pass" failure. Editing step-phases.mjs requires the same
 * justification as removing the phase from the smoke. Never shrink a list
 * just to silence assertStepPhases.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  readFileSync,
  existsSync,
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  rmSync,
} from 'node:fs'
import { dirname, resolve, join } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { makeStep, assertStepPhases } from '../e2e/step-label.mjs'
import { SLICE_K_PHASES, SLICE_L_PHASES } from '../e2e/step-phases.mjs'
import {
  MAKESTEP_IMPORT_RE,
  LOCAL_STEP_RE,
  checkShippingMakeStepImports,
} from '../e2e/step-import-lock.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const e2e = resolve(root, 'e2e')

/** Minimal valid step-label helper body for fixture dirs. */
const VALID_HELPER = `export function makeStep(prefix) {
  const step = (label) => { step.calls.push(label); process.stdout.write(label) }
  step.calls = []
  step.prefix = prefix
  return step
}
export function assertStepPhases() {}
`

/** Clean multi-spec import + makeStep use (no local step). */
const CLEAN_K = `import { makeStep, assertStepPhases } from './step-label.mjs'
const step = makeStep('slice-k')
step('mint')
`

const CLEAN_L = `import { makeStep, assertStepPhases } from './step-label.mjs'
const step = makeStep('slice-l')
step('mint')
`

/**
 * Build a temp e2e-shaped dir and run the shared lock against it.
 * Copies a real helper by default so helper checks stay green.
 * @param {{ k?: string, l?: string, helper?: string|null }} parts
 */
function lockAgainstFixture(parts) {
  const dir = mkdtempSync(join(tmpdir(), 'e1-lock-'))
  try {
    writeFileSync(join(dir, 'slice-k-smoke.mjs'), parts.k ?? CLEAN_K)
    writeFileSync(join(dir, 'slice-l-smoke.mjs'), parts.l ?? CLEAN_L)
    if (parts.helper !== null) {
      writeFileSync(join(dir, 'step-label.mjs'), parts.helper ?? VALID_HELPER)
    }
    return checkShippingMakeStepImports(dir)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

// --- RUNTIME (primary) ----------------------------------------------------

test('E1-runtime: makeStep records every real invoke on step.calls', () => {
  const step = makeStep('unit')
  step('mint')
  step('seed')
  // dead branch must NOT count (LG-B3 class — source greps would still see it)
  if (false) step('ghost')
  assert.deepEqual(step.calls, ['mint', 'seed'])
  assert.equal(step.prefix, 'unit')
})

test('E1-runtime: assertStepPhases fails when a phase was never invoked', () => {
  const step = makeStep('unit')
  step('mint')
  step('seed')
  // skip 'goto' — the mutation that source greps miss when written as if(false)
  assert.throws(
    () => assertStepPhases(step, ['mint', 'seed', 'goto'], 'unit-mut'),
    /never called for phase\(s\): goto/,
  )
})

test('E1-runtime: assertStepPhases passes when all expected phases invoked', () => {
  const step = makeStep('unit')
  for (const p of ['mint', 'seed', 'goto']) step(p)
  assert.doesNotThrow(() => assertStepPhases(step, ['mint', 'seed', 'goto'], 'unit-ok'))
})

test('E1-runtime: slice-k smoke wires assertStepPhases against step-phases list', () => {
  const src = readFileSync(resolve(e2e, 'slice-k-smoke.mjs'), 'utf8')
  assert.match(src, /assertStepPhases\s*\(\s*step\s*,\s*SLICE_K_PHASES/)
  assert.match(src, /from\s*['"]\.\/step-phases\.mjs['"]/)
  // list is non-empty frozen export
  assert.ok(SLICE_K_PHASES.includes('propose+accept'))
  assert.ok(SLICE_K_PHASES.includes('PASS'))
  assert.ok(Object.isFrozen(SLICE_K_PHASES))
})

test('E1-runtime: slice-l smoke wires assertStepPhases against step-phases list', () => {
  const src = readFileSync(resolve(e2e, 'slice-l-smoke.mjs'), 'utf8')
  assert.match(src, /assertStepPhases\s*\(\s*step\s*,\s*SLICE_L_PHASES/)
  assert.ok(SLICE_L_PHASES.includes('promote'))
  assert.ok(SLICE_L_PHASES.includes('PASS'))
  assert.ok(Object.isFrozen(SLICE_L_PHASES))
})

// --- STRUCTURAL: EXECUTES shared lock against real k/l --------------------

test('E1-static: checkShippingMakeStepImports passes on real k/l sources', () => {
  const { ok, problems } = checkShippingMakeStepImports(e2e)
  assert.equal(ok, true, problems.join('; '))
})

test('E1-static: multi-specifier import sample matches MAKESTEP_IMPORT_RE', () => {
  // Fixture locks the multi-spec form that broke sole-specifier regex after c7361ac.
  const sample = "import { makeStep, assertStepPhases } from './step-label.mjs'\n"
  assert.match(sample, MAKESTEP_IMPORT_RE)
  const sole = "import { makeStep } from './step-label.mjs'\n"
  assert.match(sole, MAKESTEP_IMPORT_RE)
  const missing = "import { assertStepPhases } from './step-label.mjs'\n"
  assert.equal(MAKESTEP_IMPORT_RE.test(missing), false)
})

// --- NEGATIVE FIXTURES: reject direction of the SHARED lock (hawk MUT-C/D) --
// These must fail INSIDE checkShippingMakeStepImports, not only at tripwires.
// A clean temp helper is supplied so failures are about k/l shape, not helper.

test('E1-static-neg: no makeStep import at all → lock rejects', () => {
  const { ok, problems } = lockAgainstFixture({
    k: `// no import\nconst step = (l) => {}\n`,
  })
  assert.equal(ok, false, 'lock must reject missing import')
  assert.ok(
    problems.some((p) => p.includes('slice-k-smoke.mjs') && p.includes('missing import')),
    `expected missing-import problem, got: ${problems.join('; ')}`,
  )
})

test('E1-static-neg: makeStep imported from wrong module → lock rejects', () => {
  const { ok, problems } = lockAgainstFixture({
    k: `import { makeStep } from './elsewhere.mjs'\nconst step = makeStep('slice-k')\n`,
  })
  assert.equal(ok, false, 'lock must reject wrong from-path')
  assert.ok(
    problems.some((p) => p.includes('slice-k-smoke.mjs') && p.includes('missing import')),
    `expected missing-import (wrong from), got: ${problems.join('; ')}`,
  )
})

test('E1-static-neg: local function step reintroduced → lock rejects', () => {
  // Import present AND local step copy — both conditions; lock must flag local.
  const { ok, problems } = lockAgainstFixture({
    k: `import { makeStep } from './step-label.mjs'
const STEP_T0 = Date.now()
function step(label) { console.log(label) }
`,
  })
  assert.equal(ok, false, 'lock must reject local STEP_T0 / function step')
  assert.ok(
    problems.some((p) => p.includes('slice-k-smoke.mjs') && p.includes('local STEP_T0')),
    `expected local-step problem, got: ${problems.join('; ')}`,
  )
})

test('E1-static-neg: import commented out → lock rejects (LG-B3 class)', () => {
  // The shape that bit twice: text looks like an import to a casual read,
  // but is not live. MAKESTEP_IMPORT_RE must not match inside a line comment.
  const { ok, problems } = lockAgainstFixture({
    k: `// import { makeStep, assertStepPhases } from './step-label.mjs'
const step = (label) => {}
`,
  })
  assert.equal(ok, false, 'lock must reject commented-out import')
  assert.ok(
    problems.some((p) => p.includes('slice-k-smoke.mjs') && p.includes('missing import')),
    `expected missing-import for commented import, got: ${problems.join('; ')}`,
  )
  // And the regex itself must not match the commented line alone.
  assert.equal(
    MAKESTEP_IMPORT_RE.test(`// import { makeStep } from './step-label.mjs'\n`),
    false,
    'MAKESTEP_IMPORT_RE must not match commented import',
  )
})

test('E1-static-neg: slice-l alone broken still rejects (shipping list load-bearing)', () => {
  // MUT-D class: lock must inspect BOTH shipping files.
  const { ok, problems } = lockAgainstFixture({
    k: CLEAN_K,
    l: `// l has no makeStep import\nexport const x = 1\n`,
  })
  assert.equal(ok, false, 'lock must reject broken slice-l even when k is clean')
  assert.ok(
    problems.some((p) => p.includes('slice-l-smoke.mjs')),
    `expected slice-l problem, got: ${problems.join('; ')}`,
  )
})

test('E1-static-neg: fixture clean baseline is accepted (control)', () => {
  const { ok, problems } = lockAgainstFixture({})
  assert.equal(ok, true, problems.join('; '))
})

// --- TRIPWIRE -------------------------------------------------------------

test('E1-tripwire: step-label.mjs exports makeStep with sync stdout write + calls', () => {
  const path = resolve(e2e, 'step-label.mjs')
  assert.ok(existsSync(path), 'e2e/step-label.mjs missing')
  const src = readFileSync(path, 'utf8')
  assert.match(src, /export\s+function\s+makeStep\s*\(/)
  assert.match(src, /process\.stdout\.write/)
  assert.match(src, /step\.calls/)
  assert.match(src, /export\s+function\s+assertStepPhases\s*\(/)
})

test('E1-tripwire: slice-k-smoke imports makeStep (no local step copy)', () => {
  const src = readFileSync(resolve(e2e, 'slice-k-smoke.mjs'), 'utf8')
  assert.match(src, MAKESTEP_IMPORT_RE)
  assert.equal(LOCAL_STEP_RE.test(src), false, 'slice-k reintroduced local STEP_T0/function step')
  assert.match(src, /makeStep\(\s*['"]slice-k['"]\s*\)/)
})

test('E1-tripwire: slice-l-smoke imports makeStep (no local step copy)', () => {
  const src = readFileSync(resolve(e2e, 'slice-l-smoke.mjs'), 'utf8')
  assert.match(src, MAKESTEP_IMPORT_RE)
  assert.equal(LOCAL_STEP_RE.test(src), false, 'slice-l reintroduced local STEP_T0/function step')
  assert.match(src, /makeStep\(\s*['"]slice-l['"]\s*\)/)
})

test('E1-tripwire: LOCAL_STEP_RE is single-sourced from step-import-lock', () => {
  // Drift guard: this test file must not redeclare LOCAL_STEP_RE.
  const src = readFileSync(fileURLToPath(import.meta.url), 'utf8')
  assert.match(src, /LOCAL_STEP_RE/)
  assert.match(src, /from\s*['"]\.\.\/e2e\/step-import-lock\.mjs['"]/)
  // No local `const LOCAL_STEP_RE =` / `let` / bare assign — only import.
  assert.equal(
    /^\s*(?:const|let|var)\s+LOCAL_STEP_RE\s*=/m.test(src),
    false,
    'e1-step-label.test.mjs redeclared LOCAL_STEP_RE (must import from lock)',
  )
  const lockSrc = readFileSync(resolve(e2e, 'step-import-lock.mjs'), 'utf8')
  assert.match(lockSrc, /export\s+const\s+LOCAL_STEP_RE\s*=/)
})

test('E1-tripwire: prove-step-stall is MANUAL DIAGNOSTIC bound to shipping helper', () => {
  const src = readFileSync(resolve(e2e, 'prove-step-stall.mjs'), 'utf8')
  assert.match(src, /MANUAL DIAGNOSTIC/)
  assert.match(src, /checkShippingMakeStepImports/)
  assert.match(src, /step-import-lock\.mjs/)
  assert.match(src, /import \{ makeStep \} from '\.\/step-label\.mjs'/)
  // Must NOT hardcode sole-specifier regex (broke after multi-spec import).
  assert.equal(
    /import\\s\*\{\\s\*makeStep\\s\*\}\\s\*from/.test(src),
    false,
    'prove-step-stall still has sole-specifier makeStep regex',
  )
  assert.equal(/Throwaway:\s*copies slice-k path/.test(src), false)
})

test('E1-tripwire: step-phases.mjs is separate and documents loosen-to-pass rule', () => {
  const src = readFileSync(resolve(e2e, 'step-phases.mjs'), 'utf8')
  assert.match(src, /loosen to pass/)
  assert.match(src, /same justification/)
  assert.match(src, /export const SLICE_K_PHASES/)
  assert.match(src, /export const SLICE_L_PHASES/)
})
