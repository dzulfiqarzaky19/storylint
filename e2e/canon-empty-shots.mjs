/**
 * MANUAL DIAGNOSTIC — P0 empty-Canon rubric + shots
 *
 * MANUAL DIAGNOSTIC — not part of the green suite (test:green / ALL_FEATURE_SMOKES).
 * NOT part of the green suite. Evidence/shots pack; calm covers resting density gates.
 * Run: node e2e/canon-empty-shots.mjs
 */

import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { mkdirSync } from 'node:fs'
import { requireApiOrigin, requireUiOrigin } from './helpers.mjs'

const require = createRequire('D:/npm-global/node_modules/playwright/package.json')
const pwRoot = dirname(require.resolve('playwright/package.json'))
const { chromium } = await import(pathToFileURL(resolve(pwRoot, 'index.mjs')).href)

const OUT = 'e2e/output/canon-empty'
mkdirSync(OUT, { recursive: true })

const API = requireApiOrigin()
const UI = requireUiOrigin()
const stamp = Date.now()
const emptyProjectId = `canon-empty-${stamp}`
const seededProjectId = `canon-seeded-${stamp}`

/** Isolate on a fresh project so another agent's fixtures cannot make an empty Canon look full. */
async function useProject(request, id, title) {
  const created = await request.post(`${API}/api/projects`, {
    data: { id, title },
    headers: { 'content-type': 'application/json' },
  })
  if (!created.ok() && created.status() !== 409) throw new Error(`create ${id} -> ${created.status()}`)
  const active = await request.post(`${API}/api/projects/${encodeURIComponent(id)}/activate`, {
    data: {},
    headers: { 'content-type': 'application/json' },
  })
  if (!active.ok()) throw new Error(`activate ${id} -> ${active.status()}`)
}

async function seedTwoSheets(request) {
  for (const [i, name] of ['EmptyMira', 'EmptyKael'].entries()) {
    const id = `canon-seed-${stamp}-${i}`
    const response = await request.put(`${API}/api/sheets/${id}`, {
      data: {
        id,
        kind: 'character',
        name: `${name}-${stamp.toString(36).slice(-4)}`,
        aliases: [],
        summary: '',
        notes: '',
        portrait: name[5],
        facts: [],
      },
      headers: { 'content-type': 'application/json' },
    })
    if (!response.ok()) throw new Error(`seed ${id} -> ${response.status()}`)
  }
}

async function openCanon(page) {
  // never networkidle on owned stacks — companion/LLM sockets burn ~30s
  await page.goto(UI, { waitUntil: 'domcontentloaded', timeout: 30_000 })
  await page.reload({ waitUntil: 'domcontentloaded' })
  const canon = page.getByRole('button', { name: 'Canon', exact: true })
  if (await canon.count()) await canon.click()
  const graph = page.getByRole('main', { name: 'Relationship graph' })
  await graph.waitFor({ timeout: 10000 })
  await page.waitForTimeout(400)
  return graph
}

/**
 * Read the resting state of Canon.
 * `shown` uses checkVisibility so a collapsed disclosure cannot masquerade as visible content.
 */
function readViewportPrimaries(page) {
  return page.evaluate(() => {
    const shown = (el) => Boolean(el && el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }))
    return [...document.querySelectorAll('.ui-button--primary')]
      .filter(shown)
      .map((b) => b.textContent.trim())
  })
}

