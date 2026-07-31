import { useState } from 'react'
import type { ApplyCard as ApplyCardData } from '../../cowrite/types.ts'
import { Badge, Button } from '../../components/ui'

export function ApplyCard({
  card,
  onApply,
  onDismiss,
  assistantBusy = false,
}: {
  card: ApplyCardData
  onApply: (id: string) => Promise<void>
  onDismiss: (id: string) => void
  /** Block Apply while another companion job owns the assistant. */
  assistantBusy?: boolean
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function apply() {
    if (busy || assistantBusy) return
    setBusy(true)
    setError(null)
    try {
      await onApply(card.id)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Apply failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <article className="apply-card">
      <div className="proposal-card__heading">
        <strong>{card.skill}</strong>
        <Badge tone="accent">manuscript preview</Badge>
      </div>
      <pre className="apply-card__preview">{card.text}</pre>
      <div className="proposal-card__actions">
        <Button variant="primary" disabled={busy || assistantBusy} aria-busy={busy || undefined} onClick={() => void apply()}>
          {busy ? 'Working…' : 'Apply'}
        </Button>
        <Button disabled={busy || assistantBusy} onClick={() => onDismiss(card.id)}>Dismiss</Button>
      </div>
      <p className="apply-card__hint">
        {card.target.mode === 'replace' ? 'Replaces the current selection.' : 'Inserts at the current cursor.'}
      </p>
      {error ? <p className="apply-card__error" role="alert">{error}</p> : null}
    </article>
  )
}
