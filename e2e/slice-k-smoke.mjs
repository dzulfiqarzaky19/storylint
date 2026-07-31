import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { mkdirSync } from 'node:fs'
import {
  reloadApp,
  closeSheetDetail,
  companionPanel,
  openCompanionFace,
  ensureCompanionOpen,
  ensureIsolatedProject,
  reclaimIsolatedProject,
  assertActiveProject,
  getApiBase,
  requireApiOrigin,
  requireUiOrigin,
  setApiBase,
  PRECONDITION_TIMEOUT_MS,
} from './helpers.mjs'
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
const STEP_T0 = Date.now()
function step(label) {
  // Sync write so a stall after this line still leaves the label on the pipe
  // before Playwright's bare timeout kills the process (E1 stall-proof).
  process.stdout.write(`[slice-k +${Date.now() - STEP_T0}ms] ${label}\n`)
}

/** First nav and reload: never networkidle on owned stacks (companion/LLM sockets). */
async function gotoApp(page, ui) {
  await page.goto(ui, { waitUntil: 'domcontentloaded', timeout: 30_000 })
  await page.getByLabel('Active project').waitFor({ state: 'attached', timeout: PRECONDITION_TIMEOUT_MS })
}

async function seedCharacters(request) {
  const api = getApiBase()
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
    const response = await request.put(`${api}/api/sheets/${sheet.id}`, {
      data: sheet,
      headers: { 'content-type': 'application/json' },
    })
    if (!response.ok()) throw new Error(`Failed to seed sheet ${sheet.id}: ${response.status()}`)
  }
}

async function proposeAndAccept(page) {
  step('canon click')
  await page.getByRole('button', { name: 'Canon' }).click()
  const graph = page.getByRole('main', { name: 'Relationship graph' })
  await graph.waitFor({ timeout: PRECONDITION_TIMEOUT_MS })
  step('propose editor')
  await openProposeEditor(graph)
  const selects = graph.locator('.graph__editor select')
  await selects.nth(0).selectOption(parentId)
  await selects.nth(1).selectOption(childId)
  const statement = `${parentName} is parent of ${childName}`
  await graph.getByPlaceholder('father_of, member_of, rival…').fill('parent_of')
  await graph.getByPlaceholder('Aria is a member of the Ember Order').fill(statement)
  const edgesBefore = await graph.locator('.graph__edge').count()
  await graph.getByRole('button', { name: 'Send proposal' }).click()
  await graph.getByText(/proposal is pending/i).waitFor({ timeout: 5000 })
  if (await graph.locator('.graph__edge').count() !== edgesBefore) {
    throw new Error('Pending kinship edge rendered before Accept')
  }
  step('companion inbox accept')
  await ensureCompanionOpen(page)
  const companion = companionPanel(page)
  await openCompanionFace(companion, 'Inbox', { require: true })
  const card = companion.locator('.proposal-card').filter({ hasText: statement })
  await card.getByRole('button', { name: 'Accept' }).click()
  await graph.locator('title', { hasText: 'parent_of' }).first().waitFor({ state: 'attached', timeout: 5000 })
  return graph
}

if (process.env.STORYLINT_API) setApiBase(process.env.STORYLINT_API)
requireApiOrigin()
const UI = requireUiOrigin()
const browser = await chromium.launch({ channel: 'msedge', headless: true })
let projectId = null
try {
  const desktop = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  // Own private project BEFORE any API write (lie 11 — never seed ambient/default).
  step('mint')
  projectId = await ensureIsolatedProject(desktop, {
    id: `e2e-slice-k-${process.pid}-${stamp.toString(36)}`,
    title: 'Slice K Family',
  })
  step('seed')
  await seedCharacters(desktop.request)
  step('goto desktop')
  await gotoApp(desktop, UI)
  await reclaimIsolatedProject(projectId)
  await assertActiveProject(projectId, { page: desktop })
  // Force select attached after activate (UI may have mounted on prior active).
  await reloadApp(desktop, {
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
  step('propose+accept')
  const graph = await proposeAndAccept(desktop)
  step('family view')
  await graph.getByRole('button', { name: 'Family', exact: true }).click()
  await graph.locator('.graph__family-stage').waitFor({ timeout: 5000 })
  const familyNodes = graph.locator('.graph__node--family')
  if (await familyNodes.count() < 2) throw new Error('Family view did not render character nodes')
  await familyNodes.first().click()
  await desktop.getByLabel('Name').waitFor({ timeout: 5000 })
  await closeSheetDetail(desktop)
  await graph.getByRole('button', { name: 'Network', exact: true }).click()
  await graph.locator('svg.graph__canvas').first().waitFor({ timeout: PRECONDITION_TIMEOUT_MS })
  await desktop.screenshot({ path: 'e2e/output/slice-k-desktop.png', fullPage: true })

  step('narrow page')
  const narrow = await browser.newPage({ viewport: { width: 1024, height: 900 } })
  await gotoApp(narrow, UI)
  await reclaimIsolatedProject(projectId)
  await assertActiveProject(projectId)
  // Sync UI select if shell still shows prior project.
  try {
    const sel = narrow.getByLabel('Active project')
    if (await sel.count()) {
      const v = await sel.inputValue().catch(() => null)
      if (v && v !== projectId) await sel.selectOption(projectId)
    }
  } catch { /* ignore */ }
  await narrow.getByRole('button', { name: 'Canon' }).click()
  const narrowGraph = narrow.getByRole('main', { name: 'Relationship graph' })
  await narrowGraph.waitFor({ timeout: PRECONDITION_TIMEOUT_MS })
  await narrowGraph.getByRole('button', { name: 'Family', exact: true }).click()
  await narrowGraph.locator('.graph__family-stage').waitFor({ timeout: 5000 })
  await narrow.setViewportSize({ width: 767, height: 900 })
  await narrow.screenshot({ path: 'e2e/output/slice-k-narrow.png', fullPage: true })
  await narrow.close()
  // End on our mint so all-smoke runtime check sees owned active id.
  await reclaimIsolatedProject(projectId)
  await desktop.close()
  step('PASS')
  console.log('PASS: family tree view, node open sheet, network toggle, pending-until-Accept, desktop+narrow screenshots')
} finally {
  await browser.close()
}
