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
  const manuscript = page.getByRole('main', { name: 'Manuscript' })
  const body = manuscript.getByLabel('Chapter text')
  await manuscript.waitFor()

  const source = 'Aria opened the iron door. Kael waited outside.'
  await body.fill(source)
  await page.getByText('Saved').waitFor({ timeout: 5000 })
  await body.focus()
  await body.press('Home')
  await body.press('ArrowRight')
  await body.press('ArrowRight')
  await body.press('ArrowRight')
  await body.press('ArrowRight')
  await body.press('ArrowRight')
  for (let i = 0; i < 20; i += 1) await body.press('Shift+ArrowRight')

  await page.getByRole('button', { name: 'Rewrite selection' }).click()
  const replace = page.getByRole('button', { name: 'Replace selection' })
  await replace.waitFor({ timeout: 10000 })
  if (await body.inputValue() !== source) throw new Error('Generation changed manuscript before Apply')
  await replace.click()
  await page.waitForFunction(
    ({ selector, original }) => document.querySelector(selector)?.value !== original,
    { selector: 'main[aria-label="Manuscript"] textarea', original: source },
    { timeout: 10000 },
  )
  await page.getByText('Saved').waitFor({ timeout: 5000 })

  const beforeDismiss = await body.inputValue()
  await body.evaluate((element) => {
    const textarea = element
    textarea.focus()
    textarea.setSelectionRange(textarea.value.length, textarea.value.length)
    textarea.dispatchEvent(new Event('select', { bubbles: true }))
  })
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.getByRole('button', { name: 'Dismiss' }).waitFor({ timeout: 10000 })
  await page.getByRole('button', { name: 'Dismiss' }).click()
  if (await body.inputValue() !== beforeDismiss) throw new Error('Dismiss changed manuscript')

  const generatedControls = await manuscript.getByRole('button', {
    name: /continue|rewrite|brainstorm|insert at cursor|replace selection|apply/i,
  }).count()
  if (generatedControls !== 0) throw new Error(`Found ${generatedControls} generated controls in manuscript`)

  await page.getByRole('button', { name: 'Focus mode' }).click()
  if (await page.locator('.shell').getAttribute('data-focus') !== 'true') throw new Error('Focus mode did not activate')
  await page.getByRole('button', { name: 'Exit focus mode' }).click()

  await page.screenshot({ path: 'e2e/output/slice-e-smoke.png', fullPage: true })
  console.log('PASS: generation is panel-only; Replace applies; Dismiss discards; editor has no gen controls; Focus round-trip')
} finally {
  await browser.close()
}
