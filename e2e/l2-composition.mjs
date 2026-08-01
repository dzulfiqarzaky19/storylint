/**
 * L2 story/composition gate.
 *
 *   npm run test:l2
 *   node e2e/l2-composition.mjs
 *
 * L1 (all-smoke / test:green smokes) proves each change in isolation:
 * each feature smoke mints its own project and never shares state with siblings.
 *
 * L2 proves composition: several surfaces share ONE project on an owned stack
 * built from this tree (integrated origin/dev when run for story-close).
 *
 * What this checks that all-smoke does not:
 *   1. Draft body written on project P survives Canon + Lab switches on the same P.
 *   2. A Canon sheet seeded into P survives a later Draft chapter write on the same P
 *      (reverse direction: Draft must not clobber Canon sheets).
 *   3. That sheet is still present after Lab and reload.
 *   4. Server active pointer stays on P across the multi-surface journey
 *      (sibling-container inheritance is an L1 suite concern; sticky shared
 *      state across surfaces is the composition class).
 *
 * Evidence discipline matches test:green:
 *   owned stack, HEAD + shell.css provenance, fail-closed, NOT-MEASURED / precondition = fail.
 * A measurement that cannot name what it measured is not evidence.
 */
import { createRequire } from 'node:module'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import {
  DEFAULT_VIEWPORT,
  HARD_SMOKE_TIMEOUT_MS,
  PRECONDITION_TIMEOUT_MS,
  PreconditionError,
  armHardTimeout,
  assertActiveProject,
  ensureBinderOpen,
  ensureDraftReady,
  ensureIsolatedProject,
  fetchActiveProject,
  fillChapterAndSave,
  getApiBase,
  gotoWorkspace,
  installFixtureLlmRoutes,
  readServerActiveProjectId,
  reclaimIsolatedProject,
  reloadApp,
  restoreActiveProject,
  setApiBase,
  sweepOrphanE2eProjects,
  defaultDataDirectory,
  waitSaved,
} from './helpers.mjs'
import { resolveMeasurementTarget } from './owned-stack.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUT_DIR = resolve(root, 'e2e/output')
const OUT_JSON = resolve(OUT_DIR, 'l2-composition-last.json')
const OUT_MD = resolve(OUT_DIR, 'l2-composition-last.md')

const require = createRequire('D:/npm-global/node_modules/playwright/package.json')
const pwRoot = dirname(require.resolve('playwright/package.json'))
const { chromium } = await import(pathToFileURL(resolve(pwRoot, 'index.mjs')).href)

const clearHardTimeout = armHardTimeout('l2-composition', HARD_SMOKE_TIMEOUT_MS * 2)
mkdirSync(OUT_DIR, { recursive: true })

function fail(message) {
  throw new Error(message)
}

function notMeasured(reason) {
  throw new PreconditionError(`composition NOT-MEASURED: ${reason}`)
}

let stack
try {
  stack = await resolveMeasurementTarget({ root })
} catch (error) {
  console.error('REFUSE: ' + (error instanceof Error ? error.message : String(error)))
  console.error('A measurement that cannot name what it measured is not evidence.')
  process.exit(2)
}

setApiBase(stack.api)
const UI = stack.ui
console.log(
  `[l2] owned=${stack.owned} ui=${stack.ui} api=${stack.api} head=${stack.shortHead} shell=${stack.shellCss?.sha256_12}`,
)

const activeBefore = await readServerActiveProjectId()
console.log(`[l2] active-project before: ${activeBefore}`)

const stamp = Date.now()
const tag = stamp.toString(36).slice(-5)
const projectIdWant = `e2e-l2-${process.pid}-${stamp.toString(36)}`
let chapterBody = `L2 composition draft ${tag} — Aria kept the seal and the corridor in one breath.`
const sheetId = `l2-sheet-${stamp}`
const sheetName = `L2 Mira-${tag}`

