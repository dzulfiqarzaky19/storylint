/**
 * T-010 — resting companion face row must fit five writing faces with a
 * 2-digit Inbox badge at the desk agent rail (272px floor). Measured geometry.
 *
 * Standalone owns the stack; under all-smoke inherits STORYLINT_UI/API.
 * node e2e/t010-face-row-fit-smoke.mjs
 */
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { mkdirSync, writeFileSync } from 'node:fs'
import { ownMeasurementStack } from './owned-stack.mjs'
import {
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

const OUT = 'e2e/output/t010-face-row-fit'
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
  ticket: 'T-010',
  checks: [],
  failed: [],
}

function fail(id, detail) {
  out.failed.push({ id, detail })
  out.checks.push({ id, ok: false, detail })
  console.error('FAIL', id, typeof detail === 'object' ? JSON.stringify(detail) : detail)
}

function pass(id, detail = {}) {
  out.checks.push({ id, ok: true, ...detail })
  console.log('PASS', id, typeof detail === 'object' ? JSON.stringify(detail) : detail)
}

/** Seed N pending proposals so the Inbox badge is 2 digits. */
async function seedPendingProposals(page, count = 12) {
  const result = await page.evaluate(async (n) => {
    const p = await fetch('/api/project').then((r) => r.json())
    const chapterId = p.chapters?.[0]?.id || 'chapter-1'
    const proposals = []
    for (let i = 0; i < n; i += 1) {
      proposals.push({
        id: `t010-prop-${i}`,
        fingerprint: `t010-fp-${i}`,
        status: 'pending',
        entityName: `Entity ${i}`,
        sheetKind: 'character',
        key: `t010.key.${i}`,
        value: String(i),
        statement: `T010 pending ${i}`,
        claimKind: 'attribute',
        confidence: 0.8,
        source: { chapterId, start: 0, end: 1, text: 'A' },
      })
    }
    const put = await fetch('/api/project', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...p, proposals }),
    })
    const body = await put.text()
    return { ok: put.ok, status: put.status, body: body.slice(0, 300), n }
  }, count)
  if (!result.ok) {
    throw new Error(`seed pending proposals failed ${result.status}: ${result.body}`)
  }
  return result
}

async function measureRestingFaces(page) {
  return page.evaluate(() => {
    const root = document.querySelector('.companion__faces')
    if (!root) return { error: 'no .companion__faces' }
    // Resting: no face selected, no scroll.
    root.scrollLeft = 0
    const rootRect = root.getBoundingClientRect()
    const cs = getComputedStyle(root)
    const padL = parseFloat(cs.paddingLeft) || 0
    const padR = parseFloat(cs.paddingRight) || 0
    const leftBound = rootRect.left + padL
    const rightBound = rootRect.right - padR
    const tabs = [...root.querySelectorAll('[role="tab"]')]
    const labels = tabs.map((tab) => {
      const r = tab.getBoundingClientRect()
      const name = (tab.getAttribute('aria-label') || tab.textContent || '').replace(/\s+/g, ' ').trim()
      const clippedLeft = r.left < leftBound - 0.5
      const clippedRight = r.right > rightBound + 0.5
      return {
        name,
        left: Math.round(r.left * 10) / 10,
        right: Math.round(r.right * 10) / 10,
        width: Math.round(r.width * 10) / 10,
        clippedLeft,
        clippedRight,
        clipped: clippedLeft || clippedRight,
      }
    })
    const research = labels.find((l) => /^Research/i.test(l.name))
    const inbox = labels.find((l) => /^Inbox/i.test(l.name))
    const overflowPx = root.scrollWidth - root.clientWidth
    return {
      scrollLeft: root.scrollLeft,
      scrollWidth: root.scrollWidth,
      clientWidth: root.clientWidth,
      overflowPx,
      leftBound: Math.round(leftBound * 10) / 10,
      rightBound: Math.round(rightBound * 10) / 10,
      tabCount: tabs.length,
      labels,
      research,
      inbox,
      badgeText: inbox
        ? (document.querySelector('.companion__inbox-count')?.textContent || '').trim()
        : '',
    }
  })
}

function assertFit(id, m) {
  if (m.error) {
    fail(id, m)
    return false
  }
  if (m.tabCount < 5) {
    fail(id, { reason: 'expected 5 writing faces', ...m })
    return false
  }
  if (!m.research) {
    fail(id, { reason: 'Research tab missing', ...m })
    return false
  }
  if (!m.inbox) {
    fail(id, { reason: 'Inbox tab missing', ...m })
    return false
  }
  if (m.overflowPx > 1) {
    fail(id, { reason: 'faces row overflows at rest', ...m })
    return false
  }
  const clipped = m.labels.filter((l) => l.clipped)
  if (clipped.length) {
    fail(id, { reason: 'tab(s) clipped at rest', clipped, ...m })
    return false
  }
  if (m.research.clippedRight || m.research.clippedLeft) {
    fail(id, { reason: 'Research clipped at rest', ...m })
    return false
  }
  pass(id, {
    overflowPx: m.overflowPx,
    badgeText: m.badgeText,
    researchRight: m.research.right,
    rightBound: m.rightBound,
    inboxWidth: m.inbox.width,
  })
  return true
}

