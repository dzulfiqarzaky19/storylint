/**
 * AZ P0 smoke — Canon binder list scroll restore after sheet detail pop (green suite).
 * Click must NOT scrollIntoView before open — that is the real author path
 * (row already in view). Focus-on-Back must not fight saved scrollTop.
 *
 * Under all-smoke: inherit STORYLINT_UI/API (same data/ pointer the suite watches).
 * Standalone: ownMeasurementStack.
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

async function main() {
  let stop = async () => {}
  let head = process.env.STORYLINT_HEAD || 'unknown'
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

  const browser = await chromium.launch({ channel: 'msedge', headless: true })
  let projectId = null
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
    projectId = await ensureIsolatedProject(page, {
      id: `e2e-scroll-restore-${process.pid}-${Date.now().toString(36)}`,
      title: 'Binder scroll restore',
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
    await page.goto(ui.endsWith('/') ? ui : `${ui}/`, { waitUntil: 'networkidle' })
    await reclaimIsolatedProject(projectId)
    await ensureCompanionOpen(page)
    await ensureBinderOpen(page)
    await gotoWorkspace(page, 'canon', { ensureCompanion: true })
    await page.waitForTimeout(300)

    const target = 'Char 30'
    const prepared = await page.evaluate((name) => {
      const body = document.querySelector('.shell__rail--binder .panel__body.binder__stack, .binder__stack')
      if (!body) return { ok: false, reason: 'no body' }
      const buttons = [...document.querySelectorAll('.binder__stack-list button, .shell__rail--binder button')]
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
      throw new Error(`precondition prepare failed ${JSON.stringify(prepared)}`)
    }
    const preOpen = prepared.scrollTop
    if (preOpen < 200) throw new Error(`precondition: need non-trivial scroll, got ${preOpen}`)

    const clicked = await page.evaluate((name) => {
      const body = document.querySelector('.shell__rail--binder .panel__body.binder__stack, .binder__stack')
      const before = body?.scrollTop ?? null
      const buttons = [...document.querySelectorAll('.binder__stack-list button, .shell__rail--binder button')]
      const row = buttons.find((b) => (b.textContent || '').includes(name))
      if (!row) return { ok: false }
      row.click()
      return { ok: true, before, afterClickScroll: body?.scrollTop ?? null }
    }, target)
    if (!clicked.ok) throw new Error('click failed')
    await page.waitForTimeout(200)

    const opened = await page.evaluate(() => ({
      detail: Boolean(document.querySelector('[data-binder-detail="sheet"]')),
      editor: Boolean(document.querySelector('.sheet-editor')),
      scrollWhileOpen: document.querySelector('.shell__rail--binder .binder__stack')?.scrollTop ?? null,
    }))
    if (!opened.detail && !opened.editor) throw new Error(`detail did not open ${JSON.stringify(opened)}`)

    await page.locator('.shell__rail--binder').getByRole('button', { name: /Back/i }).first().click({ force: true })
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
    const ok = Math.abs(delta) <= 4
    // Leave active on OUR mint for all-smoke runtime isolation (do not restore default here).
    await reclaimIsolatedProject(projectId)
    console.log(JSON.stringify({ preOpen, clicked, opened, after, delta, ok, head }, null, 2))
    if (!ok) {
      console.error('FAIL scroll restore')
      process.exitCode = 1
    } else {
      console.log('PASS scroll restore')
    }
  } finally {
    await browser.close().catch(() => {})
    await stop().catch(() => {})
  }
}

main().catch((e) => {
  console.error(e)
  process.exitCode = 1
})
