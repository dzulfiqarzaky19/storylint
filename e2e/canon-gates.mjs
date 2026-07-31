/**
 * Owned-stack runner for the Canon design gates.
 *
 * The Canon rubrics (D4 chrome, empty-Canon P0, leave-guard) are measurement scripts, so they must
 * obey the same provenance rule as the smokes: build this tree, serve it on ephemeral ports, and
 * take BOTH origins from that stack. Driving an owned UI while seeding a hardcoded API means
 * writing to one database and reading another, which is how a check ends up confidently describing
 * a tree nobody is looking at.
 *
 *   npm run canon:gates
 */
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { HARD_SMOKE_TIMEOUT_MS, setApiBase } from './helpers.mjs'
import { resolveMeasurementTarget } from './owned-stack.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const TIMEOUT_MS = Number.parseInt(process.env.STORYLINT_E2E_SMOKE_TIMEOUT_MS ?? String(HARD_SMOKE_TIMEOUT_MS), 10)

const GATES = [
  'e2e/density-d4-shots.mjs',
  'e2e/canon-empty-shots.mjs',
  'e2e/canon-empty-guard.mjs',
  'e2e/canon-load-audit.mjs',
]

function run(relPath, env) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(process.execPath, [relPath], { cwd: root, stdio: 'inherit', env, shell: false })
    const timer = setTimeout(() => {
      child.kill('SIGTERM')
      setTimeout(() => {
        try { child.kill('SIGKILL') } catch { /* already gone */ }
      }, 2000).unref?.()
      reject(new Error(`${relPath} hard-timeout after ${TIMEOUT_MS}ms`))
    }, TIMEOUT_MS)
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

const failures = []
for (const relPath of GATES) {
  console.log(`\n===== ${relPath} =====`)
  try {
    await run(relPath, childEnv)
    console.log(`PASS  ${relPath}`)
  } catch (error) {
    failures.push(relPath)
    console.error(`FAIL  ${relPath} — ${error instanceof Error ? error.message : String(error)}`)
  }
}

await stack.close?.()

if (failures.length) {
  console.error(`\nFAIL: ${failures.length}/${GATES.length} Canon gates (${failures.join(', ')})`)
  process.exit(1)
}
console.log(`\nPASS: ${GATES.length}/${GATES.length} Canon gates at head=${stack.shortHead}`)
