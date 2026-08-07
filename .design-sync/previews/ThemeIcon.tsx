import { IconButton, ThemeIcon } from 'storylint'

export function InIconButton() {
  return (
    <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
      <IconButton label="Switch theme">
        <ThemeIcon />
      </IconButton>
      <IconButton label="Switch theme (active)" aria-pressed="true">
        <ThemeIcon />
      </IconButton>
    </div>
  )
}

export function Sizes() {
  return (
    <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center' }}>
      <span style={{ display: 'inline-flex', width: 'var(--size-icon-sm)', height: 'var(--size-icon-sm)' }}>
        <ThemeIcon />
      </span>
      <span style={{ display: 'inline-flex', width: 'var(--size-icon)', height: 'var(--size-icon)' }}>
        <ThemeIcon />
      </span>
      <span style={{ display: 'inline-flex', width: 'var(--size-icon-lg)', height: 'var(--size-icon-lg)' }}>
        <ThemeIcon />
      </span>
    </div>
  )
}
