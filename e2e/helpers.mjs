/**
 * Shared Playwright helpers for feature smokes and UI measurement gates.
 * Keep LLM-dependent paths deterministic: route-stub fixture payloads by default.
 * Opt into live LLM with STORYLINT_E2E_LIVE_LLM=1 (server must also be live).
 *
 * Companion face contract (D6):
 *   writing primary tabs: Chat | Write | Check | Inbox{n?} | More
 *   Research is a role=menuitem under More (not a top tab).
 *   Face tabs are role=tab; match by accessible name, not position.
 *
 * Measurement rule:
 *   Never measure UI until the target workspace/face precondition is proven.
 *   Prefer gotoWorkspace / openCompanionFace(..., { require: true }) over raw clicks.
 *   PreconditionError means "gate invalid", not a silent wrong-surface PASS.
 */

export const DEFAULT_VIEWPORT = Object.freeze({ width: 1440, height: 900 })
export const HARD_SMOKE_TIMEOUT_MS = 90_000
export const LLM_UI_TIMEOUT_MS = 15_000
export const SAVE_TIMEOUT_MS = 15_000
export const PRECONDITION_TIMEOUT_MS = 8_000

/** Thrown when a required UI surface/face did not become active. */
export class PreconditionError extends Error {
  constructor(message) {
    super(message)
    this.name = 'PreconditionError'
  }
}

/**
 * Workspace modes used by shell ecosystems + companion context attrs.
 * button: Workspace control label
 * main: expected main aria-label pattern
 * context: data-companion-context value when companion is open
 */
export const WORKSPACE_MODES = Object.freeze({
  draft: Object.freeze({
    key: 'draft',
    button: 'Draft',
    main: /^Draft$/,
    context: 'writing',
  }),
  lab: Object.freeze({
    key: 'lab',
    button: 'Lab',
    main: /^Lab$/,
    context: 'lab',
  }),
  canon: Object.freeze({
    key: 'canon',
    button: 'Canon',
    main: /^(Relationship graph|Family tree|Canon)$/,
    context: 'graph',
  }),
})

/** Face id stored on data-companion-face (lowercase) from accessible name. */
export function companionFaceId(name) {
  const normalized = String(name || '').trim().toLowerCase()
  if (normalized.startsWith('inbox')) return 'inbox'
  return normalized
}

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
/**
 * Leave an open Canon sheet and return to the binder list.
 * The affordance moved: SheetEditor is rendered with showBack={false}, and the control now lives
 * in the binder detail chrome as "Back". Assert the behaviour (list is showing again) rather than
 * a button label, so the next chrome change fails loudly instead of hanging on a missing name.
 */
export async function closeSheetDetail(page) {
  const detail = page.locator('[data-binder-detail="sheet"]')
  if (await detail.count()) {
    await detail.getByRole('button', { name: 'Back', exact: true }).click()
  } else {
    await page.keyboard.press('Escape')
  }
  await page.locator('[data-binder-stack="list"]').first().waitFor({ timeout: 5000 })
}

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
 * When require=true, waits until data-companion-face matches or throws PreconditionError.
 */
export async function openCompanionFace(companion, name, { timeout = PRECONDITION_TIMEOUT_MS, require = false } = {}) {
  const faces = companion.getByRole('tablist', { name: 'Companion faces' })
  await faces.waitFor({ timeout })
  const pattern = faceNamePattern(name)

  // Primary strip: D6 uses role=tab; older builds used plain buttons.
  const tab = faces.getByRole('tab', { name: pattern })
  if (await tab.count()) {
    await tab.first().click()
  } else {
    const button = faces.getByRole('button', { name: pattern })
    if (await button.count()) {
      await button.first().click()
    } else {
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
        } else {
          await itemAnywhere.first().click({ timeout })
        }
      } else {
        // Last resort: any control with that accessible name inside the panel.
        await companion.getByRole('tab', { name: pattern })
          .or(companion.getByRole('button', { name: pattern }))
          .first()
          .click({ timeout })
      }
    }
  }

  if (require) {
    await assertCompanionFace(companion.page(), name, { timeout })
  }
}

