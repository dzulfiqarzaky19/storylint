/**
 * TASK AZ — Canon under load (read-only probe).
 * Owned stack + provenance. No product fixes.
 *
 * Measures @1440 and @390 with 60+ sheets + dense relationships:
 *  1. Network + Family graph legibility at volume
 *  2. Binder sheet list scroll / restore / findability
 *  3. Kind filters at scale (need-for-search signal only)
 *  4. Today's regressions: empty-primary demote when FULL, B6, dirty-leave
 */
import { createRequire } from 'node:module'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { ownMeasurementStack } from './owned-stack.mjs'
import {
  setApiBase,
  ensureIsolatedProject,
  reclaimIsolatedProject,
  fetchActiveProject,
  gotoWorkspace,
  ensureCompanionOpen,
  ensureBinderOpen,
  BROWSER_IS_VISIBLE_SOURCE,
} from './helpers.mjs'

const require = createRequire('D:/npm-global/node_modules/playwright/package.json')
const pwRoot = dirname(require.resolve('playwright/package.json'))
const { chromium } = await import(pathToFileURL(resolve(pwRoot, 'index.mjs')).href)

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUT_DIR = join(ROOT, 'e2e', 'output')
const OUT = join(OUT_DIR, 'canon-under-load-az.md')
const API = () => process.env.STORYLINT_API_ORIGIN

const SHEET_KINDS = ['character', 'lore', 'world', 'organization']
const KIND_LABEL = {
  character: 'Characters',
  lore: 'Lore',
  world: 'World',
  organization: 'Organizations',
}

// Dense cast: multi-generation family + org/world/lore satellites.
const CAST = {
  characters: [
    // Gen 0
    'Elder Mara', 'Elder Torin',
    // Gen 1
    'Aria Vale', 'Kael Voss', 'Lyra Vale', 'Bren Vale', 'Sera Torin', 'Dain Torin',
    // Gen 2
    'Nia Vale', 'Rook Voss', 'Ivy Vale', 'Pax Torin', 'Wren Vale', 'Joss Voss',
    'Tess Vale', 'Hum Vale',
    // Gen 3 + extended
    'Oren Vale', 'Mira Voss', 'Cass Torin', 'Elan Vale', 'Faye Torin', 'Garr Voss',
    'Hale Vale', 'Iris Torin', 'Jude Vale', 'Kira Voss', 'Lark Torin', 'Nash Vale',
    'Opal Voss', 'Quin Torin', 'Rhea Vale', 'Sage Voss',
    'Toma Vale', 'Una Torin', 'Vesper Voss', 'Wynn Vale',
  ],
  lore: [
    'The Iron Door', 'Lantern Oath', 'Blue-Eye Prophecy', 'Corridor Silence',
    'Ash Covenant', 'River Binding', 'Crown of Embers', 'Night Market Pact',
    'Glass Orchard', 'Seven Seals', 'Widow Bell', 'Salt Hymn',
  ],
  world: [
    'Valehold', 'Torin Keep', 'Ashen Marches', 'Lantern Coast',
    'Ember Spire', 'Quiet Corridor', 'River Reach', 'Glass Fen',
    'High Causeway', 'Low Market',
  ],
  organization: [
    'Vale House', 'Torin Guard', 'Lantern Order', 'Ash Covenant Circle',
    'Market Syndicate', 'Spire Scholars', 'River Wardens', 'Fen Watch',
    'Crown Cartographers', 'Door Keepers',
  ],
}

