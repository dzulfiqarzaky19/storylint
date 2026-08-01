/**
 * TASK BF — End-to-end journey walk (report-only).
 * Walks J1/J2/J3 from docs/IA_MAP.md at 1440 + 390 on three seeds:
 *   seeded default | new empty project | populated
 *
 * node e2e/bf-journey-walk.mjs
 */
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { mkdirSync, writeFileSync } from 'node:fs'
import { ownMeasurementStack } from './owned-stack.mjs'
import {
  assertActiveProject,
  ensureIsolatedProject,
  fetchActiveProject,
  fillChapterAndSave,
  gotoWorkspace,
  installFixtureLlmRoutes,
  openCompanionFace,
  reclaimIsolatedProject,
  reloadApp,
  requireCompanionFace,
  setApiBase,
  waitSaved,
  companionPanel,
  ensureCompanionOpen,
  ensureBinderOpen,
  PreconditionError,
} from './helpers.mjs'

const require = createRequire('D:/npm-global/node_modules/playwright/package.json')
const pwRoot = dirname(require.resolve('playwright/package.json'))
const { chromium } = await import(pathToFileURL(resolve(pwRoot, 'index.mjs')).href)

const OUT = 'e2e/output/bf'
mkdirSync(OUT, { recursive: true })

const findings = []
function note(rank, id, seed, vp, title, detail, evidence = {}) {
  findings.push({ rank, id, seed, vp, title, detail, evidence, at: new Date().toISOString() })
}

async function snap(page, label) {
  const path = `${OUT}/${label}.png`
  await page.screenshot({ path, fullPage: false }).catch(() => {})
  return path
}

