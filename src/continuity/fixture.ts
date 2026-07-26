import type { Chapter, Claim } from '../domain/types.ts'

function span(chapter: Chapter, text: string): { start: number; end: number; text: string } | null {
  const start = chapter.body.indexOf(text)
  return start < 0 ? null : { start, end: start + text.length, text }
}

/** Deterministic extractor for tests/dev, grounded in docs/fixtures/continuity-sample.md. */
export function extractFixtureClaims(chapter: Chapter): Claim[] {
  const claims: Claim[] = []
  const eyes = span(chapter, 'blue eyes')
  if (eyes) {
    claims.push({
      entityName: 'Aria',
      sheetKind: 'character',
      key: 'eye_color',
      value: 'blue',
      statement: 'eye color: blue',
      claimKind: 'attribute',
      confidence: 0.98,
      span: { chapterId: chapter.id, ...eyes },
    })
  }
  const sword = span(chapter, 'Kael drew his sword')
  if (sword) {
    claims.push({
      entityName: 'Kael',
      sheetKind: 'character',
      key: 'wields',
      value: 'sword',
      statement: 'Kael wields a sword',
      claimKind: 'attribute',
      confidence: 0.91,
      span: { chapterId: chapter.id, ...sword },
    })
  }
  return claims
}