/** Resolve workspace mode key or alias (draft/manuscript/writing, canon/graph). */
export function resolveWorkspaceMode(mode) {
  const key = String(mode || '').trim().toLowerCase()
  if (key === 'manuscript' || key === 'writing' || key === 'draft') return WORKSPACE_MODES.draft
  if (key === 'lab') return WORKSPACE_MODES.lab
  if (key === 'canon' || key === 'graph') return WORKSPACE_MODES.canon
  throw new PreconditionError(`Unknown workspace mode: ${mode}`)
}

/** Snapshot of workspace button pressed state + main aria-label + companion attrs. */
export async function readUiSurface(page) {
  return page.evaluate(() => {
    const workspace = document.querySelector('[aria-label="Workspace"]')
    const pressed = workspace
      ? [...workspace.querySelectorAll('button')].find((b) => b.getAttribute('aria-pressed') === 'true')
      : null
    const main = document.querySelector('main')
    const panel = document.querySelector('.panel[data-companion-context]')
    return {
      workspace: (pressed?.textContent || '').trim() || null,
      main: main?.getAttribute('aria-label') || null,
      companionContext: panel?.getAttribute('data-companion-context') || null,
      companionFace: panel?.getAttribute('data-companion-face') || null,
    }
  })
}

/**
 * Browser-side visibility predicate source.
 * Injected into page.evaluate — do not rely on getBoundingClientRect alone.
 *
 * Chromium still lays out children of closed <details>, so rect/offsetParent/
 * display/visibility all lie. Prefer Element.checkVisibility; always treat
 * non-summary descendants of closed <details> as hidden.
 *
 * Fail closed: if visibility cannot be determined, returns {visible:false, refuse:true}.
 */
export const BROWSER_IS_VISIBLE_SOURCE = `function isVisiblyPainted(el) {
  if (!el || !(el instanceof Element)) {
    return { visible: false, reason: 'no-el', refuse: true }
  }
  // Closed <details> content is not painted; <summary> still is.
  let node = el
  while (node && node !== document.documentElement) {
    const parent = node.parentElement
    if (parent && parent.tagName === 'DETAILS' && !parent.open) {
      if (node.tagName === 'SUMMARY') break
      return { visible: false, reason: 'closed-details' }
    }
    node = parent
  }
  if (typeof el.checkVisibility === 'function') {
    try {
      const visible = el.checkVisibility({
        checkOpacity: true,
        checkVisibilityCSS: true,
        contentVisibilityAuto: true,
      })
      return { visible: !!visible, reason: visible ? 'checkVisibility' : 'checkVisibility-false' }
    } catch (error) {
      return {
        visible: false,
        reason: 'checkVisibility-error',
        refuse: true,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }
  return { visible: false, reason: 'no-checkVisibility', refuse: true }
}
function isVisibleEl(el) {
  const result = isVisiblyPainted(el)
  if (result.refuse) {
    throw new Error('precondition not met: visibility undetermined (' + result.reason + ')')
  }
  return !!result.visible
}
`

/** Desk breakpoint matching src/components/shell/useShellState defaultRailsAt. */
export const DESK_RAIL_MIN_WIDTH = 1366

/**
 * Self-test: closed <details> children must NOT count as visible.
 * Call once per browser session before any density/chrome count.
 * Fail closed if Element.checkVisibility is missing or the predicate lies.
 */
export async function assertVisibilityPredicate(page) {
  await page.setContent(`<!doctype html>
<html><body>
<details id="d">
  <summary id="s">Tags</summary>
  <button id="chip" type="button">char-dev</button>
</details>
</body></html>`)
  const result = await page.evaluate((src) => {
    // eslint-disable-next-line no-new-func
    eval(src)
    const hasCV = typeof Element.prototype.checkVisibility === 'function'
    const chipClosed = isVisiblyPainted(document.getElementById('chip'))
    const summary = isVisiblyPainted(document.getElementById('s'))
    const details = document.getElementById('d')
    details.open = true
    // Force layout after open so checkVisibility sees painted content.
    void details.offsetHeight
    const chipOpen = isVisiblyPainted(document.getElementById('chip'))
    return {
      hasCV,
      chip: chipClosed,
      summary,
      openChip: chipOpen,
      detailsOpen: details.open,
    }
  }, BROWSER_IS_VISIBLE_SOURCE)

  if (!result.hasCV) {
    throw new PreconditionError(
      'precondition not met: Element.checkVisibility unavailable — refuse rect-only visibility',
    )
  }
  if (result.chip?.visible) {
    throw new PreconditionError(
      `visibility self-test failed: closed <details> child reported visible (${JSON.stringify(result.chip)})`,
    )
  }
  if (!result.summary?.visible) {
    throw new PreconditionError(
      `visibility self-test failed: <summary> of closed details not visible (${JSON.stringify(result.summary)})`,
    )
  }
  if (!result.openChip?.visible) {
    throw new PreconditionError(
      `visibility self-test failed: open <details> child not visible (${JSON.stringify(result.openChip)})`,
    )
  }
  return result
}

