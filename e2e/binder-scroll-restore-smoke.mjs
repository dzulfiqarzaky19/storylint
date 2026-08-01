/**
 * AZ / T-003 smoke — Canon binder list scroll restore after sheet detail pop.
 * Click must NOT scrollIntoView before open — that is the real author path
 * (row already in view). Focus-on-Back must not fight saved scrollTop.
 *
 * Covers both AZ required surfaces:
 *   - rail @1440
 *   - drawer @390
 *
 * Under all-smoke: inherit STORYLINT_UI/API/HEAD (same data/ pointer the suite watches).
 * Standalone: ownMeasurementStack (head from stack.shortHead).
 * head=unknown is a FAIL — standing rule 1: a check that cannot name what it examined is not evidence.
 */
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { ownMeasurementStack } from './owned-stack.mjs'
import {
  setApiBase,
  ensureIsolatedProject,
  reclaimIsolatedProject,
  gotoWorkspace,
  ensureCompanionOpen,
  ensureBinderOpen,
  requireUiOrigin,
  requireApiOrigin,
  getApiBase,
} from './helpers.mjs'

const require = createRequire('D:/npm-global/node_modules/playwright/package.json')
const pwRoot = dirname(require.resolve('playwright/package.json'))
const { chromium } = await import(pathToFileURL(resolve(pwRoot, 'index.mjs')).href)
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const KINDS = {
  character: Array.from({ length: 36 }, (_, i) => `Char ${String(i + 1).padStart(2, '0')}`),
  lore: Array.from({ length: 12 }, (_, i) => `Lore ${i + 1}`),
  world: Array.from({ length: 10 }, (_, i) => `World ${i + 1}`),
  organization: Array.from({ length: 10 }, (_, i) => `Org ${i + 1}`),
}

const VIEWPORTS = [
  { width: 1440, height: 900, label: 'rail@1440' },
  { width: 390, height: 844, label: 'drawer@390' },
]

function sheets() {
  const out = []
  for (const [kind, names] of Object.entries(KINDS)) {
    names.forEach((name, i) => {
      out.push({
        id: `sr-${kind}-${i + 1}`,
        kind,
        name,
        aliases: [],
        summary: name,
        notes: '',
        facts: [],
      })
    })
  }
  return out
}

async function putProject(project) {
  const res = await fetch(`${getApiBase()}/api/project`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(project),
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`PUT failed ${res.status} ${text}`)
  return JSON.parse(text)
}

