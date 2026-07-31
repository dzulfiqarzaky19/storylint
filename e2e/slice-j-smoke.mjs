import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { mkdirSync } from 'node:fs'
import {
  ensureDraftReady,
  ensureIsolatedProject,
  requireApiOrigin,
  requireUiOrigin,
  selectProjectByValue,
  setApiBase,
  waitSaved,
} from './helpers.mjs'

const require = createRequire('D:/npm-global/node_modules/playwright/package.json')
const pwRoot = dirname(require.resolve('playwright/package.json'))
const { chromium } = await import(pathToFileURL(resolve(pwRoot, 'index.mjs')).href)
mkdirSync('e2e/output', { recursive: true })
if (process.env.STORYLINT_API) setApiBase(process.env.STORYLINT_API)
requireApiOrigin()
const UI = requireUiOrigin()
const browser = await chromium.launch({ channel: 'msedge', headless: true })
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true })
const page = await context.newPage()
try {
  // load (not networkidle): companion/LLM sockets can keep networkidle forever on owned stacks.
  await page.goto(UI, { waitUntil: 'domcontentloaded', timeout: 60000 })

  // Every project this smoke touches is created here. Never select ambient 'default'
  // (gitignored data/) — that measures the machine, not the product.
  const baseId = await ensureIsolatedProject(page, { title: 'SliceJ Base' })
  const harborId = await ensureIsolatedProject(page, { title: 'Harbor Draft' })

  await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 })
  await selectProjectByValue(page, harborId, { timeout: 15000 })
  await ensureDraftReady(page, { body: '', title: 'Chapter One' })

  const body = page.getByRole('main', { name: 'Draft' }).getByLabel('Chapter text')
  const uniqueBody = `Second project prose ${Date.now()}`
  await body.fill(uniqueBody)
  await waitSaved(page)

  // Switch to the OTHER project we created (not ambient default).
  await selectProjectByValue(page, baseId, { timeout: 15000 })
  await page.waitForFunction(
    (text) => {
      const el = document.querySelector('main[aria-label="Draft"] textarea[aria-label="Chapter text"]')
        || document.querySelector('textarea[aria-label="Chapter text"]')
      // Base may be empty or different chapter — must not still show harbor prose.
      return !el || el.value !== text
    },
    uniqueBody,
    { timeout: 15000 },
  )

  // Return to harbor and prove prose survived the switch.
  await selectProjectByValue(page, harborId, { timeout: 15000 })
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
  await chapterText.waitFor({ timeout: 15000 })
  await page.waitForFunction(
    (text) => {
      const el = document.querySelector('main[aria-label="Draft"] textarea[aria-label="Chapter text"]')
        || document.querySelector('textarea[aria-label="Chapter text"]')
      return el && el.value === text
    },
    uniqueBody,
    { timeout: 15000 },
  )

  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Project menu' }).click()
  await page.getByRole('menuitem', { name: /Export|Export markdown/i }).click()
  const download = await downloadPromise
  if (!download.suggestedFilename().endsWith('.zip')) throw new Error('Export is not a ZIP')
  await download.saveAs('e2e/output/slice-j-export.zip')
  await page.screenshot({ path: 'e2e/output/slice-j-smoke.png', fullPage: true })
  console.log('PASS: create/switch owned projects preserves prose; Markdown ZIP downloads (no ambient default)')
} finally {
  await browser.close()
}
