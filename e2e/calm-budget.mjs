/**
 * CALM_BUDGET executable checker.
 * Enforces HARD/WARN from docs/CALM_BUDGET.md (r3).
 *
 *   npm run calm
 *   node e2e/calm-budget.mjs
 *
 * Exit 1 on any HARD fail. WARN-only → exit 0.
 * Offline DOM geometry only. Requires e2e/helpers.mjs.
 *
 * Owns its measurement stack: builds this tree, serves ephemeral ports,
 * asserts git HEAD + shell.css provenance. Never defaults to :5173.
 * Unproven server → exit 2 (refuse), never PASS/FAIL a ghost.
 *
 * Measurement rule: never measure until workspace/face preconditions are proven.
 * Precondition misses record HARD fail "precondition not met" (never PASS on wrong surface).
 */
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createHash } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import {
  reloadApp,
  found,
  notFound,
  isFound,
  isNotFound,
  asMeasurement,
  requireFound,
  armHardTimeout,
  assertVisibilityPredicate,
  beforeMeasure,
  BROWSER_IS_VISIBLE_SOURCE,
  companionPanel,
  dismissDrawers,
  ensureBinderOpen,
  ensureCompanionOpen,
  claimEmptyProject,
  fetchActiveProject,
  ensureDraftReady,
  ensureIsolatedProject,
  formatRailState,
  installFixtureLlmRoutes,
  openCompanionFace,
  PreconditionError,
  readRailState,
  reclaimIsolatedProject,
  requireCompanionFace,
  resolveWorkspaceMode,
  setApiBase
} from './helpers.mjs'
import { resolveMeasurementTarget } from './owned-stack.mjs'

/** Set after resolveMeasurementTarget — never default to a stranger on :5173. */
let UI = ''
const OUT_DIR = 'e2e/output'
// Default write is UNTRACKED so a run never dirties the tree / blocks checkout.
// --record updates the tracked scoreboard (deliberate baseline commit).
// A tool must not write a tracked path as a side effect of running (rat / crab).
const RECORD_SCOREBOARD = process.argv.includes('--record')
const OUT_MD = RECORD_SCOREBOARD
  ? `${OUT_DIR}/calm-budget-run.md`
  : `${OUT_DIR}/calm-budget-last.md`
const OUT_JSON = RECORD_SCOREBOARD
  ? `${OUT_DIR}/calm-budget-run.json`
  : `${OUT_DIR}/calm-budget-last.json`

/** Format every touch fail sample for console / measured (not just [0]). */
function formatTouchSamples(samples) {
  if (!samples?.length) return ''
  return samples
    .map((s) => `${s.name} ${s.min}px(${s.w}x${s.h})`)
    .join(' · ')
}

/**
 * Identity of what the UI server is actually serving (not just git HEAD).
 * Hashes shell.css text so a stale Vite on :5173 is visible in the log.
 */
