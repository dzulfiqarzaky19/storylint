import type { Project } from '../domain/types.ts'
import { completeJson } from '../server/llm.ts'
import { hasLiveLlm, type LlmConfig } from '../llm/types.ts'
import type { ApplyCard, CowriteRequest, CowriteResult } from './types.ts'

export type CowriteCompletion = (
  config: LlmConfig,
  project: Project,
  request: CowriteRequest,
) => Promise<{ text: string }>

function validate(project: Project, request: CowriteRequest) {
  const chapter = project.chapters.find((candidate) => candidate.id === request.chapterId)
  if (!chapter) throw new Error(`Chapter not found: ${request.chapterId}`)
  if (!Number.isInteger(request.start) || !Number.isInteger(request.end) ||
      request.start < 0 || request.end < request.start || request.end > chapter.body.length) {
    throw new Error('Invalid manuscript selection')
  }
  if (request.skill === 'rewrite' && request.start === request.end) {
    throw new Error('Rewrite requires a selection')
  }
  return chapter
}

function fixtureText(skill: CowriteRequest['skill']): string {
  if (skill === 'rewrite') return 'Aria eased the door open, listening for breath beyond it.'
  if (skill === 'brainstorm') return 'A storm cuts the lights just as the visitor names Aria.'
  return ' A floorboard answered from the dark hall, too measured to be the house settling.'
}

async function liveCompletion(
  config: LlmConfig,
  project: Project,
  request: CowriteRequest,
): Promise<{ text: string }> {
  const chapter = validate(project, request)
  const selection = chapter.body.slice(request.start, request.end)
  const canon = project.sheets.map((sheet) => `${sheet.kind}: ${sheet.name} — ${sheet.summary}`).join('\n')
  if (chapter.body.length + canon.length > 200_000) {
    throw new Error('Chapter and Canon context are too large for co-write')
  }
  const response = await completeJson(
    config,
    'You are a fiction co-writer. Return JSON exactly as {"text": string}. Draft only the requested manuscript-ready snippet. Do not claim it was inserted. Do not change canon.',
    `Skill: ${request.skill}\nInstruction: ${request.instruction}\nChapter: ${chapter.title}\nSelection: ${selection || '(cursor only)'}\nManuscript:\n${chapter.body}\n\nCanon context:\n${canon}`,
  )
  if (typeof response !== 'object' || response === null || !('text' in response) ||
      typeof response.text !== 'string' || !response.text.trim()) {
    throw new Error('Invalid co-write response')
  }
  return { text: response.text }
}

export async function runCowrite(
  project: Project,
  request: CowriteRequest,
  config: LlmConfig,
  completion: CowriteCompletion = liveCompletion,
): Promise<CowriteResult> {
  const chapter = validate(project, request)
  const mode = config.fixture || !hasLiveLlm(config) ? 'fixture' : 'live'
  const generated = mode === 'fixture'
    ? { text: fixtureText(request.skill) }
    : await completion(config, project, request)
  if (!generated.text.trim()) throw new Error('Co-write returned empty text')
  const target = {
    mode: request.skill === 'rewrite' ? 'replace' : 'insert',
    start: request.start,
    end: request.skill === 'rewrite' ? request.end : request.start,
  } as const
  const card: ApplyCard = {
    id: `apply-${Date.now()}`,
    chapterId: request.chapterId,
    skill: request.skill,
    text: generated.text,
    target,
    expectedBody: chapter.body,
    expectedText: chapter.body.slice(target.start, target.end),
  }
  return { mode, card }
}
