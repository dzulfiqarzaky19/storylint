import { useEffect, useMemo, useState } from 'react'
import { LAB_CARD_KINDS, type Lab, type LabCard, type LabCardKind, type Project, type SheetKind } from '../../domain/types.ts'
import { Badge, Button, EmptyState, Input, Textarea } from '../../components/ui'
import { needsChapterPromoteConfirm } from './chapterPromoteConfirm.ts'
import './lab.css'

const KIND_LABEL: Record<LabCardKind, string> = {
  beat: 'Beat',
  place: 'Place',
  'character-spark': 'Character',
  'lore-spark': 'Lore',
  'what-if': 'What-if',
  question: 'Question',
  motif: 'Motif',
}

function canPromote(kind: LabCardKind): boolean {
  return kind === 'character-spark' || kind === 'place' || kind === 'lore-spark' || kind === 'beat'
}

/** IA_MAP §4.2: beat → Draft stub; spark/place/lore → Canon proposal. */
function promoteActionLabel(kind: LabCardKind): 'Send to Draft' | 'Promote to Canon' {
  return kind === 'beat' ? 'Send to Draft' : 'Promote to Canon'
}

function defaultSheetKind(kind: LabCardKind): SheetKind | undefined {
  if (kind === 'character-spark') return 'character'
  if (kind === 'place') return 'world'
  if (kind === 'lore-spark') return 'lore'
  return undefined
}

/** Quiet provenance chip — model only; author stays unmarked. */
function SourceChip({ source }: { source: LabCard['source'] }) {
  if (source !== 'model') return null
  return <Badge tone="pending">Spark</Badge>
}

export type LabBenchProps = {
  lab: Lab
  onCreateCard: (input: { boardId?: string; kind: LabCardKind; title: string; body?: string }) => Promise<Project>
  onPatchCard: (cardId: string, patch: { title?: string; body?: string; kind?: LabCardKind }) => Promise<Project>
  onArchiveCard: (cardId: string) => Promise<void>
  onRestoreCard: (cardId: string) => Promise<void>
  onPinCard: (cardId: string, pinned?: boolean) => Promise<void>
  onPromoteCard: (cardId: string, input?: { sheetKind?: SheetKind; chapterTitle?: string }) => Promise<unknown>
  onDismissPromotedCard: (cardId: string) => Promise<void>
  onDismissAllPromoted: () => Promise<void>
  onOpenAgent?: () => void
  activeBoardId?: string | null
  onBoardChange?: (boardId: string) => void
}

