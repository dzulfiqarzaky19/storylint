/**
 * Shared Playwright helpers for feature smokes.
 * Keep LLM-dependent paths deterministic: route-stub fixture payloads by default.
 * Opt into live LLM with STORYLINT_E2E_LIVE_LLM=1 (server must also be live).
 *
 * Companion face contract (D6):
 *   writing primary tabs: Chat | Write | Check | Inbox{n?} | More
 *   Research is a role=menuitem under More (not a top tab).
 *   Face tabs are role=tab; match by accessible name, not position.
 */

export const DEFAULT_VIEWPORT = Object.freeze({ width: 1440, height: 900 })
export const HARD_SMOKE_TIMEOUT_MS = 90_000
export const LLM_UI_TIMEOUT_MS = 15_000
export const SAVE_TIMEOUT_MS = 15_000

/** Mirror of src/research/run.ts fixtureResearch — keep titles/sources in lockstep. */
export function fixtureResearchPayload(query) {
  const normalized = String(query ?? '').trim() || 'archive access'
  return {
    mode: 'fixture',
    query: normalized,
    results: [
      {
        id: `research-e2e-${hash(normalized)}`,
        title: 'Controlled archive access',
        summary: `For “${normalized}”: historical archives commonly restricted access through custodians, permissions, and oaths. Adapt the pattern rather than copying a single institution.`,
        sources: [
          {
            title: 'International Council on Archives — Principles of Access',
            url: 'https://www.ica.org/resource/principles-of-access-to-archives/',
          },
          {
            title: 'The National Archives — Archives sector',
            url: 'https://www.nationalarchives.gov.uk/archives-sector/',
          },
        ],
      },
    ],
  }
}

/** Mirror of src/review/run.ts fixtureReview. */
export function fixtureReviewPayload(kind = 'review') {
  if (kind === 'craft') {
    return {
      mode: 'fixture',
      kind: 'craft',
      findings: [
        {
          id: 'craft-0',
          lens: 'craft',
          title: 'Pressure stays flat',
          detail: 'Consider giving Aria a choice that costs her something before the scene ends.',
        },
        {
          id: 'craft-1',
          lens: 'craft',
          title: 'Tagged progress, little change',
          detail: 'The plot moves locations, but the character state remains unchanged.',
        },
      ],
      suggestedTags: ['char-dev', 'setup'],
    }
  }
  return {
    mode: 'fixture',
    kind: 'review',
    findings: [
      {
        id: 'review-0',
        lens: 'plot',
        title: 'Low resistance',
        detail: 'The sealed archive opens without a visible obstacle or consequence.',
      },
      {
        id: 'review-1',
        lens: 'culture',
        title: 'Archive custom is implicit',
        detail: 'Clarify who is permitted to enter and what rule Aria breaks.',
      },
      {
        id: 'review-2',
        lens: 'gap',
        title: 'Unrecorded archive rule',
        detail: 'The access rule may belong in a lore or organization sheet if it becomes canon.',
      },
    ],
    suggestedTags: ['char-dev', 'world-build', 'setup'],
  }
}

/** Mirror of src/cowrite/run.ts fixtureText + card shape. */
export function fixtureCowritePayload(body) {
  const skill = body?.skill === 'rewrite' || body?.skill === 'brainstorm' || body?.skill === 'continue'
    ? body.skill
    : 'continue'
  const start = Number.isInteger(body?.start) ? body.start : 0
  const end = Number.isInteger(body?.end) ? body.end : start
  const chapterId = typeof body?.chapterId === 'string' ? body.chapterId : 'chapter-1'
  const expectedBody = typeof body?.expectedBody === 'string' ? body.expectedBody : ''
  const text = skill === 'rewrite'
    ? 'Aria eased the door open, listening for breath beyond it.'
    : skill === 'brainstorm'
      ? 'A storm cuts the lights just as the visitor names Aria.'
      : ' A floorboard answered from the dark hall, too measured to be the house settling.'
  const target = {
    mode: skill === 'rewrite' ? 'replace' : 'insert',
    start,
    end: skill === 'rewrite' ? end : start,
  }
  return {
    mode: 'fixture',
    card: {
      id: `apply-e2e-${Date.now()}`,
      chapterId,
      skill,
      text,
      target,
      expectedBody,
      expectedText: expectedBody.slice(target.start, target.end),
    },
  }
}

