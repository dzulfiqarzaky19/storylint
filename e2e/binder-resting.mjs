/**
 * D1 — binder resting state on a brand-new empty project.
 * Verifies the binder never rests as a void: every group paints a label, a
 * one-line empty state, and one obvious next move.
 *
 *   node e2e/binder-resting.mjs        (RAIL_UI overrides the origin)
 */
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { mkdirSync } from 'node:fs'

const require = createRequire('D:/npm-global/node_modules/playwright/package.json')
const pwRoot = dirname(require.resolve('playwright/package.json'))
const { chromium } = await import(pathToFileURL(resolve(pwRoot, 'index.mjs')).href)

const OUT = 'e2e/output/rail-budget'
mkdirSync(OUT, { recursive: true })
const UI = process.env.RAIL_UI || 'http://localhost:5173/'
const tag = Date.now().toString(36).slice(-4)

const browser = await chromium.launch({ channel: 'msedge', headless: true })
let failed = 0
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  page.setDefaultTimeout(12000)
  await page.goto(UI, { waitUntil: 'networkidle' })

  // brand-new project == the true first-run resting state
  await page.getByRole('button', { name: 'Project menu' }).click()
  await page.getByRole('menuitem', { name: 'New project' }).click()
  await page.getByLabel('New project title').fill(`Empty ${tag}`)
  await page.getByRole('button', { name: 'Create', exact: true }).click()
  await page.waitForTimeout(1200)

  for (const mode of ['Draft', 'Lab', 'Canon']) {
    const btn = page.getByRole('button', { name: mode, exact: true }).first()
    if ((await btn.count()) && (await btn.isVisible().catch(() => false))) {
      await btn.click()
      await page.waitForTimeout(500)
    }

    const state = await page.evaluate(() => {
      const rail = document.querySelector('.shell__rail--binder')
      if (!rail) return { present: false }
      const r = rail.getBoundingClientRect()
      const text = (rail.textContent || '').replace(/\s+/g, ' ').trim()
      const groups = [...rail.querySelectorAll('.panel__group')].map((g) => ({
        label: (g.querySelector('.panel__label')?.textContent || '').trim(),
        emptyRows: g.querySelectorAll('.panel__empty-row').length,
        rows: g.querySelectorAll('.ui-list-row').length,
        buttons: [...g.querySelectorAll('button')].map((b) => (b.textContent || '').trim()).filter(Boolean),
      }))
      // ink coverage: how much of the rail's height carries any painted content
      const body = rail.querySelector('.panel__body')
      const painted = body
        ? [...body.querySelectorAll('*')]
            .filter((el) => (el.textContent || '').trim().length > 0)
            .reduce((max, el) => Math.max(max, el.getBoundingClientRect().bottom), 0)
        : 0
      const fill = body ? Math.round(((painted - body.getBoundingClientRect().top) / r.height) * 100) : 0
      return { present: true, w: Math.round(r.width), h: Math.round(r.height), textLen: text.length, groups, fillPct: Math.max(0, fill) }
    })

    const labels = (state.groups || []).map((g) => g.label).filter(Boolean)
    const ctas = (state.groups || []).flatMap((g) => g.buttons)
    const emptyStates = (state.groups || []).reduce((n, g) => n + g.emptyRows, 0)
    const ok =
      state.present && labels.length >= 3 && ctas.length >= 3 && emptyStates >= 3 && state.textLen > 80
    if (!ok) failed += 1
    console.log(
      `${ok ? '[PASS]' : '[FAIL]'} binder-resting@${mode}: groups=[${labels.join(', ')}] ctas=[${ctas.join(', ')}] emptyRows=${emptyStates} textLen=${state.textLen} fill=${state.fillPct}% width=${state.w}`,
    )
    await page.screenshot({ path: `${OUT}/empty__${mode.toLowerCase()}__1440.png` })
  }
} finally {
  await browser.close()
}
console.log(failed ? `\n${failed} binder resting check(s) failed` : '\nPASS: binder never rests as a void')
process.exit(failed ? 1 : 0)