function readCanon(graph) {
  return graph.evaluate((root) => {
    const shown = (el) => Boolean(el && el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }))
    const area = (el) => {
      if (!el || !shown(el)) return 0
      const r = el.getBoundingClientRect()
      return Math.round(r.width * r.height)
    }
    const editor = root.querySelector('.graph__editor')
    const emptyRegion = root.querySelector('.graph__empty')
    const purpose = root.querySelector('.graph__canvas, .graph__family-stage, .graph__empty')
    const primaryButtons = [...root.querySelectorAll('.ui-button--primary')].filter(shown)
    const cta = root.querySelector('.graph__empty-cta')

    return {
      emptyKind: emptyRegion?.getAttribute('data-graph-empty') ?? null,
      canonEmpty: root.getAttribute('data-canon-empty'),
      title: root.querySelector('.ui-empty-state__title')?.textContent?.trim() ?? null,
      hint: root.querySelector('.ui-empty-state__hint')?.textContent?.trim() ?? null,
      ctaLabel: cta?.textContent?.trim() ?? null,
      ctaShown: shown(cta),
      ctaHeight: cta ? Math.round(cta.getBoundingClientRect().height) : 0,
      primaryLabels: primaryButtons.map((b) => b.textContent.trim()),
      editorIsDetails: editor instanceof HTMLDetailsElement,
      editorOpen: editor instanceof HTMLDetailsElement ? editor.open : null,
      editorPresent: Boolean(editor),
      summaryShown: shown(root.querySelector('.graph__editor-summary')),
      summaryText: root.querySelector('.graph__editor-summary')?.textContent?.trim() ?? null,
      fieldsShown: [...root.querySelectorAll('.graph__editor select, .graph__editor input')].filter(shown).length,
      purposeArea: area(purpose),
      proposeArea: area(editor),
      bibleCopy: /bible/i.test(root.innerHTML),
      text: root.innerText,
    }
  })
}

const failures = []
const check = (condition, message) => {
  if (!condition) failures.push(message)
}

const browser = await chromium.launch({ channel: 'msedge', headless: true })

// ---------- EMPTY CANON ----------
const emptyReport = {}
for (const [label, width, height] of [['1440', 1440, 900], ['390', 390, 844]]) {
  const page = await browser.newPage({ viewport: { width, height } })
  await useProject(page.request, emptyProjectId, 'Canon empty P0')
  const graph = await openCanon(page)
  const state = await readCanon(graph)
  emptyReport[label] = state
  await page.screenshot({ path: `${OUT}/empty-${label}.png` })

  // The map's own empty state must be the primary surface, not a dead grey rectangle.
  check(state.emptyKind === 'canon', `empty@${label}: expected true-empty Canon state, got ${state.emptyKind}`)
  check(
    state.title === 'Your settled world lives here',
    `empty@${label}: empty title should explain Canon, got ${JSON.stringify(state.title)}`,
  )
  check(/settled/i.test(state.hint ?? ''), `empty@${label}: hint should say what Canon holds, got ${JSON.stringify(state.hint)}`)

  // Exactly one obvious next move, using the binder's door so there are not two doors to one room.
  check(state.ctaShown, `empty@${label}: create-first-sheet CTA is not visible`)
  check(state.ctaLabel === 'New sheet', `empty@${label}: CTA must match the binder door "New sheet", got ${JSON.stringify(state.ctaLabel)}`)
  check(
    state.primaryLabels.length === 1 && state.primaryLabels[0] === 'New sheet',
    `empty@${label}: expected exactly one primary action (New sheet), got ${JSON.stringify(state.primaryLabels)}`,
  )

  // One solid primary per job across the whole viewport: while the map's centre CTA is the door,
  // the binder's New sheet must step down so the author is not offered the same job twice in bold.
  const viewportPrimaries = await readViewportPrimaries(page)
  check(
    viewportPrimaries.filter((t) => t === 'New sheet').length === 1,
    `empty@${label}: expected exactly one solid New sheet in the viewport, got ${JSON.stringify(viewportPrimaries)}`,
  )

  // Propose stays reachable (it IS the acceptance model) but must not be the loud thing.
  check(state.editorPresent, `empty@${label}: propose disclosure must remain present, not be removed`)
  check(state.editorOpen === false, `empty@${label}: propose must be collapsed, open=${state.editorOpen}`)
  check(state.summaryShown, `empty@${label}: propose summary must stay legible`)
  check(state.fieldsShown === 0, `empty@${label}: propose fields must not be showing, got ${state.fieldsShown}`)

  // The fold belongs to the map's purpose, not to the job tool.
  check(
    state.purposeArea > state.proposeArea,
    `empty@${label}: propose steals the fold (purpose=${state.purposeArea} propose=${state.proposeArea})`,
  )

  // True-empty must not imply lost work, and the dialect must be Canon.
  check(!state.bibleCopy, `empty@${label}: stale "bible" copy still present`)
  check(!/no visible sheets/i.test(state.text), `empty@${label}: "No visible sheets" implies filtering on a true-empty Canon`)

  if (label === '390') {
    check(state.ctaHeight >= 44, `empty@390: primary CTA is ${state.ctaHeight}px, want >= 44`)
  }
  await page.close()
}

