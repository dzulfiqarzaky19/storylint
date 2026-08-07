import { Input } from 'storylint'

const field: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-1)',
  width: 320,
}

const label: React.CSSProperties = {
  color: 'var(--color-text-muted)',
  fontSize: 'var(--text-sm)',
}

export function States() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
      <label style={field}>
        <span style={label}>Chapter title</span>
        <Input defaultValue="The Lighthouse Keeper" />
      </label>
      <label style={field}>
        <span style={label}>Character name</span>
        <Input placeholder="e.g. Mara Vance" />
      </label>
      <label style={field}>
        <span style={label}>Chapter title</span>
        <Input invalid defaultValue="" placeholder="Title is required" />
      </label>
      <label style={field}>
        <span style={label}>Project id</span>
        <Input disabled defaultValue="harbour-bell" />
      </label>
    </div>
  )
}

export function Single() {
  return (
    <label style={field}>
      <span style={label}>Search the binder</span>
      <Input placeholder="Search chapters, sheets, facts…" />
    </label>
  )
}
