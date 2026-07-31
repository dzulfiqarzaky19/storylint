import { claimFingerprint } from './fingerprint.ts'
import {
  LAB_CARD_KINDS,
  LAB_CARD_STATUSES,
  type Lab,
  type LabBoard,
  type LabCard,
  type LabCardKind,
  type LabCardStatus,
  type Project,
  type Proposal,
  type SheetKind,
} from './types.ts'

export { LAB_CARD_KINDS, LAB_CARD_STATUSES }
export const LAB_PIN_SOFT_CAP = 5

const DEFAULT_BOARD_ID = 'lab-board-bench'

export function emptyLab(_now = new Date().toISOString()): Lab {
  void _now
  const board: LabBoard = {
    id: DEFAULT_BOARD_ID,
    title: 'Bench',
    cardIds: [],
  }
  return { boards: [board], cards: [] }
}

export function ensureLab(project: Project): Project {
  if (project.lab && project.lab.boards.length > 0) return project
  return { ...project, lab: emptyLab() }
}

function requireLab(project: Project): Lab {
  const lab = ensureLab(project).lab
  if (!lab) throw new Error('Lab missing after ensure')
  return lab
}

function nowIso(): string {
  return new Date().toISOString()
}

function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function boardOrThrow(lab: Lab, boardId: string): LabBoard {
  const board = lab.boards.find((candidate) => candidate.id === boardId)
  if (!board) throw new Error(`Lab board not found: ${boardId}`)
  return board
}

function cardOrThrow(lab: Lab, cardId: string): LabCard {
  const card = lab.cards.find((candidate) => candidate.id === cardId)
  if (!card) throw new Error(`Lab card not found: ${cardId}`)
  return card
}

export type CreateLabCardInput = {
  boardId?: string
  kind: LabCardKind
  title: string
  body?: string
  touches?: LabCard['touches']
}

export function createLabCard(project: Project, input: CreateLabCardInput): Project {
  const base = ensureLab(project)
  const lab = requireLab(base)
  const boardId = input.boardId ?? lab.boards[0]?.id
  if (!boardId) throw new Error('Lab has no boards')
  boardOrThrow(lab, boardId)
  const title = input.title.trim()
  if (!title) throw new Error('Lab card title is required')
  const stamp = nowIso()
  const card: LabCard = {
    id: newId('lab-card'),
    boardId,
    kind: input.kind,
    title,
    body: (input.body ?? '').trim(),
    status: 'active',
    touches: input.touches,
    createdAt: stamp,
    updatedAt: stamp,
  }
  const boards = lab.boards.map((board) =>
    board.id === boardId ? { ...board, cardIds: [card.id, ...board.cardIds] } : board,
  )
  return {
    ...base,
    lab: { boards, cards: [card, ...lab.cards] },
  }
}

export type PatchLabCardInput = Partial<Pick<LabCard, 'title' | 'body' | 'kind' | 'touches'>>

export function patchLabCard(project: Project, cardId: string, patch: PatchLabCardInput): Project {
  const base = ensureLab(project)
  const lab = requireLab(base)
  const current = cardOrThrow(lab, cardId)
  if (current.status === 'archived') throw new Error('Archived lab cards cannot be edited')
  const title = patch.title === undefined ? current.title : patch.title.trim()
  if (!title) throw new Error('Lab card title is required')
  const next: LabCard = {
    ...current,
    title,
    body: patch.body === undefined ? current.body : patch.body,
    kind: patch.kind ?? current.kind,
    touches: patch.touches === undefined ? current.touches : patch.touches,
    updatedAt: nowIso(),
  }
  return {
    ...base,
    lab: {
      ...lab,
      cards: lab.cards.map((card) => (card.id === cardId ? next : card)),
    },
  }
}

/** Archive is soft-delete — cards stay on disk for undo/dogfood. */
export function archiveLabCard(project: Project, cardId: string): Project {
  const base = ensureLab(project)
  const lab = requireLab(base)
  cardOrThrow(lab, cardId)
  return {
    ...base,
    lab: {
      ...lab,
      cards: lab.cards.map((card) =>
        card.id === cardId
          ? { ...card, status: 'archived', updatedAt: nowIso() }
          : card,
      ),
    },
  }
}

/**
 * Pin highlights a card. Soft cap of LAB_PIN_SOFT_CAP does not error —
 * pinning beyond the cap still works; UI may warn.
 */
export function pinLabCard(project: Project, cardId: string, pinned = true): Project {
  const base = ensureLab(project)
  const lab = requireLab(base)
  const current = cardOrThrow(lab, cardId)
  if (current.status === 'archived' || current.status === 'promoted') {
    throw new Error(`Cannot pin a ${current.status} lab card`)
  }
  const status: LabCardStatus = pinned ? 'pinned' : 'active'
  return {
    ...base,
    lab: {
      ...lab,
      cards: lab.cards.map((card) =>
        card.id === cardId ? { ...card, status, updatedAt: nowIso() } : card,
      ),
    },
  }
}

export function createLabBoard(project: Project, title: string): Project {
  const base = ensureLab(project)
  const lab = requireLab(base)
  const trimmed = title.trim() || 'Board'
  const board: LabBoard = {
    id: newId('lab-board'),
    title: trimmed,
    cardIds: [],
  }
  return {
    ...base,
    lab: { ...lab, boards: [...lab.boards, board] },
  }
}

