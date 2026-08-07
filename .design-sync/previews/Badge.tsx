import { Badge } from 'storylint'

export function Tones() {
  return (
    <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', alignItems: 'center' }}>
      <Badge>Draft</Badge>
      <Badge tone="accent">Canon</Badge>
      <Badge tone="success">Continuity clear</Badge>
      <Badge tone="warning">3 to review</Badge>
      <Badge tone="danger">Contradiction</Badge>
      <Badge tone="pending">Checking…</Badge>
    </div>
  )
}

export function OnChapterRow() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 'var(--space-3)',
        width: 360,
        padding: 'var(--space-3)',
        background: 'var(--color-surface)',
        border: 'var(--border-width) solid var(--color-border)',
        borderRadius: 'var(--radius-md)',
      }}
    >
      <span>4. The Harbour Bell</span>
      <Badge tone="danger">Contradiction</Badge>
    </div>
  )
}