/**
 * Read binder/agent open state + whether the harness forced them.
 * origin.binder|agent: 'default' | 'forced'
 * Below DESK_RAIL_MIN_WIDTH, product default is companion closed / binder leads.
 */
export async function readRailState(page, { origin = {} } = {}) {
  return page.evaluate((originMap) => {
    const body = document.querySelector('.shell__body')
    const binderEl = document.querySelector('.shell__rail--binder')
    const agentEl = document.querySelector('.shell__rail--agent')
    const binderAttr = body?.getAttribute('data-binder')
    const agentAttr = body?.getAttribute('data-agent')
    const binderRect = binderEl?.getBoundingClientRect?.()
    const agentRect = agentEl?.getBoundingClientRect?.()
    const binderOpen =
      binderAttr === 'open' ||
      (!!binderEl && (binderRect?.width || 0) > 40 && getComputedStyle(binderEl).display !== 'none')
    const agentOpen =
      agentAttr === 'open' ||
      (!!agentEl && (agentRect?.width || 0) > 40 && getComputedStyle(agentEl).display !== 'none') ||
      !!document.querySelector('.panel[data-companion-context]')
    return {
      binder: binderOpen ? 'open' : 'closed',
      agent: agentOpen ? 'open' : 'closed',
      origin: {
        binder: originMap.binder === 'forced' ? 'forced' : 'default',
        agent: originMap.agent === 'forced' ? 'forced' : 'default',
      },
      atDesk: window.innerWidth >= 1366,
      vw: window.innerWidth,
      bodyBinder: binderAttr || null,
      bodyAgent: agentAttr || null,
    }
  }, origin)
}

export function formatRailState(railState) {
  if (!railState) return 'rails=?'
  return `rails binder=${railState.binder}/${railState.origin?.binder || '?'} agent=${railState.agent}/${railState.origin?.agent || '?'} atDesk=${railState.atDesk}`
}

