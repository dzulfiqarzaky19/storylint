/**
 * MUT-2 wiring check (hawk/rat T-001 follow-on).
 *
 * Proves LabBench.promote() call site, not just needsChapterPromoteConfirm's truth table.
 * MUT-2 class defect: call site reverts to kind-only `if (card.kind === 'beat')` while the
 * helper stays correct → pure helper tests still pass; THIS smoke must go red.
 *
 * Assertions:
 *  - model beat → confirm dialog opens; Cancel creates nothing; Create stores confirmed title
 *  - author beat → NO confirm; one-click chapter stub with card title
 */
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { mkdirSync } from 'node:fs'
import {
  ensureIsolatedProject,
  reclaimIsolatedProject,
  assertActiveProject,
  requireApiOrigin,
  requireUiOrigin,
  setApiBase,
  reloadApp,
  PRECONDITION_TIMEOUT_MS,
} from './helpers.mjs'

const require = createRequire('D:/npm-global/node_modules/playwright/package.json')
const pwRoot = dirname(require.resolve('playwright/package.json'))
const { chromium } = await import(pathToFileURL(resolve(pwRoot, 'index.mjs')).href)
mkdirSync('e2e/output', { recursive: true })

const stamp = Date.now()
const tag = stamp.toString(36).slice(-4)
const modelTitle = `Model siege-${tag}`
const authorTitle = `Author beat-${tag}`
const confirmedTitle = `Confirmed night-${tag}`
const STEP_T0 = Date.now()
function step(label) {
  process.stdout.write(`[t001-wiring +${Date.now() - STEP_T0}ms] ${label}\n`)
}

function fail(message) {
  throw new Error(message)
}

async function loadProject(page, api) {
  const response = await page.request.get(`${api}/api/project`)
  if (!response.ok()) fail(`project load failed: ${response.status()}`)
  return response.json()
}

async function openLab(page) {
  await page.getByRole('button', { name: 'Lab', exact: true }).click()
  const lab = page.getByRole('main', { name: 'Lab' })
  await lab.waitFor({ timeout: PRECONDITION_TIMEOUT_MS })
  await lab.getByRole('heading', { name: 'Lab' }).waitFor({ timeout: PRECONDITION_TIMEOUT_MS })
  return lab
}

async function chooseKind(lab, kindName) {
  const composer = lab.getByLabel('New lab card')
  await composer.locator('summary').click()
  await lab.getByLabel('New card kind').getByRole('button', { name: kindName, exact: true }).click()
}

async function createCard(lab, { kind, title, body }) {
  await chooseKind(lab, kind)
  await lab.getByLabel('Lab card title').fill(title)
  await lab.getByLabel('Lab card body').fill(body)
  await lab.getByLabel('New lab card').getByRole('button', { name: 'New card' }).click()
  await lab.getByRole('heading', { name: title }).waitFor({ timeout: 5000 })
  return lab.locator('.lab__card').filter({ hasText: title })
}

/**
 * Author-created cards are source=author. Force source=model via API patch is not available
 * (source is create-time / flip-on-edit). Seed model card through POST body { source: 'model' }.
 */
async function createModelBeatViaApi(page, api, { title, body }) {
  const response = await page.request.post(`${api}/api/lab/cards`, {
    data: { kind: 'beat', title, body, source: 'model' },
  })
  if (!response.ok()) fail(`create model beat failed: ${response.status()} ${await response.text()}`)
  return response.json()
}

