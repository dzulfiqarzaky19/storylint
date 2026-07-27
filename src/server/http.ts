import { createServer as createNodeServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { runContinuity } from '../continuity/run.ts'
import { runAgent } from '../agent/run.ts'
import { acceptProposal, rejectProposal } from '../domain/proposals.ts'
import { deleteFact, patchChapter, upsertChapter, upsertFact, upsertSheet } from '../domain/project.ts'
import { ProjectStore } from './store.ts'
import { llmConfig } from './llmConfig.ts'
import { LlmError } from './llm.ts'
import { runCowrite } from '../cowrite/run.ts'
import { applyManuscriptText, type ApplyTarget } from '../domain/apply.ts'
import { runReview } from '../review/run.ts'
import { researchProposal, runResearch } from '../research/run.ts'
import { parseResearchNote } from './validation.ts'
import { parseChapter, parseChapterPatch, parseFact, parseProject, parseProposalEdits, parseSheet } from './validation.ts'

const MAX_BODY_BYTES = 1_000_000

class ConflictError extends Error {}

type Route = {
  method: string
  pattern: RegExp
  handle: (params: string[], body: unknown) => Promise<unknown>
}

async function readBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    size += buffer.length
    if (size > MAX_BODY_BYTES) throw new Error('Request body too large')
    chunks.push(buffer)
  }
  if (chunks.length === 0) return {}
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    throw new Error('Request body must be valid JSON')
  }
}

function json(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  })
  response.end(JSON.stringify(body))
}

function routeSegment(value: string): string {
  return decodeURIComponent(value)
}

