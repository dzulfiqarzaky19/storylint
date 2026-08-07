import { ListRow } from 'storylint'

export function ChapterList() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: 320,
        background: 'var(--color-surface)',
        border: 'var(--border-width) solid var(--color-border)',
        borderRadius: 'var(--radius-md)',
        padding: 'var(--space-2)',
      }}
    >
      <ListRow active meta="1,842">
        1. The Lighthouse Keeper
      </ListRow>
      <ListRow meta="2,310">2. Salt and Rope</ListRow>
      <ListRow meta="0">3. What the Tide Left</ListRow>
    </div>
  )
}

export function States() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: 320 }}>
      <ListRow>Resting row</ListRow>
      <ListRow active>Active row</ListRow>
      <ListRow meta="1,204">With word count</ListRow>
      <ListRow disabled>Unavailable row</ListRow>
    </div>
  )
}