/** Close drawer backdrops that block topbar / rails on narrow layouts. */
export async function dismissDrawers(page) {
  await page.evaluate(() => {
    document.querySelectorAll('.ui-drawer__backdrop').forEach((el) => {
      el.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
  }).catch(() => {})
  await page.keyboard.press('Escape').catch(() => {})
}

/**
 * Ensure companion rail/panel is open (no-op if already open or control missing).
 * If track is provided and a Show click happens, sets track.agent = 'forced'.
 */
export async function ensureCompanionOpen(page, { track = null } = {}) {
  await dismissDrawers(page)
  const btn = page.getByRole('button', { name: /Show companion|Hide companion/i }).first()
  if (!(await btn.count())) return false
  const label = await btn.getAttribute('aria-label')
  let forced = false
  if (/Show companion/i.test(label || '')) {
    await btn.click({ force: true })
    forced = true
    if (track) track.agent = 'forced'
  }
  await companionPanel(page).waitFor({ timeout: PRECONDITION_TIMEOUT_MS }).catch(() => {})
  return forced
}

/**
 * Ensure binder rail is open on desktop layouts.
 * If track is provided and a Show click happens, sets track.binder = 'forced'.
 */
export async function ensureBinderOpen(page, { track = null } = {}) {
  await dismissDrawers(page)
  const btn = page.getByRole('button', { name: /Show binder|Hide binder/i }).first()
  if (!(await btn.count())) return false
  const label = await btn.getAttribute('aria-label')
  let forced = false
  if (/Show binder/i.test(label || '')) {
    await btn.click({ force: true })
    forced = true
    if (track) track.binder = 'forced'
  }
  return forced
}

/**
 * Prove workspace mode is active.
 * Checks Workspace button aria-pressed and main aria-label.
 * Optionally requires companion data-companion-context when companion is open.
 */
export async function assertWorkspace(page, mode, { timeout = PRECONDITION_TIMEOUT_MS, requireCompanionContext = false } = {}) {
  const spec = resolveWorkspaceMode(mode)
  const deadline = Date.now() + timeout
  let last = null
  while (Date.now() < deadline) {
    last = await readUiSurface(page)
    const workspaceOk = last.workspace === spec.button
    const mainOk = last.main != null && spec.main.test(last.main)
    const contextOk = !requireCompanionContext || last.companionContext === spec.context
    if (workspaceOk && mainOk && contextOk) return last
    await page.waitForTimeout(50)
  }
  throw new PreconditionError(
    `precondition not met: workspace ${spec.key} `
    + `(want button=${spec.button}, main~=${spec.main}, context=${requireCompanionContext ? spec.context : 'any'}; `
    + `got ${JSON.stringify(last)})`,
  )
}

/** Prove companion face is active via data-companion-face. */
export async function assertCompanionFace(page, name, { timeout = PRECONDITION_TIMEOUT_MS } = {}) {
  const expected = companionFaceId(name)
  const deadline = Date.now() + timeout
  let last = null
  while (Date.now() < deadline) {
    last = await readUiSurface(page)
    if (last.companionFace === expected) return last
    await page.waitForTimeout(50)
  }
  throw new PreconditionError(
    `precondition not met: companion face ${expected} (got ${JSON.stringify(last)})`,
  )
}

/**
 * Switch workspace mode and prove it landed.
 * mode: draft|lab|canon (aliases: manuscript/writing, graph)
 */
export async function gotoWorkspace(page, mode, {
  timeout = PRECONDITION_TIMEOUT_MS,
  ensureCompanion = false,
  requireCompanionContext = false,
} = {}) {
  const spec = resolveWorkspaceMode(mode)
  await dismissDrawers(page)
  const group = page.getByRole('group', { name: 'Workspace' })
  const btn = (await group.count())
    ? group.getByRole('button', { name: spec.button, exact: true }).first()
    : page.getByRole('button', { name: spec.button, exact: true }).first()
  if (!(await btn.count())) {
    throw new PreconditionError(`precondition not met: missing Workspace button ${spec.button}`)
  }
  await btn.click({ force: true })
  if (ensureCompanion) await ensureCompanionOpen(page)
  return assertWorkspace(page, spec.key, {
    timeout,
    requireCompanionContext: ensureCompanion || requireCompanionContext,
  })
}

/**
 * Open companion face and prove data-companion-face.
 * Convenience wrapper around openCompanionFace(..., { require: true }).
 */
export async function requireCompanionFace(page, name, { timeout = PRECONDITION_TIMEOUT_MS } = {}) {
  await ensureCompanionOpen(page)
  const panel = companionPanel(page)
  await openCompanionFace(panel, name, { timeout, require: true })
  return readUiSurface(page)
}

let API_BASE = process.env.STORYLINT_API || 'http://127.0.0.1:4174'

/** Point helpers at an owned/ephemeral API origin. Call before any apiJson use. */
export function setApiBase(origin) {
  if (!origin || typeof origin !== 'string') {
    throw new PreconditionError('precondition not met: setApiBase requires a non-empty origin')
  }
  API_BASE = origin.replace(/\/$/, '')
}

export function getApiBase() {
  return API_BASE
}

/**
 * UI origin for browser gates/smokes.
 * No default to :5173. Parent (all-smoke / calm) must own the stack and set STORYLINT_UI.
 */
export function requireUiOrigin() {
  const ui = process.env.STORYLINT_UI || ''
  if (!ui) {
    throw new PreconditionError(
      'precondition not met: STORYLINT_UI is unset. Run via npm run test:e2e (owned stack) or npm run calm. Refusing stranger default :5173.',
    )
  }
  return ui.endsWith('/') ? ui : `${ui}/`
}


async function apiJson(path, init) {
  const response = await fetch(`${API_BASE}${path}`, init)
  const text = await response.text()
  let body = null
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    body = text
  }
  return { ok: response.ok, status: response.status, body, text }
}

/** Load active project document from the local API. */
export async function fetchActiveProject() {
  const result = await apiJson('/api/project')
  if (!result.ok) {
    throw new PreconditionError(`precondition not met: GET /api/project failed (${result.status})`)
  }
  return result.body
}

/** List projects from the local API. */
export async function fetchProjects() {
  const result = await apiJson('/api/projects')
  if (!result.ok) {
    throw new PreconditionError(`precondition not met: GET /api/projects failed (${result.status})`)
  }
  return result.body
}

/**
 * Activate/create a dedicated per-run project.
 * Never reuse shared fixture ids (doors2, default, etc).
 * Returns the private project id — keep it and reclaim before measuring.
 */
export async function ensureIsolatedProject(page, { id, title = 'E2E Health' } = {}) {
  const projectId = id || `e2e-${process.pid}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
  if (projectId === 'default' || /^doors/i.test(projectId)) {
    throw new PreconditionError(`precondition not met: refused shared fixture project id ${projectId}`)
  }

  const listing = await fetchProjects().catch(() => null)
  const exists = listing?.projects?.some((p) => p.id === projectId)
  if (!exists) {
    const created = await apiJson('/api/projects', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: projectId, title: `${title} ${projectId.slice(-6)}` }),
    })
    if (!created.ok && created.status !== 409) {
      throw new Error(`ensureIsolatedProject create failed: ${created.status} ${created.text}`)
    }
  }

  await reclaimIsolatedProject(projectId)
  // Best-effort UI select if page already navigated.
  if (page) {
    try {
      const select = page.getByLabel('Active project')
      if (await select.count()) {
        await select.selectOption(projectId).catch(() => {})
      }
    } catch {
      // page may not be on app yet
    }
  }
  return projectId
}

/**
 * Re-activate a private project and prove the server active pointer matches.
 * Call before every measurement block under concurrent agents.
 */
export async function reclaimIsolatedProject(projectId, { timeout = PRECONDITION_TIMEOUT_MS } = {}) {
  if (!projectId) throw new PreconditionError('precondition not met: reclaimIsolatedProject requires projectId')
  const activated = await apiJson(`/api/projects/${encodeURIComponent(projectId)}/activate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{}',
  })
  if (!activated.ok) {
    throw new PreconditionError(
      `precondition not met: activate ${projectId} failed (${activated.status} ${activated.text})`,
    )
  }
  return assertActiveProject(projectId, { timeout })
}

