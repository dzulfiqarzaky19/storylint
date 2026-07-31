import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

/**
 * Rail budget guard (TOKENS.md §4 / density audit D1).
 *
 * The manuscript is the work surface; the two rails are navigation and help.
 * This locks the arithmetic so a future "just 40px wider" change to either rail
 * has to face the number it costs the page.
 */

const css = readFileSync(new URL('./tokens.css', import.meta.url), 'utf8')

function px(name: string): number {
  const match = css.match(new RegExp(`--${name}:\\s*(\\d+)px`))
  assert.ok(match, `token --${name} not found in tokens.css`)
  return Number(match[1])
}

/** Each row: the viewport class, and the rail tokens shell.css applies there. */
const CLASSES = [
  { at: 1024, binder: 'size-binder-lg', agent: 'size-agent-lg' },
  { at: 1280, binder: 'size-binder-lg', agent: 'size-agent-lg' },
  { at: 1440, binder: 'size-binder-xl', agent: 'size-agent-xl' },
  { at: 1680, binder: 'size-binder-xl', agent: 'size-agent-xl' },
  { at: 1920, binder: 'size-binder-2xl', agent: 'size-agent-2xl' },
] as const

/**
 * Dual rails are only a *default* at desk class; below that the companion starts closed.
 * Under ~1100px the arithmetic is unwinnable anyway: two rails at their readable
 * minimum already eat half the viewport, which is the reason the default changed
 * rather than the minimum shrinking.
 */
const BP_DESK = 1366

test('at desk class and above, both rails open keep the work surface >= 60%', () => {
  for (const { at, binder, agent } of CLASSES.filter((c) => c.at >= BP_DESK)) {
    const chrome = px(binder) + px(agent)
    const workPct = ((at - chrome) / at) * 100
    assert.ok(
      workPct >= 60,
      `${at}px: work surface ${workPct.toFixed(1)}% is under the 60% rail budget (rails ${chrome}px)`,
    )
  }
})

test('below desk class the default single rail leaves the work surface >= 60%', () => {
  // binder only — the companion is not open by default under bp.desk
  for (const { at, binder } of CLASSES.filter((c) => c.at < BP_DESK)) {
    const workPct = ((at - px(binder)) / at) * 100
    assert.ok(
      workPct >= 60,
      `${at}px: default work surface ${workPct.toFixed(1)}% is under the 60% rail budget`,
    )
  }
})

test('rails stay readable — never narrower than the binder/agent minimum', () => {
  const binderMin = px('size-binder-min')
  const agentMin = px('size-agent-min')
  for (const { at, binder, agent } of CLASSES) {
    assert.ok(px(binder) >= binderMin, `${at}px: binder ${px(binder)}px is below min ${binderMin}px`)
    assert.ok(px(agent) >= agentMin, `${at}px: agent ${px(agent)}px is below min ${agentMin}px`)
  }
})

test('rails never shrink as the desk grows', () => {
  const steps = ['size-binder', 'size-binder-lg', 'size-binder-xl', 'size-binder-2xl']
  const agentSteps = ['size-agent', 'size-agent-lg', 'size-agent-xl', 'size-agent-2xl']
  for (const ladder of [steps, agentSteps]) {
    for (let i = 1; i < ladder.length; i += 1) {
      assert.ok(
        px(ladder[i]) >= px(ladder[i - 1]),
        `${ladder[i]} (${px(ladder[i])}px) is narrower than ${ladder[i - 1]} (${px(ladder[i - 1])}px)`,
      )
    }
  }
})
