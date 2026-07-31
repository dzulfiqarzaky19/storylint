import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { ALL_FEATURE_SMOKES } from './constants.mjs'
import { HARD_SMOKE_TIMEOUT_MS } from './helpers.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
// Per-smoke wall clock. Fixture path should finish well under this; live LLM may need STORYLINT_E2E_LIVE_LLM=1 + higher budget.
const PER_SMOKE_TIMEOUT_MS = Number.parseInt(process.env.STORYLINT_E2E_SMOKE_TIMEOUT_MS ?? String(HARD_SMOKE_TIMEOUT_MS), 10)

function runSmoke(relPath) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(process.execPath, [relPath], {
      cwd: root,
      stdio: 'inherit',
      env: process.env,
      shell: false,
    })
    const timer = setTimeout(() => {
      child.kill('SIGTERM')
      // Windows: force-kill if still alive shortly after.
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

const results = []
console.log(`Running ${ALL_FEATURE_SMOKES.length} feature smokes… (timeout ${PER_SMOKE_TIMEOUT_MS}ms each)`)
console.log(`LLM path: ${process.env.STORYLINT_E2E_LIVE_LLM === '1' ? 'LIVE' : 'fixture route stubs (default)'}`)
for (const relPath of ALL_FEATURE_SMOKES) {
  console.log(`\n===== ${relPath} =====`)
  const started = Date.now()
  try {
    await runSmoke(relPath)
    results.push({ relPath, ok: true, ms: Date.now() - started })
  } catch (error) {
    results.push({
      relPath,
      ok: false,
      ms: Date.now() - started,
      error: error instanceof Error ? error.message : String(error),
    })
    // Keep going so the report is a true green/red list, not first-failure only.
  }
}

console.log('\n===== SUITE SUMMARY =====')
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
