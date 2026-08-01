/**
 * T-004 L1 — durable dirty sheet identity (ox binding).
 * Owned-stack. Not beforeunload.
 *
 * 1. dirty name → reload → name restored AND dirty
 * 2. Save → reload → no draft residual
 * 3. Discard → reload → server value; no draft
 * 4. server moved under draft → conflict chooser
 * 5. MUTATION: wipe draft keys before reload → loss (proves check can fail)
 */
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { writeFileSync, mkdirSync } from 'node:fs'
import { ownMeasurementStack } from './owned-stack.mjs'
import {
  setApiBase,
  ensureIsolatedProject,
  reclaimIsolatedProject,
  gotoWorkspace,
  ensureBinderOpen,
  getApiBase,
} from './helpers.mjs'

const require = createRequire('D:/npm-global/node_modules/playwright/package.json')
const pwRoot = dirname(require.resolve('playwright/package.json'))
const { chromium } = await import(pathToFileURL(resolve(pwRoot, 'index.mjs')).href)
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const PROOF = resolve(ROOT, 'e2e/proofs/T-004-durable-dirty.txt')
const DRAFT_PREFIX = 'storylint:sheet-identity-draft:v1:'

mkdirSync(resolve(ROOT, 'e2e/proofs'), { recursive: true })

function draftKey(projectId, sheetId) {
  return `${DRAFT_PREFIX}${projectId}:${sheetId}`
}

async function putProject(project) {
  const res = await fetch(`${getApiBase()}/api/project`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(project),
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`PUT failed ${res.status} ${text}`)
  return JSON.parse(text)
}

async function openSheet(page, name) {
  await gotoWorkspace(page, "canon")
  await ensureBinderOpen(page)
  await page.waitForTimeout(200)
  const clicked = await page.evaluate((sheetName) => {
    const buttons = [...document.querySelectorAll(".binder__stack-list button, .shell__rail--binder button, button")]
    const row = buttons.find((btn) => (btn.textContent || "").includes(sheetName))
    if (!row) {
      return { ok: false, names: buttons.slice(0, 30).map((btn) => (btn.textContent || "").trim().slice(0, 40)) }
    }
    row.click()
    return { ok: true }
  }, name)
  if (!clicked.ok) throw new Error("openSheet no row for " + name + " sample=" + JSON.stringify(clicked.names))
  await page.waitForSelector(".sheet-editor", { timeout: 10_000 })
}

async function nameInput(page) {
  const byLabel = page.locator('label').filter({ hasText: /^Name$/i }).locator('input')
  if (await byLabel.count()) return byLabel.first()
  return page.locator('.sheet-editor__form input').nth(1)
}

async function readDirty(page) {
  return page.locator('.sheet-editor').getAttribute('data-sheet-dirty')
}

async function readName(page) {
  return (await nameInput(page)).inputValue()
}

async function typeName(page, value) {
  const el = await nameInput(page)
  await el.click()
  await el.fill(value)
  // blur to settle any debounce
  await page.locator('.sheet-editor').click({ position: { x: 5, y: 5 } }).catch(() => {})
  await page.waitForTimeout(80)
}

async function draftKeys(page) {
  return page.evaluate((prefix) => {
    const out = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k && k.startsWith(prefix)) out.push(k)
    }
    return out
  }, DRAFT_PREFIX)
}

async function plantConflict(page, projectId, sheetId, baseName, draftName) {
  await page.evaluate(
    ({ key, baseName, draftName }) => {
      const base = {
        kind: 'character',
        name: baseName,
        aliases: [],
        summary: '',
        notes: '',
        portrait: '',
      }
      localStorage.setItem(
        key,
        JSON.stringify({
          base,
          draft: { ...base, name: draftName },
          savedAt: Date.now(),
        }),
      )
    },
    { key: draftKey(projectId, sheetId), baseName, draftName },
  )
}

async function saveSheet(page) {
  const btn = page.locator('.sheet-editor__form button[type="submit"]').first()
  await btn.click()
  await page.waitForTimeout(250)
}

