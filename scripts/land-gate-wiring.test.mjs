import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

/**
 * Wiring locks for land.mjs ↔ land-gate.mjs.
 *
 * Grep checks are refactor tripwires only (strip comments first — hawk LG-B3).
 * Behavioral checks assert real outcomes: prep refuses missing node_modules,
 * gateNoWorseDecision binding aborts identical voids.
 */

const here = dirname(fileURLToPath(import.meta.url))
const landSrcRaw = readFileSync(join(here, 'land.mjs'), 'utf8')
const gateSrc = readFileSync(join(here, 'land-gate.mjs'), 'utf8')

/** Strip // line comments and /* block comments so grep cannot match dead code. */
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
}

const landSrc = stripComments(landSrcRaw)

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
  // After comment strip, a commented-out call would not match (hawk LG-B3).
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

  // LG-B1: empty exit 0 also aborts
  const empty = mod.classifyTestGreen('', 0)
  assert.equal(empty.measurement, 'not-measured')
  assert.equal(mod.gateNoWorseDecision(empty, empty).ok, false)
})

test('behavioral: inspectWorktreePrep refuses temp cwd without node_modules', async () => {
  const gateUrl = pathToFileURL(join(here, 'land-gate.mjs')).href
  const mod = await import(gateUrl)
  const dir = mkdtempSync(join(tmpdir(), 'land-wire-prep-'))
  try {
    writeFileSync(join(dir, 'package.json'), '{"name":"x"}')
    const r = mod.inspectWorktreePrep(dir)
    assert.equal(r.ok, false)
    assert.ok(r.reasons.includes('missing-node_modules'))
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('behavioral: land.mjs --help exits 0 (script loads and binds gate)', () => {
  const landPath = join(here, 'land.mjs')
  assert.ok(existsSync(landPath))
  const result = spawnSync(process.execPath, [landPath, '--help'], {
    encoding: 'utf8',
    shell: false,
  })
  assert.equal(result.status, 0, `stderr=${result.stderr}`)
  assert.match(result.stdout, /NO-WORSE|test:green|storylint/)
})
