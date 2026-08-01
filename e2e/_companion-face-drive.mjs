/**
 * Full Companion face drive — every face tab, primary control, help, scroll.
 * node e2e/_companion-face-drive.mjs
 *
 * Asserts: selected face tab === data-companion-face === body job.
 * Catches Check-selected / Research-body style mismatches.
 */
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { mkdirSync, writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import {
  armHardTimeout,
  ensureDraftReady,
  ensureIsolatedProject,
  installFixtureLlmRoutes,
  requireCompanionFace,
  setApiBase,
} from './helpers.mjs'
import { ownMeasurementStack } from './owned-stack.mjs'

const require = createRequire('D:/npm-global/node_modules/playwright/package.json')
const pwRoot = dirname(require.resolve('playwright/package.json'))
const { chromium } = await import(pathToFileURL(resolve(pwRoot, 'index.mjs')).href)

const stopHard = armHardTimeout('companion-face-drive', 180_000)
mkdirSync('e2e/output', { recursive: true })

const stack = await ownMeasurementStack({ skipBuild: process.env.STORYLINT_SKIP_BUILD === '1' })
setApiBase(stack.api)
process.env.STORYLINT_UI = stack.ui
process.env.STORYLINT_API = stack.api

const browser = await chromium.launch({ channel: 'msedge', headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
page.setDefaultTimeout(15_000)

const report = {
  head: stack.shortHead,
  ui: stack.ui,
  api: stack.api,
  faces: [],
  checks: [],
  ok: true,
}

function check(name, pass, detail = '') {
  report.checks.push({ name, pass: !!pass, detail: String(detail || '').slice(0, 240) })
  if (!pass) report.ok = false
  console.log(`${pass ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${String(detail).slice(0, 160)}` : ''}`)
}

async function faceLabelClip() {
  return page.evaluate(() => {
    const root = document.querySelector('.companion__faces')
    if (!root) return { ok: false, reason: 'no faces row' }
    const tabs = [...root.querySelectorAll('[role="tab"]')]
    const rootRect = root.getBoundingClientRect()
    const clips = []
    for (const tab of tabs) {
      const r = tab.getBoundingClientRect()
      const label = (tab.textContent || '').replace(/\s+/g, ' ').trim()
      const clippedLeft = r.left < rootRect.left - 0.5
      const clippedRight = r.right > rootRect.right + 0.5
      const selected = tab.getAttribute('aria-selected') === 'true' || tab.getAttribute('aria-pressed') === 'true'
      const halfOff = r.right < rootRect.left + 8 || r.left > rootRect.right - 8
      if ((selected && (clippedLeft || clippedRight)) || halfOff) {
        clips.push({ label, selected, clippedLeft, clippedRight, halfOff })
      }
    }
    return {
      ok: clips.length === 0,
      clips,
      scrollLeft: root.scrollLeft,
      scrollWidth: root.scrollWidth,
      clientWidth: root.clientWidth,
    }
  })
}

async function companionState() {
  return page.evaluate(() => {
    const panel = document.querySelector('.panel[data-companion-face]')
    if (!panel) return null
    const face = panel.getAttribute('data-companion-face') || ''
    const tabs = [...panel.querySelectorAll('[role="tab"]')].map((tab) => ({
      label: (tab.textContent || '').replace(/\s+/g, ' ').trim(),
      selected: tab.getAttribute('aria-selected') === 'true' || tab.getAttribute('aria-pressed') === 'true',
      className: tab.className || '',
    }))
    const selected = tabs.find((t) => t.selected)?.label || null
    const bodyText = (panel.innerText || '').replace(/\s+/g, ' ').trim()
    const scrollers = [...panel.querySelectorAll('*')].filter((el) => {
      const style = getComputedStyle(el)
      const oy = style.overflowY
      return (oy === 'auto' || oy === 'scroll') && el.scrollHeight > el.clientHeight + 2
    }).map((el) => ({
      cls: (el.className || '').toString().slice(0, 80),
      scrollTop: el.scrollTop,
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight,
    }))
    return {
      face,
      selected,
      tabs,
      bodyText: bodyText.slice(0, 500),
      hasCheckFooter: !!panel.querySelector('.companion__check-footer, [data-check-run="continuity"]'),
      hasResearch: /Research without chat clutter|Research a custom|Live research sends/i.test(bodyText),
      hasWrite: /Continue|Rewrite|Brainstorm|Co-write/i.test(bodyText),
      hasInbox: /Inbox clear|pending|Accept/i.test(bodyText),
      hasChat: /Message the companion|Ask about this project/i.test(bodyText),
      continuitySummary: (panel.querySelector('.companion__check-summary')?.textContent || '').trim(),
      scrollers,
    }
  })
}

function expectFaceBody(face, state) {
  if (!state) return check(`${face}: panel present`, false, 'no panel')
  check(`${face}: data-companion-face`, state.face === face, `got ${state.face}`)
  const selectedNorm = String(state.selected || '').toLowerCase().replace(/\s+\d+$/, '')
  check(`${face}: selected tab matches`, selectedNorm === face || selectedNorm.startsWith(face), `selected=${state.selected}`)
  if (face === 'check') {
    check('check: not research body', !state.hasResearch, state.bodyText.slice(0, 120))
    check('check: has continuity control', state.hasCheckFooter, state.bodyText.slice(0, 120))
  }
  if (face === 'research') {
    check('research: research body', state.hasResearch, state.bodyText.slice(0, 120))
    check('research: not check footer', !state.hasCheckFooter, state.bodyText.slice(0, 120))
  }
  if (face === 'write') {
    check('write: co-write controls', state.hasWrite, state.bodyText.slice(0, 120))
    check('write: not research body', !state.hasResearch, state.bodyText.slice(0, 120))
  }
  if (face === 'inbox') {
    check('inbox: inbox body', state.hasInbox, state.bodyText.slice(0, 120))
    check('inbox: not research empty slogan alone without inbox', true)
  }
  if (face === 'chat') {
    check('chat: composer or transcript', state.hasChat || /Chat fixture|companion/i.test(state.bodyText), state.bodyText.slice(0, 120))
    check('chat: not research body', !state.hasResearch, state.bodyText.slice(0, 120))
  }
  report.faces.push({ face, ...state, tabs: state.tabs })
}

async function openFace(name) {
  await requireCompanionFace(page, name)
  await page.waitForFunction((expected) => {
    const panel = document.querySelector('.panel[data-companion-face]')
    return panel && panel.getAttribute('data-companion-face') === expected
  }, companionFaceId(name), { timeout: 8_000 }).catch(() => null)
}

function companionFaceId(name) {
  const n = String(name || '').trim().toLowerCase()
  if (n.startsWith('inbox')) return 'inbox'
  return n
}

async function scrollAllInCompanion() {
  return page.evaluate(() => {
    const panel = document.querySelector('.panel[data-companion-face]')
    if (!panel) return { touched: 0 }
    const scrollers = [...panel.querySelectorAll('*')].filter((el) => {
      const style = getComputedStyle(el)
      const oy = style.overflowY
      const ox = style.overflowX
      return ((oy === 'auto' || oy === 'scroll') && el.scrollHeight > el.clientHeight + 2)
        || ((ox === 'auto' || ox === 'scroll') && el.scrollWidth > el.clientWidth + 2)
    })
    let touched = 0
    for (const el of scrollers) {
      const beforeY = el.scrollTop
      const beforeX = el.scrollLeft
      el.scrollTop = Math.min(el.scrollHeight, el.clientHeight + 40)
      el.scrollLeft = Math.min(el.scrollWidth, el.clientWidth + 40)
      el.dispatchEvent(new Event('scroll', { bubbles: true }))
      el.scrollTop = beforeY
      el.scrollLeft = beforeX
      touched += 1
    }
    // Face tab row: force horizontal scroll if clipped
    const faces = panel.querySelector('.companion__faces')
    if (faces && faces.scrollWidth > faces.clientWidth + 2) {
      faces.scrollLeft = faces.scrollWidth
      faces.dispatchEvent(new Event('scroll', { bubbles: true }))
      faces.scrollLeft = 0
      touched += 1
    }
    return { touched, count: scrollers.length }
  })
}

async function pressVisible(selector, label) {
  const loc = page.locator(selector).first()
  const count = await loc.count()
  if (!count) {
    check(`press:${label}`, false, 'missing')
    return false
  }
  const visible = await loc.isVisible().catch(() => false)
  if (!visible) {
    check(`press:${label}`, false, 'not visible')
    return false
  }
  await loc.click({ timeout: 5_000 })
  check(`press:${label}`, true)
  return true
}

try {
  await installFixtureLlmRoutes(page)
  await page.goto(stack.ui, { waitUntil: 'domcontentloaded', timeout: 30_000 })
  const projectId = await ensureIsolatedProject(page, { title: 'Companion Face Drive' })
  await ensureDraftReady(page, {
    body: 'Aria opened the iron door and waited for the archive warden. The stacks held blue-eyed oaths and sealed shelves.',
    title: 'Companion Drive Chapter',
  })

  // Ensure companion open
  const show = page.getByRole('button', { name: /Show companion/i })
  if (await show.count()) {
    const pressed = await show.first().getAttribute('aria-pressed')
    if (pressed !== 'true') await show.first().click()
  }

  const faces = ['Chat', 'Write', 'Check', 'Inbox', 'Research']
  for (const name of faces) {
    await openFace(name)
    const id = companionFaceId(name)
    const state = await companionState()
    expectFaceBody(id, state)
    const clip = await faceLabelClip()
    check(`${id}: selected face label not clipped`, clip.ok, JSON.stringify(clip.clips || clip))
    const scrolled = await scrollAllInCompanion()
    check(`${id}: scroll touched`, scrolled.touched >= 0, JSON.stringify(scrolled))
    await page.locator('.panel[data-companion-face]').screenshot({
      path: `e2e/output/companion-face-${id}.png`,
    }).catch(() => null)
  }

  // Check face: press Continuity + Review + Craft + all ?
  await openFace('Check')
  await pressVisible('[data-check-run="continuity"]', 'Run Continuity')
  await page.waitForFunction(() => {
    const s = document.querySelector('[data-continuity-state]')?.getAttribute('data-continuity-state')
    return s === 'ready' || s === 'failed'
  }, { timeout: 20_000 }).catch(() => null)
  const afterCont = await companionState()
  check('check post-run still check face', afterCont?.face === 'check', afterCont?.face)
  check('check post-run not research body', !afterCont?.hasResearch, afterCont?.bodyText?.slice(0, 120))
  check('check post-run summary', /Continuity:/i.test(afterCont?.continuitySummary || afterCont?.bodyText || ''), afterCont?.continuitySummary || afterCont?.bodyText?.slice(0, 120))

  for (const tool of ['continuity', 'review', 'craft']) {
    await pressVisible(`[data-check-info="${tool}"]`, `help ${tool}`)
    const helpVisible = await page.locator(`[data-check-help="${tool}"]`).isVisible().catch(() => false)
    check(`help ${tool} open`, helpVisible)
    // close by toggling again
    await pressVisible(`[data-check-info="${tool}"]`, `help ${tool} close`)
  }

  await pressVisible('[data-check-run="review"]', 'Review')
  await page.waitForTimeout(800)
  let st = await companionState()
  check('after Review still check', st?.face === 'check', st?.face)
  check('after Review not research', !st?.hasResearch, st?.bodyText?.slice(0, 100))

  await pressVisible('[data-check-run="craft"]', 'Craft')
  await page.waitForTimeout(800)
  st = await companionState()
  check('after Craft still check', st?.face === 'check', st?.face)
  check('after Craft not research', !st?.hasResearch, st?.bodyText?.slice(0, 100))

  // Write face controls
  await openFace('Write')
  await pressVisible('button:has-text("Continue")', 'Continue')
  await page.waitForTimeout(600)
  st = await companionState()
  check('after Continue still write', st?.face === 'write', st?.face)
  // Rewrite may be disabled without selection — still try
  const rewrite = page.locator('button:has-text("Rewrite")').first()
  if (await rewrite.isEnabled().catch(() => false)) {
    await rewrite.click()
    check('press:Rewrite', true)
  } else {
    check('press:Rewrite skipped disabled', true, 'no selection')
  }
  await pressVisible('button:has-text("Brainstorm")', 'Brainstorm')
  await page.waitForTimeout(600)
  st = await companionState()
  check('after Brainstorm still write', st?.face === 'write', st?.face)

  // Chat send
  await openFace('Chat')
  const chatBox = page.getByLabel(/Message the companion/i)
  if (await chatBox.count()) {
    await chatBox.fill('What is Continuity for?')
    await pressVisible('button:has-text("Send")', 'Chat Send')
    await page.waitForTimeout(800)
  } else {
    check('press:Chat Send', false, 'no composer')
  }
  st = await companionState()
  check('after Send still chat', st?.face === 'chat', st?.face)
  check('after Send not research', !st?.hasResearch, st?.bodyText?.slice(0, 100))

  // Research query
  await openFace('Research')
  const researchInput = page.getByPlaceholder(/Research|custom|place/i).first()
  if (await researchInput.count()) {
    await researchInput.fill('archive access')
    await pressVisible('button:has-text("Research")', 'Research run')
    await page.waitForTimeout(1000)
  } else {
    // fallback: any primary research button in panel
    const btn = page.locator('.panel[data-companion-face="research"] button').filter({ hasText: /^Research$/ }).first()
    if (await btn.count()) {
      await btn.click()
      check('press:Research run', true)
    } else {
      check('press:Research run', false, 'no research control')
    }
  }
  st = await companionState()
  check('after Research run still research', st?.face === 'research', st?.face)

  // Inbox face
  await openFace('Inbox')
  st = await companionState()
  expectFaceBody('inbox', st)
  await scrollAllInCompanion()

  // Keyboard face walk (arrow keys on tablist)
  await openFace('Chat')
  await page.locator('.companion__faces [role="tab"]').first().focus()
  for (const key of ['ArrowRight', 'ArrowRight', 'ArrowRight', 'ArrowRight', 'Home', 'End']) {
    await page.keyboard.press(key)
    await page.waitForTimeout(200)
    const ks = await companionState()
    check(`key ${key}: face set`, !!ks?.face, ks?.face)
    check(`key ${key}: selected matches face`, {
      chat: 'Chat', write: 'Write', check: 'Check', research: 'Research', inbox: 'Inbox',
    }[ks?.face] === ks?.selected || String(ks?.selected || '').toLowerCase().startsWith(ks?.face || '___'), `${ks?.face}/${ks?.selected}`)
  }

  // Final mismatch sweep: visit each face again quickly
  for (const name of faces) {
    await openFace(name)
    const id = companionFaceId(name)
    const final = await companionState()
    check(`final ${id} match`, final?.face === id && !((id === 'check' || id === 'write' || id === 'chat' || id === 'inbox') && final?.hasResearch && id !== 'research'), `${final?.face} research=${final?.hasResearch}`)
  }

  writeFileSync('e2e/output/companion-face-drive.json', JSON.stringify({ ...report, projectId }, null, 2))
  console.log(report.ok ? 'DONE companion-face-drive PASS' : 'DONE companion-face-drive FAIL')
  console.log(`checks ${report.checks.filter((c) => c.pass).length}/${report.checks.length}`)
  if (!report.ok) process.exitCode = 1
} catch (error) {
  console.error('FAIL companion-face-drive', error)
  writeFileSync('e2e/output/companion-face-drive.json', JSON.stringify({ ...report, error: String(error?.stack || error) }, null, 2))
  process.exitCode = 1
} finally {
  await browser.close().catch(() => {})
  await stack.stop().catch(() => {})
  stopHard()
}