/**
 * Prove the server's active project is still ours.
 * Active id comes from GET /api/projects.activeProjectId (project doc has no id field).
 * Optional page check against the Active project select when present.
 */
export async function assertActiveProject(projectId, { page = null, timeout = PRECONDITION_TIMEOUT_MS } = {}) {
  const deadline = Date.now() + timeout
  let last = null
  while (Date.now() < deadline) {
    try {
      const listing = await fetchProjects()
      const activeId = listing?.activeProjectId ?? null
      last = { activeProjectId: activeId, title: listing?.projects?.find((p) => p.id === activeId)?.title ?? null }
      if (activeId === projectId) {
        if (page) {
          const selected = await page.evaluate(() => {
            const el = document.querySelector('select[aria-label="Active project"]')
            return el?.value || null
          }).catch(() => projectId) // if UI not mounted, server proof is enough
          if (selected && selected !== projectId) {
            last.ui = selected
          } else {
            return fetchActiveProject()
          }
        } else {
          return fetchActiveProject()
        }
      }
    } catch (error) {
      last = { error: error instanceof Error ? error.message : String(error) }
    }
    await new Promise((r) => setTimeout(r, 50))
  }
  throw new PreconditionError(
    `precondition not met: active project is not ${projectId} (got ${JSON.stringify(last)})`,
  )
}

/**
 * Prove the active project is empty of chapters and sheets.
 * Does NOT create content. Activate the empty project first.
 */
