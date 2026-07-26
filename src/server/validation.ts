import {
  CLAIM_KINDS,
  SHEET_KINDS,
  type Chapter,
  type Fact,
  type Mark,
  type Project,
  type Proposal,
  type Sheet,
} from '../domain/types.ts'

type ObjectValue = Record<string, unknown>

function object(value: unknown, name: string): ObjectValue {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${name} must be an object`)
  }
  return value as ObjectValue
}

function string(value: unknown, name: string): string {
  if (typeof value !== 'string') throw new Error(`${name} must be a string`)
  return value
}

function stringArray(value: unknown, name: string): string[] {
  if (!Array.isArray(value) || !value.every((item) => typeof item === 'string')) {
    throw new Error(`${name} must be a string array`)
  }
  return [...value]
}

function optionalString(value: unknown, name: string): string | undefined {
  return value === undefined ? undefined : string(value, name)
}

function oneOf<const T extends readonly string[]>(value: unknown, values: T, name: string): T[number] {
  if (typeof value !== 'string' || !values.includes(value)) {
    throw new Error(`${name} is invalid`)
  }
  return value as T[number]
}

export function parseProposalEdits(value: unknown): Partial<Pick<Proposal, 'entityName' | 'key' | 'value' | 'statement' | 'claimKind'>> {
  const raw = object(value, 'proposal edits')
  const edits: Partial<Pick<Proposal, 'entityName' | 'key' | 'value' | 'statement' | 'claimKind'>> = {}
  if (raw.entityName !== undefined) edits.entityName = string(raw.entityName, 'entityName').trim()
  if (raw.key !== undefined) edits.key = string(raw.key, 'key').trim()
  if (raw.value !== undefined) edits.value = string(raw.value, 'value').trim()
  if (raw.statement !== undefined) edits.statement = string(raw.statement, 'statement').trim()
  if (raw.claimKind !== undefined) edits.claimKind = oneOf(raw.claimKind, CLAIM_KINDS, 'claimKind')
  if (Object.values(edits).some((entry) => entry === '')) throw new Error('proposal edits cannot be empty')
  return edits
}

export function parseChapterPatch(value: unknown): Partial<Pick<Chapter, 'title' | 'body'>> {
  const raw = object(value, 'chapter patch')
  const patch: Partial<Pick<Chapter, 'title' | 'body'>> = {}
  if (raw.title !== undefined) patch.title = string(raw.title, 'title')
  if (raw.body !== undefined) patch.body = string(raw.body, 'body')
  if (patch.title === undefined && patch.body === undefined) {
    throw new Error('chapter patch requires title or body')
  }
  return patch
}

export function parseChapter(value: unknown): Chapter {
  const raw = object(value, 'chapter')
  return {
    id: string(raw.id, 'chapter.id'),
    title: string(raw.title, 'chapter.title'),
    body: string(raw.body, 'chapter.body'),
  }
}

export function parseFact(value: unknown): Fact {
  const raw = object(value, 'fact')
  return {
    id: string(raw.id, 'fact.id'),
    key: string(raw.key, 'fact.key'),
    value: string(raw.value, 'fact.value'),
    statement: string(raw.statement, 'fact.statement'),
    claimKind: oneOf(raw.claimKind, CLAIM_KINDS, 'fact.claimKind'),
    fromSheetId: optionalString(raw.fromSheetId, 'fact.fromSheetId'),
    toSheetId: optionalString(raw.toSheetId, 'fact.toSheetId'),
  }
}

export function parseSheet(value: unknown): Sheet {
  const raw = object(value, 'sheet')
  if (!Array.isArray(raw.facts)) throw new Error('sheet.facts must be an array')
  return {
    id: string(raw.id, 'sheet.id'),
    kind: oneOf(raw.kind, SHEET_KINDS, 'sheet.kind'),
    name: string(raw.name, 'sheet.name'),
    aliases: stringArray(raw.aliases, 'sheet.aliases'),
    summary: string(raw.summary, 'sheet.summary'),
    notes: string(raw.notes, 'sheet.notes'),
    facts: raw.facts.map(parseFact),
  }
}

function parseMark(value: unknown): Mark {
  const raw = object(value, 'mark')
  const span = object(raw.span, 'mark.span')
  return {
    id: string(raw.id, 'mark.id'),
    severity: oneOf(raw.severity, ['yellow', 'red'] as const, 'mark.severity'),
    reason: string(raw.reason, 'mark.reason'),
    sheetId: string(raw.sheetId, 'mark.sheetId'),
    factId: string(raw.factId, 'mark.factId'),
    span: {
      chapterId: string(span.chapterId, 'mark.span.chapterId'),
      start: number(span.start, 'mark.span.start'),
      end: number(span.end, 'mark.span.end'),
      text: string(span.text, 'mark.span.text'),
    },
  }
}

function parseProposal(value: unknown): Proposal {
  const raw = object(value, 'proposal')
  const source = object(raw.source, 'proposal.source')
  const confidence = raw.confidence
  if (typeof confidence !== 'number' || confidence < 0 || confidence > 1) {
    throw new Error('proposal.confidence must be between 0 and 1')
  }
  return {
    id: string(raw.id, 'proposal.id'),
    fingerprint: string(raw.fingerprint, 'proposal.fingerprint'),
    packId: optionalString(raw.packId, 'proposal.packId'),
    status: oneOf(raw.status, ['pending', 'accepted', 'rejected'] as const, 'proposal.status'),
    entityName: string(raw.entityName, 'proposal.entityName'),
    sheetKind: oneOf(raw.sheetKind, SHEET_KINDS, 'proposal.sheetKind'),
    sheetSummary: optionalString(raw.sheetSummary, 'proposal.sheetSummary'),
    targetSheetId: optionalString(raw.targetSheetId, 'proposal.targetSheetId'),
    key: string(raw.key, 'proposal.key'),
    value: string(raw.value, 'proposal.value'),
    statement: string(raw.statement, 'proposal.statement'),
    claimKind: oneOf(raw.claimKind, CLAIM_KINDS, 'proposal.claimKind'),
    confidence,
    source: {
      chapterId: string(source.chapterId, 'proposal.source.chapterId'),
      start: number(source.start, 'proposal.source.start'),
      end: number(source.end, 'proposal.source.end'),
      text: string(source.text, 'proposal.source.text'),
    },
    fromSheetId: optionalString(raw.fromSheetId, 'proposal.fromSheetId'),
    toSheetId: optionalString(raw.toSheetId, 'proposal.toSheetId'),
  }
}

function number(value: unknown, name: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`${name} must be a number`)
  return value
}

/** Validate disk data at the trust boundary; malformed files never enter domain/UI. */
export function parseProject(value: unknown): Project {
  const raw = object(value, 'project')
  if (raw.schemaVersion !== 1) throw new Error('Unsupported project schemaVersion')
  if (!Array.isArray(raw.chapters)) throw new Error('project.chapters must be an array')
  if (!Array.isArray(raw.sheets)) throw new Error('project.sheets must be an array')
  if (!Array.isArray(raw.proposals)) throw new Error('project.proposals must be an array')
  if (raw.marks !== undefined && !Array.isArray(raw.marks)) throw new Error('project.marks must be an array')
  return {
    schemaVersion: 1,
    title: string(raw.title, 'project.title'),
    chapters: raw.chapters.map(parseChapter),
    sheets: raw.sheets.map(parseSheet),
    proposals: raw.proposals.map(parseProposal),
    rejectedFingerprints: stringArray(raw.rejectedFingerprints, 'project.rejectedFingerprints'),
    marks: Array.isArray(raw.marks) ? raw.marks.map(parseMark) : [],
  }
}
