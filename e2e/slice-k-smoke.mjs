import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { mkdirSync } from 'node:fs'
import { closeSheetDetail, companionPanel, openCompanionFace } from './helpers.mjs'
import { openProposeEditor } from './constants.mjs'

const require = createRequire('D:/npm-global/node_modules/playwright/package.json')
const pwRoot = dirname(require.resolve('playwright/package.json'))
const { chromium } = await import(pathToFileURL(resolve(pwRoot, 'index.mjs')).href)
mkdirSync('e2e/output', { recursive: true })

const stamp = Date.now()
const tag = stamp.toString(36).slice(-4)
const parentId = `k2-parent-${stamp}`
const childId = `k2-child-${stamp}`
const parentName = `Mira Parent-${tag}`
const childName = `Kael-${tag}`

async function seedCharacters(request) {
  for (const sheet of [
    {
      id: parentId, kind: 'character', name: parentName, aliases: [], summary: '', notes: '', portrait: 'P',
      facts: [],
    },
    {
      id: childId, kind: 'character', name: childName, aliases: [], summary: '', notes: '', portrait: 'C',
      facts: [],
    },
  ]) {
    const response = await request.put(`http://127.0.0.1:4174/api/sheets/${sheet.id}`, {
      data: sheet,
      headers: { 'content-type': 'application/json' },
    })
    if (!response.ok()) throw new Error(`Failed to seed sheet ${sheet.id}: ${response.status()}`)
  }
}

async function proposeAndAccept(page) {
  await page.getByRole('button', { name: 'Canon' }).click()
  const graph = page.getByRole('main', { name: 'Relationship graph' })
  await graph.waitFor()
  // D4: Propose is collapsed by default at every width — open it before touching fields.
  await openProposeEditor(graph)
  const selects = graph.locator('.graph__editor select')
  await selects.nth(0).selectOption(parentId)
  await selects.nth(1).selectOption(childId)
  const statement = `${parentName} is parent of ${childName}`
  await graph.getByPlaceholder('father_of, member_of, rival…').fill('parent_of')
  await graph.getByPlaceholder('Aria is a member of the Ember Order').fill(statement)
  const edgesBefore = await graph.locator('.graph__edge').count()
  await graph.getByRole('button', { name: 'Send proposal' }).click()
  await graph.getByText(/pending in the agent panel/i).waitFor({ timeout: 5000 })
  if (await graph.locator('.graph__edge').count() !== edgesBefore) {
    throw new Error('Pending kinship edge rendered before Accept')
  }
  const companion = companionPanel(page)
  await openCompanionFace(companion, 'Inbox')
  const card = companion.locator('.proposal-card').filter({ hasText: statement })
  await card.getByRole('button', { name: 'Accept' }).click()
  await graph.locator('title', { hasText: 'parent_of' }).first().waitFor({ state: 'attached', timeout: 5000 })
  return graph
}

const browser = await chromium.launch({ channel: 'msedge', headless: true })
try {
  const desktop = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  await seedCharacters(desktop.request)
  await desktop.goto('http://localhost:5173/', { waitUntil: 'networkidle' })
  await desktop.reload({ waitUntil: 'networkidle' })
  const graph = await proposeAndAccept(desktop)
  await graph.getByRole('button', { name: 'Family', exact: true }).click()
  await graph.locator('.graph__family-stage').waitFor({ timeout: 5000 })
  const familyNodes = graph.locator('.graph__node--family')
  if (await familyNodes.count() < 2) throw new Error('Family view did not render character nodes')
  await familyNodes.first().click()
  await desktop.getByLabel('Name').waitFor({ timeout: 5000 })
  await closeSheetDetail(desktop)
  await graph.getByRole('button', { name: 'Network', exact: true }).click()
  await graph.locator('svg.graph__canvas').first().waitFor()
  await desktop.screenshot({ path: 'e2e/output/slice-k-desktop.png', fullPage: true })

  const narrow = await browser.newPage({ viewport: { width: 1024, height: 900 } })
  await narrow.goto('http://localhost:5173/', { waitUntil: 'networkidle' })
  await narrow.getByRole('button', { name: 'Canon' }).click()
  const narrowGraph = narrow.getByRole('main', { name: 'Relationship graph' })
  await narrowGraph.waitFor()
  await narrowGraph.getByRole('button', { name: 'Family', exact: true }).click()
  await narrowGraph.locator('.graph__family-stage').waitFor({ timeout: 5000 })
  await narrow.setViewportSize({ width: 767, height: 900 })
  await narrow.screenshot({ path: 'e2e/output/slice-k-narrow.png', fullPage: true })
  await narrow.close()
  await desktop.close()
  console.log('PASS: family tree view, node open sheet, network toggle, pending-until-Accept, desktop+narrow screenshots')
} finally {
  await browser.close()
}
