import { useState } from 'react'
import type { ApplyCard as ApplyCardData } from '../../cowrite/types.ts'
import { Badge, Button } from '../../components/ui'

export function ApplyCard({
  card,
  onApply,
  onDismiss,
}: {
  card: ApplyCardData
  onApply: (id: string) => Promise<void>
  onDismiss: (id: string) => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function apply() {
    if (busy) return
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
        <Button variant="primary" disabled={busy} onClick={() => void apply()}>
<<<<<<< HEAD
          {busy ? 'Applying…' : card.target.mode === 'replace' ? 'Replace selection' : 'Insert at cursor'}
        </Button>
        <Button disabled={busy} onClick={() => onDismiss(card.id)}>Dismiss</Button>
      </div>
=======
          {busy ? 'Applying…' : 'Apply'}
        </Button>
        <Button disabled={busy} onClick={() => onDismiss(card.id)}>Dismiss</Button>
      </div>
      <p className="apply-card__hint">
        {card.target.mode === 'replace' ? 'Replaces the current selection.' : 'Inserts at the current cursor.'}
      </p>
>>>>>>> storylint/lab-slice
      {error ? <p className="apply-card__error" role="alert">{error}</p> : null}
    </article>
  )
}
