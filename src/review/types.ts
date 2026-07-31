import type { CraftTag } from '../domain/types.ts'

export type ReviewKind = 'review' | 'craft'
export type ReviewFinding = {
  id: string
  lens: 'plot' | 'culture' | 'gap' | 'craft'
  title: string
  detail: string
}

export type ReviewResult = {
  mode: 'fixture' | 'live'
  kind: ReviewKind
  findings: ReviewFinding[]
  suggestedTags: CraftTag[]
}
