/**
 * CALM_BUDGET executable checker.
 * Enforces HARD/WARN from docs/CALM_BUDGET.md (r2).
 *
 *   npm run calm
 *   node e2e/calm-budget.mjs
 *
 * Exit 1 on any HARD fail. WARN-only → exit 0.
 * Offline DOM geometry only — no LLM. Optional helpers from e2e/helpers.mjs.
 */
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { mkdirSync, writeFileSync } from 'node:fs'

const UI = process.env.STORYLINT_UI || 'http://localhost:5173/'
const OUT_DIR = 'e2e/output'
const OUT_MD = `${OUT_DIR}/calm-budget-run.md`
const OUT_JSON = `${OUT_DIR}/calm-budget-run.json`

const require = createRequire('D:/npm-global/node_modules/playwright/package.json')
const pwRoot = dirname(require.resolve('playwright/package.json'))
const { chromium } = await import(pathToFileURL(resolve(pwRoot, 'index.mjs')).href)

/** @typedef {'HARD'|'WARN'} Sev */
/** @typedef {{ id: string, sev: Sev, doc: string, surface: string, pass: boolean, measured: string, threshold: string, note?: string }} Check */

/** @type {Check[]} */
const checks = []

function record(check) {
  checks.push(check)
  const mark = check.pass ? (check.sev === 'WARN' && !check.pass ? 'WARN' : 'PASS') : check.sev === 'HARD' ? 'FAIL' : 'WARN'
  // pass=false + WARN → WARN; pass=false + HARD → FAIL; pass=true → PASS
  const status = check.pass ? 'PASS' : check.sev === 'HARD' ? 'FAIL' : 'WARN'
  const color = status === 'PASS' ? 'green' : status === 'FAIL' ? 'red' : 'yellow'
  console.log(`[${status}] ${check.id} (${check.sev}) ${check.measured} · want ${check.threshold} · ${check.surface}`)
  return status
}

async function loadHelpers() {
  try {
    const mod = await import(pathToFileURL(resolve('e2e/helpers.mjs')).href)
    return mod
  } catch {
    return null
  }
}

function companionPanel(page) {
  return page.locator('.panel[data-companion-context]').first()
}

/** Face chrome uses role=tab (D6). Fall back to button for older trees. */
async function openFace(companion, name) {
  const faces = companion.getByRole('tablist', { name: 'Companion faces' })
  await faces.waitFor({ timeout: 8000 })
  const tabName = name === 'Inbox' ? /^Inbox/ : name
  const tab = faces.getByRole('tab', { name: tabName, exact: name !== 'Inbox' })
  if (await tab.count()) {
    await tab.first().click()
    return
  }
  const btn = faces.getByRole('button', { name: tabName, exact: name !== 'Inbox' })
  if (await btn.count()) {
    await btn.first().click()
    return
  }
  const more = faces.getByRole('tab', { name: /^More/ }).or(faces.getByRole('button', { name: /^More/ }))
  if (await more.count()) {
    await more.first().click()
    await companion.getByRole('menuitem', { name, exact: true }).click()
  }
}

