import type { CraftTag } from '../../domain/types.ts'
import type { ReviewResult } from '../../review/types.ts'
import { Badge, Button } from '../../components/ui'

export function ReviewCard({
  result,
  onAddTags,
}: {
  result: ReviewResult
  onAddTags: (tags: CraftTag[]) => void
}) {
  return (
    <article className="review-card">
      <div className="proposal-card__heading">
        <strong>{result.kind === 'craft' ? 'Chapter craft check' : 'Chapter review'}</strong>
        <Badge>{result.mode}</Badge>
      </div>
      <div className="review-card__findings">
        {result.findings.map((finding) => (
          <section key={finding.id} className="review-card__finding">
            <Badge>{finding.lens}</Badge>
            <strong>{finding.title}</strong>
            <p>{finding.detail}</p>
          </section>
        ))}
      </div>
      {result.suggestedTags.length > 0 ? (
        <div className="review-card__tags">
          {result.suggestedTags.map((tag) => <Badge key={tag}>{tag}</Badge>)}
          <Button onClick={() => onAddTags(result.suggestedTags)}>Add suggested tags</Button>
        </div>
      ) : null}
    </article>
  )
}
