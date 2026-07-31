/**
 * Inbox live-region probe after chat proposal pack.
 * STORYLINT_SKIP_BUILD=1 node e2e/au-inbox-probe.mjs
 */
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { ownMeasurementStack } from './owned-stack.mjs'

const require = createRequire('D:/npm-global/node_modules/playwright/package.json')
const pwRoot = dirname(require.resolve('playwright/package.json'))
const { chromium } = await import(pathToFileURL(resolve(pwRoot, 'index.mjs')).href)

const stack = await ownMeasurementStack({ skipBuild: process.env.STORYLINT_SKIP_BUILD === '1' })
const browser = await chromium.launch({ channel: 'msedge', headless: true })
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  page.setDefaultTimeout(20_000)
  await page.goto(stack.ui, { waitUntil: 'networkidle' })
  await page.evaluate(async () => {
    const list = await fetch('/api/projects').then((r) => r.json())
    const def = (list.projects || []).find((p) => p.id === 'default') || list.projects?.[0]
    if (def) {
      await fetch(`/api/projects/${encodeURIComponent(def.id)}/activate`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      })
    }
  })
  await page.reload({ waitUntil: 'domcontentloaded' })
  const tog = page.getByRole('button', { name: /Show companion|Hide companion/i }).first()
  if (/Show companion/i.test((await tog.getAttribute('aria-label')) || '')) {
    await tog.click()
    await page.waitForTimeout(200)
  }
  await page.getByRole('button', { name: 'Draft', exact: true }).click().catch(() => {})
  await page.waitForTimeout(200)
  await page.getByRole('tab', { name: /^Chat$/i }).click().catch(async () => {
    await page.getByRole('button', { name: /^Chat$/i }).click()
  })
  const ta = page.locator('.panel[data-companion-context] textarea').first()
  await ta.fill('Draft a character sheet for Kael')
  await page.getByRole('button', { name: /^Send$/i }).click()
  const r = await page.evaluate(async () => {
    const samples = []
    for (let i = 0; i < 40; i++) {
      const live = (document.querySelector('[data-au-live="inbox"]')?.textContent || '').trim()
      const tab = [...document.querySelectorAll('.companion__faces [role="tab"]')].find((el) =>
        /inbox/i.test(el.getAttribute('aria-label') || el.textContent || ''),
      )
      samples.push({
        t: i * 100,
        live,
        name: tab?.getAttribute('aria-label'),
        count: tab?.querySelector('.companion__inbox-count')?.textContent?.trim() || null,
        busy: (document.querySelector('[data-au-live="assistant-busy"]')?.textContent || '').trim(),
      })
      await new Promise((res) => setTimeout(res, 100))
    }
    return {
      sawInboxLive: samples.some((s) => /inbox/i.test(s.live)),
      sawCount: samples.some((s) => s.count),
      sawBusyThenClear: samples.some((s) => /working/i.test(s.busy)) && samples.some((s) => !s.busy),
      peaks: samples.filter((s) => s.live || s.count || /working/i.test(s.busy)).slice(0, 16),
    }
  })
  console.log(JSON.stringify(r, null, 2))
  if (!r.sawInboxLive) process.exitCode = 2
} finally {
  await browser.close()
  await stack.stop()
}
