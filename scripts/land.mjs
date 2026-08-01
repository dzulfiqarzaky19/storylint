#!/usr/bin/env node
/**
 * Land a topic branch onto its target branch the only correct way.
 * Target is origin/dev by default, or a feature integration branch via --into.
 *
 *   npm run land -- storylint/<topic> --summary "<why>"
 *
 * Enforces: clean tree → baseline test:green on the TARGET → merge
 * TARGET into topic → test:green on that result → no-worse compare
 * by failure identity → detach TARGET → merge --no-ff topic →
 * push HEAD:<target> → fetch and print the ORIGIN hash.
 *
 * Gate rule (rat 2026-07-31): LAND ON NO-WORSE, NOT ON GREEN.
 * - Failure on dev and still on merge result → PRE-EXISTING (report, do not block)
 * - Failure not on dev but on merge result → YOURS (hard abort)
 * - Failure on dev that disappears → report as fix (do not block)
 * - Fully green both sides → land normally
 *
 * Gate hardening (rat 2026-07-31, badger):
 * - Failure identity names WHAT failed (guard/build/unit/smoke/calm/infra).
 *   opaque:test-green-exit-N is banned — identical void runs must not compare equal.
 * - Infrastructure / void runs are NOT-MEASURED and hard-abort (standing rule 3).
 *   no-worse compares product failures only when BOTH runs measured something.
 * - Missing node_modules / toolchain is refused up front, not discovered as a
 *   build error and reasoned about as a test outcome.
 *
 * Never filter mutating command output. No --skip-tests.
 */

import { spawn, spawnSync } from 'node:child_process'
import { performance } from 'node:perf_hooks'
import { exit } from 'node:process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  classifyTestGreen,
  formatFailSet,
  gateNoWorseDecision,
  inspectWorktreePrep,
} from './land-gate.mjs'

const MAX_PUSH_ATTEMPTS = 3
const DEFAULT_TARGET = 'dev'

/**
 * Land target. `dev` by default; a feature integration branch when a ticket
 * lands into its feature (founder pipeline 2026-08-01: ticket -> feature-NN -> dev).
 * Every ref below derives from this, so the no-worse baseline, the merge, the push
 * and the read-back all name the SAME branch. They must never diverge: a baseline
 * measured against one branch and pushed to another is not a gate.
 */
let TARGET = DEFAULT_TARGET
let TARGET_REF = 'origin/' + DEFAULT_TARGET

function setTarget(branch) {
  TARGET = branch
  TARGET_REF = 'origin/' + branch
}
const IS_WIN = process.platform === 'win32'
const LAND_DIR = join(process.cwd(), '_land_run')

/**
 * Resolve the executable. On Windows npm must go through npm.cmd via a
 * single joined shell command line (spawnSync('npm.cmd', args, {shell:false}) → EINVAL).
 */
function resolveCmd(name) {
  if (name === 'npm') return IS_WIN ? 'npm.cmd' : 'npm'
  if (name === 'git') return 'git'
  return name
}

function usage(code = 2) {
  const text = `
Usage:
  npm run land -- storylint/<topic> --summary "<merge summary>"

Required:
  storylint/<topic>   local topic branch to land (must already exist)
  --summary <text>    short reason used in the merge commit message

Optional:
  --into <branch>     land into this branch instead of dev (must already exist on origin).
                      Feature pipeline: ticket branches land into feature-NN;
                      the feature branch lands into dev after E2E.
  --max-attempts <n>  push-reject retries of the whole sequence (default ${MAX_PUSH_ATTEMPTS})
  --allow-known       reserved / OFF by default; not required for no-worse lands

Gate: NO-WORSE vs a fresh baseline of the TARGET branch from the same run (not a cache).
Compare by failure identity (guard/build/unit/smoke/calm), not by count. Print both sets.
Infrastructure / void runs are NOT-MEASURED and hard-abort — never a no-worse tie.
Missing node_modules is refused up front. There is no --skip-tests.
`.trim()
  console.log(text)
  exit(code)
}