async function surface(page) {
  return page.evaluate(() => {
    const active = document.activeElement
    const activeDesc = active
      ? {
          tag: active.tagName,
          id: active.id || null,
          role: active.getAttribute('role'),
          name:
            active.getAttribute('aria-label') ||
            active.getAttribute('placeholder') ||
            (active.textContent || '').trim().slice(0, 80) ||
            null,
          className: String(active.className || '').slice(0, 120),
        }
      : null

    const main = document.querySelector('main#workspace, main[aria-label]')
    const skip = [...document.querySelectorAll('a[href="#workspace"], .skip-link, a.skip')].map((a) => ({
      text: (a.textContent || '').trim(),
      href: a.getAttribute('href'),
      visible: !!(a.offsetWidth || a.offsetHeight || a.getClientRects().length),
    }))

    function btnInfo(selOrEl) {
      const el = typeof selOrEl === 'string' ? document.querySelector(selOrEl) : selOrEl
      if (!el) return null
      const cs = getComputedStyle(el)
      const r = el.getBoundingClientRect()
      return {
        text: (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80),
        disabled: el.hasAttribute('disabled') || el.getAttribute('aria-disabled') === 'true',
        ariaPressed: el.getAttribute('aria-pressed'),
        ariaBusy: el.getAttribute('aria-busy'),
        primaryish:
          el.className.includes('primary') ||
          cs.backgroundColor !== 'rgba(0, 0, 0, 0)' && cs.backgroundColor !== 'transparent',
        className: String(el.className || '').slice(0, 100),
        visible: r.width > 0 && r.height > 0,
        w: Math.round(r.width),
        h: Math.round(r.height),
      }
    }

    const ecosystem = [...document.querySelectorAll('.shell__ecosystem button, [aria-label="Workspace"] button')].map(
      (b) => btnInfo(b),
    )
    const topActions = [...document.querySelectorAll('.shell__topbar-actions button, .shell__topbar button')]
      .map((b) => btnInfo(b))
      .filter(Boolean)
      .slice(0, 20)

    const companion = document.querySelector('.panel[data-companion-context], [data-companion-face]')
    const face = companion?.getAttribute('data-companion-face') || null
    const ctx = companion?.getAttribute('data-companion-context') || null
    const faceTabs = [...document.querySelectorAll('[data-companion-context] [role="tab"], .agent__tabs [role="tab"], .panel [role="tab"]')].map(
      (t) => ({
        name: (t.textContent || '').replace(/\s+/g, ' ').trim(),
        selected: t.getAttribute('aria-selected') === 'true' || t.getAttribute('aria-pressed') === 'true',
        disabled: t.hasAttribute('disabled'),
      }),
    )

    const live = [...document.querySelectorAll('[aria-live]')].map((el) => ({
      live: el.getAttribute('aria-live'),
      atomic: el.getAttribute('aria-atomic'),
      text: (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 120),
      role: el.getAttribute('role'),
    }))

    const primaries = [...document.querySelectorAll('button.ui-button--primary, .ui-button--primary, button[class*="primary"]')]
      .map((b) => btnInfo(b))
      .filter((b) => b && b.visible)

    const ghosts = [...document.querySelectorAll('button.ui-button--ghost, .ui-button--ghost')]
      .map((b) => btnInfo(b))
      .filter((b) => b && b.visible)
      .slice(0, 12)

    const titleEl = document.querySelector('.manuscript__title, input[aria-label="Chapter title"]')
    const bodyEl = document.querySelector('.manuscript__body, textarea[aria-label*="body" i], textarea.manuscript__body')
    const emptyState = document.querySelector('.empty-state, [class*="EmptyState"]')
    const emptyTitle = emptyState?.querySelector('h2,h3,.empty-state__title')?.textContent?.trim() || null
    const emptyAction = emptyState ? [...emptyState.querySelectorAll('button')].map((b) => (b.textContent || '').trim()) : []

    const binder = document.querySelector('.binder, [aria-label*="Binder" i], aside.panel')
    const binderChapters = [...document.querySelectorAll('.binder__chapter-list [role="listitem"], .binder__chapter-list button, [aria-label="Chapters"] button, [aria-label="Chapters"] [role="listitem"]')]
      .map((el) => (el.textContent || '').replace(/\s+/g, ' ').trim())
      .filter(Boolean)
      .slice(0, 12)

    const newChapter = [...document.querySelectorAll('button')].find((b) => /New chapter/i.test(b.textContent || ''))
    const writeFirst = [...document.querySelectorAll('button')].find((b) => /Write first chapter/i.test(b.textContent || ''))
    const runCont = [...document.querySelectorAll('button')].find((b) => /Run Continuity|Working…/i.test(b.textContent || ''))
    const newSheet = [...document.querySelectorAll('button')].find((b) => /New sheet/i.test(b.textContent || ''))
    const sendProposal = [...document.querySelectorAll('button')].find((b) => /Send proposal/i.test(b.textContent || ''))
    const saveStatus = document.querySelector('.project-status')?.textContent?.trim() || ''

    const dialogs = [...document.querySelectorAll('[role="dialog"], .sheet-editor__leave-dialog')].map((d) => ({
      label: d.getAttribute('aria-labelledby') || d.getAttribute('aria-label'),
      text: (d.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 160),
      open: d.getAttribute('open') !== null || getComputedStyle(d).display !== 'none',
    }))

    const labCards = document.querySelectorAll('.lab__card').length
    const labComposer = !!document.querySelector('.lab__composer')
    const promoted = document.querySelectorAll('.lab__promoted-list li').length

    const marks = document.querySelectorAll('.manuscript__mark, [data-mark], .mark').length

    return {
      active: activeDesc,
      mainLabel: main?.getAttribute('aria-label') || null,
      workspaceMode: document.querySelector('.shell')?.getAttribute('data-focus') || null,
      skip,
      ecosystem,
      topActions: topActions.map((t) => t.text),
      companionFace: face,
      companionCtx: ctx,
      faceTabs,
      live,
      primaries: primaries.map((p) => ({ text: p.text, disabled: p.disabled, className: p.className })),
      ghosts: ghosts.map((g) => g.text),
      titleValue: titleEl?.value ?? null,
      titlePlaceholder: titleEl?.getAttribute('placeholder') || null,
      bodyValueLen: bodyEl ? String(bodyEl.value || '').length : null,
      bodyPlaceholder: bodyEl?.getAttribute('placeholder') || null,
      bodyIsActive: active === bodyEl,
      titleIsActive: active === titleEl,
      emptyTitle,
      emptyAction,
      binderChapters,
      newChapter: btnInfo(newChapter),
      writeFirst: btnInfo(writeFirst),
      runContinuity: btnInfo(runCont),
      newSheet: btnInfo(newSheet),
      sendProposal: btnInfo(sendProposal),
      saveStatus,
      dialogs,
      labCards,
      labComposer,
      promoted,
      marks,
      bodyFocusedClass: bodyEl && document.activeElement === bodyEl,
    }
  })
}

async function putSeededDefault(projectId) {
  // Factory shape: 1 chapter empty title empty body
  const cur = await fetchActiveProject()
  const body = {
    ...cur,
    title: cur.title || 'BF Seeded',
    chapters: [
      {
        id: 'chapter-1',
        title: '',
        body: '',
        craftTags: [],
        revision: (cur.chapters?.[0]?.revision ?? 0) + 1,
      },
    ],
    sheets: [],
    proposals: [],
    rejectedFingerprints: [],
    marks: [],
    researchNotes: [],
    lab: { boards: [{ id: 'lab-board-bench', title: 'Bench', cardIds: [] }], cards: [] },
  }
  const res = await fetch(`${process.env.BF_API}/api/project`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`seeded put failed ${res.status} ${await res.text()}`)
  return res.json()
}

