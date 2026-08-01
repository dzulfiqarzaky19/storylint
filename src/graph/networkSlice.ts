import { SHEET_KINDS, type SheetKind } from '../domain/types.ts'

/** ox C1: below T full graph; at/above T default kind-slice. No hysteresis v1. */
export const NETWORK_VOLUME_THRESHOLD = 24

export type SliceSource = 'system' | 'author'

/** Active filter selection. `all` = every kind visible. */
export type NetworkSliceSelection =
  | { mode: 'all' }
  | { mode: 'kind'; kind: SheetKind }

export type NetworkSliceState = {
  selection: NetworkSliceSelection
  sliceSource: SliceSource
  /** Seed for next system enter only (N crosses T upward). Not authority below T. */
  lastUsedKind: SheetKind | null
}

export type NetworkSliceView = {
  selection: NetworkSliceSelection
  sliceSource: SliceSource
  lastUsedKind: SheetKind | null
  /** Kinds currently painted on the map. */
  kinds: ReadonlySet<SheetKind>
  /** Total nodes before kind filter (Canon map cardinality). */
  totalN: number
  /** Nodes visible under current selection. */
  visibleCount: number
  /** True when the current selection hides at least one node (honesty chrome). */
  narrowed: boolean
  /** Honesty line only when visible < N; never "x of x". */
  honesty: { visible: number; total: number; kindLabel: string } | null
}

export type KindCounts = Readonly<Record<SheetKind, number>>

export function emptyNetworkSliceState(): NetworkSliceState {
  return {
    selection: { mode: 'all' },
    sliceSource: 'system',
    lastUsedKind: null,
  }
}

export function sameNetworkSliceState(a: NetworkSliceState, b: NetworkSliceState): boolean {
  if (a.sliceSource !== b.sliceSource) return false
  if (a.lastUsedKind !== b.lastUsedKind) return false
  if (a.selection.mode !== b.selection.mode) return false
  if (a.selection.mode === 'kind' && b.selection.mode === 'kind') {
    return a.selection.kind === b.selection.kind
  }
  return true
}

export function countKinds(kinds: Iterable<SheetKind>): KindCounts {
  const counts = {
    character: 0,
    lore: 0,
    world: 0,
    organization: 0,
  } satisfies Record<SheetKind, number>
  for (const kind of kinds) counts[kind] += 1
  return counts
}

export function totalFromCounts(counts: KindCounts): number {
  return SHEET_KINDS.reduce((sum, kind) => sum + counts[kind], 0)
}

/**
 * Default slice when system auto-narrows (N ≥ T and no author choice).
 * Priority: last-used kind → Characters → next kind by count → All.
 * If the chosen kind already covers every node, return All (no costume narrow).
 */
export function defaultSystemSlice(
  counts: KindCounts,
  lastUsedKind: SheetKind | null,
): NetworkSliceSelection {
  const total = totalFromCounts(counts)
  let candidate: NetworkSliceSelection | null = null
  // last-used only when it still has nodes — empty seed must not false-empty the map.
  if (lastUsedKind && counts[lastUsedKind] > 0) {
    candidate = { mode: 'kind', kind: lastUsedKind }
  } else if (counts.character > 0) {
    candidate = { mode: 'kind', kind: 'character' }
  } else {
    let best: SheetKind | null = null
    let bestCount = 0
    for (const kind of SHEET_KINDS) {
      if (counts[kind] > bestCount) {
        best = kind
        bestCount = counts[kind]
      }
    }
    if (best && bestCount > 0) candidate = { mode: 'kind', kind: best }
  }
  if (!candidate) return { mode: 'all' }
  // Costume narrow: selected kind hides nothing → stay All.
  const visible = candidate.mode === 'all' ? total : counts[candidate.kind]
  if (visible >= total) return { mode: 'all' }
  return candidate
}

export function kindsForSelection(selection: NetworkSliceSelection): ReadonlySet<SheetKind> {
  if (selection.mode === 'all') return new Set(SHEET_KINDS)
  return new Set([selection.kind])
}

export function selectionLabel(
  selection: NetworkSliceSelection,
  labels: Readonly<Record<SheetKind, string>>,
): string {
  if (selection.mode === 'all') return 'All'
  return labels[selection.kind]
}

export function visibleCountForSelection(counts: KindCounts, selection: NetworkSliceSelection): number {
  if (selection.mode === 'all') return totalFromCounts(counts)
  return counts[selection.kind]
}

/**
 * Pure reconcile after N changes (project load / sheet add/delete).
 * - N ≥ T and not author → apply default system slice
 * - N < T and system → release to All
 * - author below T → keep
 */
export function reconcileNetworkSlice(
  state: NetworkSliceState,
  counts: KindCounts,
): NetworkSliceState {
  const n = totalFromCounts(counts)

  if (n >= NETWORK_VOLUME_THRESHOLD) {
    if (state.sliceSource === 'author') return state
    const selection = defaultSystemSlice(counts, state.lastUsedKind)
    return {
      selection,
      sliceSource: 'system',
      lastUsedKind: state.lastUsedKind,
    }
  }

  // N < T
  if (state.sliceSource === 'system') {
    return {
      selection: { mode: 'all' },
      sliceSource: 'system',
      lastUsedKind: state.lastUsedKind,
    }
  }
  return state
}

/** Author chip click (including All). Always sets sliceSource=author. */
export function chooseNetworkSlice(
  state: NetworkSliceState,
  selection: NetworkSliceSelection,
): NetworkSliceState {
  return {
    selection,
    sliceSource: 'author',
    lastUsedKind: selection.mode === 'kind' ? selection.kind : state.lastUsedKind,
  }
}

export function networkSliceView(
  state: NetworkSliceState,
  counts: KindCounts,
  labels: Readonly<Record<SheetKind, string>>,
): NetworkSliceView {
  const totalN = totalFromCounts(counts)
  const kinds = kindsForSelection(state.selection)
  const visibleCount = visibleCountForSelection(counts, state.selection)
  // Honesty tracks hidden nodes, not chip mode — "Showing N of N" is noise.
  const narrowed = visibleCount < totalN
  return {
    selection: state.selection,
    sliceSource: state.sliceSource,
    lastUsedKind: state.lastUsedKind,
    kinds,
    totalN,
    visibleCount,
    narrowed,
    honesty: narrowed
      ? {
          visible: visibleCount,
          total: totalN,
          kindLabel: selectionLabel(state.selection, labels),
        }
      : null,
  }
}
