export const SHEET_KINDS = ['character', 'lore', 'world', 'organization'] as const
export type SheetKind = (typeof SHEET_KINDS)[number]

export const CLAIM_KINDS = ['attribute', 'relationship', 'event', 'existence'] as const
export type ClaimKind = (typeof CLAIM_KINDS)[number]

export type Chapter = {
  id: string
  title: string
  body: string
}

export type Fact = {
  id: string
  key: string
  value: string
  statement: string
  claimKind: ClaimKind
  fromSheetId?: string
  toSheetId?: string
}

export type Sheet = {
  id: string
  kind: SheetKind
  name: string
  aliases: string[]
  summary: string
  notes: string
  facts: Fact[]
}

export type ClaimSpan = {
  chapterId: string
  start: number
  end: number
  text: string
}

export type Claim = {
  entityName: string
  sheetKind: SheetKind
  key: string
  value: string
  statement: string
  claimKind: ClaimKind
  confidence: number
  span: ClaimSpan
  fromSheetId?: string
  toSheetId?: string
}

export type Mark = {
  id: string
  severity: 'yellow' | 'red'
  reason: string
  sheetId: string
  factId: string
  span: ClaimSpan
}

export type ProposalStatus = 'pending' | 'accepted' | 'rejected'

export type Proposal = {
  id: string
  fingerprint: string
  packId?: string
  status: ProposalStatus
  entityName: string
  sheetKind: SheetKind
  sheetSummary?: string
  targetSheetId?: string
  key: string
  value: string
  statement: string
  claimKind: ClaimKind
  confidence: number
  source: ClaimSpan
  fromSheetId?: string
  toSheetId?: string
}

export type Project = {
  schemaVersion: 1
  title: string
  chapters: Chapter[]
  sheets: Sheet[]
  proposals: Proposal[]
  rejectedFingerprints: string[]
  marks: Mark[]
}

export type LintResult = {
  marks: Mark[]
  proposals: Proposal[]
}
