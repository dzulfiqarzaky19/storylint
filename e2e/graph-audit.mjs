import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { mkdirSync, writeFileSync } from 'node:fs'
import { openProposeEditor } from './constants.mjs'

const require = createRequire('D:/npm-global/node_modules/playwright/package.json')
const pwRoot = dirname(require.resolve('playwright/package.json'))
const { chromium } = await import(pathToFileURL(resolve(pwRoot, 'index.mjs')).href)
mkdirSync('e2e/output/graph-audit', { recursive: true })

const stamp = Date.now()
const tag = stamp.toString(36).slice(-4)
const notes = []
const shots = []
const results = { empty: {}, withData: {}, blockers: [], shouldFix: [], nits: [] }
const log = (s) => {
  notes.push(s)
  console.log(s)
}

/** Visible chip labels for sheet kinds (SHEET_KIND_LABEL); the map no longer renders raw enums. */\nconst KIND_LABEL = { character: 'Characters', lore: 'Lore', world: 'World', organization: 'Organizations' }\nconst KINDS = ['character', 'lore', 'world', 'organization']
const sheets = [
  {
    id: `ga-char-a-${stamp}`,
    kind: 'character',
    name: `Aria-${tag}`,
    aliases: [],
    summary: '',
    notes: '',
    portrait: 'A',
    facts: [],
  },
  {
    id: `ga-char-b-${stamp}`,
    kind: 'character',
    name: `Kael-${tag}`,
    aliases: [],
    summary: '',
    notes: '',
    portrait: 'B',
    facts: [],
  },
  {
    id: `ga-lore-${stamp}`,
    kind: 'lore',
    name: `River Oath-${tag}`,
    aliases: [],
    summary: '',
    notes: '',
    portrait: 'L',
    facts: [],
  },
  {
    id: `ga-world-${stamp}`,
    kind: 'world',
    name: `Ember Coast-${tag}`,
    aliases: [],
    summary: '',
    notes: '',
    portrait: 'W',
    facts: [],
  },
  {
    id: `ga-org-${stamp}`,
    kind: 'organization',
    name: `Lantern Order-${tag}`,
    aliases: [],
    summary: '',
    notes: '',
    portrait: 'O',
    facts: [],
  },
]

async function putSheet(request, sheet) {
  const res = await request.put(`http://127.0.0.1:4174/api/sheets/${sheet.id}`, {
    data: sheet,
    headers: { 'content-type': 'application/json' },
  })
  if (!res.ok()) throw new Error(`seed ${sheet.id} ${res.status()}`)
}

async function shot(page, name) {
  const path = `e2e/output/graph-audit/${name}.png`
  await page.screenshot({ path, fullPage: false })
  shots.push(path)
  log('SHOT ' + path)
  return path
}

async function openGraph(page) {
  await page.getByRole('button', { name: /^Canon$/i }).click()
  const graph = page.getByRole('main', { name: 'Relationship graph' })
  await graph.waitFor({ timeout: 10000 })
  return graph
}

async function sampleGraph(page) {
  return page.evaluate(() => {
    const root = document.querySelector('main.graph')
    if (!root) return { missing: true }
    const empty = root.querySelector('.empty-state, [class*="empty"]')
    const emptyText = empty ? (empty.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 200) : null
    const nodes = Array.from(root.querySelectorAll('.graph__node'))
      .map((el) => {
        const box = el.getBoundingClientRect()
        return {
          label: (el.getAttribute('aria-label') || el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 100),
          family: el.classList.contains('graph__node--family'),
          w: Math.round(box.width),
          h: Math.round(box.height),
        }
      })
      .filter((n) => n.w > 2 && n.h > 2)
    const edges = Array.from(root.querySelectorAll('.graph__edge')).map((el) => ({
      label: (el.getAttribute('aria-label') || el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 100),
    }))
    const filters = Array.from(
      root.querySelectorAll('.graph__filters button, [aria-label="Filter by sheet kind"] button'),
    ).map((b) => ({
      text: (b.textContent || '').trim(),
      pressed: b.getAttribute('aria-pressed'),
    }))
    const views = Array.from(root.querySelectorAll('.graph__view button, [aria-label="Graph view"] button')).map(
      (b) => ({
        text: (b.textContent || '').trim(),
        pressed: b.getAttribute('aria-pressed'),
      }),
    )
    const canvas = root.querySelector('svg.graph__canvas')
    const familyStage = root.querySelector('.graph__family-stage')
    const editor = root.querySelector('.graph__editor')
    const header = root.querySelector('.graph__header')
    const vars = getComputedStyle(document.documentElement)
    const accent = vars.getPropertyValue('--color-accent').trim().toLowerCase()
    return {
      emptyText,
      nodeCount: nodes.length,
      edgeCount: edges.length,
      nodes: nodes.slice(0, 16),
      edges: edges.slice(0, 16),
      filters,
      views,
      hasCanvas: Boolean(canvas),
      hasFamilyStage: Boolean(familyStage),
      headerText: header ? (header.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 200) : null,
      editorText: editor ? (editor.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 200) : null,
      accent: vars.getPropertyValue('--color-accent').trim(),
      skyBlue: accent.includes('#6ea8fe') || accent.includes('110, 168, 254'),
    }
  })
}

