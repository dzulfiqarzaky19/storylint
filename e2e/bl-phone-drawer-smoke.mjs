/**
 * TASK BL smoke — phone drawer must not silently eat job-surface taps @390.
 *
 * Choice: dismiss-on-outside-tap (nav sheet, not decision modal).
 * Contract kept: focus trap, Escape closes, focus restore (Drawer.tsx).
 *
 * Standalone: owns measurement stack.
 * Under all-smoke/land: inherits STORYLINT_UI + STORYLINT_API.
 *
 * node e2e/bl-phone-drawer-smoke.mjs
 */
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { mkdirSync, writeFileSync } from 'node:fs'
import { ownMeasurementStack } from './owned-stack.mjs'
import {
  assertActiveProject,
  dismissDrawers,
  ensureBinderOpen,
  ensureCompanionOpen,
  ensureDraftReady,
  ensureIsolatedProject,
  reclaimIsolatedProject,
  reloadApp,
  requireApiOrigin,
  requireUiOrigin,
  setApiBase,
} from './helpers.mjs'

const require = createRequire('D:/npm-global/node_modules/playwright/package.json')
const pwRoot = dirname(require.resolve('playwright/package.json'))
const { chromium } = await import(pathToFileURL(resolve(pwRoot, 'index.mjs')).href)

const OUT = 'e2e/output/bl-phone-drawer'
mkdirSync(OUT, { recursive: true })

let stop = async () => {}
let head = process.env.STORYLINT_HEAD || 'unknown'
let UI
if (process.env.STORYLINT_UI && process.env.STORYLINT_API) {
  setApiBase(process.env.STORYLINT_API)
  UI = requireUiOrigin()
  requireApiOrigin()
} else {
  const stack = await ownMeasurementStack({ skipBuild: process.env.STORYLINT_SKIP_BUILD === '1' })
  setApiBase(stack.api)
  UI = stack.ui
  head = stack.shortHead
  stop = stack.stop
}

const browser = await chromium.launch({ channel: 'msedge', headless: true })
const out = {
  head,
  choice: 'dismiss-on-outside-tap',
  why: 'Binder/Companion are navigation sheets on phone, not decision modals. Silent intercept is the failure mode.',
  checks: [],
  failed: [],
}

function fail(id, detail) {
  out.failed.push({ id, detail })
  out.checks.push({ id, ok: false, detail })
  console.error('FAIL', id, detail)
}

function pass(id, detail = {}) {
  out.checks.push({ id, ok: true, ...detail })
  console.log('PASS', id, typeof detail === 'object' ? JSON.stringify(detail) : detail)
}

async function drawerOpen(page) {
  return page.evaluate(() => document.querySelectorAll('.ui-drawer').length > 0)
}

async function geom(page) {
  return page.evaluate(() => {
    const body = document.querySelector('.manuscript__body')
    const drawer = document.querySelector('.ui-drawer')
    const br = body?.getBoundingClientRect()
    const dr = drawer?.getBoundingClientRect()
    const cx = br ? Math.round(br.left + br.width / 2) : Math.round(innerWidth / 2)
    const cy = br ? Math.round(br.top + br.height / 2) : Math.round(innerHeight / 2)
    const top = document.elementFromPoint(cx, cy)
    return {
      bodyCenter: { cx, cy },
      topClass: String(top?.className || '').slice(0, 80),
      topIsBackdrop: top?.classList?.contains('ui-drawer__backdrop') === true,
      topIsDrawer: Boolean(top?.closest?.('.ui-drawer')),
      drawerW: dr ? Math.round(dr.width) : null,
      bodyW: br ? Math.round(br.width) : null,
      vpW: innerWidth,
    }
  })
}