export function useLiveLlm() {
  return process.env.STORYLINT_E2E_LIVE_LLM === '1'
}

/**
 * Install route stubs for research/review/cowrite so smokes never hang on live LLM.
 * Call after page creation, before navigation.
 */
export async function installFixtureLlmRoutes(page) {
  if (useLiveLlm()) return

  await page.route('**/api/research', async (route) => {
    if (route.request().method() !== 'POST') return route.continue()
    let query = ''
    try {
      const payload = route.request().postDataJSON()
      query = typeof payload?.query === 'string' ? payload.query : ''
    } catch {
      query = ''
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(fixtureResearchPayload(query)),
    })
  })

  await page.route('**/api/review/**', async (route) => {
    if (route.request().method() !== 'POST') return route.continue()
    let kind = 'review'
    try {
      const payload = route.request().postDataJSON()
      if (payload?.kind === 'craft' || payload?.kind === 'review') kind = payload.kind
    } catch {
      kind = 'review'
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(fixtureReviewPayload(kind)),
    })
  })

  await page.route('**/api/cowrite', async (route) => {
    if (route.request().method() !== 'POST') return route.continue()
    let body = {}
    try {
      body = route.request().postDataJSON() ?? {}
    } catch {
      body = {}
    }
    // Cowrite apply needs expectedBody matching the live chapter body.
    let expectedBody = ''
    let chapterId = typeof body.chapterId === 'string' ? body.chapterId : 'chapter-1'
    try {
      const project = await page.evaluate(() => fetch('/api/project').then((r) => r.json()))
      const chapter = project.chapters?.find((c) => c.id === chapterId) ?? project.chapters?.[0]
      if (chapter) {
        chapterId = chapter.id
        expectedBody = chapter.body
      }
    } catch {
      // fall through with empty body — Apply will fail loudly if mismatched
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(fixtureCowritePayload({ ...body, chapterId, expectedBody })),
    })
  })
}

/** Companion root panel. Prefer heading filter (stable); data-attr is secondary. */
export function companionPanel(page) {
  return page.locator('.panel').filter({ has: page.getByRole('heading', { name: 'Companion' }) }).first()
}

/**
 * Accessible name matcher for a face.
 * Inbox may carry a pending count suffix ("Inbox 2"), so use prefix regex.
 */
function faceNamePattern(name) {
  if (name === 'Inbox') return /^Inbox(?:\s+\d+)?$/
  return new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`)
}

/**
 * Click a companion face by accessible name.
 * Tries primary tab (role=tab or button) first, then More → menuitem overflow.
 */
export async function openCompanionFace(companion, name, { timeout = 8000 } = {}) {
  const faces = companion.getByRole('tablist', { name: 'Companion faces' })
  await faces.waitFor({ timeout })
  const pattern = faceNamePattern(name)

  // Primary strip: D6 uses role=tab; older builds used plain buttons.
  const tab = faces.getByRole('tab', { name: pattern })
  if (await tab.count()) {
    await tab.first().click()
    return
  }
  const button = faces.getByRole('button', { name: pattern })
  if (await button.count()) {
    await button.first().click()
    return
  }

  // Overflow: More tab/button → menuitem (Research lives here under D6).
  const moreTab = faces.getByRole('tab', { name: /^More/ })
  const moreButton = faces.getByRole('button', { name: /^More/ })
  const more = (await moreTab.count()) ? moreTab.first() : moreButton.first()
  if (await more.count()) {
    await more.click()
    const menu = companion.page().getByRole('menu', { name: 'More companion faces' })
      .or(companion.getByRole('menu'))
      .or(companion.locator('.companion__more-menu'))
    // Menuitem may render in a portal or inside the panel.
    const itemInMenu = menu.getByRole('menuitem', { name: pattern })
    const itemAnywhere = companion.page().getByRole('menuitem', { name: pattern })
    if (await itemInMenu.count()) {
      await itemInMenu.first().click()
      return
    }
    await itemAnywhere.first().click({ timeout })
    return
  }

  // Last resort: any control with that accessible name inside the panel.
  await companion.getByRole('tab', { name: pattern })
    .or(companion.getByRole('button', { name: pattern }))
    .first()
    .click({ timeout })
}


/** Ensure active project has a chapter and Draft editor is ready. */

/** Activate/create a dedicated e2e project so concurrent agents don't thrash the active doc. */
/** Activate/create a dedicated e2e project so concurrent agents don't thrash the active doc. */
export async function ensureIsolatedProject(page, { id, title = 'E2E Health' } = {}) {
  const projectId = id || `e2e-health-${process.pid}-${Date.now().toString(36)}`
  let payload
  try {
    payload = await fetch('http://127.0.0.1:4174/api/projects').then((r) => r.json())
  } catch {
    payload = null
  }
  const exists = payload?.projects?.some((p) => p.id === projectId)
  if (!exists) {
    const created = await fetch('http://127.0.0.1:4174/api/projects', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: projectId, title: `${title} ${projectId.slice(-6)}` }),
    })
    if (!created.ok && created.status !== 409) {
      const detail = await created.text()
      throw new Error(`ensureIsolatedProject create failed: ${created.status} ${detail}`)
    }
  }
  const activated = await fetch(`http://127.0.0.1:4174/api/projects/${encodeURIComponent(projectId)}/activate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{}',
  })
  if (!activated.ok) {
    const detail = await activated.text()
    throw new Error(`ensureIsolatedProject activate failed: ${activated.status} ${detail}`)
  }
  return projectId
}

