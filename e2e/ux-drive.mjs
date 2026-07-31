import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { mkdirSync, writeFileSync } from 'node:fs'

const require = createRequire('D:/npm-global/node_modules/playwright/package.json')
const pwRoot = dirname(require.resolve('playwright/package.json'))
const { chromium } = await import(pathToFileURL(resolve(pwRoot, 'index.mjs')).href)
mkdirSync('e2e/output', { recursive: true })

const notes = []
const shots = []
const startedAt = new Date().toISOString()

function checkpoint(phase, extra = {}) {
  const payload = {
    startedAt,
    updatedAt: new Date().toISOString(),
    phase,
    done: false,
    shotCount: shots.length,
    shots: shots.slice(-12),
    lastNotes: notes.slice(-20),
    results,
    ...extra,
  }
  writeFileSync('e2e/output/ux-progress.json', JSON.stringify(payload, null, 2))
  const lines = [
    `# UX drive progress (auto)`,
    ``,
    `- **phase:** ${phase}`,
    `- **updated:** ${payload.updatedAt}`,
    `- **done:** false`,
    `- **shots:** ${shots.length}`,
    ``,
    `## Latest notes`,
    ...notes.slice(-15).map((n) => `- ${n}`),
    ``,
    `## Jobs so far`,
    '```json',
    JSON.stringify(results.jobs, null, 2),
    '```',
    ``,
    `## Blockers so far`,
    ...(results.blockers.length ? results.blockers.map((b) => `- ${b}`) : ['- (none yet)']),
    ``,
    `## Should-fix so far`,
    ...(results.shouldFix.length ? results.shouldFix.map((b) => `- ${b}`) : ['- (none yet)']),
    ``,
    `If the agent session died: read this file + ux-progress.json, finish e2e/output/ux-report.md, do **not** re-drive unless phase is missing/crashed.`,
  ]
  writeFileSync('e2e/output/ux-progress.md', lines.join('\n'))
}

const log = (s) => {
  notes.push(s)
  console.log(s)
}
const fail = (s) => log('FAIL: ' + s)
const ok = (s) => log('OK: ' + s)
const warn = (s) => log('WARN: ' + s)

function hasSkyBlue(text) {
  const t = (text || '').toLowerCase()
  return t.includes('#6ea8fe') || t.includes('110, 168, 254') || t.includes('110,168,254')
}

async function sampleColors(page) {
  return page.evaluate(() => {
    const pick = (el) => {
      if (!el) return null
      const s = getComputedStyle(el)
      return { bg: s.backgroundColor, color: s.color, border: s.borderColor }
    }
    const html = document.documentElement
    const paper = document.querySelector('.manuscript__page, .manuscript')
    const cssVars = getComputedStyle(html)
    return {
      theme: html.getAttribute('data-theme'),
      reading: html.getAttribute('data-reading'),
      accent: cssVars.getPropertyValue('--color-accent').trim(),
      primary: cssVars.getPropertyValue('--color-primary').trim(),
      paper: cssVars.getPropertyValue('--color-paper').trim(),
      paperInk: cssVars.getPropertyValue('--color-paper-ink').trim(),
      canvas: cssVars.getPropertyValue('--color-canvas').trim(),
      surface: cssVars.getPropertyValue('--color-surface').trim(),
      body: pick(document.body),
      main: pick(document.querySelector('[role="main"]')),
      paperEl: pick(paper),
    }
  })
}

async function shot(page, name) {
  const path = `e2e/output/ux-${name}.png`
  await page.screenshot({ path, fullPage: false })
  shots.push(path)
  log('SHOT: ' + path)
  checkpoint(`shot:${name}`)
  return path
}

