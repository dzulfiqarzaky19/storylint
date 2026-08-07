import { AgentIcon, BinderIcon, FocusIcon, IconButton, ThemeIcon } from 'storylint'

export function Rail() {
  return (
    <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
      <IconButton label="Toggle binder">
        <BinderIcon />
      </IconButton>
      <IconButton label="Toggle companion">
        <AgentIcon />
      </IconButton>
      <IconButton label="Focus mode">
        <FocusIcon />
      </IconButton>
      <IconButton label="Switch theme">
        <ThemeIcon />
      </IconButton>
    </div>
  )
}

export function States() {
  return (
    <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
      <IconButton label="Toggle binder">
        <BinderIcon />
      </IconButton>
      <IconButton label="Toggle binder (active)" aria-pressed="true">
        <BinderIcon />
      </IconButton>
      <IconButton label="Focus mode (unavailable)" disabled>
        <FocusIcon />
      </IconButton>
    </div>
  )
}

export function InToolbar() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-2)',
        padding: 'var(--space-2)',
        background: 'var(--color-surface)',
        border: 'var(--border-width) solid var(--color-border)',
        borderRadius: 'var(--radius-md)',
      }}
    >
      <IconButton label="Toggle binder">
        <BinderIcon />
      </IconButton>
      <span style={{ flex: 1 }}>1. The Lighthouse Keeper</span>
      <IconButton label="Switch theme">
        <ThemeIcon />
      </IconButton>
      <IconButton label="Toggle companion">
        <AgentIcon />
      </IconButton>
    </div>
  )
}
