/**
 * Pure land / test:green gate logic.
 *
 * Standing rule 3: NOT-MEASURED fails the gate.
 * Standing rule 8a: a diagnostic proven on the happy path must not go silent
 * (or actively reassure) on the failure path.
 *
 * Failure identity must name WHAT failed (guard / build / unit / smoke / calm /
 * infra). Opaque exit codes that collapse every catastrophe into one token are
 * banned — they make no-worse structurally incapable of detecting a regression.
 */

import { existsSync, statSync } from 'node:fs'
import { join } from 'node:path'

/** Stages of `npm run test:green`, in order. */
export const TEST_GREEN_STAGES = ['guard', 'build', 'unit', 'smoke', 'calm']

/**
 * Detect worktree preparation failures BEFORE test:green.
 * Missing node_modules is infrastructure, not a product red.
 */
export function inspectWorktreePrep(cwd = process.cwd()) {
  const reasons = []
  const nodeModules = join(cwd, 'node_modules')
  if (!existsSync(nodeModules)) {
    reasons.push('missing-node_modules')
  } else {
    try {
      if (!statSync(nodeModules).isDirectory()) {
        reasons.push('node_modules-not-directory')
      }
    } catch {
      reasons.push('node_modules-unreadable')
    }
  }

  // build = tsc -b && vite build. Without local typescript, Windows reports
  // "'tsc' is not recognized" and nothing product-shaped is measured.
  const tscJs = join(cwd, 'node_modules', 'typescript', 'bin', 'tsc')
  const tscCmd = join(cwd, 'node_modules', '.bin', 'tsc.cmd')
  const tscBin = join(cwd, 'node_modules', '.bin', 'tsc')
  if (existsSync(nodeModules) && !existsSync(tscJs) && !existsSync(tscCmd) && !existsSync(tscBin)) {
    reasons.push('missing-typescript-tsc')
  }

  const viteJs = join(cwd, 'node_modules', 'vite', 'bin', 'vite.js')
  const viteCmd = join(cwd, 'node_modules', '.bin', 'vite.cmd')
  const viteBin = join(cwd, 'node_modules', '.bin', 'vite')
  if (existsSync(nodeModules) && !existsSync(viteJs) && !existsSync(viteCmd) && !existsSync(viteBin)) {
    reasons.push('missing-vite')
  }

  const pkg = join(cwd, 'package.json')
  if (!existsSync(pkg)) reasons.push('missing-package.json')

  return {
    ok: reasons.length === 0,
    reasons,
  }
}

/**
 * Classify a full test:green log into stages reached, product failures, and
 * infrastructure / NOT-MEASURED reasons.
 *
 * @param {string} output
 * @param {number} status process exit code
 */