function parseArgs(argv) {
  const args = argv.slice(2)
  let topic = null
  let summary = null
  let maxAttempts = MAX_PUSH_ATTEMPTS
  let allowKnown = false
  let into = DEFAULT_TARGET

  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    if (a === '--help' || a === '-h') usage(0)
    if (a === '--summary') {
      const parts = []
      while (i + 1 < args.length && !args[i + 1].startsWith('--')) {
        parts.push(args[++i])
      }
      summary = parts.join(' ')
      if (!summary) fail('Missing value for --summary')
      continue
    }
    if (a.startsWith('--summary=')) {
      summary = a.slice('--summary='.length)
      continue
    }
    if (a === '--into') {
      into = args[++i]
      if (!into) fail('Missing value for --into')
      continue
    }
    if (a.startsWith('--into=')) {
      into = a.slice('--into='.length)
      continue
    }
    if (a === '--max-attempts') {
      maxAttempts = Number(args[++i])
      if (!Number.isInteger(maxAttempts) || maxAttempts < 1) {
        fail('--max-attempts must be a positive integer')
      }
      continue
    }
    if (a === '--allow-known') {
      // Explicitly accepted and ignored: no-worse already permits pre-existing reds.
      allowKnown = true
      continue
    }
    if (a === '--skip-tests') {
      fail('--skip-tests does not exist and will not be added. Fix the gate or wait.')
    }
    if (a.startsWith('-')) fail(`Unknown flag: ${a}`)
    if (topic) fail(`Unexpected extra argument: ${a}`)
    topic = a
  }

  if (!topic) usage(2)
  if (!summary || !summary.trim()) {
    fail('Required: --summary "<why this lands>"')
  }
  // Accepted topic shapes:
  //   storylint/<kebab>              standalone work landing on dev
  //   feature-NN-ticket-MM[-fix-KK]  coder branch in the feature pipeline
  //   feature-NN                     the integration branch itself, landing into dev
  //                                  after its tickets are in and E2E passed
  const STORYLINT_TOPIC = /^storylint\/[A-Za-z0-9._-]+$/
  const FEATURE_TICKET = /^feature-[0-9]{2,}-ticket-[0-9]{2,}(-fix-[0-9]{2,})?$/
  const FEATURE_BRANCH = /^feature-[0-9]{2,}(-[A-Za-z0-9._-]+)?$/
  const shapeOk =
    STORYLINT_TOPIC.test(topic) || FEATURE_TICKET.test(topic) || FEATURE_BRANCH.test(topic)
  if (!shapeOk) {
    fail(
      `Topic must be storylint/<kebab>, feature-NN-ticket-MM, or feature-NN (got ${topic})`,
    )
  }
  if (/\b(main|master)\b/i.test(topic)) {
    fail(`Topic name must not contain main/master tokens: ${topic}`)
  }

  // The target may be dev or a feature integration branch. NEVER main:
  // main receives only merges from dev, on the founder account (GIT_WORKFLOW).
  if (!/^(dev|feature-[0-9]{2,}(-[A-Za-z0-9._-]+)?)$/.test(into)) {
    fail(
      `--into must be dev or feature-NN (got ${into}).\n` +
        '  main is not a land target: it receives merges from dev only.',
    )
  }
  if (into === topic || `storylint/${into}` === topic) {
    fail(`--into ${into} is the topic itself; a branch cannot land into itself`)
  }

  return { topic, summary: summary.trim(), maxAttempts, allowKnown, into }
}

function fail(message, code = 1) {
  console.error(`\nland: FAIL — ${message}\n`)
  exit(code)
}

function banner(title) {
  const line = '='.repeat(72)
  console.log(`\n${line}`)
  console.log(`land: ${title}`)
  console.log(line)
}

function shellQuote(value) {
  const str = String(value)
  if (/^[A-Za-z0-9_./:@%+=,-]+$/.test(str)) return str
  return `"${str.replaceAll('"', '\\"')}"`
}