async function servedBundleIdentity(ui) {
  const base = ui.endsWith('/') ? ui : `${ui}/`
  const url = new URL('src/components/shell/shell.css', base).href
  try {
    const res = await fetch(url, { redirect: 'follow' })
    const text = await res.text()
    const hash = createHash('sha256').update(text).digest('hex').slice(0, 12)
    const hasB5 =
      text.includes('project-switcher__menu > .ui-button') ||
      text.includes('project-switcher__menu>.ui-button')
    return {
      url,
      status: res.status,
      bytes: text.length,
      sha256_12: hash,
      shellCssHasB5Touch: hasB5,
    }
  } catch (error) {
    return {
      url,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

function printRunIdentity(meta, label = 'identity') {
  const served = meta.served
  const servedLine = served?.error
    ? `served=ERROR ${served.error} url=${served.url}`
    : served
      ? `served=shell.css#${served.sha256_12} status=${served.status} bytes=${served.bytes} b5TouchRule=${served.shellCssHasB5Touch}`
      : 'served=unknown'
  console.log(`[${label}] head=${meta.head} ui=${meta.ui} ${servedLine}`)
}

const require = createRequire('D:/npm-global/node_modules/playwright/package.json')
const pwRoot = dirname(require.resolve('playwright/package.json'))
const { chromium } = await import(pathToFileURL(resolve(pwRoot, 'index.mjs')).href)

/** @typedef {'HARD'|'WARN'} Sev */
/**
 * @typedef {'pass'|'fail'|'warn'|'not-measured'|'precondition'} Outcome
 * @typedef {{ id: string, sev: Sev, doc: string, surface: string, pass: boolean, measured: string, threshold: string, note?: string, outcome?: Outcome }} Check
 */

/** @type {Check[]} */
const checks = []

/** Fingerprint / summary token — N is distinct from F so PASS→NOT-MEASURED always moves the hash (crab/rat). */
function outcomeOf(check) {
  if (check.outcome) return check.outcome
  if (check.pass) return 'pass'
  if (check.sev === 'HARD') return 'fail'
  return 'warn'
}

function outcomeToken(check) {
  const o = outcomeOf(check)
  if (o === 'pass') return 'P'
  if (o === 'not-measured') return 'N'
  if (o === 'precondition') return 'X'
  if (o === 'warn') return 'W'
  return 'F'
}

function statusLabel(check) {
  const o = outcomeOf(check)
  if (o === 'pass') return 'PASS'
  if (o === 'not-measured') return 'NOT-MEASURED'
  if (o === 'precondition') return 'PRECONDITION'
  if (o === 'warn') return 'WARN'
  return 'FAIL'
}

function isNotMeasuredCheck(check) {
  return outcomeOf(check) === 'not-measured'
}

function record(check) {
  if (!check.outcome) check.outcome = outcomeOf(check)
  checks.push(check)
  const status = statusLabel(check)
  console.log(`[${status}] ${check.id} (${check.sev}) ${check.measured} · want ${check.threshold} · ${check.surface}`)
  // On fail: dump every sample name (not just the first) when the check carries them.
  if (!check.pass && check.samples?.length) {
    console.log(`  samples(${check.samples.length}): ${formatTouchSamples(check.samples)}`)
  }
  if (!check.pass && check.sev === 'HARD' && globalThis.__CALM_META__) {
    printRunIdentity(globalThis.__CALM_META__, 'hard-fail-identity')
  }
  return status
}

function add(id, sev, doc, surface, pass, measured, threshold, note, samples, extra) {
  const outcome = extra?.outcome
    || (pass ? 'pass' : sev === 'HARD' ? 'fail' : 'warn')
  record({
    id,
    sev,
    doc,
    surface,
    pass,
    measured: String(measured),
    threshold: String(threshold),
    note,
    samples,
    outcome,
    ...(extra || {}),
  })
}

function preconditionFail(id, surface, error) {
  const message = error instanceof Error ? error.message : String(error)
  add(
    id,
    'HARD',
    'precondition not met — measurement skipped',
    surface,
    false,
    message,
    'precondition proven before measure',
    'wrong-surface PASS blocked',
    undefined,
    { outcome: 'precondition' },
  )
}

/** Rule 4: NOT-MEASURED is a first-class failing verdict. Never PASS on absence. */
function notMeasuredFail(id, surface, reason) {
  add(
    id,
    'HARD',
    'NOT-MEASURED — checker could not find the surface it judges (rule 4)',
    surface,
    false,
    `NOT-MEASURED: ${reason}`,
    'surface present and measurable',
    'absence is not pass',
    undefined,
    { outcome: 'not-measured' },
  )
}

/**
 * Record a check only when the measurement is found.
 * notFound → NOT-MEASURED HARD (never PASS).
 * found → run pass(value). Intentional empty surfaces use found(0), not notFound.
 */
function judgeMeasured(id, sev, doc, surface, measurement, { pass, measured, threshold, note, samples } = {}) {
  if (!isFound(measurement)) {
    const reason = isNotFound(measurement)
      ? measurement.reason
      : (measurement?.reason || measurement?.status || 'measurement not found|found')
    notMeasuredFail(id, surface, reason)
    return false
  }
  const value = measurement.value
  const ok = typeof pass === 'function' ? !!pass(value) : !!pass
  const measuredText = typeof measured === 'function' ? measured(value) : String(measured ?? value)
  add(id, sev, doc, surface, ok, measuredText, threshold, note, samples)
  return ok
}


async function withSurface(id, surface, fn) {
  try {
    return await fn()
  } catch (error) {
    if (error instanceof PreconditionError || /precondition not met/i.test(String(error?.message || error))) {
      preconditionFail(id, surface, error)
      return null
    }
    throw error
  }
}

async function measureLayout(page) {
  return page.evaluate((visSrc) => {
    // eslint-disable-next-line no-new-func
    const { isVisibleEl } = new Function(`${visSrc}; return { isVisibleEl }`)()
    const vw = window.innerWidth
    const vh = window.innerHeight
    const body = document.querySelector('.shell__body')
    const binder = document.querySelector('.shell__rail--binder')
    const agent = document.querySelector('.shell__rail--agent, .shell__rail:not(.shell__rail--binder)')
    const work =
      document.querySelector('#workspace') ||
      document.querySelector('.manuscript') ||
      document.querySelector('.lab') ||
      document.querySelector('.graph') ||
      document.querySelector('[aria-label="Canon"]')

    function box(el) {
      if (!el) return null
      const r = el.getBoundingClientRect()
      return { w: r.width, h: r.height, x: r.x, y: r.y, top: r.top, bottom: r.bottom, left: r.left, right: r.right }
    }

    const binderBox = box(binder)
    const agentBox = box(agent)
    const workBox = box(work)

    let agentW = agentBox?.w || 0
    if (!agentW) {
      const panel = document.querySelector('.panel[data-companion-context]')
      if (panel) {
        let el = panel
        while (el && el !== document.body) {
          if (el.classList?.contains('shell__rail') || el.tagName === 'ASIDE') {
            agentW = el.getBoundingClientRect().width
            break
          }
          el = el.parentElement
        }
        if (!agentW) agentW = panel.getBoundingClientRect().width
      }
    }

    const binderW = binderBox?.w || 0
    const workW = workBox?.w || 0
    const chromeW = binderW + agentW
    const workPct = vw > 0 ? (workW / vw) * 100 : 0
    const chromePct = vw > 0 ? (chromeW / vw) * 100 : 0
    const binderPct = vw > 0 ? (binderW / vw) * 100 : 0
    const agentPct = vw > 0 ? (agentW / vw) * 100 : 0

    const foldBandTop = 48
    const foldBandBottom = vh
    const candidates = []
    for (const el of document.querySelectorAll('main, .manuscript, .lab, .graph, .shell__rail, aside, .panel, #workspace')) {
      // Visibility first: collapsed/hidden regions must not win fold ownership.
      if (!isVisibleEl(el)) continue
      const r = el.getBoundingClientRect()
      if (r.width < 40 || r.height < 40) continue
      if (r.bottom < foldBandTop || r.top > foldBandBottom) continue
      const visibleH = Math.min(r.bottom, foldBandBottom) - Math.max(r.top, foldBandTop)
      const visibleW = Math.min(r.right, vw) - Math.max(r.left, 0)
      const area = Math.max(0, visibleH) * Math.max(0, visibleW)
      if (area <= 0) continue
      const cls = el.className?.toString?.() || ''
      const role =
        el.id === 'workspace' || cls.includes('manuscript') || cls.includes('lab') || cls.includes('graph')
          ? 'work'
          : cls.includes('rail') || el.tagName === 'ASIDE' || cls.includes('panel')
            ? 'chrome'
            : 'other'
      candidates.push({ area, role, tag: el.tagName, cls: cls.slice(0, 80), id: el.id })
    }
    candidates.sort((a, b) => b.area - a.area)
    const foldOwner = candidates[0]?.role === 'work' ? 'work' : candidates[0]?.role || 'unknown'

    const overflowX = document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
      || document.body.scrollWidth > document.body.clientWidth + 1

    return {
      vw,
      vh,
      workPct: round1(workPct),
      chromePct: round1(chromePct),
      binderPct: round1(binderPct),
      agentPct: round1(agentPct),
      binderW: Math.round(binderW),
      agentW: Math.round(agentW),
      workW: Math.round(workW),
      foldOwner,
      foldTop: candidates[0] || null,
      overflowX,
      bodyBinder: body?.getAttribute('data-binder') || null,
      bodyAgent: body?.getAttribute('data-agent') || null,
    }

    function round1(n) {
      return Math.round(n * 10) / 10
    }
  }, BROWSER_IS_VISIBLE_SOURCE)
}

async function measureTopbar(page) {
  return page.evaluate((visSrc) => {
    // eslint-disable-next-line no-new-func
    const { isVisibleEl } = new Function(`${visSrc}; return { isVisibleEl }`)()
    const top = document.querySelector('.shell__topbar')
    if (!top) return { missing: true }

    const jobNames = /^(continuity|export|research|review|new(\s|$)|run continuity)/i
    const controls = [...top.querySelectorAll('button, [role="button"], a.ui-button')]
    const primaries = controls.filter((el) => {
      const cls = el.className?.toString?.() || ''
      return cls.includes('ui-button--primary') || cls.includes('--primary') || el.getAttribute('data-variant') === 'primary'
    })
    const jobPrimaries = primaries.filter((el) => {
      const name = (el.getAttribute('aria-label') || el.textContent || '').trim()
      if (/^(Draft|Lab|Canon)$/i.test(name)) return false
      return jobNames.test(name)
    })
    const labeledJobs = controls.filter((el) => {
      const name = (el.getAttribute('aria-label') || el.textContent || '').trim()
      if (/^(Draft|Lab|Canon)$/i.test(name)) return false
      if (!jobNames.test(name)) return false
      const cls = el.className?.toString?.() || ''
      return cls.includes('primary') || cls.includes('solid') || el.getAttribute('aria-pressed') === 'true' && /continuity/i.test(name)
    })

    const ecosystems = [...top.querySelectorAll('.shell__ecosystem button, .shell__action-ecosystem, [aria-label="Workspace"] button')]
    const ecoLabels = ecosystems.map((el) => (el.textContent || '').trim()).filter(Boolean)
    const ecosystemVisible = ['Draft', 'Lab', 'Canon'].filter((label) =>
      ecoLabels.some((t) => t === label || t.startsWith(label)),
    ).length

    let placeLabelClipped = 0
    for (const el of ecosystems) {
      if (el.scrollWidth > el.clientWidth + 1) placeLabelClipped += 1
      const style = getComputedStyle(el)
      if (style.textOverflow === 'ellipsis' && el.scrollWidth > el.clientWidth + 1) placeLabelClipped += 1
    }

    const topControlCount = controls.filter((el) => isVisibleEl(el)).length

    return {
      topJobPrimaryCount: Math.max(jobPrimaries.length, labeledJobs.filter((el) => {
        const cls = el.className?.toString?.() || ''
        return cls.includes('ui-button--primary')
      }).length),
      jobPrimaryLabels: jobPrimaries.map((el) => (el.getAttribute('aria-label') || el.textContent || '').trim()),
      ecosystemVisible,
      ecoLabels,
      placeLabelClipped,
      topControlCount,
    }
  }, BROWSER_IS_VISIBLE_SOURCE)
}

async function measureTouchChrome(page) {
  return page.evaluate((visSrc) => {
    // eslint-disable-next-line no-new-func
    const { isVisibleEl } = new Function(`${visSrc}; return { isVisibleEl }`)()
    const selectors = [
      '.shell__topbar button',
      '.shell__topbar [role="button"]',
      '.shell__ecosystem button',
      '.companion__faces button',
      '.companion__faces [role="tab"]',
      'details summary',
      '.lab__filter-summary',
    ]
    const fails = []
    for (const sel of selectors) {
      for (const el of document.querySelectorAll(sel)) {
        if (!isVisibleEl(el)) continue
        if (el.closest('svg')) continue
        const r = el.getBoundingClientRect()
        const min = Math.min(r.width, r.height)
        if (min < 44 - 0.5) {
          fails.push({
            name: (el.getAttribute('aria-label') || el.textContent || sel).trim().slice(0, 40),
            w: Math.round(r.width * 10) / 10,
            h: Math.round(r.height * 10) / 10,
            min: Math.round(min * 10) / 10,
          })
        }
      }
    }
    return { touchFailChrome: fails.length, samples: fails }
  }, BROWSER_IS_VISIBLE_SOURCE)
}

/**
 * Measure companion faces only for the proven context.
 * Never falls back to a different panel context.
 */
async function measureFaces(page, context) {
  return page.evaluate(({ ctx, visSrc }) => {
    // eslint-disable-next-line no-new-func
    const { isVisibleEl } = new Function(`${visSrc}; return { isVisibleEl }`)()
    const panel = document.querySelector(`.panel[data-companion-context="${ctx}"]`)
    if (!panel) return { missing: true, context: null, reason: `no panel for context=${ctx}` }

    const faceRow = panel.querySelector('.companion__faces')
    const tabs = [...(faceRow?.querySelectorAll('[role="tab"], button') || [])].filter((t) => isVisibleEl(t))
    // Normalize Inbox count badge so concurrent proposal churn cannot flip fingerprints.
    const labels = tabs.map((t) => {
      const raw = (t.getAttribute('aria-label') || t.textContent || '').trim().replace(/\s+/g, ' ')
      return /^Inbox(?:\s+\d+)?$/i.test(raw) ? 'Inbox' : raw
    })
    const productFaces = labels.filter((l) => !/^More/i.test(l))
    const hasMore = labels.some((l) => /^More/i.test(l))

    let faceRows = 1
    if (faceRow && tabs.length) {
      const tops = tabs.map((t) => Math.round(t.getBoundingClientRect().top))
      faceRows = new Set(tops).size
    }

    const footer = panel.querySelector('.panel__footer')
    const footerBtns = footer
      ? [...footer.querySelectorAll('button, [role="button"]')].filter((b) => isVisibleEl(b))
      : []
    const footerPrimary = footerBtns.filter((b) => (b.className?.toString?.() || '').includes('ui-button--primary')).length
    const footerTotal = footerBtns.length
    const face = panel.getAttribute('data-companion-face') || ''
    const actualContext = panel.getAttribute('data-companion-context')

    let checkRestHasStatus = null
    if (face === 'check') {
      const body = panel.querySelector('.companion__check-body, [aria-label="Check summary"]')
      const text = (body?.textContent || panel.textContent || '').trim()
      const hasHelper =
        /Nothing checked yet|Last Continuity|Continuity is running|no issues found|red ·|yellow ·/i.test(text)
      const hasStatus = !!panel.querySelector('[data-continuity-status], [data-continuity-state], .companion__check-summary')
      checkRestHasStatus = hasHelper || hasStatus
    }

    let chatProposalsWall = false
    if (face === 'chat') {
      const proposals = panel.querySelectorAll('.proposal-list, [aria-label="Pending proposals"] .proposal-card, article.proposal')
      chatProposalsWall = proposals.length > 0
    }

    return {
      labels,
      productFaceCount: productFaces.length,
      productFaces,
      hasMore,
      faceRows,
      footerPrimary,
      footerTotal,
      face,
      checkRestHasStatus,
      chatProposalsWall,
      context: actualContext,
    }
  }, { ctx: context, visSrc: BROWSER_IS_VISIBLE_SOURCE })
}

async function measureLab(page) {
  return page.evaluate((visSrc) => {
    // eslint-disable-next-line no-new-func
    const { isVisibleEl } = new Function(`${visSrc}; return { isVisibleEl }`)()
    const lab = document.querySelector('.lab') || document.querySelector('[aria-label="Lab"]')?.closest('.lab, main, #workspace')
    const root = lab || document.querySelector('#workspace')
    if (!root) return { missing: true }

    const cards = [...root.querySelectorAll('.lab__card, [aria-label="Lab cards"] article')].filter((c) => isVisibleEl(c))
    const cardCount = cards.length
    const filter = root.querySelector('.lab__filters, [aria-label="Filter card kinds"]')
    const labFilterWhenEmpty = cardCount === 0 && !!filter && isVisibleEl(filter)
    const composerKinds = root.querySelector('.lab__composer-kinds, [aria-label="New card kind"]')

    function stripFull(el) {
      if (!el) return false
      const btns = [...el.querySelectorAll('button')].filter((b) => isVisibleEl(b))
      return btns.length >= 4
    }
    let kindFullStrips = 0
    if (stripFull(composerKinds)) kindFullStrips += 1
    if (filter && stripFull(filter.querySelector('.lab__filter-menu'))) kindFullStrips += 1
    // Per-element visibility only (rule 6). Never "container contains details?".
    if (filter && stripFull(filter)) kindFullStrips += 1

    return {
      cardCount,
      labFilterWhenEmpty,
      kindFullStrips,
      hasFilter: !!filter,
      hasComposerKinds: !!composerKinds,
    }
  }, BROWSER_IS_VISIBLE_SOURCE)
}

async function measureCraft(page) {
  return page.evaluate((visSrc) => {
    // eslint-disable-next-line no-new-func
    const { isVisibleEl } = new Function(`${visSrc}; return { isVisibleEl }`)()
    // Scope strictly to Draft manuscript — never count graph/lab/companion chrome.
    // Do not fall back to #workspace alone (that can be Lab/Canon and silently vacuous).
    const root =
      document.querySelector('main[aria-label="Draft"]') ||
      document.querySelector('.manuscript')
    if (!root) {
      return {
        missing: true,
        notMeasured: true,
        reason: 'no Draft manuscript root',
        chipVisibleCount: 0,
        chipLabels: [],
        craftCollapsedDefault: null,
        foundStrip: false,
      }
    }

    // Real product classes (Manuscript.tsx / shell.css). Dead aliases banned —
    // a selector that matches nothing is a failure (rule 5), not a vacuous pass.
    const strips = [
      ...root.querySelectorAll(
        '.manuscript__craft-tags, .manuscript__craft-tags-disclosure, [data-craft-tags], [aria-label*="craft" i]',
      ),
    ]
    let chips = []
    for (const strip of strips) {
      chips.push(
        ...[
          ...strip.querySelectorAll(
            'button.manuscript__craft-tag, .manuscript__craft-tag, button[aria-pressed], [role="button"]',
          ),
        ].filter((el) => {
          const t = (el.textContent || '').trim()
          if (!t || /^\+\d|\d+\s*tags?|tags\s*\+|more/i.test(t)) return false
          return isVisibleEl(el)
        }),
      )
    }

    const details = root.querySelector(
      'details.manuscript__craft-tags-disclosure, details.manuscript__craft-tags, details:has(.manuscript__craft-tag)',
    )
    const collapsedDisclosure = details
      ? !details.open
      : !!root.querySelector('button[aria-label*="Tags" i][aria-expanded="false"]')
    const foundStrip = strips.length > 0 || !!details
    // Absence is NOT collapsed (rule 4). chips===0 alone must never pass phone collapse.
    const craftCollapsedDefault = foundStrip
      ? !!collapsedDisclosure || (details ? !details.open && chips.length === 0 : false)
      : null

    return {
      chipVisibleCount: chips.length,
      chipLabels: chips.slice(0, 12).map((chip) => (chip.textContent || '').trim()),
      hasOverflowControl: !!details,
      craftCollapsedDefault,
      foundStrip,
      notMeasured: !foundStrip,
      reason: foundStrip ? null : 'craft surface selectors matched nothing',
      detailsOpen: details ? !!details.open : null,
    }
  }, BROWSER_IS_VISIBLE_SOURCE)
}

async function measureCanon(page) {
  return page.evaluate((visSrc) => {
    // eslint-disable-next-line no-new-func
    const { isVisibleEl } = new Function(`${visSrc}; return { isVisibleEl }`)()
    const root =
      document.querySelector('.graph') ||
      document.querySelector('[aria-label*="Canon" i]') ||
      document.querySelector('#workspace')
    if (!root) return { missing: true }

    const proposeDetails = root.querySelector('details.graph__propose, details[aria-label*="Propose" i], details:has(summary)')
    const proposeForm = root.querySelector('form, [aria-label*="Propose" i], .graph__propose, .canon-propose')
    const proposeInputs = proposeForm
      ? [...proposeForm.querySelectorAll('input, textarea, select')].filter((el) => isVisibleEl(el))
      : []
    // Closed details => not expanded, regardless of layout boxes inside.
    const proposeExpanded = proposeDetails
      ? !!proposeDetails.open && proposeInputs.length >= 2
      : proposeInputs.length >= 2
    const viewSwitch = root.querySelector('[aria-label*="view" i], .graph__views, [role="tablist"]')
    const kindFilter = root.querySelector('[aria-label*="kind" i], .graph__kinds, .graph__filters')

    function weight(el) {
      if (!el) return 0
      const cls = el.className?.toString?.() || ''
      let w = 1
      if (cls.includes('primary') || cls.includes('accent')) w += 2
      const pressed = el.querySelector?.('[aria-pressed="true"], [aria-selected="true"]')
      if (pressed) w += 1
      return w
    }

    return {
      proposeExpanded,
      viewWeight: weight(viewSwitch),
      filterWeight: weight(kindFilter),
    }
  }, BROWSER_IS_VISIBLE_SOURCE)
}

async function measureFocus(page) {
  const focusBtn = page.getByRole('button', { name: /Focus mode|Exit focus mode/i }).first()
  if (!(await focusBtn.count())) return { missing: true }
  const before = await page.evaluate(() => ({
    binder: !!document.querySelector('.shell__rail--binder'),
    agent: !!document.querySelector('.panel[data-companion-context]'),
    focus: document.querySelector('.shell')?.getAttribute('data-focus'),
  }))
  const label = await focusBtn.getAttribute('aria-label')
  if (/Focus mode/i.test(label || '') && !/Exit/i.test(label || '')) {
    await focusBtn.click()
    await page.waitForTimeout(200)
  }
  const during = await page.evaluate(() => ({
    binder: !!document.querySelector('.shell__rail--binder'),
    agentRail: !!document.querySelector('.shell__rail--agent'),
    agentPanel: !!document.querySelector('.panel[data-companion-context]'),
    focus: document.querySelector('.shell')?.getAttribute('data-focus'),
    work: !!document.querySelector('#workspace, .manuscript'),
  }))
  const exit = page.getByRole('button', { name: /Exit focus mode/i }).first()
  if (await exit.count()) {
    await exit.click()
    await page.waitForTimeout(200)
  }
  return { before, during, ok: during.focus === 'true' && !during.binder && during.work }
}

/**
 * Viewport-wide solid primary count grouped by job key (ox one-primary-door-per-job).
 * Same accessible name (or data-job) + solid/primary recipe across binder/fold/companion
 * is one job. Expect at most one solid primary per job when dual-rail empty fixtures run.
 *
 * Letter vs spirit (ox empty-canon-send-proposal-weight): a historical canon-empty PASS with
 * solids=2 was CORRECT by job grouping when those solids were map New sheet + Send proposal
 * (different jobs). Do not "fix" that by collapsing distinct jobs. Product must omit solid
 * Send while sheets<2; checker additionally asserts no Send primary on true-empty fold.
 * Solids inside closed <details> are excluded (IM1 / not painted) — see self-test.
 */
async function measurePrimaryPerJob(page) {
  return page.evaluate((visSrc) => {
    // eslint-disable-next-line no-new-func
    const { isVisibleEl } = new Function(`${visSrc}; return { isVisibleEl }`)()

    function regionOf(el) {
      if (el.closest('.shell__rail--binder, [data-binder-stack], aside.shell__rail--binder')) return 'binder'
      if (el.closest('.panel[data-companion-context], .shell__rail--agent, aside.shell__rail--agent')) return 'companion'
      if (el.closest('.shell__topbar')) return 'topbar'
      if (el.closest('main, #workspace, .graph, .shell__work, .manuscript, .lab')) return 'fold'
      return 'other'
    }

    function jobKey(name, el) {
      const dataJob = el.getAttribute('data-job')
      if (dataJob) return dataJob.trim().toLowerCase()
      const n = name.trim().replace(/\s+/g, ' ')
      if (!n) return null
      // Place switches / face tabs are wayfinding, not create jobs.
      if (/^(Draft|Lab|Canon|Chat|Write|Check|Inbox|Research|Spark|Inspect|More)$/i.test(n)) return null
      if (/^Inbox\s*\d+$/i.test(n)) return null
      if (/hide binder|show binder|hide companion|show companion|focus|theme|project/i.test(n)) return null
      // Create-chapter cluster (binder + companion + center empty door).
      if (/^(new chapter|write first chapter|write)$/i.test(n)) return 'create-chapter'
      // Create-sheet cluster (binder + map empty CTA).
      if (/^new sheet$/i.test(n)) return 'create-sheet'
      // Open lab is a different job from create-chapter.
      if (/^(open lab|start in lab)$/i.test(n)) return 'open-lab'
      // Remaining solid buttons keep their accessible name as job key.
      return n.toLowerCase()
    }

    function insideClosedDetails(el) {
      // IM1: closed <details> guts are not painted; never count as solid primaries.
      let node = el
      while (node && node !== document.documentElement) {
        const parent = node.parentElement
        if (parent && parent.tagName === 'DETAILS' && !parent.open) {
          if (node.tagName === 'SUMMARY') return false
          return true
        }
        node = parent
      }
      return false
    }

    const controls = [...document.querySelectorAll('button, [role="button"], a.ui-button')]
    const solids = []
    for (const el of controls) {
      if (!isVisibleEl(el)) continue
      if (insideClosedDetails(el)) continue
      // Face tabs are role=tab — never job primaries even if painted primary.
      if (el.getAttribute('role') === 'tab') continue
      const cls = el.className?.toString?.() || ''
      const isPrimary = cls.includes('ui-button--primary')
        || cls.includes('--primary')
        || el.getAttribute('data-variant') === 'primary'
      if (!isPrimary) continue
      const name = (el.getAttribute('aria-label') || el.textContent || '').trim().replace(/\s+/g, ' ')
      const job = jobKey(name, el)
      if (!job) continue
      solids.push({
        job,
        name,
        region: regionOf(el),
      })
    }

    const byJob = new Map()
    for (const item of solids) {
      const list = byJob.get(item.job) || []
      list.push(item)
      byJob.set(item.job, list)
    }
    const jobs = [...byJob.entries()].map(([job, items]) => ({
      job,
      count: items.length,
      items,
    }))
    const offenders = jobs.filter((j) => j.count > 1)
    return {
      solidCount: solids.length,
      jobs,
      offenders,
      maxPerJob: jobs.reduce((m, j) => Math.max(m, j.count), 0),
      graphEmpty: document.querySelector('[data-graph-empty]')?.getAttribute('data-graph-empty') || null,
      canonEmpty: document.querySelector('[data-canon-empty]')?.getAttribute('data-canon-empty') || null,
      hasDraftMain: !!document.querySelector('main[aria-label="Draft"]'),
      hasCanonMain: !!(
        document.querySelector('main[aria-label="Relationship graph"]')
        || document.querySelector('[aria-label="Relationship graph"]')
        || document.querySelector('.graph')
      ),
    }
  }, BROWSER_IS_VISIBLE_SOURCE)
}

/**
 * Empty-product fixtures for B6-primary-per-job (ox composition rule).
 * Uses claimEmptyProject so zero-chapter / zero-sheet is a real New-project state (koala).
 * Dual-rail @1440 only — that is where binder + fold + companion share one viewport.
 */

/**
 * Measure Inbox face under a known pending volume.
 * Wall signals (AV): many visible proposal cards packed on first screen,
 * and/or panel grows with content (scrollH≈clientH) instead of internal scroll.
 */
async function measureInboxWall(page) {
  return page.evaluate((visSrc) => {
    // eslint-disable-next-line no-new-func
    const { isVisibleEl, isVisiblyPainted } = new Function(`${visSrc}; return { isVisibleEl, isVisiblyPainted }`)()
    const panel = document.querySelector('.panel[data-companion-context], [data-companion-face]')
    const face = panel?.getAttribute('data-companion-face') || null
    const cards = [...document.querySelectorAll(
      '.proposal-card, article.proposal, [data-proposal-id], [aria-label="Pending proposals"] article, [aria-label="Pending proposals"] li, .companion__inbox-list article, .companion__inbox-list li, .companion__inbox-more article, .companion__inbox-more li, [data-inbox-card]',
    )]
    const visibleCards = cards.filter((c) => {
      try {
        if (typeof isVisibleEl === 'function') return !!isVisibleEl(c)
        return !!isVisiblyPainted(c).visible
      } catch {
        return false
      }
    })
    const badge = [...document.querySelectorAll('button, [role="tab"]')]
      .find((el) => /^Inbox/i.test((el.textContent || '').trim()))
    const scrollH = panel?.scrollHeight ?? 0
    const clientH = panel?.clientHeight ?? 0
    const internalScroll = scrollH > clientH + 4
    const denseCount = visibleCards.length >= 12
    const growsNotScrolls = visibleCards.length >= 8 && !internalScroll
    const inboxWall = denseCount || growsNotScrolls
    return {
      face,
      cardDom: cards.length,
      cardVisible: visibleCards.length,
      badgeText: (badge?.textContent || '').trim() || null,
      scrollH,
      clientH,
      internalScroll,
      denseCount,
      growsNotScrolls,
      inboxWall,
    }
  }, BROWSER_IS_VISIBLE_SOURCE)
}

function makeVolumeProposals(count, chapterId) {
  const proposals = []
  for (let i = 0; i < count; i++) {
    proposals.push({
      id: 'prop-b3-wall-' + (i + 1),
      fingerprint: 'fp-b3-wall-' + (i + 1),
      status: 'pending',
      entityName: 'Entity ' + (i + 1),
      sheetKind: 'character',
      key: 'attr_' + (i + 1),
      value: 'value-' + (i + 1),
      statement: 'Entity ' + (i + 1) + ' has attr ' + (i + 1),
      claimKind: 'attribute',
      confidence: 0.9,
      source: { chapterId, start: 0, end: 4, text: 'Aria' },
    })
  }
  return proposals
}

/**
 * B3-inbox-wall at volume: private project + 30 pending proposals.
 * Measures the Inbox face (not Chat). Expected HARD-red until product scrollport/fold lands.
 */
async function runInboxWallFixture(browser) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  page.setDefaultTimeout(12000)
  const VOLUME = 30
  try {
    await installFixtureLlmRoutes(page)
    const projectId = await ensureIsolatedProject(page, {
      id: 'e2e-calm-inbox-wall-' + process.pid + '-' + Date.now().toString(36),
      title: 'E2E Calm Inbox Wall',
    })
    await page.goto(UI, { waitUntil: 'networkidle' })
    await reclaimIsolatedProject(projectId)
    await ensureDraftReady(page, {
      body: 'Aria opened the iron door for inbox wall measure.',
      title: 'Chapter One',
      craftTags: ['setup'],
    })
    const current = await fetchActiveProject()
    const chapterId = current && current.chapters && current.chapters[0] && current.chapters[0].id
    if (!chapterId) {
      throw new PreconditionError('precondition not met: inbox-wall fixture needs a chapter')
    }
    const seeded = {
      ...current,
      proposals: [
        ...(current.proposals || []).filter((p) => p.status !== 'pending'),
        ...makeVolumeProposals(VOLUME, chapterId),
      ],
    }
    const putResult = await page.evaluate(async (project) => {
      const res = await fetch('/api/project', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(project),
      })
      const text = await res.text()
      return { ok: res.ok, status: res.status, text: text.slice(0, 200) }
    }, seeded)
    if (!putResult.ok) {
      throw new PreconditionError(
        'precondition not met: seed 30 proposals failed (' + putResult.status + ' ' + putResult.text + ')',
      )
    }
    await reclaimIsolatedProject(projectId)
    await reloadApp(page)
    await reclaimIsolatedProject(projectId)
    await ensureCompanionOpen(page)
    await enterWorkspaceForMeasure(page, 'draft', projectId)
    await requireCompanionFace(page, 'Inbox')

    const proof = await page.evaluate(async () => {
      const project = await fetch('/api/project').then((r) => r.json())
      return {
        pending: (project.proposals || []).filter((p) => p.status === 'pending').length,
      }
    })
    if (proof.pending < VOLUME) {
      throw new PreconditionError(
        'precondition not met: inbox-wall seed volume want ' + VOLUME + ' pending got ' + proof.pending,
      )
    }

    const measured = await measureInboxWall(page)
    // Measurement must distinguish: empty-and-ok vs could-not-find.
    // pending>=8 with cardVisible===0 is NOT-MEASURED (octopus instance + class API).
    // inboxWall===false alone at cardVisible===0 was pass-on-absence (rule 4).
    // Selectors include companion inbox fold hooks (octopus 11463e4).
    let inboxMeasure
    if (measured.face && !/^inbox$/i.test(measured.face)) {
      inboxMeasure = notFound('Inbox face not proven (face=' + measured.face + ')')
    } else if (proof.pending >= 8 && measured.cardVisible === 0) {
      inboxMeasure = notFound(
        'pending=' + proof.pending + ' cardVisible=0 cardDom=' + measured.cardDom
          + ' badge=' + measured.badgeText + ' (seeded proposals not seen)',
      )
    } else if (!measured.face && measured.cardDom === 0 && measured.cardVisible === 0) {
      inboxMeasure = notFound('Inbox surface produced no face attr and no proposal cards')
    } else {
      inboxMeasure = found(measured)
    }
    // Honest red while product packs all cards / grows the panel.
    // Pass criteria (ox AV): internal scrollport + not a dense first-screen wall.
    judgeMeasured(
      'B3-inbox-wall@volume',
      'HARD',
      'CALM_BUDGET.md B3-inbox-wall · Inbox at 30 pending is not a wall (internal scroll + calm fold)',
      'companion Inbox@1440 volume=30',
      inboxMeasure,
      {
        pass: (v) => v.inboxWall === false,
        measured: (v) =>
          'inboxWall=' + v.inboxWall
          + ' cardVisible=' + v.cardVisible
          + ' pending=' + proof.pending
          + ' scrollH=' + v.scrollH
          + ' clientH=' + v.clientH
          + ' internalScroll=' + v.internalScroll
          + ' badge=' + v.badgeText,
        threshold: 'inboxWall=false at volume 30; cardVisible>0 when pending>=8',
      },
    )
  } finally {
    await page.close()
  }
}

async function runEmptyPrimaryFixtures(browser) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  page.setDefaultTimeout(12000)
  try {
    await installFixtureLlmRoutes(page)
    const emptyId = await claimEmptyProject(page, {
      id: `e2e-calm-empty-${process.pid}-${Date.now().toString(36)}`,
      title: 'E2E Calm Empty',
    })
    await page.goto(UI, { waitUntil: 'networkidle' })
    await reclaimIsolatedProject(emptyId)
    // Desk dual-rail: binder + companion open so composition is visible.
    const railOrigin = { binder: 'default', agent: 'default' }
    await ensureBinderOpen(page, { track: railOrigin })
    await ensureCompanionOpen(page, { track: railOrigin })
    const railNote = formatRailState(await readRailState(page, { origin: railOrigin }))

    // --- Draft empty-project dual-rail ---
    const draftOk = await withSurface('B6-primary-per-job@draft-empty', 'Draft empty@1440 dual-rail', async () => {
      await beforeMeasure(page, {
        projectId: emptyId,
        requireEmpty: true,
        workspace: 'draft',
        ensureCompanion: true,
      })
      return true
    })
    if (draftOk) {
      const draft = await measurePrimaryPerJob(page)
      if (!draft.hasDraftMain) {
        preconditionFail(
          'B6-primary-per-job@draft-empty',
          'Draft empty@1440 dual-rail',
          new PreconditionError('precondition not met: Draft main missing on empty fixture'),
        )
      } else {
        const offenders = (draft.offenders || [])
          .map((o) => `${o.job}=${o.count}[${o.items.map((i) => `${i.region}:${i.name}`).join(' | ')}]`)
          .join('; ')
        add(
          'B6-primary-per-job@draft-empty',
          'HARD',
          'CALM_BUDGET.md B6-primary-per-job · ≤1 solid primary per job (empty Draft dual-rail)',
          'Draft empty@1440 dual-rail',
          (draft.maxPerJob || 0) <= 1,
          `maxPerJob=${draft.maxPerJob || 0} solids=${draft.solidCount}${offenders ? ` offenders=${offenders}` : ''} · ${railNote}`,
          '≤1 solid primary per job',
        )
      }
    }

    // --- Canon true-empty dual-rail ---
    const canonOk = await withSurface('B6-primary-per-job@canon-empty', 'Canon true-empty@1440 dual-rail', async () => {
      await beforeMeasure(page, {
        projectId: emptyId,
        requireEmpty: true,
        workspace: 'canon',
        ensureCompanion: true,
      })
      return true
    })
    if (canonOk) {
      const canon = await measurePrimaryPerJob(page)
      const trueEmpty = canon.graphEmpty === 'canon' || canon.canonEmpty === 'true'
      if (!canon.hasCanonMain || !trueEmpty) {
        preconditionFail(
          'B6-primary-per-job@canon-empty',
          'Canon true-empty@1440 dual-rail',
          new PreconditionError(
            `precondition not met: Canon true-empty not proven (hasCanon=${canon.hasCanonMain} graphEmpty=${canon.graphEmpty} canonEmpty=${canon.canonEmpty})`,
          ),
        )
      } else {
        const offenders = (canon.offenders || [])
          .map((o) => `${o.job}=${o.count}[${o.items.map((i) => `${i.region}:${i.name}`).join(' | ')}]`)
          .join('; ')
        // Spirit (ox): on true-empty fold the only solid create door is New sheet.
        // Send proposal must not be primary while sheets < 2 (omit in product).
        const sendSolid = (canon.jobs || []).some((j) => /send proposal/i.test(j.job) && j.count > 0)
        const sheetSolids = (canon.jobs || []).find((j) => j.job === 'create-sheet')
        const emptyFoldOk = !sendSolid && (sheetSolids?.count || 0) <= 1
        add(
          'B6-primary-per-job@canon-empty',
          'HARD',
          'CALM_BUDGET.md B6-primary-per-job · ≤1 solid primary per job; empty fold solid = New sheet only (no Send)',
          'Canon true-empty@1440 dual-rail',
          (canon.maxPerJob || 0) <= 1 && emptyFoldOk,
          `maxPerJob=${canon.maxPerJob || 0} solids=${canon.solidCount} graphEmpty=${canon.graphEmpty} sendSolid=${sendSolid}${offenders ? ` offenders=${offenders}` : ''} · ${railNote}`,
          '≤1/job; no Send primary while sheets<2',
        )
      }
    }

    return { emptyId }
  } finally {
    await page.close()
  }
}

