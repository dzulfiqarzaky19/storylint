import type { SaveState } from './useProject.ts'

/**
 * Topbar save-status chip text for a SaveState.
 * Binding: docs/decisions/save-chip-error-not-idle.md
 *   saving → 'Saving…' | saved → 'Saved' | error → 'Not saved' | idle → ''
 * Idle blank is honest rest. Error must not share idle's paint (false idle).
 */
export function saveChipLabel(saveState: SaveState): string {
  switch (saveState) {
    case 'saving':
      return 'Saving…'
    case 'saved':
      return 'Saved'
    case 'error':
      return 'Not saved'
    case 'idle':
      return ''
    default: {
      const _exhaustive: never = saveState
      return _exhaustive
    }
  }
}