export function LabBench({
  lab,
  onCreateCard,
  onPatchCard,
  onArchiveCard,
  onRestoreCard,
  onPinCard,
  onPromoteCard,
  onDismissPromotedCard,
  onDismissAllPromoted,
  onOpenAgent,
  activeBoardId,
  onBoardChange,
}: LabBenchProps) {
  const boards = lab.boards
  const boardId = activeBoardId && boards.some((board) => board.id === activeBoardId)
    ? activeBoardId
    : boards[0]?.id ?? null
  const [kindFilter, setKindFilter] = useState<LabCardKind | 'all'>('all')
  const [draftKind, setDraftKind] = useState<LabCardKind>('character-spark')
  const [draftTitle, setDraftTitle] = useState('')
  const [draftBody, setDraftBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editBody, setEditBody] = useState('')
  const [editKind, setEditKind] = useState<LabCardKind>('character-spark')
  // Chapter promote confirm (model beats required; always available for beats).
  const [confirmCardId, setConfirmCardId] = useState<string | null>(null)
  const [confirmTitle, setConfirmTitle] = useState('')

  useEffect(() => {
    if (boardId) onBoardChange?.(boardId)
  }, [boardId, onBoardChange])

  const cards = useMemo(() => {
    if (!boardId) return [] as LabCard[]
    const order = boards.find((board) => board.id === boardId)?.cardIds ?? []
    const byId = new Map(lab.cards.map((card) => [card.id, card]))
    const ordered = order.map((id) => byId.get(id)).filter((card): card is LabCard => Boolean(card))
    const extras = lab.cards.filter((card) => card.boardId === boardId && !order.includes(card.id))
    return [...ordered, ...extras]
  }, [boardId, boards, lab.cards])

  const live = cards.filter((card) => card.status === 'active' || card.status === 'pinned')
  const promoted = cards.filter((card) => card.status === 'promoted')
  const archived = cards.filter((card) => card.status === 'archived')
  const visible = (kindFilter === 'all' ? live : live.filter((card) => card.kind === kindFilter))
    .slice()
    .sort((a, b) => Number(b.status === 'pinned') - Number(a.status === 'pinned'))

  async function createCard() {
    if (!draftTitle.trim() || busy || !boardId) return
    setBusy(true)
    setNotice(null)
    try {
      await onCreateCard({ boardId, kind: draftKind, title: draftTitle, body: draftBody })
      setDraftTitle('')
      setDraftBody('')
      setNotice('Card on the bench. Nothing is canon until Promote to Canon → Accept. Beats use Send to Draft.')
    } catch (caught) {
      setNotice(caught instanceof Error ? caught.message : 'Could not create card')
    } finally {
      setBusy(false)
    }
  }

  async function saveEdit(cardId: string) {
    if (!editTitle.trim() || busy) return
    setBusy(true)
    try {
      await onPatchCard(cardId, { title: editTitle, body: editBody, kind: editKind })
      setEditingId(null)
    } catch (caught) {
      setNotice(caught instanceof Error ? caught.message : 'Could not save card')
    } finally {
      setBusy(false)
    }
  }

  /**
   * Sheet promote: one-click (Accept is the write gate).
   * Chapter promote: confirm ONLY when kind === 'beat' AND source === 'model'
   * (ox destination-shaped consent). Author beats one-click — title already owned.
   */
  async function promote(card: LabCard) {
    if (busy || !canPromote(card.kind)) return
    if (needsChapterPromoteConfirm(card)) {
      // Model beat → stored chapter title: author must confirm destination payload.
      setConfirmCardId(card.id)
      setConfirmTitle(card.title)
      setNotice(null)
      return
    }
    setBusy(true)
    setNotice(null)
    try {
      await onPromoteCard(card.id, {
        sheetKind: defaultSheetKind(card.kind),
        // Author beat: title already owned — send card title straight through.
        chapterTitle: card.kind === 'beat' ? card.title : undefined,
      })
      setNotice(card.kind === 'beat'
        ? 'Sent to Draft as a chapter stub (empty body). Lab card marked promoted.'
        : 'Promote to Canon queued a sheet proposal. Accept in Companion Inbox to write Canon.')
    } catch (caught) {
      setNotice(caught instanceof Error ? caught.message : `${promoteActionLabel(card.kind)} failed`)
    } finally {
      setBusy(false)
    }
  }

  async function confirmChapterCreate() {
    if (!confirmCardId || busy) return
    setBusy(true)
    setNotice(null)
    try {
      await onPromoteCard(confirmCardId, { chapterTitle: confirmTitle })
      setConfirmCardId(null)
      setConfirmTitle('')
      setNotice('Sent to Draft as a chapter stub (empty body). Lab card marked promoted.')
    } catch (caught) {
      setNotice(caught instanceof Error ? caught.message : 'Send to Draft failed')
    } finally {
      setBusy(false)
    }
  }

  function cancelChapterCreate() {
    // Cancel creates nothing — card stays active.
    setConfirmCardId(null)
    setConfirmTitle('')
  }

  async function dismissOne(cardId: string) {
    if (busy) return
    setBusy(true)
    setNotice(null)
    try {
      await onDismissPromotedCard(cardId)
      setNotice('Dismissed Lab receipt. Canon and Draft are unchanged.')
    } catch (caught) {
      setNotice(caught instanceof Error ? caught.message : 'Could not dismiss')
    } finally {
      setBusy(false)
    }
  }

  async function dismissAll() {
    if (busy || promoted.length === 0) return
    if (promoted.length >= 10) {
      const ok = window.confirm(`Dismiss all ${promoted.length} Promoted receipts? Canon and Draft stay unchanged.`)
      if (!ok) return
    }
    setBusy(true)
    setNotice(null)
    try {
      await onDismissAllPromoted()
      setNotice('Cleared Promoted receipts. Canon and Draft are unchanged.')
    } catch (caught) {
      setNotice(caught instanceof Error ? caught.message : 'Could not clear Promoted')
    } finally {
      setBusy(false)
    }
  }

  const confirmingCard = confirmCardId
    ? cards.find((card) => card.id === confirmCardId) ?? null
    : null

  return (
    <main id="workspace" className="lab" aria-label="Lab" tabIndex={-1}>
      <header className="lab__header">
        <div>
          <h2>Lab</h2>
          <p>Pre-canon bench. Continuity and Canon ignore everything here.</p>
        </div>
        <div className="lab__boards" role="tablist" aria-label="Lab boards">
          {boards.map((board) => (
            <Button
              key={board.id}
              aria-pressed={board.id === boardId}
              onClick={() => onBoardChange?.(board.id)}
            >
              {board.title}
            </Button>
          ))}
        </div>
      </header>

      {/* D3 (closed): filter appears only once cards exist, and its kinds stay behind a disclosure. */}
      {live.length > 0 ? (
        <div className="lab__filters" role="group" aria-label="Filter card kinds">
          <Button aria-pressed={kindFilter === 'all'} onClick={() => setKindFilter('all')}>All</Button>
          <details className="lab__disclosure">
            <summary
              className="lab__disclosure-summary ui-focusable"
              aria-label={kindFilter === 'all' ? 'Filter by kind' : `Filtered by kind: ${KIND_LABEL[kindFilter]}`}
            >
              {kindFilter === 'all' ? 'Kinds' : KIND_LABEL[kindFilter]}
            </summary>
            <div className="lab__filter-menu" role="group" aria-label="Card kinds">
              {LAB_CARD_KINDS.map((kind) => (
                <Button
                  key={kind}
                  aria-pressed={kindFilter === kind}
                  onClick={() => setKindFilter(kind)}
                >
                  {KIND_LABEL[kind]}
                </Button>
              ))}
            </div>
          </details>
        </div>
      ) : null}

      <section className="lab__composer" aria-label="New lab card">
        <Input
          value={draftTitle}
          onChange={(event) => setDraftTitle(event.target.value)}
          placeholder="Title — a place, beat, or spark"
          aria-label="Lab card title"
        />
        <Textarea
          value={draftBody}
          onChange={(event) => setDraftBody(event.target.value)}
          placeholder="Notes (not canon)"
          aria-label="Lab card body"
          rows={3}
        />
        <div className="lab__composer-actions">
          {/* P2: one quiet chooser at rest, not seven equal peers. All kinds stay one click away. */}
          <details className="lab__disclosure">
            <summary className="lab__disclosure-summary ui-focusable" aria-label={`Card kind: ${KIND_LABEL[draftKind]}`}>
              {KIND_LABEL[draftKind]}
            </summary>
            <div className="lab__composer-kinds" role="group" aria-label="New card kind">
              {LAB_CARD_KINDS.map((kind) => (
                <Button key={kind} aria-pressed={draftKind === kind} onClick={() => setDraftKind(kind)}>
                  {KIND_LABEL[kind]}
                </Button>
              ))}
            </div>
          </details>
          <Button variant="primary" disabled={busy || !draftTitle.trim()} onClick={() => void createCard()}>
            {busy ? 'Saving…' : 'New card'}
          </Button>
        </div>
      </section>

      {notice ? <p className="lab__notice" role="status">{notice}</p> : null}

      {/* Inline chapter-title confirm — destination-shaped consent for Send to Draft. */}
      {confirmingCard ? (
        <section className="lab__confirm" aria-label="Confirm chapter title" role="dialog" aria-modal="false">
          <h3 className="lab__section-label">Create chapter stub</h3>
          <p className="lab__confirm-line">Body will be an empty stub. Title becomes stored Draft state.</p>
          <p className="lab__confirm-source">
            {confirmingCard.source === 'model' ? 'From Spark' : 'From your note'}
          </p>
          <Input
            value={confirmTitle}
            onChange={(event) => setConfirmTitle(event.target.value)}
            aria-label="Chapter title"
            placeholder="Chapter title (empty allowed)"
          />
          <div className="lab__card-actions">
            <Button variant="primary" disabled={busy} onClick={() => void confirmChapterCreate()}>
              {busy ? 'Creating…' : 'Create chapter'}
            </Button>
            <Button disabled={busy} onClick={cancelChapterCreate}>Cancel</Button>
          </div>
        </section>
      ) : null}

      {/* P2: an empty bench already has the composer as its one obvious move.
          A second "nothing here" block pointing back at that composer is the wall. */}
      {live.length === 0 ? (
        <div className="lab__rest">
          <p className="lab__rest-note">Beats use Send to Draft; sparks use Promote to Canon → Accept.</p>
          {onOpenAgent ? (
            <Button onClick={onOpenAgent}>Ask agent to brainstorm…</Button>
          ) : null}
        </div>
      ) : null}

      {live.length > 0 && visible.length === 0 && kindFilter !== 'all' ? (
        <div className="lab__empty">
          <EmptyState
            title={`No ${KIND_LABEL[kindFilter]} cards on this board`}
            action={<Button onClick={() => setKindFilter('all')}>Show all</Button>}
          />
        </div>
      ) : null}

      {visible.length > 0 ? (
        <div className="lab__grid" aria-label="Lab cards">
          {visible.map((card) => (
            <article
              key={card.id}
              className={`lab__card${card.status === 'pinned' ? ' lab__card--pinned' : ''}`}
              data-kind={card.kind}
              data-source={card.source}
            >
              <header className="lab__card-header">
                <Badge tone="pending">{KIND_LABEL[card.kind]}</Badge>
                <SourceChip source={card.source} />
                {card.status === 'pinned' ? <Badge tone="accent">Pinned</Badge> : null}
              </header>
              {editingId === card.id ? (
                <>
                  <Input value={editTitle} onChange={(event) => setEditTitle(event.target.value)} aria-label="Edit title" />
                  <Textarea value={editBody} onChange={(event) => setEditBody(event.target.value)} rows={4} aria-label="Edit body" />
                  {/* Kind stays changeable after creation, so choosing it up front is never a trap. */}
                  <details className="lab__disclosure">
                    <summary className="lab__disclosure-summary ui-focusable" aria-label={`Card kind: ${KIND_LABEL[editKind]}`}>
                      {KIND_LABEL[editKind]}
                    </summary>
                    <div className="lab__composer-kinds" role="group" aria-label="Edit card kind">
                      {LAB_CARD_KINDS.map((kind) => (
                        <Button key={kind} aria-pressed={editKind === kind} onClick={() => setEditKind(kind)}>
                          {KIND_LABEL[kind]}
                        </Button>
                      ))}
                    </div>
                  </details>
                  <div className="lab__card-actions">
                    <Button variant="primary" disabled={busy} onClick={() => void saveEdit(card.id)}>Save</Button>
                    <Button onClick={() => setEditingId(null)}>Cancel</Button>
                  </div>
                </>
              ) : (
                <>
                  <h3 className="lab__card-title">{card.title}</h3>
                  <p className="lab__card-body">{card.body || '—'}</p>
                  <div className="lab__card-actions">
                    <Button disabled={busy} onClick={() => {
                      setEditingId(card.id)
                      setEditTitle(card.title)
                      setEditBody(card.body)
                      setEditKind(card.kind)
                    }}>Edit</Button>
                    <Button disabled={busy} onClick={() => void onPinCard(card.id, card.status !== 'pinned')}>
                      {card.status === 'pinned' ? 'Unpin' : 'Pin'}
                    </Button>
                    {canPromote(card.kind) ? (
                      <Button variant="primary" disabled={busy || confirmCardId === card.id} onClick={() => void promote(card)}>
                        {promoteActionLabel(card.kind)}
                      </Button>
                    ) : null}
                    <Button disabled={busy} onClick={() => void onArchiveCard(card.id)}>Archive</Button>
                  </div>
                </>
              )}
            </article>
          ))}
        </div>
      ) : null}

      {promoted.length > 0 ? (
        <section className="lab__promoted" aria-label="Cards sent to Draft or promoted toward Canon">
          <div className="lab__promoted-head">
            <h3 className="lab__section-label">Promoted</h3>
            <Button disabled={busy} onClick={() => void dismissAll()}>
              Dismiss all
            </Button>
          </div>
          <ul className="lab__promoted-list">
            {promoted.map((card) => (
              <li key={card.id}>
                <span>{card.title}</span>
                <div className="lab__promoted-meta">
                  <Badge tone="pending">{card.promoted?.as === 'chapter-stub' ? 'sent to Draft' : 'Canon proposal'}</Badge>
                  <Button disabled={busy} onClick={() => void dismissOne(card.id)}>Dismiss</Button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {archived.length > 0 ? (
        <section className="lab__archived" aria-label="Archived lab cards">
          <h3 className="lab__section-label">Archived</h3>
          <ul className="lab__archived-list">
            {archived.map((card) => (
              <li key={card.id} className="lab__archived-row">
                <span className="lab__archived-title">{card.title || (KIND_LABEL[card.kind] ?? card.kind)}</span>
                <Badge>{KIND_LABEL[card.kind] ?? card.kind}</Badge>
                <Button disabled={busy} onClick={() => void onRestoreCard(card.id)}>Restore</Button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  )
}
