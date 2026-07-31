/**
 * UX phase 2 — Relationship graph (Network + Family + kind filters).
 * Empty vs seeded full bible. Checkpoints disk so agents can resume after 500k death.
 *
 *   node e2e/ux-drive-graph.mjs
 *
 * Requires API :4174 + UI :5173. Writes e2e/output/ux-graph-*.png + ux-progress*.
 */
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs'
import { openProposeEditor } from './constants.mjs'

const require = createRequire('D:/npm-global/node_modules/playwright/package.json')
const pwRoot = dirname(require.resolve('playwright/package.json'))
const { chromium } = await import(pathToFileURL(resolve(pwRoot, 'index.mjs')).href)
mkdirSync('e2e/output', { recursive: true })

const API = 'http://127.0.0.1:4174'
const UI = 'http://localhost:5173/'
/** Visible chip labels for sheet kinds (SHEET_KIND_LABEL); the map no longer renders raw enums. */
const KIND_LABEL = { character: 'Characters', lore: 'Lore', world: 'World', organization: 'Organizations' }
const KINDS = ['character', 'lore', 'world', 'organization']
const stamp = Date.now()
const tag = stamp.toString(36).slice(-4)
const ids = {
  parent: `uxg-parent-${stamp}`,
  child: `uxg-child-${stamp}`,
  spouse: `uxg-spouse-${stamp}`,
  lore: `uxg-lore-${stamp}`,
  world: `uxg-world-${stamp}`,
  org: `uxg-org-${stamp}`,
}
const names = {
  parent: `Mira Parent-${tag}`,
  child: `Kael-${tag}`,
  spouse: `Sera Spouse-${tag}`,
  lore: `River Oath-${tag}`,
  world: `Ember Coast-${tag}`,
  org: `Lantern Order-${tag}`,
}

const notes = []
const shots = []
const startedAt = new Date().toISOString()
const results = {
  phase: 'graph',
  jobs: {
    emptyNetwork: false,
    emptyFamily: false,
    seededNetwork: false,
    seededFamily: false,
    kindFilters: {},
    pendingHidden: false,
    acceptShowsEdge: false,
    nodeOpensSheet: false,
  },
  blockers: [],
  shouldFix: [],
  nits: [],
}

function mergeShellProgress() {
  const path = 'e2e/output/ux-progress.json'
  if (!existsSync(path)) return null
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return null
  }
}

function checkpoint(phase, extra = {}) {
  const prior = mergeShellProgress()
  const payload = {
    startedAt: prior?.startedAt ?? startedAt,
    graphStartedAt: startedAt,
    updatedAt: new Date().toISOString(),
    phase: `graph:${phase}`,
    done: false,
    shellDone: prior?.done === true || prior?.phase === 'done',
    shotCount: shots.length,
    shots: shots.slice(-16),
    lastNotes: notes.slice(-24),
    results: {
      shell: prior?.results ?? null,
      graph: results,
    },
    ...extra,
  }
  writeFileSync('e2e/output/ux-progress.json', JSON.stringify(payload, null, 2))
  writeFileSync(
    'e2e/output/ux-graph-progress.md',
    [
      `# UX graph phase progress`,
      ``,
      `- **phase:** graph:${phase}`,
      `- **updated:** ${payload.updatedAt}`,
      `- **shell done earlier:** ${payload.shellDone}`,
      `- **shots this phase:** ${shots.length}`,
      ``,
      `## Jobs`,
      '```json',
      JSON.stringify(results.jobs, null, 2),
      '```',
      ``,
      `## Blockers`,
      ...(results.blockers.length ? results.blockers.map((b) => `- ${b}`) : ['- (none yet)']),
      ``,
      `## Should-fix`,
      ...(results.shouldFix.length ? results.shouldFix.map((b) => `- ${b}`) : ['- (none yet)']),
      ``,
      `## Latest notes`,
      ...notes.slice(-20).map((n) => `- ${n}`),
      ``,
      `Resume: Read this file. Do not re-run shell drive. Finish ux-report.md graph section.`,
    ].join('\n'),
  )
  // Keep combined progress.md current for resume agents
  writeFileSync(
    'e2e/output/ux-progress.md',
    [
      `# UX drive progress`,
      ``,
      `- **phase:** graph:${phase}`,
      `- **updated:** ${payload.updatedAt}`,
      `- **done:** false`,
      `- **graph shots:** ${shots.length}`,
      ``,
      `## Graph jobs`,
      '```json',
      JSON.stringify(results.jobs, null, 2),
      '```',
      ``,
      `## Graph blockers`,
      ...(results.blockers.length ? results.blockers.map((b) => `- ${b}`) : ['- (none yet)']),
      ``,
      `Detail: e2e/output/ux-graph-progress.md`,
    ].join('\n'),
  )
}