/** Enter workspace and prove companion context before any face measurement. */
async function enterWorkspaceForMeasure(page, mode, projectId) {
  const spec = resolveWorkspaceMode(mode)
  await beforeMeasure(page, {
    projectId,
    workspace: spec.key,
    ensureCompanion: true,
  })
  return spec
}

async function runViewport(browser, width, height, label, projectId) {
  const page = await browser.newPage({ viewport: { width, height } })
  page.setDefaultTimeout(12000)
  try {
    await installFixtureLlmRoutes(page)
    // Reclaim private per-run project (never doors/default fixtures).
    await reclaimIsolatedProject(projectId)
    await ensureIsolatedProject(page, { id: projectId, title: 'E2E Calm' })
    await page.goto(UI, { waitUntil: 'networkidle' })
    // Fixed craft tag set so B4 craft counts cannot drift across runs.
    await reclaimIsolatedProject(projectId)
    await ensureDraftReady(page, {
      body: 'Aria opened the iron door for calm budget.',
      craftTags: ['char-dev', 'plot-progress', 'world-build', 'setup', 'relationship'],
    })
    // Drop pending proposals so Inbox badges stay count-free for this project.
    await page.evaluate(async () => {
      try {
        const project = await fetch('/api/project').then((r) => r.json())
        const pending = project?.proposals?.filter((p) => p.status === 'pending') || []
        for (const proposal of pending) {
          await fetch(`/api/proposals/${encodeURIComponent(proposal.id)}/reject`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: '{}',
          }).catch(() => {})
        }
      } catch {
        // best effort
      }
    })
    await reclaimIsolatedProject(projectId)
    await reloadApp(page)
    await ensureDraftReady(page, {
      body: 'Aria opened the iron door for calm budget.',
      craftTags: ['char-dev', 'plot-progress', 'world-build', 'setup', 'relationship'],
    })
    // Track whether harness forced rails open (default vs forced provenance).
    const railOrigin = { binder: 'default', agent: 'default' }
    if (width >= 1200) await ensureBinderOpen(page, { track: railOrigin })
    else {
      // Phone: start drawers closed so touch targets are resting chrome, not drawer chrome.
      await dismissDrawers(page)
    }
    // Companion is opened for face measures — mark forced when below desk default-closed.
    await ensureCompanionOpen(page, { track: railOrigin })
    await enterWorkspaceForMeasure(page, 'draft', projectId)
    const railState = await readRailState(page, { origin: railOrigin })

    // --- B1 layout @1440 ---
    if (width >= 1200) {
      const layout = await measureLayout(page)
      const railNote = formatRailState(railState)
      add(
        'B1-work-hard',
        'HARD',
        'CALM_BUDGET.md B1-work-hard · workPct ≥ 40',
        `Draft@${label}`,
        layout.workPct >= 40,
        `workPct=${layout.workPct} · ${railNote}`,
        '≥40',
        undefined,
        undefined,
        { railState },
      )
      add(
        'B1-work-warn',
        'WARN',
        'CALM_BUDGET.md B1-work-warn · workPct < 45 warns',
        `Draft@${label}`,
        layout.workPct >= 45,
        `workPct=${layout.workPct} · ${railNote}`,
        '≥45 preferred (WARN if <45)',
        layout.workPct < 45 ? 'in WARN band' : undefined,
        undefined,
        { railState },
      )
      add(
        'B1-rail-warn',
        'WARN',
        'CALM_BUDGET.md B1-rail-warn · rail>24 or chrome>55',
        `Draft@${label}`,
        !(layout.binderPct > 24 || layout.agentPct > 24 || layout.chromePct > 55),
        `binder=${layout.binderPct} agent=${layout.agentPct} chrome=${layout.chromePct} · ${railNote}`,
        'rails≤24, chrome≤55',
        undefined,
        undefined,
        { railState },
      )
      add(
        'B1-rail-pathological',
        'HARD',
        'CALM_BUDGET.md B1-rail-pathological · rail > work',
        `Draft@${label}`,
        !(layout.binderW > layout.workW || layout.agentW > layout.workW),
        `binderW=${layout.binderW} agentW=${layout.agentW} workW=${layout.workW} · ${railNote}`,
        'each rail ≤ work',
        undefined,
        undefined,
        { railState },
      )
      add(
        'B1-fold',
        'HARD',
        'CALM_BUDGET.md B1-fold · foldOwner = work',
        `Draft@${label}`,
        layout.foldOwner === 'work',
        `foldOwner=${layout.foldOwner}${layout.foldTop ? ` (${layout.foldTop.cls || layout.foldTop.tag})` : ''} · ${railNote}`,
        'work',
        undefined,
        undefined,
        { railState },
      )
    }

    // --- B2 topbar ---
    const topRaw = await measureTopbar(page)
    const topM = topRaw.missing
      ? notFound('shell topbar missing')
      : found(topRaw)
    // Keep `top` for B6-top-job later in this viewport; only judge when found.
    const top = isFound(topM) ? topM.value : { topJobPrimaryCount: undefined, missing: true }
    judgeMeasured(
      `B2-job-primary@${label}`,
      'HARD',
      'CALM_BUDGET.md B2-job-primary · Continuity/Export/Research/Review/New top primary = 0',
      `topbar@${label}`,
      topM,
      {
        pass: (v) => (v.topJobPrimaryCount || 0) === 0,
        measured: (v) =>
          `topJobPrimaryCount=${v.topJobPrimaryCount || 0}${v.jobPrimaryLabels?.length ? ` [${v.jobPrimaryLabels.join(',')}]` : ''}`,
        threshold: '=0',
      },
    )
    judgeMeasured(
      `B2-ecosystem@${label}`,
      'HARD',
      'CALM_BUDGET.md B2-ecosystem · ecosystemVisible = 3',
      `topbar@${label}`,
      topM,
      {
        pass: (v) => v.ecosystemVisible === 3,
        measured: (v) => `ecosystemVisible=${v.ecosystemVisible} [${(v.ecoLabels || []).join(',')}]`,
        threshold: '=3',
      },
    )
    if (width <= 400) {
      judgeMeasured(
        'B2-truncation',
        'HARD',
        'CALM_BUDGET.md B2-truncation · placeLabelClipped = 0 @390',
        'topbar@390',
        topM,
        {
          pass: (v) => (v.placeLabelClipped || 0) === 0,
          measured: (v) => `placeLabelClipped=${v.placeLabelClipped || 0}`,
          threshold: '=0',
        },
      )
      judgeMeasured(
        'B2-top-count-warn',
        'WARN',
        'CALM_BUDGET.md B2-top-count-warn · top controls > 8 without overflow',
        'topbar@390',
        topM,
        {
          pass: (v) => (v.topControlCount || 0) <= 8,
          measured: (v) => `topControlCount=${v.topControlCount || 0}`,
          threshold: '≤8',
        },
      )
    }

    // --- B3 companion writing/chat ---
    const writingOk = await withSurface(`B3-writing-pre@${label}`, `companion writing@${label}`, async () => {
      await enterWorkspaceForMeasure(page, 'draft', projectId)
      await requireCompanionFace(page, 'Chat')
      return true
    })
    if (writingOk) {
      const facesChat = await measureFaces(page, 'writing')
      if (facesChat.missing || facesChat.context !== 'writing') {
        preconditionFail(
          `B3-writing-pre@${label}`,
          `companion writing@${label}`,
          facesChat.reason || `context=${facesChat.context}`,
        )
      } else {
        add(
          `B3-writing-count@${label}`,
          'HARD',
          'CALM_BUDGET.md B3-writing-count · writing faces ≤ 5',
          `companion writing@${label}`,
          facesChat.productFaceCount <= 5,
          `productFaces=${facesChat.productFaceCount} [${facesChat.productFaces.join(' · ')}] more=${facesChat.hasMore} context=${facesChat.context}`,
          '≤5',
        )
        add(
          `B3-default-face@${label}`,
          'HARD',
          'CALM_BUDGET.md B3-default-face · writing default = Chat',
          `companion@${label}`,
          /^chat$/i.test(facesChat.face),
          `face=${facesChat.face} context=${facesChat.context}`,
          'chat',
        )
        // Chat must not dump pending proposals (transcript, not Inbox).
        // Named separately — B3-inbox-wall measures the Inbox face at volume.
        add(
          `B3-chat-proposals-wall@${label}`,
          'HARD',
          'CALM_BUDGET.md B3-chat-proposals-wall · Chat has no proposal dump',
          `companion chat@${label}`,
          facesChat.chatProposalsWall === false,
          `chatProposalsWall=${facesChat.chatProposalsWall}`,
          'false',
        )
        if (width <= 400) {
          add(
            'B3-wrap',
            'HARD',
            'CALM_BUDGET.md B3-wrap · faceRows @390 = 1',
            'companion@390',
            facesChat.faceRows === 1,
            `faceRows=${facesChat.faceRows} labels=[${facesChat.labels.join(' · ')}]`,
            '=1',
          )
          add(
            'B3-overflow-shape',
            'HARD',
            'CALM_BUDGET.md B3-overflow-shape · extras behind one More',
            'companion@390',
            facesChat.faceRows === 1 && (facesChat.productFaceCount <= 5),
            `rows=${facesChat.faceRows} hasMore=${facesChat.hasMore}`,
            'one row; More ok',
          )
        }
        add(
          `B3-footer-primary-chat@${label}`,
          'HARD',
          'CALM_BUDGET.md B3-footer-primary · footer primary ≤ 1',
          `companion chat@${label}`,
          facesChat.footerPrimary <= 1,
          `footerPrimary=${facesChat.footerPrimary}`,
          '≤1',
        )
        add(
          `B3-footer-total-chat@${label}`,
          facesChat.footerTotal >= 4 ? 'HARD' : 'WARN',
          'CALM_BUDGET.md B3-footer-total · ≤3 WARN, ≥4 HARD',
          `companion chat@${label}`,
          facesChat.footerTotal <= 3,
          `footerTotal=${facesChat.footerTotal}`,
          '≤3',
        )

        const checkOk = await withSurface(`B3-check-pre@${label}`, `companion Check@${label}`, async () => {
          await openCompanionFace(companionPanel(page), 'Check', { require: true })
          return true
        })
        if (checkOk) {
          const facesCheck = await measureFaces(page, 'writing')
          if (facesCheck.missing || facesCheck.context !== 'writing' || facesCheck.face !== 'check') {
            preconditionFail(
              `B3-check-pre@${label}`,
              `companion Check@${label}`,
              `context=${facesCheck.context} face=${facesCheck.face}`,
            )
          } else {
            add(
              `B3-rest@${label}`,
              'HARD',
              'CALM_BUDGET.md B3-rest · Check resting helper or last-run status',
              `companion Check@${label}`,
              facesCheck.checkRestHasStatus === true,
              `checkRestHasStatus=${facesCheck.checkRestHasStatus}`,
              'true',
            )
            add(
              `B3-footer-primary-check@${label}`,
              'HARD',
              'CALM_BUDGET.md B3-footer-primary · footer primary ≤ 1',
              `companion Check@${label}`,
              facesCheck.footerPrimary <= 1,
              `footerPrimary=${facesCheck.footerPrimary}`,
              '≤1',
            )
          }
        }
      }
    }

    // Lab faces
    const labOk = await withSurface(`B3-lab-pre@${label}`, `companion lab@${label}`, async () => {
      await enterWorkspaceForMeasure(page, 'lab', projectId)
      return true
    })
    if (labOk) {
      const labFaces = await measureFaces(page, 'lab')
      if (labFaces.missing || labFaces.context !== 'lab') {
        preconditionFail(`B3-lab-pre@${label}`, `companion lab@${label}`, labFaces.reason || `context=${labFaces.context}`)
      } else {
        add(
          `B3-lab-count@${label}`,
          'HARD',
          'CALM_BUDGET.md B3-lab-count · lab faces ≤ 3',
          `companion lab@${label}`,
          labFaces.productFaceCount <= 3,
          `productFaces=${labFaces.productFaceCount} [${labFaces.productFaces.join(' · ')}] context=${labFaces.context}`,
          '≤3',
        )
      }
    }

    // Graph/Canon faces
    const graphOk = await withSurface(`B3-graph-pre@${label}`, `companion graph@${label}`, async () => {
      await enterWorkspaceForMeasure(page, 'canon', projectId)
      return true
    })
    if (graphOk) {
      const graphFaces = await measureFaces(page, 'graph')
      if (graphFaces.missing || graphFaces.context !== 'graph') {
        preconditionFail(
          `B3-graph-pre@${label}`,
          `companion graph@${label}`,
          graphFaces.reason || `context=${graphFaces.context}`,
        )
      } else {
        add(
          `B3-graph-count@${label}`,
          'HARD',
          'CALM_BUDGET.md B3-graph-count · graph faces ≤ 3',
          `companion graph@${label}`,
          graphFaces.productFaceCount <= 3,
          `productFaces=${graphFaces.productFaceCount} [${graphFaces.productFaces.join(' · ')}] context=${graphFaces.context}`,
          '≤3',
        )
      }
    }

    // --- B4 Lab ---
    const labSurfaceOk = await withSurface(`B4-lab-pre@${label}`, `Lab@${label}`, async () => {
      await beforeMeasure(page, { projectId, workspace: 'lab' })
      return true
    })
    if (labSurfaceOk) {
      const labRaw = await measureLab(page)
      const labM = labRaw.missing
        ? notFound('Lab root missing')
        : found(labRaw)
      // cards===0 is intentional empty → found. Root missing → notFound.
      judgeMeasured(
        `B4-lab-empty-filter@${label}`,
        'HARD',
        'CALM_BUDGET.md B4-lab-empty-filter · no filter when cards=0',
        `Lab@${label}`,
        labM,
        {
          pass: (v) => v.labFilterWhenEmpty === false,
          measured: (v) => `cards=${v.cardCount} filterWhenEmpty=${v.labFilterWhenEmpty}`,
          threshold: 'false',
        },
      )
      judgeMeasured(
        `B4-lab-kind-strips@${label}`,
        'HARD',
        'CALM_BUDGET.md B4-lab-kind-strips · kindFullStrips ≤ 1',
        `Lab@${label}`,
        labM,
        {
          pass: (v) => v.kindFullStrips <= 1,
          measured: (v) => `kindFullStrips=${v.kindFullStrips}`,
          threshold: '≤1',
        },
      )
    }

    // Craft on Draft
    const draftCraftOk = await withSurface(`B4-craft-pre@${label}`, `Draft craft@${label}`, async () => {
      await beforeMeasure(page, { projectId, workspace: 'draft' })
      return true
    })
    if (draftCraftOk) {
      const craftRaw = await measureCraft(page)
      const craftM = (craftRaw.missing || craftRaw.notMeasured || !craftRaw.foundStrip)
        ? notFound(craftRaw.reason || 'craft surface selectors matched nothing', { raw: craftRaw })
        : found(craftRaw)
      if (width >= 1200) {
        judgeMeasured(
          'B4-craft-desktop',
          'HARD',
          'CALM_BUDGET.md B4-craft-desktop · craft visible ≤ 5 + overflow',
          'Draft craft@1440',
          craftM,
          {
            pass: (v) => v.chipVisibleCount <= 5,
            measured: (v) =>
              `chipVisibleCount=${v.chipVisibleCount} [${(v.chipLabels || []).join(',')}] foundStrip=${v.foundStrip}`,
            threshold: '≤5',
          },
        )
      } else {
        judgeMeasured(
          'B4-craft-phone',
          'HARD',
          'CALM_BUDGET.md B4-craft-phone · craft collapsed disclosure default @390',
          'Draft craft@390',
          craftM,
          {
            pass: (v) => v.craftCollapsedDefault === true,
            measured: (v) =>
              `collapsed=${v.craftCollapsedDefault} chips=${v.chipVisibleCount} detailsOpen=${v.detailsOpen}`,
            threshold: 'true (disclosure collapsed; absence ≠ pass)',
          },
        )
      }
    }

    // Canon WARN until D4
    const canonOk = await withSurface(`B4-canon-pre@${label}`, `Canon@${label}`, async () => {
      await beforeMeasure(page, { projectId, workspace: 'canon' })
      return true
    })
    if (canonOk) {
      const canon = await measureCanon(page)
      if (!canon.missing) {
        add(
          `B4-canon-propose@${label}`,
          'WARN',
          'CALM_BUDGET.md B4-canon-propose · propose collapsed until D4 (WARN)',
          `Canon@${label}`,
          canon.proposeExpanded === false,
          `proposeExpanded=${canon.proposeExpanded}`,
          'collapsed',
        )
        add(
          `B4-canon-view@${label}`,
          'WARN',
          'CALM_BUDGET.md B4-canon-view · view accent > kind filter (WARN pre-D4)',
          `Canon@${label}`,
          canon.viewWeight >= canon.filterWeight,
          `viewW=${canon.viewWeight} filterW=${canon.filterWeight}`,
          'view ≥ filter',
        )
      }
    }

    // --- B5 touch + overflow @390 ---
    if (width <= 400) {
      await dismissDrawers(page)
      await ensureCompanionOpen(page)
      const touch = await measureTouchChrome(page)
      const touchSampleLine = touch.samples?.length
        ? ` samples=[${formatTouchSamples(touch.samples)}]`
        : ''
      add(
        'B5-touch-chrome',
        'HARD',
        'CALM_BUDGET.md B5-touch-chrome · min hit ≥ 44×44 chrome @390',
        'chrome@390',
        touch.touchFailChrome === 0,
        `touchFailChrome=${touch.touchFailChrome}${touchSampleLine}`,
        '=0 fails',
        undefined,
        touch.samples,
      )
      add(
        'B5-touch-fail',
        'HARD',
        'CALM_BUDGET.md B5-touch-fail · touchFailChrome = 0',
        'chrome@390',
        touch.touchFailChrome === 0,
        `touchFailChrome=${touch.touchFailChrome}${touchSampleLine}`,
        '=0',
        undefined,
        touch.samples,
      )
    }

    const layoutX = await measureLayout(page)
    add(
      `B5-overflow@${label}`,
      'HARD',
      'CALM_BUDGET.md B5-overflow · overflowX = false',
      `shell@${label}`,
      layoutX.overflowX === false,
      `overflowX=${layoutX.overflowX}`,
      'false',
    )

    if (width >= 1200) {
      const focusDraftOk = await withSurface('B5-focus-pre', 'Focus mode', async () => {
        await beforeMeasure(page, { projectId, workspace: 'draft' })
        return true
      })
      if (focusDraftOk) {
        const focus = await measureFocus(page)
        add(
          'B5-focus',
          'HARD',
          'CALM_BUDGET.md B5-focus · Focus hides rails; type column only',
          'Focus mode',
          focus.ok === true,
          `focus=${focus.during?.focus} binder=${focus.during?.binder} work=${focus.during?.work}`,
          'focus + work, no binder',
        )
      }
    }

    if (width >= 1200) {
      judgeMeasured(
        'B6-top-job',
        'HARD',
        'CALM_BUDGET.md B6-top-job · solid job primaries = 0',
        'topbar',
        top.missing ? notFound('shell topbar missing') : found(top),
        {
          pass: (v) => (v.topJobPrimaryCount || 0) === 0,
          measured: (v) => `topJobPrimaryCount=${v.topJobPrimaryCount || 0}`,
          threshold: '=0',
        },
      )
    }

    return { label, width, height }
  } finally {
    await page.close()
  }
}

