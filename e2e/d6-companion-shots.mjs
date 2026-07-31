/**
 * D6 companion face density shots — 1440 + 390.
 * node e2e/d6-companion-shots.mjs
 */
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { mkdirSync } from 'node:fs'

const require = createRequire('D:/npm-global/node_modules/playwright/package.json')
const pwRoot = dirname(require.resolve('playwright/package.json'))
const { chromium } = await import(pathToFileURL(resolve(pwRoot, 'index.mjs')).href)
mkdirSync('e2e/output', { recursive: true })

const UI = 'http://localhost:5173/'
const browser = await chromium.launch({ channel: 'msedge', headless: true })

async function ensureAgent(page) {
  const btn = page.getByRole('button', { name: /Show companion|Hide companion/i }).first()
  if (!(await btn.count())) return
  const label = await btn.getAttribute('aria-label')
  if (/Show companion/i.test(label || '')) await btn.click()
  await page.waitForTimeout(200)
}

async function shot(page, name) {
  const path = `e2e/output/d6-${name}.png`
  await page.screenshot({ path, fullPage: false })
  console.log('SHOT', path)
}

try {
  for (const [vp, w, h] of [
    ['1440', 1440, 900],
    ['390', 390, 844],
  ]) {
    const page = await browser.newPage({ viewport: { width: w, height: h } })
    page.setDefaultTimeout(12000)
    await page.goto(UI, { waitUntil: 'networkidle' })
    await ensureAgent(page)
    const draft = page.getByRole('button', { name: 'Draft', exact: true }).first()
    if (await draft.count() && (await draft.isVisible().catch(() => false))) {
      await draft.click().catch(() => {})
      await page.waitForTimeout(300)
    }
    await ensureAgent(page)
    const companion = page.locator('.panel[data-companion-context]').first()
    await companion.waitFor({ timeout: 8000 })
    await shot(page, `writing-chat-${vp}`)

    for (const face of ['Write', 'Check']) {
      await companion.getByRole('button', { name: face, exact: true }).click()
      await page.waitForTimeout(250)
      await shot(page, `writing-${face.toLowerCase()}-${vp}`)
    }
    await companion.getByRole('button', { name: /^Inbox/ }).click()
    await page.waitForTimeout(250)
    await shot(page, `writing-inbox-${vp}`)

    const more = companion.getByRole('button', { name: /^More/ })
    if (await more.count()) {
      await more.click()
      await page.waitForTimeout(150)
      await shot(page, `writing-more-open-${vp}`)
      await companion.getByRole('menuitem', { name: 'Research', exact: true }).click()
      await page.waitForTimeout(300)
      await shot(page, `writing-research-${vp}`)
    }

    const lab = page.getByRole('button', { name: 'Lab', exact: true }).first()
    if (await lab.count()) {
      await lab.click({ force: true }).catch(() => {})
      await page.waitForTimeout(400)
      await ensureAgent(page)
      await shot(page, `lab-faces-${vp}`)
    }

    const canon = page.getByRole('button', { name: 'Canon', exact: true }).first()
    if (await canon.count()) {
      await canon.click({ force: true }).catch(() => {})
      await page.waitForTimeout(400)
      await ensureAgent(page)
      await shot(page, `canon-faces-${vp}`)
    }

    await page.getByRole('button', { name: 'Draft', exact: true }).first().click({ force: true }).catch(() => {})
    await page.waitForTimeout(300)
    await ensureAgent(page)
    const counts = await page.evaluate(() => {
      const panel = document.querySelector('.panel[data-companion-context="writing"]')
      if (!panel) return null
      const tabs = [...panel.querySelectorAll('.companion__faces [role="tab"], .companion__faces button')]
      return tabs.map((t) => (t.getAttribute('aria-label') || t.textContent || '').trim().replace(/\s+/g, ' '))
    })
    console.log('writing faces', vp, counts)
    await page.close()
  }
  console.log('DONE d6 shots')
} finally {
  await browser.close()
}
