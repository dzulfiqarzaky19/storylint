import { AgentIcon, IconButton } from 'storylint'

export function InIconButton() {
  return (
    <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
      <IconButton label="Toggle companion">
        <AgentIcon />
      </IconButton>
      <IconButton label="Toggle companion (active)" aria-pressed="true">
        <AgentIcon />
      </IconButton>
    </div>
  )
}

export function Sizes() {
  return (
    <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center' }}>
      <span style={{ display: 'inline-flex', width: 'var(--size-icon-sm)', height: 'var(--size-icon-sm)' }}>
        <AgentIcon />
      </span>
      <span style={{ display: 'inline-flex', width: 'var(--size-icon)', height: 'var(--size-icon)' }}>
        <AgentIcon />
      </span>
      <span style={{ display: 'inline-flex', width: 'var(--size-icon-lg)', height: 'var(--size-icon-lg)' }}>
        <AgentIcon />
      </span>
    </div>
  )
}
