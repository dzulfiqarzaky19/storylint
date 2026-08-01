/**
 * Expected step phases for k/l runtime call-site lock.
 *
 * SEPARATE from the smokes on purpose. Removing a step() call and also
 * deleting its list entry here would keep the smoke green — that is the
 * "loosen to pass" failure. Editing this file requires the same justification
 * as removing the phase from the product smoke path. Do not empty or shrink
 * a list just to silence assertStepPhases.
 *
 * Source of truth for NAMES: the live step('…') calls in slice-k / slice-l.
 * When you rename a phase in the smoke, rename it here in the same commit.
 */
export const SLICE_K_PHASES = Object.freeze([
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
])

export const SLICE_L_PHASES = Object.freeze([
  'mint',
  'goto',
  'open lab',
  'companion faces',
  'create card',
  'promote',
  'graph ignore lab',
  'PASS',
])
