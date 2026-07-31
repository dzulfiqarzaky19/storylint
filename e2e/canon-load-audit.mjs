/**
 * TASK AO — Canon under load. READ-ONLY audit, no fixes.
 *
 * Every Canon judgement so far was made on empty or lightly-fixtured states, but Canon is the
 * surface that GROWS: it accumulates every character, place, organisation and piece of lore for a
 * whole novel. This builds a realistically loaded project (60+ sheets, dense kinship and
 * membership edges) and measures three things worst-first:
 *   1. is the network map still legible, or a hairball
 *   2. does the family view stay readable (ox's unexamined "family sparse under load" nit)
 *   3. does the binder list stay navigable at length, and does scroll restore still work
 *   4. is the kind filter still the right tool at scale, or is search needed
 *
 * Measures, does not judge pass/fail on aesthetics: it reports numbers and takes shots so a human
 * can rule. The only hard failures are things that are unambiguously broken (overflow, unreachable
 * controls, scroll restore losing position).
 *
 * Provenance: owned stack only. Visibility via checkVisibility, never geometry alone.
 */
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { mkdirSync, writeFileSync } from 'node:fs'
import { requireApiOrigin, requireUiOrigin, reloadApp } from './helpers.mjs'

const require = createRequire('D:/npm-global/node_modules/playwright/package.json')
const pwRoot = dirname(require.resolve('playwright/package.json'))
const { chromium } = await import(pathToFileURL(resolve(pwRoot, 'index.mjs')).href)

const OUT = 'e2e/output/canon-load'
mkdirSync(OUT, { recursive: true })

const API = requireApiOrigin()
const UI = requireUiOrigin()
const stamp = Date.now()
const projectId = `canon-load-${stamp}`

/** A novel-sized cast. Names are varied in length on purpose: truncation is part of what we test. */
const CHARACTERS = [
  'Aria Emberwright', 'Kael', 'Mira Solveig', 'Toren', 'Nessa Vale', 'Bram Holt',
  'Ysolde', 'Fen', 'Ilira Thorne-Ashcombe', 'Sabra', 'Dov', 'Perrin Ash',
  'Halvard', 'Nim', 'Oleander Quist', 'Rell', 'Sunniva', 'Tam',
  'Ulla Brandt', 'Varek', 'Wren', 'Yarrow Pike', 'Zephyrine Marchetti', 'Corin',
  'Delphine', 'Erasmus Vole', 'Fiora', 'Garrick', 'Hesper Lune', 'Isen',
]
const LORE = [
  'The Sealed Archive', 'Emberlight', 'The Long Winter Accord', 'Saltbinding',
  'The Nine Verses', 'Ashfall', 'Riverspeech', 'The Debt of Names',
  'Glasswork', 'The Quiet Year', 'Tidecant', 'Wardsong',
]
const WORLD = [
  'Moon Archive', 'Kestrel Harbour', 'The Undercroft', 'Thornfield',
  'Bellow Deep', 'Saltmarket', 'The Pale Steps', 'Highreach',
  'Fen Crossing', 'The Ember Gate',
]
const ORGS = [
  'The Ember Order', 'Wardens of the Archive', 'Saltmarket Guild',
  'House Marchetti', 'The Quiet Hand', 'Riverspeech Circle',
  'The Nine', 'Thornfield Levy',
]

