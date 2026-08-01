/**
 * MANUAL DIAGNOSTIC — live focus-ring pass @1440
 *
 * MANUAL DIAGNOSTIC — not part of the green suite (test:green / ALL_FEATURE_SMOKES).
 * NOT part of the green suite. Owned-stack keyboard focus-visible sample.
 * Run: node e2e/focus-ring-pass.mjs
 */

import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { mkdirSync, writeFileSync } from 'node:fs'
import { ownMeasurementStack } from './owned-stack.mjs'

const require = createRequire('D:/npm-global/node_modules/playwright/package.json')
const pwRoot = dirname(require.resolve('playwright/package.json'))
const { chromium } = await import(pathToFileURL(resolve(pwRoot, 'index.mjs')).href)

const OUT = 'e2e/output/focus-ring'
mkdirSync(OUT, { recursive: true })

const ACTIVE_PROBE = () => {
  const el = document.activeElement
  if (!el || el === document.body || el === document.documentElement) {
    return { ok: false, reason: 'no active control' }
  }
  const cs = getComputedStyle(el)
  const hasOutline = cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0
  const hasBox = Boolean(cs.boxShadow && cs.boxShadow !== 'none')
  return {
    ok: hasOutline || hasBox,
    name: (el.getAttribute('aria-label') || el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 80),
    role: el.getAttribute('role'),
    className: String(el.className || '').slice(0, 120),
    tag: el.tagName,
    focusVisible: typeof el.matches === 'function' ? el.matches(':focus-visible') : null,
    outline: `${cs.outlineStyle} ${cs.outlineWidth} ${cs.outlineColor}`,
    boxShadow: cs.boxShadow,
  }
}

const stack = await ownMeasurementStack({ skipBuild: process.env.STORYLINT_SKIP_BUILD === '1' })
const browser = await chromium.launch({ channel: 'msedge', headless: true })
const findings = []
const shots = []

function record(id, probe, note = '') {
  findings.push({ id, ...probe, note })
  console.log(`${probe.ok ? 'PASS' : 'FAIL'} ${id}`, probe.name || probe.reason || '', probe.outline || '', note)
}

async function shot(page, name) {
  const path = `${OUT}/${name}.png`
  await page.screenshot({ path, fullPage: false })
  shots.push(path)
  console.log('SHOT', path)
}

