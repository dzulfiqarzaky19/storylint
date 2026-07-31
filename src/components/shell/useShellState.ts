import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react'

/** TOKENS.md §7: `< bp.md` drawers; `>= bp.lg` dual rail OK. Literals because
 *  custom properties are illegal in media-query conditions. */
const BP_MD = '(min-width: 768px)'
const BP_LG = '(min-width: 1024px)'
/** Desk class. Dual rails are *allowed* from bp.lg, but only a desk-width screen has
 *  the pixels to open both by default and still leave the manuscript >= 60%
 *  (TOKENS.md §4 rail budget). Below it the companion starts closed, one click away. */
const BP_DESK = '(min-width: 1366px)'

export type ShellLayout = 'compact' | 'medium' | 'wide'
export type ShellRegion = 'binder' | 'agent'

/** Last Canon thing opened in a project: map center or a binder sheet. */
export type CanonLastOpened =
  | { kind: 'map' }
  | { kind: 'sheet'; sheetId: string }

const CANON_LAST_KEY = 'storylint.canonLastOpened.v1'

function readCanonMap(): Record<string, CanonLastOpened> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(CANON_LAST_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, CanonLastOpened>
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function writeCanonMap(map: Record<string, CanonLastOpened>) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(CANON_LAST_KEY, JSON.stringify(map))
  } catch {
    // ignore quota / private mode
  }
}

export function getCanonLastOpened(projectId: string): CanonLastOpened | null {
  const entry = readCanonMap()[projectId]
  if (!entry) return null
  if (entry.kind === 'map') return { kind: 'map' }
  if (entry.kind === 'sheet' && typeof entry.sheetId === 'string' && entry.sheetId) {
    return { kind: 'sheet', sheetId: entry.sheetId }
  }
  return null
}

export function setCanonLastOpened(projectId: string, value: CanonLastOpened) {
  if (!projectId) return
  const map = readCanonMap()
  map[projectId] = value
  writeCanonMap(map)
}

const queries = new Map<string, MediaQueryList>()

function mql(query: string): MediaQueryList {
  let list = queries.get(query)
  if (!list) {
    list = window.matchMedia(query)
    queries.set(query, list)
  }
  return list
}

function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = mql(query)
      list.addEventListener('change', onChange)
      return () => list.removeEventListener('change', onChange)
    },
    [query],
  )
  // server snapshot: assume wide so SSR/prerender emits the full IDE shell
  return useSyncExternalStore(
    subscribe,
    () => mql(query).matches,
    () => true,
  )
}

export type ShellVisibility = {
  layout: ShellLayout
  focus: boolean
  rails: Record<ShellRegion, boolean>
  drawer: ShellRegion | null
}

/** A region may hold an inline rail only where the layout has room for it (TOKENS.md §7). */
export function railAllowedAt(layout: ShellLayout, region: ShellRegion): boolean {
  return region === 'binder' ? layout !== 'compact' : layout === 'wide'
}

/**
 * Which rails start open on a fresh session (TOKENS.md §4 rail budget).
 * Binder is the navigator and always leads. The companion is help, not permanent
 * chrome: it only earns a default slot on a desk-class screen, where both rails
 * still leave the manuscript the clear majority. Narrower screens get it on demand.
 */
export function defaultRailsAt(atDesk: boolean): Record<ShellRegion, boolean> {
  return { binder: true, agent: atDesk }
}

/**
 * Pure visibility policy — the single source of truth for what the shell shows.
 * Focus wins over everything: manuscript only, at every width.
 */
export function regionVisibility(
  state: ShellVisibility,
  region: ShellRegion,
): { rail: boolean; drawer: boolean } {
  if (state.focus) return { rail: false, drawer: false }
  return {
    rail: railAllowedAt(state.layout, region) && state.rails[region],
    drawer: state.drawer === region,
  }
}

export type ShellState = {
  layout: ShellLayout
  focus: boolean
  /** Region occupies an inline rail right now. */
  railVisible: (region: ShellRegion) => boolean
  /** Region is showing at all — rail or overlay drawer. */
  isOpen: (region: ShellRegion) => boolean
  /** Region is currently presented as an overlay drawer. */
  drawerOpen: (region: ShellRegion) => boolean
  toggle: (region: ShellRegion) => void
  closeDrawer: () => void
  toggleFocus: () => void
  /** Per-project Canon landing memory (map or sheet). */
  getCanonLastOpened: (projectId: string) => CanonLastOpened | null
  setCanonLastOpened: (projectId: string, value: CanonLastOpened) => void
}

/**
 * Shell visibility. Rails and drawers are tracked separately on purpose: a region
 * opened as a rail at desktop width must not reappear as a popped-open overlay
 * after a resize down.
 */
export function useShellState(): ShellState {
  const atMd = useMediaQuery(BP_MD)
  const atLg = useMediaQuery(BP_LG)
  const atDesk = useMediaQuery(BP_DESK)
  const layout: ShellLayout = atLg ? 'wide' : atMd ? 'medium' : 'compact'

  const [focus, setFocus] = useState(false)
  // Initial state only: once the user has an opinion about a rail we never override
  // it, so a resize does not yank the companion out from under them.
  const [rails, setRails] = useState<Record<ShellRegion, boolean>>(() => defaultRailsAt(atDesk))
  const [drawer, setDrawer] = useState<ShellRegion | null>(null)

  const railAllowed = useCallback(
    (region: ShellRegion) => railAllowedAt(layout, region),
    [layout],
  )

  // an overlay must never survive into a layout that has room for the rail
  useEffect(() => {
    if (drawer && railAllowed(drawer)) setDrawer(null)
  }, [drawer, railAllowed])

  useEffect(() => {
    if (focus) setDrawer(null)
  }, [focus])

  useEffect(() => {
    if (!focus) return
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setFocus(false)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [focus])

  return useMemo(() => {
    const snapshot: ShellVisibility = { layout, focus, rails, drawer }
    const railVisible = (region: ShellRegion) => regionVisibility(snapshot, region).rail
    const drawerOpen = (region: ShellRegion) => regionVisibility(snapshot, region).drawer

    return {
      layout,
      focus,
      railVisible,
      drawerOpen,
      isOpen: (region) => railVisible(region) || drawerOpen(region),
      toggle: (region) => {
        if (focus) setFocus(false)
        if (railAllowed(region)) setRails((prev) => ({ ...prev, [region]: !prev[region] }))
        else setDrawer((prev) => (prev === region ? null : region))
      },
      closeDrawer: () => setDrawer(null),
      toggleFocus: () => setFocus((prev) => !prev),
      getCanonLastOpened,
      setCanonLastOpened,
    }
  }, [layout, focus, rails, drawer, railAllowed])
}
