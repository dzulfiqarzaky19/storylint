/**
 * Reproduce B5-touch on companion faces @390 with owned-stack provenance.
 * node e2e/b5-face-touch.mjs
 */
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { mkdirSync, writeFileSync } from 'node:fs'
import { ownMeasurementStack } from './owned-stack.mjs'

const require = createRequire('D:/npm-global/node_modules/playwright/package.json')
const pwRoot = dirname(require.resolve('playwright/package.json'))
const { chromium } = await import(pathToFileURL(resolve(pwRoot, 'index.mjs')).href)

const OUT = 'e2e/output/b5-face-touch'
mkdirSync(OUT, { recursive: true })

const stack = await ownMeasurementStack({ skipBuild: process.env.STORYLINT_SKIP_BUILD === '1' })
const browser = await chromium.launch({ channel: 'msedge', headless: true })

try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
  page.setDefaultTimeout(15_000)
  await page.goto(stack.ui, { waitUntil: 'networkidle' })
  await page.waitForSelector('.shell')

  // Open companion (drawer on phone)
  const agentToggle = page.getByRole('button', { name: /Show companion|Hide companion/i }).first()
  const label = (await agentToggle.getAttribute('aria-label')) || ''
  if (/Show companion/i.test(label)) {
    await agentToggle.click()
    await page.waitForTimeout(300)
  }
  await page.waitForSelector('.panel[data-companion-context]', { timeout: 8000 })

  // Prefer Canon/graph faces (Chat/Inspect/Inbox) as rat cited; also measure writing.
  const results = {}
  for (const mode of [
    { name: 'writing', btn: 'Draft' },
    { name: 'graph', btn: 'Canon' },
  ]) {
    await page.getByRole('button', { name: mode.btn, exact: true }).first().click().catch(() => {})
    await page.waitForTimeout(350)
    // reopen companion if closed by place switch
    const lab2 = (await agentToggle.getAttribute('aria-label')) || ''
    if (/Show companion/i.test(lab2)) {
      await agentToggle.click()
      await page.waitForTimeout(250)
    }
    await page.waitForSelector(`.panel[data-companion-context="${mode.name === 'writing' ? 'writing' : 'graph'}"]`, {
      timeout: 8000,
    }).catch(() => null)

    const measure = await page.evaluate(() => {
      const panel = document.querySelector('.panel[data-companion-context]')
      if (!panel) return { missing: true }
      const context = panel.getAttribute('data-companion-context')
      const tabs = [...panel.querySelectorAll('.companion__faces [role="tab"], .companion__faces button')]
      const samples = tabs.map((el) => {
        const r = el.getBoundingClientRect()
        const cs = getComputedStyle(el)
        return {
          name: (el.getAttribute('aria-label') || el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 40),
          w: Math.round(r.width * 10) / 10,
          h: Math.round(r.height * 10) / 10,
          min: Math.round(Math.min(r.width, r.height) * 10) / 10,
          minHeight: cs.minHeight,
          padding: `${cs.paddingTop} ${cs.paddingRight} ${cs.paddingBottom} ${cs.paddingLeft}`,
          fontSize: cs.fontSize,
          boxSizing: cs.boxSizing,
          className: String(el.className),
        }
      })
      const fails = samples.filter((s) => s.min < 43.5)
      // Also run same selectors as calm B5-touch-chrome subset for faces
      return { context, samples, faceFails: fails.length, fails }
    })
    results[mode.name] = measure
    await page.screenshot({ path: `${OUT}/${mode.name}-390.png`, fullPage: false })
    console.log(mode.name, JSON.stringify(measure, null, 2))
  }

  // Full calm-like chrome sample at 390 with companion open (writing)
  await page.getByRole('button', { name: 'Draft', exact: true }).first().click().catch(() => {})
  await page.waitForTimeout(300)
  const lab3 = (await agentToggle.getAttribute('aria-label')) || ''
  if (/Show companion/i.test(lab3)) {
    await agentToggle.click()
    await page.waitForTimeout(250)
  }
  const chrome = await page.evaluate(() => {
    const selectors = [
      '.shell__topbar button',
      '.shell__topbar [role="button"]',
      '.shell__ecosystem button',
      '.companion__faces button',
      '.companion__faces [role="tab"]',
      'details summary',
      '.lab__filter-summary',
    ]
    const fails = []
    for (const sel of selectors) {
      for (const el of document.querySelectorAll(sel)) {
        const r = el.getBoundingClientRect()
        if (r.width === 0 || r.height === 0) continue
        const st = getComputedStyle(el)
        if (st.visibility === 'hidden' || st.display === 'none') continue
        const min = Math.min(r.width, r.height)
        if (min < 43.5) {
          fails.push({
            sel,
            name: (el.getAttribute('aria-label') || el.textContent || sel).trim().replace(/\s+/g, ' ').slice(0, 40),
            w: Math.round(r.width * 10) / 10,
            h: Math.round(r.height * 10) / 10,
            min: Math.round(min * 10) / 10,
          })
        }
      }
    }
    return { touchFailChrome: fails.length, samples: fails }
  })
  console.log('chrome@390', JSON.stringify(chrome, null, 2))

  // Desktop control check: faces must NOT be forced to 44 at 1440
  const desk = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  await desk.goto(stack.ui, { waitUntil: 'networkidle' })
  const hide = desk.getByRole('button', { name: /Show companion|Hide companion/i }).first()
  if (/Show companion/i.test((await hide.getAttribute('aria-label')) || '')) await hide.click()
  await desk.waitForTimeout(200)
  const deskFaces = await desk.evaluate(() => {
    const tabs = [...document.querySelectorAll('.companion__faces [role="tab"]')]
    return tabs.map((el) => {
      const r = el.getBoundingClientRect()
      return {
        name: (el.textContent || '').trim().slice(0, 20),
        h: Math.round(r.height * 10) / 10,
        minHeight: getComputedStyle(el).minHeight,
      }
    })
  })
  console.log('desktop faces', deskFaces)
  await desk.close()

  const report = {
    head: stack.head,
    shortHead: stack.shortHead,
    dirty: stack.dirty,
    shellCss: stack.shellCss,
    ui: stack.ui,
    results,
    chrome,
    deskFaces,
    at: new Date().toISOString(),
  }
  writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 2))
  console.log('PROVENANCE', stack.shortHead, stack.shellCss)
  console.log('REPORT', `${OUT}/report.json`)
} finally {
  await browser.close()
  await stack.stop()
}
