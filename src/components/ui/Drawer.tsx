import { useEffect, useRef, type ReactNode } from 'react'
import { cx } from './cx'
import './ui.css'

export type DrawerProps = {
  open: boolean
  onClose: () => void
  side?: 'left' | 'right'
  label: string
  children: ReactNode
}

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),textarea:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])'

/** Narrow-width overlay for binder/agent. Esc + backdrop close; focus moves in and returns out. */
export function Drawer({ open, onClose, side = 'left', label, children }: DrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const restoreRef = useRef<HTMLElement | null>(null)
  // ref, not a dep: an unstable parent callback would otherwise re-run the effect and thrash focus
  const closeRef = useRef(onClose)
  closeRef.current = onClose

  useEffect(() => {
    if (!open) return
    const panel = panelRef.current
    restoreRef.current = document.activeElement as HTMLElement | null
    panel?.focus()

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        closeRef.current()
        return
      }
      if (event.key !== 'Tab' || !panel) return
      const focusables = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE))
      if (focusables.length === 0) {
        event.preventDefault()
        return
      }
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      const active = document.activeElement
      if (event.shiftKey && (active === first || active === panel)) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && active === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      restoreRef.current?.focus()
    }
  }, [open])

  if (!open) return null

  return (
    <div className="ui-drawer-root">
      <div className="ui-drawer__backdrop" aria-hidden="true" onClick={onClose} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        className={cx('ui-drawer', `ui-drawer--${side}`)}
      >
        {children}
      </div>
    </div>
  )
}