async function apiJson(path, init = {}) {
  const res = await fetch(`${API()}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(init.headers || {}),
    },
  })
  const text = await res.text()
  let body = null
  try { body = text ? JSON.parse(text) : null } catch { body = text }
  return { ok: res.ok, status: res.status, body, text }
}

async function putProject(project) {
  const result = await apiJson('/api/project', {
    method: 'PUT',
    body: JSON.stringify(project),
  })
  if (!result.ok) throw new Error(`PUT /api/project failed ${result.status}: ${result.text}`)
  return result.body
}

function sheetId(kind, index) {
  return `az-${kind}-${String(index + 1).padStart(2, '0')}`
}

function relFact(id, key, fromSheetId, toSheetId, value = key) {
  return {
    id,
    key,
    value,
    statement: `${key}: ${fromSheetId} → ${toSheetId}`,
    claimKind: 'relationship',
    fromSheetId,
    toSheetId,
  }
}

function attrFact(id, key, value) {
  return {
    id,
    key,
    value,
    statement: `${key}: ${value}`,
    claimKind: 'attribute',
  }
}

function buildSheets() {
  const sheets = []
  const byKind = {}

  for (const kind of SHEET_KINDS) {
    byKind[kind] = []
    const names = CAST[kind === 'character' ? 'characters' : kind]
    names.forEach((name, i) => {
      const id = sheetId(kind, i)
      byKind[kind].push({ id, name })
      sheets.push({
        id,
        kind,
        name,
        aliases: i % 5 === 0 ? [`${name.split(' ')[0]}`] : [],
        summary: `${KIND_LABEL[kind].slice(0, -1) || kind} under load: ${name}.`,
        notes: i % 3 === 0 ? `Notes for ${name} — dense fixture.` : '',
        facts: [attrFact(`${id}-attr`, kind === 'character' ? 'role' : 'tag', `${kind}-${i + 1}`)],
      })
    })
  }

  const C = byKind.character
  // Multi-generation kinship mesh (Family view).
  const kinship = [
    // Gen0 → Gen1
    ['parent_of', C[0], C[2]], // Mara → Aria
    ['parent_of', C[0], C[4]], // Mara → Lyra
    ['parent_of', C[0], C[5]], // Mara → Bren
    ['parent_of', C[1], C[6]], // Torin → Sera
    ['parent_of', C[1], C[7]], // Torin → Dain
    ['spouse_of', C[0], C[1]], // Mara ↔ Torin
    // Gen1 partners
    ['spouse_of', C[2], C[3]], // Aria ↔ Kael
    ['partner_of', C[4], C[6]], // Lyra ↔ Sera
    ['sibling_of', C[2], C[4]],
    ['sibling_of', C[2], C[5]],
    ['sibling_of', C[4], C[5]],
    ['sibling_of', C[6], C[7]],
    // Gen1 → Gen2
    ['parent_of', C[2], C[8]],
    ['parent_of', C[2], C[10]],
    ['parent_of', C[2], C[12]],
    ['parent_of', C[3], C[9]],
    ['parent_of', C[3], C[11]],
    ['parent_of', C[3], C[13]],
    ['parent_of', C[4], C[14]],
    ['parent_of', C[6], C[15]],
    ['parent_of', C[7], C[16]],
    // Gen2 siblings + partners
    ['sibling_of', C[8], C[10]],
    ['sibling_of', C[8], C[12]],
    ['sibling_of', C[9], C[11]],
    ['spouse_of', C[8], C[9]],
    ['partner_of', C[10], C[11]],
    // Gen2 → Gen3
    ['parent_of', C[8], C[17]],
    ['parent_of', C[8], C[18]],
    ['parent_of', C[9], C[19]],
    ['parent_of', C[10], C[20]],
    ['parent_of', C[12], C[21]],
    ['parent_of', C[14], C[22]],
    ['parent_of', C[15], C[23]],
    // Extended mesh (still kinship)
    ['sibling_of', C[17], C[18]],
    ['spouse_of', C[17], C[24]],
    ['parent_of', C[17], C[25]],
    ['parent_of', C[24], C[26]],
    ['brother_of', C[19], C[20]],
    ['sister_of', C[21], C[22]],
    ['married_to', C[23], C[27]],
    ['father_of', C[3], C[28]],
    ['mother_of', C[2], C[29]],
    ['child_of', C[30], C[8]],
    ['son_of', C[31], C[9]],
    ['daughter_of', C[32], C[10]],
    ['sibling_of', C[25], C[26]],
    ['partner_of', C[28], C[29]],
    ['spouse_of', C[30], C[31]],
  ]

  let factN = 0
  for (const [key, from, to] of kinship) {
    if (!from || !to) continue
    const owner = sheets.find((s) => s.id === from.id)
    if (!owner) continue
    factN += 1
    owner.facts.push(relFact(`${from.id}-kin-${factN}`, key, from.id, to.id))
  }

  // Non-kin network edges: characters ↔ orgs/world/lore (Network density).
  const orgs = byKind.organization
  const worlds = byKind.world
  const lores = byKind.lore
  for (let i = 0; i < C.length; i++) {
    const ch = C[i]
    const owner = sheets.find((s) => s.id === ch.id)
    if (!owner) continue
    const org = orgs[i % orgs.length]
    const world = worlds[i % worlds.length]
    const lore = lores[i % lores.length]
    factN += 1
    owner.facts.push(relFact(`${ch.id}-member-${factN}`, 'member_of', ch.id, org.id, org.name))
    factN += 1
    owner.facts.push(relFact(`${ch.id}-lives-${factN}`, 'lives_in', ch.id, world.id, world.name))
    if (i % 2 === 0) {
      factN += 1
      owner.facts.push(relFact(`${ch.id}-knows-${factN}`, 'knows_of', ch.id, lore.id, lore.name))
    }
    // Extra character-character non-kin ties for hairball pressure
    if (i + 3 < C.length) {
      factN += 1
      owner.facts.push(relFact(`${ch.id}-ally-${factN}`, 'allied_with', ch.id, C[i + 3].id))
    }
    if (i + 7 < C.length && i % 2 === 1) {
      factN += 1
      owner.facts.push(relFact(`${ch.id}-rival-${factN}`, 'rivals', ch.id, C[i + 7].id))
    }
  }

  // Org ↔ world edges owned on orgs
  for (let i = 0; i < orgs.length; i++) {
    const org = orgs[i]
    const owner = sheets.find((s) => s.id === org.id)
    const world = worlds[i % worlds.length]
    factN += 1
    owner.facts.push(relFact(`${org.id}-based-${factN}`, 'based_in', org.id, world.id, world.name))
  }

  return { sheets, byKind, kinshipEdgeTarget: kinship.length, factN }
}

async function seedCanonLoad(projectId) {
  await reclaimIsolatedProject(projectId)
  const { sheets, byKind, kinshipEdgeTarget, factN } = buildSheets()
  const project = {
    schemaVersion: 2,
    title: `Canon load ${projectId.slice(-6)}`,
    chapters: [
      {
        id: 'ch-az-01',
        title: 'Chapter One',
        body: 'Aria opened the iron door. Kael waited in the quiet corridor of Valehold.',
        craftTags: ['setup'],
        revision: 0,
      },
    ],
    sheets,
    proposals: [],
    rejectedFingerprints: [],
    marks: [],
    researchNotes: [],
    lab: { boards: [{ id: 'bench', title: 'Bench', cardIds: [] }], cards: [] },
  }
  const saved = await putProject(project)
  const relFacts = saved.sheets.flatMap((s) => s.facts.filter((f) => f.claimKind === 'relationship'))
  return {
    project: saved,
    sheetCount: saved.sheets.length,
    byKindCounts: Object.fromEntries(SHEET_KINDS.map((k) => [k, byKind[k].length])),
    relationshipFactCount: relFacts.length,
    kinshipEdgeTarget,
    builtFactN: factN,
    firstCharacterId: byKind.character[0].id,
    midCharacterId: byKind.character[Math.floor(byKind.character.length / 2)].id,
    lastCharacterId: byKind.character[byKind.character.length - 1].id,
    lastLoreId: byKind.lore[byKind.lore.length - 1].id,
    targetNames: {
      first: byKind.character[0].name,
      mid: byKind.character[Math.floor(byKind.character.length / 2)].name,
      last: byKind.character[byKind.character.length - 1].name,
      lastLore: byKind.lore[byKind.lore.length - 1].name,
    },
  }
}

async function measurePrimaryPerJob(page) {
  return page.evaluate((visSrc) => {
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
      if (/^(Draft|Lab|Canon|Chat|Write|Check|Inbox|Research|Spark|Inspect|More)$/i.test(n)) return null
      if (/^Inbox\s*\d+$/i.test(n)) return null
      if (/hide binder|show binder|hide companion|show companion|focus|theme|project/i.test(n)) return null
      if (/^(new chapter|write first chapter|write)$/i.test(n)) return 'create-chapter'
      if (/^new sheet$/i.test(n)) return 'create-sheet'
      if (/^(open lab|start in lab)$/i.test(n)) return 'open-lab'
      return n.toLowerCase()
    }
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
    const controls = [...document.querySelectorAll('button, [role="button"], a.ui-button')]
    const solids = []
    for (const el of controls) {
      if (!isVisibleEl(el)) continue
      if (insideClosedDetails(el)) continue
      if (el.getAttribute('role') === 'tab') continue
      const cls = el.className?.toString?.() || ''
      const variant = el.getAttribute('data-variant') || ''
      const looksSolid =
        /ui-button--primary|btn--primary|variant-primary|button--primary/i.test(cls) ||
        /primary/i.test(variant) ||
        el.getAttribute('data-primary') === 'true'
      // Heuristic: filled primary class names used in shell.
      const isPrimary =
        looksSolid ||
        (el.tagName === 'BUTTON' &&
          !/ghost|secondary|danger|subtle|icon/i.test(cls + ' ' + variant) &&
          !el.classList.contains('icon-button') &&
          getComputedStyle(el).backgroundColor !== 'rgba(0, 0, 0, 0)' &&
          (() => {
            const bg = getComputedStyle(el).backgroundColor
            return bg && bg !== 'transparent' && bg !== 'rgba(0, 0, 0, 0)'
          })())
      // Prefer explicit primary class; fall back carefully.
      const primaryClass =
        /ui-button--primary|--primary|data-variant=["']primary/i.test(el.outerHTML) ||
        el.getAttribute('data-variant') === 'primary' ||
        [...el.classList].some((c) => /primary/.test(c))
      if (!primaryClass) continue
      const name = (el.getAttribute('aria-label') || el.textContent || '').replace(/\s+/g, ' ').trim()
      const job = jobKey(name, el)
      if (!job) continue
      solids.push({ name, job, region: regionOf(el), cls: [...el.classList].join(' ') })
    }
    const byJob = new Map()
    for (const s of solids) {
      if (!byJob.has(s.job)) byJob.set(s.job, [])
      byJob.get(s.job).push(s)
    }
    const jobs = [...byJob.entries()].map(([job, items]) => ({ job, count: items.length, items }))
    const offenders = jobs.filter((j) => j.count > 1)
    const graph = document.querySelector('[data-canon-empty], .graph, [aria-label="Relationship graph"]')
    return {
      solidCount: solids.length,
      solids,
      jobs,
      offenders,
      maxPerJob: jobs.reduce((m, j) => Math.max(m, j.count), 0),
      graphEmpty: graph?.getAttribute?.('data-canon-empty') || graph?.getAttribute?.('data-empty') || null,
      newSheetButtons: solids.filter((s) => /new sheet/i.test(s.name)),
      sendProposalButtons: solids.filter((s) => /send proposal/i.test(s.name)),
    }
  }, BROWSER_IS_VISIBLE_SOURCE)
}

async function measureGraph(page, view) {
  // Switch view if needed
  const group = page.getByRole('group', { name: 'Graph view' })
  if (await group.count()) {
    const btn = group.getByRole('button', { name: view === 'family' ? 'Family' : 'Network', exact: true })
    if (await btn.count()) {
      await btn.click({ force: true })
      await page.waitForTimeout(200)
    }
  }
  return page.evaluate((targetView) => {
    const root = document.querySelector('[aria-label="Relationship graph"], .graph')
    const canvas = root?.querySelector('svg.graph__canvas, svg[data-dense], .graph__canvas') || root?.querySelector('svg')
    const viewPressed = [...(root?.querySelectorAll('[aria-pressed="true"]') || [])].map((b) =>
      (b.textContent || '').trim(),
    )
    const filterBtns = [...(root?.querySelectorAll('.graph__filters button, [aria-label="Filter by sheet kind"] button') || [])]
    const filters = filterBtns.map((b) => ({
      text: (b.textContent || '').trim(),
      pressed: b.getAttribute('aria-pressed') === 'true',
      disabled: b.disabled,
    }))
    const nodes = canvas ? [...canvas.querySelectorAll('g.graph__node, .graph__node, [data-node-id], circle + text, g[tabindex]')] : []
    // Prefer node groups
    const nodeGroups = canvas
      ? [...canvas.querySelectorAll('g[data-id], g.graph__node, g[tabindex="0"]')].filter((g) => {
          const t = (g.textContent || '').trim()
          return t.length > 0 || g.querySelector('circle, rect')
        })
      : []
    const edges = canvas
      ? [...canvas.querySelectorAll('path.graph__edge, line.graph__edge, .graph__edge, path[aria-label], line[aria-label]')]
      : []
    const edgeLabels = canvas
      ? [...canvas.querySelectorAll('text')].filter((t) => {
          const p = t.closest('g')
          return p && (p.classList.contains('graph__edge') || t.closest('.graph__edges'))
        })
      : []
    const allTexts = canvas ? [...canvas.querySelectorAll('text')].map((t) => (t.textContent || '').trim()).filter(Boolean) : []
    const nodeLabels = []
    for (const g of nodeGroups) {
      const label = (g.getAttribute('aria-label') || g.textContent || '').replace(/\s+/g, ' ').trim()
      if (label) nodeLabels.push(label.slice(0, 80))
    }
    // Geometry collisions: node centers from transform/cx/cy
    const centers = []
    for (const g of nodeGroups) {
      const c = g.querySelector('circle')
      const r = g.querySelector('rect')
      let x = null
      let y = null
      if (c) {
        x = Number(c.getAttribute('cx'))
        y = Number(c.getAttribute('cy'))
      } else if (r) {
        x = Number(r.getAttribute('x')) + Number(r.getAttribute('width') || 0) / 2
        y = Number(r.getAttribute('y')) + Number(r.getAttribute('height') || 0) / 2
      }
      const tf = g.getAttribute('transform') || ''
      const m = /translate\(\s*([-\d.]+)[ ,]+([-\d.]+)/.exec(tf)
      if (m) {
        x = (x ?? 0) + Number(m[1])
        y = (y ?? 0) + Number(m[2])
      }
      if (Number.isFinite(x) && Number.isFinite(y)) centers.push({ x, y, label: (g.textContent || '').trim().slice(0, 40) })
    }
    let minPairDist = Infinity
    let closePairs = 0
    for (let i = 0; i < centers.length; i++) {
      for (let j = i + 1; j < centers.length; j++) {
        const dx = centers[i].x - centers[j].x
        const dy = centers[i].y - centers[j].y
        const d = Math.hypot(dx, dy)
        if (d < minPairDist) minPairDist = d
        if (d < 28) closePairs += 1
      }
    }
    const vb = canvas?.getAttribute('viewBox') || null
    const dense = root?.getAttribute('data-graph-dense') || canvas?.getAttribute('data-dense') || null
    const empty = root?.getAttribute('data-canon-empty') || null
    const box = root?.getBoundingClientRect()
    const canvasBox = canvas?.getBoundingClientRect()
    // Edge crossings approximation: sample path endpoints if lines
    const lineSegs = []
    for (const el of edges) {
      if (el.tagName === 'line') {
        lineSegs.push({
          x1: Number(el.getAttribute('x1')),
          y1: Number(el.getAttribute('y1')),
          x2: Number(el.getAttribute('x2')),
          y2: Number(el.getAttribute('y2')),
        })
      }
    }
    function orient(ax, ay, bx, by, cx, cy) {
      return Math.sign((by - ay) * (cx - ax) - (bx - ax) * (cy - ay))
    }
    function crosses(a, b) {
      const o1 = orient(a.x1, a.y1, a.x2, a.y2, b.x1, b.y1)
      const o2 = orient(a.x1, a.y1, a.x2, a.y2, b.x2, b.y2)
      const o3 = orient(b.x1, b.y1, b.x2, b.y2, a.x1, a.y1)
      const o4 = orient(b.x1, b.y1, b.x2, b.y2, a.x2, a.y2)
      return o1 !== o2 && o3 !== o4
    }
    let crossings = 0
    for (let i = 0; i < lineSegs.length; i++) {
      for (let j = i + 1; j < lineSegs.length; j++) {
        if (crosses(lineSegs[i], lineSegs[j])) crossings += 1
      }
    }
    // Family diagnostics if exposed
    const live = (root?.innerText || '').replace(/\s+/g, ' ').trim()
    return {
      targetView,
      viewPressed,
      dense,
      empty,
      filters,
      nodeGroupCount: nodeGroups.length,
      edgeCount: edges.length,
      edgeLabelCount: edgeLabels.length,
      textCount: allTexts.length,
      sampleNodeLabels: nodeLabels.slice(0, 12),
      sampleTexts: allTexts.slice(0, 20),
      centersCount: centers.length,
      minPairDist: Number.isFinite(minPairDist) ? Math.round(minPairDist * 10) / 10 : null,
      closePairsUnder28: closePairs,
      viewBox: vb,
      rootW: box ? Math.round(box.width) : null,
      rootH: box ? Math.round(box.height) : null,
      canvasW: canvasBox ? Math.round(canvasBox.width) : null,
      canvasH: canvasBox ? Math.round(canvasBox.height) : null,
      lineSegCount: lineSegs.length,
      lineCrossings: crossings,
      snippet: live.slice(0, 400),
      hasCanvas: Boolean(canvas),
    }
  }, view)
}

function binderRootSelector() {
  // Desktop rail or phone left drawer both host Binder.
  return [
    '.shell__rail--binder:not([hidden])',
    'aside.shell__rail--binder',
    '.ui-drawer[data-open="true"] .panel',
    '.ui-drawer.is-open .panel',
    '[role="dialog"][aria-label="Binder"]',
    '.ui-drawer .panel',
  ].join(', ')
}

async function forceBinderOpen(page) {
  await ensureBinderOpen(page)
  // Phone: Show binder opens a left Drawer, not a rail.
  const show = page.getByRole('button', { name: /Show binder/i }).first()
  if (await show.count()) {
    await show.click({ force: true }).catch(() => {})
    await page.waitForTimeout(200)
  }
  // Wait for either rail or drawer binder content.
  await page.waitForFunction(() => {
    const roots = [
      ...document.querySelectorAll('.shell__rail--binder, aside.shell__rail--binder, .ui-drawer .panel, [aria-label="Binder"]'),
    ]
    return roots.some((r) => {
      const t = (r.textContent || '')
      return /New sheet|Characters|Binder/i.test(t) && r.getClientRects().length > 0
    })
  }, { timeout: 5000 }).catch(() => {})
}

async function measureBinderList(page, seed) {
  return page.evaluate(
    ({ visSrc, targetNames }) => {
      const { isVisiblyPainted, isVisibleEl } = new Function(`${visSrc}; return { isVisiblyPainted, isVisibleEl }`)()
      const candidates = [
        ...document.querySelectorAll('.shell__rail--binder, aside.shell__rail--binder'),
        ...document.querySelectorAll('.ui-drawer .panel, [aria-label="Binder"], [role="dialog"]'),
      ]
      let binder = null
      for (const c of candidates) {
        const t = (c.textContent || '')
        if (!/New sheet|Characters|Lore|World|Organizations/i.test(t)) continue
        if (c.getClientRects().length === 0) continue
        binder = c
        break
      }
      if (!binder) binder = candidates[0] || null
      const body =
        binder?.querySelector('.binder__stack-body, [data-binder-stack-body], .shell__rail-body, .panel__body, .ui-drawer__body') ||
        binder
      const box = binder?.getBoundingClientRect()
      const bodyBox = body?.getBoundingClientRect()
      const kindHeads = [...(binder?.querySelectorAll('.binder__kind-head, .binder__canon-kind .panel__sublabel') || [])].map(
        (el) => (el.textContent || '').replace(/\s+/g, ' ').trim(),
      )
      const rows = [...(binder?.querySelectorAll('button.list-row, .list-row, [class*="ListRow"]') || [])]
      // Fallback: any button in canon kind sections
      const kindSections = [...(binder?.querySelectorAll('.binder__canon-kind') || [])]
      const sectionStats = kindSections.map((sec) => {
        const head = (sec.querySelector('.panel__sublabel, h4')?.textContent || '').trim()
        const countEl = sec.querySelector('.binder__count')
        const rowEls = [...sec.querySelectorAll('button, .list-row')]
        const visible = rowEls.filter((r) => isVisiblyPainted(r).visible)
        return {
          head,
          countText: (countEl?.textContent || '').trim(),
          rowDom: rowEls.length,
          rowVisible: visible.length,
          sample: visible.slice(0, 3).map((r) => (r.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40)),
        }
      })
      const allRows = kindSections.length
        ? kindSections.flatMap((sec) => [...sec.querySelectorAll('button, .list-row')])
        : rows
      const painted = allRows.filter((r) => isVisiblyPainted(r).visible)
      const names = allRows.map((r) => (r.textContent || '').replace(/\s+/g, ' ').trim())
      function findRow(name) {
        return allRows.find((r) => (r.textContent || '').includes(name)) || null
      }
      function rowMetrics(name) {
        const el = findRow(name)
        if (!el) return { found: false, name }
        const r = el.getBoundingClientRect()
        const inBody =
          bodyBox && r.bottom > bodyBox.top && r.top < bodyBox.bottom && r.right > bodyBox.left && r.left < bodyBox.right
        const fullyIn =
          bodyBox && r.top >= bodyBox.top - 1 && r.bottom <= bodyBox.bottom + 1
        return {
          found: true,
          name,
          visible: isVisiblyPainted(el).visible,
          top: Math.round(r.top),
          height: Math.round(r.height),
          inBodyViewport: Boolean(inBody),
          fullyInBody: Boolean(fullyIn),
          active: el.classList.contains('list-row--active') || el.getAttribute('aria-current') === 'true' || el.dataset.active === 'true',
        }
      }
      const scrollH = body?.scrollHeight ?? 0
      const clientH = body?.clientHeight ?? 0
      const scrollTop = body?.scrollTop ?? 0
      const canScroll = scrollH > clientH + 2
      const newSheet = [...(binder?.querySelectorAll('button') || [])].find((b) =>
        /^New sheet$/i.test((b.textContent || '').trim()),
      )
      const newSheetCls = newSheet ? [...newSheet.classList].join(' ') : null
      const newSheetPrimary = newSheet
        ? [...newSheet.classList].some((c) => /primary/.test(c)) || newSheet.getAttribute('data-variant') === 'primary'
        : null
      const newSheetGhost = newSheet
        ? [...newSheet.classList].some((c) => /ghost/.test(c)) || newSheet.getAttribute('data-variant') === 'ghost'
        : null
      return {
        binderW: box ? Math.round(box.width) : null,
        binderH: box ? Math.round(box.height) : null,
        bodyW: bodyBox ? Math.round(bodyBox.width) : null,
        bodyH: bodyBox ? Math.round(bodyBox.height) : null,
        scrollH,
        clientH,
        scrollTop,
        canScroll,
        kindHeads,
        sectionStats,
        rowDom: allRows.length,
        rowVisible: painted.length,
        sampleNames: names.slice(0, 8),
        lastNames: names.slice(-4),
        targets: {
          first: rowMetrics(targetNames.first),
          mid: rowMetrics(targetNames.mid),
          last: rowMetrics(targetNames.last),
          lastLore: rowMetrics(targetNames.lastLore),
        },
        newSheet: newSheet
          ? {
              text: (newSheet.textContent || '').trim(),
              cls: newSheetCls,
              primary: newSheetPrimary,
              ghost: newSheetGhost,
              visible: isVisibleEl(newSheet),
            }
          : null,
      }
    },
    { visSrc: BROWSER_IS_VISIBLE_SOURCE, targetNames: seed.targetNames },
  )
}

async function scrollBinderTo(page, ratio) {
  return page.evaluate((r) => {
    const candidates = [
      ...document.querySelectorAll('.shell__rail--binder, aside.shell__rail--binder'),
      ...document.querySelectorAll('.ui-drawer .panel, [aria-label="Binder"], [role="dialog"]'),
    ]
    let binder = null
    for (const c of candidates) {
      const t = (c.textContent || '')
      if (!/New sheet|Characters|Lore/i.test(t)) continue
      if (c.getClientRects().length === 0) continue
      binder = c
      break
    }
    const body =
      binder?.querySelector('.binder__stack-body, [data-binder-stack-body], .shell__rail-body, .panel__body, .ui-drawer__body') ||
      binder
    if (!body) return null
    const max = Math.max(0, body.scrollHeight - body.clientHeight)
    body.scrollTop = max * r
    return { scrollTop: body.scrollTop, max, scrollH: body.scrollHeight, clientH: body.clientHeight }
  }, ratio)
}

async function openSheetByName(page, name) {
  await forceBinderOpen(page)
  const scopes = [
    page.locator('.shell__rail--binder, aside.shell__rail--binder'),
    page.locator('.ui-drawer, [aria-label="Binder"], [role="dialog"]'),
  ]
  for (const binder of scopes) {
    if (!(await binder.count())) continue
    const row = binder.getByRole('button', { name: new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) }).first()
    const any = binder.locator('button', { hasText: name }).first()
    const target = (await row.count()) ? row : (await any.count()) ? any : null
    if (!target) continue
    await target.scrollIntoViewIfNeeded().catch(() => {})
    await target.click({ force: true })
    await page.waitForTimeout(250)
    return page.evaluate(() => {
      const editor = document.querySelector('.sheet-editor, [data-sheet-dirty]')
      const stack = document.querySelector('[data-binder-stack], .binder__stack')
      return {
        ok: Boolean(editor),
        dirty: editor?.getAttribute('data-sheet-dirty') || null,
        title: (
          editor?.querySelector('h1, h2, .sheet-editor__title, input')?.value ||
          editor?.querySelector('h1, h2, .sheet-editor__title')?.textContent ||
          ''
        )
          .toString()
          .trim()
          .slice(0, 80),
        stackText: (stack?.innerText || document.querySelector('.shell__rail--binder, .ui-drawer')?.innerText || '')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 120),
      }
    })
  }
  return { ok: false, reason: 'row not found' }
}

async function backFromSheet(page) {
  const back = page.getByRole('button', { name: /Back/i }).first()
  if (await back.count()) {
    await back.click({ force: true })
    await page.waitForTimeout(200)
    return true
  }
  // stack chrome
  const stackBack = page.locator('.shell__rail--binder button', { hasText: /Back/i }).first()
  if (await stackBack.count()) {
    await stackBack.click({ force: true })
    await page.waitForTimeout(200)
    return true
  }
  return false
}

async function measureFilters(page) {
  const root = page.locator('[aria-label="Relationship graph"], .graph')
  const filters = root.getByRole('group', { name: 'Filter by sheet kind' })
  const result = { kinds: [], before: null, afterCharacterOnly: null, afterAllOff: null, restore: null }
  result.before = await measureGraph(page, 'network')
  if (!(await filters.count())) {
    result.error = 'filter group missing'
    return result
  }
  const buttons = filters.getByRole('button')
  const count = await buttons.count()
  for (let i = 0; i < count; i++) {
    const b = buttons.nth(i)
    result.kinds.push({
      text: (await b.textContent() || '').trim(),
      pressed: (await b.getAttribute('aria-pressed')) === 'true',
    })
  }
  // Toggle all off except try character-only: click each pressed non-character
  for (let i = 0; i < count; i++) {
    const b = buttons.nth(i)
    const text = ((await b.textContent()) || '').trim()
    const pressed = (await b.getAttribute('aria-pressed')) === 'true'
    const isChar = /character/i.test(text)
    if (isChar && !pressed) await b.click({ force: true })
    if (!isChar && pressed) await b.click({ force: true })
  }
  await page.waitForTimeout(200)
  result.afterCharacterOnly = await measureGraph(page, 'network')
  // All off
  for (let i = 0; i < count; i++) {
    const b = buttons.nth(i)
    if ((await b.getAttribute('aria-pressed')) === 'true') await b.click({ force: true })
  }
  await page.waitForTimeout(200)
  result.afterAllOff = await measureGraph(page, 'network')
  // Restore all on
  for (let i = 0; i < count; i++) {
    const b = buttons.nth(i)
    if ((await b.getAttribute('aria-pressed')) !== 'true') await b.click({ force: true })
  }
  await page.waitForTimeout(200)
  result.restore = await measureGraph(page, 'network')
  return result
}

async function measureDirtyLeave(page, seed) {
  const out = { steps: [] }
  // Ensure on list
  await backFromSheet(page).catch(() => {})
  const opened = await openSheetByName(page, seed.targetNames.mid)
  out.steps.push({ step: 'open-mid', opened })
  if (!opened.ok) return out

  // Dirty the name field
  const nameInput = page.locator('.sheet-editor input').first()
  if (await nameInput.count()) {
    await nameInput.click({ force: true })
    await nameInput.fill(`${seed.targetNames.mid} DIRTY`)
    await page.waitForTimeout(100)
  } else {
    out.steps.push({ step: 'no-name-input' })
  }
  const dirtyState = await page.evaluate(() => {
    const editor = document.querySelector('.sheet-editor, [data-sheet-dirty]')
    return {
      dirty: editor?.getAttribute('data-sheet-dirty') || null,
      leaveOpen: Boolean(document.querySelector('.sheet-editor__leave-dialog, [role="dialog"][aria-modal="true"]')),
    }
  })
  out.steps.push({ step: 'after-edit', dirtyState })

  // Attempt Back → expect leave dialog
  const back = page.locator('.shell__rail--binder').getByRole('button', { name: /Back/i }).first()
  const backAlt = page.getByRole('button', { name: /Back to binder|Back/i }).first()
  if (await back.count()) await back.click({ force: true })
  else if (await backAlt.count()) await backAlt.click({ force: true })
  await page.waitForTimeout(200)

  const dialog = await page.evaluate(() => {
    const d = document.querySelector('.sheet-editor__leave-dialog, [role="dialog"][aria-modal="true"]')
    if (!d) return { open: false }
    const buttons = [...d.querySelectorAll('button')].map((b) => (b.textContent || '').trim())
    return {
      open: true,
      label: d.getAttribute('aria-label') || d.getAttribute('aria-labelledby') || null,
      title: (d.querySelector('h1, h2, #sheet-leave-title')?.textContent || '').trim(),
      buttons,
      text: (d.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 240),
    }
  })
  out.steps.push({ step: 'after-back', dialog })

  // Cancel keep editing
  if (dialog.open) {
    const cancel = page.getByRole('button', { name: /^Cancel$/i }).first()
    if (await cancel.count()) {
      await cancel.click({ force: true })
      await page.waitForTimeout(150)
    }
  }
  const stillDirty = await page.evaluate(() => ({
    dirty: document.querySelector('[data-sheet-dirty]')?.getAttribute('data-sheet-dirty') || null,
    editor: Boolean(document.querySelector('.sheet-editor')),
    leaveOpen: Boolean(document.querySelector('.sheet-editor__leave-dialog')),
  }))
  out.steps.push({ step: 'after-cancel', stillDirty })

  // Back again + Discard
  if (await back.count()) await back.click({ force: true })
  else if (await backAlt.count()) await backAlt.click({ force: true })
  await page.waitForTimeout(200)
  const discard = page.getByRole('button', { name: /^Discard$/i }).first()
  if (await discard.count()) {
    await discard.click({ force: true })
    await page.waitForTimeout(250)
  }
  const afterDiscard = await page.evaluate(() => ({
    editor: Boolean(document.querySelector('.sheet-editor')),
    leaveOpen: Boolean(document.querySelector('.sheet-editor__leave-dialog')),
    listScrollTop: (() => {
      const binder = document.querySelector('.shell__rail--binder, aside.shell__rail--binder')
      const body = binder?.querySelector('.binder__stack-body, .shell__rail-body, .panel__body') || binder
      return body?.scrollTop ?? null
    })(),
  }))
  out.steps.push({ step: 'after-discard', afterDiscard })

  // Scroll restore (honest sample):
  // Author path — place target row mid-fold by list scrollTop, then click WITHOUT
  // Playwright scrollIntoViewIfNeeded. F1 saves scroll at click; comparing against a
  // pre-scrollIntoView sample was a false red (2080→1147) on a correct product.
  const placed = await page.evaluate((name) => {
    const body =
      document.querySelector('.shell__rail--binder .panel__body.binder__stack') ||
      document.querySelector('.shell__rail--binder .binder__stack') ||
      document.querySelector('.binder__stack') ||
      document.querySelector('.ui-drawer .panel__body') ||
      null
    if (!body) return { ok: false, reason: 'binder list body not found' }
    const buttons = [...document.querySelectorAll('.binder__stack-list button, .shell__rail--binder button, .ui-drawer button')]
    const row = buttons.find((b) => (b.textContent || '').includes(name))
    if (!row) {
      return {
        ok: false,
        reason: 'row not found: ' + name,
        scrollH: body.scrollHeight,
        clientH: body.clientHeight,
      }
    }
    const bodyBox = body.getBoundingClientRect()
    const rowBox = row.getBoundingClientRect()
    // Place row ~35% down the scrollport (in fold) without relying on scrollIntoView.
    body.scrollTop += rowBox.top - bodyBox.top - bodyBox.height * 0.35
    const r = row.getBoundingClientRect()
    const b = body.getBoundingClientRect()
    const rowInView = r.top >= b.top - 1 && r.bottom <= b.bottom + 1
    return {
      ok: rowInView,
      reason: rowInView ? null : 'row not in fold after place',
      sampleWhen: 'after place-in-fold, immediately before click (no scrollIntoView)',
      preOpenScroll: body.scrollTop,
      scrollH: body.scrollHeight,
      clientH: body.clientHeight,
      bodyTag: body.className || body.tagName,
    }
  }, seed.targetNames.last)

  if (!placed?.ok) {
    out.scrollRestore = {
      measured: false,
      notMeasuredReason: placed?.reason || 'place-in-fold failed',
      sampleWhen: placed?.sampleWhen || 'n/a',
      preOpenScroll: placed?.preOpenScroll ?? null,
      restoredScrollTop: null,
      delta: null,
      ok: null,
      placed,
    }
    out.steps.push({ step: 'scroll-restore', scrollRestore: out.scrollRestore })
    return out
  }

  const preOpenScroll = placed.preOpenScroll
  // Click without scrollIntoView — row is already in fold.
  const deepClick = await page.evaluate((name) => {
    const body =
      document.querySelector('.shell__rail--binder .panel__body.binder__stack') ||
      document.querySelector('.shell__rail--binder .binder__stack') ||
      document.querySelector('.binder__stack')
    const beforeClick = body?.scrollTop ?? null
    const buttons = [...document.querySelectorAll('.binder__stack-list button, .shell__rail--binder button, .ui-drawer button')]
    const row = buttons.find((b) => (b.textContent || '').includes(name))
    if (!row) return { ok: false, reason: 'row missing at click' }
    row.click()
    return { ok: true, before: beforeClick, afterClickScroll: body?.scrollTop ?? null }
  }, seed.targetNames.last)
  await page.waitForTimeout(250)
  const deep = await page.evaluate(() => {
    const editor = document.querySelector('.sheet-editor, [data-sheet-dirty]')
    return {
      ok: Boolean(editor),
      dirty: editor?.getAttribute('data-sheet-dirty') || null,
      title: (
        editor?.querySelector('h1, h2, .sheet-editor__title, input')?.value ||
        editor?.querySelector('h1, h2, .sheet-editor__title')?.textContent ||
        ''
      )
        .toString()
        .trim()
        .slice(0, 80),
    }
  })
  out.steps.push({
    step: 'open-last',
    deep,
    deepClick,
    preOpenScroll,
    sampleWhen: placed.sampleWhen,
    placed,
  })
  if (!deep.ok) {
    out.scrollRestore = {
      measured: false,
      notMeasuredReason: 'detail did not open after in-fold click',
      sampleWhen: placed.sampleWhen,
      preOpenScroll,
      restoredScrollTop: null,
      delta: null,
      ok: null,
      deep,
      deepClick,
    }
    out.steps.push({ step: 'scroll-restore', scrollRestore: out.scrollRestore })
    return out
  }

  await backFromSheet(page)
  await page.waitForTimeout(200)
  const restored = await page.evaluate(() => {
    const body =
      document.querySelector('.shell__rail--binder .panel__body.binder__stack') ||
      document.querySelector('.shell__rail--binder .binder__stack') ||
      document.querySelector('.binder__stack') ||
      document.querySelector('.ui-drawer .panel__body') ||
      null
    return {
      scrollTop: body?.scrollTop ?? null,
      editor: Boolean(document.querySelector('.sheet-editor')),
      bodyTag: body?.className || body?.tagName || null,
    }
  })
  const measured = preOpenScroll != null && restored.scrollTop != null
  const delta = measured ? restored.scrollTop - preOpenScroll : null
  out.scrollRestore = {
    measured,
    notMeasuredReason: measured ? null : 'preOpen or restored scrollTop is null',
    sampleWhen: placed.sampleWhen,
    preOpenScroll,
    restoredScrollTop: restored.scrollTop,
    delta,
    // null ok = NOT-MEASURED (do not treat as product fail)
    ok: measured ? Math.abs(delta) <= 4 : null,
    restored,
    deepClick,
  }
  out.steps.push({ step: 'scroll-restore', restored, scrollRestore: out.scrollRestore })
  return out
}

function severity(title, detail, level) {
  return { severity: level, title, detail }
}

function judge(ctx) {
  const worst = []
  // Item 4 first (regression risk)
  for (const vp of ['1440', '390']) {
    const p = ctx.viewports?.[vp]
    if (!p) continue
    if (p.primary) {
      if (p.primary.maxPerJob > 1) {
        worst.push(severity(`B6 primary >1 @${vp}`, `maxPerJob=${p.primary.maxPerJob} offenders=${JSON.stringify(p.primary.offenders)}`, 'HIGH'))
      }
      const ns = p.primary.newSheetButtons || []
      const solidNew = ns.filter((b) => /primary/i.test(b.cls || ''))
      // When full, binder New sheet should be primary (navigator), not ghost
      if (p.binder?.newSheet?.ghost && !p.binder?.newSheet?.primary) {
        worst.push(severity(`New sheet still ghost when Canon FULL @${vp}`, JSON.stringify(p.binder.newSheet), 'HIGH'))
      }
      if ((p.primary.sendProposalButtons || []).length) {
        worst.push(severity(`Send proposal solid on full Canon @${vp}`, JSON.stringify(p.primary.sendProposalButtons), 'MED'))
      }
    }
    if (p.dirtyLeave) {
      const dlg = p.dirtyLeave.steps?.find((s) => s.step === 'after-back')?.dialog
      if (!dlg?.open) {
        worst.push(severity(`Dirty-leave dialog missing @${vp}`, JSON.stringify(p.dirtyLeave.steps?.slice(-4)), 'HIGH'))
      }
      if (p.dirtyLeave.scrollRestore) {
        const sr = p.dirtyLeave.scrollRestore
        if (sr.measured === false || sr.ok == null) {
          // Null sample is NOT-MEASURED, not a product failure (fail-on-absence inverted).
          worst.push(severity(`Binder scroll restore NOT-MEASURED @${vp}`, JSON.stringify(sr), 'INFO'))
        } else if (sr.ok === false) {
          worst.push(severity(`Binder scroll restore fail @${vp}`, JSON.stringify(sr), 'HIGH'))
        }
      }
    }
    // Graph
    if (p.network) {
      if (!p.network.hasCanvas) worst.push(severity(`Network canvas missing @${vp}`, JSON.stringify(p.network), 'HIGH'))
      if (p.network.nodeGroupCount < 20) {
        worst.push(severity(`Network under-rendered nodes @${vp}`, `nodes=${p.network.nodeGroupCount} edges=${p.network.edgeCount}`, 'MED'))
      }
      if (p.network.closePairsUnder28 > 15) {
        worst.push(severity(`Network hairball: many overlapping nodes @${vp}`, `closePairs=${p.network.closePairsUnder28} minDist=${p.network.minPairDist}`, 'HIGH'))
      }
      if (p.network.lineCrossings > 40) {
        worst.push(severity(`Network edge crossings high @${vp}`, `crossings=${p.network.lineCrossings}`, 'MED'))
      }
    }
    if (p.family) {
      if (!p.family.hasCanvas) worst.push(severity(`Family canvas missing @${vp}`, JSON.stringify(p.family), 'HIGH'))
      if (p.family.nodeGroupCount < 5) {
        worst.push(severity(`Family sparse under load @${vp}`, `nodes=${p.family.nodeGroupCount} edges=${p.family.edgeCount} texts=${p.family.sampleTexts?.slice(0, 8)}`, 'HIGH'))
      }
      if (p.family.closePairsUnder28 > 10) {
        worst.push(severity(`Family overlap under load @${vp}`, `closePairs=${p.family.closePairsUnder28} minDist=${p.family.minPairDist}`, 'MED'))
      }
    }
    if (p.binder) {
      if (!p.binder.canScroll && p.binder.rowDom >= 40) {
        worst.push(severity(`Binder list not scrollable at volume @${vp}`, `rowDom=${p.binder.rowDom} scrollH=${p.binder.scrollH} clientH=${p.binder.clientH}`, 'HIGH'))
      }
      if (p.binder.binderW && p.binder.binderW < 200) {
        worst.push(severity(`Binder narrow @${vp}`, `binderW=${p.binder.binderW}`, 'MED'))
      }
      const t = p.binder.targets || {}
      if (t.last && t.last.found && !t.last.inBodyViewport && !p.binder.canScroll) {
        worst.push(severity(`Last sheet unreachable @${vp}`, JSON.stringify(t.last), 'HIGH'))
      }
    }
    if (p.filters) {
      const charOnly = p.filters.afterCharacterOnly
      if (charOnly && charOnly.nodeGroupCount >= (p.network?.nodeGroupCount || 99)) {
        worst.push(severity(`Kind filter ineffective @${vp}`, `all=${p.network?.nodeGroupCount} charOnly=${charOnly.nodeGroupCount}`, 'MED'))
      }
    }
  }
  if (!worst.length) worst.push(severity('Nothing pathological found', 'All measured surfaces stayed within probe thresholds at 60+ sheets.', 'INFO'))
  const order = { HIGH: 0, MED: 1, LOW: 2, INFO: 3 }
  return worst.sort((a, b) => order[a.severity] - order[b.severity])
}

function buildReport(ctx) {
  const lines = []
  lines.push('# TASK AZ — Canon under load')
  lines.push('')
  lines.push('**Mode:** read-only probe. No product changes.')
  lines.push(`**HEAD:** \`${ctx.head}\``)
  lines.push(`**Owned stack:** api \`${ctx.api}\` ui \`${ctx.ui}\` shell.css \`${ctx.shellHash}\``)
  lines.push(`**Seed:** sheets=${ctx.seed.sheetCount} byKind=${JSON.stringify(ctx.seed.byKindCounts)} relationshipFacts=${ctx.seed.relationshipFactCount}`)
  lines.push('')
  lines.push('## Non-claims')
  lines.push('- Synthetic PUT seed (not a real novel import / Continuity extract).')
  lines.push('- Domain sheet kinds are **4** (character/lore/world/organization), not 7.')
  lines.push('- Graph legibility uses geometry proxies (min node distance, close pairs, line crossings) — not author eye tests.')
  lines.push('- Did not measure multi-author concurrent edit, offline, or 500+ sheet projects.')
  lines.push('- Did not build search. Only reports whether filter-at-scale feels insufficient.')
  lines.push('- B3-inbox-wall@volume honest red is **out of scope** (dolphin).')
  lines.push('- Phone binder may start as drawer; probe forces open when possible.')
  lines.push('- Scroll-restore samples preOpenScroll AFTER place-in-fold and BEFORE click (no Playwright scrollIntoView). Null sample = NOT-MEASURED, not HIGH.')
  lines.push('')
  lines.push('## Worst first')
  for (const w of ctx.worst) lines.push(`- **[${w.severity}] ${w.title}** — ${w.detail}`)
  lines.push('')
  for (const vp of ['1440', '390']) {
    const p = ctx.viewports[vp]
    if (!p) continue
    lines.push(`## Viewport ${vp}`)
    lines.push('')
    lines.push('### Binder')
    lines.push('```json')
    lines.push(JSON.stringify(p.binder, null, 2))
    lines.push('```')
    lines.push('')
    lines.push('### Network')
    lines.push('```json')
    lines.push(JSON.stringify(p.network, null, 2))
    lines.push('```')
    lines.push('')
    lines.push('### Family')
    lines.push('```json')
    lines.push(JSON.stringify(p.family, null, 2))
    lines.push('```')
    lines.push('')
    lines.push('### Kind filters')
    lines.push('```json')
    lines.push(JSON.stringify(p.filters, null, 2))
    lines.push('```')
    lines.push('')
    lines.push('### Primary / empty-demote / B6')
    lines.push('```json')
    lines.push(JSON.stringify(p.primary, null, 2))
    lines.push('```')
    lines.push('')
    lines.push('### Dirty-leave + scroll restore')
    lines.push('```json')
    lines.push(JSON.stringify(p.dirtyLeave, null, 2))
    lines.push('```')
    lines.push('')
  }
  lines.push('## Method')
  lines.push('1. `ownMeasurementStack` provenance.')
  lines.push('2. Private project via `ensureIsolatedProject` + PUT 60+ sheets with kinship + network edges.')
  lines.push('3. Canon workspace @1440 and @390; binder forced open.')
  lines.push('4. Measure Network, Family, filters, binder list, B6 primaries, dirty-leave dialog, scroll restore.')
  lines.push('')
  return lines.join('\n')
}