async function putPopulated(projectId) {
  const cur = await fetchActiveProject()
  const body = {
    ...cur,
    title: cur.title || 'BF Populated',
    chapters: [
      {
        id: 'chapter-1',
        title: 'The iron door',
        body:
          'Aria opened the iron door and counted three salt marks on the threshold. Voss had been here before dawn.',
        craftTags: ['setup'],
        revision: (cur.chapters?.[0]?.revision ?? 0) + 1,
      },
      {
        id: 'chapter-2',
        title: 'Ledger room',
        body: 'Mira sorted the coins twice. The third banner was missing from the census again.',
        craftTags: [],
        revision: 0,
      },
    ],
    sheets: [
      {
        id: 'sheet-aria',
        kind: 'character',
        name: 'Aria',
        aliases: [],
        summary: 'Runner who keeps the salt law.',
        notes: '',
        facts: [
          {
            id: 'fact-1',
            key: 'role',
            value: 'runner',
            statement: 'Aria is a runner',
            claimKind: 'attribute',
          },
        ],
      },
    ],
    proposals: [],
    rejectedFingerprints: [],
    marks: [],
    researchNotes: [],
    lab: {
      boards: [{ id: 'lab-board-bench', title: 'Bench', cardIds: ['lab-c1', 'lab-c2'] }],
      cards: [
        {
          id: 'lab-c1',
          boardId: 'lab-board-bench',
          kind: 'character-spark',
          title: 'Quiet cook',
          body: 'Half-remembered kitchen ally',
          status: 'active',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 'lab-c2',
          boardId: 'lab-board-bench',
          kind: 'beat',
          title: 'Treaty signing',
          body: 'Public square, rain',
          status: 'active',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
    },
  }
  const res = await fetch(`${process.env.BF_API}/api/project`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`populated put failed ${res.status} ${await res.text()}`)
  return res.json()
}

async function waitBrief(page, ms = 250) {
  await page.waitForTimeout(ms)
}

async function typeInBody(page, text) {
  const body = page.locator('.manuscript__body, textarea.manuscript__body').first()
  await body.click({ timeout: 5000 })
  await body.fill(text)
  await waitSaved(page).catch(() => {})
}

async function readSaveAfterNav(page) {
  const before = await fetchActiveProject()
  return before
}

// --- Journey steps ---

async function walkJ1(page, seed, vp, report) {
  const tag = `j1-${seed}-${vp}`
  const steps = []
  try {
    await gotoWorkspace(page, 'draft', { ensureCompanion: true })
    await ensureBinderOpen(page)
    await waitBrief(page, 400)
    const s0 = await surface(page)
    steps.push({ step: 'land-draft', surface: s0 })
    await snap(page, `${tag}-land`)

    // Body focus check (seeded / empty-body only)
    if (seed === 'seeded' || (seed === 'empty' && s0.bodyValueLen === 0 && s0.titleValue !== null)) {
      // On empty project there may be no manuscript body yet
    }
    if (s0.bodyValueLen === 0 && s0.bodyValueLen !== null) {
      if (!s0.bodyIsActive && !s0.bodyFocusedClass) {
        // give rAF a beat then recheck
        await waitBrief(page, 100)
        const s0b = await surface(page)
        steps.push({ step: 'body-focus-recheck', surface: s0b })
        if (!s0b.bodyIsActive) {
          note(
            'high',
            'BF-body-focus-miss',
            seed,
            vp,
            'Empty-body one-shot focus did not land on manuscript body',
            'BD P1-3 promises rAF focus on empty body. Active element was not body after Draft land.',
            { active: s0b.active, bodyLen: s0b.bodyValueLen },
          )
        }
      } else {
        steps.push({ step: 'body-focus-ok', active: s0.active })
      }
    }

    // Skip link vs body focus: Tab from body should not be permanently trapped;
    // and on fresh load, skip link should still exist. Activate skip and ensure it works.
    const skipCount = s0.skip?.length || 0
    if (skipCount === 0) {
      note('medium', 'BF-skip-missing', seed, vp, 'No skip link to #workspace found', 'IA/a11y expect skip to main workspace.', { skip: s0.skip })
    } else {
      // Blur body, focus skip via keyboard simulation
      await page.evaluate(() => {
        const a = document.querySelector('a[href="#workspace"], .skip-link')
        if (a) a.focus()
      })
      await waitBrief(page, 50)
      const onSkip = await surface(page)
      steps.push({ step: 'focus-skip', surface: { active: onSkip.active } })
      await page.keyboard.press('Enter')
      await waitBrief(page, 100)
      const afterSkip = await surface(page)
      steps.push({ step: 'activate-skip', surface: { active: afterSkip.active, main: afterSkip.mainLabel } })
      // Body autofocus must NOT re-steal after skip activation on same mount
      if (afterSkip.bodyIsActive && onSkip.active?.tag === 'A') {
        // After Enter on skip, focus may go to #workspace (tabIndex -1) — OK.
      }
      // Re-check: if we focused skip and body immediately stole without activation — bad.
      // The rAF is one-shot via didAutoFocusBody ref, so returning to Draft later shouldn't refocus if same chapter...
    }

    // Continuity weight on empty body
    await ensureCompanionOpen(page)
    await openCompanionFace(companionPanel(page), 'Check', { require: true }).catch(async (e) => {
      steps.push({ step: 'open-check-fail', err: String(e.message || e) })
    })
    await waitBrief(page, 200)
    const sCheck = await surface(page)
    steps.push({ step: 'check-face', surface: sCheck })
    if (sCheck.bodyValueLen === 0 && sCheck.runContinuity) {
      const rc = sCheck.runContinuity
      const isPrimary = /primary/i.test(rc.className || '')
      if (!rc.disabled && isPrimary) {
        note(
          'high',
          'BF-continuity-primary-empty',
          seed,
          vp,
          'Run Continuity is solid primary on empty body',
          'seeded-default P1 + IA J3 must not teach vacuous Continuity before prose.',
          { runContinuity: rc },
        )
      } else if (!rc.disabled && sCheck.bodyValueLen === 0) {
        note(
          'medium',
          'BF-continuity-enabled-empty',
          seed,
          vp,
          'Run Continuity enabled on empty body (may be non-primary)',
          'Gate should disable or demote until prose exists.',
          { runContinuity: rc },
        )
      }
    }

    // Competing primaries on land
    const solid = (s0.primaries || []).filter((p) => !p.disabled)
    if (seed === 'seeded' && solid.length > 1) {
      note(
        'medium',
        'BF-seeded-multi-primary',
        seed,
        vp,
        `Seeded Draft shows ${solid.length} enabled primaries`,
        'Composition risk: first job should be the paper, not multiple solid doors.',
        { primaries: solid },
      )
    }
    if (seed === 'empty') {
      // Expect create doors, not Continuity
      const createDoors = [s0.newChapter, s0.writeFirst, ...(s0.emptyAction || []).map((t) => ({ text: t }))].filter(Boolean)
      steps.push({ step: 'empty-doors', createDoors, primaries: solid })
      const solidCreates = solid.filter((p) => /chapter|write|lab/i.test(p.text))
      if (solidCreates.length > 2) {
        note(
          'high',
          'BF-empty-too-many-primaries',
          seed,
          vp,
          'True-empty shows more than two solid create primaries',
          'IA §10: two doors max (Write / Start in Lab).',
          { solid },
        )
      }
    }

    // Type → Saved (J1 core) — only when manuscript exists
    if (s0.bodyValueLen !== null) {
      const prose = `BF J1 prose ${seed} ${vp} ${Date.now()}`
      await gotoWorkspace(page, 'draft')
      await typeInBody(page, prose)
      await waitBrief(page, 400)
      const saved = await surface(page)
      const proj = await fetchActiveProject()
      const bodyOk = (proj.chapters || []).some((c) => (c.body || '').includes('BF J1 prose'))
      steps.push({ step: 'type-save', saveStatus: saved.saveStatus, bodyOk, bodyLen: saved.bodyValueLen })
      if (!bodyOk) {
        note('critical', 'BF-j1-save-lost', seed, vp, 'Typed prose did not persist to project', 'J1 step 3 Type→Saved failed.', {
          saveStatus: saved.saveStatus,
        })
      }

      // Transition Draft→Lab→Draft: prose must survive
      await gotoWorkspace(page, 'lab')
      await waitBrief(page, 200)
      await gotoWorkspace(page, 'draft')
      await waitBrief(page, 300)
      const back = await fetchActiveProject()
      const still = (back.chapters || []).some((c) => (c.body || '').includes('BF J1 prose'))
      steps.push({ step: 'survive-lab-roundtrip', still })
      if (!still) {
        note('critical', 'BF-j1-lost-on-lab', seed, vp, 'Prose lost after Draft→Lab→Draft', 'Save did not survive ecosystem switch.', {})
      }

      // Focus mode if present
      const focusBtn = page.getByRole('button', { name: /Focus mode|Exit focus mode/i })
      if (await focusBtn.count()) {
        await focusBtn.first().click().catch(() => {})
        await waitBrief(page, 200)
        const focused = await surface(page)
        steps.push({ step: 'focus-on', surface: { main: focused.mainLabel, ecosystem: focused.ecosystem } })
        await focusBtn.first().click().catch(() => {})
        await waitBrief(page, 150)
      }
    } else if (seed === 'empty') {
      // Create via Write door
      const writeBtn = page.getByRole('button', { name: /Write first chapter|New chapter|Write/i }).first()
      if (await writeBtn.count()) {
        await writeBtn.click()
        await waitBrief(page, 500)
        const afterCreate = await surface(page)
        steps.push({ step: 'empty-create', surface: afterCreate })
        if (afterCreate.bodyValueLen === null) {
          note('high', 'BF-empty-create-deadend', seed, vp, 'Create chapter door did not open manuscript', 'Author cannot start J1 from empty.', {
            emptyAction: afterCreate.emptyAction,
            main: afterCreate.mainLabel,
          })
        } else {
          // After create, body focus?
          if (afterCreate.bodyValueLen === 0 && !afterCreate.bodyIsActive) {
            await waitBrief(page, 100)
            const re = await surface(page)
            if (!re.bodyIsActive) {
              note(
                'medium',
                'BF-empty-create-no-body-focus',
                seed,
                vp,
                'After creating first chapter, body did not take focus',
                'P1-3 preferred teach may only fire on initial mount.',
                { active: re.active },
              )
            }
          }
          await typeInBody(page, `BF empty-origin prose ${vp}`)
          const proj = await fetchActiveProject()
          const ok = (proj.chapters || []).some((c) => (c.body || '').includes('BF empty-origin'))
          if (!ok) note('critical', 'BF-empty-j1-save', seed, vp, 'Prose after empty-create did not save', '', {})
        }
      } else {
        note('critical', 'BF-empty-no-door', seed, vp, 'No Write/New chapter door on true-empty', 'IA §10 two doors missing.', await surface(page))
      }
    }

    // Must not require Lab/Graph/Research/Review for J1 — just verify top chrome calm
    const top = s0.topActions || []
    const loud = top.filter((t) => /Continuity|Export|Research|Review/i.test(t) && !/Focus|Inbox|More|Chat/i.test(t))
    if (loud.length) {
      note('low', 'BF-j1-loud-chrome', seed, vp, 'Top chrome may expose job tools outside journey', 'IA §12 equal top weight forbidden for Continuity/Export/Research/Review.', { top, loud })
    }
  } catch (err) {
    steps.push({ step: 'error', err: String(err?.stack || err) })
    note('high', 'BF-j1-threw', seed, vp, 'J1 walk threw', String(err?.message || err), {})
  }
  report.j1 = steps
}

async function walkJ2(page, seed, vp, report) {
  const tag = `j2-${seed}-${vp}`
  const steps = []
  try {
    await gotoWorkspace(page, 'lab', { ensureCompanion: true })
    await waitBrief(page, 300)
    const s0 = await surface(page)
    steps.push({ step: 'land-lab', surface: s0 })
    await snap(page, `${tag}-land`)

    if (!s0.labComposer && s0.mainLabel !== 'Lab') {
      note('high', 'BF-j2-lab-missing', seed, vp, 'Lab workspace did not land', 'J2 requires Lab center.', { main: s0.mainLabel })
      report.j2 = steps
      return
    }

    // Create messy card
    const title = page.getByLabel('Lab card title')
    if (await title.count()) {
      await title.fill(`BF spark ${seed} ${vp}`)
      const body = page.getByLabel('Lab card body')
      if (await body.count()) await body.fill('Messy pre-canon note for journey walk')
      // kind default character-spark OK
      await page.getByRole('button', { name: 'New card' }).click()
      await waitBrief(page, 400)
      const after = await surface(page)
      steps.push({ step: 'create-card', labCards: after.labCards })
      if (after.labCards < 1 && seed !== 'populated') {
        // populated already had cards; after should be >= prior
      }
    }

    // Promote character-spark if present
    const promote = page.getByRole('button', { name: 'Promote to Canon' }).first()
    if (await promote.count()) {
      await promote.click()
      await waitBrief(page, 500)
      const afterP = await surface(page)
      steps.push({ step: 'promote', notice: true, promoted: afterP.promoted, faceTabs: afterP.faceTabs })
      // Inbox should be able to receive — open Inbox
      await ensureCompanionOpen(page)
      await openCompanionFace(companionPanel(page), 'Inbox', { require: false }).catch(() => {})
      await waitBrief(page, 200)
      const inbox = await surface(page)
      steps.push({ step: 'inbox-after-promote', face: inbox.companionFace, live: inbox.live, primaries: inbox.primaries })
      const proj = await fetchActiveProject()
      const pending = (proj.proposals || []).filter((p) => p.status === 'pending')
      steps.push({ step: 'pending-count', n: pending.length })
      if (pending.length === 0) {
        note(
          'high',
          'BF-j2-promote-no-proposal',
          seed,
          vp,
          'Promote to Canon produced no pending proposal',
          'J2 4b requires Inbox Accept path.',
          { promoted: afterP.promoted },
        )
      }
    } else {
      // try Send to Draft on beat
      const send = page.getByRole('button', { name: 'Send to Draft' }).first()
      if (await send.count()) {
        const chaptersBefore = (await fetchActiveProject()).chapters?.length || 0
        await send.click()
        await waitBrief(page, 500)
        const chaptersAfter = (await fetchActiveProject()).chapters?.length || 0
        steps.push({ step: 'send-to-draft', chaptersBefore, chaptersAfter })
        if (chaptersAfter <= chaptersBefore && seed !== 'seeded') {
          // seeded already has chapter; beat promote adds stub
        }
        if (chaptersAfter < chaptersBefore) {
          note('critical', 'BF-j2-send-deleted-chapter', seed, vp, 'Send to Draft reduced chapter count', 'Lost work.', {})
        }
      } else if (seed === 'empty') {
        steps.push({ step: 'no-promote-yet', note: 'empty lab expected until card created' })
      }
    }

    // Later return Draft
    await gotoWorkspace(page, 'draft')
    await waitBrief(page, 250)
    const draft = await surface(page)
    steps.push({ step: 'return-draft', main: draft.mainLabel, bodyLen: draft.bodyValueLen })
  } catch (err) {
    steps.push({ step: 'error', err: String(err?.stack || err) })
    note('high', 'BF-j2-threw', seed, vp, 'J2 walk threw', String(err?.message || err), {})
  }
  report.j2 = steps
}

async function walkJ3(page, seed, vp, report) {
  const tag = `j3-${seed}-${vp}`
  const steps = []
  try {
    await gotoWorkspace(page, 'draft', { ensureCompanion: true })
    // Need prose for Continuity
    let proj = await fetchActiveProject()
    const hasProse = (proj.chapters || []).some((c) => (c.body || '').trim().length > 0)
    if (!hasProse) {
      const s = await surface(page)
      if (s.bodyValueLen !== null) {
        await typeInBody(
          page,
          'Aria opened the iron door. The salt law forbade wet boots indoors. Voss left three marks.',
        )
      } else {
        steps.push({ step: 'skip-no-manuscript' })
        report.j3 = steps
        return
      }
    }

    await ensureCompanionOpen(page)
    await requireCompanionFace(page, 'Check').catch(async () => {
      await openCompanionFace(companionPanel(page), 'Check', { require: true })
    })
    await waitBrief(page, 200)
    const before = await surface(page)
    steps.push({ step: 'check-ready', run: before.runContinuity })

    if (before.runContinuity?.disabled) {
      note(
        'high',
        'BF-j3-continuity-disabled-with-prose',
        seed,
        vp,
        'Run Continuity disabled despite prose in chapter',
        'J3 blocked.',
        { run: before.runContinuity, bodyLen: before.bodyValueLen },
      )
    } else if (before.runContinuity) {
      await page.getByRole('button', { name: /Run Continuity/i }).click()
      // wait for completion live or button text
      await page.waitForFunction(() => {
        const b = [...document.querySelectorAll('button')].find((x) => /Run Continuity|Working/i.test(x.textContent || ''))
        return b && !/Working/i.test(b.textContent || '')
      }, { timeout: 20_000 }).catch(() => {})
      await waitBrief(page, 400)
      const after = await surface(page)
      proj = await fetchActiveProject()
      steps.push({
        step: 'continuity-ran',
        marksUi: after.marks,
        marksData: (proj.marks || []).length,
        proposals: (proj.proposals || []).filter((p) => p.status === 'pending').length,
        live: after.live,
        run: after.runContinuity,
      })
      await snap(page, `${tag}-after-cont`)

      // Dual live region check
      const polite = (after.live || []).filter((l) => l.live === 'polite' && l.text)
      if (polite.length > 1) {
        note(
          'medium',
          'BF-dual-live',
          seed,
          vp,
          'Multiple polite live regions with text after Continuity',
          'AU aimed to avoid double-announce of same fact.',
          { polite },
        )
      }

      // Inbox path
      await openCompanionFace(companionPanel(page), 'Inbox', { require: false }).catch(() => {})
      await waitBrief(page, 200)
      const inbox = await surface(page)
      steps.push({ step: 'inbox', face: inbox.companionFace, primaries: inbox.primaries })
    } else {
      note('high', 'BF-j3-no-run-button', seed, vp, 'No Run Continuity button on Check face', 'J3 entry missing.', { face: before.companionFace })
    }

    // Optional Canon context — must not force graph
    await gotoWorkspace(page, 'canon')
    await waitBrief(page, 250)
    const canon = await surface(page)
    steps.push({ step: 'canon', main: canon.mainLabel, send: canon.sendProposal, newSheet: canon.newSheet })
    // Leave guard: open new sheet, dirty name, try switch to Draft
    const newSheetBtn = page.getByRole('button', { name: /New sheet/i }).first()
    if (await newSheetBtn.count()) {
      await ensureBinderOpen(page)
      await newSheetBtn.click().catch(() => {})
      await waitBrief(page, 300)
      const name = page.getByLabel(/Name|Sheet name|Character name/i).first()
      if (await name.count()) {
        await name.fill('Dirty leave probe')
        await waitBrief(page, 100)
        // try ecosystem Draft
        await page.getByRole('button', { name: 'Draft', exact: true }).click()
        await waitBrief(page, 200)
        const guard = await surface(page)
        steps.push({ step: 'leave-guard', dialogs: guard.dialogs, main: guard.mainLabel })
        const hasDialog = (guard.dialogs || []).some((d) => /leave|unsaved|save/i.test(d.text || ''))
        if (!hasDialog && guard.mainLabel === 'Draft') {
          // might have navigated without guard if dirty detection failed
          note(
            'critical',
            'BF-leave-guard-bypass',
            seed,
            vp,
            'Dirty sheet leave switched to Draft without guard dialog',
            'Lost-work risk on Canon identity fields.',
            { dialogs: guard.dialogs, main: guard.mainLabel },
          )
        } else if (hasDialog) {
          // dismiss via Discard to continue
          const discard = page.getByRole('button', { name: /Discard/i })
          if (await discard.count()) await discard.click()
          await waitBrief(page, 200)
        }
      }
    }
  } catch (err) {
    steps.push({ step: 'error', err: String(err?.stack || err) })
    note('high', 'BF-j3-threw', seed, vp, 'J3 walk threw', String(err?.message || err), {})
  }
  report.j3 = steps
}

async function bodyFocusVsSkipSpecial(page, seed, vp, report) {
  // Dedicated: reload seeded empty body, capture focus timeline
  if (seed !== 'seeded') return
  const timeline = []
  await page.evaluate(() => {
    window.__bfFocusLog = []
    document.addEventListener(
      'focusin',
      (e) => {
        const t = e.target
        window.__bfFocusLog.push({
          t: performance.now(),
          tag: t.tagName,
          id: t.id,
          cls: String(t.className || '').slice(0, 80),
          name: t.getAttribute('aria-label') || t.getAttribute('placeholder') || null,
        })
      },
      true,
    )
  })
  await reloadApp(page, { ready: 'main#workspace, .manuscript__body, select[aria-label="Active project"]' })
  await waitBrief(page, 500)
  await gotoWorkspace(page, 'draft').catch(() => {})
  await waitBrief(page, 400)
  const log = await page.evaluate(() => window.__bfFocusLog || [])
  const s = await surface(page)
  timeline.push({ log, active: s.active, bodyIsActive: s.bodyIsActive })
  // Tab order: from document start, first Tab should hit skip if present (not body)
  await page.evaluate(() => document.body.focus())
  await page.keyboard.press('Tab')
  await waitBrief(page, 50)
  const firstTab = await surface(page)
  timeline.push({ firstTabActive: firstTab.active })
  if (firstTab.bodyIsActive && (s.skip || []).length) {
    note(
      'high',
      'BF-body-steals-first-tab',
      seed,
      vp,
      'First Tab lands on body instead of skip link',
      'Body one-shot focus may fight skip-link first-tab contract (no HTML autofocus claimed, but programmatic focus still moves initial focus).',
      { firstTabActive: firstTab.active, skip: s.skip },
    )
  }
  report.bodyFocus = timeline
}

async function runSeed(browser, stack, seedName, viewport) {
  const vpLabel = `${viewport.width}`
  const report = { seed: seedName, viewport, steps: {} }
  const page = await browser.newPage({ viewport })
  page.setDefaultTimeout(20_000)
  await installFixtureLlmRoutes(page)
  setApiBase(stack.api)
  process.env.BF_API = stack.api

  try {
    await page.goto(stack.ui, { waitUntil: 'domcontentloaded' })
    await page.getByLabel('Active project').waitFor({ state: 'attached', timeout: 15_000 })

    let projectId
    if (seedName === 'empty') {
      projectId = await ensureIsolatedProject(page, { title: 'BF Empty' })
      // ensure empty chapters
      await reclaimIsolatedProject(projectId)
      const cur = await fetchActiveProject()
      if ((cur.chapters || []).length || (cur.sheets || []).length) {
        // mint fresher
        projectId = await ensureIsolatedProject(page, {
          id: `bf-empty-${Date.now().toString(36)}`,
          title: 'BF Empty',
        })
      }
      await reloadApp(page)
      await reclaimIsolatedProject(projectId)
      await page.getByLabel('Active project').selectOption(projectId).catch(() => {})
    } else if (seedName === 'seeded') {
      projectId = await ensureIsolatedProject(page, { title: 'BF Seeded' })
      await reclaimIsolatedProject(projectId)
      await putSeededDefault(projectId)
      await reloadApp(page)
      await reclaimIsolatedProject(projectId)
      await page.getByLabel('Active project').selectOption(projectId).catch(() => {})
    } else {
      projectId = await ensureIsolatedProject(page, { title: 'BF Populated' })
      await reclaimIsolatedProject(projectId)
      await putPopulated(projectId)
      await reloadApp(page)
      await reclaimIsolatedProject(projectId)
      await page.getByLabel('Active project').selectOption(projectId).catch(() => {})
    }

    report.projectId = projectId
    report.projectAfterSeed = await fetchActiveProject()
    await assertActiveProject(projectId, { page })

    if (seedName === 'seeded') {
      await bodyFocusVsSkipSpecial(page, seedName, vpLabel, report)
    }

    await walkJ1(page, seedName, vpLabel, report.steps)
    await walkJ2(page, seedName, vpLabel, report.steps)
    await walkJ3(page, seedName, vpLabel, report.steps)

    // Composition: open Check + type — body focus must not fight companion
    // (light check already in J1)

    report.finalProject = await fetchActiveProject()
  } catch (err) {
    report.error = String(err?.stack || err)
    note('high', 'BF-seed-threw', seedName, vpLabel, 'Seed run threw before journeys finished', String(err?.message || err), {})
  } finally {
    await page.close().catch(() => {})
  }
  return report
}

const stack = await ownMeasurementStack({ skipBuild: process.env.STORYLINT_SKIP_BUILD === '1' })
setApiBase(stack.api)
const browser = await chromium.launch({ channel: 'msedge', headless: true })

const all = {
  head: stack.head,
  shortHead: stack.shortHead,
  dirty: stack.dirty,
  at: new Date().toISOString(),
  method: 'owned-stack Playwright journey walk J1/J2/J3 × 3 seeds × 2 viewports; fixture LLM; report-only',
  runs: [],
}

try {
  const seeds = ['seeded', 'empty', 'populated']
  const viewports = [
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
  ]
  // Full matrix is 6 runs; do all.
  for (const seed of seeds) {
    for (const vp of viewports) {
      console.log(`RUN ${seed} @${vp.width}`)
      const r = await runSeed(browser, stack, seed, vp)
      all.runs.push(r)
      console.log(`  done findings so far ${findings.length} err=${r.error ? 'yes' : 'no'}`)
    }
  }
} finally {
  await browser.close()
  await stack.stop()
}

// Rank findings
const rankOrder = { critical: 0, high: 1, medium: 2, low: 3 }
findings.sort((a, b) => (rankOrder[a.rank] ?? 9) - (rankOrder[b.rank] ?? 9))
all.findings = findings

// Dedup by id+seed summary
const byId = {}
for (const f of findings) {
  byId[f.id] = byId[f.id] || []
  byId[f.id].push(f)
}
all.findingIndex = Object.fromEntries(
  Object.entries(byId).map(([id, list]) => [
    id,
    { count: list.length, rank: list[0].rank, title: list[0].title, seeds: [...new Set(list.map((x) => x.seed))], vps: [...new Set(list.map((x) => x.vp))] },
  ]),
)

writeFileSync(`${OUT}/report.json`, JSON.stringify(all, null, 2))
const lines = [
  `PROVENANCE ${all.shortHead} dirty=${all.dirty}`,
  `RUNS ${all.runs.length}`,
  `FINDINGS ${findings.length}`,
  ...Object.entries(all.findingIndex).map(
    ([id, v]) => `${v.rank.toUpperCase()} ${id} x${v.count} [${v.seeds.join(',')}] @${v.vps.join('/')} — ${v.title}`,
  ),
  '',
  '--- detail ---',
  ...findings.map(
    (f) =>
      `[${f.rank}] ${f.id} ${f.seed}@${f.vp}: ${f.title}\n  ${f.detail}\n  evidence=${JSON.stringify(f.evidence).slice(0, 300)}`,
  ),
]
writeFileSync(`${OUT}/summary.txt`, lines.join('\n'))
console.log(lines.join('\n'))
