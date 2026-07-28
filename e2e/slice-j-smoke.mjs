import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { mkdirSync } from 'node:fs'

const require = createRequire('D:/npm-global/node_modules/playwright/package.json')
const pwRoot = dirname(require.resolve('playwright/package.json'))
const { chromium } = await import(pathToFileURL(resolve(pwRoot, 'index.mjs')).href)
mkdirSync('e2e/output', { recursive: true })
const browser = await chromium.launch({ channel: 'msedge', headless: true })
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true })
const page = await context.newPage()
try {
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' })
  const title = `Project Smoke ${Date.now()}`
  await page.getByRole('button', { name: 'New project' }).click()
  await page.getByLabel('New project title').fill(title)
  await page.getByRole('button', { name: 'Create', exact: true }).click()
  await page.waitForFunction(
    (expected) => document.querySelector('select[aria-label="Active project"]')?.selectedOptions[0]?.text === expected,
    title,
    { timeout: 5000 },
  )
  const body = page.getByLabel('Chapter text')
  const uniqueBody = `Second project prose ${Date.now()}`
  await body.fill(uniqueBody)
  await page.locator('.project-status', { hasText: 'Saved' }).waitFor({ timeout: 5000 })

  await page.getByLabel('Active project').selectOption('default')
  await page.waitForFunction(
    (text) => document.querySelector('textarea[aria-label="Chapter text"]')?.value !== text,
    uniqueBody,
    { timeout: 5000 },
  )
  const newId = await page.getByLabel('Active project').locator('option').filter({ hasText: title }).getAttribute('value')
  await page.getByLabel('Active project').selectOption(newId)
  await page.waitForFunction(
    (text) => document.querySelector('textarea[aria-label="Chapter text"]')?.value === text,
    uniqueBody,
    { timeout: 5000 },
  )

  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export MD' }).click()
  const download = await downloadPromise
  if (!download.suggestedFilename().endsWith('.zip')) throw new Error('Export is not a ZIP')
  await download.saveAs('e2e/output/slice-j-export.zip')
  await page.screenshot({ path: 'e2e/output/slice-j-smoke.png', fullPage: true })
  console.log('PASS: create/switch local projects preserves prose; default path survives; Markdown ZIP downloads')
} finally {
  await browser.close()
}