// ---------- POPULATED REGRESSION (D4 ACCEPT must still hold) ----------
const seededReport = {}
for (const [label, width, height] of [['1440', 1440, 900], ['390', 390, 844]]) {
  const page = await browser.newPage({ viewport: { width, height } })
  await useProject(page.request, seededProjectId, 'Canon seeded P0')
  await seedTwoSheets(page.request)
  const graph = await openCanon(page)
  const state = await readCanon(graph)
  seededReport[label] = state
  await page.screenshot({ path: `${OUT}/populated-${label}.png` })

  check(state.emptyKind === null, `populated@${label}: expected a rendered map, got empty state ${state.emptyKind}`)
  // Populated inverts: the map CTA is gone, so the binder owns the job and carries the solid weight.
  // Only checked where the binder is on screen; at 390 it is a drawer and no binder button is visible.
  const populatedPrimaries = await readViewportPrimaries(page)
  const binderVisible = await page.evaluate(() => {
    const el = document.querySelector('.panel')
    return Boolean(el && el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }))
  })
  if (binderVisible) {
    check(
      populatedPrimaries.includes('New sheet'),
      `populated@${label}: binder New sheet should be the solid primary, got ${JSON.stringify(populatedPrimaries)}`,
    )
  }
  check(state.editorOpen === false, `populated@${label}: propose must still default collapsed`)
  check(
    state.purposeArea > state.proposeArea,
    `populated@${label}: map must still own the fold (purpose=${state.purposeArea} propose=${state.proposeArea})`,
  )
  check(!state.bibleCopy, `populated@${label}: stale "bible" copy still present`)
  await page.close()
}

// ---------- THE ONE MOVE MUST ACTUALLY WORK ----------
const door = await browser.newPage({ viewport: { width: 1440, height: 900 } })
await useProject(door.request, emptyProjectId, 'Canon empty P0')
const doorGraph = await openCanon(door)
await doorGraph.locator('.graph__empty-cta').click()
await door.waitForTimeout(600)
const sheetForm = await door.evaluate(() => {
  const shown = (el) => Boolean(el && el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }))
  const detail = document.querySelector('[data-binder-detail="sheet"]')
  const nameField = [...document.querySelectorAll('.sheet-editor input')].find(shown)
  return {
    detailShown: shown(detail),
    nameFieldShown: Boolean(nameField),
    sheetOpen: document.querySelector('.shell')?.getAttribute('data-sheet-open') ?? null,
    detailTitle: document.querySelector('.binder__detail-title')?.textContent?.trim() ?? null,
  }
})
await door.screenshot({ path: `${OUT}/empty-cta-opens-form-1440.png` })
check(sheetForm.detailShown, 'empty CTA: New sheet did not open the binder sheet form')
check(sheetForm.nameFieldShown, 'empty CTA: sheet form opened without a usable name field')
check(
  sheetForm.detailTitle === 'New sheet',
  `empty CTA: binder detail should read "New sheet", got ${JSON.stringify(sheetForm.detailTitle)}`,
)
await door.close()

// ---------- EMPTY + PROPOSE FORCED OPEN (demotion must survive) ----------
const forced = await browser.newPage({ viewport: { width: 1440, height: 900 } })
await useProject(forced.request, emptyProjectId, 'Canon empty P0')
const forcedGraph = await openCanon(forced)
await forcedGraph.locator('.graph__editor-summary').click()
await forcedGraph.locator('.graph__editor select').first().waitFor({ state: 'visible', timeout: 5000 })
const forcedState = await readCanon(forcedGraph)
await forced.screenshot({ path: `${OUT}/empty-propose-open-1440.png` })
check(forcedState.editorOpen === true, 'empty forced: propose did not open from its summary')
check(forcedState.ctaShown, 'empty forced: create-first-sheet CTA disappeared when propose opened')
await forced.close()

await browser.close()

console.log(JSON.stringify({ empty: emptyReport['1440'], seeded: seededReport['1440'] }, null, 2))

if (failures.length) {
  console.error('FAIL empty-Canon P0:')
  for (const failure of failures) console.error(` - ${failure}`)
  process.exit(1)
}
console.log(`PASS empty-Canon P0 + shots -> ${OUT}`)
