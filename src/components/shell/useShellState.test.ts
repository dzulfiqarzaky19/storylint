import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  railAllowedAt,
  regionVisibility,
  type ShellLayout,
  type ShellRegion,
  type ShellVisibility,
} from './useShellState.ts'

const LAYOUTS: ShellLayout[] = ['compact', 'medium', 'wide']
const REGIONS: ShellRegion[] = ['binder', 'agent']

function state(patch: Partial<ShellVisibility> = {}): ShellVisibility {
  return {
    layout: 'wide',
    focus: false,
    rails: { binder: true, agent: true },
    drawer: null,
    ...patch,
  }
}

test('focus hides binder and agent at every width', () => {
  for (const layout of LAYOUTS) {
    for (const region of REGIONS) {
      const visible = regionVisibility(
        state({ layout, focus: true, drawer: region }),
        region,
      )
      assert.deepEqual(visible, { rail: false, drawer: false }, `${layout}/${region}`)
    }
  }
})

test('both rails show at wide when open', () => {
  for (const region of REGIONS) {
    assert.equal(regionVisibility(state(), region).rail, true, region)
  }
})

test('agent has no rail below bp.lg; binder keeps its rail down to bp.md', () => {
  assert.equal(railAllowedAt('medium', 'binder'), true)
  assert.equal(railAllowedAt('medium', 'agent'), false)
  assert.equal(railAllowedAt('compact', 'binder'), false)
  assert.equal(railAllowedAt('compact', 'agent'), false)
})

test('a closed rail hides the region without opening a drawer', () => {
  const visible = regionVisibility(state({ rails: { binder: false, agent: true } }), 'binder')
  assert.deepEqual(visible, { rail: false, drawer: false })
})

test('compact presents an opened region as a drawer, not a rail', () => {
  const visible = regionVisibility(state({ layout: 'compact', drawer: 'binder' }), 'binder')
  assert.deepEqual(visible, { rail: false, drawer: true })
})

test('only the requested region drawers open', () => {
  const s = state({ layout: 'compact', drawer: 'agent' })
  assert.equal(regionVisibility(s, 'agent').drawer, true)
  assert.equal(regionVisibility(s, 'binder').drawer, false)
})

test('manuscript is the only region left in focus mode', () => {
  const s = state({ focus: true })
  const anyVisible = REGIONS.some((r) => {
    const v = regionVisibility(s, r)
    return v.rail || v.drawer
  })
  assert.equal(anyVisible, false)
})