async function seed(request) {
  const created = await request.post(`${API}/api/projects`, {
    data: { id: projectId, title: 'Canon under load' },
    headers: { 'content-type': 'application/json' },
  })
  if (!created.ok() && created.status() !== 409) throw new Error(`create -> ${created.status()}`)
  const active = await request.post(`${API}/api/projects/${encodeURIComponent(projectId)}/activate`, {
    data: {},
    headers: { 'content-type': 'application/json' },
  })
  if (!active.ok()) throw new Error(`activate -> ${active.status()}`)

  const sheets = []
  const push = (kind, names) => {
    for (const [i, name] of names.entries()) {
      sheets.push({
        id: `load-${kind}-${i}-${stamp}`,
        kind,
        name,
        aliases: [],
        summary: '',
        notes: '',
        portrait: name.slice(0, 2).toUpperCase(),
        facts: [],
      })
    }
  }
  push('character', CHARACTERS)
  push('lore', LORE)
  push('world', WORLD)
  push('organization', ORGS)

  for (const sheet of sheets) {
    const response = await request.put(`${API}/api/sheets/${sheet.id}`, {
      data: sheet,
      headers: { 'content-type': 'application/json' },
    })
    if (!response.ok()) throw new Error(`seed ${sheet.id} -> ${response.status()}`)
  }

  // Dense relationships: kinship chains plus membership, the shape a real cast produces.
  const characters = sheets.filter((s) => s.kind === 'character')
  const orgs = sheets.filter((s) => s.kind === 'organization')
  const edges = []
  for (let i = 0; i + 1 < characters.length; i += 2) {
    edges.push([characters[i], characters[i + 1], 'parent_of'])
  }
  for (let i = 0; i + 2 < characters.length; i += 3) {
    edges.push([characters[i], characters[i + 2], 'sibling_of'])
  }
  for (const [i, character] of characters.entries()) {
    edges.push([character, orgs[i % orgs.length], 'member_of'])
  }
  for (let i = 0; i + 4 < characters.length; i += 5) {
    edges.push([characters[i], characters[i + 4], 'rival_of'])
  }

  let accepted = 0
  for (const [from, to, key] of edges) {
    const factId = `load-fact-${accepted}-${stamp}`
    const response = await request.put(`${API}/api/sheets/${from.id}/facts/${factId}`, {
      data: {
        id: factId,
        key,
        value: to.name,
        statement: `${from.name} ${key.replace(/_/g, ' ')} ${to.name}`,
        claimKind: 'relationship',
        fromSheetId: from.id,
        toSheetId: to.id,
      },
      headers: { 'content-type': 'application/json' },
    })
    if (!response.ok()) throw new Error(`fact ${factId} -> ${response.status()}`)
    accepted += 1
  }

  return { sheets: sheets.length, edges: accepted }
}

const findings = []
const note = (severity, surface, detail) => findings.push({ severity, surface, detail })

function measureGraph(page) {
  return page.evaluate(() => {
    const shown = (el) => Boolean(el && el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }))
    const root = document.querySelector('main.graph')
    if (!root) return null
    const nodes = [...root.querySelectorAll('.graph__node')].filter(shown)
    const edges = [...root.querySelectorAll('.graph__edge')].filter(shown)
    const labels = [...root.querySelectorAll('.graph__label')].filter(shown)

    // Node overlap: how many visible nodes have centres within one node radius of another.
    const centres = nodes.map((n) => {
      const r = n.getBoundingClientRect()
      return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height }
    })
    let overlaps = 0
    for (let i = 0; i < centres.length; i += 1) {
      for (let j = i + 1; j < centres.length; j += 1) {
        const dx = centres[i].x - centres[j].x
        const dy = centres[i].y - centres[j].y
        const limit = (Math.min(centres[i].w, centres[j].w) || 24) * 0.9
        if (Math.hypot(dx, dy) < limit) overlaps += 1
      }
    }

    const stage = root.querySelector('.graph__canvas, .graph__family-stage')
    const stageRect = stage?.getBoundingClientRect()
    const offStage = centres.filter((c) => stageRect && (c.x < stageRect.left || c.x > stageRect.right || c.y < stageRect.top || c.y > stageRect.bottom)).length

    return {
      view: root.getAttribute('data-graph-view'),
      dense: root.getAttribute('data-graph-dense'),
      nodesVisible: nodes.length,
      edgesVisible: edges.length,
      labelsVisible: labels.length,
      nodeOverlaps: overlaps,
      nodesOffStage: offStage,
      stage: stageRect ? { w: Math.round(stageRect.width), h: Math.round(stageRect.height) } : null,
      scrollW: Math.round(root.scrollWidth),
      clientW: Math.round(root.clientWidth),
      documentOverflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      nodeSizes: centres.map((c) => Math.round(Math.min(c.w, c.h))),
      smallestNode: centres.length ? Math.round(Math.min(...centres.map((c) => Math.min(c.w, c.h)))) : 0,
      titledNodes: [...root.querySelectorAll('.graph__node title')].length,
      filterLabels: [...root.querySelectorAll('.graph__filters button')].filter(shown).map((b) => b.textContent.trim()),
      hasSearch: Boolean(root.querySelector('input[type="search"], [role="searchbox"]')),
    }
  })
}

