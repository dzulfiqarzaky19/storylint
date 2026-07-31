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
  const manuscript = page.getByRole('main', { name: 'Draft' })
  await manuscript.waitFor()

  const craftTag = manuscript.getByRole('button', { name: 'char-dev' })
  await craftTag.click()
  await page.waitForFunction(
    () => document.querySelector('.manuscript__craft-tag[aria-pressed="true"]') !== null,
    undefined,
    { timeout: 5000 },
  )
  await page.locator('.project-status', { hasText: 'Saved' }).waitFor({ timeout: 5000 })

  const suffix = Date.now().toString(36).slice(-4)
  const sheetName = `Moon Archive-${suffix}`
  await page.getByRole('button', { name: 'New sheet' }).click()
  await page.getByLabel('Sheet portrait or icon').waitFor()
  await page.getByLabel('Name').fill(sheetName)
  await page.getByLabel('Kind').selectOption('lore')
  await page.getByLabel('Portrait / icon').fill('🌙')
  await page.getByRole('button', { name: 'Save sheet' }).click()
  await page.getByRole('button', { name: 'origin' }).waitFor({ timeout: 5000 })
  await page.getByRole('button', { name: 'origin' }).click()
  if (await page.getByLabel('Key').inputValue() !== 'origin') throw new Error('Lore hint did not fill freeform key')
  await page.getByRole('button', { name: 'Back to binder' }).click()
  await page.getByRole('button', { name: new RegExp(sheetName) }).click()
  if (await page.getByLabel('Portrait / icon').inputValue() !== '🌙') throw new Error('Portrait did not persist')

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
