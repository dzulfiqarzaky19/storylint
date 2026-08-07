import { Shell } from 'storylint'

export function AppShell() {
  return (
    <div
      style={{
        display: 'flex',
        height: 560,
        overflow: 'hidden',
        borderRadius: 'var(--radius-md)',
        border: 'var(--border-width) solid var(--color-border)',
      }}
    >
      <Shell />
    </div>
  )
}
