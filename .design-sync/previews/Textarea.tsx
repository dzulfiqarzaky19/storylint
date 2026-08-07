import { Textarea } from 'storylint'

const field: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-1)',
  width: 380,
}

const label: React.CSSProperties = {
  color: 'var(--color-text-muted)',
  fontSize: 'var(--text-sm)',
}

export function WithContent() {
  return (
    <label style={field}>
      <span style={label}>Instruction to the companion</span>
      <Textarea
        rows={4}
        defaultValue="Tighten this paragraph. Keep Mara's voice clipped, and don't invent new place names."
      />
    </label>
  )
}

export function States() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
      <label style={field}>
        <span style={label}>Place description</span>
        <Textarea rows={3} placeholder="Describe the harbour at dusk…" />
      </label>
      <label style={field}>
        <span style={label}>Place description</span>
        <Textarea rows={3} invalid defaultValue="" placeholder="Description is required" />
      </label>
      <label style={field}>
        <span style={label}>Locked sheet</span>
        <Textarea rows={2} disabled defaultValue="Canon sheets are read-only while Continuity runs." />
      </label>
    </div>
  )
}
