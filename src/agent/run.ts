import { claimFingerprint } from '../domain/fingerprint.ts'
import type { Claim, LabCardKind, Project, Proposal, SheetKind } from '../domain/types.ts'
import { completeJson, completeText } from '../server/llm.ts'
import { hasLiveLlm, type LlmConfig } from '../llm/types.ts'
import type { AgentModelResponse, AgentRunResult, LabCardDraft, SheetPack } from './types.ts'

const SHEET_ASK =
  /(?:create|draft|make|fill|flesh).*(?:character|organization|sheet)|(?:character|organization).*(?:sheet|profile)|\/sheet\b/i

const LAB_ASK =
  /(?:brainstorm|spark|fork|what[- ]?if|lab\b|onto the bench|for the lab|@lab)/i

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

function parseLabCards(value: unknown): LabCardDraft[] {
  if (value == null) return []
  if (!Array.isArray(value)) throw new Error('Invalid lab cards')
  const kinds = new Set(['beat', 'place', 'character-spark', 'lore-spark', 'what-if', 'question', 'motif'])
  return value.map((entry) => {
    if (typeof entry !== 'object' || entry === null) throw new Error('Invalid lab card draft')
    const raw = entry as Record<string, unknown>
    if (!kinds.has(String(raw.kind))) throw new Error('Invalid lab card kind')
    if (typeof raw.title !== 'string' || !raw.title.trim()) throw new Error('Invalid lab card title')
    return {
      kind: raw.kind as LabCardKind,
      title: raw.title.trim(),
      body: typeof raw.body === 'string' ? raw.body.trim() : '',
      boardId: typeof raw.boardId === 'string' ? raw.boardId : undefined,
    }
  })
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

function projectContext(project: Project, chapterId: string): string {
  const chapter = project.chapters.find((candidate) => candidate.id === chapterId)
  const sheets = project.sheets.length === 0
    ? '(none yet)'
    : project.sheets.map((sheet) => {
      const facts = sheet.facts.slice(0, 12).map((fact) => `  - ${fact.key}: ${fact.value}`).join('\n')
      return `- ${sheet.kind}: ${sheet.name}${sheet.summary ? ` — ${sheet.summary}` : ''}${facts ? `\n${facts}` : ''}`
    }).join('\n')
  const lab = project.lab?.cards.filter((card) => card.status === 'active' || card.status === 'pinned').slice(0, 12)
    .map((card) => `- [${card.kind}] ${card.title}`)
    .join('\n') || '(empty bench)'
  const body = chapter?.body ?? ''
  const clipped = body.length > 12_000 ? `${body.slice(0, 12_000)}\n…[truncated]` : body
  return [
    `Project: ${project.title}`,
    `Chapter: ${chapter?.title ?? chapterId}`,
    '',
    'Manuscript:',
    clipped || '(empty)',
    '',
    'Canon sheets:',
    sheets,
    '',
    'Lab bench (pre-canon, not Canon):',
    lab,
  ].join('\n')
}

function fixtureLabCards(message: string): LabCardDraft[] {
  if (/place|siege|city|setting/i.test(message)) {
    return [
      { kind: 'place', title: 'Siege gate', body: 'Outer arch where the first breach happens.' },
      { kind: 'place', title: 'Ash market', body: 'Covered stalls under ember dust.' },
      { kind: 'place', title: 'Old well', body: 'Quiet water the city still trusts.' },
    ]
  }
  if (/character|rival|spark a/i.test(message)) {
    return [
      { kind: 'character-spark', title: 'Rival courier', body: 'Fast, indebted, knows every rooftop shortcut.' },
    ]
  }
  if (/beat|plot/i.test(message)) {
    return [
      { kind: 'beat', title: 'Signal fails', body: 'The planned flare never rises.' },
      { kind: 'beat', title: 'False surrender', body: 'A white flag hides a second force.' },
      { kind: 'beat', title: 'Hidden ledger', body: 'Someone has been counting the dead twice.' },
    ]
  }
  if (/what[- ]?if|fork/i.test(message)) {
    return [
      { kind: 'what-if', title: 'What if the treaty fails?', body: 'Allies treat the ceasefire as cover for a night raid.' },
    ]
  }
  return [
    { kind: 'motif', title: 'Cold iron taste', body: 'A sensory refrain when danger nears.' },
    { kind: 'question', title: 'Who opened the gate?', body: 'Open problem for later Continuity, not canon yet.' },
  ]
}

function fixtureResponse(project: Project, chapterId: string, message: string): AgentModelResponse {
  const chapter = project.chapters.find((candidate) => candidate.id === chapterId)
  if (LAB_ASK.test(message) && !SHEET_ASK.test(message)) {
    const labCards = fixtureLabCards(message)
    return {
      message: `I put ${labCards.length} card${labCards.length === 1 ? '' : 's'} on the Lab bench. Nothing is canon until you Promote → Accept.`,
      sheetPack: null,
      labCards,
    }
  }
  const sheetAsk = SHEET_ASK.test(message)
  if (!sheetAsk) {
    return {
      message: [
        `(fixture mode) I can only run canned replies until the API has live LLM_* and is started without STORYLINT_FIXTURE_LLM=1.`,
        `You're on “${chapter?.title ?? 'this chapter'}”. Try Continuity, Review, co-write, Lab brainstorm, or ask “draft a character sheet for Name”.`,
      ].join(' '),
      sheetPack: null,
      labCards: [],
    }
  }
  const organization = /organization|order/i.test(message)
  return {
    message: 'I prepared a proposal pack. Review it in the Companion Inbox before accepting it into Canon.',
    sheetPack: organization
      ? { name: 'Ember Order', kind: 'organization', summary: 'A disciplined order tied to the ember.', facts: [
          { key: 'purpose', value: 'guard the ember', statement: 'The Ember Order guards the ember' },
          { key: 'leader', value: 'unknown', statement: 'The Ember Order leader is not yet decided' },
        ] }
      : { name: /kael/i.test(message) ? 'Kael' : 'New Character', kind: 'character', summary: 'A character ready for the author to refine.', facts: [
          { key: 'role', value: 'supporting character', statement: 'Role: supporting character' },
          { key: 'goal', value: 'undecided', statement: 'Goal: undecided' },
        ] },
    labCards: [],
  }
}

async function liveResponse(config: LlmConfig, project: Project, chapterId: string, message: string): Promise<AgentModelResponse> {
  const context = projectContext(project, chapterId)
  if (LAB_ASK.test(message) && !SHEET_ASK.test(message)) {
    const raw = await completeJson(
      config,
      'You are Storylint Lab assistance. Lab is pre-canon only. Respond ONLY as JSON: {"message": string, "labCards": [{"kind":"beat"|"place"|"character-spark"|"lore-spark"|"what-if"|"question"|"motif","title":string,"body":string}]}. Put ideas on the Lab bench. Never claim sheets or chapters were written. Prefer 1-3 cards.',
      `${context}\n\nUser: ${message}`,
    )
    if (typeof raw !== 'object' || raw === null || !('message' in raw) || typeof raw.message !== 'string') {
      throw new Error('Invalid agent response')
    }
    return {
      message: raw.message,
      sheetPack: null,
      labCards: parseLabCards('labCards' in raw ? raw.labCards : []),
    }
  }
  if (SHEET_ASK.test(message)) {
    const raw = await completeJson(
      config,
      'You are Storylint sheet assistance inside a fiction IDE. Respond ONLY as JSON: {"message": string, "sheetPack": null or {"name": string, "kind": "character"|"lore"|"world"|"organization", "summary": string, "facts": [{"key": string,"value": string,"statement": string}]}}. Return a sheetPack because the user asked to create or fill a sheet. Everything is proposal-only until the human Accepts — never claim canon was written.',
      `${context}\n\nUser: ${message}`,
    )
    if (typeof raw !== 'object' || raw === null || !('message' in raw) || typeof raw.message !== 'string') {
      throw new Error('Invalid agent response')
    }
    return { message: raw.message, sheetPack: parsePack('sheetPack' in raw ? raw.sheetPack : null), labCards: [] }
  }

  const reply = await completeText(
    config,
    [
      'You are the Storylint project agent — a sharp fiction writing partner in the Companion panel.',
      'You know this project’s manuscript chapter, Canon sheets, and Lab bench (context below).',
      'Help with craft, continuity questions, brainstorming, and Canon planning.',
      'Lab text is pre-canon — never treat it as Canon or manuscript.',
      'Do not rewrite the manuscript in-place; suggest wording they can Apply via co-write tools if they want draft text.',
      'Do not treat pending ideas as accepted canon. Be concise and concrete.',
    ].join(' '),
    `${context}\n\nUser: ${message}`,
  )
  return { message: reply, sheetPack: null, labCards: [] }
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
  const labCards = parseLabCards(response.labCards ?? [])
  return {
    mode,
    message: response.message,
    proposals: sheetPack ? proposalsFrom(sheetPack, chapterId, message) : [],
    labCards,
  }
}
