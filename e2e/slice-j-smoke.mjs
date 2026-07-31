import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { mkdirSync } from 'node:fs'
import {
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

const marks = []
const t0 = Date.now()
function mark(label) {
  marks.push({ label, t: Date.now() })
}

async function openDraftEditor(page) {
  const chapterText = page.getByRole('main', { name: 'Draft' }).getByLabel('Chapter text')
  if (await chapterText.isVisible().catch(() => false)) return chapterText
  const door = page.getByRole('main').getByRole('button', { name: 'Write', exact: true })
    .or(page.getByLabel('Draft').getByRole('button', { name: 'Write', exact: true }))
    .or(page.getByRole('button', { name: 'Write', exact: true }))
  if (await door.count()) await door.first().click()
  else {
    const draftBtn = page.getByRole('button', { name: 'Draft', exact: true })
    if (await draftBtn.count()) await draftBtn.click()
  }
  await chapterText.waitFor({ timeout: 10000 })
  return chapterText
}

const browser = await chromium.launch({ channel: 'msedge', headless: true })
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true })
const page = await context.newPage()
mark('start')
try {
  // Never networkidle on owned stacks — companion/LLM sockets keep it open (~30s burn).
  await page.goto(UI, { waitUntil: 'domcontentloaded', timeout: 30000 })
  mark('goto')

  // Mint BOTH projects this run. Never select ambient 'default'.
  // Create before first UI reload so one reload populates both options.
  const baseId = await ensureIsolatedProject(null, { title: 'SliceJ Base' })
  mark('base-api')
  const harborId = await ensureIsolatedProject(null, { title: 'Harbor Draft' })
  mark('harbor-api')

  // One reload so Active project options include both mint ids.
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 })
  mark('reload-options')

  await selectProjectByValue(page, harborId, { timeout: 10000 })
  mark('select-harbor')

  // Empty create lands two doors (IA_MAP §10); open Draft via Write door — same as pre-slow path.
  const body = await openDraftEditor(page)
  mark('draft-open')

  const uniqueBody = `Second project prose ${Date.now()}`
  await body.fill(uniqueBody)
  await waitSaved(page)
  mark('filled-saved')

  // Switch to the OTHER owned project.
  await selectProjectByValue(page, baseId, { timeout: 10000 })
  mark('select-base')
  await page.waitForFunction(
    (text) => {
      const el = document.querySelector('main[aria-label="Draft"] textarea[aria-label="Chapter text"]')
        || document.querySelector('textarea[aria-label="Chapter text"]')
      return !el || el.value !== text
    },
    uniqueBody,
    { timeout: 10000 },
  )
  mark('prose-cleared')

  // Return to harbor; prove prose survived.
  await selectProjectByValue(page, harborId, { timeout: 10000 })
  mark('return-harbor')
  await openDraftEditor(page)
  await page.waitForFunction(
    (text) => {
      const el = document.querySelector('main[aria-label="Draft"] textarea[aria-label="Chapter text"]')
        || document.querySelector('textarea[aria-label="Chapter text"]')
      return el && el.value === text
    },
    uniqueBody,
    { timeout: 10000 },
  )
  mark('prose-restored')

  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Project menu' }).click()
  await page.getByRole('menuitem', { name: /Export|Export markdown/i }).click()
  const download = await downloadPromise
  if (!download.suggestedFilename().endsWith('.zip')) throw new Error('Export is not a ZIP')
  await download.saveAs('e2e/output/slice-j-export.zip')
  await page.screenshot({ path: 'e2e/output/slice-j-smoke.png', fullPage: true })
  mark('export')

  const total = Date.now() - t0
  const steps = []
  for (let i = 1; i < marks.length; i++) {
    steps.push(`${marks[i].label}=${marks[i].t - marks[i - 1].t}ms`)
  }
  console.log(`PASS: create/switch owned projects preserves prose; Markdown ZIP downloads (${total}ms)`)
  console.log(`TIMING ${total}ms :: ${steps.join(' ')}`)
} finally {
  await browser.close()
}
