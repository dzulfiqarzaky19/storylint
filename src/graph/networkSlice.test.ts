import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { SheetKind } from '../domain/types.ts'
import {
  NETWORK_VOLUME_THRESHOLD,
  chooseNetworkSlice,
  countKinds,
  defaultSystemSlice,
  emptyNetworkSliceState,
  networkSliceView,
  reconcileNetworkSlice,
  type KindCounts,
  type NetworkSliceState,
} from './networkSlice.ts'

const LABELS: Record<SheetKind, string> = {
  character: 'Characters',
  lore: 'Lore',
  world: 'World',
  organization: 'Organizations',
}

function counts(partial: Partial<KindCounts>): KindCounts {
  return {
    character: 0,
    lore: 0,
    world: 0,
    organization: 0,
    ...partial,
  }
}

/** N nodes of mixed kinds with a dominant Characters cast. */
function volumeCounts(n: number, characterShare = 0.6): KindCounts {
  const character = Math.max(1, Math.round(n * characterShare))
  const rest = n - character
  const lore = Math.floor(rest / 2)
  const world = rest - lore
  return counts({ character, lore, world })
}

test('T is 24 (ox C1 binding)', () => {
  assert.equal(NETWORK_VOLUME_THRESHOLD, 24)
})

test('N=5 first paint is All; filters idle; honesty off', () => {
  const state = reconcileNetworkSlice(emptyNetworkSliceState(), volumeCounts(5))
  const view = networkSliceView(state, volumeCounts(5), LABELS)
  assert.equal(view.selection.mode, 'all')
  assert.equal(view.sliceSource, 'system')
  assert.equal(view.narrowed, false)
  assert.equal(view.honesty, null)
  assert.equal(view.visibleCount, 5)
  assert.equal(view.totalN, 5)
  assert.equal(view.kinds.size, 4)
})

test('N≥T first paint system-narrows to Characters by default', () => {
  const n = NETWORK_VOLUME_THRESHOLD
  const c = volumeCounts(n)
  const state = reconcileNetworkSlice(emptyNetworkSliceState(), c)
  const view = networkSliceView(state, c, LABELS)
  assert.equal(state.sliceSource, 'system')
  assert.deepEqual(state.selection, { mode: 'kind', kind: 'character' })
  assert.equal(view.narrowed, true)
  assert.deepEqual(view.honesty, {
    visible: c.character,
    total: n,
    kindLabel: 'Characters',
  })
  assert.deepEqual([...view.kinds], ['character'])
})

test('default system slice prefers last-used kind when present', () => {
  const c = counts({ character: 20, lore: 10 })
  assert.deepEqual(defaultSystemSlice(c, 'lore'), { mode: 'kind', kind: 'lore' })
  assert.deepEqual(defaultSystemSlice(c, null), { mode: 'kind', kind: 'character' })
})

test('default system slice falls through when Characters empty', () => {
  const c = counts({ lore: 12, world: 18 })
  assert.deepEqual(defaultSystemSlice(c, null), { mode: 'kind', kind: 'world' })
})

test('load-bearing: N=30 system-narrowed → delete to 20 releases to All, honesty off', () => {
  const at30 = volumeCounts(30)
  let state = reconcileNetworkSlice(emptyNetworkSliceState(), at30)
  assert.equal(state.sliceSource, 'system')
  assert.equal(state.selection.mode, 'kind')
  assert.equal(state.selection.mode === 'kind' && state.selection.kind, 'character')

  const at20 = volumeCounts(20)
  state = reconcileNetworkSlice(state, at20)
  const view = networkSliceView(state, at20, LABELS)
  assert.equal(state.sliceSource, 'system')
  assert.deepEqual(state.selection, { mode: 'all' })
  assert.equal(view.narrowed, false)
  assert.equal(view.honesty, null)
  assert.equal(view.visibleCount, 20)
})

