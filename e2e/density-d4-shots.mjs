/**
 * MANUAL DIAGNOSTIC — D4 Canon map chrome shots @1440/@390
 *
 * MANUAL DIAGNOSTIC — not part of the green suite (test:green / ALL_FEATURE_SMOKES).
 * NOT part of the green suite. Shot evidence; npm run calm is the density gate.
 * Run: node e2e/density-d4-shots.mjs
 */

import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { mkdirSync, writeFileSync } from 'node:fs'
import { requireApiOrigin, requireUiOrigin } from './helpers.mjs'
import { openProposeEditor } from './constants.mjs'

const require = createRequire('D:/npm-global/node_modules/playwright/package.json')
const pwRoot = dirname(require.resolve('playwright/package.json'))
const { chromium } = await import(pathToFileURL(resolve(pwRoot, 'index.mjs')).href)

const OUT = 'e2e/output/density-d4'
mkdirSync(OUT, { recursive: true })

const API = requireApiOrigin()
const UI = requireUiOrigin()
const stamp = Date.now()
const tag = stamp.toString(36).slice(-4)
const parentId = `d4-parent-${stamp}`
const childId = `d4-child-${stamp}`
const parentName = `D4Mira-${tag}`
const childName = `D4Kael-${tag}`

async function seed(request) {
  const sheets = [
    { id: parentId, portrait: 'M', name: parentName },
    { id: childId, portrait: 'K', name: childName },
  ].map((s) => ({
    id: s.id,
    kind: 'character',
    name: s.name,
    aliases: [],
    summary: '',
    notes: '',
    portrait: s.portrait,
    facts: [],
  }))
  for (const sheet of sheets) {
    const response = await request.put(`${API}/api/sheets/${sheet.id}`, {
      data: sheet,
      headers: { 'content-type': 'application/json' },
    })
    if (!response.ok()) throw new Error(`seed ${sheet.id} -> ${response.status()}`)
  }
}

/** Read the geometry + pressed-state styling the rubric asks about. */
function metrics(graph) {
  return graph.evaluate((root) => {
    const box = (el) => {
      if (!el) return null
      const r = el.getBoundingClientRect()
      return { h: Math.round(r.height), w: Math.round(r.width), top: Math.round(r.top) }
    }
    const style = (el) => {
      if (!el) return null
      const s = getComputedStyle(el)
      return {
        background: s.backgroundColor,
        color: s.color,
        borderColor: s.borderTopColor,
        fontSize: s.fontSize,
        fontWeight: s.fontWeight,
        minHeight: s.minHeight,
      }
    }
    const editor = root.querySelector('.graph__editor')
    const view = root.querySelector('.graph__view')
    const filters = root.querySelector('.graph__filters')
    const summary = root.querySelector('.graph__editor-summary')
    return {
      header: box(root.querySelector('.graph__header')),
      canvas: box(root.querySelector('.graph__canvas, .graph__family-stage, .graph__empty')),
      editor: box(editor),
      summary: box(summary),
      editorIsDetails: editor instanceof HTMLDetailsElement,
      editorOpen: editor instanceof HTMLDetailsElement ? editor.open : null,
      lede: root.querySelector('.graph__lede')?.textContent?.trim() ?? null,
      viewPressed: style(view?.querySelector('[aria-pressed="true"]')),
      filterPressed: style(filters?.querySelector('[aria-pressed="true"]')),
      // C5: chips must read as plain language, never raw enum values.
      filterLabels: [...(filters?.querySelectorAll('button') ?? [])].map((b) => b.textContent.trim()),
      kindTexts: [...root.querySelectorAll('.graph__kind')].map((t) => t.textContent.trim()),
      filterHeights: [...(filters?.querySelectorAll('button') ?? [])].map((b) =>
        Math.round(b.getBoundingClientRect().height),
      ),
      viewHeights: [...(view?.querySelectorAll('button') ?? [])].map((b) =>
        Math.round(b.getBoundingClientRect().height),
      ),
    }
  })
}

/** Canon sheet detail can rest open over the map; Esc it so map controls are hittable. */
async function dismissSheetDetail(page) {
  const shell = page.locator('.shell')
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const drawer = page.locator('.ui-drawer-root')
    const sheetOpen = await shell.getAttribute('data-sheet-open')
    if ((await drawer.count()) === 0 && sheetOpen !== 'true') return
    await page.keyboard.press('Escape')
    await page.waitForTimeout(200)
  }
}

async function openCanon(page) {
  // never networkidle on owned stacks — companion/LLM sockets burn ~30s
  await page.goto(UI, { waitUntil: 'domcontentloaded', timeout: 30_000 })
  const graph = page.getByRole('main', { name: 'Relationship graph' })
  if (!(await graph.count())) {
    await page.getByRole('button', { name: 'Canon', exact: true }).click()
  }
  await graph.waitFor({ timeout: 10000 })
  await page.waitForTimeout(300)
  await dismissSheetDetail(page)
  return graph
}