export type PromoteAs = 'sheet-proposal' | 'chapter-stub'

export type PromoteLabCardInput = {
  /** Required for place/lore-spark; optional override for character-spark. */
  sheetKind?: SheetKind
  /** Optional chapter title override for beat → chapter-stub. */
  chapterTitle?: string
}

export type PromoteLabCardResult = {
  project: Project
  as: PromoteAs
  proposalIds?: string[]
  chapterId?: string
}

function sheetKindForCard(card: LabCard, override?: SheetKind): SheetKind {
  if (override) return override
  if (card.kind === 'character-spark') return 'character'
  if (card.kind === 'place') return 'world'
  if (card.kind === 'lore-spark') return 'lore'
  throw new Error(`Lab card kind cannot promote to a sheet: ${card.kind}`)
}

function canPromoteToSheet(kind: LabCardKind): boolean {
  return kind === 'character-spark' || kind === 'place' || kind === 'lore-spark'
}

function canPromoteToChapter(kind: LabCardKind): boolean {
  return kind === 'beat'
}

/**
 * Promote is pre-canon only:
 * - spark/place/lore → pending sheet proposal pack (Accept still required)
 * - beat → empty chapter stub
 * Never writes sheet facts directly.
 */
export function promoteLabCard(
  project: Project,
  cardId: string,
  input: PromoteLabCardInput = {},
): PromoteLabCardResult {
  const base = ensureLab(project)
  const lab = requireLab(base)
  const card = cardOrThrow(lab, cardId)
  if (card.status === 'archived') throw new Error('Cannot promote an archived lab card')
  if (card.status === 'promoted') throw new Error('Lab card is already promoted')

  if (canPromoteToSheet(card.kind)) {
    const sheetKind = sheetKindForCard(card, input.sheetKind)
    const summary = card.body.trim()
    const facts = [
      {
        key: 'lab_spark',
        value: card.title,
        statement: summary
          ? `${card.title}: ${summary}`
          : `${card.title} (promoted from Lab)`,
      },
    ]
    if (summary) {
      facts.push({
        key: 'notes',
        value: summary.slice(0, 200),
        statement: summary,
      })
    }
    const packId = `lab-pack-${card.id}`
    const proposals: Proposal[] = facts.map((fact) => {
      const claim = {
        entityName: card.title,
        sheetKind,
        key: fact.key,
        value: fact.value,
        statement: fact.statement,
        claimKind: 'attribute' as const,
        confidence: 1,
        span: { chapterId: 'lab', start: 0, end: 0, text: card.title },
      }
      const fingerprint = claimFingerprint(claim)
      return {
        id: `proposal-${packId}-${fingerprint}`,
        fingerprint,
        packId,
        status: 'pending' as const,
        entityName: card.title,
        sheetKind,
        sheetSummary: summary || undefined,
        targetSheetId: card.touches?.sheetId,
        key: fact.key,
        value: fact.value,
        statement: fact.statement,
        claimKind: 'attribute' as const,
        confidence: 1,
        source: claim.span,
      }
    })
    const stamp = nowIso()
    const nextCard: LabCard = {
      ...card,
      status: 'promoted',
      promoted: {
        at: stamp,
        as: 'sheet-proposal',
        targetIds: proposals.map((proposal) => proposal.id),
      },
      updatedAt: stamp,
    }
    const next: Project = {
      ...base,
      proposals: [
        ...base.proposals,
        ...proposals.filter(
          (proposal) =>
            !base.proposals.some((existing) => existing.fingerprint === proposal.fingerprint),
        ),
      ],
      lab: {
        ...lab,
        cards: lab.cards.map((candidate) => (candidate.id === cardId ? nextCard : candidate)),
      },
    }
    return {
      project: next,
      as: 'sheet-proposal',
      proposalIds: proposals.map((proposal) => proposal.id),
    }
  }

  if (canPromoteToChapter(card.kind)) {
    const chapterId = newId('chapter')
    const title = (input.chapterTitle ?? card.title).trim() || 'Untitled chapter'
    const stamp = nowIso()
    const nextCard: LabCard = {
      ...card,
      status: 'promoted',
      promoted: {
        at: stamp,
        as: 'chapter-stub',
        targetIds: [chapterId],
      },
      updatedAt: stamp,
    }
    const next: Project = {
      ...base,
      chapters: [
        ...base.chapters,
        {
          id: chapterId,
          title,
          body: '',
          craftTags: [],
          revision: 0,
        },
      ],
      lab: {
        ...lab,
        cards: lab.cards.map((candidate) => (candidate.id === cardId ? nextCard : candidate)),
      },
    }
    return { project: next, as: 'chapter-stub', chapterId }
  }

  throw new Error(
    `Lab card kind "${card.kind}" has no promote path (stay in Lab or change kind)`,
  )
}

/** Continuity / Canon digests must ignore Lab text. */
export function labBodies(project: Project): string[] {
  return (project.lab?.cards ?? []).map((card) => `${card.title}\n${card.body}`)
}
