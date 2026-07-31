/**
 * AU fix verification — DOM/ARIA sampling (not NVDA).
 * node e2e/au-fix-verify.mjs
 */
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { mkdirSync, writeFileSync } from 'node:fs'
import { ownMeasurementStack } from './owned-stack.mjs'

const require = createRequire('D:/npm-global/node_modules/playwright/package.json')
const pwRoot = dirname(require.resolve('playwright/package.json'))
const { chromium } = await import(pathToFileURL(resolve(pwRoot, 'index.mjs')).href)
const OUT = 'e2e/output/au-fix'
mkdirSync(OUT, { recursive: true })

const stack = await ownMeasurementStack({ skipBuild: process.env.STORYLINT_SKIP_BUILD === '1' })
const browser = await chromium.launch({ channel: 'msedge', headless: true })
const report = { head: stack.head, shortHead: stack.shortHead, dirty: stack.dirty, shellCss: stack.shellCss, at: new Date().toISOString() }

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  page.setDefaultTimeout(20_000)
  await page.goto(stack.ui, { waitUntil: 'networkidle' })

  await page.evaluate(async () => {
    const list = await fetch('/api/projects').then((r) => r.json())
    const def = (list.projects || []).find((p) => p.id === 'default') || list.projects?.[0]
    if (def) {
      await fetch(`/api/projects/${encodeURIComponent(def.id)}/activate`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}',
      })
    }
    let p = await fetch('/api/project').then((r) => r.json())
    if (!p.chapters?.length) {
      await fetch('/api/chapters/chapter-1', {
        method: 'PUT', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: 'chapter-1', title: 'Chapter One', body: 'Aria met Kael. Kael had green eyes.', craftTags: [], revision: 0 }),
      })
    } else if (!(p.chapters[0].body || '').trim()) {
      const ch = p.chapters[0]
      await fetch(`/api/chapters/${encodeURIComponent(ch.id)}`, {
        method: 'PUT', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...ch, body: 'Aria met Kael. Kael had green eyes.' }),
      })
    }
  })
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForSelector('.shell')

  const agentToggle = page.getByRole('button', { name: /Show companion|Hide companion/i }).first()
  if (/Show companion/i.test((await agentToggle.getAttribute('aria-label')) || '')) {
    await agentToggle.click(); await page.waitForTimeout(250)
  }
  const binderToggle = page.getByRole('button', { name: /Show binder|Hide binder/i }).first()
  if (/Show binder/i.test((await binderToggle.getAttribute('aria-label')) || '')) {
    await binderToggle.click(); await page.waitForTimeout(250)
  }
  await page.getByRole('button', { name: 'Draft', exact: true }).click().catch(() => {})
  await page.waitForTimeout(200)

  // Plumbing present at rest
  report.plumbing = await page.evaluate(() => ({
    inboxLive: !!document.querySelector('[data-au-live="inbox"][aria-live="polite"]'),
    busyLive: !!document.querySelector('[data-au-live="assistant-busy"][aria-live="polite"]'),
    stackLive: !!document.querySelector('[data-au-live="binder-stack"][aria-live="polite"]'),
    metaLive: !!document.querySelector('.manuscript__meta[aria-live]'),
    binderStatus: [...document.querySelectorAll('.panel__empty-row[role="status"]')].length,
    saveLive: document.querySelector('.project-status')?.getAttribute('aria-live') || null,
  }))
  console.log('PLUMBING', report.plumbing)

  // AU-8 meta: type and confirm meta has no aria-live
  const title = page.getByLabel('Chapter title')
  if (await title.count()) {
    await title.click(); await title.press('End'); await title.type(' z', { delay: 10 })
    report.save = await page.evaluate(async () => {
      const st = document.querySelector('.project-status')
      const samples = []
      for (let i = 0; i < 15; i++) {
        samples.push((st?.textContent || '').trim())
        await new Promise((r) => setTimeout(r, 80))
      }
      return {
        unique: [...new Set(samples)],
        sawSaving: samples.some((s) => /saving/i.test(s)),
        metaHasLive: !!document.querySelector('.manuscript__meta[aria-live]'),
      }
    })
  }
  console.log('SAVE_META', report.save)

  // AU-2 Chat busy
  await page.getByRole('tab', { name: /^Chat$/i }).click().catch(async () => {
    await page.getByRole('button', { name: /^Chat$/i }).click()
  })
  await page.waitForTimeout(200)
  const ta = page.locator('.panel[data-companion-context] textarea').first()
  if (await ta.count()) await ta.fill('What should I do next?')
  const sendBtn = page.getByRole('button', { name: /^Send$/i }).first()
  if (await sendBtn.count()) {
    await sendBtn.click()
    report.chatBusy = await page.evaluate(async () => {
      const samples = []
      for (let i = 0; i < 20; i++) {
        const send = [...document.querySelectorAll('button')].find((b) =>
          /^(Send|Working)/i.test((b.textContent || '').trim()),
        )
        const busyLive = document.querySelector('[data-au-live="assistant-busy"]')
        const panel = document.querySelector('.panel[data-companion-context]')
        samples.push({
          btn: (send?.textContent || '').trim(),
          btnBusy: send?.getAttribute('aria-busy'),
          live: (busyLive?.textContent || '').trim(),
          panelBusy: panel?.getAttribute('aria-busy'),
        })
        await new Promise((r) => setTimeout(r, 80))
      }
      return {
        sawWorking: samples.some((s) => /working/i.test(s.btn)),
        sawAriaBusy: samples.some((s) => s.btnBusy === 'true' || s.panelBusy === 'true'),
        sawLiveWorking: samples.some((s) => /working/i.test(s.live)),
        peak: samples.filter((s) => /working/i.test(s.btn) || /working/i.test(s.live)).slice(0, 6),
      }
    })
  }
  console.log('CHAT_BUSY', JSON.stringify(report.chatBusy, null, 2))

  // AU-1 Inbox: seed pending via PUT then reload client path — force count change in-session via continuity if possible
  // Direct DOM: set is hard; use continuity after ensuring proposals, or mutate via evaluate React is hard.
  // Seed project proposals and activate to refresh.
  report.inbox = await page.evaluate(async () => {
    const beforeEl = document.querySelector('[data-au-live="inbox"]')
    const beforeText = (beforeEl?.textContent || '').trim()
    const p = await fetch('/api/project').then((r) => r.json())
    const sheet = p.sheets?.[0] || {
      id: 'sheet-au-inbox',
      name: 'AU Sheet',
      kind: 'character',
      aliases: [],
      facts: [],
      portrait: null,
      craftTags: [],
    }
    const sheets = p.sheets?.length ? p.sheets : [sheet]
    const n0 = (p.proposals || []).filter((x) => x.status === 'pending').length
    const proposal = {
      id: `au-prop-${Date.now()}`,
      kind: 'add_fact',
      status: 'pending',
      sheetId: sheets[0].id,
      summary: 'AU pending',
      fingerprint: `au-fp-${Date.now()}`,
      createdAt: new Date().toISOString(),
      payload: { key: 'au.key', value: '1' },
      source: { chapterId: p.chapters?.[0]?.id || 'chapter-1', start: 0, end: 0, text: '' },
    }
    // PUT may 400 on strict parse — try and report
    const putBody = { ...p, sheets, proposals: [...(p.proposals || []), proposal] }
    const put = await fetch('/api/project', {
      method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(putBody),
    })
    let putErr = null
    let putOk = put.ok
    if (!put.ok) {
      try { putErr = await put.json() } catch { putErr = await put.text() }
    }
    return { beforeText, n0, putOk, putStatus: put.status, putErr, note: 'client may need reload to see count; plumbing tested separately' }
  })
  // Reload to pick proposals if put ok, then measure live text after second put delta via UI accept path is heavy.
  // Instead: measure that live node exists and simulate count by checking after reload + second seed.
  if (report.inbox.putOk) {
    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(300)
    if (/Show companion/i.test((await agentToggle.getAttribute('aria-label')) || '')) {
      await agentToggle.click(); await page.waitForTimeout(200)
    }
    // After reload mount, live should be empty (skip first). Force second change via another PUT+client path.
    // Soft check: badge name/count if present
    report.inbox.afterReload = await page.evaluate(() => {
      const tab = [...document.querySelectorAll('.companion__faces [role="tab"]')].find((el) =>
        /inbox/i.test(el.getAttribute('aria-label') || el.textContent || ''),
      )
      return {
        name: tab?.getAttribute('aria-label'),
        count: tab?.querySelector('.companion__inbox-count')?.textContent?.trim() || null,
        live: (document.querySelector('[data-au-live="inbox"]')?.textContent || '').trim(),
        livePresent: !!document.querySelector('[data-au-live="inbox"][aria-live="polite"]'),
      }
    })
    // Trigger in-session change: accept nothing; add second proposal via API then soft-navigate Draft to force project refresh if polling absent.
    // useProject may not see external PUT — run Continuity instead which can add proposals, or call onProject via nothing.
    // Fallback: document plumbing + unit of effect by evaluating React state is not available.
  }
  console.log('INBOX', JSON.stringify(report.inbox, null, 2))

  // Continuity busy still works and agentBusyLive empty during continuity
  await page.getByRole('button', { name: 'Draft', exact: true }).click().catch(() => {})
  await page.waitForTimeout(200)
  if (/Show companion/i.test((await agentToggle.getAttribute('aria-label')) || '')) {
    await agentToggle.click(); await page.waitForTimeout(200)
  }
  await page.getByRole('tab', { name: /^Check$/i }).click().catch(async () => {
    await page.getByRole('button', { name: /^Check$/i }).click()
  })
  await page.waitForTimeout(200)
  const runBtn = page.getByRole('button', { name: /Run Continuity/i }).first()
  if (await runBtn.count()) {
    await runBtn.click()
    report.continuity = await page.evaluate(async () => {
      const samples = []
      for (let i = 0; i < 25; i++) {
        const btn = [...document.querySelectorAll('button')].find((b) =>
          /Run Continuity|Working/i.test(b.textContent || ''),
        )
        const checkLive = [...document.querySelectorAll('.companion__check-summary[aria-live], .companion__check-summary[role="alert"]')]
          .map((el) => (el.textContent || '').trim())
        const agentLive = (document.querySelector('[data-au-live="assistant-busy"]')?.textContent || '').trim()
        samples.push({
          btn: (btn?.textContent || '').trim(),
          btnBusy: btn?.getAttribute('aria-busy'),
          checkLive,
          agentLive,
        })
        await new Promise((r) => setTimeout(r, 80))
      }
      return {
        sawCheckWorking: samples.some((s) => s.checkLive.some((t) => /working/i.test(t))),
        sawBtnBusy: samples.some((s) => s.btnBusy === 'true'),
        agentLiveStayedEmptyDuring: samples
          .filter((s) => /working/i.test(s.btn) || s.btnBusy === 'true')
          .every((s) => !s.agentLive),
        peak: samples.filter((s) => s.checkLive.length || /working/i.test(s.btn)).slice(0, 5),
      }
    })
  }
  console.log('CONTINUITY', JSON.stringify(report.continuity, null, 2))

  // AU-3 push
  await page.getByRole('button', { name: 'Canon', exact: true }).click().catch(() => {})
  await page.waitForTimeout(300)
  if (/Show binder/i.test((await binderToggle.getAttribute('aria-label')) || '')) {
    await binderToggle.click(); await page.waitForTimeout(200)
  }
  const newSheet = page.getByRole('button', { name: /New sheet/i }).first()
  if (await newSheet.count()) {
    await newSheet.click()
    await page.waitForTimeout(400)
  }
  report.push = await page.evaluate(() => {
    const live = (document.querySelector('[data-au-live="binder-stack"]')?.textContent || '').trim()
    const back = document.querySelector('.binder__detail-chrome button')
    const active = document.activeElement
    return {
      live,
      liveHasEditing: /^Editing /i.test(live),
      focusName: (active?.getAttribute('aria-label') || active?.textContent || '').replace(/\s+/g, ' ').trim(),
      backAria: back?.getAttribute('aria-label'),
      dialog: !!document.querySelector('[role="dialog"]'),
      listAriaHidden: document.querySelector('.binder__stack-list')?.getAttribute('aria-hidden'),
    }
  })
  console.log('PUSH', report.push)

  // Collision sample: while Continuity just finished, trigger save + note live texts present
  report.collision = await page.evaluate(() => {
    const lives = [...document.querySelectorAll('[aria-live="polite"], [aria-live="assertive"], [role="alert"]')].map((el) => ({
      live: el.getAttribute('aria-live') || el.getAttribute('role'),
      au: el.getAttribute('data-au-live'),
      text: (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80),
      cls: String(el.className).slice(0, 40),
    })).filter((x) => x.text)
    const byChannel = {
      inbox: lives.filter((l) => l.au === 'inbox').map((l) => l.text),
      agentBusy: lives.filter((l) => l.au === 'assistant-busy').map((l) => l.text),
      binder: lives.filter((l) => l.au === 'binder-stack').map((l) => l.text),
      save: lives.filter((l) => l.cls.includes('project-status')).map((l) => l.text),
      check: lives.filter((l) => l.cls.includes('check-summary') || l.cls.includes('tool-card')).map((l) => l.text),
      other: lives.filter((l) => !l.au && !l.cls.includes('project-status') && !l.cls.includes('check') && !l.cls.includes('tool-card') && !l.cls.includes('meta')).map((l) => l.text),
    }
    return { liveCountWithText: lives.length, byChannel, lives: lives.slice(0, 20) }
  })
  console.log('COLLISION', JSON.stringify(report.collision, null, 2))

  report.pass = {
    plumbingInbox: report.plumbing.inboxLive,
    plumbingBusy: report.plumbing.busyLive,
    plumbingStack: report.plumbing.stackLive,
    metaNotLive: report.plumbing.metaLive === false,
    binderNoStatus: report.plumbing.binderStatus === 0,
    chatBusyLive: report.chatBusy?.sawLiveWorking === true,
    chatAriaBusy: report.chatBusy?.sawAriaBusy === true,
    continuityStill: report.continuity?.sawCheckWorking === true,
    continuityNoDoubleBusyLive: report.continuity?.agentLiveStayedEmptyDuring === true,
    pushEditing: report.push?.liveHasEditing === true,
    pushNoDialog: report.push?.dialog === false,
    saveStill: report.save?.sawSaving === true,
  }
  report.pass.allCritical =
    report.pass.plumbingInbox &&
    report.pass.plumbingBusy &&
    report.pass.plumbingStack &&
    report.pass.metaNotLive &&
    report.pass.chatBusyLive &&
    report.pass.chatAriaBusy &&
    report.pass.continuityStill &&
    report.pass.continuityNoDoubleBusyLive &&
    report.pass.pushEditing &&
    report.pass.pushNoDialog

  writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 2))
  console.log('PASS', report.pass)
  console.log('PROVENANCE', stack.shortHead)
  if (!report.pass.allCritical) process.exitCode = 2
} finally {
  await browser.close()
  await stack.stop()
}
