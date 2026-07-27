import { CRAFT_TAGS, type CraftTag, type Project } from '../domain/types.ts'
import type { LlmConfig } from '../llm/types.ts'
import { hasLiveLlm } from '../llm/types.ts'
import { completeJson } from '../server/llm.ts'
import type { ReviewFinding, ReviewKind, ReviewResult } from './types.ts'

type RawReview = {
  findings: Array<{ lens: ReviewFinding['lens']; title: string; detail: string }>
  suggestedTags: CraftTag[]
}

export type ReviewCompletion = (
  config: LlmConfig,
  project: Project,
  chapterId: string,
  kind: ReviewKind,
) => Promise<RawReview>

function parseReview(value: unknown): RawReview {
  if (typeof value !== 'object' || value === null || !('findings' in value) || !Array.isArray(value.findings)) {
    throw new Error('Invalid review response')
  }
  const raw = value as Record<string, unknown>
  const findings = value.findings.map((entry) => {
    if (typeof entry !== 'object' || entry === null) throw new Error('Invalid review finding')
    const finding = entry as Record<string, unknown>
    if (!['plot', 'culture', 'gap', 'craft'].includes(String(finding.lens)) ||
        typeof finding.title !== 'string' || !finding.title.trim() ||
        typeof finding.detail !== 'string' || !finding.detail.trim()) {
      throw new Error('Invalid review finding')
    }
    return {
      lens: finding.lens as ReviewFinding['lens'],
      title: finding.title.trim(),
      detail: finding.detail.trim(),
    }
  })
  const tags = Array.isArray(raw.suggestedTags) ? raw.suggestedTags : []
  const suggestedTags = tags.map((tag) => {
    if (typeof tag !== 'string' || !CRAFT_TAGS.includes(tag as CraftTag)) {
      throw new Error('Invalid suggested craft tag')
    }
    return tag as CraftTag
  })
  return { findings, suggestedTags: [...new Set(suggestedTags)] }
}

function fixtureReview(kind: ReviewKind): RawReview {
  if (kind === 'craft') {
    return {
      findings: [
        { lens: 'craft', title: 'Pressure stays flat', detail: 'Consider giving Aria a choice that costs her something before the scene ends.' },
        { lens: 'craft', title: 'Tagged progress, little change', detail: 'The plot moves locations, but the character state remains unchanged.' },
      ],
      suggestedTags: ['char-dev', 'setup'],
    }
  }
  return {
    findings: [
      { lens: 'plot', title: 'Low resistance', detail: 'The sealed archive opens without a visible obstacle or consequence.' },
      { lens: 'culture', title: 'Archive custom is implicit', detail: 'Clarify who is permitted to enter and what rule Aria breaks.' },
      { lens: 'gap', title: 'Unrecorded archive rule', detail: 'The access rule may belong in a lore or organization sheet if it becomes canon.' },
    ],
    suggestedTags: ['char-dev', 'world-build', 'setup'],
  }
}

async function liveReview(
  config: LlmConfig,
  project: Project,
  chapterId: string,
  kind: ReviewKind,
): Promise<RawReview> {
  const chapter = project.chapters.find((candidate) => candidate.id === chapterId)
  if (!chapter) throw new Error(`Chapter not found: ${chapterId}`)
  const bible = project.sheets.map((sheet) => `${sheet.kind}: ${sheet.name} — ${sheet.summary}`).join('\n')
  if (chapter.body.length + bible.length > 200_000) throw new Error('Chapter and bible context are too large for review')
  return parseReview(await completeJson(
    config,
    `You are an on-demand fiction ${kind === 'craft' ? 'craft coach' : 'review panel'}. Return JSON {"findings":[{"lens":"plot"|"culture"|"gap"|"craft","title":string,"detail":string}],"suggestedTags":["char-dev"|"plot-progress"|"twist"|"world-build"|"relationship"|"setup"|"payoff"|"breather"]}. Findings are neutral coaching in the agent panel, never continuity diagnostics. Do not rewrite prose or update canon.`,
    `Chapter: ${chapter.title}\nTags: ${chapter.craftTags.join(', ')}\n${chapter.body}\n\nBible context:\n${bible}`,
  ))
}

export async function runReview(
  project: Project,
  chapterId: string,
  kind: ReviewKind,
  config: LlmConfig,
  completion: ReviewCompletion = liveReview,
): Promise<ReviewResult> {
  if (!project.chapters.some((chapter) => chapter.id === chapterId)) {
    throw new Error(`Chapter not found: ${chapterId}`)
  }
  const mode = config.fixture || !hasLiveLlm(config) ? 'fixture' : 'live'
  const raw = mode === 'fixture' ? fixtureReview(kind) : parseReview(await completion(config, project, chapterId, kind))
  return {
    mode,
    kind,
    findings: raw.findings.map((finding, index) => ({ ...finding, id: `${kind}-${index}` })),
    suggestedTags: raw.suggestedTags,
  }
}
