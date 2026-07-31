import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

/**
 * Hawk/rat hole: 18/18 on land-gate.mjs proves the pure module behaves.
 * It does NOT prove land.mjs consults it. This file locks the wiring.
 *
 * If someone re-inlines parse/compare in land.mjs, or stops calling
 * gateNoWorseDecision / classifyTestGreen / inspectWorktreePrep, these fail.
 */

const here = dirname(fileURLToPath(import.meta.url))
const landSrc = readFileSync(join(here, 'land.mjs'), 'utf8')
const gateSrc = readFileSync(join(here, 'land-gate.mjs'), 'utf8')

test('land.mjs imports the pure gate module (not a copy)', () => {
  assert.match(landSrc, /from ['"]\.\/land-gate\.mjs['"]/)
  assert.match(landSrc, /classifyTestGreen/)
  assert.match(landSrc, /gateNoWorseDecision/)
  assert.match(landSrc, /inspectWorktreePrep/)
})

test('land.mjs calls gateNoWorseDecision on the decision path', () => {
  // Must be an actual call, not only an import binding.
  assert.match(landSrc, /gateNoWorseDecision\s*\(/)
  // Decision failure must hard-abort via fail(...), not soft-log.
  const gateBlock = landSrc.slice(
    landSrc.indexOf('async function gateNoWorse'),
    landSrc.indexOf('function createNoFfBubble'),
  )
  assert.ok(gateBlock.includes('gateNoWorseDecision('), 'gateNoWorse body must call gateNoWorseDecision')
  assert.ok(
    /if\s*\(\s*!decision\.ok\s*\)/.test(gateBlock) || gateBlock.includes('if (!decision.ok)'),
    'must branch on decision.ok',
  )
  assert.ok(gateBlock.includes('fail(decision.reason)'), 'must fail(decision.reason) on !ok')
})

test('land.mjs classifies test:green via classifyTestGreen (no opaque:exit emit)', () => {
  const runBlock = landSrc.slice(
    landSrc.indexOf('async function runTestGreenLabeled'),
    landSrc.indexOf('async function captureDevBaseline'),
  )
  assert.ok(runBlock.includes('classifyTestGreen('), 'runTestGreenLabeled must call classifyTestGreen')
  assert.ok(
    !/failures\.add\(\s*[`'"]opaque:/.test(runBlock),
    'must not emit opaque:exit-N tokens',
  )
  assert.ok(
    runBlock.includes('measurement') && runBlock.includes('report'),
    'must surface measurement from the report',
  )
})

test('land.mjs refuses unprepared worktrees via inspectWorktreePrep before green', () => {
  assert.match(landSrc, /function assertWorktreePrepared/)
  assert.match(landSrc, /inspectWorktreePrep\s*\(/)
  const once = landSrc.slice(
    landSrc.indexOf('async function landOnce'),
    landSrc.indexOf('async function main'),
  )
  assert.ok(once.includes('assertWorktreePrepared()'), 'landOnce must call assertWorktreePrepared')
  // Ordering: prep before baseline capture
  const prepAt = once.indexOf('assertWorktreePrepared()')
  const baselineAt = once.indexOf('captureDevBaseline')
  assert.ok(prepAt >= 0 && baselineAt > prepAt, 'prep must run before baseline test:green')
})

test('land.mjs does not re-define local parseFailures/compareFailures (single source)', () => {
  // Comment pointing at the module is fine; a function body is not.
  assert.doesNotMatch(landSrc, /^function parseFailures\b/m)
  assert.doesNotMatch(landSrc, /^function compareFailures\b/m)
  assert.doesNotMatch(landSrc, /^function formatFailSet\b/m)
  // Pure module owns the exports
  assert.match(gateSrc, /export function classifyTestGreen/)
  assert.match(gateSrc, /export function gateNoWorseDecision/)
  assert.match(gateSrc, /export function inspectWorktreePrep/)
})

test('runtime: land-gate module resolves and gateNoWorseDecision is the same binding land imports', async () => {
  const gateUrl = pathToFileURL(join(here, 'land-gate.mjs')).href
  const mod = await import(gateUrl)
  assert.equal(typeof mod.classifyTestGreen, 'function')
  assert.equal(typeof mod.gateNoWorseDecision, 'function')
  assert.equal(typeof mod.inspectWorktreePrep, 'function')

  // Spot-check the binding land relies on: identical voids abort.
  const voidLog = "'tsc' is not recognized as an internal or external command\n"
  const a = mod.classifyTestGreen(voidLog, 1)
  const b = mod.classifyTestGreen(voidLog, 1)
  const d = mod.gateNoWorseDecision(a, b)
  assert.equal(a.measurement, 'not-measured')
  assert.equal(d.ok, false)
  assert.equal(d.code, 'baseline-not-measured')
})