function renderMarkdown(meta) {
  const hardFails = checks.filter((c) => !c.pass && c.sev === 'HARD')
  const notMeasured = checks.filter(isNotMeasuredCheck)
  const preconditions = checks.filter((c) => outcomeOf(c) === 'precondition')
  const warns = checks.filter((c) => !c.pass && c.sev === 'WARN')
  const passes = checks.filter((c) => c.pass)
  const rows = checks
    .map((c) => {
      const status = statusLabel(c)
      return `| ${status} | ${c.id} | ${c.sev} | ${c.measured.replace(/\|/g, '/')} | ${c.threshold.replace(/\|/g, '/')} | ${c.surface} | ${c.doc} |`
    })
    .join('\n')

  return `# CALM_BUDGET run

**When:** ${meta.when}
**UI:** ${meta.ui}
**HEAD:** ${meta.head} (${meta.headFull || meta.head})
**Owned:** ${meta.owned ? 'yes (ephemeral stack)' : 'external (STORYLINT_ALLOW_EXTERNAL_UI=1)'}
**UI:** ${meta.ui}
**API:** ${meta.api || ''}
**Shell.css:** local#${meta.shellCss?.sha256_12 || '?'} served#${meta.served?.sha256_12 || meta.served?.error || '?'}
**Dirty tree:** ${meta.dirty ? 'yes' : 'no'}
**Helpers:** required e2e/helpers.mjs (no self-contained fallback)
**Project:** ${meta.projectId}

## Summary

| | Count |
|--|--:|
| PASS | ${passes.length} |
| WARN (fail band) | ${warns.length} |
| HARD FAIL | ${hardFails.length} |
| NOT-MEASURED | ${notMeasured.length} |
| PRECONDITION | ${preconditions.length} |
| Total checks | ${checks.length} |

**Exit:** ${hardFails.length ? 'nonzero (HARD fail)' : 'zero (no HARD fail)'}
**Line:** HARD fails: ${hardFails.length} · NOT-MEASURED: ${notMeasured.length} · checks: ${checks.length}

## Scoreboard

| Status | ID | Sev | Measured | Threshold | Surface | Doc |
|--------|----|-----|----------|-----------|---------|-----|
${rows}

## NOT-MEASURED

${notMeasured.length ? notMeasured.map((c) => `- **${c.id}**: ${c.measured} — ${c.surface}`).join('\n') : '_None._'}

## HARD failures

${hardFails.length ? hardFails.map((c) => `- **${c.id}** [${statusLabel(c)}]: ${c.measured} (want ${c.threshold}) — ${c.doc}`).join('\n') : '_None._'}

## WARN band

${warns.length ? warns.map((c) => `- **${c.id}**: ${c.measured} (want ${c.threshold}) — ${c.doc}`).join('\n') : '_None._'}

## Notes

- Measurements require proven workspace/face preconditions via helpers.
- Wrong-surface PASS is blocked: precondition misses are HARD fails.
- NOT-MEASURED is a HARD fail and a first-class summary count (rule 4 / Measurement API).
- B4-canon-* stay WARN until D4 lands (doc).
- Offline fixture LLM routes installed; no live model.
`
}