async function tabUntil(page, predicate, max = 40) {
  for (let i = 0; i < max; i++) {
    await page.keyboard.press('Tab')
    const meta = await page.evaluate(() => {
      const el = document.activeElement
      return {
        label: el?.getAttribute('aria-label') || '',
        text: (el?.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 80),
        role: el?.getAttribute('role') || '',
        className: String(el?.className || ''),
      }
    })
    if (predicate(meta)) return meta
  }
  return null
}

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  page.setDefaultTimeout(15_000)
  // never networkidle on owned stacks — companion/LLM sockets burn ~30s
  await page.goto(stack.ui, { waitUntil: 'domcontentloaded', timeout: 30_000 })
  await page.waitForSelector('.shell')

  await page.keyboard.press('Tab')
  await page.waitForTimeout(50)
  record('first-tab', await page.evaluate(ACTIVE_PROBE))
  await shot(page, '01-first-tab')

  const binderToggle = page.getByRole('button', { name: /Show binder|Hide binder/i }).first()
  const agentToggle = page.getByRole('button', { name: /Show companion|Hide companion/i }).first()

  async function ensureOpen(toggle, showRe) {
    const label = (await toggle.getAttribute('aria-label')) || ''
    if (showRe.test(label)) {
      await toggle.click()
      await page.waitForTimeout(200)
    }
  }
  await ensureOpen(binderToggle, /Show binder/i)
  await ensureOpen(agentToggle, /Show companion/i)

  await page.mouse.click(2, 2)
  let hit = await tabUntil(page, (m) => /binder/i.test(m.label))
  record('binder-toggle', await page.evaluate(ACTIVE_PROBE), hit ? '' : 'tab miss')
  await shot(page, '02-binder-toggle')

  hit = await tabUntil(page, (m) => /companion/i.test(m.label))
  record('companion-toggle', await page.evaluate(ACTIVE_PROBE), hit ? '' : 'tab miss')
  await shot(page, '03-companion-toggle')

  await page.mouse.click(2, 2)
  hit = await tabUntil(page, (m) => m.text === 'Draft' || m.text === 'Lab' || m.text === 'Canon')
  record('ecosystem-place', await page.evaluate(ACTIVE_PROBE), hit ? '' : 'tab miss')
  await shot(page, '04-ecosystem')

  await page.getByRole('button', { name: 'Draft', exact: true }).first().click().catch(() => {})
  await page.waitForTimeout(250)
  await ensureOpen(agentToggle, /Show companion/i)
  await page.locator('.panel[data-companion-context] .panel__title').click({ position: { x: 4, y: 4 } }).catch(() => {})
  hit = await tabUntil(page, (m) => m.role === 'tab' || /Chat|Write|Check|Inbox|Research/i.test(m.text))
  record('companion-face-tab', await page.evaluate(ACTIVE_PROBE), hit ? '' : 'tab miss')
  await shot(page, '05-face-tab')

  const hasResearch = await page.locator('.companion__faces [role="tab"]').filter({ hasText: /^Research$/ }).count()
  if (hasResearch) {
    await page.evaluate(() => {
      document.querySelector('.companion__faces [role="tab"]')?.focus()
    })
    for (let i = 0; i < 8; i++) {
      const text = await page.evaluate(() => (document.activeElement?.textContent || '').trim())
      if (/^Research/.test(text)) break
      await page.keyboard.press('ArrowRight')
    }
    let probe = await page.evaluate(ACTIVE_PROBE)
    if (!probe.ok || !/^Research/.test(probe.name || '')) {
      await page.mouse.click(2, 2)
      hit = await tabUntil(page, (m) => /^Research/.test(m.text))
      probe = await page.evaluate(ACTIVE_PROBE)
    }
    record('research-secondary', probe)
    await shot(page, '06-research')
  } else {
    record('research-secondary', { ok: false, reason: 'no Research tab in writing context' })
  }

  // Canon sheet detail path for Back ring
  await page.getByRole('button', { name: 'Canon', exact: true }).first().click()
  await page.waitForTimeout(450)
  await ensureOpen(binderToggle, /Show binder/i)

  const canonSheetRow = page.locator('.shell__rail--binder .binder__canon-kind .ui-list-row').first()
  const newSheetBtn = page.locator('.shell__rail--binder').getByRole('button', { name: 'New sheet', exact: true }).first()
  let openedDetail = false

  if (await canonSheetRow.count()) {
    await page.locator('.shell__rail--binder #binder-canon').click({ position: { x: 4, y: 4 } }).catch(() => {})
    hit = await tabUntil(page, (m) => m.className.includes('ui-list-row') && !m.className.includes('binder__chapter'))
    let rowProbe = await page.evaluate(ACTIVE_PROBE)
    if (!rowProbe.ok || !String(rowProbe.className || '').includes('ui-list-row')) {
      await canonSheetRow.focus()
      await page.keyboard.press('ArrowDown')
      await page.keyboard.press('ArrowUp')
      rowProbe = await page.evaluate(ACTIVE_PROBE)
    }
    record('binder-list-row', rowProbe, 'Canon sheet row')
    await shot(page, '07-binder-row')
    if (await page.evaluate(() => document.activeElement?.classList?.contains('ui-list-row'))) {
      await page.keyboard.press('Enter')
    } else {
      await canonSheetRow.click()
    }
    openedDetail = true
  } else if (await newSheetBtn.count()) {
    await page.locator('.shell__rail--binder #binder-canon').click({ position: { x: 4, y: 4 } }).catch(() => {})
    hit = await tabUntil(page, (m) => m.text === 'New sheet')
    let rowProbe = await page.evaluate(ACTIVE_PROBE)
    if (!rowProbe.ok || rowProbe.name !== 'New sheet') {
      await newSheetBtn.focus()
      await page.keyboard.press('Shift')
      rowProbe = await page.evaluate(ACTIVE_PROBE)
    }
    record('binder-list-row', rowProbe, 'via New sheet (no existing sheets)')
    await shot(page, '07-binder-row')
    if ((await page.evaluate(() => (document.activeElement?.textContent || '').trim())) === 'New sheet') {
      await page.keyboard.press('Enter')
    } else {
      await newSheetBtn.click()
    }
    openedDetail = true
  } else {
    record('binder-list-row', { ok: false, reason: 'no Canon sheet rows and no New sheet' })
    await shot(page, '07-binder-empty')
  }

  if (openedDetail) {
    await page.waitForSelector('[data-binder-detail="sheet"]', { timeout: 5000 }).catch(() => null)
    await page.waitForTimeout(200)
    const backBtn = page.getByRole('button', { name: 'Back', exact: true }).first()
    const backVisible = await backBtn.isVisible().catch(() => false)
    if (backVisible) {
      let backProbe = await page.evaluate(ACTIVE_PROBE)
      if (!backProbe.ok || !/^Back$/i.test(backProbe.name || '')) {
        await backBtn.focus()
        await page.keyboard.press('Shift+Tab')
        await page.keyboard.press('Tab')
        backProbe = await page.evaluate(ACTIVE_PROBE)
      }
      record('sheet-back', backProbe)
      await shot(page, '08-sheet-back')
    } else {
      record('sheet-back', { ok: false, reason: 'Back not visible after Canon sheet open' })
    }
  } else {
    record('sheet-back', { ok: false, reason: 'skipped — no Canon sheet open path' })
  }

  const token = await page.evaluate(() => {
    const el = document.createElement('button')
    el.className = 'ui-button ui-focusable'
    el.textContent = 'token'
    document.body.appendChild(el)
    el.focus()
    const fv = el.matches(':focus-visible')
    const cs = getComputedStyle(el)
    const hasOutline = cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0
    const out = {
      ok: true,
      focusVisible: fv,
      hasOutlineWhenFv: fv ? hasOutline : null,
      outline: `${cs.outlineStyle} ${cs.outlineWidth} ${cs.outlineColor}`,
      note: fv
        ? hasOutline
          ? 'token paints under :focus-visible'
          : 'TOKEN GAP: focus-visible without outline'
        : 'engine withheld :focus-visible on synthetic focus (not a product fail)',
    }
    if (fv && !hasOutline) out.ok = false
    el.remove()
    return out
  })
  record('ui-focusable-token', token, token.note)

  const report = {
    head: stack.head,
    shortHead: stack.shortHead,
    dirty: stack.dirty,
    ui: stack.ui,
    viewport: { width: 1440, height: 900 },
    shots,
    findings,
    pass: findings.filter((f) => f.ok).length,
    fail: findings.filter((f) => !f.ok).length,
    at: new Date().toISOString(),
  }
  writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 2))
  writeFileSync(
    `${OUT}/report.md`,
    [
      '# Focus-ring pass @ 1440',
      '',
      `- commit: \`${report.shortHead}\` (\`${report.head}\`)`,
      `- dirty: ${report.dirty}`,
      `- ui: ${report.ui}`,
      `- ${report.pass} pass / ${report.fail} fail`,
      '',
      ...findings.map(
        (f) =>
          `- **${f.ok ? 'PASS' : 'FAIL'}** \`${f.id}\` — ${f.name || f.reason || ''} — \`${f.outline || ''}\` ${f.note || ''}`,
      ),
      '',
      '## Shots',
      ...shots.map((s) => `- ${s}`),
      '',
    ].join('\n'),
  )
  console.log('REPORT', `${OUT}/report.md`)
  console.log(`SUMMARY ${report.pass} pass / ${report.fail} fail @ ${report.shortHead}`)
  if (report.fail > 0) process.exitCode = 2
} finally {
  await browser.close()
  await stack.stop()
}
