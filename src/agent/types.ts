import type { Fact, Proposal, SheetKind } from '../domain/types.ts'

export type SheetPack = {
  name: string
  kind: SheetKind
  summary: string
  facts: Array<Pick<Fact, 'key' | 'value' | 'statement'>>
}

export type AgentModelResponse = {
  message: string
  sheetPack: SheetPack | null
}

export type AgentRunResult = {
  mode: 'fixture' | 'live'
  message: string
  proposals: Proposal[]
}

export type TranscriptEntry =
  | { id: string; role: 'user' | 'assistant'; text: string }
  | { id: string; role: 'tool'; tool: 'continuity'; red: number; yellow: number; proposals: number; mode: 'fixture' | 'live' }
