import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
// AU screen-reader: one busy dialect + Inbox live (mirror Check Continuity). Method = DOM/ARIA sampling.
import type { Proposal } from '../../domain/types.ts'
import { ProposalCard } from '../../features/continuity/ProposalCard.tsx'
import { SheetPackCard } from '../../features/agent/SheetPackCard.tsx'
import { ApplyCard } from '../../features/agent/ApplyCard.tsx'
import { CHECK_PRIMARY, CHECK_SECONDARY, type CheckToolId } from '../../features/agent/checkTools.ts'
import type { CowriteSkill } from '../../cowrite/types.ts'
import type { CraftTag, Project } from '../../domain/types.ts'
import { ResearchPanel } from '../../features/research/ResearchPanel.tsx'
import type { ReviewKind } from '../../review/types.ts'
import { ReviewCard } from '../../features/agent/ReviewCard.tsx'
import type { ProposalEdits } from '../../features/project/api.ts'
import { Badge, Button, EmptyState, IconButton, Textarea } from '../ui'
import type { AgentBusyOp } from '../../features/agent/useAgent.ts'
import type { TranscriptEntry } from './workspace'
import './shell.css'
import './AgentPanel.css'

export type CompanionContext = 'writing' | 'lab' | 'details' | 'graph'

export type CompanionFace =
  | 'chat'
  | 'write'
  | 'check'
  | 'spark'
  | 'fill'
  | 'inspect'
  | 'research'
  | 'inbox'

const DEFAULT_FACE: Record<CompanionContext, CompanionFace> = {
  writing: 'chat',
  lab: 'chat',
  details: 'chat',
  graph: 'chat',
}

/** Full face allow-list per context. Research stays here; D6 only changes chrome. */
const FACES: Record<CompanionContext, CompanionFace[]> = {
  writing: ['chat', 'write', 'check', 'research', 'inbox'],
  lab: ['chat', 'spark', 'inbox'],
  details: ['chat', 'fill', 'research', 'inbox'],
  graph: ['chat', 'inspect', 'inbox'],
}

/**
 * D6 density: at most 3 equal primary faces.
 * Inbox is always a badge-style rail item (not a primary).
 * Overflow faces: one item collapses to a plain quiet control (no More menu costume).
 * Two or more overflow faces restore a real More menu (APG) — deliberate, not missing.
 */
const PRIMARY_FACES: Record<CompanionContext, CompanionFace[]> = {
  writing: ['chat', 'write', 'check'],
  lab: ['chat', 'spark'],
  details: ['chat', 'fill'],
  graph: ['chat', 'inspect'],
}

const FACE_LABEL: Record<CompanionFace, string> = {
  chat: 'Chat',
  write: 'Write',
  check: 'Check',
  spark: 'Spark',
  fill: 'Fill',
  inspect: 'Inspect',
  research: 'Research',
  inbox: 'Inbox',
}

export type AgentPanelProps = {
  transcript: TranscriptEntry[]
  project: Project | null
  onProject: (project: Project, generation?: number) => void
  beginMutation: () => number | null
  trackMutation: <T>(operation: Promise<T>) => Promise<T>
  chapterTitle: string
  /** Open chapter body — gates Continuity primary until prose exists (seeded-default P1). */
  chapterBody?: string
  companionContext?: CompanionContext
  contextLabel?: string
  proposals: Proposal[]
  continuityRunning: boolean
  continuityMode: 'fixture' | 'live' | null
  continuityCounts?: { red: number; yellow: number; proposals: number } | null
  continuityError?: string | null
  onRunContinuity: () => Promise<void>
  onAcceptProposal: (id: string, edits?: ProposalEdits) => Promise<void>
  onEditProposal: (id: string, edits: ProposalEdits) => Promise<void>
  onRejectProposal: (id: string) => Promise<void>
  sending: boolean
  /** Which control started the single in-flight agent job. Null when idle. */
  busyOp?: AgentBusyOp | null
  /** Research query in flight (reported by ResearchPanel). */
  researchRunning?: boolean
  onResearchRunningChange?: (running: boolean) => void
  llmMode: 'fixture' | 'live' | null
  selection: { start: number; end: number; text: string }
  onGenerateCowrite: (skill: CowriteSkill, instruction: string) => Promise<void>
  onApplyCard: (id: string) => Promise<void>
  onDismissCard: (id: string) => void
  onRunReview: (kind: ReviewKind) => Promise<void>
  onAddCraftTags: (tags: CraftTag[]) => void
  onSend: (text: string, op?: AgentBusyOp) => void
  onSparkPreset?: (kind: 'place' | 'character-spark' | 'beat' | 'what-if') => void
  onAddChapter?: () => void
  onClose?: () => void
}