const log = (s) => {
  notes.push(s)
  console.log(s)
}
const ok = (s) => log('OK: ' + s)
const warn = (s) => log('WARN: ' + s)
const fail = (s) => log('FAIL: ' + s)

async function shot(page, name) {
  const path = `e2e/output/ux-graph-${name}.png`
  await page.screenshot({ path, fullPage: false })
  shots.push(path)
  log('SHOT: ' + path)
  checkpoint(`shot:${name}`)
  return path
}

async function putSheet(request, sheet) {
  const response = await request.put(`${API}/api/sheets/${sheet.id}`, {
    data: sheet,
    headers: { 'content-type': 'application/json' },
  })
  if (!response.ok()) throw new Error(`seed sheet ${sheet.id} → ${response.status()}`)
}

async function seedFullBible(request) {
  const sheets = [
    {
      id: ids.parent,
      kind: 'character',
      name: names.parent,
      aliases: [],
      summary: 'Parent',
      notes: '',
      portrait: 'P',
      facts: [],
    },
    {
      id: ids.child,
      kind: 'character',
      name: names.child,
      aliases: [],
      summary: 'Child',
      notes: '',
      portrait: 'C',
      facts: [],
    },
    {
      id: ids.spouse,
      kind: 'character',
      name: names.spouse,
      aliases: [],
      summary: 'Spouse',
      notes: '',
      portrait: 'S',
      facts: [],
    },
    {
      id: ids.lore,
      kind: 'lore',
      name: names.lore,
      aliases: [],
      summary: 'A myth',
      notes: '',
      portrait: 'L',
      facts: [],
    },
    {
      id: ids.world,
      kind: 'world',
      name: names.world,
      aliases: [],
      summary: 'A place',
      notes: '',
      portrait: 'W',
      facts: [],
    },
    {
      id: ids.org,
      kind: 'organization',
      name: names.org,
      aliases: [],
      summary: 'An order',
      notes: '',
      portrait: 'O',
      facts: [],
    },
  ]
  for (const sheet of sheets) await putSheet(request, sheet)
  ok('seeded 6 sheets (3 character + lore + world + org)')
}

async function openGraph(page) {
  // Shell exposes Graph and Draft as distinct buttons (S1). Prefer Canon map.
  const graphMain = page.getByRole('main', { name: 'Relationship graph' })
  if (await graphMain.count()) {
    await graphMain.waitFor({ timeout: 5000 })
    return graphMain
  }
  await page.getByRole('button', { name: 'Canon', exact: true }).click()
  await graphMain.waitFor({ timeout: 10000 })
  return graphMain
}

async function ensureKindOn(graph, kind) {
  const btn = graph.getByRole('button', { name: KIND_LABEL[kind] ?? kind, exact: true })
  const pressed = await btn.getAttribute('aria-pressed')
  if (pressed !== 'true') await btn.click()
}

async function ensureKindOff(graph, kind) {
  const btn = graph.getByRole('button', { name: KIND_LABEL[kind] ?? kind, exact: true })
  const pressed = await btn.getAttribute('aria-pressed')
  if (pressed === 'true') await btn.click()
}

