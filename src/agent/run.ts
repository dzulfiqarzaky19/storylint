import { claimFingerprint } from '../domain/fingerprint.ts'
import type { Claim, Project, Proposal, SheetKind } from '../domain/types.ts'
import { completeJson } from '../server/llm.ts'
import { hasLiveLlm, type LlmConfig } from '../llm/types.ts'
import type { AgentModelResponse, AgentRunResult, SheetPack } from './types.ts'

export type AgentCompletion = (
  config: LlmConfig,
  project: Project,
  chapterId: string,
  message: string,
) => Promise<AgentModelResponse>

function parsePack(value: unknown): SheetPack | null {
  if (value === null) return null
  if (typeof value !== 'object' || value === null) throw new Error('Invalid sheet pack')
  const raw = value as Record<string, unknown>
  if (typeof raw.name !== 'string' || !raw.name.trim()) throw new Error('Invalid sheet pack name')
  if (!['character', 'lore', 'world', 'organization'].includes(String(raw.kind))) throw new Error('Invalid sheet pack kind')
  if (typeof raw.summary !== 'string' || !Array.isArray(raw.facts) || raw.facts.length === 0) throw new Error('Invalid sheet pack facts')
  const facts = raw.facts.map((entry) => {
    if (typeof entry !== 'object' || entry === null) throw new Error('Invalid sheet pack fact')
    const fact = entry as Record<string, unknown>
    if (typeof fact.key !== 'string' || !fact.key.trim() || typeof fact.value !== 'string' || !fact.value.trim() || typeof fact.statement !== 'string' || !fact.statement.trim()) {
      throw new Error('Invalid sheet pack fact')
    }
    return { key: fact.key.trim(), value: fact.value.trim(), statement: fact.statement.trim() }
  })
  return { name: raw.name.trim(), kind: raw.kind as SheetKind, summary: raw.summary.trim(), facts }
}

function proposalsFrom(pack: SheetPack, chapterId: string, requestText: string): Proposal[] {
  const packKey = `${pack.kind}:${pack.name.toLocaleLowerCase('en-US')}:${requestText}`
  const packId = `sheet-pack-${stableHash(packKey)}`
  return pack.facts.map((fact) => {
    const claim: Claim = {
      entityName: pack.name,
      sheetKind: pack.kind,
      key: fact.key,
      value: fact.value,
      statement: fact.statement,
      claimKind: 'attribute',
      confidence: 1,
      span: { chapterId, start: 0, end: 0, text: '' },
    }
    const fingerprint = claimFingerprint(claim)
    return {
      id: `proposal-${packId}-${fingerprint}`,
      fingerprint,
      packId,
      status: 'pending',
      entityName: pack.name,
      sheetKind: pack.kind,
      sheetSummary: pack.summary,
      key: fact.key,
      value: fact.value,
      statement: fact.statement,
      claimKind: 'attribute',
      confidence: 1,
      source: claim.span,
    }
  })
}

function stableHash(value: string): string {
  let hash = 0x811c9dc5
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

function fixtureResponse(project: Project, chapterId: string, message: string): AgentModelResponse {
  const chapter = project.chapters.find((candidate) => candidate.id === chapterId)
  const sheetAsk = /(?:create|draft|make|fill|flesh).*(?:character|organization|sheet)|(?:character|organization).*(?:sheet|profile)/i.test(message)
  if (!sheetAsk) {
    return { message: `For ${chapter?.title ?? 'this chapter'}, keep drafting, then run Continuity after the scene.`, sheetPack: null }
  }
  const organization = /organization|order/i.test(message)
  return {
    message: 'I prepared a proposal pack. Review it before accepting it into the bible.',
    sheetPack: organization
      ? { name: 'Ember Order', kind: 'organization', summary: 'A disciplined order tied to the ember.', facts: [
          { key: 'purpose', value: 'guard the ember', statement: 'The Ember Order guards the ember' },
          { key: 'leader', value: 'unknown', statement: 'The Ember Order leader is not yet decided' },
        ] }
      : { name: /kael/i.test(message) ? 'Kael' : 'New Character', kind: 'character', summary: 'A character ready for the author to refine.', facts: [
          { key: 'role', value: 'supporting character', statement: 'Role: supporting character' },
          { key: 'goal', value: 'undecided', statement: 'Goal: undecided' },
        ] },
  }
}

async function liveResponse(config: LlmConfig, project: Project, chapterId: string, message: string): Promise<AgentModelResponse> {
  const chapter = project.chapters.find((candidate) => candidate.id === chapterId)
  const raw = await completeJson(
    config,
    'You are Storylint sheet assistance. Respond as JSON: {"message": string, "sheetPack": null or {"name": string, "kind": "character"|"lore"|"world"|"organization", "summary": string, "facts": [{"key": string,"value": string,"statement": string}]}}. Only return a sheetPack when the user asks to create or fill a sheet. Everything is proposal-only until Accept.',
    `Current chapter: ${chapter?.title ?? ''}\n${chapter?.body ?? ''}\n\nExisting sheets: ${project.sheets.map((sheet) => `${sheet.kind}:${sheet.name}`).join(', ')}\n\nUser: ${message}`,
  )
  if (typeof raw !== 'object' || raw === null || !('message' in raw) || typeof raw.message !== 'string') throw new Error('Invalid agent response')
  return { message: raw.message, sheetPack: parsePack('sheetPack' in raw ? raw.sheetPack : null) }
}

export async function runAgent(
  project: Project,
  chapterId: string,
  message: string,
  config: LlmConfig,
  completion: AgentCompletion = liveResponse,
): Promise<AgentRunResult> {
  const mode = config.fixture || !hasLiveLlm(config) ? 'fixture' : 'live'
  const response = mode === 'fixture'
    ? fixtureResponse(project, chapterId, message)
    : await completion(config, project, chapterId, message)
  const sheetPack = parsePack(response.sheetPack)
  return {
    mode,
    message: response.message,
    proposals: sheetPack ? proposalsFrom(sheetPack, chapterId, message) : [],
  }
}