const page = await browser.newPage({ viewport: { width: 1366, height: 900 } })
let projectId
try {
  projectId = await ensureIsolatedProject(page, { id: `e2e-t010-${Date.now().toString(36)}`, title: 'T010 Face Row' })
  await page.goto(UI, { waitUntil: 'domcontentloaded' })
  await ensureDraftReady(page, { body: 'Aria opened the iron door and Research stayed fully visible.', title: 'T010' })
  await ensureCompanionOpen(page)
  await seedPendingProposals(page, 12)
  await reloadApp(page)
  await ensureCompanionOpen(page)
  // Writing context: draft open; faces should be Chat Write Check Research Inbox.
  await page.waitForSelector('.companion__faces [role="tab"]', { timeout: 15000 })
  // Badge must show 2-digit count (or capped form).
  await page.waitForFunction(() => {
    const el = document.querySelector('.companion__inbox-count')
    return el && /\d/.test(el.textContent || '')
  }, { timeout: 15000 })

  const desk = await measureRestingFaces(page)
  writeFileSync(`${OUT}/desk-resting.json`, JSON.stringify(desk, null, 2))
  assertFit('desk-resting-2digit-badge', desk)
  if (!desk.badgeText || Number.parseInt(desk.badgeText, 10) < 10) {
    // still pass fit, but flag seed weakness
    fail('desk-badge-2digit', { badgeText: desk.badgeText, desk })
  } else {
    pass('desk-badge-2digit', { badgeText: desk.badgeText })
  }

  // Phone companion is a ~40vw drawer (BL). Resting full-label fit is a desk-rail contract.
  // On phone we only require: badge present, scroll discovers Research (no hidden overflow).
  await page.setViewportSize({ width: 390, height: 844 })
  await page.waitForTimeout(200)
  await ensureCompanionOpen(page)
  const phone = await measureRestingFaces(page)
  writeFileSync(`${OUT}/phone-resting.json`, JSON.stringify(phone, null, 2))
  if (phone.error || !phone.inbox || !phone.research) {
    fail('phone-faces-present', phone)
  } else if (!phone.badgeText) {
    fail('phone-badge-present', phone)
  } else {
    // scrollWidth > client is expected in 40vw drawer; thin scrollbar is the affordance.
    const canScroll = phone.overflowPx > 0
    const scrollbar = await page.evaluate(() => {
      const root = document.querySelector('.companion__faces')
      return root ? getComputedStyle(root).scrollbarWidth : ''
    })
    if (canScroll && scrollbar === 'none') {
      fail('phone-overflow-discoverable', { scrollbar, ...phone })
    } else {
      pass('phone-badge-and-scroll-affordance', {
        badgeText: phone.badgeText,
        overflowPx: phone.overflowPx,
        scrollbar,
        clientWidth: phone.clientWidth,
      })
    }
  }

  // Unbounded growth defense: 120 pending renders as 99+, not three raw digits that blow the row.
  await page.setViewportSize({ width: 1366, height: 900 })
  await seedPendingProposals(page, 120)
  await reloadApp(page)
  await ensureCompanionOpen(page)
  await page.waitForSelector('.companion__inbox-count', { timeout: 15000 })
  const capped = await page.evaluate(() => (document.querySelector('.companion__inbox-count')?.textContent || '').trim())
  const deskCap = await measureRestingFaces(page)
  writeFileSync(`${OUT}/desk-capped.json`, JSON.stringify({ capped, ...deskCap }, null, 2))
  if (capped !== '99+') {
    fail('badge-cap-99plus', { capped, expected: '99+' })
  } else {
    pass('badge-cap-99plus', { capped })
  }
  assertFit('desk-resting-capped-badge', deskCap)

  if (projectId) await reclaimIsolatedProject(projectId)
} catch (err) {
  fail('smoke-exception', String(err && err.stack ? err.stack : err))
} finally {
  writeFileSync(`${OUT}/result.json`, JSON.stringify(out, null, 2))
  await page.close().catch(() => {})
  await browser.close().catch(() => {})
  await stop().catch(() => {})
}

if (out.failed.length) {
  console.error(`T-010 FAIL ${out.failed.length} check(s)`)
  process.exit(1)
}
console.log('PASS: T-010 resting face row fits with 2-digit / capped Inbox badge (geometry)')
process.exit(0)
