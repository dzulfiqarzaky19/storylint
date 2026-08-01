/**
 * E1 deliverable — prove shipping step labels survive a stall.
 *
 * Bound to the real module, not a throwaway copy:
 *   1) Static: slice-k-smoke.mjs and slice-l-smoke.mjs must import makeStep
 *      from ./step-label.mjs (no local STEP_T0 / function step).
 *   2) Dynamic: a child imports the SAME makeStep helper, emits STALL-INJECT,
 *      then forces a Playwright timeout. Parent captures FULL output.
 *
 * Pass only if both checks hold and the stall label appears before non-zero exit.
 * Not part of the green suite — run by hand / when changing step labelling.
 */
import { spawn } from 'node:child_process'
import { writeFileSync, mkdirSync, readFileSync, unlinkSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { resolveMeasurementTarget } from './owned-stack.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const e2e = resolve(root, 'e2e')
mkdirSync(resolve(root, 'e2e/proofs'), { recursive: true })

const stallSmokePath = resolve(e2e, '_stall_slice_k_throwaway.mjs')
const artifactPath = resolve(e2e, 'proofs/E1-step-stall-proof.txt')
const stepLabelPath = resolve(e2e, 'step-label.mjs')

function assertShippingImportsMakeStep() {
  const shipping = ['slice-k-smoke.mjs', 'slice-l-smoke.mjs']
  const importRe = /import\s*\{\s*makeStep\s*\}\s*from\s*['"]\.\/step-label\.mjs['"]/
  const localStepRe = /\bconst\s+STEP_T0\b|\bfunction\s+step\s*\(\s*label\s*\)/
  const problems = []
  for (const name of shipping) {
    const src = readFileSync(resolve(e2e, name), 'utf8')
    if (!importRe.test(src)) {
      problems.push(`${name}: missing import { makeStep } from './step-label.mjs'`)
    }
    if (localStepRe.test(src)) {
      problems.push(`${name}: local STEP_T0 / function step reintroduced (must use makeStep)`)
    }
  }
  const helper = readFileSync(stepLabelPath, 'utf8')
  if (!/export\s+function\s+makeStep\s*\(/.test(helper)) {
    problems.push('step-label.mjs: export function makeStep missing')
  }
  if (!/process\.stdout\.write/.test(helper)) {
    problems.push('step-label.mjs: must sync-write via process.stdout.write')
  }
  if (problems.length) {
    console.error('FAIL E1 static: shipping path not bound to step-label.mjs')
    for (const p of problems) console.error('  -', p)
    process.exit(1)
  }
  console.log('E1 static: slice-k + slice-l import makeStep from step-label.mjs')
}

assertShippingImportsMakeStep()

// Child uses the SHIPPED helper — not an inlined copy of step().
const stallSource = `/**
 * THROWAWAY child — stall after a named step via shipping makeStep.
 * Written by prove-step-stall.mjs; not a product smoke.
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
import { makeStep } from './step-label.mjs'

const require = createRequire('D:/npm-global/node_modules/playwright/package.json')
const pwRoot = dirname(require.resolve('playwright/package.json'))
const { chromium } = await import(pathToFileURL(resolve(pwRoot, 'index.mjs')).href)

const step = makeStep('slice-k')

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

  // Named step immediately before the hang — must appear in FAIL output.
  step('STALL-INJECT')
  await page.route('**/api/project', async () => {
    await new Promise(() => {}) // never settles
  })
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 4000 }).catch(() => {})
  await page.getByRole('button', { name: 'Canon' }).click({ timeout: 4000 })
  await page.getByRole('main', { name: 'Relationship graph' }).waitFor({ timeout: 4000 })
  console.log('UNEXPECTED PASS — stall did not fire')
  process.exitCode = 2
} catch (error) {
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
  'bound_to: e2e/step-label.mjs makeStep (imported by slice-k/l + this child)',
  'expect: body contains "[slice-k +" and "STALL-INJECT" AND child_exit !== 0',
  '--- FULL OUTPUT (unfiltered) ---',
  '',
].join('\n')
writeFileSync(artifactPath, header + body + '\n--- END ---\n')

const hasLabel = /\[slice-k \+\d+ms\] STALL-INJECT/.test(body)
const failed = code !== 0 && code !== null

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
  console.log('PASS E1: shipping makeStep label survived stall; k/l still import it')
  process.exit(0)
}
console.error('FAIL E1: need failing run WITH step label from shipping makeStep')
process.exit(1)
