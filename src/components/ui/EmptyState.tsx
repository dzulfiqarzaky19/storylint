import type { ReactNode } from 'react'
import './ui.css'

export type EmptyStateProps = {
  title: string
  hint?: string
  action?: ReactNode
}

export function EmptyState({ title, hint, action }: EmptyStateProps) {
  return (
    <div className="ui-empty-state">
      <p className="ui-empty-state__title">{title}</p>
      {hint ? <p className="ui-empty-state__hint">{hint}</p> : null}
      {action}
    </div>
  )
}
