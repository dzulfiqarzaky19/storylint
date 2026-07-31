import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { mkdirSync } from 'node:fs'

const require = createRequire('D:/npm-global/node_modules/playwright/package.json')
const pwRoot = dirname(require.resolve('playwright/package.json'))
const { chromium } = await import(pathToFileURL(resolve(pwRoot, 'index.mjs')).href)
mkdirSync('e2e/output', { recursive: true })
const browser = await chromium.launch({ channel: 'msedge', headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
try {
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' })
  const before = await page.evaluate(() => fetch('/api/project').then((response) => response.json()))
  const companion = page.locator('.panel[data-companion-context]').first()
  const faces = companion.getByRole('tablist', { name: 'Companion faces' })

  await faces.getByRole('button', { name: 'Research', exact: true }).click()
  await companion.getByLabel('Research query').waitFor({ timeout: 5000 })
  await companion.getByLabel('Research query').fill(`medieval archive access customs smoke-${Date.now()}`)
  await companion.locator('form').getByRole('button', { name: 'Research', exact: true }).click()
  const card = companion.locator('.research-card').first()
  await card.getByText('Controlled archive access').waitFor({ timeout: 10000 })
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
  await faces.getByRole('button', { name: /^Inbox/ }).click()
  await companion.getByRole('button', { name: 'Accept' }).first().waitFor({ timeout: 5000 })
  await page.screenshot({ path: 'e2e/output/slice-h-smoke.png', fullPage: true })
  console.log('PASS: dedicated cited research panel; Pin persists note; Propose creates pending lore; no auto-canon or chat dump')
} finally {
  await browser.close()
}
