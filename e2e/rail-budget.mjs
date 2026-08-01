/**
 * D1 — rail budget measurement.
 * Measures binder / work / companion width share across widths + surfaces.
 *
 *   node e2e/rail-budget.mjs           → e2e/output/rail-budget/after.json
 *   node e2e/rail-budget.mjs before    → e2e/output/rail-budget/before.json
 *
 * Two modes per width:
 *   default — whatever the shell opens on its own (the state most sessions see)
 *   both    — binder + companion forced open (the worst case)
 * Env: RAIL_UI=http://localhost:5174/ to point at a non-default dev server.
 */
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { mkdirSync, writeFileSync } from 'node:fs'

const require = createRequire('D:/npm-global/node_modules/playwright/package.json')
const pwRoot = dirname(require.resolve('playwright/package.json'))
const { chromium } = await import(pathToFileURL(resolve(pwRoot, 'index.mjs')).href)

const OUT = 'e2e/output/rail-budget'
mkdirSync(OUT, { recursive: true })

const label = (process.argv[2] || 'after').replace(/[^a-z0-9-]/gi, '')
const UI = process.env.RAIL_UI || 'http://localhost:5173/'
const tag = Date.now().toString(36).slice(-4)
const WIDTHS = [1280, 1440, 1680, 1920]
const rows = []

async function createProject(page, title) {
  await page.getByRole('button', { name: 'Project menu' }).click()
  await page.getByRole('menuitem', { name: 'New project' }).click()
  await page.getByLabel('New project title').fill(title)
  await page.getByRole('button', { name: 'Create', exact: true }).click()
  await page.waitForTimeout(900)
}

async function setRail(page, which, open) {
  const re = which === 'binder' ? /Show binder|Hide binder/i : /Show companion|Hide companion/i
  const btn = page.getByRole('button', { name: re }).first()
  if (!(await btn.count())) return
  const aria = (await btn.getAttribute('aria-label')) || ''
  const isOpen = /^Hide/i.test(aria)
  if (open !== isOpen) {
    await btn.click()
    await page.waitForTimeout(250)
  }
}

async function goMode(page, name) {
  const btn = page.getByRole('button', { name, exact: true }).first()
  if ((await btn.count()) && (await btn.isVisible().catch(() => false))) {
    await btn.click()
    await page.waitForTimeout(400)
    return true
  }
  return false
}

function measureFn(surfaceName) {
  const vw = window.innerWidth
  const box = (sel) => {
    const el = document.querySelector(sel)
    if (!el) return null
    const r = el.getBoundingClientRect()
    if (getComputedStyle(el).display === 'none' || (r.width === 0 && r.height === 0)) return null
    return { w: Math.round(r.width), h: Math.round(r.height) }
  }
  const binder = box('.shell__rail--binder')
  const agent = box('.shell__rail--agent')
  const work = box('#workspace')
  const paper = box('.manuscript__sheet')
  const chromeW = (binder?.w || 0) + (agent?.w || 0)
  const pct = (n) => Math.round((n / vw) * 1000) / 10
  const clipped = (sel) =>
    [...document.querySelectorAll(sel)].filter((el) => el.scrollWidth > el.clientWidth + 1).length
  return {
    surface: surfaceName,
    vw,
    binderPx: binder?.w || 0,
    agentPx: agent?.w || 0,
    workPx: work?.w || 0,
    paperPx: paper?.w || 0,
    binderPct: pct(binder?.w || 0),
    agentPct: pct(agent?.w || 0),
    workPct: pct(work?.w || 0),
    chromePct: pct(chromeW),
    paperPct: pct(paper?.w || 0),
    overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    binderRows: document.querySelectorAll('.shell__rail--binder .ui-list-row__label').length,
    binderRowsClipped: clipped('.shell__rail--binder .ui-list-row__label'),
    agentClipped: clipped('.shell__rail--agent button'),
  }
}

const browser = await chromium.launch({ channel: 'msedge', headless: true })
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  page.setDefaultTimeout(12000)
  // never networkidle on owned stacks — companion/LLM sockets burn ~30s
  await page.goto(UI, { waitUntil: 'domcontentloaded', timeout: 30_000 })
  await createProject(page, `Rail ${label} ${tag}`)

  const writeDoor = page.getByRole('button', { name: 'Write', exact: true }).first()
  if (await writeDoor.count()) {
    await writeDoor.click()
    await page.waitForTimeout(600)
  }
  const editor = page.locator('.manuscript__body, [contenteditable="true"], textarea').first()
  if (await editor.count()) {
    await editor.click()
    await page.keyboard.type('Kael entered the breach at dawn. Mira waited in the tower.', { delay: 3 })
    await page.waitForTimeout(700)
  }

  for (const width of WIDTHS) {
    // a fresh load per width so "default" reflects a real session start, not a resize
    await page.setViewportSize({ width, height: 900 })
    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(500)

    for (const rails of ['default', 'both']) {
      if (rails === 'both') {
        await setRail(page, 'binder', true)
        await setRail(page, 'agent', true)
      }
      for (const mode of ['Draft', 'Lab', 'Canon']) {
        await goMode(page, mode)
        await page.waitForTimeout(250)
        const name = `${mode.toLowerCase()}__${width}__${rails}`
        const m = await page.evaluate(measureFn, name)
        m.rails = rails
        rows.push(m)
        console.log(
          `${label} ${name}: binder=${m.binderPx}/${m.binderPct}% work=${m.workPx}/${m.workPct}% agent=${m.agentPx}/${m.agentPct}% chrome=${m.chromePct}% paper=${m.paperPx} clip=${m.binderRowsClipped}/${m.binderRows} overflow=${m.overflow}`,
        )
        if (mode === 'Draft') {
          await page.screenshot({ path: `${OUT}/${label}__draft__${width}__${rails}.png` })
        }
      }
    }
  }
} finally {
  await browser.close()
}

writeFileSync(`${OUT}/${label}.json`, JSON.stringify({ label, at: new Date().toISOString(), rows }, null, 2))
console.log('WROTE', `${OUT}/${label}.json`)