const clearHardTimeout = armHardTimeout('calm-budget', 300_000)
mkdirSync(OUT_DIR, { recursive: true })
console.log('helpers: required e2e/helpers.mjs')

// Own the measurement stack (build + ephemeral ports + provenance).
// Fail closed BEFORE any PASS/FAIL if we cannot prove what we measure.
let stack
try {
  stack = await resolveMeasurementTarget()
} catch (error) {
  console.error('REFUSE: ' + (error instanceof Error ? error.message : String(error)))
  console.error('A measurement that cannot name what it measured is not evidence.')
  process.exit(2)
}

UI = stack.ui
setApiBase(stack.api)

const served = stack.proof?.liveCss || (await servedBundleIdentity(UI))
const head = stack.shortHead
const runMeta = {
  head,
  headFull: stack.head,
  ui: UI,
  api: stack.api,
  owned: stack.owned,
  dirty: stack.dirty,
  shellCss: stack.shellCss,
  served,
  provenance: stack.provenance,
}
globalThis.__CALM_META__ = runMeta
printRunIdentity(runMeta, 'run-start')
console.log(`[owned=${stack.owned}] api=${stack.api} ui=${stack.ui} head=${stack.head}`)

const browser = await chromium.launch({ channel: 'msedge', headless: true })

// Visibility self-test once per run — refuse if closed <details> looks painted.
{
  const probe = await browser.newPage()
  try {
    await assertVisibilityPredicate(probe)
    console.log('[visibility-self-test] ok (closed details hidden; summary + open content visible)')
  } catch (error) {
    console.error('REFUSE (visibility): ' + (error instanceof Error ? error.message : String(error)))
    try { await probe.close() } catch { /* ignore */ }
    try { await browser.close() } catch { /* ignore */ }
    try { await stack.stop() } catch { /* ignore */ }
    clearHardTimeout()
    process.exit(2)
  }
  await probe.close()
}

