/**
 * E1 deliverable — prove step label survives a stall.
 *
 * Throwaway: copies slice-k path through mint+seed+goto, then steps
 * "STALL-INJECT" and blocks a route forever so Playwright times out.
 * Parent captures FULL output (no filter). Pass only if the stall label
 * appears in the captured body before exit.
 *
 * Not part of the green suite. Delete after proof lands in git history
 * (artifact kept under e2e/output/).
 */
import { spawn } from 'node:child_process'
import { writeFileSync, mkdirSync, readFileSync, unlinkSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { resolveMeasurementTarget } from './owned-stack.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
mkdirSync(resolve(root, 'e2e/proofs'), { recursive: true })

const stallSmokePath = resolve(root, 'e2e/_stall_slice_k_throwaway.mjs')
const artifactPath = resolve(root, 'e2e/proofs/E1-step-stall-proof.txt')

const stallSource = `/**
 * THROWAWAY — forced stall after a named step. Not a product smoke.
 */
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import {
  ensureIsolatedProject,
  reclaimIsolatedProject,
  requireApiOrigin,
  requireUiOrigin,
  setApiBase,
  PRECONDITION_TIMEOUT_MS,
} from './helpers.mjs'

const require = createRequire('D:/npm-global/node_modules/playwright/package.json')
const pwRoot = dirname(require.resolve('playwright/package.json'))
const { chromium } = await import(pathToFileURL(resolve(pwRoot, 'index.mjs')).href)

const STEP_T0 = Date.now()
function step(label) {
  // Same contract as production slice-k/l: sync write so stall still leaves label.
  process.stdout.write(\`[slice-k +\${Date.now() - STEP_T0}ms] \${label}\\n\`)
}

if (process.env.STORYLINT_API) setApiBase(process.env.STORYLINT_API)
requireApiOrigin()
const UI = requireUiOrigin()
const browser = await chromium.launch({ channel: 'msedge', headless: true })
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  page.setDefaultTimeout(4000) // short so proof is fast; still a real timeout path

  step('mint')
  const projectId = await ensureIsolatedProject(page, {
    id: \`e2e-stall-proof-\${process.pid}-\${Date.now().toString(36)}\`,
    title: 'E1 Stall Proof',
  })

  step('goto')
  await page.goto(UI, { waitUntil: 'domcontentloaded', timeout: 15_000 })
  await page.getByLabel('Active project').waitFor({ state: 'attached', timeout: PRECONDITION_TIMEOUT_MS })
  await reclaimIsolatedProject(projectId)

  // Named step immediately before the hang — this is what must appear in FAIL output.
  step('STALL-INJECT')
  // Route that never fulfills: next navigation/fetch stalls until default timeout.
  await page.route('**/api/project', async () => {
    await new Promise(() => {}) // never settles
  })
  // Trigger a wait that uses the stalled resource (Playwright locator timeout path).
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 4000 }).catch(() => {})
  // Force a hard wait that will timeout with the route still open.
  await page.getByRole('button', { name: 'Canon' }).click({ timeout: 4000 })
  await page.getByRole('main', { name: 'Relationship graph' }).waitFor({ timeout: 4000 })
  console.log('UNEXPECTED PASS — stall did not fire')
  process.exitCode = 2
} catch (error) {
  // Ensure error text is on the pipe before exit (full capture, no filter).
  process.stderr.write(String(error && error.stack ? error.stack : error) + '\\n')
  process.exitCode = 1
} finally {
  await browser.close().catch(() => {})
}
`

writeFileSync(stallSmokePath, stallSource)

const stack = await resolveMeasurementTarget({ root })
const env = {
  ...process.env,
  STORYLINT_UI: stack.ui,
  STORYLINT_API: stack.api,
  STORYLINT_ALLOW_EXTERNAL_UI: '1',
}

const chunks = []
const child = spawn(process.execPath, [stallSmokePath], {
  cwd: root,
  env,
  stdio: ['ignore', 'pipe', 'pipe'],
})
// Capture WHOLE output — never filter a diagnostic run (rat 2026-07-31).
child.stdout.on('data', (d) => {
  chunks.push(d)
  process.stdout.write(d)
})
child.stderr.on('data', (d) => {
  chunks.push(d)
  process.stderr.write(d)
})

const code = await new Promise((resolvePromise) => {
  const killer = setTimeout(() => {
    chunks.push(Buffer.from('\n[parent] hard-kill after 25s\n'))
    child.kill('SIGTERM')
    setTimeout(() => child.kill('SIGKILL'), 1500)
  }, 25_000)
  child.on('exit', (c) => {
    clearTimeout(killer)
    resolvePromise(c ?? 1)
  })
})

try {
  await stack.stop()
} catch {
  /* ignore */
}

const body = Buffer.concat(chunks).toString('utf8')
const header = [
  'E1 step-stall proof artifact',
  `date: ${new Date().toISOString()}`,
  `child_exit: ${code}`,
  'expect: body contains "[slice-k +" and "STALL-INJECT" AND child_exit !== 0',
  '--- FULL OUTPUT (unfiltered) ---',
  '',
].join('\n')
writeFileSync(artifactPath, header + body + '\n--- END ---\n')

const hasLabel = /\[slice-k \+\d+ms\] STALL-INJECT/.test(body)
const failed = code !== 0 && code !== null

// cleanup throwaway smoke source (artifact retained)
try {
  unlinkSync(stallSmokePath)
} catch {
  /* ignore */
}

console.log('\n===== E1 JUDGEMENT =====')
console.log('artifact:', artifactPath)
console.log('has STALL-INJECT step label:', hasLabel)
console.log('child failed (non-zero):', failed, 'code=', code)
if (hasLabel && failed) {
  console.log('PASS E1: stalled step named before timeout')
  process.exit(0)
}
console.error('FAIL E1: need failing run WITH step label in output')
process.exit(1)