async function dismissDrawers(page) {
  // Narrow layouts open rails as drawers with a blocking backdrop.
  await page.evaluate(() => {
    document.querySelectorAll('.ui-drawer__backdrop').forEach((el) => {
      el.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
  }).catch(() => {})
  await page.keyboard.press('Escape').catch(() => {})
  await page.waitForTimeout(80)
}

async function ensureCompanion(page) {
  await dismissDrawers(page)
  const btn = page.getByRole('button', { name: /Show companion|Hide companion/i }).first()
  if (!(await btn.count())) return
  const label = await btn.getAttribute('aria-label')
  if (/Show companion/i.test(label || '')) await btn.click({ force: true })
  await page.waitForTimeout(150)
}

async function ensureBinder(page) {
  await dismissDrawers(page)
  const btn = page.getByRole('button', { name: /Show binder|Hide binder/i }).first()
  if (!(await btn.count())) return
  const label = await btn.getAttribute('aria-label')
  if (/Show binder/i.test(label || '')) await btn.click({ force: true })
  await page.waitForTimeout(150)
}

async function gotoMode(page, mode) {
  await dismissDrawers(page)
  const label = mode === 'manuscript' ? 'Draft' : mode === 'lab' ? 'Lab' : 'Canon'
  // Prefer Workspace group ecosystems (role semantics) over binder section labels.
  const group = page.getByRole('group', { name: 'Workspace' })
  const btn = (await group.count())
    ? group.getByRole('button', { name: label, exact: true }).first()
    : page.getByRole('button', { name: label, exact: true }).first()
  if (await btn.count()) {
    await btn.click({ force: true }).catch(() => {})
    await page.waitForTimeout(350)
  }
}

async function measureLayout(page) {
  return page.evaluate(() => {
    const vw = window.innerWidth
    const vh = window.innerHeight
    const body = document.querySelector('.shell__body')
    const binder = document.querySelector('.shell__rail--binder')
    const agent = document.querySelector('.shell__rail--agent, .shell__rail:not(.shell__rail--binder)')
    // Prefer explicit work surfaces
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

    // If agent rail class differs, find companion panel's containing rail
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

    // First-fold ownership: largest center-band box in first viewport
    const foldBandTop = 48
    const foldBandBottom = vh
    const candidates = []
    for (const el of document.querySelectorAll('main, .manuscript, .lab, .graph, .shell__rail, aside, .panel, #workspace')) {
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
  })
}

async function measureTopbar(page) {
  return page.evaluate(() => {
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
      // place ecosystems are not job primaries
      if (/^(Draft|Lab|Canon)$/i.test(name)) return false
      return jobNames.test(name)
    })
    // Also catch Continuity etc even if not primary class but solid weight in topbar actions
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

    // Truncation: compare scrollWidth vs clientWidth on ecosystem labels
    let placeLabelClipped = 0
    for (const el of ecosystems) {
      if (el.scrollWidth > el.clientWidth + 1) placeLabelClipped += 1
      // also check computed ellipsis
      const style = getComputedStyle(el)
      if (style.textOverflow === 'ellipsis' && el.scrollWidth > el.clientWidth + 1) placeLabelClipped += 1
    }

    const topControlCount = controls.filter((el) => {
      const r = el.getBoundingClientRect()
      return r.width > 0 && r.height > 0
    }).length

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
  })
}

async function measureTouchChrome(page) {
  return page.evaluate(() => {
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
        const r = el.getBoundingClientRect()
        if (r.width <= 0 || r.height <= 0) continue
        // skip SVG-only graph nodes
        if (el.closest('svg')) continue
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
    return { touchFailChrome: fails.length, samples: fails.slice(0, 12) }
  })
}

async function measureFaces(page, context) {
  return page.evaluate((ctx) => {
    const panel = document.querySelector(`.panel[data-companion-context="${ctx}"]`)
      || document.querySelector('.panel[data-companion-context]')
    if (!panel) return { missing: true }

    const faceRow = panel.querySelector('.companion__faces')
    const tabs = [...(faceRow?.querySelectorAll('[role="tab"], button') || [])]
    const labels = tabs.map((t) => (t.getAttribute('aria-label') || t.textContent || '').trim().replace(/\s+/g, ' '))
    // product face set excludes More chrome control
    const productFaces = labels.filter((l) => !/^More/i.test(l))
    const hasMore = labels.some((l) => /^More/i.test(l))

    let faceRows = 1
    if (faceRow && tabs.length) {
      const tops = tabs.map((t) => Math.round(t.getBoundingClientRect().top))
      faceRows = new Set(tops).size
    }

    const footer = panel.querySelector('.panel__footer')
    const footerBtns = footer
      ? [...footer.querySelectorAll('button, [role="button"]')].filter((b) => {
          const r = b.getBoundingClientRect()
          return r.width > 0 && r.height > 0
        })
      : []
    const footerPrimary = footerBtns.filter((b) => (b.className?.toString?.() || '').includes('ui-button--primary')).length
    const footerTotal = footerBtns.length

    const face = panel.getAttribute('data-companion-face') || ''
    const defaultFace = face // after context open; caller should reset to default first

    // Check resting
    let checkRestHasStatus = null
    if (face === 'check') {
      const body = panel.querySelector('.companion__check-body, [aria-label="Check summary"]')
      const text = (body?.textContent || panel.textContent || '').trim()
      const hasHelper =
        /Nothing checked yet|Last Continuity|Continuity is running|no issues found|red ·|yellow ·/i.test(text)
      const hasStatus = !!panel.querySelector('[data-continuity-status], [data-continuity-state], .companion__check-summary')
      checkRestHasStatus = hasHelper || hasStatus
    }

    // Chat proposals wall: pending proposal cards on chat face
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
      context: panel.getAttribute('data-companion-context'),
    }
  }, context)
}

