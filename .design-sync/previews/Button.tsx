import { Button } from 'storylint'

export function Variants() {
  return (
    <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center' }}>
      <Button variant="primary">Run Continuity</Button>
      <Button variant="ghost">Open Lab</Button>
      <Button variant="danger">Discard draft</Button>
    </div>
  )
}

export function Disabled() {
  return (
    <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center' }}>
      <Button variant="primary" disabled>
        Run Continuity
      </Button>
      <Button variant="ghost" disabled>
        Open Lab
      </Button>
    </div>
  )
}

export function InContext() {
  return (
    <div
      style={{
        display: 'flex',
        gap: 'var(--space-2)',
        justifyContent: 'flex-end',
        padding: 'var(--space-3)',
        background: 'var(--color-surface)',
        border: 'var(--border-width) solid var(--color-border)',
        borderRadius: 'var(--radius-md)',
      }}
    >
      <Button variant="ghost">Cancel</Button>
      <Button variant="primary">Save chapter</Button>
    </div>
  )
}
