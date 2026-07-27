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
  const body = page.getByRole('main', { name: 'Manuscript' }).getByLabel('Chapter text')
  await body.fill(`Aria enters the sealed archive but meets no resistance and leaves unchanged. ${Date.now()}`)
  await page.locator('.project-status', { hasText: 'Saved' }).waitFor({ timeout: 5000 })
  const before = await body.inputValue()
  const marksBefore = await page.locator('.manuscript__mark').count()

  await page.getByRole('button', { name: 'Review chapter' }).click()
  await page.getByText('Low resistance').waitFor({ timeout: 10000 })
  if (await body.inputValue() !== before) throw new Error('Review changed manuscript')
  if (await page.locator('.manuscript__mark').count() !== marksBefore) throw new Error('Review emitted continuity marks')

  await page.getByRole('button', { name: 'Add suggested tags' }).click()
  await page.waitForFunction(
    () => document.querySelector('.manuscript__craft-tag[aria-pressed="true"]') !== null,
    undefined,
    { timeout: 5000 },
  )

  await page.getByRole('button', { name: 'Craft check' }).click()
  await page.getByText('Pressure stays flat').waitFor({ timeout: 10000 })
  if (await body.inputValue() !== before) throw new Error('Craft check changed manuscript')

  await page.screenshot({ path: 'e2e/output/slice-g-smoke.png', fullPage: true })
  console.log('PASS: Review and craft check are on-demand neutral panel findings; tags require explicit add; no manuscript or continuity-mark writes')
} finally {
  await browser.close()
}