const result = {
  gate: 'l2-composition',
  head: stack.head,
  shortHead: stack.shortHead,
  owned: stack.owned,
  ui: stack.ui,
  api: stack.api,
  shellCss: stack.shellCss?.sha256_12 ?? null,
  projectId: null,
  steps: [],
  ok: false,
  error: null,
  startedAt: new Date().toISOString(),
}

function step(name, detail = {}) {
  const row = { name, ok: true, ...detail, atMs: Date.now() - stamp }
  result.steps.push(row)
  console.log(`[l2 +${row.atMs}ms] PASS ${name}${detail.note ? ` — ${detail.note}` : ''}`)
}

const browser = await chromium.launch({ channel: 'msedge', headless: true })
const page = await browser.newPage({ viewport: { ...DEFAULT_VIEWPORT } })

try {
  await installFixtureLlmRoutes(page)

  // One shared container for the whole journey (the composition subject).
  const projectId = await ensureIsolatedProject(page, {
    id: projectIdWant,
    title: 'L2 Composition',
  })
  result.projectId = projectId
  step('mint', { projectId })

  await page.goto(UI, { waitUntil: 'domcontentloaded', timeout: 30_000 })
  await page.getByLabel('Active project').waitFor({ state: 'attached', timeout: PRECONDITION_TIMEOUT_MS })
  await reclaimIsolatedProject(projectId)
  await assertActiveProject(projectId, { page })

  // Surface 1: Draft — write body that later surfaces must not clobber.
  // ensureDraftReady seeds via API; fillChapterAndSave proves UI save path with a distinct body.
  await ensureDraftReady(page, {
    body: `${chapterBody} (seed)`,
    title: `L2 Chapter ${tag}`,
  })
  await fillChapterAndSave(page, chapterBody)
  const draftMain = page.getByRole('main', { name: 'Draft' })
  const body = draftMain.getByLabel('Chapter text')
  await body.waitFor({ timeout: PRECONDITION_TIMEOUT_MS })
  // Prefer Saved chip when it appears; do not fail composition solely on chip copy.
  try {
    await waitSaved(page)
  } catch {
    // fall through to body proof — chip can stay empty after a quiet save
  }
  if ((await body.inputValue()) !== chapterBody) {
    fail('draft body mismatch immediately after save')
  }
  // API proof on same project (composition subject, not ambient).
  const afterDraft = await fetchActiveProject()
  const ch0 = afterDraft.chapters?.[0]
  if (!ch0 || ch0.body !== chapterBody) {
    fail(
      `draft API body mismatch after UI save (chapters=${afterDraft.chapters?.length ?? 0})`,
    )
  }
  step('draft-write', { chars: chapterBody.length })

  // Surface 2: Canon — seed sheet into the SAME active project (API uses server active).
  await reclaimIsolatedProject(projectId)
  const api = getApiBase()
  const seed = await page.request.put(`${api}/api/sheets/${sheetId}`, {
    data: {
      id: sheetId,
      kind: 'character',
      name: sheetName,
      aliases: [],
      summary: 'L2 composition fixture',
      notes: '',
      portrait: 'L',
      facts: [],
    },
    headers: { 'content-type': 'application/json' },
  })
  if (!seed.ok()) {
    fail(`sheet seed failed: ${seed.status()} ${(await seed.text()).slice(0, 200)}`)
  }
  await assertActiveProject(projectId)
  const afterSeed = await fetchActiveProject()
  const seeded = (afterSeed.sheets || []).some((s) => s.id === sheetId && s.name === sheetName)
  if (!seeded) {
    notMeasured(`sheet ${sheetId} missing from active project after PUT (active sheets=${(afterSeed.sheets || []).length})`)
  }
  step('canon-seed-sheet', { sheetId, sheetName })

  // UI must remount project doc after API seed (same class as slice-k seed→goto).
  await reloadApp(page, {
    ready: async (p) => {
      await p.getByLabel('Active project').waitFor({ state: 'attached', timeout: PRECONDITION_TIMEOUT_MS })
    },
  })
  await reclaimIsolatedProject(projectId)
  await assertActiveProject(projectId, { page })

  // Reverse-direction write: Draft chapter save AFTER sheet seed must not wipe Canon.
  // Without this step, a chapter PUT that blanks sheets only hits an empty list and
  // sheet-survived stays green (ordering gap hawk found @ 74a8dc7).
  // Distinct body forces a real chapter PUT (same-body fill can skip network save).
  const postSeedBody = chapterBody + ' Aria kept the sheet name in mind.'
  await gotoWorkspace(page, 'draft', { ensureCompanion: false })
  await fillChapterAndSave(page, postSeedBody)
  await assertActiveProject(projectId, { page })
  const afterDraftRewrite = await fetchActiveProject()
  if ((afterDraftRewrite.chapters?.[0]?.body) !== postSeedBody) {
    fail('draft body mismatch after post-seed chapter rewrite')
  }
  // Journey subject body becomes the post-seed rewrite for later draft-survived.
  chapterBody = postSeedBody
  const sheetAfterDraft = (afterDraftRewrite.sheets || []).find((s) => s.id === sheetId)
  if (!sheetAfterDraft) {
    fail(
      `composition: sheet ${sheetId} missing after post-seed Draft write (sheets=${(afterDraftRewrite.sheets || []).map((s) => s.id).join(',')})`,
    )
  }
  if (sheetAfterDraft.name !== sheetName) {
    fail(`composition: sheet name changed after Draft write want=${sheetName} got=${sheetAfterDraft.name}`)
  }
  step('draft-after-seed', { sheetId })

  await gotoWorkspace(page, 'canon', { ensureCompanion: false })
  const canonMain = page.getByRole('main')
  await canonMain.first().waitFor({ timeout: PRECONDITION_TIMEOUT_MS })
  const canonLabel = await canonMain.first().getAttribute('aria-label')
  if (!canonLabel || !/Relationship graph|Family tree|Canon/i.test(canonLabel)) {
    notMeasured(`Canon main aria-label not composition-ready: ${canonLabel}`)
  }
  await ensureBinderOpen(page)
  // Binder list should name the sheet we just wrote into this project.
  const binderHit = page.getByText(sheetName, { exact: false })
  try {
    await binderHit.first().waitFor({ state: 'visible', timeout: PRECONDITION_TIMEOUT_MS })
  } catch {
    fail(`binder does not show seeded sheet name ${sheetName} on project ${projectId}`)
  }
  step('canon-ui', { main: canonLabel })

  // Surface 3: Lab — switch ecosystem on the same project.
  await gotoWorkspace(page, 'lab', { ensureCompanion: false })
  const labMain = page.getByRole('main', { name: 'Lab' })
  await labMain.waitFor({ timeout: PRECONDITION_TIMEOUT_MS })
  await assertActiveProject(projectId, { page })
  step('lab-ui')

  // Reload: composition must survive shell remount on the same container.
  await reloadApp(page, {
    ready: async (p) => {
      await p.getByLabel('Active project').waitFor({ state: 'attached', timeout: PRECONDITION_TIMEOUT_MS })
    },
  })
  await reclaimIsolatedProject(projectId)
  await assertActiveProject(projectId, { page })
  step('reload-same-project')

  // Prove Draft body still the one we wrote (not empty / not sibling residue).
  await gotoWorkspace(page, 'draft', { ensureCompanion: false })
  await draftMain.getByLabel('Chapter text').waitFor({ timeout: PRECONDITION_TIMEOUT_MS })
  const bodyAfter = await draftMain.getByLabel('Chapter text').inputValue()
  if (bodyAfter !== chapterBody) {
    fail(
      `composition: draft body lost after Canon+Lab+reload — want ${JSON.stringify(chapterBody.slice(0, 48))}… got ${JSON.stringify(bodyAfter.slice(0, 48))}…`,
    )
  }
  step('draft-survived')

  // Prove Canon sheet still on the same project document.
  const afterJourney = await fetchActiveProject()
  const still = (afterJourney.sheets || []).find((s) => s.id === sheetId)
  if (!still) {
    fail(`composition: sheet ${sheetId} missing after Lab+reload (sheets=${(afterJourney.sheets || []).map((s) => s.id).join(',')})`)
  }
  if (still.name !== sheetName) {
    fail(`composition: sheet name changed want=${sheetName} got=${still.name}`)
  }
  const activeFinal = await readServerActiveProjectId()
  if (activeFinal !== projectId) {
    fail(`composition: active drifted want=${projectId} got=${activeFinal}`)
  }
  step('sheet-survived', { active: activeFinal })

  await page.screenshot({ path: resolve(OUT_DIR, 'l2-composition.png'), fullPage: true }).catch(() => {})
  await reclaimIsolatedProject(projectId)
  result.ok = true
  console.log(
    `\nPASS l2-composition head=${stack.shortHead} project=${projectId} steps=${result.steps.length} (draft↔canon↔lab shared container)`,
  )
} catch (error) {
  result.ok = false
  result.error = error instanceof Error ? error.message : String(error)
  const isRefuse =
    error instanceof PreconditionError ||
    /NOT-MEASURED|precondition not met|REFUSE/i.test(result.error)
  console.error(`\nFAIL l2-composition: ${result.error}`)
  result.refuse = isRefuse
  process.exitCode = isRefuse ? 2 : 1
} finally {
  try {
    await browser.close()
  } catch {
    /* ignore */
  }
  try {
    const target = activeBefore || 'default'
    await restoreActiveProject(target)
    const after = await readServerActiveProjectId()
    console.log(`[l2] active-project after restore: ${after}`)
    if (after !== target) {
      console.error(`FAIL l2 bookend: want=${target} got=${after}`)
      result.ok = false
      result.error = (result.error ? result.error + '; ' : '') + `bookend want=${target} got=${after}`
      process.exitCode = process.exitCode || 1
    }
  } catch (error) {
    console.error('FAIL l2 restore: ' + (error instanceof Error ? error.message : error))
    result.ok = false
    process.exitCode = process.exitCode || 1
  }
  try {
    const swept = sweepOrphanE2eProjects({
      dataDir: defaultDataDirectory(root),
      keepIds: [activeBefore, 'default', result.projectId].filter(Boolean),
    })
    if (swept.removed.length) {
      console.log(`[l2] swept ${swept.removed.length} orphan harness projects`)
    }
  } catch {
    /* ignore */
  }
  try {
    await stack.stop()
  } catch {
    /* ignore */
  }
  result.finishedAt = new Date().toISOString()
  try {
    writeFileSync(OUT_JSON, JSON.stringify(result, null, 2))
    const lines = [
      `# L2 composition`,
      ``,
      `- ok: **${result.ok}**`,
      `- head: \`${result.shortHead}\``,
      `- owned: ${result.owned}`,
      `- project: \`${result.projectId || '—'}\``,
      `- shell.css: \`${result.shellCss || '—'}\``,
      `- ui: ${result.ui}`,
      `- error: ${result.error || '—'}`,
      ``,
      `## Steps`,
      ...result.steps.map((s) => `- PASS \`${s.name}\` (+${s.atMs}ms)`),
      ``,
      `Isolation green is not composition green. This gate shares one project across Draft, Canon, and Lab.`,
      ``,
    ]
    writeFileSync(OUT_MD, lines.join('\n'))
    console.log(`[l2] wrote ${OUT_MD}`)
  } catch (error) {
    console.warn('[l2] artifact write failed: ' + (error instanceof Error ? error.message : error))
  }
  clearHardTimeout()
}

if (!result.ok && !process.exitCode) process.exitCode = 1
process.exit(process.exitCode || 0)
