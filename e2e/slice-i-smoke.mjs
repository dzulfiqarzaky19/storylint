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
  const manuscriptBody = await page.getByRole('main', { name: 'Manuscript' }).getByLabel('Chapter text').inputValue()
  await page.getByRole('button', { name: 'Graph' }).click()
  const graph = page.getByRole('main', { name: 'Relationship graph' })
  await graph.waitFor()
  const nodesBefore = await graph.locator('.graph__node').count()
  if (nodesBefore < 2) throw new Error('Graph needs at least two bible sheets')

  const firstNode = graph.locator('.graph__node').first()
  const firstName = await firstNode.locator('.graph__label').textContent()
  await firstNode.click()
  await page.getByLabel('Name').waitFor({ timeout: 5000 })
  if (await page.getByLabel('Name').inputValue() !== firstName) throw new Error('Node did not open its sheet')
  await page.getByRole('button', { name: 'Back to binder' }).click()

  await graph.getByRole('button', { name: 'lore', exact: true }).click()
  const nodesFiltered = await graph.locator('.graph__node').count()
  if (nodesFiltered >= nodesBefore) throw new Error('Kind filter did not reduce graph nodes')
  await graph.getByRole('button', { name: 'lore', exact: true }).click()

  const editor = graph.locator('.graph__editor')
  const from = editor.getByLabel('From', { exact: true })
  const to = editor.getByLabel('To', { exact: true })
  const values = await from.locator('option').evaluateAll((options) => options.map((option) => option.value))
  await from.selectOption(values[0])
  await to.selectOption(values[1])
  const key = `rival_smoke_${Date.now()}`
  const statement = `${firstName} rivals ${await to.locator('option:checked').textContent()}`
  await graph.getByRole('textbox', { name: 'Relationship', exact: true }).fill(key)
  await graph.getByRole('textbox', { name: 'Statement', exact: true }).fill(statement)
  const edgesBefore = await graph.locator('.graph__edge').count()
  await graph.getByRole('button', { name: 'Send proposal' }).click()
  await graph.getByText(/pending in the agent panel/i).waitFor({ timeout: 5000 })
  if (await graph.locator('.graph__edge').count() !== edgesBefore) throw new Error('Pending edge rendered before Accept')

  const card = page.locator('.proposal-card').filter({ hasText: statement })
  await card.getByRole('button', { name: 'Accept' }).click()
  await graph.getByText(key).waitFor({ timeout: 5000 })
  if (await page.getByRole('main', { name: 'Manuscript' }).count() !== 0) {
    throw new Error('Graph did not replace the center manuscript surface')
  }
  await page.getByRole('button', { name: 'Editor' }).click()
  if (await page.getByLabel('Chapter text').inputValue() !== manuscriptBody) throw new Error('Graph round-trip changed manuscript')

  await page.screenshot({ path: 'e2e/output/slice-i-smoke.png', fullPage: true })
  console.log('PASS: graph nodes/portrait labels, kind filter, node sheet navigation, pending edge hidden until Accept, editor round-trip')
} finally {
  await browser.close()
}