async function setOnlyKind(graph, kind) {
  for (const k of KINDS) {
    const btn = graph.getByRole('button', { name: KIND_LABEL[k] ?? k, exact: true })
    const pressed = await btn.getAttribute('aria-pressed')
    const want = k === kind
    if ((pressed === 'true') !== want) await btn.click()
  }
}

async function setAllKinds(graph, on) {
  for (const k of KINDS) {
    const btn = graph.getByRole('button', { name: KIND_LABEL[k] ?? k, exact: true })
    const pressed = await btn.getAttribute('aria-pressed')
    if ((pressed === 'true') !== on) await btn.click()
  }
}

async function acceptPending(page, statement) {
  const card = page.locator('.proposal-card').filter({ hasText: statement })
  await card.getByRole('button', { name: /^Accept$/i }).click()
  await page.waitForTimeout(400)
}

const browser = await chromium.launch({ channel: 'msedge', headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
page.setDefaultTimeout(12000)

try {
  // never networkidle on owned stacks — companion/LLM sockets burn ~30s
  await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded', timeout: 30_000 })
  await page.getByRole('main', { name: 'Draft' }).waitFor({ timeout: 15000 })
  const newProj = page.getByRole('button', { name: /new project/i })
  if (await newProj.count()) {
    await newProj.click()
    const nameField = page.getByLabel(/project name|name/i).first()
    if (await nameField.count()) {
      await nameField.fill(`Graph Audit ${stamp}`)
    } else {
      const textInput = page.locator('input[type="text"]').first()
      if (await textInput.count()) await textInput.fill(`Graph Audit ${stamp}`)
    }
    const create = page.getByRole('button', { name: /^Create$/i })
    if (await create.count()) {
      try {
        await create.click({ timeout: 3000 })
      } catch {
        log('WARN: Create stayed disabled; continuing on current project')
        const cancel = page.getByRole('button', { name: /^Cancel$/i })
        if (await cancel.count()) await cancel.click().catch(() => {})
      }
    }
    await page.waitForTimeout(500)
  }
  log('opened app')

  let graph = await openGraph(page)
  await shot(page, '01-network-all-default')
  let s = await sampleGraph(page)
  log(
    'default network: ' +
      JSON.stringify({ nodes: s.nodeCount, edges: s.edgeCount, empty: s.emptyText, filters: s.filters, views: s.views }),
  )
  results.empty.defaultNetwork = s
  if (s.skyBlue) results.blockers.push('Sky-blue accent in graph chrome')

  await setAllKinds(graph, false)
  await page.waitForTimeout(200)
  s = await sampleGraph(page)
  await shot(page, '02-network-all-kinds-off')
  results.empty.networkAllOff = s
  log('all off: ' + JSON.stringify({ nodes: s.nodeCount, empty: s.emptyText }))
  if (!s.emptyText) results.shouldFix.push('Network with all kinds off should show EmptyState')
  if (s.nodeCount !== 0) results.blockers.push('Nodes visible with all kinds disabled')

  for (const kind of KINDS) {
    await setOnlyKind(graph, kind)
    await page.waitForTimeout(150)
    s = await sampleGraph(page)
    await shot(page, `03-network-before-seed-${kind}`)
    results.empty[`network_${kind}`] = { nodeCount: s.nodeCount, emptyText: s.emptyText, filters: s.filters }
    log(`before-seed ${kind}: nodes=${s.nodeCount} empty=${s.emptyText}`)
  }

  await setAllKinds(graph, true)
  await graph.getByRole('button', { name: 'Family', exact: true }).click()
  await page.waitForTimeout(250)
  s = await sampleGraph(page)
  await shot(page, '04-family-before-seed')
  results.empty.familyBeforeSeed = {
    nodeCount: s.nodeCount,
    emptyText: s.emptyText,
    hasFamilyStage: s.hasFamilyStage,
  }
  log('family before seed: ' + JSON.stringify(results.empty.familyBeforeSeed))

  for (const sheet of sheets) await putSheet(page.request, sheet)
  await page.reload({ waitUntil: 'domcontentloaded' })
  graph = await openGraph(page)
  await setAllKinds(graph, true)
  await graph.getByRole('button', { name: 'Network', exact: true }).click()
  await page.waitForTimeout(300)
  s = await sampleGraph(page)
  await shot(page, '05-network-with-seeded-nodes')
  results.withData.networkAll = s
  log('seeded network: nodes=' + s.nodeCount + ' edges=' + s.edgeCount)
  for (const sheet of sheets) {
    const found = (s.nodes || []).some((n) => n.label.includes(sheet.name))
    if (!found) results.shouldFix.push(`Seeded sheet not visible in network: ${sheet.kind} ${sheet.name}`)
  }

  async function proposeEdge(fromId, toId, key, statement) {
    // D4: Propose collapses at every width; open the disclosure before touching fields.
    await openProposeEditor(graph)
    const selects = graph.locator('.graph__editor select')
    await selects.nth(0).selectOption(fromId)
    await selects.nth(1).selectOption(toId)
    await graph.getByPlaceholder('father_of, member_of, rival…').fill(key)
    await graph.getByPlaceholder('Aria is a member of the Ember Order').fill(statement)
    await graph.getByRole('button', { name: /Send proposal/i }).click()
    await graph.getByText(/proposal is pending/i).waitFor({ timeout: 8000 })
    await acceptPending(page, statement)
  }

  await proposeEdge(
    sheets[0].id,
    sheets[1].id,
    'parent_of',
    `${sheets[0].name} is parent of ${sheets[1].name}`,
  )
  await proposeEdge(
    sheets[0].id,
    sheets[4].id,
    'member_of',
    `${sheets[0].name} is a member of ${sheets[4].name}`,
  )
  await proposeEdge(sheets[0].id, sheets[2].id, 'knows', `${sheets[0].name} knows ${sheets[2].name}`)
  await proposeEdge(
    sheets[4].id,
    sheets[3].id,
    'based_in',
    `${sheets[4].name} is based in ${sheets[3].name}`,
  )
  await page.waitForTimeout(400)
  s = await sampleGraph(page)
  await shot(page, '06-network-with-edges')
  results.withData.networkWithEdges = { nodeCount: s.nodeCount, edgeCount: s.edgeCount, edges: s.edges }
  log('with edges: ' + JSON.stringify(results.withData.networkWithEdges))
  if (s.edgeCount < 1) results.blockers.push('Accepted edges not rendering on network')

  for (const kind of KINDS) {
    await setOnlyKind(graph, kind)
    await page.waitForTimeout(200)
    s = await sampleGraph(page)
    await shot(page, `07-network-filter-${kind}`)
    const bad = (s.nodes || []).filter((n) => {
      const m = n.label.match(/Open .+ (character|lore|world|organization) sheet/i)
      return m && m[1].toLowerCase() !== kind
    })
    results.withData[`filter_${kind}`] = {
      nodeCount: s.nodeCount,
      edgeCount: s.edgeCount,
      emptyText: s.emptyText,
      badKinds: bad,
      nodes: s.nodes,
    }
    log(`filter ${kind}: nodes=${s.nodeCount} edges=${s.edgeCount} bad=${bad.length}`)
    if (bad.length) {
      results.blockers.push(`Filter ${kind} shows other kinds: ${bad.map((b) => b.label).join('; ')}`)
    }
    if (s.nodeCount === 0) results.shouldFix.push(`Filter ${kind} empty after seeding that kind`)
  }

  await setAllKinds(graph, true)
  await graph.getByRole('button', { name: 'Family', exact: true }).click()
  await page.waitForTimeout(300)
  s = await sampleGraph(page)
  await shot(page, '08-family-with-kinship')
  results.withData.family = s
  log(
    'family with data: ' +
      JSON.stringify({
        nodes: s.nodeCount,
        edges: s.edgeCount,
        empty: s.emptyText,
        hasFamilyStage: s.hasFamilyStage,
      }),
  )
  if (s.nodeCount < 2) results.blockers.push('Family view missing parent/child nodes after parent_of Accept')
  if (!s.hasFamilyStage && !s.emptyText) results.shouldFix.push('Family stage container missing')

  await setOnlyKind(graph, 'lore')
  await page.waitForTimeout(200)
  s = await sampleGraph(page)
  await shot(page, '09-family-lore-only')
  results.withData.familyLoreOnly = { nodeCount: s.nodeCount, emptyText: s.emptyText }
  log('family lore-only: ' + JSON.stringify(results.withData.familyLoreOnly))
  if (s.nodeCount > 0) {
    results.shouldFix.push('Family view still shows nodes when only lore filter on (family is character kinship)')
  }

  await setAllKinds(graph, true)
  await graph.getByRole('button', { name: 'Network', exact: true }).click()
  await page.waitForTimeout(200)
  s = await sampleGraph(page)
  await shot(page, '10-network-final')
  if (s.skyBlue) results.blockers.push('Sky blue after interactions')
  if (!s.editorText || !/Propose/i.test(s.editorText)) results.shouldFix.push('Relationship editor missing or unclear')
  if (!s.headerText || !/Accepted bible facts only/i.test(s.headerText || '')) {
    results.nits.push('Header canon hint missing')
  }

  await page.setViewportSize({ width: 767, height: 900 })
  await page.waitForTimeout(250)
  s = await sampleGraph(page)
  await shot(page, '11-network-phone')
  results.withData.phone = { nodeCount: s.nodeCount, edgeCount: s.edgeCount }
  log('phone network: ' + JSON.stringify(results.withData.phone))

  await page.setViewportSize({ width: 1440, height: 900 })
  await graph.getByRole('button', { name: 'Family', exact: true }).click()
  await page.waitForTimeout(200)
  await page.setViewportSize({ width: 767, height: 900 })
  await shot(page, '12-family-phone')

  const out = { notes, shots, results, stamp }
  writeFileSync('e2e/output/graph-audit/notes.json', JSON.stringify(out, null, 2))
  writeFileSync(
    'e2e/output/graph-audit/summary.md',
    [
      '# Graph audit',
      '',
      `- blockers: ${results.blockers.length}`,
      `- shouldFix: ${results.shouldFix.length}`,
      `- nits: ${results.nits.length}`,
      '',
      '## Blockers',
      ...(results.blockers.length ? results.blockers.map((b) => '- ' + b) : ['- (none)']),
      '',
      '## Should-fix',
      ...(results.shouldFix.length ? results.shouldFix.map((b) => '- ' + b) : ['- (none)']),
      '',
      '## Nits',
      ...(results.nits.length ? results.nits.map((b) => '- ' + b) : ['- (none)']),
      '',
      '## Shots',
      ...shots.map((path) => '- ' + path),
    ].join('\n'),
  )
  console.log('=== SUMMARY ===')
  console.log(JSON.stringify(results, null, 2))
} catch (e) {
  console.error('FAIL', e)
  results.blockers.push(String((e && e.stack) || e))
  writeFileSync('e2e/output/graph-audit/notes.json', JSON.stringify({ notes, shots, results, stamp }, null, 2))
  process.exitCode = 1
} finally {
  await browser.close()
}
