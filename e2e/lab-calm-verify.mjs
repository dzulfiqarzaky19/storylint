// Otter — Lab resting-state verify. Pinned to THIS worktree's vite (5188), not the unowned 5173.
// Visibility uses Element.checkVisibility ONLY. getBoundingClientRect reports closed <details>
// children as visible in Chromium, which is exactly the blind spot that produced a fabricated
// regression earlier today. Screenshots are the primary evidence; counts are supporting.
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { mkdirSync, writeFileSync } from 'node:fs'

const require = createRequire('D:/npm-global/node_modules/playwright/package.json')
const pwRoot = dirname(require.resolve('playwright/package.json'))
const { chromium } = await import(pathToFileURL(resolve(pwRoot, 'index.mjs')).href)

const BASE = process.env.LAB_BASE ?? 'http://localhost:5188'
const API = process.env.LAB_API ?? 'http://127.0.0.1:4188'
const OUT = 'e2e/output/lab-calm'
mkdirSync(OUT, { recursive: true })

function probe() {
  return () => {
    const root = document.querySelector('.lab')
    if (!root) return { missing: true }
    // checkVisibility is the whole point: a closed <details> hides its children here,
    // where getBoundingClientRect would still hand back a live box.
    const vis = (el) => !!el && el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })
    const visibleButtons = (sel) =>
      [...root.querySelectorAll(sel + ' button')].filter(vis).map((b) => b.textContent.trim())

    const composerKinds = visibleButtons('.lab__composer-kinds')
    const filterMenu = visibleButtons('.lab__filter-menu')
    const summaries = [...root.querySelectorAll('summary')].filter(vis).map((s) => s.textContent.trim())

    // "Full strip" = >=4 kind choices actually visible to a human, in one strip.
    let kindFullStrips = 0
    if (composerKinds.length >= 4) kindFullStrips += 1
    if (filterMenu.length >= 4) kindFullStrips += 1

    const emptyStates = [...root.querySelectorAll('.ui-empty-state')].filter(vis)
      .map((e) => e.querySelector('.ui-empty-state__title')?.textContent.trim())
    const restLine = [...root.querySelectorAll('.lab__rest')].filter(vis)
      .map((e) => e.textContent.trim())

    // Every control a human can actually press, at rest.
    const allControls = [...root.querySelectorAll('button, summary')].filter(vis)
      .map((b) => b.textContent.trim()).filter(Boolean)

    return {
      cardCount: root.querySelectorAll('.lab__card').length,
      filterStripPresent: vis(root.querySelector('.lab__filters')),
      composerKindsVisible: composerKinds,
      filterMenuVisible: filterMenu,
      summaries,
      kindFullStrips,
      emptyStates,
      restLine,
      allControls,
      overflowX: root.scrollWidth > root.clientWidth,
    }
  }
}

const results = {}
const browser = await chromium.launch({ channel: 'msedge', headless: true })
try {
  for (const [label, viewport] of [['1440', { width: 1440, height: 900 }], ['390', { width: 390, height: 844 }]]) {
    const page = await browser.newPage({ viewport })
    // never networkidle on owned stacks — companion/LLM sockets burn ~30s
    await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 30_000 })
    await page.getByRole('button', { name: 'Lab', exact: true }).click()
    await page.getByRole('main', { name: 'Lab' }).waitFor()
    await page.waitForTimeout(400)

    results[`empty-${label}`] = await page.evaluate(probe())
    await page.screenshot({ path: `${OUT}/lab-empty-${label}.png`, fullPage: true })

    // Open the composer kind chooser: the 7 must still be one click away.
    const summary = page.locator('.lab__composer summary')
    if (await summary.count()) {
      await summary.click()
      await page.waitForTimeout(250)
      results[`empty-open-${label}`] = await page.evaluate(probe())
      await page.screenshot({ path: `${OUT}/lab-kinds-open-${label}.png`, fullPage: true })
      await summary.click()
      await page.waitForTimeout(200)
    }
    await page.close()
  }

  // Seeded bench: filter row returns, and filtered-empty must NOT say "Nothing on the bench".
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 30_000 })
  const project = await page.request.get(`${API}/api/project`).then((r) => r.json())
  const boardId = project.lab.boards[0].id
  for (const [kind, title] of [['place', 'Glass quarter'], ['beat', 'The gate gives way']]) {
    await page.request.post(`${API}/api/lab/cards`, { data: { boardId, kind, title, body: 'scratch' } })
  }
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Lab', exact: true }).click()
  await page.getByRole('main', { name: 'Lab' }).waitFor()
  await page.waitForTimeout(400)
  results['seeded-1440'] = await page.evaluate(probe())
  await page.screenshot({ path: `${OUT}/lab-seeded-1440.png`, fullPage: true })

  // Filter to a kind with zero cards → the lost-work-scare case.
  await page.locator('.lab__filters summary').click()
  await page.waitForTimeout(200)
  await page.getByLabel('Card kinds').getByRole('button', { name: 'Motif', exact: true }).click()
  await page.waitForTimeout(300)
  results['filtered-empty-1440'] = await page.evaluate(probe())
  await page.screenshot({ path: `${OUT}/lab-filtered-empty-1440.png`, fullPage: true })

  // Card edit must expose kind, so the disclosure hides a reversible choice.
  await page.getByLabel('Card kinds').getByRole('button', { name: 'All', exact: true }).count()
  await page.locator('.lab__filters').getByRole('button', { name: 'All', exact: true }).click()
  await page.waitForTimeout(250)
  const card = page.locator('.lab__card').first()
  await card.getByRole('button', { name: 'Edit' }).click()
  await page.waitForTimeout(250)
  results['card-edit-1440'] = await page.evaluate(() => {
    const el = document.querySelector('.lab__card details summary')
    return {
      editKindSummaryVisible: !!el && el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }),
      editKindSummaryText: el?.textContent.trim() ?? null,
    }
  })
  await page.screenshot({ path: `${OUT}/lab-card-edit-1440.png`, fullPage: true })

  // Clean up seeded cards so the shared data file is left as found.
  const after = await page.request.get(`${API}/api/project`).then((r) => r.json())
  for (const c of after.lab.cards) {
    await page.request.post(`${API}/api/lab/cards/${encodeURIComponent(c.id)}/archive`, { data: {} })
  }
  await page.close()

  writeFileSync(`${OUT}/probes.json`, JSON.stringify(results, null, 2))
  console.log(JSON.stringify(results, null, 2))
} finally {
  await browser.close()
}