async function measureRestore(page, label) {
  const target = 'Char 30'
  const prepared = await page.evaluate((name) => {
    const body = document.querySelector('.shell__rail--binder .panel__body.binder__stack, .binder__stack')
    if (!body) return { ok: false, reason: 'no body' }
    const buttons = [...document.querySelectorAll('.binder__stack-list button, .shell__rail--binder button, button')]
    const row = buttons.find((b) => (b.textContent || '').includes(name))
    if (!row) return { ok: false, reason: 'no row' }
    const bodyBox = body.getBoundingClientRect()
    const rowBox = row.getBoundingClientRect()
    const delta = rowBox.top - bodyBox.top - bodyBox.height * 0.35
    body.scrollTop += delta
    const top = body.scrollTop
    return {
      ok: true,
      scrollTop: top,
      scrollH: body.scrollHeight,
      clientH: body.clientHeight,
      rowInView: (() => {
        const r = row.getBoundingClientRect()
        const b = body.getBoundingClientRect()
        return r.top >= b.top - 1 && r.bottom <= b.bottom + 1
      })(),
    }
  }, target)
  if (!prepared.ok || !prepared.rowInView) {
    throw new Error(`${label} precondition prepare failed ${JSON.stringify(prepared)}`)
  }
  const preOpen = prepared.scrollTop
  // Drawer viewport is shorter; keep a real non-trivial scroll without hardcoding rail height.
  if (preOpen < 80) throw new Error(`${label} precondition: need non-trivial scroll, got ${preOpen}`)

  const clicked = await page.evaluate((name) => {
    const body = document.querySelector('.shell__rail--binder .panel__body.binder__stack, .binder__stack')
    const before = body?.scrollTop ?? null
    const buttons = [...document.querySelectorAll('.binder__stack-list button, .shell__rail--binder button, button')]
    const row = buttons.find((b) => (b.textContent || '').includes(name))
    if (!row) return { ok: false }
    row.click()
    return { ok: true, before, afterClickScroll: body?.scrollTop ?? null }
  }, target)
  if (!clicked.ok) throw new Error(`${label} click failed`)
  await page.waitForTimeout(200)

  const opened = await page.evaluate(() => ({
    detail: Boolean(document.querySelector('[data-binder-detail="sheet"]')),
    editor: Boolean(document.querySelector('.sheet-editor')),
    scrollWhileOpen: document.querySelector('.binder__stack')?.scrollTop ?? null,
  }))
  if (!opened.detail && !opened.editor) {
    throw new Error(`${label} detail did not open ${JSON.stringify(opened)}`)
  }

  await page.locator('button[data-binder-back], button[aria-label*="Back" i]').first().click({ force: true })
  await page.waitForTimeout(120)

  const after = await page.evaluate(() => {
    const body = document.querySelector('.shell__rail--binder .panel__body.binder__stack, .binder__stack')
    const active = document.activeElement
    return {
      scrollTop: body?.scrollTop ?? null,
      editor: Boolean(document.querySelector('.sheet-editor')),
      focusName: (active?.textContent || active?.getAttribute('aria-label') || '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 80),
    }
  })
  const delta = (after.scrollTop ?? 0) - preOpen
  const ok = Math.abs(delta) <= 4 && !after.editor
  return { label, preOpen, clicked, opened, after, delta, ok }
}

async function main() {
  let stop = async () => {}
  let head = process.env.STORYLINT_HEAD || ''
  let ui
  if (process.env.STORYLINT_UI && process.env.STORYLINT_API) {
    setApiBase(process.env.STORYLINT_API)
    requireApiOrigin()
    ui = requireUiOrigin().replace(/\/$/, '')
  } else {
    const stack = await ownMeasurementStack({
      root: ROOT,
      skipBuild: process.env.STORYLINT_SKIP_BUILD === '1',
    })
    setApiBase(stack.api)
    ui = (stack.ui || '').replace(/\/$/, '')
    head = stack.shortHead
    stop = stack.stop
  }

  if (!head || head === 'unknown') {
    console.error('FAIL provenance: head is missing/unknown (standing rule 1 — not evidence)')
    process.exitCode = 1
    await stop().catch(() => {})
    return
  }

  const browser = await chromium.launch({ channel: 'msedge', headless: true })
  const cases = []
  try {
    for (const vp of VIEWPORTS) {
      const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } })
      const projectId = await ensureIsolatedProject(page, {
        id: `e2e-scroll-restore-${vp.width}-${process.pid}-${Date.now().toString(36)}`,
        title: `Binder scroll restore ${vp.label}`,
      })
      await putProject({
        schemaVersion: 2,
        title: 'Scroll restore',
        chapters: [{ id: 'ch1', title: 'One', body: 'Prose.', craftTags: [], revision: 0 }],
        sheets: sheets(),
        proposals: [],
        rejectedFingerprints: [],
        marks: [],
        researchNotes: [],
        lab: { boards: [{ id: 'bench', title: 'Bench', cardIds: [] }], cards: [] },
      })
      await page.goto(ui.endsWith('/') ? ui : `${ui}/`, { waitUntil: 'domcontentloaded', timeout: 30_000 })
      await reclaimIsolatedProject(projectId)
      await ensureCompanionOpen(page).catch(() => {})
      await ensureBinderOpen(page)
      await gotoWorkspace(page, 'canon', { ensureCompanion: vp.width >= 800 })
      await page.waitForTimeout(300)
      // Phone place switch can close the drawer — reopen before measure.
      await ensureBinderOpen(page)
      await page.waitForTimeout(150)

      const result = await measureRestore(page, vp.label)
      cases.push(result)
      await reclaimIsolatedProject(projectId)
      await page.close()
    }
  } finally {
    await browser.close().catch(() => {})
    await stop().catch(() => {})
  }

  const ok = cases.every((c) => c.ok)
  console.log(JSON.stringify({ head, cases }, null, 2))
  if (!ok) {
    console.error('FAIL scroll restore')
    process.exitCode = 1
  } else {
    console.log('PASS scroll restore')
  }
}

main().catch((e) => {
  console.error(e)
  process.exitCode = 1
})
