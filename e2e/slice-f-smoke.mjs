import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { mkdirSync } from 'node:fs'
import {
  ensureIsolatedProject,
  ensureDraftReady,
  waitSaved,
  requireUiOrigin,
  setApiBase
} from './helpers.mjs'

const require = createRequire('D:/npm-global/node_modules/playwright/package.json')
const pwRoot = dirname(require.resolve('playwright/package.json'))
const { chromium } = await import(pathToFileURL(resolve(pwRoot, 'index.mjs')).href)
mkdirSync('e2e/output', { recursive: true })

if (process.env.STORYLINT_API) setApiBase(process.env.STORYLINT_API)
const UI = requireUiOrigin()
const browser = await chromium.launch({ channel: 'msedge', headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
try {
  await ensureIsolatedProject(page)
  await page.goto(requireUiOrigin(), { waitUntil: 'networkidle' })
  await ensureDraftReady(page, { body: 'Aria opened the iron door.' })
  const manuscript = page.getByRole('main', { name: 'Draft' })
  await manuscript.waitFor()

  const craftTag = manuscript.getByRole('button', { name: 'char-dev' })
  await craftTag.click()
  await page.waitForFunction(
    () => document.querySelector('.manuscript__craft-tag[aria-pressed="true"]') !== null,
    undefined,
    { timeout: 5000 },
  )
  await waitSaved(page)

  const suffix = Date.now().toString(36).slice(-4)
  const sheetName = `Moon Archive-${suffix}`
  // Sheet editor lives under Canon/binder; open Canon before New sheet.
  const canonBtn = page.getByRole('button', { name: 'Canon', exact: true })
  if (await canonBtn.count()) await canonBtn.click()
  await page.getByRole('button', { name: 'New sheet' }).click()
  await page.getByLabel('Portrait / icon').waitFor()
  await page.getByLabel('Name', { exact: true }).fill(sheetName)
  await page.locator('select.sheet-editor__select').selectOption('lore')
  await page.getByLabel('Portrait / icon').fill('🌙')
  await page.getByRole('button', { name: 'Save sheet' }).click()
  await page.getByRole('button', { name: 'origin' }).waitFor({ timeout: 5000 })
  await page.getByRole('button', { name: 'origin' }).click()
  if (await page.getByLabel('Key').inputValue() !== 'origin') throw new Error('Lore hint did not fill freeform key')
  await page.getByRole('button', { name: 'Back to binder' }).click()
  // Binder list row (not graph node which also matches the sheet name).
  await page.locator('.ui-list-row').filter({ hasText: sheetName }).first().click()
  if (await page.getByLabel('Portrait / icon').inputValue() !== '🌙') throw new Error('Portrait did not persist')

  // Reading profile + Focus live on Draft.
  await page.getByRole('button', { name: 'Draft', exact: true }).click()
  await manuscript.waitFor()
  const reading = manuscript.getByRole('button', { name: /Paper:/ })
  const before = await reading.getAttribute('aria-label')
  await reading.click()
  if (await reading.getAttribute('aria-label') === before) throw new Error('Reading profile did not cycle')

  await page.screenshot({ path: 'e2e/output/slice-f-wide.png', fullPage: true })
  await page.setViewportSize({ width: 1200, height: 900 })
  await page.screenshot({ path: 'e2e/output/slice-f-narrow.png', fullPage: true })

  await page.getByRole('button', { name: 'Focus mode' }).click()
  if (await craftTag.isVisible()) throw new Error('Craft tags remain visible in Focus')
  await page.getByRole('button', { name: 'Exit focus mode' }).click()

  console.log('PASS: portrait/icon persists; lore hints stay freeform; manual craft tags save/hide in Focus; reading profile and responsive paper render')
} finally {
  await browser.close()
}
