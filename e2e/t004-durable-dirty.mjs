/**
 * T-004 L1 — durable dirty sheet identity (ox binding).
 * Owned-stack. Not beforeunload.
 *
 * Harness rules (hawk REQUEST CHANGES @ c395a17):
 * - No fixed-sleep “save done”; wait for dirty→false + draft keys gone.
 * - Product absences are ok:false, not throw/exit 2.
 * - Always write proof report (pass or fail). Exit 1 = product fail, 2 = harness/infra.
 *
 * Cases:
 * 1. dirty name → reload → name restored AND dirty
 * 2. Save → reload → no draft residual
 * 3. Discard → reload → server value; no draft
 * 4. server moved under draft → conflict chooser (+ keep canon / keep mine)
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
const SAVE_MS = 15_000

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
  await gotoWorkspace(page, 'canon')
  await ensureBinderOpen(page)
  await page.waitForSelector('.binder__stack-list, .shell__rail--binder', { timeout: 10_000 })
  const clicked = await page.evaluate((sheetName) => {
    const buttons = [
      ...document.querySelectorAll(
        '.binder__stack-list button, .shell__rail--binder button, button',
      ),
    ]
    const row = buttons.find((btn) => (btn.textContent || '').includes(sheetName))
    if (!row) {
      return {
        ok: false,
        names: buttons.slice(0, 30).map((btn) => (btn.textContent || '').trim().slice(0, 40)),
      }
    }
    row.click()
    return { ok: true }
  }, name)
  if (!clicked.ok) {
    throw new Error(`openSheet no row for ${name} sample=${JSON.stringify(clicked.names)}`)
  }
  await page.waitForSelector('.sheet-editor', { timeout: 10_000 })
  // Wait for identity form to be interactive
  await page.locator('.sheet-editor__form input').first().waitFor({ state: 'visible', timeout: 10_000 })
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
  await el.waitFor({ state: 'visible', timeout: 10_000 })
  await el.click()
  await el.fill(value)
  // Blur without clicking editor chrome (avoids leave/conflict backdrops).
  await el.evaluate((node) => node.blur())
  // Evidence: dirty flag flipped (or name already matches and dirty true).
  await page.waitForFunction(
    (want) => {
      const editor = document.querySelector('.sheet-editor')
      const dirty = editor?.getAttribute('data-sheet-dirty') === 'true'
      const inputs = [...document.querySelectorAll('.sheet-editor__form input')]
      const nameEl =
        [...document.querySelectorAll('label')]
          .find((l) => /^Name$/i.test((l.textContent || '').trim().split('\n')[0] || ''))
          ?.querySelector('input') || inputs[1]
      return dirty && nameEl && nameEl.value === want
    },
    value,
    { timeout: 5_000 },
  )
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

async function clearDraftKeys(page) {
  await page.evaluate((prefix) => {
    const kill = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k && k.startsWith(prefix)) kill.push(k)
    }
    for (const k of kill) localStorage.removeItem(k)
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

async function dismissBlockingRoots(page) {
  // Never leave a modal covering Save. Prefer Cancel on leave; Keep Canon on conflict only when testing non-conflict paths.
  const leaveCancel = page.locator('.sheet-editor__leave-dialog button').filter({ hasText: /^Cancel$/i })
  if (await leaveCancel.count()) {
    await leaveCancel.first().click().catch(() => {})
  }
}

async function saveSheet(page) {
  await dismissBlockingRoots(page)
  const btn = page.getByRole('button', { name: /Save sheet/i }).first()
  await btn.waitFor({ state: 'visible', timeout: SAVE_MS })
  // Must be enabled (name non-empty + not mid leave-save).
  await page.waitForFunction(
    () => {
      const buttons = [...document.querySelectorAll('button')]
      const save = buttons.find((b) => /Save sheet/i.test(b.textContent || ''))
      return Boolean(save && !save.disabled)
    },
    null,
    { timeout: SAVE_MS },
  )
  // No leave/conflict root covering the form.
  const blocked = await page.locator('.sheet-editor__leave-root').count()
  if (blocked) {
    const kind = {
      conflict: await page.locator('[data-sheet-conflict="true"]').count(),
      stale: await page.locator('[data-sheet-stale-confirm="true"]').count(),
      leave: await page.locator('.sheet-editor__leave-dialog').count(),
    }
    throw new Error(`save blocked by leave-root ${JSON.stringify(kind)}`)
  }
  await btn.click()
  // Evidence save landed: dirty false AND draft keys cleared.
  await page.waitForFunction(
    (prefix) => {
      const editor = document.querySelector('.sheet-editor')
      if (!editor || editor.getAttribute('data-sheet-dirty') !== 'false') return false
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i)
        if (k && k.startsWith(prefix)) return false
      }
      return true
    },
    DRAFT_PREFIX,
    { timeout: SAVE_MS },
  )
}

async function waitConflictVisible(page, timeout = 8_000) {
  const el = page.locator('[data-sheet-conflict="true"]')
  const start = Date.now()
  while (Date.now() - start < timeout) {
    if ((await el.count()) > 0 && (await el.first().isVisible().catch(() => false))) {
      return true
    }
    await page.waitForTimeout(100)
  }
  return false
}

function writeReport(report) {
  writeFileSync(PROOF, JSON.stringify(report, null, 2) + '\n')
  console.log('PROOF', PROOF)
  console.log(JSON.stringify(report, null, 2))
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
  let harnessError = null

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
    await page.waitForSelector('[aria-label="Workspace"]', { timeout: 15_000 })

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
    await page.waitForSelector('[aria-label="Workspace"]', { timeout: 15_000 })
    await openSheet(page, 'Kael')
    const afterReload = {
      dirty: await readDirty(page),
      name: await readName(page),
      keys: await draftKeys(page),
    }
    const case1 = {
      id: 'dirty-reload-restore',
      before,
      afterType,
      afterReload,
      ok:
        afterType.dirty === 'true' &&
        afterType.keys.length > 0 &&
        afterReload.dirty === 'true' &&
        afterReload.name === 'Kael Dirty Refresh',
    }
    results.push(case1)
    console.log('CASE1', JSON.stringify(case1))

    // CASE 2 Save clears
    await saveSheet(page)
    const afterSave = {
      dirty: await readDirty(page),
      name: await readName(page),
      keys: await draftKeys(page),
    }
    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.waitForSelector('[aria-label="Workspace"]', { timeout: 15_000 })
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
        afterSave.keys.length === 0 &&
        afterSaveReload.dirty === 'false' &&
        afterSaveReload.name === 'Kael Dirty Refresh' &&
        afterSaveReload.keys.length === 0,
    }
    results.push(case2)
    console.log('CASE2', JSON.stringify(case2))

    // CASE 3 Discard clears
    await typeName(page, 'Kael Discard Me')
    const dirtyBeforeDiscard = await readDirty(page)
    await ensureBinderOpen(page)
    const back = page.locator('button').filter({ hasText: /^Back/i }).first()
    if (await back.count()) await back.click()
    else await page.keyboard.press('Escape')
    const discard = page.locator('.sheet-editor__leave-dialog button').filter({ hasText: /^Discard$/i })
    const discardVisible = await discard
      .first()
      .waitFor({ state: 'visible', timeout: 5_000 })
      .then(() => true)
      .catch(() => false)
    if (discardVisible) await discard.first().click()
    // Evidence: editor closed or dirty cleared and draft gone
    await page
      .waitForFunction(
        (prefix) => {
          for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i)
            if (k && k.startsWith(prefix)) return false
          }
          return true
        },
        DRAFT_PREFIX,
        { timeout: 5_000 },
      )
      .catch(() => {})
    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.waitForSelector('[aria-label="Workspace"]', { timeout: 15_000 })
    await openSheet(page, 'Kael Dirty Refresh')
    const afterDiscard = {
      dirty: await readDirty(page),
      name: await readName(page),
      keys: await draftKeys(page),
      discardVisible,
    }
    const case3 = {
      id: 'discard-clears-draft',
      dirtyBeforeDiscard,
      afterDiscard,
      ok:
        discardVisible &&
        afterDiscard.name === 'Kael Dirty Refresh' &&
        afterDiscard.dirty === 'false' &&
        afterDiscard.keys.length === 0,
    }
    results.push(case3)
    console.log('CASE3', JSON.stringify(case3))

    // CASE 4 conflict
    await plantConflict(page, projectId, sheetId, 'OldBase', 'MineUnsaved')
    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.waitForSelector('[aria-label="Workspace"]', { timeout: 15_000 })
    await openSheet(page, 'Kael Dirty Refresh')
    const conflictVisible = await waitConflictVisible(page, 8_000)
    const keepMineCount = await page.locator('[data-conflict-action="keep-mine"]').count()
    const keepCanonCount = await page.locator('[data-conflict-action="keep-canon"]').count()
    const case4a = {
      id: 'conflict-chooser-appears',
      visible: conflictVisible,
      keepMine: keepMineCount > 0,
      keepCanon: keepCanonCount > 0,
      name: await readName(page),
      dirty: await readDirty(page),
      ok: conflictVisible && keepMineCount > 0 && keepCanonCount > 0,
    }
    results.push(case4a)
    console.log('CASE4a', JSON.stringify(case4a))

    if (case4a.ok) {
      await page.locator('[data-conflict-action="keep-canon"]').click()
      await page.waitForFunction(
        () => !document.querySelector('[data-sheet-conflict="true"]'),
        null,
        { timeout: 5_000 },
      )
      const afterKeepCanon = {
        dirty: await readDirty(page),
        name: await readName(page),
        keys: await draftKeys(page),
        conflictGone: (await page.locator('[data-sheet-conflict="true"]').count()) === 0,
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
    } else {
      results.push({
        id: 'conflict-keep-canon',
        ok: false,
        skipped: 'chooser absent',
      })
      results.push({
        id: 'conflict-keep-mine',
        ok: false,
        skipped: 'chooser absent',
      })
    }

    if (case4a.ok) {
      await plantConflict(page, projectId, sheetId, 'OldBase', 'MineUnsaved')
      await page.reload({ waitUntil: 'domcontentloaded' })
      await page.waitForSelector('[aria-label="Workspace"]', { timeout: 15_000 })
      await openSheet(page, 'Kael Dirty Refresh')
      const conflict2 = await waitConflictVisible(page, 8_000)
      if (conflict2) {
        await page.locator('[data-conflict-action="keep-mine"]').click()
        await page.waitForFunction(
          () => {
            const editor = document.querySelector('.sheet-editor')
            const dirty = editor?.getAttribute('data-sheet-dirty') === 'true'
            const inputs = [...document.querySelectorAll('.sheet-editor__form input')]
            const nameEl = inputs[1]
            return dirty && nameEl && nameEl.value === 'MineUnsaved'
          },
          null,
          { timeout: 5_000 },
        )
      }
      const afterKeepMine = { dirty: await readDirty(page), name: await readName(page), conflict2 }
      const case4c = {
        id: 'conflict-keep-mine',
        afterKeepMine,
        ok: conflict2 && afterKeepMine.name === 'MineUnsaved' && afterKeepMine.dirty === 'true',
      }
      results.push(case4c)
      console.log('CASE4c', JSON.stringify(case4c))
    }

    // CASE 5 mutation — wipe draft before reload must lose dirty name
    await clearDraftKeys(page)
    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.waitForSelector('[aria-label="Workspace"]', { timeout: 15_000 })
    // Ensure clean server name open (discard any leftover dirty via reload without draft)
    await openSheet(page, 'Kael Dirty Refresh')
    // If chooser somehow up, keep canon
    if (await page.locator('[data-conflict-action="keep-canon"]').count()) {
      await page.locator('[data-conflict-action="keep-canon"]').click()
      await page.waitForTimeout(100)
    }
    await typeName(page, 'Kael Should Be Lost')
    const dirtyMut = await readDirty(page)
    await clearDraftKeys(page)
    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.waitForSelector('[aria-label="Workspace"]', { timeout: 15_000 })
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
  } catch (error) {
    harnessError = error instanceof Error ? error.message : String(error)
    console.error('HARNESS_ERROR', harnessError)
    results.push({ id: 'harness', ok: false, error: harnessError })
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
    pass: failed.length === 0 && !harnessError,
    failed: failed.map((f) => f.id),
    harnessError,
  }
  writeReport(report)

  if (harnessError && failed.some((f) => f.id === 'harness')) {
    // Infra/harness death — exit 2 only if no product cases were evaluated as fail.
    // If product cases failed too, still exit 1 so FAIL is citable.
    const productFailed = failed.filter((f) => f.id !== 'harness')
    if (productFailed.length) {
      console.error('T-004 L1 FAIL', report.failed)
      process.exit(1)
    }
    console.error('T-004 L1 HARNESS FAIL', harnessError)
    process.exit(2)
  }
  if (!report.pass) {
    console.error('T-004 L1 FAIL', report.failed)
    process.exit(1)
  }
  console.log('T-004 L1 PASS')
  process.exit(0)
}

main().catch(async (e) => {
  // Last-resort: still try to leave a proof crumb.
  try {
    writeReport({
      head: process.env.STORYLINT_HEAD || 'unknown',
      when: new Date().toISOString(),
      results: [],
      pass: false,
      failed: ['harness-unhandled'],
      harnessError: e instanceof Error ? e.message : String(e),
    })
  } catch {
    /* ignore */
  }
  console.error(e)
  process.exit(2)
})
