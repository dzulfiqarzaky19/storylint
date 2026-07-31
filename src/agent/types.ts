<<<<<<< HEAD
import type { Fact, Proposal, SheetKind } from '../domain/types.ts'
=======
import type { Fact, LabCardKind, Proposal, SheetKind } from '../domain/types.ts'
>>>>>>> storylint/lab-slice
import type { ApplyCard } from '../cowrite/types.ts'
import type { ReviewResult } from '../review/types.ts'

export type SheetPack = {
  name: string
  kind: SheetKind
  summary: string
  facts: Array<Pick<Fact, 'key' | 'value' | 'statement'>>
}

<<<<<<< HEAD
export type AgentModelResponse = {
  message: string
  sheetPack: SheetPack | null
=======
export type LabCardDraft = {
  kind: LabCardKind
  title: string
  body: string
  boardId?: string
}

export type AgentModelResponse = {
  message: string
  sheetPack: SheetPack | null
  labCards?: LabCardDraft[] | null
>>>>>>> storylint/lab-slice
}

export type AgentRunResult = {
  mode: 'fixture' | 'live'
  message: string
  proposals: Proposal[]
<<<<<<< HEAD
=======
  labCards: LabCardDraft[]
>>>>>>> storylint/lab-slice
}

export type TranscriptEntry =
  | { id: string; role: 'user' | 'assistant'; text: string }
  | { id: string; role: 'tool'; tool: 'continuity'; red: number; yellow: number; proposals: number; mode: 'fixture' | 'live' }
  | { id: string; role: 'apply'; card: ApplyCard }
  | { id: string; role: 'review'; result: ReviewResult }
