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
 *    checkShippingMakeStepImports against real k/l sources. Multi-specifier
 *    imports allowed. prove-step-stall is MANUAL DIAGNOSTIC; its static half
 *    uses the same lock. Tripwire asserts prove text still binds shipping helper.
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
import { readFileSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { makeStep, assertStepPhases } from '../e2e/step-label.mjs'
import { SLICE_K_PHASES, SLICE_L_PHASES } from '../e2e/step-phases.mjs'
import {
  MAKESTEP_IMPORT_RE,
  checkShippingMakeStepImports,
} from '../e2e/step-import-lock.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const e2e = resolve(root, 'e2e')

const LOCAL_STEP_RE = /\bconst\s+STEP_T0\b|\bfunction\s+step\s*\(\s*label\s*\)/

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