function measureBinder(page) {
  return page.evaluate(() => {
    const shown = (el) => Boolean(el && el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }))
    const panel = document.querySelector('.panel')
    if (!panel || !shown(panel)) return { visible: false }
    const body = panel.querySelector('.panel__body')
    const rows = [...panel.querySelectorAll('.ui-list-row')].filter(shown)
    const rect = panel.getBoundingClientRect()
    return {
      visible: true,
      widthPx: Math.round(rect.width),
      rowsVisible: rows.length,
      scrollHeight: body ? Math.round(body.scrollHeight) : 0,
      clientHeight: body ? Math.round(body.clientHeight) : 0,
      scrollTop: body ? Math.round(body.scrollTop) : 0,
      truncatedRows: rows.filter((r) => r.scrollWidth > r.clientWidth + 1).length,
      hasSearch: Boolean(panel.querySelector('input[type="search"], [role="searchbox"]')),
      sectionHeads: [...panel.querySelectorAll('.panel__label, .panel__sublabel')].filter(shown).map((h) => h.textContent.trim()),
    }
  })
}

const browser = await chromium.launch({ channel: 'msedge', headless: true })
const report = { seeded: null, desktop: {}, phone: {} }

const setup = await browser.newPage({ viewport: { width: 1440, height: 900 } })
report.seeded = await seed(setup.request)
await setup.close()

for (const [label, width, height] of [['1440', 1440, 900], ['390', 390, 844]]) {
  const page = await browser.newPage({ viewport: { width, height } })
  await page.goto(UI, { waitUntil: 'networkidle' })
  await reloadApp(page)
  const canon = page.getByRole('button', { name: 'Canon', exact: true })
  if (await canon.count()) await canon.click()
  const graph = page.getByRole('main', { name: 'Relationship graph' })
  await graph.waitFor({ timeout: 15000 })
  await page.waitForTimeout(800)

  const network = await measureGraph(page)
  await page.screenshot({ path: `${OUT}/network-${label}.png` })

  await graph.getByRole('button', { name: 'Family', exact: true }).click()
  await page.waitForTimeout(800)
  const family = await measureGraph(page)
  await page.screenshot({ path: `${OUT}/family-${label}.png` })

  await graph.getByRole('button', { name: 'Network', exact: true }).click()
  await page.waitForTimeout(400)

  // One kind only: is the filter still a useful instrument at this size?
  await graph.getByRole('button', { name: 'Lore', exact: true }).click()
  await graph.getByRole('button', { name: 'World', exact: true }).click()
  await graph.getByRole('button', { name: 'Organizations', exact: true }).click()
  await page.waitForTimeout(600)
  const charactersOnly = await measureGraph(page)
  await page.screenshot({ path: `${OUT}/characters-only-${label}.png` })
  for (const name of ['Lore', 'World', 'Organizations']) {
    await graph.getByRole('button', { name, exact: true }).click()
  }
  await page.waitForTimeout(400)

  const binder = await measureBinder(page)
  const target = label === '1440' ? report.desktop : report.phone
  Object.assign(target, { network, family, charactersOnly, binder })

  // Scroll restore under length: scroll the list, open a sheet, come back.
  let scrollRestore = null
  if (binder.visible && binder.scrollHeight > binder.clientHeight) {
    await page.evaluate(() => {
      const body = document.querySelector('.panel .panel__body')
      if (body) body.scrollTop = Math.round((body.scrollHeight - body.clientHeight) * 0.7)
    })
    await page.waitForTimeout(300)
    // Open a row that is already on screen. Clicking an off-screen row makes Playwright scroll the
    // list to reach it, which changes the very position under test and fabricates drift.
    const row = page.locator('.ui-list-row').nth(20)
    if (await row.count()) {
      await row.scrollIntoViewIfNeeded()
      await page.waitForTimeout(200)
      const before = await page.evaluate(() => Math.round(document.querySelector('.panel .panel__body')?.scrollTop ?? 0))
      await row.click()
      await page.waitForTimeout(600)
      const back = page.locator('[data-binder-detail="sheet"]').getByRole('button', { name: 'Back', exact: true })
      if (await back.count()) {
        await back.click()
        await page.waitForTimeout(600)
      }
      // Sample repeatedly: a late restore must not be mistaken for a lost position.
      let after = -1
      for (let i = 0; i < 6; i += 1) {
        await page.waitForTimeout(200)
        after = await page.evaluate(() => Math.round(document.querySelector('.panel .panel__body')?.scrollTop ?? 0))
        if (after === before) break
      }
      scrollRestore = { before, after, drift: Math.abs(before - after) }
    }
  }
  target.scrollRestore = scrollRestore
  await page.screenshot({ path: `${OUT}/binder-${label}.png` })
  await page.close()
}

await browser.close()

