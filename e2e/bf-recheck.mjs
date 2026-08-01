/**
 * TASK BF focused rechecks — body focus on pure load; phone with drawers dismissed.
 */
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { mkdirSync, writeFileSync } from 'node:fs'
import { ownMeasurementStack } from './owned-stack.mjs'
import {
  assertActiveProject,
  dismissDrawers,
  ensureIsolatedProject,
  fetchActiveProject,
  gotoWorkspace,
  installFixtureLlmRoutes,
  reclaimIsolatedProject,
  reloadApp,
  setApiBase,
  companionPanel,
  ensureCompanionOpen,
  openCompanionFace,
  ensureBinderOpen,
} from './helpers.mjs'

const require = createRequire('D:/npm-global/node_modules/playwright/package.json')
const pwRoot = dirname(require.resolve('playwright/package.json'))
const { chromium } = await import(pathToFileURL(resolve(pwRoot, 'index.mjs')).href)
const OUT = 'e2e/output/bf'
mkdirSync(OUT, { recursive: true })

async function putSeeded() {
  const cur = await fetchActiveProject()
  const body = {
    ...cur,
    chapters: [{ id: 'chapter-1', title: '', body: '', craftTags: [], revision: 1 }],
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
  if (!res.ok) throw new Error(await res.text())
}

async function activeInfo(page) {
  return page.evaluate(() => {
    const a = document.activeElement
    const body = document.querySelector('.manuscript__body')
    const title = document.querySelector('.manuscript__title')
    const drawers = [...document.querySelectorAll('.ui-drawer, [role="dialog"]')].map((d) => ({
      name: d.getAttribute('aria-label'),
      cls: String(d.className).slice(0, 60),
      open: getComputedStyle(d).display !== 'none' && d.getClientRects().length > 0,
    }))
    const primaries = [...document.querySelectorAll('button.ui-button--primary')]
      .filter((b) => b.getClientRects().length)
      .map((b) => (b.textContent || '').replace(/\s+/g, ' ').trim())
    const backdrops = document.querySelectorAll('.ui-drawer__backdrop').length
    return {
      active: a
        ? {
            tag: a.tagName,
            name: a.getAttribute('aria-label') || a.getAttribute('placeholder') || (a.textContent || '').trim().slice(0, 60),
            cls: String(a.className || '').slice(0, 80),
          }
        : null,
      bodyActive: a === body,
      titleActive: a === title,
      titleVal: title?.value ?? null,
      bodyLen: body?.value?.length ?? null,
      drawers,
      primaries,
      backdrops,
      main: document.querySelector('main')?.getAttribute('aria-label'),
    }
  })
}

const stack = await ownMeasurementStack({ skipBuild: process.env.STORYLINT_SKIP_BUILD === '1' })
setApiBase(stack.api)
process.env.BF_API = stack.api
const browser = await chromium.launch({ channel: 'msedge', headless: true })
const out = { head: stack.shortHead, checks: [] }

try {
  // --- A: pure reload body focus @1440, no binder/companion open ---
  {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
    await installFixtureLlmRoutes(page)
    await page.goto(stack.ui, { waitUntil: 'domcontentloaded' })
    const id = await ensureIsolatedProject(page, { title: 'BF focus' })
    await reclaimIsolatedProject(id)
    await putSeeded()
    // Install focus logger BEFORE reload
    await page.evaluate(() => {
      window.__log = []
      document.addEventListener(
        'focusin',
        (e) => {
          const t = e.target
          window.__log.push({
            t: Math.round(performance.now()),
            tag: t.tagName,
            id: t.id,
            name: t.getAttribute('aria-label') || t.getAttribute('placeholder') || (t.className || '').toString().slice(0, 40),
          })
        },
        true,
      )
    })
    await reloadApp(page, { ready: '.manuscript__body' })
    await page.waitForTimeout(600)
    const a1 = await activeInfo(page)
    const log1 = await page.evaluate(() => window.__log || [])
    // Do NOT click Draft. Just measure.
    out.checks.push({ id: 'A-pure-reload-1440', a1, log1: log1.slice(0, 30) })

    // First Tab from body (if body focused) or from nothing
    await page.keyboard.press('Tab')
    await page.waitForTimeout(50)
    out.checks.push({ id: 'A-first-tab-after-load', info: await activeInfo(page) })

    // Click Draft ecosystem (simulates author / gotoWorkspace) then see if body recovers
    await page.getByRole('button', { name: 'Draft', exact: true }).click()
    await page.waitForTimeout(200)
    out.checks.push({ id: 'A-after-draft-click', info: await activeInfo(page) })

    // Click body manually
    await page.locator('.manuscript__body').click()
    out.checks.push({ id: 'A-after-body-click', info: await activeInfo(page) })

    // Continuity gate
    await ensureCompanionOpen(page)
    await openCompanionFace(companionPanel(page), 'Check', { require: true })
    await page.waitForTimeout(150)
    out.checks.push({ id: 'A-check-empty', info: await activeInfo(page), run: await page.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find((x) => /Run Continuity/.test(x.textContent || ''))
      if (!b) return null
      return { text: b.textContent.trim(), disabled: b.disabled, cls: b.className }
    }) })

    await page.close()
  }

  // --- B: phone empty create with drawers dismissed ---
  {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
    await installFixtureLlmRoutes(page)
    await page.goto(stack.ui, { waitUntil: 'domcontentloaded' })
    const id = await ensureIsolatedProject(page, { id: `bf-ph-empty-${Date.now().toString(36)}`, title: 'BF ph empty' })
    await reloadApp(page)
    await reclaimIsolatedProject(id)
    await assertActiveProject(id, { page })
    await dismissDrawers(page)
    await page.waitForTimeout(200)
    let info = await activeInfo(page)
    out.checks.push({ id: 'B-empty-390-rest', info })

    // Center Write door without binder open
    const write = page.getByRole('button', { name: /^Write$/ }).or(page.getByRole('button', { name: /Write first chapter/i }))
    if (await write.count()) {
      await write.first().click({ timeout: 5000 })
      await page.waitForTimeout(400)
      info = await activeInfo(page)
      out.checks.push({ id: 'B-after-write', info })
    } else {
      // open binder, new chapter, dismiss
      await ensureBinderOpen(page)
      await page.getByRole('button', { name: /New chapter/i }).click()
      await page.waitForTimeout(300)
      await dismissDrawers(page)
      info = await activeInfo(page)
      out.checks.push({ id: 'B-after-new-chapter', info })
    }

    // Lab with drawers dismissed
    await gotoWorkspace(page, 'lab')
    await dismissDrawers(page)
    await page.waitForTimeout(200)
    await page.getByLabel('Lab card title').fill('Phone spark')
    await page.getByRole('button', { name: 'New card' }).click({ timeout: 5000 })
    await page.waitForTimeout(300)
    const labN = await page.locator('.lab__card').count()
    out.checks.push({ id: 'B-lab-new-card', labN, info: await activeInfo(page) })

    await page.close()
  }

  // --- C: phone seeded body focus pure + binder open steal ---
  {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
    await installFixtureLlmRoutes(page)
    await page.goto(stack.ui, { waitUntil: 'domcontentloaded' })
    const id = await ensureIsolatedProject(page, { title: 'BF ph seed' })
    await putSeeded()
    await page.evaluate(() => {
      window.__log = []
      document.addEventListener('focusin', (e) => {
        const t = e.target
        window.__log.push({
          t: Math.round(performance.now()),
          tag: t.tagName,
          name: t.getAttribute('aria-label') || t.getAttribute('placeholder') || String(t.className || '').slice(0, 40),
        })
      }, true)
    })
    await reloadApp(page, { ready: '.manuscript__body' })
    await page.waitForTimeout(600)
    await dismissDrawers(page)
    await page.waitForTimeout(100)
    out.checks.push({ id: 'C-seeded-390-dismissed', info: await activeInfo(page), log: (await page.evaluate(() => window.__log || [])).slice(0, 25) })

    await ensureBinderOpen(page)
    await page.waitForTimeout(200)
    out.checks.push({ id: 'C-seeded-390-binder-open', info: await activeInfo(page) })
    await dismissDrawers(page)

    // dual open: binder + companion — can we click body?
    await ensureBinderOpen(page)
    await ensureCompanionOpen(page)
    await page.waitForTimeout(200)
    const dual = await activeInfo(page)
    let bodyClickErr = null
    try {
      await page.locator('.manuscript__body').click({ timeout: 3000 })
    } catch (e) {
      bodyClickErr = String(e.message || e).slice(0, 200)
    }
    out.checks.push({ id: 'C-dual-drawer-body-click', dual, bodyClickErr, after: await activeInfo(page) })

    await page.close()
  }

  // --- D: new chapter default title ---
  {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
    await installFixtureLlmRoutes(page)
    await page.goto(stack.ui, { waitUntil: 'domcontentloaded' })
    const id = await ensureIsolatedProject(page, { id: `bf-title-${Date.now().toString(36)}`, title: 'BF title' })
    await reloadApp(page)
    await reclaimIsolatedProject(id)
    await dismissDrawers(page)
    await page.getByRole('button', { name: /New chapter|Write/i }).first().click()
    await page.waitForTimeout(400)
    const proj = await fetchActiveProject()
    out.checks.push({
      id: 'D-new-chapter-title',
      chapters: (proj.chapters || []).map((c) => ({ title: c.title, bodyLen: (c.body || '').length })),
      ui: await activeInfo(page),
    })
    await page.close()
  }
} finally {
  await browser.close()
  await stack.stop()
}

writeFileSync(`${OUT}/recheck.json`, JSON.stringify(out, null, 2))
console.log(JSON.stringify(out, null, 2))