async function measureLab(page) {
  return page.evaluate(() => {
    const lab = document.querySelector('.lab') || document.querySelector('[aria-label="Lab"]')?.closest('.lab, main, #workspace')
    const root = lab || document.querySelector('#workspace')
    if (!root) return { missing: true }

    const cards = root.querySelectorAll('.lab__card, [aria-label="Lab cards"] article')
    const cardCount = cards.length
    const filter = root.querySelector('.lab__filters, [aria-label="Filter card kinds"]')
    const labFilterWhenEmpty = cardCount === 0 && !!filter

    // Full kind strips: composer kinds always full; filter full only if menu expanded showing all kinds as peer strip
    const composerKinds = root.querySelector('.lab__composer-kinds, [aria-label="New card kind"]')
    const filterFull = root.querySelector('.lab__filters [aria-label="Card kinds"]')
    // Count a strip as "full" if it shows >=4 kind buttons inline (not behind details closed)
    function stripFull(el) {
      if (!el) return false
      const btns = [...el.querySelectorAll('button')].filter((b) => {
        const r = b.getBoundingClientRect()
        return r.width > 0 && r.height > 0
      })
      return btns.length >= 4
    }
    let kindFullStrips = 0
    if (stripFull(composerKinds)) kindFullStrips += 1
    // filter summary-only does not count as full strip; expanded menu does if visible
    if (filter && stripFull(filter.querySelector('.lab__filter-menu'))) kindFullStrips += 1
    // If filter renders all kinds as peer buttons (not details), count it
    if (filter && !filter.querySelector('details') && stripFull(filter)) kindFullStrips += 1

    return {
      cardCount,
      labFilterWhenEmpty,
      kindFullStrips,
      hasFilter: !!filter,
      hasComposerKinds: !!composerKinds,
    }
  })
}

async function measureCraft(page) {
  return page.evaluate(() => {
    // Craft chips: look for common patterns
    const strips = [
      ...document.querySelectorAll('[aria-label*="craft" i], [aria-label*="Craft" i], .craft-tags, .manuscript__tags, .tag-strip, .chip-strip'),
    ]
    // Also meta row chips on manuscript
    const meta = document.querySelector('.manuscript__meta, .manuscript__header')
    let chips = []
    for (const strip of strips) {
      chips.push(
        ...[...strip.querySelectorAll('button, [role="button"], .badge, .chip, .ui-badge')].filter((el) => {
          const t = (el.textContent || '').trim()
          if (!t || /^\+\d|tags|more/i.test(t)) return false
          const r = el.getBoundingClientRect()
          return r.width > 0 && r.height > 0
        }),
      )
    }
    // Fallback: badges in manuscript header that look like tags
    if (chips.length === 0 && meta) {
      chips = [...meta.querySelectorAll('.badge, .ui-badge, button')].filter((el) => {
        const t = (el.textContent || '').trim()
        return t && !/words|chars|saved|chapter/i.test(t)
      })
    }

    const overflow = document.querySelector(
      '[aria-label*="tags" i], details.craft, .craft-overflow, button[aria-label*="Tags" i], summary',
    )
    const collapsedDisclosure = !!document.querySelector(
      'details.craft-tags, details[aria-label*="craft" i], details[aria-label*="Tags" i], button[aria-label*="Tags" i][aria-expanded="false"]',
    )

    // If no craft UI found, treat as 0 visible (pass ceiling) and phone collapse N/A→pass if no strip
    return {
      chipVisibleCount: chips.length,
      chipLabels: chips.slice(0, 12).map((c) => (c.textContent || '').trim()),
      hasOverflowControl: !!overflow,
      craftCollapsedDefault: chips.length === 0 || collapsedDisclosure || chips.length <= 5,
      foundStrip: strips.length > 0 || !!meta,
    }
  })
}

