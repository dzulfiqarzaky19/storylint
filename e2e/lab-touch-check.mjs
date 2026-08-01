// Touch-target check for the new disclosure @390. Rect is legitimate here because it measures
// SIZE of an element already confirmed visible via checkVisibility — not visibility itself.
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const require = createRequire('D:/npm-global/node_modules/playwright/package.json')
const pwRoot = dirname(require.resolve('playwright/package.json'))
const { chromium } = await import(pathToFileURL(resolve(pwRoot, 'index.mjs')).href)
const BASE = process.env.LAB_BASE ?? 'http://localhost:5188'

const browser = await chromium.launch({ channel: 'msedge', headless: true })
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })
  // never networkidle on owned stacks — companion/LLM sockets burn ~30s
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 30_000 })
  await page.getByRole('button', { name: 'Lab', exact: true }).click()
  await page.getByRole('main', { name: 'Lab' }).waitFor()
  await page.waitForTimeout(400)

  const out = await page.evaluate(() => {
    const vis = (el) => !!el && el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })
    const rows = []
    for (const el of document.querySelectorAll('.lab summary, .lab .lab__composer-actions button')) {
      if (!vis(el)) continue
      const r = el.getBoundingClientRect()
      rows.push({ text: el.textContent.trim(), w: Math.round(r.width), h: Math.round(r.height), pass: Math.min(r.width, r.height) >= 44 })
    }
    return rows
  })
  console.log(JSON.stringify(out, null, 2))
  const fails = out.filter((r) => !r.pass)
  console.log(fails.length ? `TOUCH FAIL: ${JSON.stringify(fails)}` : 'TOUCH PASS @390')
  await page.close()
} finally {
  await browser.close()
}