/** Run a command with FULL unfiltered stdio. Never pipe-filter output. */
function run(command, args, { allowFail = false, env } = {}) {
  const resolved = resolveCmd(command)
  const printable = [resolved, ...args].map(shellQuote).join(' ')
  console.log(`\n$ ${printable}\n`)

  const useShellLine = IS_WIN && /\.cmd$/i.test(resolved)
  const result = useShellLine
    ? spawnSync(printable, {
        stdio: 'inherit',
        shell: true,
        env: env ? { ...process.env, ...env } : process.env,
      })
    : spawnSync(resolved, args, {
        stdio: 'inherit',
        shell: false,
        env: env ? { ...process.env, ...env } : process.env,
      })

  if (result.error) {
    fail(`failed to spawn ${resolved}: ${result.error.message}`)
  }
  const status = result.status ?? 1
  if (status !== 0 && !allowFail) {
    fail(`command exited ${status}: ${printable}`, status)
  }
  return status
}

/**
 * Run a command, stream stdout/stderr live (unfiltered), capture full text.
 * Report-only cause lines land in the same buffer (and thus _land_run logs):
 *   [cause] spawn pid=… shell=… cmd=…
 *   [cause] exit  pid=… code=… signal=… elapsed_ms=… first=exit|close
 *   [cause] close pid=… code=… signal=… elapsed_ms=… first=… exit_to_close_ms=…
 * Distinguishes exited-N from terminated-by-signal; exit-vs-close order matters
 * for silent calm death (horse/B2). No product verdict change.
 */
function runCapture(command, args, { env } = {}) {
  const resolved = resolveCmd(command)
  const printable = [resolved, ...args].map(shellQuote).join(' ')
  console.log(`\n$ ${printable}\n`)

  const useShellLine = IS_WIN && /\.cmd$/i.test(resolved)
  const t0 = performance.now()
  return new Promise((resolvePromise) => {
    const child = useShellLine
      ? spawn(printable, {
          shell: true,
          env: env ? { ...process.env, ...env } : process.env,
          stdio: ['ignore', 'pipe', 'pipe'],
        })
      : spawn(resolved, args, {
          shell: false,
          env: env ? { ...process.env, ...env } : process.env,
          stdio: ['ignore', 'pipe', 'pipe'],
        })

    let out = ''
    let firstEvent = null
    let exitInfo = null
    const onChunk = (buf, stream) => {
      const text = buf.toString('utf8')
      out += text
      stream.write(text)
    }
    const stamp = (kind, payload) => {
      const line = `[cause] ${kind} ${payload}\n`
      out += line
      // cause lines ride stderr so they are obvious next to product stdout
      process.stderr.write(line)
    }
    const logSpawn = () => {
      stamp('spawn', `pid=${child.pid ?? 'null'} shell=${useShellLine} cmd=${printable}`)
    }
    logSpawn()
    if (child.pid == null) child.once('spawn', logSpawn)

    child.stdout.on('data', (b) => onChunk(b, process.stdout))
    child.stderr.on('data', (b) => onChunk(b, process.stderr))
    child.on('error', (error) => {
      const elapsed = Math.round(performance.now() - t0)
      stamp('error', `pid=${child.pid ?? 'null'} msg=${error.message} elapsed_ms=${elapsed}`)
      fail(`failed to spawn ${resolved}: ${error.message}`)
    })
    child.on('exit', (code, signal) => {
      const elapsed = Math.round(performance.now() - t0)
      if (!firstEvent) firstEvent = 'exit'
      exitInfo = { code, signal, elapsed_ms: elapsed }
      stamp(
        'exit',
        `pid=${child.pid ?? 'null'} code=${code === null ? 'null' : code} signal=${signal ?? 'null'} elapsed_ms=${elapsed} first=${firstEvent}`,
      )
    })
    child.on('close', (code, signal) => {
      const elapsed = Math.round(performance.now() - t0)
      if (!firstEvent) firstEvent = 'close'
      const exitToClose =
        exitInfo != null ? Math.max(0, elapsed - exitInfo.elapsed_ms) : null
      stamp(
        'close',
        `pid=${child.pid ?? 'null'} code=${code === null ? 'null' : code} signal=${signal ?? 'null'} elapsed_ms=${elapsed} first=${firstEvent}` +
          (exitToClose != null ? ` exit_to_close_ms=${exitToClose}` : ''),
      )
      resolvePromise({ status: code ?? 1, output: out })
    })
  })
}

