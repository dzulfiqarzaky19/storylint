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

async function waitSaved() {
  await page.locator('.project-status', { hasText: 'Saved' }).waitFor({ timeout: 15000 })
}

try {
  // Normalize dogfood chapter so prior smokes' high revisions don't strand the UI on error.
  const project = await (await fetch('http://127.0.0.1:4174/api/project')).json()
  const chapter = project.chapters.find((candidate) => candidate.id === 'chapter-1') ?? project.chapters[0]
  if (!chapter) throw new Error('No chapter-1 to normalize')
  const reset = await fetch(`http://127.0.0.1:4174/api/chapters/${encodeURIComponent(chapter.id)}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      id: chapter.id,
      title: chapter.title || 'Chapter One',
      body: 'Aria opened the iron door.',
      craftTags: chapter.craftTags ?? [],
      revision: chapter.revision,
    }),
  })
  if (!reset.ok) throw new Error(`Failed to normalize chapter: ${reset.status} ${await reset.text()}`)

  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' })
  const manuscript = page.getByRole('main', { name: 'Manuscript' })
  const body = manuscript.getByLabel('Chapter text')
  await manuscript.waitFor()
  const companion = page.locator('.panel').filter({ has: page.getByRole('heading', { name: 'Companion' }) })

  const emergencyDraft = `Unsaved reload recovery ${Date.now()}`
  await body.fill(emergencyDraft)
  await page.reload({ waitUntil: 'networkidle' })
  await manuscript.waitFor()
  if (await body.inputValue() !== emergencyDraft) throw new Error('Pending draft was lost on immediate reload')
  await waitSaved()

  const source = 'Aria opened the iron door. Kael waited outside.'
  await body.fill(source)
  await waitSaved()
  await body.evaluate((element) => {
    const textarea = element
    textarea.focus()
    textarea.setSelectionRange(5, 25)
    textarea.dispatchEvent(new Event('select', { bubbles: true }))
    textarea.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
  })

  await companion.getByRole('button', { name: 'Write', exact: true }).click()
  await companion.getByRole('button', { name: 'Continue' }).click()
  const apply = companion.getByRole('button', { name: /^Apply$/i })
  await apply.waitFor({ timeout: 30000 })
  if (await body.inputValue() !== source) throw new Error('Generation changed manuscript before Apply')
  await apply.click()
  await page.waitForFunction(
    ({ selector, original }) => document.querySelector(selector)?.value !== original,
    { selector: 'main[aria-label="Manuscript"] textarea', original: source },
    { timeout: 10000 },
  )
  await waitSaved()

  const beforeDismiss = await body.inputValue()
  await body.evaluate((element) => {
    const textarea = element
    textarea.focus()
    textarea.setSelectionRange(textarea.value.length, textarea.value.length)
    textarea.dispatchEvent(new Event('select', { bubbles: true }))
    textarea.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
  })
  await companion.getByRole('button', { name: 'Write', exact: true }).click()
  await companion.getByRole('button', { name: 'Continue' }).click()
  await companion.getByRole('button', { name: 'Dismiss' }).waitFor({ timeout: 10000 })
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
  await browser.close()
}
