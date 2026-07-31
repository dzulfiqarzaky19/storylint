/**
 * Shared Playwright helpers for feature smokes.
 * Keep LLM-dependent paths deterministic: route-stub fixture payloads by default.
 * Opt into live LLM with STORYLINT_E2E_LIVE_LLM=1 (server must also be live).
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
    // Fetch current project so the Apply card's expectedBody is correct.
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

/** Companion root — prefer data attribute, fall back to heading filter. */
export function companionPanel(page) {
  const byAttr = page.locator('.panel[data-companion-context]').first()
  return byAttr.or(page.locator('.panel').filter({ has: page.getByRole('heading', { name: 'Companion' }) }).first())
}

/** Click a companion face tab by exact label (Write/Check/Research/Inbox/…). */
export async function openCompanionFace(companion, name, { timeout = 5000 } = {}) {
  const faces = companion.getByRole('tablist', { name: 'Companion faces' })
  await faces.waitFor({ timeout })
  // Density work may park secondary faces under More; try direct, then overflow.
  const direct = faces.getByRole('button', { name: name === 'Inbox' ? /^Inbox/ : name, exact: name !== 'Inbox' })
  if (await direct.count()) {
    await direct.first().click()
    return
  }
  const more = faces.getByRole('button', { name: /^More/ })
  if (await more.count()) {
    await more.click()
    await companion.getByRole('menuitem', { name, exact: true }).click()
    return
  }
  // Last resort: any button with that label inside the panel header strip.
  await companion.getByRole('button', { name: name === 'Inbox' ? /^Inbox/ : name, exact: name !== 'Inbox' }).first().click()
}

export async function waitSaved(page, timeout = SAVE_TIMEOUT_MS) {
  await page.locator('.project-status', { hasText: 'Saved' }).waitFor({ timeout })
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