const browser = await chromium.launch({ channel: 'msedge', headless: true })
checkpoint('start')

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  page.setDefaultTimeout(15000)

  // —— A. EMPTY-ish: open graph before our seed (may have prior smoke data; still exercise empty filters)
  await page.goto(UI, { waitUntil: 'networkidle' })
  let graph = await openGraph(page)
  checkpoint('opened-preseed')

  await graph.getByRole('button', { name: 'Network', exact: true }).click()
  // Turn all kinds off → empty network
  for (const kind of KINDS) await ensureKindOff(graph, kind)
  await page.waitForTimeout(200)
  const emptyNet = await graph.locator('.graph__empty, .empty-state, [class*="Empty"]').count()
    || await page.getByText(/No visible sheets/i).count()
  const nodesAllOff = await graph.locator('.graph__node').count()
  if (nodesAllOff === 0 || emptyNet > 0) {
    results.jobs.emptyNetwork = true
    ok('empty network (all kinds off or empty state)')
  } else {
    results.shouldFix.push('Network with all kind filters off still shows nodes — empty state unclear')
    warn('empty network not clear; nodes=' + nodesAllOff)
  }
  await shot(page, '01-network-all-kinds-off')

  await graph.getByRole('button', { name: 'Family', exact: true }).click()
  await page.waitForTimeout(200)
  const emptyFam =
    (await page.getByText(/No family tree yet/i).count()) > 0 ||
    (await graph.locator('.graph__node--family').count()) === 0
  if (emptyFam) {
    results.jobs.emptyFamily = true
    ok('family empty or no family nodes with kinds off')
  } else {
    results.shouldFix.push('Family view with no kinship / kinds off still crowded')
    warn('family not empty-looking')
  }
  await shot(page, '02-family-empty-or-sparse')
  checkpoint('empty-done')

  // —— B. SEED full multi-kind bible
  await seedFullBible(page.request)
  await page.reload({ waitUntil: 'networkidle' })
  graph = await openGraph(page)
  checkpoint('seeded-reloaded')

  // Re-enable all kinds
  for (const kind of KINDS) await ensureKindOn(graph, kind)
  await graph.getByRole('button', { name: 'Network', exact: true }).click()
  await page.waitForTimeout(300)
  const nodeCount = await graph.locator('.graph__node').count()
  log('network nodes after seed=' + nodeCount)
  if (nodeCount >= 6) {
    results.jobs.seededNetwork = true
    ok('seeded network shows ≥6 nodes')
  } else if (nodeCount >= 2) {
    results.jobs.seededNetwork = true
    results.shouldFix.push(`Network shows ${nodeCount} nodes after seeding 6 — filters or projection may hide kinds`)
    warn('fewer nodes than seeded sheets')
  } else {
    results.blockers.push('Seeded bible does not appear as network nodes')
    fail('seeded network empty')
  }
  await shot(page, '03-network-full-all-kinds')

  // Kind filters one-by-one (solo each kind)
  for (const kind of KINDS) {
    for (const other of KINDS) {
      if (other === kind) await ensureKindOn(graph, other)
      else await ensureKindOff(graph, other)
    }
    await page.waitForTimeout(200)
    const n = await graph.locator('.graph__node').count()
    const empty = (await page.getByText(/No visible sheets/i).count()) > 0
    results.jobs.kindFilters[kind] = { nodes: n, empty }
    log(`filter solo ${kind}: nodes=${n} empty=${empty}`)
    if (kind === 'character' && n < 1) {
      results.blockers.push('character-only filter shows no nodes after seeding characters')
    }
    if (n === 0 && !empty) {
      results.shouldFix.push(`Kind filter ${kind}: zero nodes but no empty state`)
    }
    await shot(page, `04-filter-${kind}-only`)
    checkpoint(`filter:${kind}`)
  }

  // All kinds back on
  for (const kind of KINDS) await ensureKindOn(graph, kind)
  await shot(page, '05-network-all-on-again')

  // —— C. Propose edge (pending must not draw), Accept, then Family
  // D4: Propose is a collapsed disclosure at every width; summon it before filling fields.
  const editor = await openProposeEditor(graph)
  const selects = editor.locator('select')
  if ((await selects.count()) >= 2) {
    await selects.nth(0).selectOption(ids.parent)
    await selects.nth(1).selectOption(ids.child)
    const key = `parent_of`
    const statement = `${names.parent} is parent of ${names.child}`
    await graph.getByPlaceholder('father_of, member_of, rival…').fill(key)
    await graph.getByPlaceholder('Aria is a member of the Ember Order').fill(statement)
    const edgesBefore = await graph.locator('.graph__edge').count()
    await graph.getByRole('button', { name: 'Send proposal' }).click()
    await graph.getByText(/proposal is pending/i).waitFor({ timeout: 8000 }).catch(() => null)
    const edgesPending = await graph.locator('.graph__edge').count()
    if (edgesPending === edgesBefore) {
      results.jobs.pendingHidden = true
      ok('pending edge not drawn as canon')
    } else {
      results.blockers.push('Pending relationship rendered as graph edge before Accept')
      fail('pending edge visible')
    }
    await shot(page, '06-pending-before-accept')

    // Accept from agent panel proposal card
    const card = page.locator('.proposal-card').filter({ hasText: statement })
    if (await card.count()) {
      await card.getByRole('button', { name: 'Accept' }).click()
      await page.waitForTimeout(500)
      const edgesAfter = await graph.locator('.graph__edge').count()
      const label = await graph.getByText(key).count()
      if (edgesAfter > edgesBefore || label > 0) {
        results.jobs.acceptShowsEdge = true
        ok('Accept shows kinship edge/label')
      } else {
        results.shouldFix.push('After Accept, parent_of edge/label not obvious on network')
        warn('accept edge unclear')
      }
      await shot(page, '07-after-accept-network')
    } else {
      results.shouldFix.push('Proposal card not found in agent panel after Send proposal — Accept path opaque')
      warn('no proposal card for accept')
      await shot(page, '07-no-proposal-card')
    }
  } else {
    results.blockers.push('Graph editor missing from/to selects — cannot propose relationships')
    fail('no graph editor selects')
  }
  checkpoint('propose-accept')

  // Also link org membership for multi-kind density
  await openProposeEditor(graph)
  if ((await selects.count()) >= 2) {
    await selects.nth(0).selectOption(ids.parent)
    await selects.nth(1).selectOption(ids.org)
    await graph.getByPlaceholder('father_of, member_of, rival…').fill('member_of')
    await graph.getByPlaceholder('Aria is a member of the Ember Order').fill(`${names.parent} is a member of ${names.org}`)
    await graph.getByRole('button', { name: 'Send proposal' }).click()
    await page.waitForTimeout(400)
    const memberCard = page.locator('.proposal-card').filter({ hasText: names.org })
    if (await memberCard.count()) {
      await memberCard.getByRole('button', { name: 'Accept' }).first().click()
      await page.waitForTimeout(400)
    }
    await shot(page, '08-network-with-org-edge')
  }

  // Family view with kinship
  await graph.getByRole('button', { name: 'Family', exact: true }).click()
  await page.waitForTimeout(300)
  const familyStage = graph.locator('.graph__family-stage')
  const familyNodes = graph.locator('.graph__node--family')
  const famCount = await familyNodes.count()
  log('family nodes=' + famCount)
  if ((await familyStage.count()) > 0 || famCount >= 2) {
    results.jobs.seededFamily = true
    ok('family view shows stage/nodes after kinship Accept')
  } else if ((await page.getByText(/No family tree yet/i).count()) > 0) {
    results.shouldFix.push('Family empty after accepting parent_of — kinship projection or filter')
    warn('family still empty after parent_of')
  } else {
    results.shouldFix.push('Family view unclear after seeding kinship')
  }
  await shot(page, '09-family-with-kinship')

  // Node → sheet
  if (famCount > 0) {
    await familyNodes.first().click()
    const nameField = page.getByLabel('Name')
    try {
      await nameField.waitFor({ timeout: 5000 })
      results.jobs.nodeOpensSheet = true
      ok('family node opens sheet')
      await shot(page, '10-node-opened-sheet')
      await page.getByRole('button', { name: 'Back to binder' }).click().catch(() => {})
    } catch {
      results.shouldFix.push('Clicking family node did not open sheet editor')
      warn('node open sheet failed')
      await shot(page, '10-node-no-sheet')
    }
  } else {
    // try network node
    await graph.getByRole('button', { name: 'Network', exact: true }).click()
    const netNode = graph.locator('.graph__node').first()
    if (await netNode.count()) {
      await netNode.click()
      try {
        await page.getByLabel('Name').waitFor({ timeout: 5000 })
        results.jobs.nodeOpensSheet = true
        ok('network node opens sheet')
        await shot(page, '10-network-node-sheet')
        await page.getByRole('button', { name: 'Back to binder' }).click().catch(() => {})
      } catch {
        results.shouldFix.push('Network node click does not open sheet')
        await shot(page, '10-network-node-no-sheet')
      }
    }
  }

  // Back to network final
  graph = await openGraph(page)
  await graph.getByRole('button', { name: 'Network', exact: true }).click()
  for (const kind of KINDS) await ensureKindOn(graph, kind)
  await shot(page, '11-network-final')

  // Narrow family
  await page.setViewportSize({ width: 1024, height: 900 })
  await graph.getByRole('button', { name: 'Family', exact: true }).click()
  await page.waitForTimeout(250)
  await shot(page, '12-family-1024')
  await page.setViewportSize({ width: 390, height: 844 })
  await page.waitForTimeout(250)
  // Phone gate is max-width 640. .graph is overflow:auto — expand it so evidence shows tree + member list + collapsed Propose in one frame.
  const phonePath = 'e2e/output/ux-graph-13-family-phone.png'
  const graphMain = page.getByRole('main', { name: 'Relationship graph' })
  const disclosure = graphMain.locator('details.graph__editor--disclosure')
  await disclosure.waitFor({ timeout: 5000 })
  await page.evaluate(() => {
    const main = document.querySelector('main[aria-label="Relationship graph"]')
    if (!main) throw new Error('graph main missing')
    const d = main.querySelector('details.graph__editor--disclosure')
    if (d) d.open = false
    // Unlock nested scrollers so a single element shot includes full phone family chrome.
    const unlock = (el) => {
      if (!(el instanceof HTMLElement)) return
      el.style.overflow = 'visible'
      el.style.maxHeight = 'none'
      el.style.height = 'auto'
    }
    unlock(main)
    main.querySelectorAll('.graph__stage, .graph__canvas, .graph__family, .graph__family-list').forEach(unlock)
    // Also relax shell ancestors that clip on phone.
    let p = main.parentElement
    while (p && p !== document.body) {
      unlock(p)
      p = p.parentElement
    }
    document.documentElement.style.overflow = 'visible'
    document.body.style.overflow = 'visible'
    window.scrollTo(0, 0)
  })
  await page.waitForTimeout(200)
  // Element screenshot of expanded graph main (includes disclosure + list).
  await graphMain.screenshot({ path: phonePath })
  shots.push(phonePath)
  log('SHOT: ' + phonePath)
  checkpoint('shot:13-family-phone')

  await page.close()
  checkpoint('complete')
} catch (e) {
  fail('graph driver crash: ' + ((e && e.stack) || e))
  results.blockers.push('Graph UX driver crashed: ' + ((e && e.message) || e))
  checkpoint('crashed', { error: String((e && e.message) || e) })
} finally {
  await browser.close()
}