export function createServer(store: ProjectStore) {
  const routes: Route[] = [
    {
      method: 'GET',
      pattern: /^\/api\/project$/,
      handle: async () => store.load(),
    },
    {
      method: 'PUT',
      pattern: /^\/api\/project$/,
      handle: async (_params, body) => {
        const project = parseProject(body)
        await store.save(project)
        return project
      },
    },
    {
      method: 'PUT',
      pattern: /^\/api\/chapters\/([^/]+)$/,
      handle: async ([id], body) => {
        const chapter = parseChapter(body)
        if (chapter.id !== routeSegment(id)) throw new Error('Chapter id does not match route')
        return store.update((project) => upsertChapter(project, chapter))
      },
    },
    {
      method: 'PATCH',
      pattern: /^\/api\/chapters\/([^/]+)$/,
      handle: async ([id], body) =>
        store.update((project) => patchChapter(project, routeSegment(id), parseChapterPatch(body))),
    },
    {
      method: 'PUT',
      pattern: /^\/api\/sheets\/([^/]+)$/,
      handle: async ([id], body) => {
        const sheet = parseSheet(body)
        if (sheet.id !== routeSegment(id)) throw new Error('Sheet id does not match route')
        return store.update((project) => upsertSheet(project, sheet))
      },
    },
    {
      method: 'PUT',
      pattern: /^\/api\/sheets\/([^/]+)\/facts\/([^/]+)$/,
      handle: async ([sheetId, factId], body) => {
        const fact = parseFact(body)
        if (fact.id !== routeSegment(factId)) throw new Error('Fact id does not match route')
        return store.update((project) => upsertFact(project, routeSegment(sheetId), fact))
      },
    },
    {
      method: 'DELETE',
      pattern: /^\/api\/sheets\/([^/]+)\/facts\/([^/]+)$/,
      handle: async ([sheetId, factId]) =>
        store.update((project) => deleteFact(project, routeSegment(sheetId), routeSegment(factId))),
    },
    {
      method: 'POST',
      pattern: /^\/api\/research$/,
      handle: async (_params, body) => {
        if (typeof body !== 'object' || body === null || !('query' in body) || typeof body.query !== 'string') {
          throw new Error('research query is required')
        }
        return runResearch(await store.load(), body.query, llmConfig())
      },
    },
    {
      method: 'POST',
      pattern: /^\/api\/research\/pin$/,
      handle: async (_params, body) => {
        const note = parseResearchNote(body)
        return store.update((project) => {
          const existing = project.researchNotes.find((candidate) => candidate.id === note.id)
          if (existing && JSON.stringify(existing) !== JSON.stringify(note)) {
            throw new ConflictError(`Research note id already exists: ${note.id}`)
          }
          return existing ? project : { ...project, researchNotes: [...project.researchNotes, note] }
        })
      },
    },
    {
      method: 'POST',
      pattern: /^\/api\/research\/propose$/,
      handle: async (_params, body) => {
        const note = parseResearchNote(body)
        const proposal = researchProposal(note)
        return store.update((project) => ({
          ...project,
          proposals: project.proposals.some((existing) => existing.fingerprint === proposal.fingerprint)
            ? project.proposals
            : [...project.proposals, proposal],
        }))
      },
    },
    {
      method: 'POST',
      pattern: /^\/api\/review\/([^/]+)$/,
      handle: async ([chapterId], body) => {
        if (typeof body !== 'object' || body === null || !('kind' in body) ||
            !['review', 'craft'].includes(String(body.kind))) {
          throw new Error('review kind must be review or craft')
        }
        return runReview(
          await store.load(),
          routeSegment(chapterId),
          body.kind as 'review' | 'craft',
          llmConfig(),
        )
      },
    },
    {
      method: 'POST',
      pattern: /^\/api\/cowrite$/,
      handle: async (_params, body) => {
        if (typeof body !== 'object' || body === null) throw new Error('co-write request must be an object')
        const raw = body as Record<string, unknown>
        if (typeof raw.chapterId !== 'string' ||
            !['continue', 'rewrite', 'brainstorm'].includes(String(raw.skill)) ||
            typeof raw.instruction !== 'string' || typeof raw.start !== 'number' || typeof raw.end !== 'number') {
          throw new Error('invalid co-write request')
        }
        return runCowrite(await store.load(), {
          chapterId: raw.chapterId,
          skill: raw.skill as 'continue' | 'rewrite' | 'brainstorm',
          instruction: raw.instruction,
          start: raw.start,
          end: raw.end,
        }, llmConfig())
      },
    },
    {
      method: 'POST',
      pattern: /^\/api\/chapters\/([^/]+)\/apply$/,
      handle: async ([chapterId], body) => {
        if (typeof body !== 'object' || body === null) throw new Error('Apply request must be an object')
        const raw = body as Record<string, unknown>
        const target = raw.target
        if (typeof raw.text !== 'string' || !raw.text || typeof raw.expectedBody !== 'string' ||
            typeof raw.expectedText !== 'string' || typeof target !== 'object' || target === null) {
          throw new Error('Invalid Apply request')
        }
        const parsed = target as Record<string, unknown>
        if (!['insert', 'replace'].includes(String(parsed.mode)) ||
            typeof parsed.start !== 'number' || typeof parsed.end !== 'number') {
          throw new Error('Invalid Apply target')
        }
        const applyTarget = parsed as ApplyTarget
        return store.update((project) => {
          const id = routeSegment(chapterId)
          const chapter = project.chapters.find((candidate) => candidate.id === id)
          if (!chapter) throw new Error(`Chapter not found: ${id}`)
          if (chapter.body !== raw.expectedBody ||
              chapter.body.slice(applyTarget.start, applyTarget.end) !== raw.expectedText) {
            throw new ConflictError('Chapter changed since this suggestion was generated')
          }
          return patchChapter(project, id, {
            body: applyManuscriptText(chapter.body, applyTarget, raw.text as string),
          })
        })
      },
    },
    {
      method: 'POST',
      pattern: /^\/api\/chat$/,
      handle: async (_params, body) => {
        if (typeof body !== 'object' || body === null) throw new Error('chat request must be an object')
        const raw = body as Record<string, unknown>
        if (typeof raw.chapterId !== 'string' || typeof raw.message !== 'string' || !raw.message.trim()) {
          throw new Error('chat requires chapterId and message')
        }
        const snapshot = await store.load()
        const chapter = snapshot.chapters.find((candidate) => candidate.id === raw.chapterId)
        if (!chapter) throw new Error(`Chapter not found: ${raw.chapterId}`)
        const contextVersion = JSON.stringify({ body: chapter.body, sheets: snapshot.sheets })
        const result = await runAgent(snapshot, raw.chapterId, raw.message.trim(), llmConfig())
        let project = snapshot
        if (result.proposals.length > 0) {
          project = await store.update((project) => {
            const currentChapter = project.chapters.find((candidate) => candidate.id === raw.chapterId)
            const currentVersion = JSON.stringify({ body: currentChapter?.body, sheets: project.sheets })
            if (currentVersion !== contextVersion) throw new Error('Project context changed during agent request; send it again')
            return {
              ...project,
              proposals: [
                ...project.proposals,
                ...result.proposals.filter((proposal) =>
                  !project.proposals.some((existing) => existing.fingerprint === proposal.fingerprint),
                ),
              ],
            }
          })
        }
        return { ...result, project }
      },
    },
    {
      method: 'POST',
      pattern: /^\/api\/continuity\/([^/]+)$/,
      handle: async ([chapterId]) => {
        const id = routeSegment(chapterId)
        const snapshot = await store.load()
        const analyzedBody = snapshot.chapters.find((chapter) => chapter.id === id)?.body
        const config = llmConfig()
        const result = await runContinuity(snapshot, id, {
          live: config,
          fixture: config.fixture,
        })
        const project = await store.update((current) => {
          const currentBody = current.chapters.find((chapter) => chapter.id === id)?.body
          if (currentBody !== analyzedBody) throw new Error('Chapter changed during continuity run; run it again')
          return {
            ...current,
            marks: [
              ...current.marks.filter((mark) => mark.span.chapterId !== id),
              ...result.project.marks.filter((mark) => mark.span.chapterId === id),
            ],
            proposals: [
              ...current.proposals.filter((proposal) =>
                proposal.packId !== undefined || proposal.status !== 'pending' || proposal.source.chapterId !== id,
              ),
              ...result.project.proposals.filter((proposal) =>
                proposal.packId === undefined &&
                proposal.status === 'pending' &&
                proposal.source.chapterId === id &&
                !current.proposals.some((existing) =>
                  existing.status !== 'pending' && existing.fingerprint === proposal.fingerprint,
                ),
              ),
            ],
          }
        })
        return { project, mode: result.mode, counts: result.counts }
      },
    },
    {
      method: 'POST',
      pattern: /^\/api\/proposals\/([^/]+)\/accept$/,
      handle: async ([proposalId], body) =>
        store.update((project) =>
          acceptProposal(project, routeSegment(proposalId), parseProposalEdits(body)),
        ),
    },
    {
      method: 'PATCH',
      pattern: /^\/api\/proposals\/([^/]+)$/,
      handle: async ([proposalId], body) =>
        store.update((project) => {
          const id = routeSegment(proposalId)
          const edits = parseProposalEdits(body)
          const found = project.proposals.find((proposal) => proposal.id === id)
          if (!found) throw new Error(`Proposal not found: ${id}`)
          if (found.status !== 'pending') throw new Error(`Proposal is already ${found.status}`)
          return {
            ...project,
            proposals: project.proposals.map((proposal) =>
              proposal.id === id ? { ...proposal, ...edits } : proposal,
            ),
          }
        }),
    },
    {
      method: 'POST',
      pattern: /^\/api\/proposals\/([^/]+)\/reject$/,
      handle: async ([proposalId]) =>
        store.update((project) => rejectProposal(project, routeSegment(proposalId))),
    },
  ]

  return createNodeServer(async (request, response) => {
    const url = new URL(request.url ?? '/', 'http://127.0.0.1')
    const route = routes.find(
      (candidate) => candidate.method === request.method && candidate.pattern.test(url.pathname),
    )
    if (!route) {
      json(response, 404, { error: 'Not found' })
      return
    }

    const match = route.pattern.exec(url.pathname)
    if (!match) {
      json(response, 404, { error: 'Not found' })
      return
    }

    try {
      const body = request.method === 'GET' ? {} : await readBody(request)
      json(response, 200, await route.handle(match.slice(1), body))
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Request failed'
      const status = error instanceof LlmError ? 502
        : error instanceof ConflictError ? 409
        : message.includes('not found') ? 404
        : 400
      json(response, status, { error: message })
    }
  })
}
