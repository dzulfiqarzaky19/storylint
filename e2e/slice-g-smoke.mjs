import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { mkdirSync } from 'node:fs'
import { NOVEL_CHAPTER } from './constants.mjs'

const require = createRequire('D:/npm-global/node_modules/playwright/package.json')
const pwRoot = dirname(require.resolve('playwright/package.json'))
const { chromium } = await import(pathToFileURL(resolve(pwRoot, 'index.mjs')).href)
mkdirSync('e2e/output', { recursive: true })
const browser = await chromium.launch({ channel: 'msedge', headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })

// Live LLM can take 20–45s on the long dogfood chapter.
const LLM_TIMEOUT = 60000

try {
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' })
  const body = page.getByRole('main', { name: 'Draft' }).getByLabel('Chapter text')
  const companion = page.locator('.panel').filter({ has: page.getByRole('heading', { name: 'Companion' }) })
  const chapter = `${NOVEL_CHAPTER}\n\n— e2e ${Date.now()}`
  await body.fill(chapter)
  await page.locator('.project-status', { hasText: 'Saved' }).waitFor({ timeout: 15000 })
  const before = await body.inputValue()
  if (before !== chapter) throw new Error('Novel chapter did not land in manuscript')
  const marksBefore = await page.locator('.manuscript__mark').count()

  // Companion defaults to Chat; review tools live on the Check face.
  // Finding titles differ fixture vs live — assert on the review card shell.
  await companion.getByRole('button', { name: 'Check', exact: true }).click()
  await companion.getByRole('button', { name: 'Review', exact: true }).click()
  const reviewCard = companion.locator('.review-card').filter({ hasText: 'Chapter review' })
  await reviewCard.waitFor({ timeout: LLM_TIMEOUT })
  if (await body.inputValue() !== before) throw new Error('Review changed manuscript')
  if (await page.locator('.manuscript__mark').count() !== marksBefore) throw new Error('Review emitted continuity marks')

  await reviewCard.getByRole('button', { name: 'Add suggested tags' }).click()
  await page.waitForFunction(
    () => document.querySelector('.manuscript__craft-tag[aria-pressed="true"]') !== null,
    undefined,
    { timeout: 5000 },
  )
  await page.locator('.project-status', { hasText: 'Saved' }).waitFor({ timeout: 15000 })

  // Wait until the first review finishes so Craft is not a no-op (sending guard).
  await companion.getByRole('button', { name: 'Craft', exact: true }).waitFor({ state: 'visible' })
  await page.waitForFunction(
    () => {
      const buttons = [...document.querySelectorAll('.panel button')]
      const craft = buttons.find((button) => button.textContent?.trim() === 'Craft')
      return craft instanceof HTMLButtonElement && !craft.disabled
    },
    undefined,
    { timeout: 10000 },
  )

  const cardsBeforeCraft = await companion.locator('.review-card').count()
  await companion.getByRole('button', { name: 'Craft', exact: true }).click()
  await page.waitForFunction(
    (beforeCount) => document.querySelectorAll('.panel .review-card').length > beforeCount,
    cardsBeforeCraft,
    { timeout: LLM_TIMEOUT },
  )
  await companion.locator('.review-card').filter({ hasText: 'Chapter craft check' }).waitFor({ timeout: 5000 })
  if (await body.inputValue() !== before) throw new Error('Craft check changed manuscript')

  await page.screenshot({ path: 'e2e/output/slice-g-smoke.png', fullPage: true })
  console.log('PASS: Review and craft check are on-demand neutral panel findings; tags require explicit add; no manuscript or continuity-mark writes')
} finally {
  await browser.close()
}