export function classifyTestGreen(output, status = 0) {
  const text = String(output ?? '')
  const lines = text.split(/\r?\n/)

  const stagesSeen = {
    guard: false,
    build: false,
    unit: false,
    smoke: false,
    calm: false,
  }
  const stagesPassed = {
    guard: false,
    build: false,
    unit: false,
    smoke: false,
    calm: false,
  }

  const failures = new Set()
  const infra = []

  // --- stage start / pass signals (order-tolerant; prefer explicit markers) ---
  for (const line of lines) {
    if (
      line.includes('e2e helper convention') ||
      line.includes('guard-helpers') ||
      line.includes('PASS: e2e helper') ||
      line.includes('FAIL: e2e helper')
    ) {
      stagesSeen.guard = true
    }
    if (line.includes('PASS: e2e helper convention') || /^guard-helpers: PASS\b/.test(line)) {
      stagesPassed.guard = true
    }

    if (
      line.includes('> tsc') ||
      line.includes('tsc -b') ||
      line.includes('> vite build') ||
      line.includes('vite v') ||
      /error TS\d+/i.test(line) ||
      line.includes("'tsc' is not recognized") ||
      line.includes('tsc: not found') ||
      line.includes('vite build')
    ) {
      stagesSeen.build = true
    }
    if (
      (line.includes('✓ built in') || line.includes('built in ')) &&
      !/error TS\d+/i.test(line)
    ) {
      stagesPassed.build = true
    }

    if (
      line.includes('node --experimental-strip-types --test') ||
      line.includes('node:test') ||
      /^\s*[✔✖]\s+/.test(line) ||
      /^\s*not ok\s+\d+/.test(line) ||
      /^\s*ok\s+\d+/.test(line) ||
      /ℹ tests \d+/.test(line) ||
      /# tests \d+/.test(line)
    ) {
      stagesSeen.unit = true
    }
    if (/ℹ tests \d+/.test(line) || /# tests \d+/.test(line)) {
      // presence of summary means unit runner finished; pass decided by failures
      stagesSeen.unit = true
    }
    if (/ℹ fail 0/.test(line) || /# fail 0/.test(line) || /tests \d+.*pass \d+.*fail 0/.test(line)) {
      stagesPassed.unit = true
    }

    if (
      line.includes('all-smoke') ||
      /^FAIL\s{2}\S+/.test(line) ||
      /^PASS\s{2}\S+/.test(line) ||
      line.includes('feature smoke') ||
      line.includes('SMOKE')
    ) {
      stagesSeen.smoke = true
    }

    if (
      line.includes('calm-budget') ||
      line.includes('[FAIL]') ||
      line.includes('[PASS]') ||
      line.includes('[WARN]') ||
      line.includes('CALM')
    ) {
      stagesSeen.calm = true
    }
  }

  // npm script headers also mark stage starts: "> storylint@x test" etc.
  if (text.includes('> tsc -b') || text.includes('> vite build') || text.includes('npm run build')) {
    stagesSeen.build = true
  }
  if (text.includes('npm test') || text.includes('--test')) {
    // weak signal only if unit markers already absent
  }

  // --- infrastructure / NOT-MEASURED signals ---
  const infraPatterns = [
    { id: 'infra:tsc-not-recognized', re: /'tsc' is not recognized as an internal or external command/i },
    { id: 'infra:tsc-not-found', re: /\btsc: not found\b|tsc:\s+command not found/i },
    { id: 'infra:vite-not-recognized', re: /'vite' is not recognized as an internal or external command/i },
    { id: 'infra:vite-not-found', re: /\bvite: not found\b|vite:\s+command not found/i },
    { id: 'infra:missing-node_modules-runtime', re: /Cannot find module ['"][^'"]*node_modules/i },
    { id: 'infra:cannot-find-package', re: /ERR_MODULE_NOT_FOUND|Cannot find package/i },
    { id: 'infra:enoent', re: /ENOENT:\s*no such file or directory/i },
    { id: 'infra:playwright-browser-missing', re: /Executable doesn't exist|browserType\.launch|Playwright.*Missing browser/i },
    { id: 'infra:port-in-use', re: /EADDRINUSE|address already in use/i },
    { id: 'infra:spawn-npm-failed', re: /spawn .*ENOENT|failed to spawn npm/i },
  ]

  for (const { id, re } of infraPatterns) {
    if (re.test(text)) infra.push(id)
  }

  // --- product failure identities ---
  for (const line of lines) {
    // unit
    let m = line.match(/^\s*✖\s+(.+?)(?:\s+\([\d.]+ms\))?\s*$/)
    if (m) {
      const name = m[1].trim()
      // node --test sometimes reports the file path as the only failure line
      if (name.endsWith('.ts') || name.endsWith('.js') || name.endsWith('.mjs')) {
        failures.add(`unit-file:${name}`)
      } else {
        failures.add(`unit:${name}`)
      }
      stagesSeen.unit = true
      continue
    }
    m = line.match(/^\s*not ok\s+\d+\s+-\s+(.+?)\s*$/)
    if (m) {
      failures.add(`unit:${m[1].trim()}`)
      stagesSeen.unit = true
      continue
    }
    m = line.match(/^\s*not ok\s+\d+\s+(.+?)\s*$/)
    if (m && !m[1].startsWith('-')) {
      failures.add(`unit:${m[1].trim()}`)
      stagesSeen.unit = true
      continue
    }

    // smoke
    m = line.match(/^FAIL\s{2}(\S+)/)
    if (m) {
      failures.add(`smoke:${m[1]}`)
      stagesSeen.smoke = true
      continue
    }

    // calm HARD only
    m = line.match(/^\[FAIL\]\s+(\S+)\s+\(HARD\)/)
    if (m) {
      failures.add(`calm:${m[1]}`)
      stagesSeen.calm = true
      continue
    }

    // guard
    if (line.includes('FAIL: e2e helper convention')) {
      failures.add('guard:e2e-helper-convention')
      stagesSeen.guard = true
      continue
    }

    // build product errors (TypeScript), not missing toolchain
    m = line.match(/error TS(\d+)\s*:\s*(.+)$/i)
    if (m) {
      failures.add(`build:TS${m[1]}:${m[2].trim().slice(0, 80)}`)
      stagesSeen.build = true
      continue
    }
    if (/error TS\d+/i.test(line) && !infra.length) {
      failures.add(`build:${line.trim().slice(0, 120)}`)
      stagesSeen.build = true
    }
  }

  // If unit summary says fail N>0 but we parsed none, mark unit-unparsed
  const failSummary = text.match(/ℹ fail (\d+)/) || text.match(/# fail (\d+)/)
  if (failSummary && Number(failSummary[1]) > 0 && ![...failures].some((f) => f.startsWith('unit'))) {
    failures.add(`unit:unparsed-fail-count-${failSummary[1]}`)
    stagesSeen.unit = true
  }

  // Infer how far the chain got when exit != 0
  const chain = inferChainProgress(text, stagesSeen, status)

  // Measurement rule:
  // - any infra signal → NOT-MEASURED
  // - exit != 0 and no stage produced a product failure identity AND build/unit never
  //   actually ran their runners → NOT-MEASURED
  // - exit != 0 with only opaque nothing → NOT-MEASURED (never opaque:exit-N)
  // - product failures present → MEASURED (even if later stages skipped)
  const hasProductFailure = failures.size > 0
  const measuredSomething =
    hasProductFailure ||
    (status === 0 && chain.completed.includes('calm')) ||
    (status === 0 && stagesPassed.calm) ||
    (status === 0 && stagesSeen.calm && stagesSeen.smoke && stagesSeen.unit && stagesSeen.build)

  let measurement = 'measured'
  const notMeasuredReasons = [...infra]

  if (infra.length) {
    measurement = 'not-measured'
  } else if (status !== 0 && !hasProductFailure) {
    // Died without a named product failure. That is NOT a comparable red.
    measurement = 'not-measured'
    if (!chain.reached.includes('build') && !chain.reached.includes('guard')) {
      notMeasuredReasons.push('not-measured:no-stage-started')
    } else if (chain.failedAt) {
      notMeasuredReasons.push(`not-measured:stage-died-without-identity:${chain.failedAt}`)
    } else {
      notMeasuredReasons.push('not-measured:exit-without-failure-identity')
    }
  } else if (status === 0 && !measuredSomething && !hasProductFailure) {
    // Green exit but we never saw evidence the suite ran — also void.
    measurement = 'not-measured'
    notMeasuredReasons.push('not-measured:green-exit-without-stage-evidence')
  }

  // Promote infra ids into the failure set ONLY as infra:* so they never look like product reds.
  for (const id of notMeasuredReasons) {
    if (id.startsWith('infra:') || id.startsWith('not-measured:')) {
      failures.add(id)
    }
  }

  return {
    status,
    measurement, // 'measured' | 'not-measured'
    failures,
    notMeasuredReasons,
    stagesSeen,
    stagesPassed,
    chain,
    hasProductFailure,
  }
}

/**
 * Infer which test:green stages were reached from log + exit.
 * test:green is `guard && build && unit && smoke && calm`.
 */
function inferChainProgress(text, stagesSeen, status) {
  const reached = []
  for (const stage of TEST_GREEN_STAGES) {
    if (stagesSeen[stage]) reached.push(stage)
  }

  // npm prints script names
  if (text.includes('guard-helpers')) {
    if (!reached.includes('guard')) reached.unshift('guard')
  }

  let failedAt = null
  let completed = []

  if (status === 0) {
    completed = [...TEST_GREEN_STAGES]
    return { reached: TEST_GREEN_STAGES.slice(), completed, failedAt: null }
  }

  // First stage not seen after a seen predecessor is a clue; prefer last seen as failedAt
  if (reached.length === 0) {
    failedAt = 'before-guard'
  } else {
    failedAt = reached[reached.length - 1]
    const idx = TEST_GREEN_STAGES.indexOf(failedAt)
    completed = TEST_GREEN_STAGES.slice(0, Math.max(0, idx))
  }

  return { reached, completed, failedAt }
}

export function formatFailSet(set) {
  if (!set || set.size === 0) return '(none)'
  return [...set].sort().map((id) => `  - ${id}`).join('\n')
}

export function compareFailures(baseline, candidate) {
  const base = baseline instanceof Set ? baseline : new Set(baseline)
  const cand = candidate instanceof Set ? candidate : new Set(candidate)
  const preExisting = [...cand].filter((id) => base.has(id)).sort()
  const introduced = [...cand].filter((id) => !base.has(id)).sort()
  const fixed = [...base].filter((id) => !cand.has(id)).sort()
  return { preExisting, introduced, fixed }
}

/**
 * No-worse is only meaningful when BOTH runs measured product outcomes.
 * Infrastructure / void runs hard-abort — they are never a tie.
 *
 * @returns {{ ok: true, preExisting, introduced, fixed } | { ok: false, reason, code }}
 */
export function gateNoWorseDecision(baselineReport, candidateReport) {
  if (baselineReport.measurement === 'not-measured') {
    return {
      ok: false,
      code: 'baseline-not-measured',
      reason:
        'BASELINE test:green was NOT-MEASURED (infrastructure or void run).\n' +
        'no-worse cannot compare when the harness did not measure product outcomes.\n' +
        `reasons:\n${formatFailSet(new Set(baselineReport.notMeasuredReasons))}\n` +
        'Fix the worktree / toolchain, then re-run land. Standing rule 3: NOT-MEASURED fails the gate.',
    }
  }
  if (candidateReport.measurement === 'not-measured') {
    return {
      ok: false,
      code: 'candidate-not-measured',
      reason:
        'CANDIDATE test:green was NOT-MEASURED (infrastructure or void run).\n' +
        'no-worse will not treat a void run as a tie with baseline.\n' +
        `reasons:\n${formatFailSet(new Set(candidateReport.notMeasuredReasons))}\n` +
        'Fix the worktree / toolchain or the break you introduced that prevented measurement.',
    }
  }

  // Strip infra/not-measured tokens from product compare (should be empty if measured)
  const productOnly = (set) =>
    new Set([...set].filter((id) => !id.startsWith('infra:') && !id.startsWith('not-measured:')))

  const { preExisting, introduced, fixed } = compareFailures(
    productOnly(baselineReport.failures),
    productOnly(candidateReport.failures),
  )

  if (introduced.length) {
    return {
      ok: false,
      code: 'introduced-failures',
      reason:
        `no-worse gate failed: ${introduced.length} new failure(s) not present on origin/dev.\n` +
        introduced.map((id) => `  - ${id}`).join('\n') +
        '\nland will not create a bubble or push. Fix what you introduced, then re-run land.',
      preExisting,
      introduced,
      fixed,
    }
  }

  return { ok: true, preExisting, introduced, fixed }
}

/** Back-compat thin wrapper used by older call sites / tests. */
export function parseFailures(output, status = 0) {
  return classifyTestGreen(output, status).failures
}