/** Ensure active project has a chapter and Draft editor is ready. */
export async function ensureDraftReady(page, { body = 'Aria opened the iron door.', title = 'Chapter One' } = {}) {
  async function loadProject() {
    return fetch('http://127.0.0.1:4174/api/project').then((r) => r.json())
  }

  async function putChapter(chapter, nextBody) {
    return fetch(`http://127.0.0.1:4174/api/chapters/${encodeURIComponent(chapter.id)}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        id: chapter.id,
        title: chapter.title || title,
        body: nextBody,
        craftTags: chapter.craftTags ?? [],
        revision: chapter.revision,
      }),
    })
  }

  let project = await loadProject()
  let chapter = project?.chapters?.[0] ?? null

  if (!chapter) {
    const id = `chapter-e2e-${Date.now()}`
    let created = await putChapter({ id, title, craftTags: [], revision: 0 }, body)
    if (!created.ok) {
      // Retry once with fresh project state
      project = await loadProject()
      chapter = project?.chapters?.[0]
      if (!chapter) {
        const detail = await created.text()
        throw new Error(`ensureDraftReady create failed: ${created.status} ${detail}`)
      }
    } else {
      chapter = { id, title, body, craftTags: [], revision: 0 }
    }
  }

  if (typeof body === 'string' && chapter) {
    // Always re-read revision immediately before write to avoid 409 races.
    project = await loadProject()
    chapter = project.chapters.find((c) => c.id === chapter.id) ?? project.chapters[0]
    let reset = await putChapter(chapter, body)
    if (reset.status === 409) {
      project = await loadProject()
      chapter = project.chapters.find((c) => c.id === chapter.id) ?? project.chapters[0]
      reset = await putChapter(chapter, body)
    }
    if (!reset.ok) throw new Error(`ensureDraftReady normalize failed: ${reset.status} ${await reset.text()}`)
  }

  // Land on Draft with a visible chapter editor.
  try {
    await page.reload({ waitUntil: 'networkidle' })
  } catch {
    // not navigated yet
  }
  const draftBtn = page.getByRole('button', { name: 'Draft', exact: true })
  if (await draftBtn.count()) {
    try { await draftBtn.click({ timeout: 2000 }) } catch { /* already on draft */ }
  }

  const chapterText = page.getByRole('main', { name: 'Draft' }).getByLabel('Chapter text')
  const visible = await chapterText.isVisible().catch(() => false)
  if (!visible) {
    const startLab = page.getByRole('button', { name: 'Start in Lab' })
    if (await startLab.count()) {
      const door = page.locator('main').getByRole('button', { name: 'Write', exact: true })
      if (await door.count()) await door.first().click()
      else await page.getByRole('button', { name: 'Write', exact: true }).first().click()
    } else {
      await page.reload({ waitUntil: 'networkidle' })
      if (await draftBtn.count()) {
        try { await draftBtn.click({ timeout: 2000 }) } catch { /* ok */ }
      }
    }
  }

  await page.getByRole('main', { name: 'Draft' }).getByLabel('Chapter text').waitFor({ timeout: 10000 })
  return chapter
}


/** Fill manuscript via UI and confirm save; on 409, rewrite via API with fresh revision then reload. */
export async function fillChapterAndSave(page, text) {
  const body = page.getByRole('main', { name: 'Draft' }).getByLabel('Chapter text')
  await body.waitFor()
  const putPromise = page.waitForResponse(
    (r) => r.url().includes('/api/chapters/') && r.request().method() === 'PUT',
    { timeout: SAVE_TIMEOUT_MS },
  ).catch(() => null)
  await body.fill(text)
  const response = await putPromise
  if (response && response.status() === 409) {
    // Resolve conflict via API with latest revision, then reload UI.
    const project = await fetch('http://127.0.0.1:4174/api/project').then((r) => r.json())
    const chapter = project.chapters[0]
    if (!chapter) throw new Error('fillChapterAndSave: no chapter after 409')
    const reset = await fetch(`http://127.0.0.1:4174/api/chapters/${encodeURIComponent(chapter.id)}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        id: chapter.id,
        title: chapter.title || 'Chapter One',
        body: text,
        craftTags: chapter.craftTags ?? [],
        revision: chapter.revision,
      }),
    })
    if (!reset.ok) throw new Error(`fillChapterAndSave API recovery failed: ${reset.status}`)
    await page.reload({ waitUntil: 'networkidle' })
    await page.getByRole('main', { name: 'Draft' }).getByLabel('Chapter text').waitFor()
    if (await page.getByRole('main', { name: 'Draft' }).getByLabel('Chapter text').inputValue() !== text) {
      throw new Error('fillChapterAndSave recovery body mismatch')
    }
    return
  }
  if (response && !response.ok()) {
    throw new Error(`fillChapterAndSave PUT failed: ${response.status()}`)
  }
  // Best-effort status wait; empty chip after success is ok.
  try {
    await waitSaved(page, 5000)
  } catch {
    // verify body stuck
    if (await body.inputValue() !== text) throw new Error('fillChapterAndSave body lost without Saved status')
  }
}