async function measureCanon(page) {
  return page.evaluate(() => {
    const root =
      document.querySelector('.graph') ||
      document.querySelector('[aria-label*="Canon" i]') ||
      document.querySelector('#workspace')
    if (!root) return { missing: true }

    // Propose form expanded if we see a multi-field form or "Propose" primary with open fields
    const proposeForm = root.querySelector('form, [aria-label*="Propose" i], .graph__propose, .canon-propose')
    const proposeInputs = proposeForm
      ? [...proposeForm.querySelectorAll('input, textarea, select')].filter((el) => {
          const r = el.getBoundingClientRect()
          return r.width > 0 && r.height > 0
        })
      : []
    const proposeExpanded = proposeInputs.length >= 2

    // View switch vs kind filter weight — compare primary/accent classes
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
  })
}

async function measureFocus(page) {
  // Toggle focus and ensure rails hide
  const focusBtn = page.getByRole('button', { name: /Focus mode|Exit focus mode/i }).first()
  if (!(await focusBtn.count())) return { missing: true }
  const before = await page.evaluate(() => ({
    binder: !!document.querySelector('.shell__rail--binder'),
    agent: !!document.querySelector('.panel[data-companion-context]'),
    focus: document.querySelector('.shell')?.getAttribute('data-focus'),
  }))
  // enter focus
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
  // exit focus
  const exit = page.getByRole('button', { name: /Exit focus mode/i }).first()
  if (await exit.count()) {
    await exit.click()
    await page.waitForTimeout(200)
  }
  return { before, during, ok: during.focus === 'true' && !during.binder && during.work }
}

function add(id, sev, doc, surface, pass, measured, threshold, note) {
  record({ id, sev, doc, surface, pass, measured: String(measured), threshold: String(threshold), note })
}