if (process.env.STORYLINT_API) setApiBase(process.env.STORYLINT_API)
const API = requireApiOrigin()
const UI = requireUiOrigin()
const browser = await chromium.launch({ channel: 'msedge', headless: true })
let projectId = null
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  step('mint')
  projectId = await ensureIsolatedProject(page, {
    id: `e2e-t001-wiring-${process.pid}-${stamp.toString(36)}`,
    title: 'T-001 confirm wiring',
  })
  step('goto')
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

  const lab = await openLab(page)

  // ── Model beat: confirm must open (wiring reads source, not kind alone) ──
  step('seed model beat via API')
  await createModelBeatViaApi(page, API, {
    title: modelTitle,
    body: 'LLM invented this beat title',
  })
  // API write bypasses React state — full reload so LabBench sees source=model card.
  await reloadApp(page, {
    ready: async (p) => {
      await p.getByLabel('Active project').waitFor({ state: 'attached', timeout: PRECONDITION_TIMEOUT_MS })
    },
  })
  await reclaimIsolatedProject(projectId)
  await openLab(page)
  const modelCard = lab.locator('.lab__card').filter({ hasText: modelTitle })
  await modelCard.waitFor({ timeout: 5000 })
  // Quiet Spark chip proves UI received source=model
  if ((await modelCard.getByText('Spark', { exact: true }).count()) < 1) {
    fail('model beat missing Spark provenance chip — source not on card')
  }

  const beforeModel = await loadProject(page, API)
  const chaptersBeforeModel = beforeModel.chapters.length
  const proposalsBeforeModel = beforeModel.proposals.length

  step('model beat → Send to Draft opens confirm')
  await modelCard.getByRole('button', { name: 'Send to Draft' }).click()
  const confirm = lab.getByRole('dialog', { name: 'Confirm chapter title' })
  await confirm.waitFor({ timeout: 5000 })
  if ((await confirm.getByText('From Spark').count()) < 1) {
    fail('confirm missing From Spark source line')
  }
  if ((await confirm.getByText(/Body will be an empty stub/i).count()) < 1) {
    fail('confirm missing empty-body line')
  }

  step('Cancel creates nothing')
  await confirm.getByRole('button', { name: 'Cancel' }).click()
  await confirm.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {})
  // Dialog should be gone
  if (await confirm.isVisible().catch(() => false)) {
    fail('confirm still visible after Cancel')
  }
  const afterCancel = await loadProject(page, API)
  if (afterCancel.chapters.length !== chaptersBeforeModel) {
    fail(`Cancel created chapters: before=${chaptersBeforeModel} after=${afterCancel.chapters.length}`)
  }
  if (afterCancel.proposals.length !== proposalsBeforeModel) {
    fail('Cancel mutated proposals')
  }
  const stillActive = afterCancel.lab.cards.find((card) => card.title === modelTitle)
  if (!stillActive || stillActive.status !== 'active') {
    fail(`Cancel changed card status to ${stillActive?.status}`)
  }

  step('model beat → Create chapter with confirmed title')
  await modelCard.getByRole('button', { name: 'Send to Draft' }).click()
  await confirm.waitFor({ timeout: 5000 })
  await confirm.getByLabel('Chapter title').fill(confirmedTitle)
  await confirm.getByRole('button', { name: 'Create chapter' }).click()
  // Shell may navigate to manuscript on chapter-stub — assert via API, not Lab notice.
  await page.waitForFunction(async (wantTitle) => {
    try {
      const res = await fetch('/api/project')
      if (!res.ok) return false
      const project = await res.json()
      return project.chapters.some((chapter) => chapter.title === wantTitle)
    } catch {
      return false
    }
  }, confirmedTitle, { timeout: 8000 })
  const afterCreate = await loadProject(page, API)
  if (afterCreate.chapters.length !== chaptersBeforeModel + 1) {
    fail(`Create did not add chapter: before=${chaptersBeforeModel} after=${afterCreate.chapters.length}`)
  }
  const created = afterCreate.chapters.find((chapter) => chapter.title === confirmedTitle)
  if (!created) fail(`chapter title not stored as confirmed: want ${confirmedTitle}`)
  if (created.body !== '') fail('chapter body must be empty stub')
  const promotedModel = afterCreate.lab.cards.find((card) => card.title === modelTitle)
  if (!promotedModel || promotedModel.status !== 'promoted') {
    fail('model card not marked promoted after Create')
  }
  // ── Author beat: NO confirm — one-click stub with card title ──
  // Return to Lab (Create may have navigated to Draft).
  await openLab(page)
  // MUT-2 killer: if call site is kind-only, confirm opens here and this fails.
  step('author beat one-click (no confirm)')
  const authorCard = await createCard(lab, {
    kind: 'Beat',
    title: authorTitle,
    body: 'I typed this myself',
  })
  // Author cards have no Spark chip
  if ((await authorCard.getByText('Spark', { exact: true }).count()) > 0) {
    fail('author beat incorrectly shows Spark chip')
  }
  const beforeAuthor = await loadProject(page, API)
  const chaptersBeforeAuthor = beforeAuthor.chapters.length

  await authorCard.getByRole('button', { name: 'Send to Draft' }).click()

  // Confirm must NOT appear. Short race window — if it opens, wiring is kind-only (MUT-2).
  const confirmAppeared = await lab
    .getByRole('dialog', { name: 'Confirm chapter title' })
    .waitFor({ state: 'visible', timeout: 1200 })
    .then(() => true)
    .catch(() => false)
  if (confirmAppeared) {
    fail(
      'MUT-2: author beat opened chapter confirm — LabBench.promote() is kind-only or not using needsChapterPromoteConfirm',
    )
  }

  // Shell may leave Lab for manuscript — wait for chapter via API.
  await page.waitForFunction(async (wantTitle) => {
    try {
      const res = await fetch('/api/project')
      if (!res.ok) return false
      const project = await res.json()
      return project.chapters.some((chapter) => chapter.title === wantTitle)
    } catch {
      return false
    }
  }, authorTitle, { timeout: 8000 })
  const afterAuthor = await loadProject(page, API)
  if (afterAuthor.chapters.length !== chaptersBeforeAuthor + 1) {
    fail(`author promote did not add chapter: before=${chaptersBeforeAuthor} after=${afterAuthor.chapters.length}`)
  }
  const authorChapter = afterAuthor.chapters.find((chapter) => chapter.title === authorTitle)
  if (!authorChapter) {
    fail(`author one-click did not store card title as chapter title (want ${authorTitle})`)
  }
  if (authorChapter.body !== '') fail('author chapter body must be empty')
  const promotedAuthor = afterAuthor.lab.cards.find((card) => card.title === authorTitle)
  if (!promotedAuthor || promotedAuthor.status !== 'promoted') {
    fail('author card not marked promoted')
  }

  await reclaimIsolatedProject(projectId)
  await page.close()
  step('PASS')
  console.log(
    'PASS: T-001 wiring — model beat confirms (Cancel none / Create title); author beat one-click no confirm',
  )
} finally {
  await browser.close()
}
