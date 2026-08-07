import { BinderIcon, IconButton } from 'storylint'

export function InIconButton() {
  return (
    <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
      <IconButton label="Toggle binder">
        <BinderIcon />
      </IconButton>
      <IconButton label="Toggle binder (active)" aria-pressed="true">
        <BinderIcon />
      </IconButton>
    </div>
  )
}

export function Sizes() {
  return (
    <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center' }}>
      <span style={{ display: 'inline-flex', width: 'var(--size-icon-sm)', height: 'var(--size-icon-sm)' }}>
        <BinderIcon />
      </span>
      <span style={{ display: 'inline-flex', width: 'var(--size-icon)', height: 'var(--size-icon)' }}>
        <BinderIcon />
      </span>
      <span style={{ display: 'inline-flex', width: 'var(--size-icon-lg)', height: 'var(--size-icon-lg)' }}>
        <BinderIcon />
      </span>
    </div>
  )
}
