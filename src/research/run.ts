import { claimFingerprint } from '../domain/fingerprint.ts'
import type { Claim, Project, Proposal, ResearchNote, ResearchSource } from '../domain/types.ts'
import { hasLiveLlm, type LlmConfig } from '../llm/types.ts'
import { completeJson } from '../server/llm.ts'
import type { ResearchResult } from './types.ts'

type RawResearch = {
  results: Array<{ title: string; summary: string; sources: ResearchSource[] }>
}

export type ResearchCompletion = (
  config: LlmConfig,
  project: Project,
  query: string,
) => Promise<RawResearch>

function hash(value: string): string {
  let result = 0x811c9dc5
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index)
    result = Math.imul(result, 0x01000193)
  }
  return (result >>> 0).toString(16).padStart(8, '0')
}

function parseResearch(value: unknown): RawResearch {
  if (typeof value !== 'object' || value === null || !('results' in value) || !Array.isArray(value.results)) {
    throw new Error('Invalid research response')
  }
  return {
    results: value.results.map((entry) => {
      if (typeof entry !== 'object' || entry === null) throw new Error('Invalid research result')
      const item = entry as Record<string, unknown>
      if (typeof item.title !== 'string' || !item.title.trim() ||
          typeof item.summary !== 'string' || !item.summary.trim() ||
          !Array.isArray(item.sources) || item.sources.length === 0) {
        throw new Error('Research result requires title, summary, and source')
      }
      const sources = item.sources.map((entry) => {
        if (typeof entry !== 'object' || entry === null) throw new Error('Invalid research source')
        const source = entry as Record<string, unknown>
        if (typeof source.title !== 'string' || !source.title.trim() ||
            typeof source.url !== 'string' || !/^https?:\/\//i.test(source.url)) {
          throw new Error('Invalid research source')
        }
        return { title: source.title.trim(), url: source.url.trim() }
      })
      return { title: item.title.trim(), summary: item.summary.trim(), sources }
    }),
  }
}

function fixtureResearch(query: string): RawResearch {
  return {
    results: [
      {
        title: 'Controlled archive access',
        summary: `For “${query}”: historical archives commonly restricted access through custodians, permissions, and oaths. Adapt the pattern rather than copying a single institution.`,
        sources: [
          { title: 'International Council on Archives — Principles of Access', url: 'https://www.ica.org/resource/principles-of-access-to-archives/' },
          { title: 'The National Archives — Archives sector', url: 'https://www.nationalarchives.gov.uk/archives-sector/' },
        ],
      },
    ],
  }
}

async function liveResearch(
  config: LlmConfig,
  project: Project,
  query: string,
): Promise<RawResearch> {
  const context = project.sheets.map((sheet) => `${sheet.kind}: ${sheet.name} — ${sheet.summary}`).join('\n')
  return parseResearch(await completeJson(
    config,
    'You are a fiction research assistant. Return JSON {"results":[{"title":string,"summary":string,"sources":[{"title":string,"url":string}]}]}. Every result requires at least one valid http(s) citation. Distinguish sourced information from adaptation advice. Do not claim to have browsed unless the configured model actually has that capability. Never update canon or manuscript.',
    `Research query: ${query}\n\nProject context:\n${context}`,
  ))
}

export async function runResearch(
  project: Project,
  query: string,
  config: LlmConfig,
  completion: ResearchCompletion = liveResearch,
): Promise<ResearchResult> {
  const normalized = query.trim()
  if (!normalized) throw new Error('Research query is required')
  const mode = config.fixture || !hasLiveLlm(config) ? 'fixture' : 'live'
  const raw = mode === 'fixture'
    ? fixtureResearch(normalized)
    : parseResearch(await completion(config, project, normalized))
  return {
    mode,
    query: normalized,
    results: raw.results.map((item) => ({ ...item, id: `research-${hash(`${normalized}:${item.title}`)}` })),
  }
}

export function researchProposal(result: ResearchNote): Proposal {
  const claim: Claim = {
    entityName: result.title,
    sheetKind: 'lore',
    key: 'research_note',
    value: result.summary,
    statement: `${result.summary} Sources: ${result.sources.map((source) => source.url).join(', ')}`,
    claimKind: 'attribute',
    confidence: 1,
    span: { chapterId: 'research', start: 0, end: 0, text: '' },
  }
  const fingerprint = claimFingerprint(claim)
  return {
    id: `proposal-${fingerprint}`,
    fingerprint,
    status: 'pending',
    entityName: claim.entityName,
    sheetKind: 'lore',
    key: claim.key,
    value: claim.value,
    statement: claim.statement,
    claimKind: 'attribute',
    confidence: 1,
    source: claim.span,
  }
}