async function runViewport(browser, vp, seed, projectId) {
  const page = await browser.newPage({ viewport: { width: vp, height: vp === 390 ? 844 : 900 } })
  page.setDefaultTimeout(15000)
  const out = { vp }
  try {
    await page.goto(process.env.STORYLINT_UI_ORIGIN, { waitUntil: 'networkidle' })
    await reclaimIsolatedProject(projectId)
    await ensureCompanionOpen(page).catch(() => {})
    await gotoWorkspace(page, 'canon', { ensureCompanion: true })
    await forceBinderOpen(page)
    await page.waitForTimeout(300)

    // Binder first (list)
    out.binder = await measureBinderList(page, seed)
    out.binderOpenProof = await page.evaluate(() => {
      const drawers = [...document.querySelectorAll('.ui-drawer, [role="dialog"]')].map((d) => ({
        label: d.getAttribute('aria-label') || d.getAttribute('data-side') || null,
        open: d.getAttribute('data-open') || d.className,
        text: (d.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80),
        w: Math.round(d.getBoundingClientRect().width),
      }))
      const rails = [...document.querySelectorAll('.shell__rail--binder')].map((r) => ({
        w: Math.round(r.getBoundingClientRect().width),
        text: (r.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 60),
      }))
      return { drawers, rails, bodyBinder: document.querySelector('.shell__body')?.getAttribute('data-binder') }
    })
    // Scroll probe: jump mid + end
    out.binderScrollMid = await scrollBinderTo(page, 0.5)
    out.binderAfterMid = await measureBinderList(page, seed)
    out.binderScrollEnd = await scrollBinderTo(page, 1)
    out.binderAfterEnd = await measureBinderList(page, seed)
    await scrollBinderTo(page, 0)

    // Graph views
    out.network = await measureGraph(page, 'network')
    out.family = await measureGraph(page, 'family')
    // back to network for filters
    out.filters = await measureFilters(page)

    // Primary jobs on full Canon
    out.primary = await measurePrimaryPerJob(page)

    // Dirty leave + scroll restore (item 4)
    out.dirtyLeave = await measureDirtyLeave(page, seed)

    // Re-check binder new-sheet after interactions
    out.binderFinal = await measureBinderList(page, seed)
  } finally {
    await page.close().catch(() => {})
  }
  return out
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true })
  const stack = await ownMeasurementStack({ root: ROOT })
  const apiOrigin = stack.api || stack.apiOrigin
  const uiOrigin = (stack.ui || stack.uiOrigin || '').replace(/\/$/, '')
  const stop = stack.stop
  const head = stack.shortHead || stack.head
  const shellHash = stack.shellCss?.sha256_12 || stack.provenance?.shellCss?.sha256_12 || null
  process.env.STORYLINT_API_ORIGIN = apiOrigin
  process.env.STORYLINT_UI_ORIGIN = uiOrigin
  setApiBase(apiOrigin)
  console.log(`[az] owned head=${head} ui=${uiOrigin} api=${apiOrigin} shell=${shellHash}`)

  const browser = await chromium.launch({ channel: 'msedge', headless: true })
  const ctx = {
    head,
    api: apiOrigin,
    ui: uiOrigin,
    shellHash,
    seed: null,
    viewports: {},
    worst: [],
  }
  try {
    const page = await browser.newPage()
    const projectId = await ensureIsolatedProject(page, {
      id: `e2e-az-canon-${process.pid}-${Date.now().toString(36)}`,
      title: 'E2E AZ Canon Load',
    })
    await page.close()
    ctx.seed = await seedCanonLoad(projectId)
    console.log('[az] seeded', {
      sheets: ctx.seed.sheetCount,
      rel: ctx.seed.relationshipFactCount,
      byKind: ctx.seed.byKindCounts,
    })
    if (ctx.seed.sheetCount < 60) {
      throw new Error(`seed sheetCount ${ctx.seed.sheetCount} < 60`)
    }

    for (const vp of [1440, 390]) {
      console.log(`[az] viewport ${vp}`)
      ctx.viewports[String(vp)] = await runViewport(browser, vp, ctx.seed, projectId)
    }

    ctx.worst = judge(ctx)
    const report = buildReport(ctx)
    writeFileSync(OUT, report)
    writeFileSync(join(OUT_DIR, 'canon-under-load-az.json'), JSON.stringify(ctx, null, 2))
    console.log('\n======== WORST FIRST ========')
    for (const w of ctx.worst) console.log(`[${w.severity}] ${w.title}: ${w.detail}`)
    console.log('=============================\n')
    console.log(report)
    console.log(`\n[az] wrote ${OUT}`)
  } finally {
    await browser.close().catch(() => {})
    await stop().catch(() => {})
  }
}

main().catch((err) => {
  console.error('[az] FAIL', err)
  process.exitCode = 1
})