async function capture(page, width, height, name) {
  await page.setViewportSize({ width, height })
  const graph = await openCanon(page)

  // Default state must already be collapsed; do not force it.
  const collapsed = await metrics(graph)
  await page.screenshot({ path: `${OUT}/${name}-collapsed.png` })

  // Explicit summary activation via keyboard proves the disclosure is a real control.
  const summary = graph.locator('.graph__editor-summary')
  await summary.focus()
  await page.keyboard.press('Enter')
  await graph.locator('.graph__editor select').first().waitFor({ state: 'visible', timeout: 5000 })
  const open = await metrics(graph)
  await page.screenshot({ path: `${OUT}/${name}-propose-open.png` })
  await page.keyboard.press('Enter')
  await page.waitForTimeout(150)

  await dismissSheetDetail(page)
  await graph.getByRole('button', { name: 'Family', exact: true }).click()
  await page.waitForTimeout(300)
  await page.screenshot({ path: `${OUT}/${name}-family.png` })
  const family = await metrics(graph)
  await graph.getByRole('button', { name: 'Network', exact: true }).click()
  await page.waitForTimeout(200)

  // Edge edit must open Propose with fields filled.
  await dismissSheetDetail(page)
  await openProposeEditor(graph)
  await page.keyboard.press('Escape')
  const edge = graph.locator('.graph__edge').first()
  let editOpensEditor = null
  if (await edge.count()) {
    await graph.locator('.graph__editor-summary').click() // collapse again
    await page.waitForTimeout(150)
    await dismissSheetDetail(page)
    await edge.focus()
    await page.keyboard.press('Enter')
    await page.waitForTimeout(250)
    const after = await metrics(graph)
    const keyValue = await graph.getByPlaceholder('father_of, member_of, rival…').inputValue()
    editOpensEditor = { open: after.editorOpen, keyValue }
    await page.screenshot({ path: `${OUT}/${name}-edge-edit.png` })
  }

  return { collapsed, open, family, editOpensEditor }
}

const failures = []
const check = (condition, message) => {
  if (!condition) failures.push(message)
}

const browser = await chromium.launch({ channel: 'msedge', headless: true })
const page = await browser.newPage()
let report = null
try {
  await seed(page.request)
  const desktop = await capture(page, 1440, 900, 'desktop-1440')
  const phone = await capture(page, 390, 844, 'phone-390')
  report = { desktop, phone, at: new Date().toISOString() }

  for (const [label, m] of [['desktop', desktop], ['phone', phone]]) {
    const c = m.collapsed
    check(c.editorIsDetails, `${label}: propose editor is not a disclosure`)
    check(c.editorOpen === false, `${label}: propose editor should default collapsed`)
    // C5: no raw enum may survive as a visible chip or node label.
  const RAW_KINDS = ['character', 'lore', 'world', 'organization']
  check(
    c.filterLabels.length > 0 && !c.filterLabels.some((t) => RAW_KINDS.includes(t)),
    `${label}: kind chips still show raw enums -> ${JSON.stringify(c.filterLabels)}`,
  )
  check(
    !c.kindTexts.some((t) => RAW_KINDS.includes(t)),
    `${label}: node kind text still shows raw enums -> ${JSON.stringify(c.kindTexts)}`,
  )
  check(c.lede === 'Accepted links only', `${label}: lede is "${c.lede}"`)
    check(c.canvas && c.editor && c.canvas.h > c.editor.h, `${label}: canvas must be taller than collapsed editor`)
    check(c.canvas && c.header && c.canvas.h >= c.header.h, `${label}: canvas must be at least header height`)
    check(m.open.editorOpen === true, `${label}: Enter on summary did not open propose`)
    check(
      m.editOpensEditor === null || (m.editOpensEditor.open === true && m.editOpensEditor.keyValue.length > 0),
      `${label}: edge edit did not open propose with fields filled`,
    )
    // View primary vs kinds secondary: pressed styling must differ.
    const v = c.viewPressed
    const f = c.filterPressed
    check(v && f, `${label}: missing pressed view/filter samples`)
    if (v && f) {
      check(
        v.background !== f.background || v.color !== f.color,
        `${label}: view pressed and kind pressed share styling (${v.background}/${v.color})`,
      )
      check(
        Number.parseFloat(f.fontSize) <= Number.parseFloat(v.fontSize),
        `${label}: kind filters are not smaller than the view switch`,
      )
    }
  }

  // Narrow touch targets.
  const narrowHeights = [...phone.collapsed.viewHeights, ...phone.collapsed.filterHeights, phone.collapsed.summary?.h ?? 0]
  check(narrowHeights.every((h) => h >= 44), `phone: touch targets below 44px -> ${narrowHeights.join(',')}`)

  writeFileSync(`${OUT}/metrics.json`, JSON.stringify({ ...report, failures }, null, 2))
} finally {
  await browser.close()
}

console.log(JSON.stringify(report?.desktop?.collapsed ?? {}, null, 2))
if (failures.length) {
  console.error('FAIL D4 checks:\n- ' + failures.join('\n- '))
  process.exit(1)
}
console.log('PASS D4 chrome checks + shots ->', OUT)
