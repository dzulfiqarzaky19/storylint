/**
 * TASK BA — Lab under load (report-only).
 * node e2e/ba-lab-under-load.mjs
 */
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { mkdirSync, writeFileSync } from 'node:fs'
import { ownMeasurementStack } from './owned-stack.mjs'

const require = createRequire('D:/npm-global/node_modules/playwright/package.json')
const pwRoot = dirname(require.resolve('playwright/package.json'))
const { chromium } = await import(pathToFileURL(resolve(pwRoot, 'index.mjs')).href)
const OUT = 'e2e/output/ba'
mkdirSync(OUT, { recursive: true })

const KINDS = ['beat', 'place', 'character-spark', 'lore-spark', 'what-if', 'question', 'motif']
const TITLES = {
  beat: ['Bridge collapses', 'Midnight argument', 'Treaty signing', 'Chase through market', 'False dawn'],
  place: ['Salt docks', 'Glass library', 'Upper warren', 'River cut', 'Ash courtyard'],
  'character-spark': ['Kael the runner', 'Mira of the ledger', 'Old Voss', 'Twin heralds', 'Quiet cook'],
  'lore-spark': ['Coin curse', 'Three banners', 'Salt law', 'Night bells', 'Lost census'],
  'what-if': ['If the treaty fails', 'If Kael never left', 'If the river freezes', 'If Mira lies', 'If the library burns'],
  question: ['Who owns the docks?', 'Why did Voss leave?', 'What is the census?', 'Where is the third banner?', 'When do bells stop?'],
  motif: ['Salt on every threshold', 'Broken glass light', 'Counting coins twice', 'Wet boots indoors', 'Names said thrice'],
}

function buildCards(n = 48) {
  const cards = []
  const cardIds = []
  for (let i = 0; i < n; i++) {
    const kind = KINDS[i % KINDS.length]
    const pool = TITLES[kind]
    const title = `${pool[i % pool.length]} #${Math.floor(i / KINDS.length) + 1}`
    const id = `lab-card-ba-${String(i + 1).padStart(3, '0')}`
    cardIds.push(id)
    let status = 'active'
    // ~10 promoted, ~3 pinned, rest active — no archived in the "junk drawer" load
    if (i < 10) status = 'promoted'
    else if (i < 13) status = 'pinned'
    const card = {
      id,
      boardId: 'lab-board-bench',
      kind,
      title,
      body: `BA load body for ${title}. Half-remembered note ${i + 1}.`,
      status,
      createdAt: new Date(Date.now() - (n - i) * 3600_000).toISOString(),
      updatedAt: new Date(Date.now() - (n - i) * 1800_000).toISOString(),
    }
    if (status === 'promoted') {
      card.promoted = {
        at: new Date().toISOString(),
        as: kind === 'beat' ? 'chapter-stub' : 'sheet-proposal',
        targetIds: [kind === 'beat' ? `chapter-ba-${i}` : `sheet-ba-${i}`],
      }
    }
    cards.push(card)
  }
  return { cards, cardIds }
}

const stack = await ownMeasurementStack({ skipBuild: process.env.STORYLINT_SKIP_BUILD === '1' })
const browser = await chromium.launch({ channel: 'msedge', headless: true })
const report = {
  head: stack.head,
  shortHead: stack.shortHead,
  dirty: stack.dirty,
  at: new Date().toISOString(),
  method: 'owned-stack Playwright seed 48 mixed Lab cards; measure @1440 and @390; report-only',
}