export function AgentPanel({
  transcript, project, onProject, beginMutation, trackMutation, chapterTitle, chapterBody = '',
  companionContext = 'writing', contextLabel,
  proposals, continuityRunning, continuityMode, continuityCounts, continuityError = null,
  onRunContinuity, onAcceptProposal, onEditProposal, onRejectProposal, sending, busyOp = null, researchRunning = false, onResearchRunningChange, llmMode, selection, onGenerateCowrite, onApplyCard, onDismissCard,
  onRunReview, onAddCraftTags, onSend, onSparkPreset, onAddChapter, onClose,
}: AgentPanelProps) {
  const [draft, setDraft] = useState('')
  const [face, setFace] = useState<CompanionFace>(DEFAULT_FACE[companionContext])
  const [moreOpen, setMoreOpen] = useState(false)
  /** Which Check tool info popup is open (click/keyboard — not hover-only). */
  const [checkHelpOpen, setCheckHelpOpen] = useState<CheckToolId | null>(null)
  const moreRef = useRef<HTMLDivElement | null>(null)
  const checkToolsRef = useRef<HTMLDivElement | null>(null)
  // Session memory only: last face per ecosystem context. Reload still defaults to Chat.
  const lastFaceByContext = useRef<Partial<Record<CompanionContext, CompanionFace>>>({})
  /** AU-1: announce only on pending-count *change*, not first mount (load noise). */
  const prevPendingCountRef = useRef<number | null>(null)
  const [inboxLiveText, setInboxLiveText] = useState('')
  const allowed = FACES[companionContext]
  const primaries = PRIMARY_FACES[companionContext]
  const overflow = allowed.filter((candidate) => candidate !== 'inbox' && !primaries.includes(candidate))
  const applyCards = transcript.filter((entry) => entry.role === 'apply')
  const pendingCount = proposals.length + applyCards.length
  const hasChapter = (project?.chapters?.length ?? 0) > 0
  const hasProse = chapterBody.trim().length > 0
  const continuityRunnable = hasChapter && hasProse

  useEffect(() => {
    const prev = prevPendingCountRef.current
    prevPendingCountRef.current = pendingCount
    if (prev === null || prev === pendingCount) return
    if (pendingCount === 0) {
      setInboxLiveText(prev > 0 ? 'Inbox clear' : '')
      return
    }
    setInboxLiveText(
      pendingCount === 1 ? 'Inbox: 1 pending item' : `Inbox: ${pendingCount} pending items`,
    )
  }, [pendingCount])

  useEffect(() => {
    const remembered = lastFaceByContext.current[companionContext]
    const next = remembered && FACES[companionContext].includes(remembered)
      ? remembered
      : DEFAULT_FACE[companionContext]
    setFace(next)
    setMoreOpen(false)
  }, [companionContext])

  useEffect(() => {
    if (!allowed.includes(face)) {
      const fallback = DEFAULT_FACE[companionContext]
      setFace(fallback)
      lastFaceByContext.current[companionContext] = fallback
      return
    }
    lastFaceByContext.current[companionContext] = face
  }, [allowed, companionContext, face])

  useEffect(() => {
    if (!moreOpen) return
    function onPointerDown(event: MouseEvent) {
      if (!moreRef.current?.contains(event.target as Node)) setMoreOpen(false)
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setMoreOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [moreOpen])

  useEffect(() => {
    if (!checkHelpOpen) return
    function onPointerDown(event: MouseEvent) {
      if (!checkToolsRef.current?.contains(event.target as Node)) setCheckHelpOpen(null)
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setCheckHelpOpen(null)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [checkHelpOpen])

  // Leaving Check (or Writing) closes help so popups never orphan across faces.
  useEffect(() => {
    if (face !== 'check' || companionContext !== 'writing') setCheckHelpOpen(null)
  }, [companionContext, face])

  const statusLine = useMemo(() => {
    const bits: string[] = []
    if (continuityRunning) bits.push('Continuity working…')
    else if (continuityError) bits.push(`Continuity failed: ${continuityError}`)
    else if (continuityMode) {
      const counts = continuityCounts
      if (counts && counts.red + counts.yellow + counts.proposals === 0) {
        bits.push(`Continuity: no issues (${continuityMode})`)
      } else if (counts) {
        bits.push(`Continuity: ${counts.red} red · ${counts.yellow} yellow · ${counts.proposals} pending (${continuityMode})`)
      } else {
        bits.push(`Continuity (${continuityMode})`)
      }
    }
    if (llmMode === 'fixture') bits.push('Chat fixture')
    else if (llmMode === 'live') bits.push('Chat live')
    return bits.join(' · ')
  }, [continuityCounts, continuityError, continuityMode, continuityRunning, llmMode])

  // One assistant, one job: agent, Continuity, and Research QUERY share one busy gate.
  // Author decisions (Inbox Accept/Apply/Dismiss, Research Pin/Propose) use local busy only (ox B).
  const assistantBusy = sending || continuityRunning || researchRunning
  // AU-2/AU-6: agent-lane busy live mirrors Check Continuity. Continuity keeps face-local live;
  // suppress the shared line while Continuity runs so two polite regions do not queue the same fact.
  // Derive from busyOp so announce names only the real in-flight agent job (not Continuity).
  const agentBusyLive = busyOp && !continuityRunning ? 'Working…' : ''
  /** Label + aria-busy for THIS control only. disabled stays assistantBusy. */
  function opActive(op: AgentBusyOp) {
    return busyOp === op
  }
  function opLabel(op: AgentBusyOp, idle: string) {
    return opActive(op) ? 'Working…' : idle
  }

  const continuityState = continuityRunning
    ? 'running'
    : continuityError
      ? 'failed'
      : continuityMode
        ? 'ready'
        : 'idle'

  function send(op: AgentBusyOp = 'send') {
    const text = draft.trim()
    if (!text || assistantBusy) return
    onSend(text, op)
    setDraft('')
  }

  function generate(skill: CowriteSkill) {
    if (assistantBusy) return
    const instruction = draft.trim() || (skill === 'rewrite' ? 'Rewrite this selection' : `${skill} this scene`)
    void onGenerateCowrite(skill, instruction).then(() => setDraft('')).catch(() => undefined)
  }

  function selectFace(next: CompanionFace) {
    setFace(next)
    lastFaceByContext.current[companionContext] = next
    setMoreOpen(false)
    // Overflow secondary (Research) can sit past the face-row scroll edge.
    queueMicrotask(() => {
      const root = document.querySelector<HTMLElement>('.companion__faces')
      if (!root) return
      const label = FACE_LABEL[next]
      const tabs = Array.from(root.querySelectorAll<HTMLElement>('[role="tab"]'))
      const active = tabs.find((tab) =>
        (tab.textContent || '').replace(/\s+/g, ' ').trim().startsWith(label),
      )
      // Keep the active label fully on-screen (no "hat" / half-Research clips).
      active?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
      if (active && root.scrollWidth > root.clientWidth + 1) {
        const tabRect = active.getBoundingClientRect()
        const rootRect = root.getBoundingClientRect()
        if (tabRect.left < rootRect.left + 1) root.scrollLeft += tabRect.left - rootRect.left - 4
        else if (tabRect.right > rootRect.right - 1) root.scrollLeft += tabRect.right - rootRect.right + 4
      }
    })
  }

  function renderProposals(list: Proposal[]) {
    const packIds = [...new Set(list.flatMap((proposal) => proposal.packId ? [proposal.packId] : []))]
    const packs = packIds.map((packId) => ({
      kind: 'pack' as const,
      id: packId,
      proposals: list.filter((proposal) => proposal.packId === packId),
    }))
    const alone = list
      .filter((proposal) => !proposal.packId)
      .map((proposal) => ({ kind: 'alone' as const, id: proposal.id, proposal }))
    // AY/B3: calm first fold (~4 cards). Overflow stays in closed <details>
    // so checkVisibility (and the eye) do not count a wall on first paint.
    const items = [...packs, ...alone]
    const foldAt = 4
    const head = items.slice(0, foldAt)
    const tail = items.slice(foldAt)

    function renderItem(item: (typeof items)[number]) {
      if (item.kind === 'pack') {
        return (
          <SheetPackCard
            key={item.id}
            proposals={item.proposals}
            onAccept={onAcceptProposal}
            onEdit={onEditProposal}
            onReject={onRejectProposal}
          />
        )
      }
      return (
        <ProposalCard
          key={item.id}
          proposal={item.proposal}
          onAccept={onAcceptProposal}
          onReject={onRejectProposal}
        />
      )
    }

    return (
      <section className="proposal-list" aria-label="Pending proposals">
        {head.map(renderItem)}
        {tail.length > 0 ? (
          <details className="companion__inbox-more">
            <summary className="companion__inbox-more-summary">
              {tail.length === 1 ? '1 more pending' : `${tail.length} more pending`}
            </summary>
            <div className="companion__inbox-more-list">
              {tail.map(renderItem)}
            </div>
          </details>
        ) : null}
      </section>
    )
  }

  function renderTranscript(options?: { tools?: boolean; apply?: boolean; review?: boolean; status?: boolean }) {
    const showTools = options?.tools !== false
    const showApply = options?.apply !== false
    const showReview = options?.review !== false
    const showStatus = options?.status !== false
    return (
      <div className="agent__transcript" aria-label="Agent transcript">
        {showStatus && statusLine ? (
          <p className="continuity-privacy" data-continuity-status={continuityState} aria-live="polite">
            {statusLine}
          </p>
        ) : null}
        {transcript.length === 0 && face === 'chat' && hasChapter ? (
          <EmptyState
            title={companionContext === 'lab' ? 'Brainstorm onto the bench' : 'Ask, draft, check — one place'}
            hint={companionContext === 'lab'
              ? 'Ask for places, character sparks, or what-ifs. Results land as Lab cards — not Canon.'
              : companionContext === 'graph'
                ? 'Ask about accepted links, or open Inspect on a node. Pending edges stay out of the map until Accept.'
                : 'Chat answers project questions. Write co-writes on the open chapter. Check runs Continuity. Inbox holds proposals until you Accept.'}
          />
        ) : null}
        {transcript.map((entry) => {
          if (entry.role === 'tool') {
            if (!showTools) return null
            const empty = entry.red + entry.yellow + entry.proposals === 0
            return (
              <article
                key={entry.id}
                className="agent__tool-card"
                data-continuity-result={empty ? 'empty' : 'findings'}
                aria-live="polite"
              >
                <span className="agent__message-role">Continuity · {entry.mode}</span>
                {empty ? (
                  <strong>No issues found</strong>
                ) : (
                  <strong>{entry.red} red · {entry.yellow} yellow · {entry.proposals} pending</strong>
                )}
              </article>
            )
          }
          if (entry.role === 'apply') {
            if (!showApply) return null
            return <ApplyCard key={entry.id} card={entry.card} onApply={onApplyCard} onDismiss={onDismissCard} />
          }
          if (entry.role === 'review') {
            if (!showReview) return null
            return <ReviewCard key={entry.id} result={entry.result} onAddTags={onAddCraftTags} />
          }
          return (
            <div key={entry.id} className={`agent__message agent__message--${entry.role}`}>
              <span className="agent__message-role">{entry.role}</span>{entry.text}
            </div>
          )
        })}
      </div>
    )
  }

  const chipLabel = contextLabel
    ?? (companionContext === 'lab' ? '@lab' : companionContext === 'graph' ? '@graph' : `@${chapterTitle || 'chapter'}`)

  const overflowActive = overflow.includes(face)
  const facesRef = useRef<HTMLDivElement | null>(null)

  function onFacesKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight' && event.key !== 'Home' && event.key !== 'End') {
      return
    }
    // Menus own their own keys; do not steal while a More menu is open.
    if (moreOpen) return
    const root = facesRef.current
    if (!root) return
    const tabs = Array.from(root.querySelectorAll<HTMLElement>('[role="tab"]'))
    if (tabs.length === 0) return
    const active = document.activeElement
    const index = tabs.findIndex((tab) => tab === active)
    if (index < 0) return
    event.preventDefault()
    let next = index
    if (event.key === 'ArrowRight') next = (index + 1) % tabs.length
    else if (event.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = tabs.length - 1
    const tab = tabs[next]
    tab?.focus()
    // Face row is overflow-x; keep the focused tab on-screen (Research secondary).
    tab?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    tab?.click()
  }

  return (
    <div
      className="panel"
      data-companion-context={companionContext}
      data-companion-face={face}
      aria-busy={assistantBusy || undefined}
    >
      {/* AU-1 Inbox + AU-2 agent busy: one shared polite channel each. Check Continuity keeps its own live. */}
      <div className="sr-only" aria-live="polite" aria-atomic="true" data-au-live="inbox">
        {inboxLiveText}
      </div>
      <div className="sr-only" aria-live="polite" aria-atomic="true" data-au-live="assistant-busy">
        {agentBusyLive}
      </div>
      <div className="panel__header">
        <h2 className="panel__title">Companion</h2>
        {onClose ? <IconButton label="Close companion" onClick={onClose}>✕</IconButton> : null}
      </div>

      <div
        className="companion__faces"
        role="tablist"
        aria-label="Companion faces"
        ref={facesRef}
        onKeyDown={onFacesKeyDown}
      >
        {primaries.map((candidate) => (
          <Button
            key={candidate}
            role="tab"
            aria-selected={face === candidate}
            aria-pressed={face === candidate}
            onClick={() => selectFace(candidate)}
          >
            {FACE_LABEL[candidate]}
          </Button>
        ))}

        {allowed.includes('inbox') ? (
          <Button
            role="tab"
            className="companion__face-inbox"
            aria-selected={face === 'inbox'}
            aria-pressed={face === 'inbox'}
            aria-label={pendingCount > 0 ? `Inbox ${pendingCount}` : 'Inbox'}
            onClick={() => selectFace('inbox')}
          >
            Inbox
            {pendingCount > 0 ? (
              <span className="companion__inbox-count">{pendingCount > 99 ? '99+' : pendingCount}</span>
            ) : null}
          </Button>
        ) : null}

        {overflow.length === 1 ? (
          // One overflow face: plain quiet control. No menu costume (ox Research shape).
          <Button
            role="tab"
            className="companion__face-secondary"
            aria-selected={face === overflow[0]}
            aria-pressed={face === overflow[0]}
            onClick={() => selectFace(overflow[0])}
          >
            {FACE_LABEL[overflow[0]]}
          </Button>
        ) : overflow.length > 1 ? (
          <div className="companion__more" ref={moreRef}>
            <Button
              role="tab"
              aria-haspopup="menu"
              aria-expanded={moreOpen}
              aria-pressed={overflowActive || moreOpen}
              onClick={() => setMoreOpen((open) => !open)}
            >
              {overflowActive ? FACE_LABEL[face] : 'More'}
            </Button>
            {moreOpen ? (
              <div className="companion__more-menu" role="menu" aria-label="More companion faces">
                {overflow.map((candidate) => (
                  <Button
                    key={candidate}
                    role="menuitem"
                    aria-pressed={face === candidate}
                    onClick={() => selectFace(candidate)}
                  >
                    {FACE_LABEL[candidate]}
                  </Button>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {face === 'research' ? (
        <ResearchPanel
          project={project}
          onProject={onProject}
          beginMutation={beginMutation}
          trackMutation={trackMutation}
          assistantBusy={sending || continuityRunning}
          onRunningChange={onResearchRunningChange}
        />
      ) : face === 'inbox' ? (
        <div className="agent__transcript companion__inbox" aria-label="Companion inbox">
          {statusLine ? <p className="continuity-privacy" aria-live="polite">{statusLine}</p> : null}
          {pendingCount === 0 ? (
            <EmptyState title="Inbox clear" hint="Things arrive here from Continuity on Check, Send proposal in Canon, and Apply cards from co-write on Write. Accept/Edit/Reject stay gated until something is pending." />
          ) : (
            <>
              <p className="companion__inbox-summary" data-inbox-pending={pendingCount}>
                {pendingCount === 1 ? '1 pending' : `${pendingCount} pending`}
              </p>
              {proposals.length > 0 ? renderProposals(proposals) : null}
              {applyCards.map((entry) =>
                entry.role === 'apply'
                  ? <ApplyCard key={entry.id} card={entry.card} onApply={onApplyCard} onDismiss={onDismissCard} />
                  : null,
              )}
            </>
          )}
        </div>
      ) : face === 'write' && companionContext === 'writing' ? (
        !hasChapter ? (
          <div className="agent__transcript" aria-label="Write rest">
            <EmptyState
              title="Co-write needs a chapter"
              hint="Continue, Rewrite, and Brainstorm land on the open Draft page. Start one chapter, then come back here to write with the companion."
              action={
                onAddChapter ? (
                  // One primary per job (ox): binder New chapter owns Draft empty create.
                  <Button variant="ghost" onClick={onAddChapter}>
                    Write first chapter
                  </Button>
                ) : undefined
              }
            />
          </div>
        ) : (
          <>
            {renderTranscript({ tools: false, review: false, apply: true, status: false })}
            <div className="panel__footer">
              <div className="agent__chips">
                <Badge tone="accent">{chipLabel}</Badge>
                {selection.text ? <Badge tone="pending">{selection.end - selection.start} ch selected</Badge> : null}
              </div>
              <Textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="Optional instruction for co-write…"
                aria-label="Co-write instruction"
                rows={2}
              />
              <div className="agent__cowrite-actions" aria-label="Co-write skills">
                <Button
                  disabled={assistantBusy}
                  aria-busy={opActive('continue') || undefined}
                  onClick={() => generate('continue')}
                >
                  {opLabel('continue', 'Continue')}
                </Button>
                <Button
                  disabled={assistantBusy || selection.start === selection.end}
                  aria-busy={opActive('rewrite') || undefined}
                  onClick={() => generate('rewrite')}
                >
                  {opLabel('rewrite', 'Rewrite')}
                </Button>
                <Button
                  disabled={assistantBusy}
                  aria-busy={opActive('brainstorm') || undefined}
                  onClick={() => generate('brainstorm')}
                >
                  {opLabel('brainstorm', 'Brainstorm')}
                </Button>
              </div>
            </div>
          </>
        )
      ) : face === 'check' && companionContext === 'writing' ? (
        !hasChapter ? (
          <div className="companion__check-body" aria-label="Check summary">
            <EmptyState
              title="Continuity starts with a chapter"
              hint="Check runs Continuity against accepted Canon. Findings become marks and Inbox proposals — never auto-canon."
              action={
                onAddChapter ? (
                  <Button variant="ghost" onClick={onAddChapter}>
                    Write first chapter
                  </Button>
                ) : undefined
              }
            />
          </div>
        ) : (
          <>
            <div className="companion__check-body" aria-label="Check summary">
              {continuityRunning ? (
                <p className="companion__check-summary" data-continuity-state="running" aria-live="polite">
                  Continuity working…
                </p>
              ) : continuityError ? (
                <p className="companion__check-summary" data-continuity-state="failed" role="alert" aria-live="assertive">
                  Continuity failed: {continuityError}
                </p>
              ) : continuityMode && continuityCounts ? (
                <p className="companion__check-summary" data-continuity-state="ready" aria-live="polite">
                  {continuityCounts.red + continuityCounts.yellow + continuityCounts.proposals === 0
                    ? `Continuity: no issues (${continuityMode})`
                    : `Continuity: ${continuityCounts.red} red · ${continuityCounts.yellow} yellow · ${continuityCounts.proposals} pending`}
                </p>
              ) : continuityMode ? (
                <p className="companion__check-summary" data-continuity-state="ready" aria-live="polite">
                  Continuity finished ({continuityMode})
                </p>
              ) : !continuityRunnable ? (
                <p className="companion__check-summary" data-continuity-state="idle">
                  Write some prose, then run Continuity.
                </p>
              ) : null}
              {renderTranscript({ tools: false, apply: false, status: false, review: true })}
            </div>
            <div className="panel__footer companion__check-footer" ref={checkToolsRef}>
              <div className="companion__check-primary" data-check-tool="continuity" data-check-primary="true">
                <div className="companion__check-primary-row">
                  <Button
                    className="companion__check-run"
                    variant={continuityRunnable || continuityRunning ? 'primary' : 'ghost'}
                    disabled={assistantBusy || !continuityRunnable}
                    title={continuityRunnable ? 'Run Continuity on this chapter' : 'Write some prose before Continuity'}
                    data-continuity-state={continuityState}
                    data-continuity-runnable={continuityRunnable ? 'true' : 'false'}
                    data-check-run="continuity"
                    aria-busy={continuityRunning || undefined}
                    onClick={() => { void onRunContinuity().catch(() => undefined) }}
                  >
                    {continuityRunning ? 'Working…' : CHECK_PRIMARY.actionLabel}
                  </Button>
                  <IconButton
                    className="companion__check-info"
                    label="About Continuity"
                    aria-expanded={checkHelpOpen === 'continuity'}
                    aria-controls="check-help-continuity"
                    data-check-info="continuity"
                    onClick={() => setCheckHelpOpen((current) => current === 'continuity' ? null : 'continuity')}
                  >
                    ?
                  </IconButton>
                </div>
                {checkHelpOpen === 'continuity' ? (
                  <div id="check-help-continuity" className="companion__check-help" role="note" data-check-help="continuity">
                    <p><span className="companion__check-help-k">What</span> {CHECK_PRIMARY.what}</p>
                    <p><span className="companion__check-help-k">When</span> {CHECK_PRIMARY.when}</p>
                    <p><span className="companion__check-help-k">After</span> {CHECK_PRIMARY.outcome}</p>
                  </div>
                ) : null}
              </div>
              <div className="companion__check-secondary" aria-label="Scene coaching">
                {CHECK_SECONDARY.map((tool) => {
                  const helpOpen = checkHelpOpen === tool.id
                  const helpId = `check-help-${tool.id}`
                  const busyKey = tool.id === 'review' ? 'review' : 'craft'
                  return (
                    <div key={tool.id} className="companion__check-secondary-item" data-check-tool={tool.id} data-check-primary="false">
                      <div className="companion__check-secondary-row">
                        <Button
                          className="companion__check-run"
                          variant="ghost"
                          disabled={assistantBusy}
                          title={tool.what}
                          data-check-run={tool.id}
                          aria-busy={opActive(busyKey) || undefined}
                          onClick={() => {
                            if (tool.id === 'review' || tool.id === 'craft') void onRunReview(tool.id).catch(() => undefined)
                          }}
                        >
                          {opLabel(busyKey, tool.actionLabel)}
                        </Button>
                        <IconButton
                          className="companion__check-info"
                          label={`About ${tool.actionLabel}`}
                          aria-expanded={helpOpen}
                          aria-controls={helpId}
                          data-check-info={tool.id}
                          onClick={() => setCheckHelpOpen((current) => current === tool.id ? null : tool.id)}
                        >
                          ?
                        </IconButton>
                      </div>
                      {helpOpen ? (
                        <div id={helpId} className="companion__check-help" role="note" data-check-help={tool.id}>
                          <p><span className="companion__check-help-k">What</span> {tool.what}</p>
                          <p><span className="companion__check-help-k">When</span> {tool.when}</p>
                          <p><span className="companion__check-help-k">After</span> {tool.outcome}</p>
                        </div>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            </div>
          </>
        )
) : face === 'spark' && companionContext === 'lab' ? (
        <>
          {renderTranscript({ tools: false, apply: false, review: false, status: false })}
          <div className="panel__footer">
            <p className="continuity-privacy">One tap seeds a brainstorm prompt. Cards land on the Lab bench only.</p>
            <div className="agent__cowrite-actions" aria-label="Spark presets">
              <Button
                disabled={assistantBusy}
                aria-busy={opActive('place') || undefined}
                onClick={() => onSparkPreset?.('place') ?? onSend('Brainstorm 3 places for the current board', 'place')}
              >
                {opLabel('place', 'Place')}
              </Button>
              <Button
                disabled={assistantBusy}
                aria-busy={opActive('character-spark') || undefined}
                onClick={() => onSparkPreset?.('character-spark') ?? onSend('Spark a character for the Lab bench', 'character-spark')}
              >
                {opLabel('character-spark', 'Character')}
              </Button>
              <Button
                disabled={assistantBusy}
                aria-busy={opActive('beat') || undefined}
                onClick={() => onSparkPreset?.('beat') ?? onSend('Suggest 3 plot beats for the Lab', 'beat')}
              >
                {opLabel('beat', 'Beat')}
              </Button>
              <Button
                disabled={assistantBusy}
                aria-busy={opActive('what-if') || undefined}
                onClick={() => onSparkPreset?.('what-if') ?? onSend('Fork a what-if for the Lab', 'what-if')}
              >
                {opLabel('what-if', 'What-if')}
              </Button>
            </div>
          </div>
        </>
      ) : face === 'fill' && companionContext === 'details' ? (
        <>
          {renderTranscript({ apply: false, review: false, status: false })}
          <div className="panel__footer">
            <div className="agent__chips"><Badge tone="accent">{chipLabel}</Badge><Badge tone="pending">@canon</Badge></div>
            <Textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); send() }
              }}
              placeholder="Propose facts for this sheet…"
              aria-label="Sheet fill prompt"
              rows={3}
            />
            <div className="agent__composer-actions">
              <Button
                variant="primary"
                disabled={assistantBusy}
                aria-busy={opActive('propose') || undefined}
                onClick={() => {
                  if (draft.trim()) send('propose')
                  else onSend(`Draft a character sheet pack for ${chapterTitle}`, 'propose')
                }}
              >
                {opLabel('propose', 'Propose')}
              </Button>
            </div>
          </div>
        </>
      ) : face === 'inspect' && companionContext === 'graph' ? (
        <div className="agent__transcript" aria-label="Graph inspect">
          <EmptyState
            title="Inspect accepted links"
            hint="Select a node in Graph to open its sheet. Pending edges never render until Accept."
          />
          {statusLine ? <p className="continuity-privacy" aria-live="polite">{statusLine}</p> : null}
        </div>
      ) : !hasChapter ? (
        <div className="agent__transcript" aria-label="Chat rest">
          <EmptyState
            title={companionContext === 'lab' ? 'Lab chat needs a chapter home' : 'Companion needs a chapter'}
            hint={companionContext === 'lab'
              ? 'Spark and chat prompts still attach to a draft chapter today. Start one chapter, then brainstorm onto the bench without changing Canon.'
              : companionContext === 'graph'
                ? 'Chat and Inspect read project truth beside the map. Start a draft chapter first, then add Canon sheets when you are ready.'
                : 'Chat, Write, and Check all work on an open Draft chapter. Start one chapter — that is the first door into the companion.'}
            action={
              onAddChapter ? (
                // One primary per job (ox): binder New chapter owns Draft empty create.
                // Companion invites stay quiet when dual-rail shows both doors.
                <Button variant="ghost" onClick={onAddChapter}>
                  Write first chapter
                </Button>
              ) : undefined
            }
          />
        </div>
      ) : (
        <>
          {renderTranscript({
            tools: companionContext === 'writing',
            apply: companionContext === 'writing',
            review: companionContext === 'writing',
            status: companionContext === 'writing',
          })}
          <div className="panel__footer">
            <div className="agent__chips">
              <Badge tone="accent">{chipLabel}</Badge>
              {companionContext === 'writing' ? <Badge tone="pending">@canon</Badge> : null}
              {companionContext === 'lab' ? <Badge tone="pending">@lab</Badge> : null}
            </div>
            <Textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); send() }
              }}
              placeholder={companionContext === 'lab' ? 'Brainstorm onto the bench…' : 'Ask about this project…'}
              aria-label="Message the companion"
              rows={3}
            />
            <div className="agent__composer-actions">
              <Button
                variant="primary"
                onClick={() => send('send')}
                disabled={assistantBusy || draft.trim().length === 0}
                aria-busy={opActive('send') || undefined}
              >
                {opLabel('send', 'Send')}
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

