import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { mkdirSync } from 'node:fs'
import {
  companionPanel,
  openCompanionFace,
  ensureCompanionOpen,
  ensureIsolatedProject,
  reclaimIsolatedProject,
  assertActiveProject,
  requireApiOrigin,
  requireUiOrigin,
  setApiBase,
  reloadApp,
  PRECONDITION_TIMEOUT_MS,
} from './helpers.mjs'
import { makeStep } from './step-label.mjs'

const require = createRequire('D:/npm-global/node_modules/playwright/package.json')
const pwRoot = dirname(require.resolve('playwright/package.json'))
const { chromium } = await import(pathToFileURL(resolve(pwRoot, 'index.mjs')).href)
mkdirSync('e2e/output', { recursive: true })

const stamp = Date.now()
const tag = stamp.toString(36).slice(-4)
const cardTitle = `Siege gate-${tag}`
const step = makeStep('slice-l')

if (process.env.STORYLINT_API) setApiBase(process.env.STORYLINT_API)
const API = requireApiOrigin()
const UI = requireUiOrigin()
const browser = await chromium.launch({ channel: 'msedge', headless: true })
let projectId = null
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  step('mint')
  projectId = await ensureIsolatedProject(page, {
    id: `e2e-slice-l-${process.pid}-${stamp.toString(36)}`,
    title: 'Slice L Lab',
  })
  step('goto')
  // Never networkidle — companion/LLM sockets keep owned stacks busy (~30s burn).
  await page.goto(UI, { waitUntil: 'domcontentloaded', timeout: 30_000 })
  await page.getByLabel('Active project').waitFor({ state: 'attached', timeout: PRECONDITION_TIMEOUT_MS })
  await reclaimIsolatedProject(projectId)
  await assertActiveProject(projectId, { page })
  await reloadApp(page, {
    ready: async (p) => {
      await p.getByLabel('Active project').waitFor({ state: 'attached', timeout: PRECONDITION_TIMEOUT_MS })
      const selected = await p.evaluate(() => {
        const el = document.querySelector('select[aria-label="Active project"]')
        return el?.value || null
      })
      if (selected && selected !== projectId) {
        await p.getByLabel('Active project').selectOption(projectId)
      }
    },
  })
  await reclaimIsolatedProject(projectId)

  step('open lab')
  await page.getByRole('button', { name: 'Lab', exact: true }).click()
  const lab = page.getByRole('main', { name: 'Lab' })
  await lab.waitFor({ timeout: PRECONDITION_TIMEOUT_MS })
  await lab.getByRole('heading', { name: 'Lab' }).waitFor({ timeout: PRECONDITION_TIMEOUT_MS })

  step('companion faces')
  await ensureCompanionOpen(page)
  const companion = companionPanel(page)
  await openCompanionFace(companion, 'Spark', { require: true })
  await openCompanionFace(companion, 'Chat', { require: true })

  step('create card')
  await lab.getByLabel('New lab card').locator('summary').click()
  await lab.getByLabel('New card kind').getByRole('button', { name: 'Place', exact: true }).click()
  await lab.getByLabel('Lab card title').fill(cardTitle)
  await lab.getByLabel('Lab card body').fill('Outer arch where the first breach happens. Not canon.')
  await lab.getByLabel('New lab card').getByRole('button', { name: 'New card' }).click()
  await lab.getByRole('heading', { name: cardTitle }).waitFor({ timeout: 5000 })

  const card = lab.locator('.lab__card').filter({ hasText: cardTitle })
  await card.getByRole('button', { name: 'Pin' }).click()
  await card.getByText('Pinned').waitFor({ timeout: 5000 })

  step('promote')
  const sheetsBefore = await page.request.get(`${API}/api/project`).then(async (response) => {
    if (!response.ok()) throw new Error(`project load failed: ${response.status()}`)
    const project = await response.json()
    return project.sheets.length
  })
  await card.getByRole('button', { name: 'Promote to Canon' }).click()
  await lab.getByText(/Promote to Canon queued a sheet proposal/i).waitFor({ timeout: 5000 })
  await lab.getByRole('heading', { name: 'Promoted' }).waitFor({ timeout: PRECONDITION_TIMEOUT_MS })

  const after = await page.request.get(`${API}/api/project`).then(async (response) => {
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

  step('graph ignore lab')
  await page.getByRole('button', { name: 'Canon', exact: true }).click()
  const graph = page.getByRole('main', { name: 'Relationship graph' })
  await graph.waitFor({ timeout: PRECONDITION_TIMEOUT_MS })
  if (await graph.getByText(cardTitle).count()) {
    throw new Error('Graph rendered a Lab card title as a node')
  }

  await page.getByRole('button', { name: 'Lab', exact: true }).click()
  await lab.waitFor({ timeout: PRECONDITION_TIMEOUT_MS })
  await page.screenshot({ path: 'e2e/output/slice-l-lab.png', fullPage: true })

  // Binder Lab section is h3.panel__label — optional observation, never unbounded.
  const binder = page.locator('.panel').filter({ has: page.getByRole('heading', { name: 'Binder' }) })
  if (await binder.count()) {
    const labHead = binder.getByRole('heading', { name: 'Lab' })
    if (await labHead.count()) {
      await labHead.first().waitFor({ state: 'attached', timeout: 3000 }).catch(() => {})
    }
  }

  await reclaimIsolatedProject(projectId)
  await page.close()
  step('PASS')
  console.log('PASS: Lab bench create/pin/promote pre-canon, Companion faces, Graph ignores Lab, screenshot')
} finally {
  await browser.close()
}