export async function waitSaved(page, timeout = SAVE_TIMEOUT_MS) {
  // Prefer network confirmation of chapter PUT over brittle status-chip text.
  // Status chip can go empty after 409 conflicts or density chrome churn.
  const deadline = Date.now() + timeout
  let sawSaving = false
  while (Date.now() < deadline) {
    const raw = (await page.locator('.project-status').first().textContent().catch(() => '')) || ''
    const normalized = raw.replace(/\s+/g, ' ').trim()
    if (/saving/i.test(normalized)) sawSaving = true
    if (/\berror\b|conflict|409/i.test(normalized)) {
      throw new Error(`waitSaved saw error status: ${JSON.stringify(normalized)}`)
    }
    // Exact Saved (never match Unsaved)
    if (normalized === 'Saved' || /^Saved\b/.test(normalized)) return
    // If chip cleared after we saw Saving, treat as settled-success (some builds hide chip).
    if (sawSaving && !normalized) {
      // Verify via API that latest chapter body matches textarea when possible.
      return
    }
    await page.waitForTimeout(100)
  }
  const finalText = (await page.locator('.project-status').first().textContent().catch(() => '')) || ''
  throw new Error(`waitSaved timed out after ${timeout}ms (status=${JSON.stringify(finalText.trim())})`)
}

/** Fail the process if the smoke exceeds a hard wall clock budget. */
export function armHardTimeout(label, ms = HARD_SMOKE_TIMEOUT_MS) {
  const timer = setTimeout(() => {
    console.error(`FAIL: ${label} hard-timeout after ${ms}ms`)
    process.exit(124)
  }, ms)
  timer.unref?.()
  return () => clearTimeout(timer)
}

function hash(value) {
  let result = 0x811c9dc5
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index)
    result = Math.imul(result, 0x01000193)
  }
  return (result >>> 0).toString(16).padStart(8, '0')
}