const browser = await chromium.launch({ channel: 'msedge', headless: true })
const results = { jobs: {}, visual: {}, blockers: [], shouldFix: [], nits: [] }
checkpoint('start')

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  page.setDefaultTimeout(12000)

  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' })
  const manuscript = page.getByRole('main', { name: 'Draft' })
  await manuscript.waitFor({ timeout: 15000 })
  ok('shell: Draft main present')
  checkpoint('shell-ready')

  await shot(page, '01-shell-default-desk')

  const title = page.getByLabel('Chapter title')
  const body = page.locator('textarea').first()
  await title.waitFor()
  await body.waitFor()

  const metaInfo = await page.evaluate(() => {
    const titleEl = document.querySelector('[aria-label="Chapter title"]')
    const metaCandidates = Array.from(document.querySelectorAll('main *, .manuscript *')).filter((el) => {
      const t = el.textContent || ''
      return /word|char/i.test(t) && t.length < 80
    })
    const tr = titleEl?.getBoundingClientRect()
    return metaCandidates
      .map((el) => {
        const r = el.getBoundingClientRect()
        return {
          text: (el.textContent || '').trim().slice(0, 60),
          belowTitle: tr ? r.top >= tr.bottom - 2 : null,
          y: Math.round(r.top),
        }
      })
      .filter((m) => /word|char/i.test(m.text))
      .slice(0, 8)
  })
  log('meta candidates: ' + JSON.stringify(metaInfo))

  const stamp = Date.now()
  const prose = `UX drive ${stamp}. Aria stepped into the rain-slick courtyard with blue eyes and counted three lanterns. The oath still bound her wrist.`
  await body.click()
  await body.fill(prose)

  let saved = false
  try {
    await page.getByText('Saved', { exact: true }).waitFor({ timeout: 8000 })
    saved = true
    ok('Job1 write → Saved')
  } catch {
    const t = await page
      .locator('text=/Saved|Saving|Unsaved|error/i')
      .first()
      .textContent()
      .catch(() => null)
    fail('Job1 Saved not found; nearby status=' + t)
    results.blockers.push('Write chapter does not show clear Saved trust signal within 8s')
  }
  results.jobs.writeSaved = saved
  checkpoint('job:writeSaved')
  await shot(page, '02-after-write-saved')

  const bookmark = page.locator('.manuscript__bookmark')
  const bookmarkCount = await bookmark.count()
  if (bookmarkCount === 0) {
    fail('No .manuscript__bookmark reading control on paper')
    results.blockers.push('Reading control missing on paper (expected .manuscript__bookmark)')
  } else {
    ok('bookmark present count=' + bookmarkCount)
    const bmBox = await bookmark.first().boundingBox()
    log('bookmark box=' + JSON.stringify(bmBox))
    const profiles = []
    for (let i = 0; i < 4; i++) {
      await bookmark.first().click()
      await page.waitForTimeout(200)
      const c = await sampleColors(page)
      profiles.push(c.reading || c.paper)
      await shot(page, `03-reading-${i}-${c.reading || 'unknown'}`)
    }
    log('reading cycle: ' + profiles.join(' -> '))
    const set = new Set(profiles.filter(Boolean))
    if (set.size < 3) {
      results.shouldFix.push(
        'Reading control cycle did not clearly hit 3+ distinct profiles (day/sepia/mint/night)',
      )
      warn('weak reading cycle diversity')
    } else ok('reading profiles cycle diversity ok')
  }

  const colors = await sampleColors(page)
  log('colors: ' + JSON.stringify(colors))
  if (hasSkyBlue(JSON.stringify(colors)) || /#6ea8fe/i.test(colors.accent || '')) {
    fail('Sky-blue accent detected')
    results.blockers.push('Sky-blue / #6EA8FE accent violates TOKENS (brass/stone)')
  } else {
    ok('no sky-blue in sampled tokens')
  }
  results.visual.colors = colors

  const themeBtn = page.getByRole('button', { name: /theme|light|dark|day|night|appearance/i }).first()
  if (await themeBtn.count()) {
    await themeBtn.click().catch(() => {})
    await page.waitForTimeout(250)
    const light = await sampleColors(page)
    await shot(page, '04-chrome-toggled')
    log('after theme toggle: theme=' + light.theme + ' paper=' + light.paper)
    await themeBtn.click().catch(() => {})
  } else {
    const icons = page.locator(
      'button[aria-label*="heme" i], button[title*="heme" i], button[aria-label*="ight" i]',
    )
    if (await icons.count()) {
      await icons.first().click()
      await shot(page, '04-chrome-toggled')
    } else {
      warn('no obvious theme toggle found')
      results.nits.push('Theme toggle hard to discover by accessible name')
    }
  }

  const focusBtn = page.getByRole('button', { name: /focus mode/i })
  await focusBtn.waitFor()
  await focusBtn.click()
  await page.waitForTimeout(300)
  const focusAttr = await page.locator('.shell').getAttribute('data-focus')
  log('data-focus=' + focusAttr)
  await shot(page, '05-focus-on')

  const railsHidden = await page.evaluate(() => {
    const shell = document.querySelector('.shell')
    const binder = document.querySelector('.binder, [class*="binder"]')
    const agent = document.querySelector('.agent, [class*="agent-panel"]')
    const vis = (el) => {
      if (!el) return false
      const s = getComputedStyle(el)
      if (s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) === 0) return false
      const r = el.getBoundingClientRect()
      return r.width > 8 && r.height > 8 && r.right > 0 && r.left < window.innerWidth
    }
    return {
      dataFocus: shell?.getAttribute('data-focus'),
      binderVisible: vis(binder),
      agentVisible: vis(agent),
    }
  })
  log('focus rails: ' + JSON.stringify(railsHidden))
  if (railsHidden.binderVisible || railsHidden.agentVisible) {
    results.shouldFix.push('Focus mode: binder and/or agent still visibly competing with manuscript')
    warn('Focus may not fully hide rails')
  } else {
    ok('Focus hides rails')
  }
  results.jobs.focus = true

  await focusBtn.click()
  await page.waitForTimeout(250)
  await shot(page, '06-focus-off')

  // Continuity lives in Companion Check only (no topbar button).
  const companionPanel = page.locator('.panel').filter({ has: page.getByRole('heading', { name: 'Companion' }) })
  const agentToggleBtn = page.getByRole('button', { name: /Hide companion|Show companion/i })
  if (await agentToggleBtn.count()) {
    const pressed = await agentToggleBtn.first().getAttribute('aria-pressed')
    if (pressed !== 'true') await agentToggleBtn.first().click()
  }
  await companionPanel.getByRole('button', { name: 'Check', exact: true }).click()
  const contBtn = companionPanel.getByRole('button', { name: /^Run Continuity$|^Running/i })
  await contBtn.waitFor()
  await contBtn.click()
  try {
    await page.waitForFunction(() => {
      const b = document.querySelector('[data-continuity-state]')
      return b && b.getAttribute('data-continuity-state') === 'ready'
    }, { timeout: 20000 })
    ok('Continuity finished (data-continuity-state=ready)')
  } catch {
    warn('Continuity ready signal missing after 20s')
  }
  }
  await page.waitForTimeout(300)
  await shot(page, '07-after-continuity')

  const toolCard = page.locator('.agent__tool-card').last()
  const emptyCard = page.locator('.agent__tool-card[data-continuity-result="empty"]')
  const findingsCard = page.locator('.agent__tool-card[data-continuity-result="findings"]')
  const marks = await page.locator('.mark, [class*="mark--"], [data-mark], .manuscript mark, .manuscript__mark').count().catch(() => 0)
  const proposals = await page.locator('.proposal-card, [class*="proposal"]').count().catch(() => 0)
  const emptyFeedback = (await emptyCard.count()) > 0 || (await page.getByText('No issues found').count()) > 0
  const findingsFeedback = (await findingsCard.count()) > 0 || (await toolCard.count()) > 0
  log(`marks~=${marks} proposals~=${proposals} emptyFeedback=${emptyFeedback} findingsFeedback=${findingsFeedback}`)
  const acceptCount = await page.getByRole('button', { name: /^Accept$/i }).count()
  const rejectCount = await page.getByRole('button', { name: /^Reject$/i }).count()
  const editCount = await page.getByRole('button', { name: /^Edit$/i }).count()
  log(`Accept=${acceptCount} Edit=${editCount} Reject=${rejectCount}`)
  if (!emptyFeedback && !findingsFeedback && acceptCount + rejectCount === 0 && proposals === 0 && marks === 0) {
    results.shouldFix.push(
      'Continuity finished without visible findings card or explicit empty state',
    )
    warn('Continuity silent blank outcome')
  } else {
    ok(emptyFeedback && marks + proposals === 0 ? 'Continuity empty state visible' : 'Continuity produced UI feedback')
    if (acceptCount > 0) {
      const card = page.locator('.proposal-card').first()
      if (await card.count()) {
        await card.getByRole('button', { name: /^Accept$/i }).click().catch(() => {})
        await page.waitForTimeout(400)
        await shot(page, '08-after-accept-proposal')
      }
    }
  }
  results.jobs.continuity = { marks, proposals, acceptCount, rejectCount, emptyFeedback, findingsFeedback }

  // Ensure agent rail open (desk default may still hide it)
  const agentToggle = page.getByRole('button', { name: /agent panel/i })
  for (let i = 0; i < 2; i++) {
    const open = await page.evaluate(() => {
      const el =
        document.querySelector('[aria-label="Agent panel"], .agent-panel, aside.agent, [class*="AgentPanel"]') ||
        document.querySelector('[class*="agent"]')
      if (!el) return false
      const r = el.getBoundingClientRect()
      const s = getComputedStyle(el)
      return r.width > 80 && r.height > 80 && s.display !== 'none' && s.visibility !== 'hidden'
    })
    if (open) break
    if (await agentToggle.count()) {
      await agentToggle.click({ force: true }).catch(() => {})
      await page.waitForTimeout(300)
    }
  }
  await shot(page, '09-agent-panel')

  const agentDom = await page.evaluate(() => {
    const asides = Array.from(document.querySelectorAll('aside, [class*="agent"], [aria-label*="agent" i]'))
      .map((el) => {
        const r = el.getBoundingClientRect()
        return {
          tag: el.tagName,
          cls: (el.className || '').toString().slice(0, 80),
          aria: el.getAttribute('aria-label'),
          w: Math.round(r.width),
          h: Math.round(r.height),
          inputs: el.querySelectorAll('textarea, input, [contenteditable="true"]').length,
          text: (el.innerText || '').slice(0, 120).replace(/\s+/g, ' '),
        }
      })
      .filter((x) => x.w > 40 && x.h > 40)
      .slice(0, 8)
    const fields = Array.from(document.querySelectorAll('textarea, input[type="text"], [contenteditable="true"]'))
      .map((el) => {
        const r = el.getBoundingClientRect()
        return {
          tag: el.tagName,
          type: el.getAttribute('type'),
          ph: el.getAttribute('placeholder'),
          aria: el.getAttribute('aria-label'),
          cls: (el.className || '').toString().slice(0, 60),
          w: Math.round(r.width),
          h: Math.round(r.height),
          x: Math.round(r.x),
        }
      })
      .filter((f) => f.w > 40 && f.h > 10)
    return { asides, fields }
  })
  log('agentDom: ' + JSON.stringify(agentDom))

  // Co-write Apply is skill-button driven (Continue / Rewrite / Brainstorm), not freeform chat Send.
  let applyOk = false
  const beforeBody = await body.inputValue()
  await body.evaluate((element) => {
    const textarea = element
    textarea.focus()
    textarea.setSelectionRange(textarea.value.length, textarea.value.length)
    textarea.dispatchEvent(new Event('select', { bubbles: true }))
  }).catch(() => undefined)
  const continueBtn = page.getByRole('button', { name: /^Continue$/i })
  if (await continueBtn.count()) {
    await continueBtn.click()
    try {
      await page.getByRole('button', { name: /^Apply$/i }).first().waitFor({ timeout: 20000 })
      await shot(page, '10-apply-card')
      const bodyMid = await body.inputValue()
      if (bodyMid !== beforeBody) {
        fail('Draft changed before Apply')
        results.blockers.push('Co-write altered manuscript before explicit Apply')
      } else {
        ok('manuscript unchanged pre-Apply')
      }
      await page.getByRole('button', { name: /^Apply$/i }).first().click()
      await page.waitForTimeout(600)
      const after = await body.inputValue()
      if (after !== beforeBody) {
        ok('Apply changed body')
        applyOk = true
      } else {
        warn('Apply clicked but body unchanged')
        results.shouldFix.push('Apply control present but body did not change (or applied elsewhere)')
      }
      await shot(page, '11-after-apply')
    } catch (e) {
      warn('No Apply card after Continue: ' + (e.message || e))
      await shot(page, '10-agent-no-apply')
      results.blockers.push('Continue did not surface an Apply card within 20s')
    }
  } else {
    fail('Continue co-write control not found')
    results.blockers.push('Co-write Continue control not discoverable — Apply path broken')
    await shot(page, '09-agent-missing-cowrite')
  }
  results.jobs.apply = applyOk

  let multiOk = false
  const topbarText = await page
    .locator('header, .topbar, [class*="top-bar"], [class*="topbar"]')
    .first()
    .innerText()
    .catch(() => '')
  log('topbar text snippet: ' + (topbarText || '').slice(0, 200).replace(/\s+/g, ' '))

  const newProj = page.getByRole('button', { name: /new project|create project|\+ project/i })
  const projMenu = page.getByRole('button', { name: /projects?$/i }).or(page.locator('[aria-label*="project" i]'))
  if (await newProj.count()) {
    await newProj.first().click()
    await page.waitForTimeout(400)
    const dialog = page.getByRole('dialog')
    if (await dialog.count()) {
      const input = dialog.locator('input').first()
      if (await input.count()) await input.fill('Harbor Draft-' + stamp.toString(36).slice(-4))
      await dialog.getByRole('button', { name: /create|ok|save|add/i }).click().catch(() => {})
    }
    await page.waitForTimeout(600)
    await shot(page, '12-new-project')
    multiOk = true
    ok('project create/switch interacted')
  } else if (await projMenu.count()) {
    await projMenu.first().click()
    await page.waitForTimeout(300)
    await shot(page, '12-project-menu')
    multiOk = true
  } else {
    const any = page.locator('button, [role="button"]').filter({ hasText: /untitled|project|story|novel/i })
    if (await any.count()) {
      await any.first().click().catch(() => {})
      await page.waitForTimeout(300)
      await shot(page, '12-project-affordance')
      multiOk = true
      ok('project affordance clicked')
    } else {
      warn('multi-project UI not obvious from labels')
      results.shouldFix.push('Create/switch project not obvious without tribal knowledge')
    }
  }
  results.jobs.multiProject = multiOk

  for (const name of ['Research', 'Canon']) {
    const btn = page.getByRole('button', { name: new RegExp('^' + name + '$', 'i') })
    if (await btn.count()) {
      await btn.first().click()
      await page.waitForTimeout(500)
      await shot(page, '13-' + name.toLowerCase())
      ok(name + ' surface opened')
      if (name === 'Canon') {
        const contVisible = await page.locator('button.shell__action-continuity').count()
        if (contVisible !== 0) {
          results.shouldFix.push('Continuity still present in topbar')
          warn('Topbar Continuity should be removed')
        } else ok('No topbar Continuity on Canon')
      }
      results.jobs[name.toLowerCase()] = true
      const msBtn = page.getByRole('button', { name: /manuscript|editor|chapter/i })
      if (await msBtn.count()) await msBtn.first().click().catch(() => {})
      await page.keyboard.press('Escape').catch(() => {})
    } else {
      log('no ' + name + ' button')
      results.jobs[name.toLowerCase()] = false
    }
  }

  // Export lives under project overflow (IA_MAP §6.2 / S1 calm top bar)
  {
    const menu = page.getByRole('button', { name: 'Project menu' })
    if (await menu.count()) {
      await menu.click()
      const exportItem = page.getByRole('menuitem', { name: /Export|Export markdown/i })
      if (await exportItem.count()) {
        const downloadPromise = page.waitForEvent('download', { timeout: 10000 }).catch(() => null)
        await exportItem.click()
        const download = await downloadPromise
        await shot(page, '13-export')
        if (download) {
          ok('Export started download via project menu')
          results.jobs.export = true
        } else {
          warn('Export clicked but no download event')
          results.shouldFix.push('Export control present but download did not start')
          results.jobs.export = false
        }
      } else {
        await page.keyboard.press('Escape').catch(() => {})
        log('no Export menuitem')
        results.jobs.export = false
        results.blockers.push('Export control not discoverable in project menu')
      }
    } else {
      log('no Project menu')
      results.jobs.export = false
      results.blockers.push('Project menu not discoverable for Export')
    }
  }

  const genInMs = await page.evaluate(() => {
    const main = document.querySelector('[role="main"][aria-label="Draft"], main.manuscript, .manuscript')
    if (!main) return []
    return Array.from(main.querySelectorAll('button, [role="button"]'))
      .map((b) => (b.textContent || '').trim())
      .filter((t) => /generat|continue|rewrite|ai|co-?write|suggest/i.test(t))
      .slice(0, 10)
  })
  if (genInMs.length) {
    fail('gen chips inside manuscript: ' + genInMs.join(', '))
    results.blockers.push('Gen/action chips inside manuscript column: ' + genInMs.join(', '))
  } else ok('no gen chips in manuscript column')

  const topBtns = await page.evaluate(() => {
    const bar =
      document.querySelector('header, .topbar, .shell__top, [class*="topbar"]') || document.body
    return Array.from(bar.querySelectorAll('button'))
      .map((b) => (b.getAttribute('aria-label') || b.textContent || '').trim().replace(/\s+/g, ' '))
      .filter(Boolean)
      .slice(0, 30)
  })
  log('top controls: ' + JSON.stringify(topBtns))
  if (topBtns.length > 12) {
    results.nits.push(
      'Top bar control pile dense (' + topBtns.length + ' buttons) — consider grouping secondary tools',
    )
  }

  const narrow = await browser.newPage({ viewport: { width: 1280, height: 800 } })
  await narrow.goto('http://localhost:5173/', { waitUntil: 'networkidle' })
  await narrow.getByRole('main', { name: 'Draft' }).waitFor()
  await shot(narrow, '14-width-1280')
  const sealInfo = await narrow.evaluate(() => {
    const bm = document.querySelector('.manuscript__bookmark')
    if (!bm) return null
    const r = bm.getBoundingClientRect()
    const s = getComputedStyle(bm)
    return {
      w: Math.round(r.width),
      h: Math.round(r.height),
      radius: s.borderRadius,
      className: bm.className,
    }
  })
  log('1280 bookmark: ' + JSON.stringify(sealInfo))
  if (sealInfo && sealInfo.w > 60 && sealInfo.h > 100) {
    results.shouldFix.push(
      'At 1280 (<1366) reading control still ribbon-like; doctrine wants circle seal inside page',
    )
    warn('seal/ribbon breakpoint mismatch at 1280')
  } else if (sealInfo) {
    ok('1280 reading control compact (seal-ish)')
  }

  await narrow.setViewportSize({ width: 1024, height: 800 })
  await narrow.waitForTimeout(200)
  await shot(narrow, '15-width-1024')
  const seal1024 = await narrow.evaluate(() => {
    const bm = document.querySelector('.manuscript__bookmark')
    if (!bm) return null
    const r = bm.getBoundingClientRect()
    return { w: Math.round(r.width), h: Math.round(r.height), className: bm.className }
  })
  log('1024 bookmark: ' + JSON.stringify(seal1024))

  await narrow.setViewportSize({ width: 767, height: 800 })
  await narrow.waitForTimeout(250)
  await shot(narrow, '16-width-767-phone')
  const phoneIA = await narrow.evaluate(() => {
    return Array.from(document.querySelectorAll('button'))
      .map((b) => (b.getAttribute('aria-label') || b.textContent || '').trim())
      .filter(Boolean)
      .slice(0, 25)
  })
  log('phone controls: ' + JSON.stringify(phoneIA))

  const dismissDrawer = async (p) => {
    await p.keyboard.press('Escape').catch(() => {})
    await p.locator('.ui-drawer__backdrop').click({ force: true }).catch(() => {})
    await p.waitForTimeout(200)
  }

  const binderBtn = narrow.getByRole('button', { name: /binder/i })
  if (await binderBtn.count()) {
    await binderBtn.first().click()
    await narrow.waitForTimeout(300)
    await shot(narrow, '17-phone-binder')
    await dismissDrawer(narrow)
  }
  const agentBtn = narrow.getByRole('button', { name: /agent panel|show agent|hide agent/i })
  if (await agentBtn.count()) {
    await agentBtn.first().click({ force: true })
    await narrow.waitForTimeout(300)
    await shot(narrow, '18-phone-agent')
    await dismissDrawer(narrow)
  } else {
    warn('phone agent toggle not found')
  }

  const desk2 = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  await desk2.goto('http://localhost:5173/', { waitUntil: 'networkidle' })
  await desk2.getByRole('main', { name: 'Draft' }).waitFor()
  const ribbon = await desk2.evaluate(() => {
    const bm = document.querySelector('.manuscript__bookmark')
    if (!bm) return null
    const r = bm.getBoundingClientRect()
    const pageEl = document.querySelector('.manuscript__page')
    const pr = pageEl?.getBoundingClientRect()
    return {
      w: Math.round(r.width),
      h: Math.round(r.height),
      x: Math.round(r.x),
      rightEdge: pr ? Math.abs(pr.right - r.right) < 40 : null,
      className: bm.className,
    }
  })
  log('1440 ribbon: ' + JSON.stringify(ribbon))
  if (ribbon && ribbon.w >= 40) ok('desk ribbon present')
  await shot(desk2, '19-desk-ribbon-detail')

  await desk2.getByRole('button', { name: /agent panel/i }).click().catch(() => {})
  await shot(desk2, '20-agent-empty-or-transcript')

  await page.close()
  await narrow.close()
  await desk2.close()
} catch (e) {
  fail('driver crash: ' + ((e && e.stack) || e))
  results.blockers.push('UX driver crashed: ' + ((e && e.message) || e))
  checkpoint('crashed', { error: String((e && e.message) || e) })
} finally {
  await browser.close()
}