function gitCapture(args) {
  const result = spawnSync('git', args, {
    encoding: 'utf8',
    shell: false,
  })
  if (result.error) fail(`git spawn failed: ${result.error.message}`)
  if (result.status !== 0) {
    const err = (result.stderr || result.stdout || '').trim()
    fail(`git ${args.join(' ')} failed (${result.status}): ${err}`)
  }
  return (result.stdout || '').trim()
}

function gitOk(args) {
  const result = spawnSync('git', args, {
    encoding: 'utf8',
    shell: false,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  return (result.status ?? 1) === 0
}

// parseFailures / formatFailSet / compareFailures / gateNoWorseDecision live in ./land-gate.mjs

function assertCleanWorktree() {
  banner('1/9 clean worktree')
  run('git', ['status', '--short', '--branch'])
  const dirty = gitCapture(['status', '--porcelain'])
  if (dirty) {
    fail(
      'working tree is dirty. Commit or stash first.\n' +
        'land refuses to run on uncommitted work so it cannot smuggle edits into the bubble.',
    )
  }
  console.log('land: worktree clean')
}

/**
 * Refuse unprepared worktrees up front. Missing node_modules is infrastructure,
 * not a product red for no-worse to reason about.
 */
function assertWorktreePrepared() {
  banner('2/9 worktree prepared (node_modules + toolchain)')
  const prep = inspectWorktreePrep(process.cwd())
  if (!prep.ok) {
    fail(
      'worktree is not prepared for test:green — refusing to run.\n' +
        'This is NOT-MEASURED infrastructure, not a product failure.\n' +
        prep.reasons.map((r) => `  - ${r}`).join('\n') +
        '\n\nFix:\n' +
        '  npm ci\n' +
        '  # or: npm install\n' +
        'Then re-run land. A gate that discovers missing toolchain as a build error\n' +
        'and treats identical voids as no-worse is theatre (standing rule 3 + 8a).',
    )
  }
  console.log('land: node_modules + tsc + vite present')
}

function assertOnTopic(topic) {
  const head = gitCapture(['branch', '--show-current'])
  if (head !== topic) {
    fail(
      `must run checked out on ${topic} (currently ${head || 'detached HEAD'}).\n` +
        `  git checkout ${topic}`,
    )
  }
  if (!gitOk(['rev-parse', '--verify', topic])) {
    fail(`local branch ${topic} does not exist`)
  }
}

function fetchOrigin() {
  banner('fetch origin')
  run('git', ['fetch', 'origin'])
  const tip = gitCapture(['rev-parse', '--short', TARGET_REF])
  console.log(`land: ${TARGET_REF} = ${tip}`)
  return tip
}

function discardGeneratedNoise() {
  // test:green may write e2e/output/*; never let that block the next step.
  run('git', ['checkout', '--', 'e2e/output'], { allowFail: true })
  run('git', ['clean', '-fd', 'e2e/output'], { allowFail: true })
  // KEEP _land_run/*.log — those are the only transcript of baseline/candidate
  // test:green. Wiping them (old behavior) destroyed buffalo's calm-death specimen
  // and made the gate undebuggable (rat 2026-07-31).
}

async function runTestGreenLabeled(label) {
  banner(`test:green — ${label}`)
  mkdirSync(LAND_DIR, { recursive: true })
  const logPath = join(LAND_DIR, `${label.replace(/[^a-z0-9_-]+/gi, '_')}.log`)
  const head = gitCapture(['rev-parse', '--short', 'HEAD'])
  console.log(`land: running test:green at HEAD=${head} (${label})`)
  const { status, output } = await runCapture('npm', ['run', 'test:green'])
  writeFileSync(logPath, output, 'utf8')
  console.log(`land: full log also at ${logPath}`)

  const report = classifyTestGreen(output, status)
  // Never emit opaque:exit-N. Void runs are NOT-MEASURED with named reasons.
  console.log(`\nland: measurement=${report.measurement} exit=${status} failures=${report.failures.size}`)
  if (report.measurement === 'not-measured') {
    console.log('land: NOT-MEASURED reasons:')
    console.log(formatFailSet(new Set(report.notMeasuredReasons)))
  }
  console.log(`land: parsed failure set (${label})`)
  console.log(formatFailSet(report.failures))
  if (report.chain?.failedAt) {
    console.log(`land: chain failedAt=${report.chain.failedAt} reached=[${report.chain.reached.join(',')}]`)
  }
  return {
    status,
    failures: report.failures,
    measurement: report.measurement,
    notMeasuredReasons: report.notMeasuredReasons,
    report,
    head,
    logPath,
    output,
  }
}

async function captureDevBaseline(topic) {
  banner(`3/9 baseline test:green on ${TARGET_REF} (same run, not a cache)`)
  const devTip = gitCapture(['rev-parse', '--short', TARGET_REF])
  console.log(`land: detaching at ${TARGET_REF} (${devTip}) for baseline`)
  run('git', ['checkout', '--detach', TARGET_REF])
  discardGeneratedNoise()

  let baseline
  try {
    baseline = await runTestGreenLabeled('baseline-origin-dev')
  } finally {
    discardGeneratedNoise()
    console.log(`land: restoring topic ${topic}`)
    run('git', ['checkout', topic])
    discardGeneratedNoise()
  }

  console.log(`\nland: BASELINE ${TARGET_REF}@${baseline.head}`)
  console.log(formatFailSet(baseline.failures))
  return baseline
}

function mergeDevIntoTopic(topic) {
  banner(`4/9 merge ${TARGET_REF} INTO topic`)
  console.log(`land: merging ${TARGET_REF} into ${topic} (topic stays checked out)`)
  const status = run('git', ['merge', TARGET_REF, '-m', `Merge ${TARGET_REF} into ${topic}`], {
    allowFail: true,
  })
  if (status !== 0) {
    const unmerged = gitOk(['diff', '--name-only', '--diff-filter=U'])
      ? gitCapture(['diff', '--name-only', '--diff-filter=U'])
      : ''
    console.error(`\nland: merge conflict bringing ${TARGET_REF} into the topic.`)
    console.error('land: refusing to auto-resolve. Fix by hand, commit, re-run land.')
    if (unmerged) console.error(`land: unmerged paths:\n${unmerged}`)
    console.error('\n  git status')
    console.error('  # resolve files')
    console.error('  git add <files> && git commit')
    console.error(`  npm run land -- ${topic} --summary "..."`)
    exit(status)
  }
  console.log(`land: topic now contains ${TARGET_REF}`)
}

async function gateNoWorse(baseline, topic) {
  banner('5/9 test:green on topic-after-dev merge result + no-worse compare')
  discardGeneratedNoise()
  const candidate = await runTestGreenLabeled('candidate-topic-after-dev')
  discardGeneratedNoise()

  console.log('\n' + '='.repeat(72))
  console.log('land: FAILURE SET COMPARE (by identity, not count)')
  console.log('='.repeat(72))
  console.log(`\nBASELINE measurement=${baseline.measurement} ${TARGET_REF} @ ${baseline.head} (${baseline.failures.size})`)
  console.log(formatFailSet(baseline.failures))
  console.log(`\nCANDIDATE measurement=${candidate.measurement} topic-after-dev @ ${candidate.head} (${candidate.failures.size})`)
  console.log(formatFailSet(candidate.failures))

  const decision = gateNoWorseDecision(baseline.report ?? baseline, candidate.report ?? candidate)
  if (!decision.ok) {
    console.log('='.repeat(72))
    fail(decision.reason)
  }

  const { preExisting, introduced, fixed } = decision
  console.log(`\nPRE-EXISTING (on dev and still here — do not block): ${preExisting.length}`)
  console.log(preExisting.length ? preExisting.map((id) => `  - ${id}`).join('\n') : '  (none)')
  console.log(`\nFIXED (on dev, gone after merge — report only): ${fixed.length}`)
  console.log(fixed.length ? fixed.map((id) => `  - ${id}`).join('\n') : '  (none)')
  console.log(`\nINTRODUCED (not on dev — YOURS, hard abort): ${introduced.length}`)
  console.log(introduced.length ? introduced.map((id) => `  - ${id}`).join('\n') : '  (none)')
  console.log('='.repeat(72))

  if (preExisting.length) {
    console.log(`\nland: proceeding with PRE-EXISTING reds named above (inherited from ${TARGET_REF}).`)
  } else if (candidate.failures.size === 0 && candidate.measurement === 'measured') {
    console.log('\nland: both sides green — land normally.')
  } else {
    console.log('\nland: candidate product failures are a subset of baseline — proceeding.')
  }

  if (fixed.length) {
    console.log('land: this land also clears failure(s) listed under FIXED.')
  }

  // Ensure tree clean after green artifacts
  const dirty = gitCapture(['status', '--porcelain'])
  if (dirty) {
    discardGeneratedNoise()
  }
  const still = gitCapture(['status', '--porcelain'])
  if (still) fail(`tree dirty after green/compare:\n${still}`)

  return { baseline, candidate, preExisting, introduced, fixed }
}

function createNoFfBubble(topic, summary) {
  banner(`6/9 detach ${TARGET_REF} and merge --no-ff topic`)
  const message = `Merge ${topic} into ${TARGET}: ${summary}`
  console.log(`land: merge message:\n  ${message}`)

  run('git', ['checkout', '--detach', TARGET_REF])
  const status = run('git', ['merge', '--no-ff', topic, '-m', message], { allowFail: true })
  if (status !== 0) {
    console.error(`\nland: --no-ff merge of topic into detached ${TARGET_REF} failed.`)
    console.error('land: returning to topic branch if possible.')
    run('git', ['merge', '--abort'], { allowFail: true })
    run('git', ['checkout', topic], { allowFail: true })
    fail(`merge --no-ff failed with exit ${status}`, status)
  }

  const parents = gitCapture(['rev-list', '--parents', '-n', '1', 'HEAD']).split(/\s+/)
  if (parents.length < 3) {
    run('git', ['checkout', topic], { allowFail: true })
    fail(
      'merge result is not a merge commit (expected --no-ff bubble with 2 parents).\n' +
        'Refusing to push a raw tip to dev.',
    )
  }
  const head = gitCapture(['rev-parse', '--short', 'HEAD'])
  const p1 = gitCapture(['rev-parse', '--short', 'HEAD^1'])
  const p2 = gitCapture(['rev-parse', '--short', 'HEAD^2'])
  console.log(`land: local bubble ${head} parents ${p1} + ${p2}`)
  run('git', ['log', '--oneline', '-1', '--decorate', 'HEAD'])
  return { head, message }
}

function pushHeadToTarget() {
  banner(`7/9 push HEAD:${TARGET} (full output, unfiltered)`)
  // CRITICAL: never filter this output. A push you cannot see is unattributed.
  return run('git', ['push', 'origin', `HEAD:${TARGET}`], { allowFail: true })
}

function readOriginTarget() {
  banner('8/9 fetch and read ORIGIN hash back (never assume push landed)')
  run('git', ['fetch', 'origin'])
  run('git', ['log', '--oneline', '-1', '--decorate', TARGET_REF])
  run('git', ['rev-parse', TARGET_REF])
  const short = gitCapture(['rev-parse', '--short', TARGET_REF])
  const full = gitCapture(['rev-parse', TARGET_REF])
  const subject = gitCapture(['log', '-1', '--format=%s', TARGET_REF])
  const parents = gitCapture(['rev-list', '--parents', '-n', '1', TARGET_REF]).split(/\s+/)
  return { short, full, subject, parents }
}

function restoreTopic(topic) {
  banner('9/9 restore topic checkout')
  run('git', ['checkout', topic], { allowFail: true })
  discardGeneratedNoise()
  run('git', ['status', '--short', '--branch'], { allowFail: true })
}

async function landOnce(topic, summary) {
  assertCleanWorktree()
  assertWorktreePrepared()
  assertOnTopic(topic)
  fetchOrigin()

  const baseline = await captureDevBaseline(topic)
  mergeDevIntoTopic(topic)

  const dirty = gitCapture(['status', '--porcelain'])
  if (dirty) fail(`tree dirty after merging ${TARGET_REF} into topic:\n${dirty}`)

  const compare = await gateNoWorse(baseline, topic)
  createNoFfBubble(topic, summary)
  const pushStatus = pushHeadToTarget()
  return { pushStatus, compare }
}

async function main() {
  const { topic, summary, maxAttempts, allowKnown, into } = parseArgs(process.argv)

  // Must happen before any ref is read, so baseline/merge/push/read-back agree.
  setTarget(into)

  console.log(`land: storylint topic → ${TARGET_REF}`)
  console.log(`land: topic=${topic}`)
  console.log(`land: summary=${summary}`)
  console.log(`land: max-attempts=${maxAttempts}`)
  console.log(`land: target=${TARGET_REF}`)
  console.log(`land: gate=NO-WORSE (fresh ${TARGET_REF} baseline, identity compare, NOT-MEASURED aborts)`)
  if (allowKnown) {
    console.log('land: --allow-known noted (no-worse already permits pre-existing reds)')
  }

  let attempt = 0
  let pushStatus = 1
  let lastCompare = null

  while (attempt < maxAttempts) {
    attempt += 1
    banner(`attempt ${attempt}/${maxAttempts}`)
    try {
      const result = await landOnce(topic, summary)
      pushStatus = result.pushStatus
      lastCompare = result.compare
    } catch (error) {
      restoreTopic(topic)
      throw error
    }

    if (pushStatus === 0) break

    console.error(`\nland: push HEAD:${TARGET} rejected or failed (exit ${pushStatus}).`)
    if (attempt >= maxAttempts) {
      restoreTopic(topic)
      fail(
        `push failed after ${maxAttempts} full-sequence attempt(s).\n` +
          'Not rebasing. Re-run land after inspecting the rejection output above.',
        pushStatus,
      )
    }

    console.error('land: re-fetching and retrying the WHOLE sequence from baseline.')
    console.error('land: this is the honest answer to a moving tip. No rebase.')
    run('git', ['checkout', topic])
    discardGeneratedNoise()
  }

  const origin = readOriginTarget()

  if (origin.parents.length < 3) {
    restoreTopic(topic)
    fail(
      `${TARGET_REF} ${origin.short} is NOT a merge commit after land.\n` +
        `subject: ${origin.subject}\n` +
        'Someone or something pushed a raw tip. Do not treat this as a successful land.',
    )
  }

  if (!origin.subject.startsWith(`Merge ${topic} into ${TARGET}:`)) {
    console.error(`land: WARNING — ${TARGET_REF} subject is not our bubble:`)
    console.error(`  expected prefix: Merge ${topic} into dev:`)
    console.error(`  actual: ${origin.subject}`)
    console.error('land: printing what origin actually has. Investigate before claiming success.')
  }

  restoreTopic(topic)

  banner('DONE')
  console.log(`${TARGET_REF}=${origin.short}`)
  console.log(`${TARGET_REF}_full=${origin.full}`)
  console.log(`target=${TARGET}`)
  console.log(`subject=${origin.subject}`)
  console.log(`parents=${origin.parents.slice(1).map((p) => p.slice(0, 7)).join(' + ')}`)
  console.log(`topic=${topic}`)
  if (lastCompare) {
    console.log(`pre-existing=${lastCompare.preExisting.join(',') || '(none)'}`)
    console.log(`fixed=${lastCompare.fixed.join(',') || '(none)'}`)
    console.log(`introduced=${lastCompare.introduced.join(',') || '(none)'}`)
  }
  console.log('Report the ORIGIN hash above. Local HEAD is not a ship.')
}

main().catch((error) => {
  console.error(error)
  exit(1)
})