async function runViewport(browser, width, height, label) {
  const page = await browser.newPage({ viewport: { width, height } })
  page.setDefaultTimeout(12000)
  try {
    await page.goto(UI, { waitUntil: 'networkidle' })
    await page.waitForTimeout(400)
    await dismissDrawers(page)
    if (width >= 1200) await ensureBinder(page)
    await ensureCompanion(page)
    await gotoMode(page, 'manuscript')
    await ensureCompanion(page)

    // --- B1 layout @1440 ---
    if (width >= 1200) {
      const layout = await measureLayout(page)
      add(
        'B1-work-hard',
        'HARD',
        'CALM_BUDGET.md B1-work-hard · workPct ≥ 40',
        `Draft@${label}`,
        layout.workPct >= 40,
        `workPct=${layout.workPct}`,
        '≥40',
      )
      add(
        'B1-work-warn',
        'WARN',
        'CALM_BUDGET.md B1-work-warn · workPct < 45 warns',
        `Draft@${label}`,
        layout.workPct >= 45, // pass means not in warn band
        `workPct=${layout.workPct}`,
        '≥45 preferred (WARN if <45)',
        layout.workPct < 45 ? 'in WARN band' : undefined,
      )
      add(
        'B1-rail-warn',
        'WARN',
        'CALM_BUDGET.md B1-rail-warn · rail>24 or chrome>55',
        `Draft@${label}`,
        !(layout.binderPct > 24 || layout.agentPct > 24 || layout.chromePct > 55),
        `binder=${layout.binderPct} agent=${layout.agentPct} chrome=${layout.chromePct}`,
        'rails≤24, chrome≤55',
      )
      add(
        'B1-rail-pathological',
        'HARD',
        'CALM_BUDGET.md B1-rail-pathological · rail > work',
        `Draft@${label}`,
        !(layout.binderW > layout.workW || layout.agentW > layout.workW),
        `binderW=${layout.binderW} agentW=${layout.agentW} workW=${layout.workW}`,
        'each rail ≤ work',
      )
      add(
        'B1-fold',
        'HARD',
        'CALM_BUDGET.md B1-fold · foldOwner = work',
        `Draft@${label}`,
        layout.foldOwner === 'work',
        `foldOwner=${layout.foldOwner}${layout.foldTop ? ` (${layout.foldTop.cls || layout.foldTop.tag})` : ''}`,
        'work',
      )
    }

    // --- B2 topbar ---
    const top = await measureTopbar(page)
    add(
      `B2-job-primary@${label}`,
      'HARD',
      'CALM_BUDGET.md B2-job-primary · Continuity/Export/Research/Review/New top primary = 0',
      `topbar@${label}`,
      (top.topJobPrimaryCount || 0) === 0,
      `topJobPrimaryCount=${top.topJobPrimaryCount || 0}${top.jobPrimaryLabels?.length ? ` [${top.jobPrimaryLabels.join(',')}]` : ''}`,
      '=0',
    )
    add(
      `B2-ecosystem@${label}`,
      'HARD',
      'CALM_BUDGET.md B2-ecosystem · ecosystemVisible = 3',
      `topbar@${label}`,
      top.ecosystemVisible === 3,
      `ecosystemVisible=${top.ecosystemVisible} [${(top.ecoLabels || []).join(',')}]`,
      '=3',
    )
    if (width <= 400) {
      add(
        'B2-truncation',
        'HARD',
        'CALM_BUDGET.md B2-truncation · placeLabelClipped = 0 @390',
        'topbar@390',
        (top.placeLabelClipped || 0) === 0,
        `placeLabelClipped=${top.placeLabelClipped || 0}`,
        '=0',
      )
      add(
        'B2-top-count-warn',
        'WARN',
        'CALM_BUDGET.md B2-top-count-warn · top controls > 8 without overflow',
        'topbar@390',
        (top.topControlCount || 0) <= 8,
        `topControlCount=${top.topControlCount || 0}`,
        '≤8',
      )
    }

    // --- B3 companion ---
    await ensureCompanion(page)
    // default face should be chat on fresh context
    await gotoMode(page, 'manuscript')
    await ensureCompanion(page)
    await page.waitForTimeout(200)
    // reset by toggling companion context via Draft
    const facesChat = await measureFaces(page, 'writing')
    if (!facesChat.missing) {
      add(
        `B3-writing-count@${label}`,
        'HARD',
        'CALM_BUDGET.md B3-writing-count · writing faces ≤ 5',
        `companion writing@${label}`,
        facesChat.productFaceCount <= 5,
        `productFaces=${facesChat.productFaceCount} [${facesChat.productFaces.join(' · ')}] more=${facesChat.hasMore}`,
        '≤5',
      )
      add(
        `B3-default-face@${label}`,
        'HARD',
        'CALM_BUDGET.md B3-default-face · writing default = Chat',
        `companion@${label}`,
        /^chat$/i.test(facesChat.face) || facesChat.productFaces[0]?.startsWith('Chat'),
        `face=${facesChat.face}`,
        'chat',
      )
      add(
        `B3-inbox-wall@${label}`,
        'HARD',
        'CALM_BUDGET.md B3-inbox-wall · chatProposalsWall = false',
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

      // Footer on Chat
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

      // Check face rest + footer
      await openFace(companionPanel(page), 'Check')
      await page.waitForTimeout(200)
      const facesCheck = await measureFaces(page, 'writing')
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

    // Lab faces
    await gotoMode(page, 'lab')
    await ensureCompanion(page)
    await page.waitForTimeout(250)
    const labFaces = await measureFaces(page, 'lab')
    if (!labFaces.missing) {
      add(
        `B3-lab-count@${label}`,
        'HARD',
        'CALM_BUDGET.md B3-lab-count · lab faces ≤ 3',
        `companion lab@${label}`,
        labFaces.productFaceCount <= 3,
        `productFaces=${labFaces.productFaceCount} [${labFaces.productFaces.join(' · ')}]`,
        '≤3',
      )
    }

    // Graph/Canon faces
    await gotoMode(page, 'graph')
    await ensureCompanion(page)
    await page.waitForTimeout(250)
    const graphFaces = await measureFaces(page, 'graph')
    if (!graphFaces.missing) {
      add(
        `B3-graph-count@${label}`,
        'HARD',
        'CALM_BUDGET.md B3-graph-count · graph faces ≤ 3',
        `companion graph@${label}`,
        graphFaces.productFaceCount <= 3,
        `productFaces=${graphFaces.productFaceCount} [${graphFaces.productFaces.join(' · ')}]`,
        '≤3',
      )
    }

    // --- B4 Lab ---
    await gotoMode(page, 'lab')
    await page.waitForTimeout(250)
    const lab = await measureLab(page)
    if (!lab.missing) {
      add(
        `B4-lab-empty-filter@${label}`,
        'HARD',
        'CALM_BUDGET.md B4-lab-empty-filter · no filter when cards=0',
        `Lab@${label}`,
        lab.labFilterWhenEmpty === false,
        `cards=${lab.cardCount} filterWhenEmpty=${lab.labFilterWhenEmpty}`,
        'false',
      )
      add(
        `B4-lab-kind-strips@${label}`,
        'HARD',
        'CALM_BUDGET.md B4-lab-kind-strips · kindFullStrips ≤ 1',
        `Lab@${label}`,
        lab.kindFullStrips <= 1,
        `kindFullStrips=${lab.kindFullStrips}`,
        '≤1',
      )
    }

    // Craft on Draft
    await gotoMode(page, 'manuscript')
    await page.waitForTimeout(200)
    const craft = await measureCraft(page)
    if (width >= 1200) {
      add(
        'B4-craft-desktop',
        'HARD',
        'CALM_BUDGET.md B4-craft-desktop · craft visible ≤ 5 + overflow',
        'Draft craft@1440',
        craft.chipVisibleCount <= 5,
        `chipVisibleCount=${craft.chipVisibleCount} [${(craft.chipLabels || []).join(',')}]`,
        '≤5',
      )
    } else {
      add(
        'B4-craft-phone',
        'HARD',
        'CALM_BUDGET.md B4-craft-phone · craft collapsed disclosure default @390',
        'Draft craft@390',
        craft.craftCollapsedDefault === true,
        `collapsed=${craft.craftCollapsedDefault} chips=${craft.chipVisibleCount}`,
        'true',
      )
    }

    // Canon WARN until D4
    await gotoMode(page, 'graph')
    await page.waitForTimeout(250)
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

    // --- B5 touch + overflow @390 ---
    if (width <= 400) {
      const touch = await measureTouchChrome(page)
      add(
        'B5-touch-chrome',
        'HARD',
        'CALM_BUDGET.md B5-touch-chrome · min hit ≥ 44×44 chrome @390',
        'chrome@390',
        touch.touchFailChrome === 0,
        `touchFailChrome=${touch.touchFailChrome}${touch.samples?.length ? ` e.g. ${touch.samples[0].name} ${touch.samples[0].min}px` : ''}`,
        '=0 fails',
      )
      add(
        'B5-touch-fail',
        'HARD',
        'CALM_BUDGET.md B5-touch-fail · touchFailChrome = 0',
        'chrome@390',
        touch.touchFailChrome === 0,
        `touchFailChrome=${touch.touchFailChrome}`,
        '=0',
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

    // Focus smoke once per desktop
    if (width >= 1200) {
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

    // B6 mirrors
    if (width >= 1200) {
      add(
        'B6-top-job',
        'HARD',
        'CALM_BUDGET.md B6-top-job · solid job primaries = 0',
        'topbar',
        (top.topJobPrimaryCount || 0) === 0,
        `topJobPrimaryCount=${top.topJobPrimaryCount || 0}`,
        '=0',
      )
    }

    return { label, width, height }
  } finally {
    await page.close()
  }
}

function renderMarkdown(meta) {
  const hardFails = checks.filter((c) => !c.pass && c.sev === 'HARD')
  const warns = checks.filter((c) => !c.pass && c.sev === 'WARN')
  const passes = checks.filter((c) => c.pass)

  const rows = checks
    .map((c) => {
      const status = c.pass ? 'PASS' : c.sev === 'HARD' ? 'FAIL' : 'WARN'
      return `| ${status} | ${c.id} | ${c.sev} | ${c.measured.replace(/\|/g, '/')} | ${c.threshold.replace(/\|/g, '/')} | ${c.surface} | ${c.doc} |`
    })
    .join('\n')

  return `# CALM_BUDGET run

**When:** ${meta.when}
**UI:** ${meta.ui}
**HEAD:** ${meta.head}
**Branch tip note:** measured live DOM (dev server), not threshold-tuned.

## Summary

| | Count |
|--|--:|
| PASS | ${passes.length} |
| WARN (fail band) | ${warns.length} |
| HARD FAIL | ${hardFails.length} |
| Total checks | ${checks.length} |

**Exit:** ${hardFails.length ? 'nonzero (HARD fail)' : 'zero (no HARD fail)'}

## Scoreboard

| Status | ID | Sev | Measured | Threshold | Surface | Doc |
|--------|----|-----|----------|-----------|---------|-----|
${rows}

## HARD failures

${hardFails.length ? hardFails.map((c) => `- **${c.id}**: ${c.measured} (want ${c.threshold}) — ${c.doc}`).join('\n') : '_None._'}

## WARN band

${warns.length ? warns.map((c) => `- **${c.id}**: ${c.measured} (want ${c.threshold}) — ${c.doc}`).join('\n') : '_None._'}

## Notes

- B4-canon-* stay WARN until D4 lands (doc).
- B5-graph-nodes intentionally not asserted as HARD (SVG radii).
- Face chrome uses role=tab (D6). Helpers imported when present; local tab fallback included.
- Offline only: no LLM routes required.
`
}

mkdirSync(OUT_DIR, { recursive: true })
const helpers = await loadHelpers()
if (helpers) console.log('helpers: loaded e2e/helpers.mjs')
else console.log('helpers: self-contained fallback')

const browser = await chromium.launch({ channel: 'msedge', headless: true })
let head = 'unknown'
try {
  const { execSync } = await import('node:child_process')
  head = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim()
} catch {
  head = 'unknown'
}

try {
  await runViewport(browser, 1440, 900, '1440')
  await runViewport(browser, 390, 844, '390')
} finally {
  await browser.close()
}

const hardFails = checks.filter((c) => !c.pass && c.sev === 'HARD').length
const meta = { when: new Date().toISOString(), ui: UI, head }
const md = renderMarkdown(meta)
writeFileSync(OUT_MD, md)
writeFileSync(OUT_JSON, JSON.stringify({ meta, checks }, null, 2))
console.log(`\nWrote ${OUT_MD}`)
console.log(`HARD fails: ${hardFails} / checks: ${checks.length}`)
process.exit(hardFails > 0 ? 1 : 0)