async function seedLab(page) {
  const { cards, cardIds } = buildCards(48)
  return page.evaluate(async ({ cards, cardIds }) => {
    const list = await fetch('/api/projects').then((r) => r.json())
    const id = `ba-lab-${Date.now()}`
    const created = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id, title: 'BA Lab Load' }),
    })
    const body = await created.json().catch(() => ({}))
    const pid = body.id || id
    await fetch(`/api/projects/${encodeURIComponent(pid)}/activate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    })
    let p = await fetch('/api/project').then((r) => r.json())
    // normalize lab
    const lab = {
      boards: [
        {
          id: 'lab-board-bench',
          title: 'Bench',
          cardIds,
        },
      ],
      cards,
    }
    const putBody = { ...p, lab }
    // strip fields that may reject
    const put = await fetch('/api/project', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(putBody),
    })
    let putErr = null
    if (!put.ok) {
      try {
        putErr = await put.json()
      } catch {
        putErr = await put.text()
      }
    }
    // fallback: create via API one-by-one if PUT fails
    let createdCount = 0
    let createErr = null
    if (!put.ok) {
      for (const card of cards) {
        if (card.status !== 'active' && card.status !== 'pinned') continue
        const res = await fetch('/api/lab/cards', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            boardId: 'lab-board-bench',
            kind: card.kind,
            title: card.title,
            body: card.body,
          }),
        }).catch((e) => ({ ok: false, status: 0, err: String(e) }))
        if (res && res.ok) createdCount++
        else if (!createErr) {
          try {
            createErr = await res.json()
          } catch {
            createErr = res
          }
        }
      }
    }
    const after = await fetch('/api/project').then((r) => r.json())
    const statuses = {}
    for (const c of after.lab?.cards || []) {
      statuses[c.status] = (statuses[c.status] || 0) + 1
    }
    const kinds = {}
    for (const c of after.lab?.cards || []) {
      kinds[c.kind] = (kinds[c.kind] || 0) + 1
    }
    return {
      putOk: put.ok,
      putStatus: put.status,
      putErr,
      createdCount,
      createErr,
      cardCount: after.lab?.cards?.length || 0,
      statuses,
      kinds,
      boardCardIds: after.lab?.boards?.[0]?.cardIds?.length || 0,
    }
  }, { cards, cardIds })
}

async function measure(page, viewport) {
  await page.setViewportSize(viewport)
  await page.waitForTimeout(200)
  // open Lab
  await page.getByRole('button', { name: 'Lab', exact: true }).click().catch(async () => {
    await page.getByRole('tab', { name: /^Lab$/i }).click().catch(() => {})
  })
  await page.waitForSelector('.lab, main[aria-label="Lab"]', { timeout: 10_000 })
  await page.waitForTimeout(300)

  const geom = await page.evaluate(async () => {
    const lab = document.querySelector('.lab, main[aria-label="Lab"]')
    const grid = document.querySelector('.lab__grid')
    const promoted = document.querySelector('.lab__promoted, .lab__promoted-list')
    const promotedList = document.querySelector('.lab__promoted-list')
    const filters = document.querySelector('.lab__filters')
    const composer = document.querySelector('.lab__composer')
    const kindDisclosure = document.querySelector('.lab__filters details.lab__disclosure')
    const composerDisclosure = document.querySelector('.lab__composer details.lab__disclosure')

    function box(el) {
      if (!el) return null
      const r = el.getBoundingClientRect()
      const cs = getComputedStyle(el)
      return {
        w: Math.round(r.width),
        h: Math.round(r.height),
        top: Math.round(r.top),
        scrollH: el.scrollHeight,
        clientH: el.clientHeight,
        scrollW: el.scrollWidth,
        clientW: el.clientWidth,
        overflowY: cs.overflowY,
        overflowX: cs.overflowX,
        overflow: cs.overflow,
      }
    }

    const cards = [...document.querySelectorAll('.lab__card')].map((el) => ({
      title: (el.querySelector('.lab__card-title')?.textContent || '').trim(),
      kind: el.getAttribute('data-kind'),
      pinned: el.classList.contains('lab__card--pinned'),
      actions: [...el.querySelectorAll('button')].map((b) => (b.textContent || '').trim()),
    }))
    const promotedItems = [...document.querySelectorAll('.lab__promoted-list li')].map((li) =>
      (li.textContent || '').replace(/\s+/g, ' ').trim(),
    )

    // try find a specific half-remembered title
    const targetTitle = 'Quiet cook'
    const targetEl = [...document.querySelectorAll('.lab__card-title')].find((el) =>
      (el.textContent || '').includes(targetTitle),
    )
    let findPath = { targetTitle, presentInDom: Boolean(targetEl), inViewport: false, filterUsed: false }
    if (targetEl) {
      const r = targetEl.getBoundingClientRect()
      findPath.inViewport = r.top >= 0 && r.bottom <= window.innerHeight
      if (!findPath.inViewport) {
        targetEl.scrollIntoView({ block: 'center' })
        const r2 = targetEl.getBoundingClientRect()
        findPath.afterScrollIntoView = r2.top >= 0 && r2.bottom <= window.innerHeight
      }
    }

    // open kind filter disclosure
    let filterOpen = null
    if (kindDisclosure) {
      kindDisclosure.open = true
      await new Promise((r) => setTimeout(r, 50))
      filterOpen = {
        open: kindDisclosure.open,
        summary: (kindDisclosure.querySelector('summary')?.textContent || '').trim(),
        optionCount: kindDisclosure.querySelectorAll('button').length,
        menuBox: box(kindDisclosure.querySelector('.lab__filter-menu')),
      }
    }

    // filter to character-spark
    const charBtn = [...document.querySelectorAll('.lab__filter-menu button, .lab__filters button')].find((b) =>
      /Character/i.test(b.textContent || ''),
    )
    let afterFilter = null
    if (charBtn) {
      charBtn.click()
      await new Promise((r) => setTimeout(r, 100))
      const visible = [...document.querySelectorAll('.lab__card')].map((el) => ({
        title: (el.querySelector('.lab__card-title')?.textContent || '').trim(),
        kind: el.getAttribute('data-kind'),
      }))
      afterFilter = {
        count: visible.length,
        kinds: [...new Set(visible.map((v) => v.kind))],
        titles: visible.map((v) => v.title).slice(0, 12),
        targetFound: visible.some((v) => v.title.includes(targetTitle)),
      }
      findPath.filterUsed = true
      findPath.afterFilter = afterFilter
      // reset All
      const allBtn = [...document.querySelectorAll('.lab__filters button')].find((b) => /^(All)$/i.test((b.textContent || '').trim()))
      allBtn?.click()
      await new Promise((r) => setTimeout(r, 50))
    }

    // composer disclosure open under load
    let composerOpen = null
    if (composerDisclosure) {
      composerDisclosure.open = true
      await new Promise((r) => setTimeout(r, 50))
      composerOpen = {
        open: composerDisclosure.open,
        summary: (composerDisclosure.querySelector('summary')?.textContent || '').trim(),
        optionCount: composerDisclosure.querySelectorAll('button').length,
        box: box(composerDisclosure),
        kindsBox: box(composerDisclosure.querySelector('.lab__composer-kinds')),
      }
    }

    // archive button present on first card?
    const firstCardActions = cards[0]?.actions || []

    // scroll lab to bottom to see promoted
    if (lab) {
      lab.scrollTop = lab.scrollHeight
      await new Promise((r) => setTimeout(r, 80))
    }
    const promotedAfterScroll = box(promotedList || promoted)

    // hard delete buttons?
    const allButtons = [...document.querySelectorAll('.lab button')].map((b) => (b.textContent || '').trim())
    const hasDelete = allButtons.some((t) => /^delete$/i.test(t))
    const hasArchive = allButtons.some((t) => /^archive$/i.test(t))
    const hasDecay = allButtons.some((t) => /decay|expire|clear promoted|remove promoted/i.test(t))

    return {
      viewport: { w: window.innerWidth, h: window.innerHeight },
      lab: box(lab),
      grid: box(grid),
      promotedSection: box(promoted),
      promotedList: box(promotedList),
      promotedAfterScrollToEnd: promotedAfterScroll,
      filters: box(filters),
      composer: box(composer),
      cardCountVisible: cards.length,
      promotedCount: promotedItems.length,
      sampleCards: cards.slice(0, 8),
      samplePromoted: promotedItems.slice(0, 8),
      findPath,
      filterOpen,
      afterFilter,
      composerOpen,
      firstCardActions,
      hasDelete,
      hasArchive,
      hasDecay,
      allUniqueButtons: [...new Set(allButtons)].sort(),
      // wall checks
      labScrollable: lab ? lab.scrollHeight > lab.clientHeight + 1 : null,
      promotedListScrollable: promotedList
        ? promotedList.scrollHeight > promotedList.clientHeight + 1
        : null,
      promotedOwnOverflow:
        promotedList
          ? getComputedStyle(promotedList).overflowY
          : promoted
            ? getComputedStyle(promoted).overflowY
            : null,
      gridScrollable: grid ? grid.scrollHeight > grid.clientHeight + 1 : null,
    }
  })

  // keyboard find: type filter + search absence
  const search = await page.evaluate(() => {
    const inputs = [...document.querySelectorAll('.lab input, .lab textarea')]
    return {
      inputCount: inputs.length,
      placeholders: inputs.map((i) => i.getAttribute('placeholder') || i.getAttribute('aria-label')),
      hasSearch: inputs.some((i) => /search|find|filter text/i.test(`${i.placeholder} ${i.getAttribute('aria-label')}`)),
    }
  })

  return { ...geom, search }
}

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  page.setDefaultTimeout(25_000)
  await page.goto(stack.ui, { waitUntil: 'networkidle' })
  report.seed = await seedLab(page)
  console.log('SEED', JSON.stringify(report.seed, null, 2))
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForTimeout(300)

  // if seed put failed with low cards, try createLabCard via many POSTs using known route
  if ((report.seed.cardCount || 0) < 30) {
    report.seedRetry = await page.evaluate(async () => {
      // discover routes from OPTIONS? try common paths
      const paths = ['/api/lab/cards', '/api/project/lab/cards', '/api/lab/card']
      const tries = []
      for (const path of paths) {
        const res = await fetch(path, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            kind: 'character-spark',
            title: 'Probe card',
            body: 'probe',
          }),
        })
        let body = null
        try {
          body = await res.json()
        } catch {
          body = await res.text()
        }
        tries.push({ path, status: res.status, body })
      }
      return tries
    })
    console.log('SEED_RETRY', JSON.stringify(report.seedRetry, null, 2))
  }

  report.at1440 = await measure(page, { width: 1440, height: 900 })
  console.log('AT1440 cards', report.at1440.cardCountVisible, 'promoted', report.at1440.promotedCount)
  report.at390 = await measure(page, { width: 390, height: 844 })
  console.log('AT390 cards', report.at390.cardCountVisible, 'promoted', report.at390.promotedCount)

  // lifecycle code inventory snapshot from runtime project
  report.lifecycle = await page.evaluate(async () => {
    const p = await fetch('/api/project').then((r) => r.json())
    const cards = p.lab?.cards || []
    const byStatus = {}
    for (const c of cards) byStatus[c.status] = (byStatus[c.status] || 0) + 1
    // try archive one active if UI would
    return {
      total: cards.length,
      byStatus,
      archivedPresent: cards.some((c) => c.status === 'archived'),
      promotedHaveExitFields: cards.filter((c) => c.status === 'promoted').map((c) => ({
        id: c.id,
        promoted: c.promoted,
      })).slice(0, 3),
    }
  })

  // Summary judgments
  function judge(m, label) {
    const promotedWall =
      m.promotedCount > 0 &&
      m.promotedList &&
      m.promotedList.scrollH > m.promotedList.clientH + 1 &&
      (m.promotedOwnOverflow === 'visible' || m.promotedOwnOverflow === 'auto' || true)
    // wall = content taller than container BUT container doesn't scroll itself (overflow visible) while parent may
    const promotedListIsWall =
      m.promotedCount >= 8 &&
      m.promotedList &&
      m.promotedList.scrollH >= m.promotedList.clientH &&
      m.promotedOwnOverflow === 'visible' &&
      m.labScrollable
    return {
      label,
      liveCardsVisible: m.cardCountVisible,
      promotedCount: m.promotedCount,
      labScrollable: m.labScrollable,
      labScrollRatio: m.lab ? m.lab.scrollH / Math.max(m.lab.clientH, 1) : null,
      promotedListScrollH: m.promotedList?.scrollH,
      promotedListClientH: m.promotedList?.clientH,
      promotedOverflowY: m.promotedOwnOverflow,
      promotedLikelyWall: promotedListIsWall || (m.promotedCount >= 8 && m.promotedOwnOverflow === 'visible'),
      filterPresent: Boolean(m.filters),
      filterOptions: m.filterOpen?.optionCount,
      filterFindsTarget: m.afterFilter?.targetFound,
      filterNarrows: m.afterFilter ? m.afterFilter.count < m.cardCountVisible : null,
      composerDisclosureOptions: m.composerOpen?.optionCount,
      hasArchiveAction: m.hasArchive,
      hasDeleteAction: m.hasDelete,
      hasSearch: m.search?.hasSearch,
      findHalfRemembered: m.findPath,
    }
  }

  report.judgment = {
    code: {
      kinds: 7,
      statuses: ['active', 'pinned', 'promoted', 'archived'],
      archiveInDomain: true,
      archiveInUI: true,
      hardDelete: false,
      decay: false,
      promotedSectionNoArchive: true,
      archivedHiddenFromBench: true,
      filterBehindDisclosure: true,
      composerKindBehindDisclosure: true,
    },
    at1440: judge(report.at1440, '1440'),
    at390: judge(report.at390, '390'),
  }

  writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 2))
  const lines = [
    `PROVENANCE ${report.shortHead} dirty=${report.dirty}`,
    `SEED cards=${report.seed.cardCount} statuses=${JSON.stringify(report.seed.statuses)} putOk=${report.seed.putOk}`,
    `1440 live=${report.at1440.cardCountVisible} promoted=${report.at1440.promotedCount} labScroll=${report.at1440.labScrollable} promotedOverflow=${report.at1440.promotedOwnOverflow} archive=${report.at1440.hasArchive} delete=${report.at1440.hasDelete}`,
    `390  live=${report.at390.cardCountVisible} promoted=${report.at390.promotedCount} labScroll=${report.at390.labScrollable} promotedOverflow=${report.at390.promotedOwnOverflow}`,
    `FILTER 1440 narrowed=${report.judgment.at1440.filterNarrows} target=${report.judgment.at1440.filterFindsTarget} options=${report.judgment.at1440.filterOptions}`,
    `FIND ${JSON.stringify(report.at1440.findPath)}`,
    `LIFECYCLE ${JSON.stringify(report.lifecycle)}`,
    `JUDGMENT ${JSON.stringify(report.judgment, null, 2)}`,
  ]
  writeFileSync(`${OUT}/summary.txt`, lines.join('\n'))
  console.log(lines.join('\n'))
} finally {
  await browser.close()
  await stack.stop()
}
