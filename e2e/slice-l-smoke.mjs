import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { mkdirSync } from 'node:fs'
import { companionPanel, openCompanionFace } from './helpers.mjs'

const require = createRequire('D:/npm-global/node_modules/playwright/package.json')
const pwRoot = dirname(require.resolve('playwright/package.json'))
const { chromium } = await import(pathToFileURL(resolve(pwRoot, 'index.mjs')).href)
mkdirSync('e2e/output', { recursive: true })

const stamp = Date.now()
const tag = stamp.toString(36).slice(-4)
const cardTitle = `Siege gate-${tag}`

const browser = await chromium.launch({ channel: 'msedge', headless: true })
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' })

  await page.getByRole('button', { name: 'Lab', exact: true }).click()
  const lab = page.getByRole('main', { name: 'Lab' })
  await lab.waitFor()
  await lab.getByRole('heading', { name: 'Lab' }).waitFor()

  // Companion faces in Lab context: Chat / Spark / Inbox (D6 uses role=tab)
  const companion = companionPanel(page)
  await openCompanionFace(companion, 'Spark')
  await openCompanionFace(companion, 'Chat')

  await lab.getByLabel('New card kind').getByRole('button', { name: 'Place', exact: true }).click()
  await lab.getByLabel('Lab card title').fill(cardTitle)
  await lab.getByLabel('Lab card body').fill('Outer arch where the first breach happens. Not canon.')
  await lab.getByLabel('New lab card').getByRole('button', { name: 'New card' }).click()
  await lab.getByRole('heading', { name: cardTitle }).waitFor({ timeout: 5000 })

  const card = lab.locator('.lab__card').filter({ hasText: cardTitle })
  await card.getByRole('button', { name: 'Pin' }).click()
  await card.getByText('Pinned').waitFor({ timeout: 5000 })

  // Promote → pending proposal only (bible unchanged until Accept)
  const sheetsBefore = await page.request.get('http://127.0.0.1:4174/api/project').then(async (response) => {
    if (!response.ok()) throw new Error(`project load failed: ${response.status()}`)
    const project = await response.json()
    return project.sheets.length
  })
  await card.getByRole('button', { name: 'Promote to Canon' }).click()
  await lab.getByText(/Promote to Canon queued a sheet proposal/i).waitFor({ timeout: 5000 })
  await lab.getByRole('heading', { name: 'Promoted' }).waitFor()

  const after = await page.request.get('http://127.0.0.1:4174/api/project').then(async (response) => {
    if (!response.ok()) throw new Error(`project load failed: ${response.status()}`)
    return response.json()
  })
  if (after.sheets.length !== sheetsBefore) {
    throw new Error('Promote to Canon wrote sheets without Accept')
  }
  const pending = after.proposals.filter((proposal) => proposal.status === 'pending' && proposal.entityName === cardTitle)
  if (pending.length === 0) throw new Error('Promote to Canon did not create pending proposals')
  const promoted = after.lab.cards.find((cardRow) => cardRow.title === cardTitle)
  if (!promoted || promoted.status !== 'promoted') throw new Error('Lab card not marked promoted')

  // Graph ignores Lab: no lab card titles as nodes
  await page.getByRole('button', { name: 'Canon', exact: true }).click()
  const graph = page.getByRole('main', { name: 'Relationship graph' })
  await graph.waitFor()
  if (await graph.getByText(cardTitle).count()) {
    throw new Error('Graph rendered a Lab card title as a node')
  }

  await page.getByRole('button', { name: 'Lab', exact: true }).click()
  await lab.waitFor()
  await page.screenshot({ path: 'e2e/output/slice-l-lab.png', fullPage: true })

  // Binder Lab entry
  const binder = page.locator('.panel').filter({ has: page.getByRole('heading', { name: 'Binder' }) })
  if (await binder.count()) {
    await binder.getByRole('heading', { name: 'Lab' }).waitFor()
  }

  await page.close()
  console.log('PASS: Lab bench create/pin/promote pre-canon, Companion faces, Graph ignores Lab, screenshot')
} finally {
  await browser.close()
}
