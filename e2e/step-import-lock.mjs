/**
 * Shared E1 static lock: shipping k/l must import makeStep from step-label.mjs.
 *
 * Multi-specifier imports are allowed (`{ makeStep, assertStepPhases }`).
 * Sole-specifier regexes break when the runtime lock adds a second name (tigress
 * at 44784dc: prove-step-stall exit 1 with wrong cause after c7361ac).
 *
 * Used by:
 *   - e2e/prove-step-stall.mjs (manual diagnostic; static half before stall)
 *   - scripts/e1-step-label.test.mjs (gated green suite — redness is someone's problem)
 */
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

/** Tolerates any specifier list that includes makeStep. */
export const MAKESTEP_IMPORT_RE =
  /import\s*\{[^}]*\bmakeStep\b[^}]*\}\s*from\s*['"]\.\/step-label\.mjs['"]/

const LOCAL_STEP_RE = /\bconst\s+STEP_T0\b|\bfunction\s+step\s*\(\s*label\s*\)/

/**
 * @param {string} e2eDir absolute path to e2e/
 * @returns {{ ok: boolean, problems: string[] }}
 */
export function checkShippingMakeStepImports(e2eDir) {
  const problems = []
  const shipping = ['slice-k-smoke.mjs', 'slice-l-smoke.mjs']
  for (const name of shipping) {
    const path = resolve(e2eDir, name)
    if (!existsSync(path)) {
      problems.push(`${name}: missing`)
      continue
    }
    const src = readFileSync(path, 'utf8')
    if (!MAKESTEP_IMPORT_RE.test(src)) {
      problems.push(`${name}: missing import { … makeStep … } from './step-label.mjs'`)
    }
    if (LOCAL_STEP_RE.test(src)) {
      problems.push(`${name}: local STEP_T0 / function step reintroduced (must use makeStep)`)
    }
  }
  const helperPath = resolve(e2eDir, 'step-label.mjs')
  if (!existsSync(helperPath)) {
    problems.push('step-label.mjs: missing')
  } else {
    const helper = readFileSync(helperPath, 'utf8')
    if (!/export\s+function\s+makeStep\s*\(/.test(helper)) {
      problems.push('step-label.mjs: export function makeStep missing')
    }
    if (!/process\.stdout\.write/.test(helper)) {
      problems.push('step-label.mjs: must sync-write via process.stdout.write')
    }
  }
  return { ok: problems.length === 0, problems }
}