const finishedAt = new Date().toISOString()
writeFileSync('e2e/output/ux-notes.json', JSON.stringify({ startedAt, finishedAt, notes, shots, results }, null, 2))
writeFileSync(
  'e2e/output/ux-progress.json',
  JSON.stringify(
    {
      startedAt,
      updatedAt: finishedAt,
      finishedAt,
      phase: 'done',
      done: true,
      shotCount: shots.length,
      shots,
      lastNotes: notes.slice(-40),
      results,
    },
    null,
    2,
  ),
)
writeFileSync(
  'e2e/output/ux-progress.md',
  [
    `# UX drive progress (complete)`,
    ``,
    `- **phase:** done`,
    `- **finished:** ${finishedAt}`,
    `- **shots:** ${shots.length}`,
    ``,
    `## SUMMARY`,
    '```json',
    JSON.stringify(results, null, 2),
    '```',
    ``,
    `## All shots`,
    ...shots.map((s) => `- ${s}`),
    ``,
    `Next: agent writes e2e/output/ux-report.md (see docs/UX_PASS.md). Read ≤4 PNGs. Chat 3 lines.`,
  ].join('\n'),
)
console.log('\n=== SUMMARY ===')
console.log(JSON.stringify(results, null, 2))
console.log('Progress files: e2e/output/ux-progress.md + ux-progress.json + ux-notes.json')
