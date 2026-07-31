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
  waitSaved,
  ensureDraftReady,
  ensureIsolatedProject,
  fillChapterAndSave,
  requireUiOrigin,
  setApiBase
} from './helpers.mjs'

const require = createRequire('D:/npm-global/node_modules/playwright/package.json')
const pwRoot = dirname(require.resolve('playwright/package.json'))
const { chromium } = await import(pathToFileURL(resolve(pwRoot, 'index.mjs')).href)

const clearHardTimeout = armHardTimeout('slice-e-smoke')
mkdirSync('e2e/output', { recursive: true })
if (process.env.STORYLINT_API) setApiBase(process.env.STORYLINT_API)
const UI = requireUiOrigin()
const browser = await chromium.launch({ channel: 'msedge', headless: true })
const page = await browser.newPage({ viewport: { ...DEFAULT_VIEWPORT } })

try {
  await installFixtureLlmRoutes(page)
  await ensureIsolatedProject(page)

  await page.goto(requireUiOrigin(), { waitUntil: 'networkidle' })
  // Seeds a chapter if the active project is empty (two-doors) and normalizes body.
  await ensureDraftReady(page, { body: 'Aria opened the iron door.' })
  const manuscript = page.getByRole('main', { name: 'Draft' })
  const body = manuscript.getByLabel('Chapter text')
  await manuscript.waitFor()
  const companion = companionPanel(page)

  const emergencyDraft = `Unsaved reload recovery ${Date.now()}`
  await fillChapterAndSave(page, emergencyDraft)
  await page.reload({ waitUntil: 'networkidle' })
  await manuscript.waitFor()
  await body.waitFor()
  if (await body.inputValue() !== emergencyDraft) throw new Error('Pending draft was lost on reload after save')

  const source = 'Aria opened the iron door. Kael waited outside.'
  await fillChapterAndSave(page, source)
  await body.evaluate((element) => {
    const textarea = element
    textarea.focus()
    textarea.setSelectionRange(5, 25)
    textarea.dispatchEvent(new Event('select', { bubbles: true }))
    textarea.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
  })

  // Co-write tools live on the Write face (not the default Chat face).
  await openCompanionFace(companion, 'Write')
  await companion.getByRole('button', { name: 'Continue' }).click()
  const apply = companion.getByRole('button', { name: /^Apply$/i })
  await apply.waitFor({ timeout: LLM_UI_TIMEOUT_MS })
  if (await body.inputValue() !== source) throw new Error('Generation changed manuscript before Apply')
  await apply.click()
  await page.waitForFunction(
    ({ selector, original }) => document.querySelector(selector)?.value !== original,
    { selector: 'main[aria-label="Draft"] textarea', original: source },
    { timeout: 10000 },
  )
  await waitSaved(page)

  const beforeDismiss = await body.inputValue()
  await body.evaluate((element) => {
    const textarea = element
    textarea.focus()
    textarea.setSelectionRange(textarea.value.length, textarea.value.length)
    textarea.dispatchEvent(new Event('select', { bubbles: true }))
    textarea.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
  })
  await openCompanionFace(companion, 'Write')
  await companion.getByRole('button', { name: 'Continue' }).click()
  await companion.getByRole('button', { name: 'Dismiss' }).waitFor({ timeout: LLM_UI_TIMEOUT_MS })
  await companion.getByRole('button', { name: 'Dismiss' }).click()
  if (await body.inputValue() !== beforeDismiss) throw new Error('Dismiss changed manuscript')

  const generatedControls = await manuscript.getByRole('button', {
    name: /continue|rewrite|brainstorm|insert at cursor|replace selection|^apply$/i,
  }).count()
  if (generatedControls !== 0) throw new Error(`Found ${generatedControls} generated controls in manuscript`)

  await page.getByRole('button', { name: 'Focus mode' }).click()
  if (await page.locator('.shell').getAttribute('data-focus') !== 'true') throw new Error('Focus mode did not activate')
  await page.getByRole('button', { name: 'Exit focus mode' }).click()

  await page.screenshot({ path: 'e2e/output/slice-e-smoke.png', fullPage: true })
  console.log('PASS: generation is panel-only; Apply inserts; Dismiss discards; editor has no gen controls; Focus round-trip')
} finally {
  clearHardTimeout()
  await browser.close()
}
