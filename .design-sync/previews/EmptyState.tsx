import { Button, EmptyState } from 'storylint'

export function WithAction() {
  return (
    <EmptyState
      title="Start this project"
      hint="Write a first chapter, or open the Lab to sketch characters and places."
      action={
        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <Button variant="primary">Write</Button>
          <Button variant="ghost">Start in Lab</Button>
        </div>
      }
    />
  )
}

export function TitleAndHint() {
  return (
    <EmptyState
      title="No proposals yet"
      hint="Run Continuity to check this chapter against your canon."
    />
  )
}

export function TitleOnly() {
  return <EmptyState title="No chapters yet" />
}
