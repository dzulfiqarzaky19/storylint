import type { Chapter, Fact, Project, Proposal, Sheet } from '../../domain/types.ts'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: init?.body
      ? { 'content-type': 'application/json', ...init.headers }
      : init?.headers,
  })
  if (!response.ok) {
    const message = await response
      .json()
      .then((body: unknown) =>
        typeof body === 'object' && body !== null && 'error' in body && typeof body.error === 'string'
          ? body.error
          : response.statusText,
      )
      .catch(() => response.statusText)
    throw new Error(message)
  }
  return response.json() as Promise<T>
}

export function loadProject(signal?: AbortSignal): Promise<Project> {
  return request('/api/project', { signal })
}

export function saveChapter(chapter: Chapter): Promise<Project> {
  return request(`/api/chapters/${encodeURIComponent(chapter.id)}`, {
    method: 'PUT',
    body: JSON.stringify(chapter),
  })
}

export function upsertSheet(sheet: Sheet): Promise<Project> {
  return request(`/api/sheets/${encodeURIComponent(sheet.id)}`, {
    method: 'PUT',
    body: JSON.stringify(sheet),
  })
}

export function upsertFact(sheetId: string, fact: Fact): Promise<Project> {
  return request(
    `/api/sheets/${encodeURIComponent(sheetId)}/facts/${encodeURIComponent(fact.id)}`,
    { method: 'PUT', body: JSON.stringify(fact) },
  )
}

export function removeFact(sheetId: string, factId: string): Promise<Project> {
  return request(
    `/api/sheets/${encodeURIComponent(sheetId)}/facts/${encodeURIComponent(factId)}`,
    { method: 'DELETE' },
  )
}

export type ContinuityResponse = {
  project: Project
  mode: 'fixture' | 'live'
  counts: { red: number; yellow: number; proposals: number }
}

export function runContinuity(chapterId: string): Promise<ContinuityResponse> {
  return request(`/api/continuity/${encodeURIComponent(chapterId)}`, {
    method: 'POST', body: '{}',
  })
}

export type ProposalEdits = Partial<Pick<Proposal, 'entityName' | 'key' | 'value' | 'statement' | 'claimKind'>>

export function acceptProposal(id: string, edits: ProposalEdits = {}): Promise<Project> {
  return request(`/api/proposals/${encodeURIComponent(id)}/accept`, {
    method: 'POST', body: JSON.stringify(edits),
  })
}

export function editProposal(id: string, edits: ProposalEdits): Promise<Project> {
  return request(`/api/proposals/${encodeURIComponent(id)}`, {
    method: 'PATCH', body: JSON.stringify(edits),
  })
}

export function rejectProposal(id: string): Promise<Project> {
  return request(`/api/proposals/${encodeURIComponent(id)}/reject`, {
    method: 'POST', body: '{}',
  })
}

export type ChatResponse = {
  mode: 'fixture' | 'live'
  message: string
  project: Project
}

export function sendChat(chapterId: string, message: string): Promise<ChatResponse> {
  return request('/api/chat', {
    method: 'POST', body: JSON.stringify({ chapterId, message }),
  })
}