const finishedAt = new Date().toISOString()
const prior = mergeShellProgress()
const finalPayload = {
  startedAt: prior?.startedAt ?? startedAt,
  graphStartedAt: startedAt,
  finishedAt,
  updatedAt: finishedAt,
  phase: 'graph:done',
  done: true,
  shellDone: prior?.done === true || prior?.phase === 'done',
  shotCount: shots.length,
  shots,
  lastNotes: notes.slice(-40),
  results: { shell: prior?.results ?? null, graph: results },
}
writeFileSync('e2e/output/ux-progress.json', JSON.stringify(finalPayload, null, 2))
writeFileSync(
  'e2e/output/ux-graph-notes.json',
  JSON.stringify({ startedAt, finishedAt, notes, shots, results }, null, 2),
)
writeFileSync(
  'e2e/output/ux-graph-progress.md',
  [
    `# UX graph phase — complete`,
    ``,
    `- **finished:** ${finishedAt}`,
    `- **shots:** ${shots.length}`,
    ``,
    `## SUMMARY`,
    '```json',
    JSON.stringify(results, null, 2),
    '```',
    ``,
    `## Shots`,
    ...shots.map((s) => `- ${s}`),
    ``,
    `Next: agent merges into e2e/output/ux-report.md (docs/UX_PASS.md). Read ≤3 graph PNGs.`,
  ].join('\n'),
)
writeFileSync(
  'e2e/output/ux-progress.md',
  [
    `# UX drive progress (graph phase done)`,
    ``,
    `- **phase:** graph:done`,
    `- **finished:** ${finishedAt}`,
    `- **done:** true`,
    ``,
    `## Graph SUMMARY`,
    '```json',
    JSON.stringify(results, null, 2),
    '```',
    ``,
    `Shell progress may be in older ux-notes.json. Graph detail: ux-graph-progress.md`,
  ].join('\n'),
)

console.log('\n=== GRAPH SUMMARY ===')
console.log(JSON.stringify(results, null, 2))
console.log('Progress: e2e/output/ux-graph-progress.md + ux-progress.json')