try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
  page.setDefaultTimeout(12_000)
  await page.goto(UI, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('.shell')

  const id = await ensureIsolatedProject(page, { title: 'BL smoke' })
  await reloadApp(page)
  await reclaimIsolatedProject(id)
  await assertActiveProject(id, { page })
  await ensureDraftReady(page, { body: 'BL smoke prose for drawer outside tap.\n\nSecond line.' })
  await page.waitForSelector('.manuscript__body', { timeout: 8000 })
  await dismissDrawers(page)

  // --- 1. Companion open: body-center must hit backdrop (or paper), not panel ---
  await ensureCompanionOpen(page)
  await page.waitForTimeout(200)
  const g1 = await geom(page)
  if (g1.topIsDrawer && !g1.topIsBackdrop) fail('companion-body-center-free', g1)
  else pass('companion-body-center-free', g1)

  // Click body center → must dismiss drawer (backdrop onClick)
  let bodyClickErr = null
  try {
    await page.locator('.manuscript__body').click({ timeout: 3000 })
  } catch (e) {
    // Center may be backdrop (correct). Click coords so dismiss fires.
    bodyClickErr = String(e.message || e).slice(0, 120)
    await page.mouse.click(g1.bodyCenter.cx, g1.bodyCenter.cy)
  }
  await page.waitForTimeout(200)
  if (await drawerOpen(page)) {
    fail('companion-outside-dismisses', { bodyClickErr, after: await geom(page) })
  } else {
    pass('companion-outside-dismisses', { via: bodyClickErr ? 'coords' : 'locator' })
  }

  // Body must be focusable after dismiss
  await page.locator('.manuscript__body').click({ timeout: 3000 })
  const focused = await page.evaluate(() => document.activeElement?.classList?.contains('manuscript__body'))
  if (!focused) fail('body-focus-after-dismiss', { focused })
  else pass('body-focus-after-dismiss')

  // --- 2. Escape still closes ---
  await ensureCompanionOpen(page)
  await page.waitForTimeout(150)
  if (!(await drawerOpen(page))) fail('escape-setup', 'companion did not open')
  else {
    await page.keyboard.press('Escape')
    await page.waitForTimeout(150)
    if (await drawerOpen(page)) fail('escape-closes', 'drawer still open')
    else pass('escape-closes')
  }

  // --- 3. Binder open: body center free + outside dismiss ---
  await dismissDrawers(page)
  await ensureBinderOpen(page)
  await page.waitForTimeout(200)
  const g3 = await geom(page)
  if (g3.topIsDrawer && !g3.topIsBackdrop) fail('binder-body-center-free', g3)
  else pass('binder-body-center-free', g3)

  await page.mouse.click(g3.bodyCenter.cx, g3.bodyCenter.cy)
  await page.waitForTimeout(200)
  if (await drawerOpen(page)) fail('binder-outside-dismisses', await geom(page))
  else pass('binder-outside-dismisses')

  // --- 4. Binder chapter select closes drawer (nav complete) ---
  await ensureBinderOpen(page)
  await page.waitForTimeout(150)
  const chapter = page.locator('.binder__chapter-list button, .binder__chapter-list [role="button"], [data-binder-chapter]').first()
  if ((await chapter.count()) === 0) fail('binder-select-setup', 'no chapter row')
  else {
    await chapter.click()
    await page.waitForTimeout(200)
    if (await drawerOpen(page)) fail('binder-select-closes', await geom(page))
    else pass('binder-select-closes')
  }

  // --- 5. Topbar Hide companion reachable while open ---
  await ensureCompanionOpen(page)
  await page.waitForTimeout(150)
  const hide = page.getByRole('button', { name: /Hide companion/i }).first()
  try {
    await hide.click({ timeout: 3000 })
    await page.waitForTimeout(150)
    if (await drawerOpen(page)) fail('topbar-hide-reachable', 'still open after Hide')
    else pass('topbar-hide-reachable')
  } catch (e) {
    fail('topbar-hide-reachable', String(e.message || e).slice(0, 200))
  }

  await page.screenshot({ path: `${OUT}/smoke-final.png` }).catch(() => {})
} finally {
  writeFileSync(`${OUT}/smoke.json`, JSON.stringify(out, null, 2))
  await browser.close().catch(() => {})
  await stop()
}

if (out.failed.length) {
  console.error(`BL smoke FAILED ${out.failed.length}/${out.checks.length}`)
  process.exit(1)
}
console.log(`BL smoke PASS ${out.checks.length} checks @ ${out.head}`)
