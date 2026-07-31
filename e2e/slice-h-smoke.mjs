import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { mkdirSync } from 'node:fs'
import {
  DEFAULT_VIEWPORT,
  LLM_UI_TIMEOUT_MS,
  armHardTimeout,
  companionPanel,
  installFixtureLlmRoutes,
  openCompanionFace,
} from './helpers.mjs'

const require = createRequire('D:/npm-global/node_modules/playwright/package.json')
const pwRoot = dirname(require.resolve('playwright/package.json'))
const { chromium } = await import(pathToFileURL(resolve(pwRoot, 'index.mjs')).href)

const clearHardTimeout = armHardTimeout('slice-h-smoke', 60_000)
mkdirSync('e2e/output', { recursive: true })
const browser = await chromium.launch({ channel: 'msedge', headless: true })
const page = await browser.newPage({ viewport: { ...DEFAULT_VIEWPORT } })

try {
  // Deterministic research path (default). Live path only with STORYLINT_E2E_LIVE_LLM=1.
  await installFixtureLlmRoutes(page)
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' })
  const before = await page.evaluate(() => fetch('/api/project').then((response) => response.json()))
  const companion = companionPanel(page)

  await openCompanionFace(companion, 'Research')
  await companion.getByLabel('Research query').waitFor({ timeout: 5000 })
  await companion.getByLabel('Research query').fill(`medieval archive access customs smoke-${Date.now()}`)
  await companion.locator('form').getByRole('button', { name: 'Research', exact: true }).click()

  const card = companion.locator('.research-card').first()
  // Fail fast: fixture titles are fixed; live mode still has a hard bound.
  await card.getByText('Controlled archive access').waitFor({ timeout: LLM_UI_TIMEOUT_MS })
  await card.getByText('International Council on Archives — Principles of Access').waitFor({ timeout: 5000 })
  await card.getByRole('button', { name: 'Pin' }).click()
  await companion.getByText('Pinned notes').waitFor({ timeout: 5000 })
  await card.getByRole('button', { name: 'Propose to sheet' }).click()
  await page.waitForFunction(
    (count) => fetch('/api/project').then((response) => response.json()).then((project) => project.proposals.length > count),
    before.proposals.length,
    { timeout: 5000 },
  )

  const after = await page.evaluate(() => fetch('/api/project').then((response) => response.json()))
  if (after.sheets.length !== before.sheets.length) throw new Error('Research auto-wrote canon sheet')
  if (after.researchNotes.length <= before.researchNotes.length) throw new Error('Pin did not persist research note')
  if (!after.proposals.some((proposal) => proposal.status === 'pending' && proposal.sheetKind === 'lore')) {
    throw new Error('Propose did not create pending lore proposal')
  }

  await page.screenshot({ path: 'e2e/output/slice-h-research.png', fullPage: true })
  await openCompanionFace(companion, 'Inbox')
  await companion.getByRole('button', { name: 'Accept' }).first().waitFor({ timeout: 5000 })
  await page.screenshot({ path: 'e2e/output/slice-h-smoke.png', fullPage: true })
  console.log('PASS: dedicated cited research panel; Pin persists note; Propose creates pending lore; no auto-canon or chat dump')
} finally {
  clearHardTimeout()
  await browser.close()
}
