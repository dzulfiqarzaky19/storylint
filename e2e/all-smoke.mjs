import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, unlinkSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { ALL_FEATURE_SMOKES } from './constants.mjs'
import {
  HARD_SMOKE_TIMEOUT_MS,
  setApiBase,
  readServerActiveProjectId,
  restoreActiveProject,
  sweepOrphanE2eProjects,
  defaultDataDirectory,
  assertSmokeOwnedActive,
} from './helpers.mjs'
import { resolveMeasurementTarget } from './owned-stack.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const PER_SMOKE_TIMEOUT_MS = Number.parseInt(process.env.STORYLINT_E2E_SMOKE_TIMEOUT_MS ?? String(HARD_SMOKE_TIMEOUT_MS), 10)

function runSmoke(relPath, env) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(process.execPath, [relPath], {
      cwd: root,
      stdio: 'inherit',
      env,
      shell: false,
    })
    const timer = setTimeout(() => {
      child.kill('SIGTERM')
      setTimeout(() => {
        try { child.kill('SIGKILL') } catch { /* already gone */ }
      }, 2000).unref?.()
      reject(new Error(`${relPath} hard-timeout after ${PER_SMOKE_TIMEOUT_MS}ms`))
    }, PER_SMOKE_TIMEOUT_MS)
    child.on('error', (error) => {
      clearTimeout(timer)
      reject(error)
    })
    child.on('exit', (code, signal) => {
      clearTimeout(timer)
      if (signal) reject(new Error(`${relPath} killed by ${signal}`))
      else if (code !== 0) reject(new Error(`${relPath} exited ${code}`))
      else resolvePromise()
    })
  })
}

function readMintReport(reportPath) {
  if (!existsSync(reportPath)) return []
  try {
    const body = JSON.parse(readFileSync(reportPath, 'utf8'))
    return Array.isArray(body.minted) ? body.minted : []
  } catch {
    return []
  } finally {
    try { unlinkSync(reportPath) } catch { /* ignore */ }
  }
}

let stack
try {
  stack = await resolveMeasurementTarget({ root })
} catch (error) {
  console.error('REFUSE: ' + (error instanceof Error ? error.message : String(error)))
  console.error('A measurement that cannot name what it measured is not evidence.')
  process.exit(2)
}

setApiBase(stack.api)
const childEnv = {
  ...process.env,
  STORYLINT_UI: stack.ui,
  STORYLINT_API: stack.api,
  STORYLINT_ALLOW_EXTERNAL_UI: '1',
}
console.log(`[owned=${stack.owned}] ui=${stack.ui} api=${stack.api} head=${stack.shortHead} shell=${stack.shellCss?.sha256_12}`)

// Bookend: fresh stack ≠ fresh container (active-project.txt persists).
const activeBefore = await readServerActiveProjectId()
console.log(`[isolation] active-project before suite: ${activeBefore}`)
mkdirSync(resolve(root, 'e2e/output'), { recursive: true })

const results = []
console.log(`Running ${ALL_FEATURE_SMOKES.length} feature smokes… (timeout ${PER_SMOKE_TIMEOUT_MS}ms each)`)
console.log(`LLM path: ${process.env.STORYLINT_E2E_LIVE_LLM === '1' ? 'LIVE' : 'fixture route stubs (default)'}`)
try {
  for (const relPath of ALL_FEATURE_SMOKES) {
    console.log(`\n===== ${relPath} =====`)
    const started = Date.now()
    const reportPath = resolve(root, 'e2e/output', `.iso-${process.pid}-${Date.now().toString(36)}.json`)
    const env = { ...childEnv, STORYLINT_ISOLATION_REPORT: reportPath }
    try {
      await runSmoke(relPath, env)
      // Runtime isolation BEFORE any suite-level restore. Missing mint = FAIL (not skip).
      const minted = readMintReport(reportPath)
      await assertSmokeOwnedActive({ smokePath: relPath, minted })
      const activeAfter = await readServerActiveProjectId()
      console.log(`[isolation] ${relPath} ok active=${activeAfter} minted=${minted.join(',')}`)
      results.push({ relPath, ok: true, ms: Date.now() - started, activeAfter, minted })
    } catch (error) {
      try { if (existsSync(reportPath)) unlinkSync(reportPath) } catch { /* ignore */ }
      results.push({
        relPath,
        ok: false,
        ms: Date.now() - started,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }
} finally {
  try {
    const target = activeBefore || 'default'
    await restoreActiveProject(target)
    const activeAfterSuite = await readServerActiveProjectId()
    if (activeAfterSuite !== target) {
      console.error(`FAIL isolation bookend: want=${target} got=${activeAfterSuite}`)
      results.push({
        relPath: '(suite-active-project-bookend)',
        ok: false,
        ms: 0,
        error: `active want=${target} got=${activeAfterSuite}`,
      })
    } else {
      console.log(`[isolation] active-project after suite restored: ${activeAfterSuite}`)
    }
  } catch (error) {
    console.error('FAIL isolation restore: ' + (error instanceof Error ? error.message : error))
    results.push({
      relPath: '(suite-active-project-bookend)',
      ok: false,
      ms: 0,
      error: error instanceof Error ? error.message : String(error),
    })
  }
  try {
    const swept = sweepOrphanE2eProjects({
      dataDir: defaultDataDirectory(root),
      keepIds: [activeBefore, 'default'].filter(Boolean),
    })
    if (swept.removed.length) {
      console.log(`[isolation] swept ${swept.removed.length} orphan harness project files`)
    }
  } catch (error) {
    console.warn('[isolation] sweep skipped: ' + (error instanceof Error ? error.message : error))
  }
  try { await stack.stop() } catch { /* ignore */ }
}

console.log('\n===== SUITE SUMMARY =====')
console.log(`provenance head=${stack.shortHead} owned=${stack.owned} shell=${stack.shellCss?.sha256_12} ui=${stack.ui}`)
for (const result of results) {
  const mark = result.ok ? 'PASS' : 'FAIL'
  const detail = result.ok ? `${result.ms}ms` : `${result.ms}ms — ${result.error}`
  console.log(`${mark}  ${result.relPath}  (${detail})`)
}
const failed = results.filter((result) => !result.ok)
if (failed.length) {
  console.error(`\nFAIL: ${failed.length}/${results.length} feature smokes`)
  process.exitCode = 1
} else {
  console.log(`\nPASS: all ${results.length} feature smokes`)
}
