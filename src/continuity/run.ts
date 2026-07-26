import { lintClaims } from '../domain/lint.ts'
import type { Claim, Project } from '../domain/types.ts'
import { extractFixtureClaims } from './fixture.ts'
import { extractLiveClaims } from './live.ts'
import type { LlmConfig } from '../llm/types.ts'

export type ContinuityMode = 'fixture' | 'live'
export type LiveExtractor = (project: Project, chapterId: string, config: LlmConfig) => Promise<Claim[]>

export type RunOptions = {
  live: LlmConfig
  fixture: boolean
  liveExtractor?: LiveExtractor
}

export type ContinuityResult = {
  mode: ContinuityMode
  project: Project
  counts: { red: number; yellow: number; proposals: number }
}

export async function runContinuity(
  project: Project,
  chapterId: string,
  options: RunOptions,
): Promise<ContinuityResult> {
  const chapter = project.chapters.find((candidate) => candidate.id === chapterId)
  if (!chapter) throw new Error(`Chapter not found: ${chapterId}`)
  const configured = Boolean(options.live.model && options.live.baseUrl)
  const mode: ContinuityMode = options.fixture || !configured ? 'fixture' : 'live'
  const claims = mode === 'fixture'
    ? extractFixtureClaims(chapter)
    : await (options.liveExtractor ?? extractLiveClaims)(project, chapterId, options.live)
  const uniqueClaims = claims.filter((claim, index, all) =>
    all.findIndex((candidate) =>
      candidate.entityName === claim.entityName &&
      candidate.key === claim.key &&
      candidate.value === claim.value &&
      candidate.span.start === claim.span.start &&
      candidate.span.end === claim.span.end,
    ) === index,
  )
  const linted = lintClaims(project, uniqueClaims)
  const otherMarks = project.marks.filter((mark) => mark.span.chapterId !== chapterId)
  const next: Project = {
    ...project,
    marks: [...otherMarks, ...linted.marks],
    proposals: [
      ...project.proposals.filter((proposal) =>
        proposal.packId !== undefined || proposal.status !== 'pending' || proposal.source.chapterId !== chapterId,
      ),
      ...linted.proposals,
    ],
  }
  return {
    mode,
    project: next,
    counts: {
      red: linted.marks.filter((mark) => mark.severity === 'red').length,
      yellow: linted.marks.filter((mark) => mark.severity === 'yellow').length,
      proposals: linted.proposals.length,
    },
  }
}