// ---------- findings, worst first ----------
if (!report.desktop.network || report.desktop.network.edgesVisible === 0) {
  console.error('REFUSE: fixture produced no visible edges; a density audit with zero edges measures nothing')
  process.exit(2)
}

const d = report.desktop
const p = report.phone

if (d.network?.documentOverflowX) note('HARD', 'graph@1440', 'document scrolls horizontally under load')
if (p.network?.documentOverflowX) note('HARD', 'graph@390', 'document scrolls horizontally under load')
if (d.network?.nodesOffStage) note('HARD', 'graph@1440', `${d.network.nodesOffStage} nodes render outside the canvas bounds`)
if (p.network?.nodesOffStage) note('HARD', 'graph@390', `${p.network.nodesOffStage} nodes render outside the canvas bounds`)

for (const [label, m] of [['1440', d], ['390', p]]) {
  if (!m.network) continue
  const total = report.seeded.sheets
  // Touch: a node that cannot be reliably tapped is not a control, whatever it looks like.
  if (label === '390' && m.network.smallestNode && m.network.smallestNode < 44) {
    note('HARD', `network@390`, `smallest node is ${m.network.smallestNode}px, below the 44px touch minimum (${m.network.nodesVisible} nodes)`)
  }
  // Identification: with labels suppressed, a 2-character portrait is the only way to tell nodes
  // apart on screen. The accessible name still carries the full name, so this is a visual failure.
  if (m.network.labelsVisible === 0 && m.network.nodesVisible > 0) {
    note('LEGIBILITY', `network@${label}`, `no node labels rendered for ${m.network.nodesVisible} nodes; only portraits identify them visually (titles present: ${m.network.titledNodes})`)
  }
  if (m.network.nodeOverlaps > 0) {
    note('LEGIBILITY', `network@${label}`, `${m.network.nodeOverlaps} node pairs overlap (${m.network.nodesVisible} nodes, ${m.network.edgesVisible} edges)`)
  }
  if (m.network.nodesVisible < total) {
    note('INFO', `network@${label}`, `${m.network.nodesVisible} of ${total} sheets rendered as nodes`)
  }
  if (m.family && m.family.nodeOverlaps > 0) {
    note('LEGIBILITY', `family@${label}`, `${m.family.nodeOverlaps} node pairs overlap in family view`)
  }
  if (!m.network.hasSearch && total >= 40) {
    note('SCALE', `graph@${label}`, `no search on the map with ${total} sheets; kind filter alone narrows to ${m.charactersOnly?.nodesVisible ?? '?'} at best`)
  }
  if (m.binder?.visible) {
    if (!m.binder.hasSearch && total >= 40) {
      note('SCALE', `binder@${label}`, `no search in a ${total}-entry list; ${m.binder.rowsVisible} rows rendered, scrollHeight ${m.binder.scrollHeight}px in ${m.binder.clientHeight}px viewport`)
    }
    if (m.binder.truncatedRows) {
      note('LEGIBILITY', `binder@${label}`, `${m.binder.truncatedRows} row labels truncated at ${m.binder.widthPx}px`)
    }
    if (m.scrollRestore && m.scrollRestore.drift > 8) {
      note('HARD', `binder@${label}`, `scroll restore drifted ${m.scrollRestore.drift}px (before ${m.scrollRestore.before}, after ${m.scrollRestore.after})`)
    }
  }
}

const order = { HARD: 0, LEGIBILITY: 1, SCALE: 2, INFO: 3 }
findings.sort((a, b) => order[a.severity] - order[b.severity])

const lines = [
  '# Canon under load (TASK AO)',
  '',
  `Seeded: ${report.seeded.sheets} sheets, ${report.seeded.edges} accepted relationship facts.`,
  '',
  '## Findings, worst first',
  '',
  ...(findings.length
    ? findings.map((f) => `- **${f.severity}** ${f.surface}: ${f.detail}`)
    : ['- none']),
  '',
  '## Raw measurements',
  '',
  '```json',
  JSON.stringify(report, null, 2),
  '```',
]
writeFileSync(`${OUT}/report.md`, lines.join('\n'))

console.log(JSON.stringify({ seeded: report.seeded, findings }, null, 2))
console.log(`\nWrote ${OUT}/report.md and shots`)

const hard = findings.filter((f) => f.severity === 'HARD')
if (hard.length) {
  console.error(`\n${hard.length} HARD finding(s) under load:`)
  for (const f of hard) console.error(` - ${f.surface}: ${f.detail}`)
  process.exit(1)
}
console.log('\nPASS: no hard breakage under load (see report for legibility/scale findings)')