// B6 rule-3 self-test: closed details solid must NOT count; open details solid MUST count.
// Uses the same isVisibleEl + insideClosedDetails path as measurePrimaryPerJob.
{
  const probe = await browser.newPage()
  try {
    await probe.setContent(`<!doctype html>
<html><body>
<style>.ui-button--primary{font-weight:700}</style>
<details id="d">
  <summary id="s">Propose new edge</summary>
  <button id="send" type="button" class="ui-button ui-button--primary">Send proposal</button>
</details>
<button id="open-solid" type="button" class="ui-button ui-button--primary">New sheet</button>
</body></html>`)
    const result = await probe.evaluate((visSrc) => {
      // eslint-disable-next-line no-new-func
      const { isVisibleEl } = new Function(`${visSrc}; return { isVisibleEl }`)()
      function insideClosedDetails(el) {
        let node = el
        while (node && node !== document.documentElement) {
          const parent = node.parentElement
          if (parent && parent.tagName === 'DETAILS' && !parent.open) {
            if (node.tagName === 'SUMMARY') return false
            return true
          }
          node = parent
        }
        return false
      }
      function countSolids() {
        const out = []
        for (const el of document.querySelectorAll('button, [role="button"], a.ui-button')) {
          if (!isVisibleEl(el)) continue
          if (insideClosedDetails(el)) continue
          const cls = el.className?.toString?.() || ''
          if (!cls.includes('ui-button--primary')) continue
          out.push((el.textContent || '').trim())
        }
        return out
      }
      const closed = countSolids()
      const details = document.getElementById('d')
      details.open = true
      void details.offsetHeight
      const open = countSolids()
      return { closed, open }
    }, BROWSER_IS_VISIBLE_SOURCE)

    const closedOk = result.closed.length === 1 && result.closed[0] === 'New sheet'
      && !result.closed.includes('Send proposal')
    const openOk = result.open.includes('Send proposal') && result.open.includes('New sheet')
    if (!closedOk || !openOk) {
      const detail = 'closed=' + JSON.stringify(result.closed) + ' open=' + JSON.stringify(result.open)
      throw new PreconditionError(
        'precondition not met: B6 closed-details primary self-test failed (' + detail + '; closed must drop Send, open must include Send)',
      )
    }
    console.log('[b6-primary-visibility-self-test] ok (closed details solid excluded; open included)')
  } catch (error) {
    console.error('REFUSE (b6-primary-visibility): ' + (error instanceof Error ? error.message : String(error)))
    try { await probe.close() } catch { /* ignore */ }
    try { await browser.close() } catch { /* ignore */ }
    try { await stack.stop() } catch { /* ignore */ }
    clearHardTimeout()
    process.exit(2)
  }
  await probe.close()
}

