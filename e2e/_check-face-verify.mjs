/**
 * Companion Check face density verify (resting + post-run Continuity).
 * node e2e/_check-face-verify.mjs
 */
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { mkdirSync, writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import {
  armHardTimeout,
  ensureDraftReady,
  ensureIsolatedProject,
  installFixtureLlmRoutes,
  requireCompanionFace,
  setApiBase,
} from './helpers.mjs'
import { ownMeasurementStack } from './owned-stack.mjs'

const require = createRequire('D:/npm-global/node_modules/playwright/package.json')
const pwRoot = dirname(require.resolve('playwright/package.json'))
const { chromium } = await import(pathToFileURL(resolve(pwRoot, 'index.mjs')).href)

const stopHard = armHardTimeout('check-face-verify', 120_000)
mkdirSync('e2e/output', { recursive: true })

const stack = await ownMeasurementStack({ skipBuild: process.env.STORYLINT_SKIP_BUILD === '1' })
setApiBase(stack.api)
process.env.STORYLINT_UI = stack.ui
process.env.STORYLINT_API = stack.api

const browser = await chromium.launch({ channel: 'msedge', headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
page.setDefaultTimeout(15_000)

const report = { head: stack.shortHead, ui: stack.ui, api: stack.api, checks: [], ok: true }

function check(name, pass, detail = '') {
  report.checks.push({ name, pass: !!pass, detail })
  if (!pass) report.ok = false
  console.log(`${pass ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`)
}

try {
  await installFixtureLlmRoutes(page)
  // Continuity uses the real fixture server path (returns project + mode + counts).

  await page.goto(stack.ui, { waitUntil: 'domcontentloaded', timeout: 30_000 })
  const projectId = await ensureIsolatedProject(page, { title: 'Check Face Density' })
  await ensureDraftReady(page, {
    body: 'Aria opened the iron door and waited for the archive warden.',
    title: 'Check Face Chapter',
  })
  await requireCompanionFace(page, 'Check')
  await page.locator('.companion__check-primary').waitFor({ state: 'visible', timeout: 10_000 })

  // Resting density
  check('no legend', (await page.locator('.companion__check-legend').count()) === 0)
  check('no tool cards chrome', (await page.locator('.companion__check-tool').count()) === 0)
  check('no three-card list', (await page.locator('.companion__check-tools').count()) === 0)
  check('Continuity primary', /ui-button--primary/.test((await page.locator('[data-check-run="continuity"]').getAttribute('class')) || ''))
  check('Review secondary', await page.locator('[data-check-run="review"]').isVisible())
  check('Craft secondary', await page.locator('[data-check-run="craft"]').isVisible())

  const restingFooter = await page.evaluate(() => {
    const footer = document.querySelector('.companion__check-footer')
    if (!footer) return []
    return [...footer.querySelectorAll('button')]
      .map((el) => (el.textContent || '').replace(/\s+/g, ' ').trim())
      .filter((t) => t && t !== '?')
  })
  check('resting footer sparse', restingFooter.length <= 3 && restingFooter.includes('Run Continuity'), JSON.stringify(restingFooter))

  // Run Continuity → post-run density
  await page.locator('[data-check-run="continuity"]').click()
  await page.waitForFunction(() => {
    const state = document.querySelector('[data-continuity-state]')?.getAttribute('data-continuity-state')
    const summary = (document.querySelector('.companion__check-summary')?.textContent || '').trim()
    return state === 'ready' || state === 'failed' || /Continuity:/i.test(summary)
  }, { timeout: 20_000 }).catch(() => null)

  const bodyText = ((await page.locator('.companion__check-body').innerText().catch(() => '')) || '').trim()
  const summaryText = ((await page.locator('.companion__check-summary').innerText().catch(() => '')) || '').trim()
  check('post-run has compact summary', /Continuity:/i.test(summaryText) || /no issues/i.test(summaryText), summaryText.slice(0, 160))
  check('post-run no Last Continuity essay', !/Last Continuity/i.test(bodyText), bodyText.slice(0, 160))
  check('post-run no tool-card essay', !/Accept\/Edit\/Reject stay gated/i.test(bodyText), bodyText.slice(0, 160))
  check('post-run no agent tool card double', (await page.locator('.companion__check-body .agent__tool-card').count()) === 0)

  const shotRest = 'e2e/output/check-face-tools.png'
  await page.locator('.panel[data-companion-face="check"]').screenshot({ path: shotRest })
  console.log('SHOT', shotRest)

  await page.locator('[data-check-info="craft"]').click()
  await page.locator('[data-check-help="craft"]').waitFor({ state: 'visible' })
  const shotHelp = 'e2e/output/check-face-craft-help.png'
  await page.locator('.panel[data-companion-face="check"]').screenshot({ path: shotHelp })
  console.log('SHOT', shotHelp)

  writeFileSync('e2e/output/check-face-verify.json', JSON.stringify({ ...report, projectId, bodyText }, null, 2))
  console.log(report.ok ? 'DONE check-face-verify PASS' : 'DONE check-face-verify FAIL')
  if (!report.ok) process.exitCode = 1
} catch (error) {
  console.error('FAIL check-face-verify', error)
  writeFileSync('e2e/output/check-face-verify.json', JSON.stringify({ ...report, error: String(error) }, null, 2))
  process.exitCode = 1
} finally {
  await browser.close().catch(() => {})
  await stack.stop().catch(() => {})
  stopHard()
}
