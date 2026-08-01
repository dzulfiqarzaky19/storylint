export const SHEET_KINDS = ['character', 'lore', 'world', 'organization'] as const
export type SheetKind = (typeof SHEET_KINDS)[number]

export const CRAFT_TAGS = [
  'char-dev', 'plot-progress', 'twist', 'world-build', 'relationship', 'setup', 'payoff', 'breather',
] as const
export type CraftTag = (typeof CRAFT_TAGS)[number]

export const CLAIM_KINDS = ['attribute', 'relationship', 'event', 'existence'] as const
export type ClaimKind = (typeof CLAIM_KINDS)[number]

export type Chapter = {
  id: string
  title: string
  body: string
  craftTags: CraftTag[]
  revision: number
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
  portrait?: string
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
  targetFactId?: string
  key: string
  value: string
  statement: string
  claimKind: ClaimKind
  confidence: number
  source: ClaimSpan
  fromSheetId?: string
  toSheetId?: string
}

export type ResearchSource = {
  title: string
  url: string
}

export type ResearchNote = {
  id: string
  title: string
  summary: string
  sources: ResearchSource[]
}

export const LAB_CARD_KINDS = [
  'beat',
  'place',
  'character-spark',
  'lore-spark',
  'what-if',
  'question',
  'motif',
] as const
export type LabCardKind = (typeof LAB_CARD_KINDS)[number]

export const LAB_CARD_STATUSES = ['active', 'pinned', 'promoted', 'archived'] as const
export type LabCardStatus = (typeof LAB_CARD_STATUSES)[number]

/** Who put the words on the card. Required provenance (lab-promote-consent-provenance). */
export const LAB_CARD_SOURCES = ['author', 'model'] as const
export type LabCardSource = (typeof LAB_CARD_SOURCES)[number]

export type LabCard = {
  id: string
  boardId: string
  kind: LabCardKind
  title: string
  body: string
  status: LabCardStatus
  /** author = manual/owned text; model = chat/Spark. Legacy load → author. */
  source: LabCardSource
  touches?: { sheetId?: string; chapterId?: string }
  promoted?: {
    at: string
    as: 'sheet-proposal' | 'chapter-stub'
    targetIds?: string[]
  }
  createdAt: string
  updatedAt: string
}

export type LabBoard = {
  id: string
  title: string
  cardIds: string[]
}

export type Lab = {
  boards: LabBoard[]
  cards: LabCard[]
}

export type Project = {
  /** 1 = pre-Lab projects (migrated on load). 2 = Lab field required. */
  schemaVersion: 1 | 2
  title: string
  chapters: Chapter[]
  sheets: Sheet[]
  proposals: Proposal[]
  rejectedFingerprints: string[]
  marks: Mark[]
  researchNotes: ResearchNote[]
  lab: Lab
}

export type LintResult = {
  marks: Mark[]
  proposals: Proposal[]
}