// One isolated project for the whole run so both viewports share stable state.
let projectId = null
try {
  const bootstrap = await browser.newPage()
  projectId = await ensureIsolatedProject(bootstrap, {
    id: `e2e-calm-${process.pid}-${Date.now().toString(36)}`,
    title: 'E2E Calm',
  })
  await bootstrap.close()

  await runViewport(browser, 1440, 900, '1440', projectId)
  await runViewport(browser, 390, 844, '390', projectId)
  // Empty fixtures after populated run so they own a clean zero-content project.
  await runEmptyPrimaryFixtures(browser)
  // Inbox wall at volume — measures Inbox face (not Chat). Honest red until product fold/scrollport.
  await runInboxWallFixture(browser)
} catch (error) {
  if (error instanceof PreconditionError || String(error?.message || error).includes('precondition not met')) {
    console.error('REFUSE (precondition): ' + (error instanceof Error ? error.message : String(error)))
    printRunIdentity(runMeta, 'refuse-identity')
    try { await browser.close() } catch { /* ignore */ }
    try { await stack.stop() } catch { /* ignore */ }
    clearHardTimeout()
    process.exit(2)
  }
  throw error
} finally {
  try { await browser.close() } catch { /* ignore */ }
  try { await stack.stop() } catch { /* ignore */ }
  clearHardTimeout()
}

