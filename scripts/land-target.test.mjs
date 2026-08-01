import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

/**
 * Land TARGET wiring (founder feature pipeline, 2026-08-01).
 *
 * `npm run land -- <topic> --into feature-01` must land onto the feature branch
 * instead of dev. The hazard this file exists for is NOT "does --into parse".
 * It is: the gate measures one branch and the push writes another. That would
 * report a green no-worse comparison for work never compared against where it
 * actually landed — a passing gate that proves nothing, which is the same
 * defect class as an unattributed measurement.
 *
 * So the load-bearing assertions are:
 *   1. every ref (baseline, merge, detach, push, read-back) derives from one variable
 *   2. main is refused as a target
 *   3. the CLI actually reports the target it was given
 */

const here = dirname(fileURLToPath(import.meta.url))
const landPath = join(here, 'land.mjs')
const landSrcRaw = readFileSync(landPath, 'utf8')

function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
}
const landSrc = stripComments(landSrcRaw)

/** Run land.mjs with args; it should exit before touching the network. */
function runLand(args) {
  const res = spawnSync(process.execPath, [landPath, ...args], {
    cwd: join(here, '..'),
    encoding: 'utf8',
    timeout: 30_000,
  })
  return { status: res.status, out: `${res.stdout ?? ''}${res.stderr ?? ''}` }
}

