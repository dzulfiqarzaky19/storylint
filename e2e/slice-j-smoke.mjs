import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { mkdirSync } from 'node:fs'
import {
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
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true })
const page = await context.newPage()
try {
  await page.goto(requireUiOrigin(), { waitUntil: 'networkidle' })
  const tag = Date.now().toString(36).slice(-4)
  const title = `Harbor Draft-${tag}`
  await page.getByRole('button', { name: 'Project menu' }).click()
  await page.getByRole('menuitem', { name: 'New project' }).click()
  await page.getByLabel('New project title').fill(title)
  await page.getByRole('button', { name: 'Create', exact: true }).click()
  // Empty create lands two doors (IA_MAP §10); open Draft before editing chapter text.
  const writeDoor = page.getByRole('main').getByRole('button', { name: 'Write', exact: true })
    .or(page.getByLabel('Draft').getByRole('button', { name: 'Write', exact: true }))
    .or(page.getByRole('button', { name: 'Write', exact: true }))
  await writeDoor.first().click()
  await page.getByRole('main', { name: 'Draft' }).getByLabel('Chapter text').waitFor({ timeout: 8000 })
  await page.waitForFunction(
    (expected) => document.querySelector('select[aria-label="Active project"]')?.selectedOptions[0]?.text === expected,
    title,
    { timeout: 8000 },
  )
  const body = page.getByRole('main', { name: 'Draft' }).getByLabel('Chapter text')
  const uniqueBody = `Second project prose ${Date.now()}`
  await body.fill(uniqueBody)
  await waitSaved(page)

  await page.getByLabel('Active project').selectOption('default')
  await page.waitForFunction(
    (text) => {
      const el = document.querySelector('main[aria-label="Draft"] textarea[aria-label="Chapter text"]')
        || document.querySelector('textarea[aria-label="Chapter text"]')
      return el && el.value !== text
    },
    uniqueBody,
    { timeout: 8000 },
  )
  const newId = await page.getByLabel('Active project').locator('option').filter({ hasText: title }).getAttribute('value')
  await page.getByLabel('Active project').selectOption(newId)
  // Returning project may land on doors or Draft; ensure editor.
  const chapterText = page.getByRole('main', { name: 'Draft' }).getByLabel('Chapter text')
  if (!(await chapterText.isVisible().catch(() => false))) {
    const door = page.getByRole('main').getByRole('button', { name: 'Write', exact: true })
      .or(page.getByRole('button', { name: 'Write', exact: true }))
    if (await door.count()) await door.first().click()
    else {
      const draftBtn = page.getByRole('button', { name: 'Draft', exact: true })
      if (await draftBtn.count()) await draftBtn.click()
    }
  }
  await chapterText.waitFor({ timeout: 8000 })
  await page.waitForFunction(
    (text) => {
      const el = document.querySelector('main[aria-label="Draft"] textarea[aria-label="Chapter text"]')
        || document.querySelector('textarea[aria-label="Chapter text"]')
      return el && el.value === text
    },
    uniqueBody,
    { timeout: 8000 },
  )

  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Project menu' }).click()
  await page.getByRole('menuitem', { name: /Export|Export markdown/i }).click()
  const download = await downloadPromise
  if (!download.suggestedFilename().endsWith('.zip')) throw new Error('Export is not a ZIP')
  await download.saveAs('e2e/output/slice-j-export.zip')
  await page.screenshot({ path: 'e2e/output/slice-j-smoke.png', fullPage: true })
  console.log('PASS: create/switch local projects preserves prose; default path survives; Markdown ZIP downloads')
} finally {
  await browser.close()
}
