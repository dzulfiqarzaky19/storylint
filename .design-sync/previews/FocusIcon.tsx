import { FocusIcon, IconButton } from 'storylint'

export function InIconButton() {
  return (
    <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
      <IconButton label="Focus mode">
        <FocusIcon />
      </IconButton>
      <IconButton label="Focus mode (active)" aria-pressed="true">
        <FocusIcon />
      </IconButton>
    </div>
  )
}

export function Sizes() {
  return (
    <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center' }}>
      <span style={{ display: 'inline-flex', width: 'var(--size-icon-sm)', height: 'var(--size-icon-sm)' }}>
        <FocusIcon />
      </span>
      <span style={{ display: 'inline-flex', width: 'var(--size-icon)', height: 'var(--size-icon)' }}>
        <FocusIcon />
      </span>
      <span style={{ display: 'inline-flex', width: 'var(--size-icon-lg)', height: 'var(--size-icon-lg)' }}>
        <FocusIcon />
      </span>
    </div>
  )
}
