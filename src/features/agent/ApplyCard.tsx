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
  return (
    <article className="apply-card">
      <div className="proposal-card__heading">
        <strong>{card.skill}</strong>
        <Badge tone="accent">manuscript preview</Badge>
      </div>
      <pre className="apply-card__preview">{card.text}</pre>
      <div className="proposal-card__actions">
        <Button variant="primary" onClick={() => void onApply(card.id).catch(() => undefined)}>
          {card.target.mode === 'replace' ? 'Replace selection' : 'Insert at cursor'}
        </Button>
        <Button onClick={() => onDismiss(card.id)}>Dismiss</Button>
      </div>
    </article>
  )
}
