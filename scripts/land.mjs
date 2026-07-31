#!/usr/bin/env node
/**
 * Land a topic branch onto origin/dev the only correct way.
 *
 *   npm run land -- storylint/<topic> --summary "<why>"
 *
 * Enforces: clean tree → merge origin/dev into topic → test:green on that
 * result → detach origin/dev → merge --no-ff topic → push HEAD:dev →
 * fetch and print the ORIGIN hash. Never filters command output.
 *
 * Why a script: three different agents produced correct content through wrong
 * process under tip pressure (buried push, reverse bubble, raw tip). Docs
 * were read; the procedure was still too easy to get wrong.
 */

import { spawnSync } from 'node:child_process'
import { exit } from 'node:process'

const MAX_PUSH_ATTEMPTS = 3
const DEV_REF = 'origin/dev'
const IS_WIN = process.platform === 'win32'

/** Resolve npm/git so Windows does not hit spawn ENOENT on bare npm. */
function resolveCmd(name) {
  if (name === 'npm') return IS_WIN ? 'npm.cmd' : 'npm'
  if (name === 'git') return IS_WIN ? 'git.exe' : 'git'
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
  --max-attempts <n>  push-reject retries of the whole sequence (default ${MAX_PUSH_ATTEMPTS})
  --skip-tests        DO NOT USE for real lands. Emergency only.

The script refuses a dirty worktree, aborts on merge conflicts without
auto-resolving, runs test:green on the topic-after-dev-merge, creates a
--no-ff bubble from detached origin/dev, pushes HEAD:dev, then fetches and
prints the origin/dev hash it actually reads back. Mutating commands never
have their output filtered.
`.trim()
  console.log(text)
  exit(code)
}

function parseArgs(argv) {
  const args = argv.slice(2)
  let topic = null
  let summary = null
  let maxAttempts = MAX_PUSH_ATTEMPTS
  let skipTests = false

  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    if (a === '--help' || a === '-h') usage(0)
    if (a === '--summary') {
      summary = args[++i]
      if (!summary) fail('Missing value for --summary')
      continue
    }
    if (a.startsWith('--summary=')) {
      summary = a.slice('--summary='.length)
      continue
    }
    if (a === '--max-attempts') {
      maxAttempts = Number(args[++i])
      if (!Number.isInteger(maxAttempts) || maxAttempts < 1) {
        fail('--max-attempts must be a positive integer')
      }
      continue
    }
    if (a === '--skip-tests') {
      skipTests = true
      continue
    }
    if (a.startsWith('-')) fail(`Unknown flag: ${a}`)
    if (topic) fail(`Unexpected extra argument: ${a}`)
    topic = a
  }

  if (!topic) usage(2)
  if (!summary || !summary.trim()) {
    fail('Required: --summary "<why this lands>"')
  }
  if (!/^storylint\/[A-Za-z0-9._-]+$/.test(topic)) {
    fail(`Topic must look like storylint/<kebab> (got ${topic})`)
  }
  if (/\b(main|master)\b/i.test(topic)) {
    fail(`Topic name must not contain main/master tokens: ${topic}`)
  }

  return { topic, summary: summary.trim(), maxAttempts, skipTests }
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

/** Run a command with FULL unfiltered stdio. Never pipe-filter output. */
function run(command, args, { allowFail = false, env } = {}) {
  const resolved = resolveCmd(command)
  const printable = [resolved, ...args].map(shellQuote).join(' ')
  console.log(`\n$ ${printable}\n`)
  // npm.cmd/git.exe resolved above; never shell:true (args would be unescaped).
  const result = spawnSync(resolved, args, {
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

function shellQuote(value) {
  if (/^[A-Za-z0-9_./:@%+=,-]+$/.test(value)) return value
  return `"${String(value).replaceAll('"', '\\"')}"`
}

function gitCapture(args) {
  const result = spawnSync(resolveCmd('git'), args, {
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
  const result = spawnSync(resolveCmd('git'), args, {
    encoding: 'utf8',
    shell: false,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  return (result.status ?? 1) === 0
}

function assertCleanWorktree() {
  banner('1/7 clean worktree')
  // Full status printed; never filtered.
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
  const tip = gitCapture(['rev-parse', '--short', DEV_REF])
  console.log(`land: ${DEV_REF} = ${tip}`)
  return tip
}

function mergeDevIntoTopic(topic) {
  banner('2/7 merge origin/dev INTO topic')
  console.log(`land: merging ${DEV_REF} into ${topic} (topic stays checked out)`)
  // Full merge output — conflicts print normally. No auto-resolve.
  const status = run('git', ['merge', DEV_REF, '-m', `Merge ${DEV_REF} into ${topic}`], {
    allowFail: true,
  })
  if (status !== 0) {
    const unmerged = gitOk(['diff', '--name-only', '--diff-filter=U'])
      ? gitCapture(['diff', '--name-only', '--diff-filter=U'])
      : ''
    console.error('\nland: merge conflict bringing origin/dev into the topic.')
    console.error('land: refusing to auto-resolve. Fix by hand, commit, re-run land.')
    if (unmerged) console.error(`land: unmerged paths:\n${unmerged}`)
    console.error('\n  git status')
    console.error('  # resolve files')
    console.error('  git add <files> && git commit')
    console.error(`  npm run land -- ${topic} --summary "..."`)
    // Leave the conflicted merge state for the human/agent; do not abort silently.
    exit(status)
  }
  console.log('land: topic now contains origin/dev')
}

function runTestGreen(skipTests) {
  banner('3/7 test:green on MERGE RESULT (topic after origin/dev)')
  if (skipTests) {
    console.error('land: WARNING — --skip-tests set. This is not a real land.')
    return
  }
  // Full unfiltered suite output. Abort on red.
  const status = run('npm', ['run', 'test:green'], { allowFail: true })
  if (status !== 0) {
    fail(
      `test:green exited ${status} on the topic-after-dev merge result.\n` +
        'land will not create a bubble or push. Fix the failures, then re-run land.\n' +
        'Retrying until green is forbidden; a red gate is a stop, not a suggestion.',
      status,
    )
  }
  console.log('land: test:green PASS on merge result')
}

function createNoFfBubble(topic, summary) {
  banner('4/7 detach origin/dev and merge --no-ff topic')
  const message = `Merge ${topic} into dev: ${summary}`
  console.log(`land: merge message:\n  ${message}`)

  run('git', ['checkout', '--detach', DEV_REF])
  const status = run('git', ['merge', '--no-ff', topic, '-m', message], { allowFail: true })
  if (status !== 0) {
    console.error('\nland: --no-ff merge of topic into detached origin/dev failed.')
    console.error('land: returning to topic branch if possible.')
    run('git', ['merge', '--abort'], { allowFail: true })
    run('git', ['checkout', topic], { allowFail: true })
    fail(`merge --no-ff failed with exit ${status}`, status)
  }

  // First-parent must be former origin/dev; second parent the topic tip.
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

function pushHeadToDev() {
  banner('5/7 push HEAD:dev (full output, unfiltered)')
  // CRITICAL: never filter this output. A push you cannot see is unattributed.
  const status = run('git', ['push', 'origin', 'HEAD:dev'], { allowFail: true })
  return status
}

function readOriginDev() {
  banner('6/7 fetch and read ORIGIN hash back (never assume push landed)')
  run('git', ['fetch', 'origin'])
  // Print full tip evidence unfiltered.
  run('git', ['log', '--oneline', '-1', '--decorate', DEV_REF])
  run('git', ['rev-parse', DEV_REF])
  const short = gitCapture(['rev-parse', '--short', DEV_REF])
  const full = gitCapture(['rev-parse', DEV_REF])
  const subject = gitCapture(['log', '-1', '--format=%s', DEV_REF])
  const parents = gitCapture(['rev-list', '--parents', '-n', '1', DEV_REF]).split(/\s+/)
  return { short, full, subject, parents }
}

function restoreTopic(topic) {
  banner('7/7 restore topic checkout')
  run('git', ['checkout', topic], { allowFail: true })
  // Topic may lag the new origin/dev bubble; that is fine. Caller can ff later.
  run('git', ['status', '--short', '--branch'], { allowFail: true })
}

function landOnce(topic, summary, skipTests) {
  assertCleanWorktree()
  assertOnTopic(topic)
  fetchOrigin()
  mergeDevIntoTopic(topic)

  // After merging dev into topic the tree must still be clean (merge commit only).
  const dirty = gitCapture(['status', '--porcelain'])
  if (dirty) fail(`tree dirty after merging ${DEV_REF} into topic:\n${dirty}`)

  runTestGreen(skipTests)
  createNoFfBubble(topic, summary)
  return pushHeadToDev()
}

function main() {
  const { topic, summary, maxAttempts, skipTests } = parseArgs(process.argv)

  console.log('land: storylint topic → origin/dev')
  console.log(`land: topic=${topic}`)
  console.log(`land: summary=${summary}`)
  console.log(`land: max-attempts=${maxAttempts}`)
  if (skipTests) console.log('land: skip-tests=TRUE (not a real land)')

  let attempt = 0
  let pushStatus = 1

  while (attempt < maxAttempts) {
    attempt += 1
    banner(`attempt ${attempt}/${maxAttempts}`)
    try {
      pushStatus = landOnce(topic, summary, skipTests)
    } catch (error) {
      restoreTopic(topic)
      throw error
    }

    if (pushStatus === 0) break

    console.error(`\nland: push HEAD:dev rejected or failed (exit ${pushStatus}).`)
    if (attempt >= maxAttempts) {
      restoreTopic(topic)
      fail(
        `push failed after ${maxAttempts} full-sequence attempt(s).\n` +
          'Not rebasing. Re-run land after inspecting the rejection output above.',
        pushStatus,
      )
    }

    console.error('land: re-fetching and retrying the WHOLE sequence from merge-dev-into-topic.')
    console.error('land: this is the honest answer to a moving tip. No rebase.')
    // Get off detached bubble before retry.
    run('git', ['checkout', topic])
    // Drop a failed local merge commit on detached HEAD is automatic when we leave it.
  }

  const origin = readOriginDev()

  // Confirm the bubble we care about is on origin and is a merge commit.
  if (origin.parents.length < 3) {
    restoreTopic(topic)
    fail(
      `origin/dev ${origin.short} is NOT a merge commit after land.\n` +
        `subject: ${origin.subject}\n` +
        'Someone or something pushed a raw tip. Do not treat this as a successful land.',
    )
  }

  if (!origin.subject.startsWith(`Merge ${topic} into dev:`)) {
    // Tip may have moved under us between push and fetch if another land won
    // a race after our push — extremely unlikely once push succeeded, but be honest.
    console.error(`land: WARNING — origin/dev subject is not our bubble:`)
    console.error(`  expected prefix: Merge ${topic} into dev:`)
    console.error(`  actual: ${origin.subject}`)
    console.error('land: printing what origin actually has. Investigate before claiming success.')
  }

  restoreTopic(topic)

  banner('DONE')
  console.log(`origin/dev=${origin.short}`)
  console.log(`origin/dev_full=${origin.full}`)
  console.log(`subject=${origin.subject}`)
  console.log(`parents=${origin.parents.slice(1).map((p) => p.slice(0, 7)).join(' + ')}`)
  console.log(`topic=${topic}`)
  console.log('Report the ORIGIN hash above. Local HEAD is not a ship.')
}

main()
