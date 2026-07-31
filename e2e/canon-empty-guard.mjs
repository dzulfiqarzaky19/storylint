/**
 * Does the empty-Canon "New sheet" CTA inherit koala's dirty-leave guard?
 *
 * The CTA is a leave path that did not exist when the guard was wired. If it bypasses the guard,
 * an author loses unsaved identity edits through a brand new door, which is the exact lost-work
 * bug the guard exists to prevent.
 *
 * Reachability note: while Canon has zero sheets the CTA is showing, and any sheet that exists
 * makes Canon non-empty and hides it. So the real reachable case is: CTA opens the create form,
 * the author types a name without saving, and then presses the CTA again (the map is still empty
 * because nothing has been saved). That is a dirty-leave through the new door.
 */
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { mkdirSync } from 'node:fs'
import { requireApiOrigin, requireUiOrigin } from './helpers.mjs'

const require = createRequire('D:/npm-global/node_modules/playwright/package.json')
const pwRoot = dirname(require.resolve('playwright/package.json'))
const { chromium } = await import(pathToFileURL(resolve(pwRoot, 'index.mjs')).href)

const OUT = 'e2e/output/canon-empty'
mkdirSync(OUT, { recursive: true })

const API = requireApiOrigin()
const UI = requireUiOrigin()
const stamp = Date.now()
const projectId = `canon-guard-${stamp}`

const failures = []
const check = (condition, message) => {
  if (!condition) failures.push(message)
}

const shownButtons = (page) =>
  page.evaluate(() => {
    const shown = (el) => Boolean(el && el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }))
    return [...document.querySelectorAll('button')].filter(shown).map((b) => b.textContent.trim())
  })

const browser = await chromium.launch({ channel: 'msedge', headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })

const created = await page.request.post(`${API}/api/projects`, {
  data: { id: projectId, title: 'Canon guard probe' },
  headers: { 'content-type': 'application/json' },
})
if (!created.ok() && created.status() !== 409) throw new Error(`create -> ${created.status()}`)
const active = await page.request.post(`${API}/api/projects/${encodeURIComponent(projectId)}/activate`, {
  data: {},
  headers: { 'content-type': 'application/json' },
})
if (!active.ok()) throw new Error(`activate -> ${active.status()}`)

// never networkidle on owned stacks — companion/LLM sockets burn ~30s
await page.goto(UI, { waitUntil: 'domcontentloaded', timeout: 30_000 })
await page.reload({ waitUntil: 'domcontentloaded' })
const canon = page.getByRole('button', { name: 'Canon', exact: true })
if (await canon.count()) await canon.click()
const graph = page.getByRole('main', { name: 'Relationship graph' })
await graph.waitFor({ timeout: 10000 })
await page.waitForTimeout(400)

const cta = graph.locator('.graph__empty-cta')
await cta.waitFor({ timeout: 5000 })

// 1. Open the create form through the map CTA.
await cta.click()
await page.waitForTimeout(600)
const nameField = page.getByLabel('Name')
await nameField.waitFor({ timeout: 5000 })

// 2. Make it dirty without saving.
await nameField.fill('DirtyEditNotSaved')
await page.waitForTimeout(300)
const ctaStillThere = await cta.count()

// 3. Leave through the same new door.
await cta.click()
await page.waitForTimeout(600)

const guard = await page.evaluate(() => {
  const shown = (el) => Boolean(el && el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }))
  const dialog = document.querySelector('.sheet-editor__leave-dialog')
  const labels = [...(dialog?.querySelectorAll('button') ?? [])].filter(shown).map((b) => b.textContent.trim())
  return {
    dialogShown: shown(dialog),
    title: dialog?.querySelector('.sheet-editor__leave-title')?.textContent?.trim() ?? null,
    hasSave: labels.includes('Save'),
    hasDiscard: labels.includes('Discard'),
    hasCancel: labels.includes('Cancel'),
  }
})
await page.screenshot({ path: `${OUT}/guard-new-sheet-1440.png` })

check(
  guard.dialogShown && guard.hasSave && guard.hasDiscard && guard.hasCancel,
  `dirty leave through the map CTA did NOT raise Save/Discard/Cancel: ${JSON.stringify(guard)}`,
)

// 4. Cancel must keep the author where they were, with the edit intact.
if (guard.hasCancel) {
  await page
    .locator('.sheet-editor__leave-dialog')
    .getByRole('button', { name: 'Cancel', exact: true })
    .click()
  await page.waitForTimeout(400)
  const afterCancel = await page.evaluate(() => ({
    nameValue: document.querySelector('#sheet-name')?.value
      ?? [...document.querySelectorAll('.sheet-editor__field')]
        .find((f) => f.textContent.trim().startsWith('Name'))
        ?.querySelector('input')?.value
      ?? null,
    dialogGone: !document.querySelector('.sheet-editor__leave-dialog'),
  }))
  check(
    afterCancel.nameValue === 'DirtyEditNotSaved' && afterCancel.dialogGone,
    `Cancel should dismiss the dialog and keep the unsaved edit: ${JSON.stringify(afterCancel)}`,
  )
}

console.log(JSON.stringify({ ctaStillThere, guard, buttons: await shownButtons(page) }, null, 2))
await browser.close()

if (failures.length) {
  console.error('FAIL dirty-guard probe:')
  for (const failure of failures) console.error(` - ${failure}`)
  process.exit(1)
}
console.log('PASS: the map New sheet door inherits the dirty-leave guard')
