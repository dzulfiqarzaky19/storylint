/**
 * E1 locks around step labelling.
 *
 * TRIPWIRE (source text): catches accidental refactors — import dropped,
 * local step() reintroduced, or a named phase call site removed.
 * Green here is NOT proof of runtime wiring (LG-B3 class: text can match
 * a comment). The structural proof is: k/l + prove-step-stall import the
 * SAME makeStep from step-label.mjs, and prove-step-stall exercises it
 * under a real Playwright stall.
 *
 * CALL-SITE lock: import alone is MUT-2 one level over — smoke can keep
 * the import and stop calling step() at a phase. Named step('…') strings
 * below are the production call sites this check exercises.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const e2e = resolve(root, 'e2e')

const IMPORT_RE = /import\s*\{\s*makeStep\s*\}\s*from\s*['"]\.\/step-label\.mjs['"]/
const LOCAL_STEP_RE = /\bconst\s+STEP_T0\b|\bfunction\s+step\s*\(\s*label\s*\)/

/** Must appear as live step('…') calls in slice-k (not only in comments). */
const SLICE_K_PHASES = [
  'mint',
  'seed',
  'goto desktop',
  'propose+accept',
  'canon click',
  'propose editor',
  'companion inbox accept',
  'family view',
  'narrow page',
  'PASS',
]

const SLICE_L_PHASES = [
  'mint',
  'goto',
  'open lab',
  'companion faces',
  'create card',
  'promote',
  'graph ignore lab',
  'PASS',
]

function liveStepCall(src, label) {
  // Require step('label') or step("label") on a non-comment-only line.
  const re = new RegExp(
    String.raw`^\s*step\(\s*['"]${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]\s*\)`,
    'm',
  )
  return re.test(src)
}

test('E1-tripwire: step-label.mjs exports makeStep with sync stdout write', () => {
  const path = resolve(e2e, 'step-label.mjs')
  assert.ok(existsSync(path), 'e2e/step-label.mjs missing')
  const src = readFileSync(path, 'utf8')
  assert.match(src, /export\s+function\s+makeStep\s*\(/)
  assert.match(src, /process\.stdout\.write/)
})

test('E1-tripwire: slice-k-smoke imports makeStep (no local step copy)', () => {
  const src = readFileSync(resolve(e2e, 'slice-k-smoke.mjs'), 'utf8')
  assert.match(src, IMPORT_RE)
  assert.equal(LOCAL_STEP_RE.test(src), false, 'slice-k reintroduced local STEP_T0/function step')
  assert.match(src, /makeStep\(\s*['"]slice-k['"]\s*\)/)
})

test('E1-tripwire: slice-l-smoke imports makeStep (no local step copy)', () => {
  const src = readFileSync(resolve(e2e, 'slice-l-smoke.mjs'), 'utf8')
  assert.match(src, IMPORT_RE)
  assert.equal(LOCAL_STEP_RE.test(src), false, 'slice-l reintroduced local STEP_T0/function step')
  assert.match(src, /makeStep\(\s*['"]slice-l['"]\s*\)/)
})

test('E1-call-site: slice-k invokes step() at each named phase', () => {
  // Production symbols exercised: the step('…') call sites in slice-k-smoke.mjs.
  const src = readFileSync(resolve(e2e, 'slice-k-smoke.mjs'), 'utf8')
  const missing = SLICE_K_PHASES.filter((p) => !liveStepCall(src, p))
  assert.deepEqual(missing, [], `slice-k missing live step() calls: ${missing.join(', ')}`)
})

test('E1-call-site: slice-l invokes step() at each named phase', () => {
  const src = readFileSync(resolve(e2e, 'slice-l-smoke.mjs'), 'utf8')
  const missing = SLICE_L_PHASES.filter((p) => !liveStepCall(src, p))
  assert.deepEqual(missing, [], `slice-l missing live step() calls: ${missing.join(', ')}`)
})

test('E1-tripwire: prove-step-stall binds shipping helper (not throwaway-only)', () => {
  const src = readFileSync(resolve(e2e, 'prove-step-stall.mjs'), 'utf8')
  assert.match(src, /slice-k-smoke\.mjs/)
  assert.match(src, /slice-l-smoke\.mjs/)
  assert.match(src, /step-label\.mjs/)
  assert.match(src, /import \{ makeStep \} from '\.\/step-label\.mjs'/)
  assert.equal(/Throwaway:\s*copies slice-k path/.test(src), false)
})