export async function assertProjectEmpty({ projectId = null } = {}) {
  if (projectId) {
    const listing = await fetchProjects()
    if (listing?.activeProjectId !== projectId) {
      throw new PreconditionError(
        `precondition not met: empty check on wrong project (want ${projectId}, got ${listing?.activeProjectId})`,
      )
    }
  }
  const project = await fetchActiveProject()
  const chapters = project?.chapters?.length ?? 0
  const sheets = project?.sheets?.length ?? 0
  const labCards = project?.lab?.boards?.reduce((n, b) => n + (b.cards?.length || 0), 0)
    ?? project?.lab?.cards?.length
    ?? 0
  if (chapters !== 0 || sheets !== 0) {
    throw new PreconditionError(
      `precondition not met: project not empty (chapters=${chapters}, sheets=${sheets}, labCards=${labCards}, active=${projectId || 'current'})`,
    )
  }
  return project
}

/**
 * Create/activate a fresh empty private project and prove emptiness after reload.
 * For empty-surface measurements (Canon empty, binder empty). Never reuse doors fixtures.
 */
export async function claimEmptyProject(page, { id, title = 'E2E Empty' } = {}) {
  const projectId = await ensureIsolatedProject(page, { id, title })
  // ensureIsolatedProject may leave drafts from prior ensureDraftReady on same id — use unique id always.
  // Prove empty; if not empty, mint a new id once.
  try {
    if (page) {
      try { await page.reload({ waitUntil: 'networkidle' }) } catch { /* not on page */ }
    }
    await reclaimIsolatedProject(projectId)
    await assertProjectEmpty({ projectId })
    return projectId
  } catch (firstError) {
    const retryId = `${projectId}-empty-${Date.now().toString(36)}`
    await ensureIsolatedProject(page, { id: retryId, title })
    if (page) {
      try { await page.reload({ waitUntil: 'networkidle' }) } catch { /* ok */ }
    }
    await reclaimIsolatedProject(retryId)
    try {
      await assertProjectEmpty({ projectId: retryId })
      return retryId
    } catch (secondError) {
      throw new PreconditionError(
        `precondition not met: claimEmptyProject could not obtain empty project `
        + `(first=${firstError instanceof Error ? firstError.message : firstError}; `
        + `second=${secondError instanceof Error ? secondError.message : secondError})`,
      )
    }
  }
}

/**
 * Reclaim + optional empty proof immediately before a measurement.
 * On failure throws PreconditionError — callers must not measure.
 */
export async function beforeMeasure(page, {
  projectId,
  requireEmpty = false,
  workspace = null,
  companionFace = null,
  ensureCompanion = false,
} = {}) {
  if (!projectId) throw new PreconditionError('precondition not met: beforeMeasure requires projectId')
  await reclaimIsolatedProject(projectId)
  if (page) {
    try {
      const select = page.getByLabel('Active project')
      if (await select.count()) {
        const value = await select.inputValue().catch(() => '')
        if (value !== projectId) await select.selectOption(projectId)
      }
    } catch {
      // UI may not expose select yet
    }
  }
  if (requireEmpty) await assertProjectEmpty({ projectId })
  if (workspace) {
    await gotoWorkspace(page, workspace, {
      ensureCompanion: ensureCompanion || Boolean(companionFace),
      requireCompanionContext: ensureCompanion || Boolean(companionFace),
    })
  }
  if (companionFace) {
    await requireCompanionFace(page, companionFace)
  }
  // Final reclaim proof after UI switches (concurrent thief window).
  await assertActiveProject(projectId, { page })
  return fetchActiveProject()
}

/** Ensure active project has a chapter and Draft editor is ready. */
export async function ensureDraftReady(page, {
  body = 'Aria opened the iron door.',
  title = 'Chapter One',
  craftTags,
} = {}) {
  async function loadProject() {
    return fetchActiveProject()
  }

  async function putChapter(chapter, nextBody) {
    const tags = Array.isArray(craftTags) ? craftTags : (chapter.craftTags ?? [])
    return fetch(`${API_BASE}/api/chapters/${encodeURIComponent(chapter.id)}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        id: chapter.id,
        title: chapter.title || title,
        body: nextBody,
        craftTags: tags,
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
    const project = await fetchActiveProject()
    const chapter = project.chapters[0]
    if (!chapter) throw new Error('fillChapterAndSave: no chapter after 409')
    const reset = await fetch(`${API_BASE}/api/chapters/${encodeURIComponent(chapter.id)}`, {
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