const hardFailChecks = checks.filter((c) => !c.pass && c.sev === 'HARD')
const notMeasuredChecks = checks.filter(isNotMeasuredCheck)
const hardFails = hardFailChecks.length
const notMeasuredCount = notMeasuredChecks.length
const meta = {
  when: new Date().toISOString(),
  ui: UI,
  api: stack.api,
  head,
  headFull: stack.head,
  owned: stack.owned,
  dirty: stack.dirty,
  projectId,
  shellCss: stack.shellCss,
  served,
  provenance: stack.provenance,
  hardFails,
  notMeasured: notMeasuredCount,
  notMeasuredIds: notMeasuredChecks.map((c) => c.id),
  checks: checks.length,
}
printRunIdentity(meta, hardFails ? 'run-end-HARD' : 'run-end')
const md = renderMarkdown(meta)
writeFileSync(OUT_MD, md)
// Determinism fingerprint: outcome kind is load-bearing (P/F/W/N/X).
// PASS→NOT-MEASURED must move the hash even if measured text collides (crab/rat).
const fingerprint = checks.map((c) => `${c.id}|${outcomeToken(c)}|${c.measured}|${c.threshold}`).join('\n')
writeFileSync(OUT_JSON, JSON.stringify({ meta, checks, fingerprint }, null, 2))
console.log(`\nWrote ${OUT_MD}` + (RECORD_SCOREBOARD ? ' (tracked scoreboard --record)' : ' (untracked run artifact)'))
console.log(`HARD fails: ${hardFails} · NOT-MEASURED: ${notMeasuredCount} · checks: ${checks.length}`)
if (notMeasuredCount) {
  console.log('NOT-MEASURED ids: ' + notMeasuredChecks.map((c) => c.id).join(', '))
  for (const c of notMeasuredChecks) {
    console.log(`  - ${c.id}: ${c.measured} · ${c.surface}`)
  }
}
console.log(`FINGERPRINT ${hashFingerprint(fingerprint)}`)
process.exit(hardFails > 0 ? 1 : 0)

function hashFingerprint(value) {
  let result = 0x811c9dc5
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index)
    result = Math.imul(result, 0x01000193)
  }
  return (result >>> 0).toString(16).padStart(8, '0')
}