test('no hardcoded dev ref survives on the land path', () => {
  // A literal 'origin/dev' or 'HEAD:dev' in executable code means at least one
  // step ignores --into. That is the divergence this whole file guards.
  assert.doesNotMatch(
    landSrc,
    /['"`]origin\/dev['"`]/,
    "executable code still hardcodes 'origin/dev' — that step would ignore --into",
  )
  assert.doesNotMatch(
    landSrc,
    /HEAD:dev['"`]/,
    "push still hardcodes HEAD:dev — work would land on dev regardless of --into",
  )
})

test('baseline, merge, detach, push and read-back all derive from the same target', () => {
  // Baseline must be measured on the target.
  const baselineFn = landSrc.slice(
    landSrc.indexOf('async function captureDevBaseline'),
    landSrc.indexOf('function mergeDevIntoTopic'),
  )
  assert.ok(baselineFn.length > 0, 'captureDevBaseline must exist')
  assert.match(baselineFn, /TARGET_REF/, 'baseline must detach at TARGET_REF')

  // Merge into topic must bring in the target.
  const mergeFn = landSrc.slice(
    landSrc.indexOf('function mergeDevIntoTopic'),
    landSrc.indexOf('async function gateNoWorse'),
  )
  assert.match(mergeFn, /TARGET_REF/, 'merge must bring TARGET_REF into the topic')

  // The bubble must be created on a detached target.
  const bubbleFn = landSrc.slice(
    landSrc.indexOf('function createNoFfBubble'),
    landSrc.indexOf('function pushHeadToTarget'),
  )
  assert.match(bubbleFn, /TARGET_REF/, 'bubble must be created on detached TARGET_REF')

  // Push must use the target branch name.
  const pushFn = landSrc.slice(
    landSrc.indexOf('function pushHeadToTarget'),
    landSrc.indexOf('function readOriginTarget'),
  )
  assert.match(pushFn, /HEAD:\$\{TARGET\}/, 'push refspec must be HEAD:${TARGET}')

  // Read-back must read the same branch it pushed.
  const readFn = landSrc.slice(
    landSrc.indexOf('function readOriginTarget'),
    landSrc.indexOf('function restoreTopic'),
  )
  assert.match(readFn, /TARGET_REF/, 'read-back must read TARGET_REF')
})

test('setTarget keeps TARGET and TARGET_REF in lockstep', () => {
  // If these two can disagree, the push and the read-back can name
  // different branches and the land would report a hash it never wrote.
  const setter = landSrc.slice(
    landSrc.indexOf('function setTarget'),
    landSrc.indexOf('function setTarget') + 200,
  )
  assert.match(setter, /TARGET\s*=\s*branch/)
  assert.match(setter, /TARGET_REF\s*=\s*'origin\/'\s*\+\s*branch/)
})

test('main is refused as a land target', () => {
  const { status, out } = runLand(['storylint/any', '--summary', 's', '--into', 'main'])
  assert.notEqual(status, 0, 'must exit nonzero')
  assert.match(out, /--into must be dev or storylint\/<kebab>/)
  assert.match(out, /main is not a land target/)
})

test('master is refused as a land target', () => {
  const { status, out } = runLand(['storylint/any', '--summary', 's', '--into', 'master'])
  assert.notEqual(status, 0)
  assert.match(out, /--into must be dev or storylint\/<kebab>/)
})

test('a main token inside a feature target is refused', () => {
  // storylint/main-thing matches the kebab shape but must still be refused:
  // push hooks reject main/master tokens in branch names.
  const { status, out } = runLand([
    'storylint/any',
    '--summary',
    's',
    '--into',
    'storylint/main-thing',
  ])
  assert.notEqual(status, 0)
  assert.match(out, /must not contain main\/master tokens/)
})

test('an arbitrary branch name is refused as a land target', () => {
  // Prevents a typo silently creating a new branch on origin.
  const { status, out } = runLand(['storylint/any', '--summary', 's', '--into', 'my-branch'])
  assert.notEqual(status, 0)
  assert.match(out, /--into must be dev or storylint\/<kebab>/)
})

test('a kebab feature branch is accepted and reported as the target', () => {
  // Fails later (topic branch does not exist) but must pass validation and
  // print the target it was given, not dev.
  const { out } = runLand([
    'storylint/no-such-topic',
    '--summary',
    's',
    '--into',
    'storylint/lab-lifecycle',
  ])
  assert.match(out, /land: target=origin\/storylint\/lab-lifecycle/)
  assert.match(out, /gate=NO-WORSE \(fresh origin\/storylint\/lab-lifecycle baseline/)
  assert.doesNotMatch(out, /target=origin\/dev\b/)
})

test('default target is still dev when --into is omitted', () => {
  // The founder pipeline adds a path; it must not move the default.
  const { out } = runLand(['storylint/no-such-topic', '--summary', 's'])
  assert.match(out, /land: target=origin\/dev/)
})

test('a branch cannot land into itself', () => {
  const { status, out } = runLand([
    'storylint/lab-lifecycle',
    '--summary',
    's',
    '--into',
    'storylint/lab-lifecycle',
  ])
  assert.notEqual(status, 0)
  assert.match(out, /cannot land into itself/)
})

test('--skip-tests is still refused on the feature path', () => {
  // The new target must not become a hole in the gate.
  const { status, out } = runLand([
    'storylint/any',
    '--summary',
    's',
    '--into',
    'storylint/lab-lifecycle',
    '--skip-tests',
  ])
  assert.notEqual(status, 0)
  assert.match(out, /--skip-tests does not exist/)
})

/*
 * Topic shapes. One namespace: everything is storylint/<kebab>. A feature branch
 * is storylint/<feature-slug>; its tickets are that name plus -ticket-NN, so the
 * relationship reads without a lookup table.
 *
 * Scar kept: an earlier revision used feature-NN counters, and the pipeline doc
 * told coders to branch names land.mjs refused outright. These lock the
 * documented names against the script that has to accept them.
 */

test('a kebab ticket branch is accepted as a topic', () => {
  const { out } = runLand([
    'storylint/lab-lifecycle-ticket-01',
    '--summary',
    's',
    '--into',
    'storylint/lab-lifecycle',
  ])
  assert.doesNotMatch(out, /Topic must look like/)
  assert.match(out, /land: topic=storylint\/lab-lifecycle-ticket-01/)
})

test('a fix ticket branch is accepted as a topic', () => {
  // Fix tickets re-enter the pipeline, so their branch must land like any other.
  const { out } = runLand([
    'storylint/lab-lifecycle-ticket-03-fix-01',
    '--summary',
    's',
    '--into',
    'storylint/lab-lifecycle',
  ])
  assert.doesNotMatch(out, /Topic must look like/)
  assert.match(out, /land: topic=storylint\/lab-lifecycle-ticket-03-fix-01/)
})

test('a feature branch is accepted as a topic (it lands into dev)', () => {
  const { out } = runLand(['storylint/lab-lifecycle', '--summary', 's'])
  assert.doesNotMatch(out, /Topic must look like/)
  assert.match(out, /land: target=origin\/dev/)
})

test('storylint/<kebab> still works (standalone work did not break)', () => {
  const { out } = runLand(['storylint/some-topic', '--summary', 's'])
  assert.doesNotMatch(out, /Topic must be/)
  assert.match(out, /land: topic=storylint\/some-topic/)
})

test('an unprefixed topic name is still refused', () => {
  // One namespace means a bare name is not a branch we land.
  const { status, out } = runLand(['randomjunk', '--summary', 's'])
  assert.notEqual(status, 0)
  assert.match(out, /Topic must look like storylint\/<kebab>/)
})

test('a main token in a topic is still refused', () => {
  // Push hooks refuse main/master tokens in branch names.
  const { status, out } = runLand(['storylint/main-thing', '--summary', 's'])
  assert.notEqual(status, 0)
  assert.match(out, /must not contain main\/master tokens/)
})