test('load-bearing: N=30 author picks Lore → delete to 20 keeps Lore + honesty', () => {
  const at30 = volumeCounts(30)
  let state = reconcileNetworkSlice(emptyNetworkSliceState(), at30)
  state = chooseNetworkSlice(state, { mode: 'kind', kind: 'lore' })
  assert.equal(state.sliceSource, 'author')
  assert.deepEqual(state.selection, { mode: 'kind', kind: 'lore' })
  assert.equal(state.lastUsedKind, 'lore')

  const at20 = volumeCounts(20)
  state = reconcileNetworkSlice(state, at20)
  const view = networkSliceView(state, at20, LABELS)
  assert.equal(state.sliceSource, 'author')
  assert.deepEqual(state.selection, { mode: 'kind', kind: 'lore' })
  assert.equal(view.narrowed, true)
  assert.deepEqual(view.honesty, {
    visible: at20.lore,
    total: 20,
    kindLabel: 'Lore',
  })
})

test('author All click is author provenance and stays All below T', () => {
  const at30 = volumeCounts(30)
  let state = reconcileNetworkSlice(emptyNetworkSliceState(), at30)
  state = chooseNetworkSlice(state, { mode: 'all' })
  assert.equal(state.sliceSource, 'author')
  assert.deepEqual(state.selection, { mode: 'all' })

  state = reconcileNetworkSlice(state, volumeCounts(20))
  assert.equal(state.sliceSource, 'author')
  assert.deepEqual(state.selection, { mode: 'all' })
})

test('author choice blocks re-auto-narrow while N stays ≥ T', () => {
  const c = volumeCounts(30)
  let state = reconcileNetworkSlice(emptyNetworkSliceState(), c)
  state = chooseNetworkSlice(state, { mode: 'kind', kind: 'world' })
  state = reconcileNetworkSlice(state, c)
  assert.equal(state.sliceSource, 'author')
  assert.deepEqual(state.selection, { mode: 'kind', kind: 'world' })
})

test('last-used kind seeds next system enter after release, does not keep below T', () => {
  const at30 = volumeCounts(30)
  let state = reconcileNetworkSlice(emptyNetworkSliceState(), at30)
  state = chooseNetworkSlice(state, { mode: 'kind', kind: 'organization' })
  // Drop below T with author — keep (provenance)
  state = reconcileNetworkSlice(state, volumeCounts(10))
  assert.equal(state.sliceSource, 'author')
  assert.deepEqual(state.selection, { mode: 'kind', kind: 'organization' })

  // Author clicks All (still below T) — clears the narrow view; lastUsed retained as seed
  state = chooseNetworkSlice(state, { mode: 'all' })
  assert.equal(state.lastUsedKind, 'organization')
  assert.deepEqual(state.selection, { mode: 'all' })

  // Fresh session carrying only lastUsedKind (persisted seed). System enter uses it
  // when that kind still has nodes — last-used does not keep a narrow view below T.
  const seeded: NetworkSliceState = {
    selection: { mode: 'all' },
    sliceSource: 'system',
    lastUsedKind: 'organization',
  }
  const reenterCounts = counts({ character: 10, lore: 5, organization: 15 })
  const reenter = reconcileNetworkSlice(seeded, reenterCounts)
  assert.equal(reenter.sliceSource, 'system')
  assert.deepEqual(reenter.selection, { mode: 'kind', kind: 'organization' })
})

test('N=0 stays All with no costume narrow', () => {
  const state = reconcileNetworkSlice(emptyNetworkSliceState(), counts({}))
  const view = networkSliceView(state, counts({}), LABELS)
  assert.deepEqual(state.selection, { mode: 'all' })
  assert.equal(view.honesty, null)
  assert.equal(view.totalN, 0)
})

test('countKinds tallies sheet kinds', () => {
  assert.deepEqual(
    countKinds(['character', 'character', 'lore', 'world']),
    counts({ character: 2, lore: 1, world: 1 }),
  )
})

test('no hysteresis: enter and exit share the same T', () => {
  // At T-1: All. At T: system narrow. Back to T-1: release.
  const below = volumeCounts(NETWORK_VOLUME_THRESHOLD - 1)
  let state = reconcileNetworkSlice(emptyNetworkSliceState(), below)
  assert.deepEqual(state.selection, { mode: 'all' })

  const at = volumeCounts(NETWORK_VOLUME_THRESHOLD)
  state = reconcileNetworkSlice(state, at)
  assert.equal(state.selection.mode, 'kind')

  state = reconcileNetworkSlice(state, below)
  assert.deepEqual(state.selection, { mode: 'all' })
  assert.equal(state.sliceSource, 'system')
})
