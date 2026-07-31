import type { Claim, Project, SheetKind, ClaimKind } from '../domain/types.ts'
import type { LlmConfig } from '../llm/types.ts'
import { completeJson } from '../server/llm.ts'

const MAX_PROVIDER_INPUT_CHARS = 200_000

type RawClaim = {
  entityName: string
  sheetKind: SheetKind
  key: string
  value: string
  statement: string
  claimKind: ClaimKind
  confidence: number
  spanText: string
}

function claimKind(value: unknown): ClaimKind {
  const normalized = String(value).trim().toLocaleLowerCase('en-US').replaceAll(/[-\s]/g, '_')
  const aliases: Record<string, ClaimKind> = {
    attribute: 'attribute',
    fact: 'attribute',
    relationship: 'relationship',
    relation: 'relationship',
    event: 'event',
    existence: 'existence',
    entity: 'existence',
  }
  const result = aliases[normalized]
  if (!result) throw new Error('Invalid claim claimKind')
  return result
}

export function parseClaims(value: unknown): RawClaim[] {
  if (typeof value !== 'object' || value === null || !('claims' in value) || !Array.isArray(value.claims)) {
    throw new Error('The model returned invalid continuity claims')
  }
  return value.claims.map((entry): RawClaim => {
    if (typeof entry !== 'object' || entry === null) throw new Error('The model returned an invalid claim')
    const raw = entry as Record<string, unknown>
    const required = ['entityName', 'key', 'value', 'statement', 'spanText'] as const
    for (const key of required) {
      if (typeof raw[key] !== 'string' || raw[key].trim() === '') throw new Error(`Invalid claim ${key}`)
    }
    if (!['character', 'lore', 'world', 'organization'].includes(String(raw.sheetKind))) throw new Error('Invalid claim sheetKind')
    const normalizedClaimKind = claimKind(raw.claimKind)
    if (typeof raw.confidence !== 'number' || !Number.isFinite(raw.confidence) || raw.confidence < 0 || raw.confidence > 1) {
      throw new Error('Invalid claim confidence')
    }
    return { ...raw, claimKind: normalizedClaimKind } as RawClaim
  })
}

function canonDigest(project: Project): string {
  return project.sheets
    .map((sheet) => `${sheet.kind}: ${sheet.name}\n${sheet.facts.map((fact) => `- ${fact.key}=${fact.value}`).join('\n')}`)
    .join('\n\n')
}

export async function extractLiveClaims(project: Project, chapterId: string, config: LlmConfig): Promise<Claim[]> {
  const chapter = project.chapters.find((candidate) => candidate.id === chapterId)
  if (!chapter) throw new Error(`Chapter not found: ${chapterId}`)
  const digest = canonDigest(project)
  if (chapter.body.length + digest.length > MAX_PROVIDER_INPUT_CHARS) {
    throw new Error('Chapter and Canon digest are too large for a continuity run')
  }
  const parsed = parseClaims(await completeJson(
    config,
    'Extract explicit continuity claims from fiction. Return JSON with a claims array. Every claim needs entityName, sheetKind, key, value, statement, claimKind, confidence, and spanText. claimKind must be one of "attribute", "relationship", "event", or "existence". sheetKind must be one of "character", "lore", "world", or "organization". spanText must be an exact unique substring. Do not invent canon.',
    `Canon digest:\n${digest}\n\nChapter: ${chapter.title}\n${chapter.body}`,
  ))

  return parsed.flatMap((raw): Claim[] => {
    const start = chapter.body.indexOf(raw.spanText)
    if (start < 0 || chapter.body.indexOf(raw.spanText, start + 1) >= 0) return []
    return [{
      entityName: raw.entityName,
      sheetKind: raw.sheetKind,
      key: raw.key,
      value: raw.value,
      statement: raw.statement,
      claimKind: raw.claimKind,
      confidence: raw.confidence,
      span: { chapterId, start, end: start + raw.spanText.length, text: raw.spanText },
    }]
  })
}