async function main() {
  const stack = await ownMeasurementStack({ label: 't004-durable-dirty' })
  setApiBase(stack.api)
  const head = stack.shortHead || process.env.STORYLINT_HEAD || 'unknown'
  if (head === 'unknown') {
    console.error('FAIL: head=unknown — not evidence')
    await stack.stop()
    process.exit(2)
  }
  console.log(`[t004] head=${head} ui=${stack.ui} api=${stack.api}`)

  const browser = await chromium.launch({ channel: 'msedge', headless: true })
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  const results = []
  const projectId = `e2e-t004-${process.pid}-${Date.now().toString(36)}`
  const sheetId = 'sheet-kael'

  try {
    await page.goto(stack.ui, { waitUntil: 'domcontentloaded', timeout: 30_000 })
    await ensureIsolatedProject(page, { id: projectId, title: 'T004 Durable Dirty' })
    await putProject({
      schemaVersion: 2,
      title: 'T004 Durable Dirty',
      chapters: [{ id: 'ch-1', title: 'One', body: 'body', craftTags: [], revision: 0 }],
      sheets: [
        {
          id: sheetId,
          kind: 'character',
          name: 'Kael',
          aliases: [],
          summary: '',
          notes: '',
          portrait: '',
          facts: [],
        },
      ],
      proposals: [],
      rejectedFingerprints: [],
      marks: [],
      researchNotes: [],
      lab: { boards: [{ id: 'bench', title: 'Bench', cardIds: [] }], cards: [] },
    })
    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(300)

    // CASE 1
    await openSheet(page, 'Kael')
    const before = { dirty: await readDirty(page), name: await readName(page) }
    await typeName(page, 'Kael Dirty Refresh')
    const afterType = {
      dirty: await readDirty(page),
      name: await readName(page),
      keys: await draftKeys(page),
    }
    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(300)
    // List still shows server name until Save
    await openSheet(page, 'Kael')
    const afterReload = { dirty: await readDirty(page), name: await readName(page), keys: await draftKeys(page) }
    const case1 = {
      id: 'dirty-reload-restore',
      before,
      afterType,
      afterReload,
      ok: afterType.dirty === 'true' && afterReload.dirty === 'true' && afterReload.name === 'Kael Dirty Refresh',
    }
    results.push(case1)
    console.log('CASE1', JSON.stringify(case1))

    // CASE 2 Save clears
    await saveSheet(page)
    const afterSave = { dirty: await readDirty(page), name: await readName(page), keys: await draftKeys(page) }
    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(300)
    await openSheet(page, 'Kael Dirty Refresh')
    const afterSaveReload = {
      dirty: await readDirty(page),
      name: await readName(page),
      keys: await draftKeys(page),
    }
    const case2 = {
      id: 'save-clears-draft',
      afterSave,
      afterSaveReload,
      ok:
        afterSave.dirty === 'false' &&
        afterSaveReload.dirty === 'false' &&
        afterSaveReload.name === 'Kael Dirty Refresh' &&
        afterSaveReload.keys.length === 0,
    }
    results.push(case2)
    console.log('CASE2', JSON.stringify(case2))

    // CASE 3 Discard clears
    await typeName(page, 'Kael Discard Me')
    const dirtyBeforeDiscard = await readDirty(page)
    // open leave via binder back
    await ensureBinderOpen(page)
    const back = page.locator('button').filter({ hasText: /^Back/i }).first()
    if (await back.count()) await back.click()
    else await page.keyboard.press('Escape')
    await page.waitForTimeout(150)
    const discard = page.getByRole('button', { name: 'Discard', exact: true })
    if (await discard.count()) await discard.click()
    else {
      // try dialog Discard
      await page.locator('.sheet-editor__leave-dialog button:has-text("Discard")').click()
    }
    await page.waitForTimeout(200)
    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(300)
    await openSheet(page, 'Kael Dirty Refresh')
    const afterDiscard = {
      dirty: await readDirty(page),
      name: await readName(page),
      keys: await draftKeys(page),
    }
    const case3 = {
      id: 'discard-clears-draft',
      dirtyBeforeDiscard,
      afterDiscard,
      ok:
        afterDiscard.name === 'Kael Dirty Refresh' &&
        afterDiscard.dirty === 'false' &&
        afterDiscard.keys.length === 0,
    }
    results.push(case3)
    console.log('CASE3', JSON.stringify(case3))

    // CASE 4 conflict
    await plantConflict(page, projectId, sheetId, 'OldBase', 'MineUnsaved')
    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(300)
    await openSheet(page, 'Kael Dirty Refresh')
    const conflictEl = page.locator('[data-sheet-conflict="true"]')
    await conflictEl.waitFor({ timeout: 8_000 }).catch(() => {})
    const case4a = {
      id: 'conflict-chooser-appears',
      visible: (await conflictEl.count()) > 0,
      keepMine: (await page.locator('[data-conflict-action="keep-mine"]').count()) > 0,
      keepCanon: (await page.locator('[data-conflict-action="keep-canon"]').count()) > 0,
      name: await readName(page),
      dirty: await readDirty(page),
      ok:
        (await conflictEl.count()) > 0 &&
        (await page.locator('[data-conflict-action="keep-mine"]').count()) > 0 &&
        (await page.locator('[data-conflict-action="keep-canon"]').count()) > 0,
    }
    results.push(case4a)
    console.log('CASE4a', JSON.stringify(case4a))

    if (case4a.ok) {
      await page.locator('[data-conflict-action="keep-canon"]').click()
      await page.waitForTimeout(100)
      const afterKeepCanon = {
        dirty: await readDirty(page),
        name: await readName(page),
        keys: await draftKeys(page),
        conflictGone: (await conflictEl.count()) === 0,
      }
      const case4b = {
        id: 'conflict-keep-canon',
        afterKeepCanon,
        ok:
          afterKeepCanon.conflictGone &&
          afterKeepCanon.name === 'Kael Dirty Refresh' &&
          afterKeepCanon.dirty === 'false' &&
          afterKeepCanon.keys.length === 0,
      }
      results.push(case4b)
      console.log('CASE4b', JSON.stringify(case4b))
    }

    await plantConflict(page, projectId, sheetId, 'OldBase', 'MineUnsaved')
    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(300)
    await openSheet(page, 'Kael Dirty Refresh')
    await page.locator('[data-sheet-conflict="true"]').waitFor({ timeout: 8_000 })
    await page.locator('[data-conflict-action="keep-mine"]').click()
    await page.waitForTimeout(100)
    const afterKeepMine = { dirty: await readDirty(page), name: await readName(page) }
    const case4c = {
      id: 'conflict-keep-mine',
      afterKeepMine,
      ok: afterKeepMine.name === 'MineUnsaved' && afterKeepMine.dirty === 'true',
    }
    results.push(case4c)
    console.log('CASE4c', JSON.stringify(case4c))

    // reset to saved server name for mutation
    await page.locator('[data-conflict-action="keep-canon"]').click().catch(() => {})
    // if still dirty MineUnsaved, discard via leave or re-open clean
    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(300)
    // clear any leftover draft
    await page.evaluate((prefix) => {
      const kill = []
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i)
        if (k && k.startsWith(prefix)) kill.push(k)
      }
      for (const k of kill) localStorage.removeItem(k)
    }, DRAFT_PREFIX)
    await openSheet(page, 'Kael Dirty Refresh')
    await typeName(page, 'Kael Should Be Lost')
    const dirtyMut = await readDirty(page)
    // MUTATION: wipe durable draft before reload
    await page.evaluate((prefix) => {
      const kill = []
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i)
        if (k && k.startsWith(prefix)) kill.push(k)
      }
      for (const k of kill) localStorage.removeItem(k)
    }, DRAFT_PREFIX)
    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(300)
    await openSheet(page, 'Kael Dirty Refresh')
    const afterMut = { dirty: await readDirty(page), name: await readName(page) }
    const case5 = {
      id: 'mutation-wipe-draft-loses',
      dirtyMut,
      afterMut,
      ok: dirtyMut === 'true' && afterMut.name === 'Kael Dirty Refresh' && afterMut.dirty === 'false',
    }
    results.push(case5)
    console.log('CASE5', JSON.stringify(case5))
  } finally {
    await reclaimIsolatedProject(page, projectId).catch(() => {})
    await browser.close().catch(() => {})
    await stack.stop().catch(() => {})
  }

  const failed = results.filter((r) => !r.ok)
  const report = {
    head,
    when: new Date().toISOString(),
    results,
    pass: failed.length === 0,
    failed: failed.map((f) => f.id),
  }
  writeFileSync(PROOF, JSON.stringify(report, null, 2) + '\n')
  console.log('PROOF', PROOF)
  console.log(JSON.stringify(report, null, 2))
  if (!report.pass) {
    console.error('T-004 L1 FAIL', report.failed)
    process.exit(1)
  }
  console.log('T-004 L1 PASS')
}

main().catch(async (e) => {
  console.error(e)
  process.exit(2)
})
