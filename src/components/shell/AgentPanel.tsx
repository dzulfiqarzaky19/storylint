import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import type { Proposal } from '../../domain/types.ts'
import { ProposalCard } from '../../features/continuity/ProposalCard.tsx'
import { SheetPackCard } from '../../features/agent/SheetPackCard.tsx'
import { ApplyCard } from '../../features/agent/ApplyCard.tsx'
import type { CowriteSkill } from '../../cowrite/types.ts'
import type { CraftTag, Project } from '../../domain/types.ts'
import { ResearchPanel } from '../../features/research/ResearchPanel.tsx'
import type { ReviewKind } from '../../review/types.ts'
import { ReviewCard } from '../../features/agent/ReviewCard.tsx'
import type { ProposalEdits } from '../../features/project/api.ts'
import { Badge, Button, EmptyState, IconButton, Textarea } from '../ui'
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
  companionContext?: CompanionContext
  contextLabel?: string
  proposals: Proposal[]
  continuityRunning: boolean
  continuityMode: 'fixture' | 'live' | null
  continuityCounts?: { red: number; yellow: number; proposals: number } | null
  onRunContinuity: () => Promise<void>
  onAcceptProposal: (id: string, edits?: ProposalEdits) => Promise<void>
  onEditProposal: (id: string, edits: ProposalEdits) => Promise<void>
  onRejectProposal: (id: string) => Promise<void>
  sending: boolean
  llmMode: 'fixture' | 'live' | null
  selection: { start: number; end: number; text: string }
  onGenerateCowrite: (skill: CowriteSkill, instruction: string) => Promise<void>
  onApplyCard: (id: string) => Promise<void>
  onDismissCard: (id: string) => void
  onRunReview: (kind: ReviewKind) => Promise<void>
  onAddCraftTags: (tags: CraftTag[]) => void
  onSend: (text: string) => void
  onSparkPreset?: (kind: 'place' | 'character-spark' | 'beat' | 'what-if') => void
  onAddChapter?: () => void
  onClose?: () => void
}

export function AgentPanel({
  transcript, project, onProject, beginMutation, trackMutation, chapterTitle,
  companionContext = 'writing', contextLabel,
  proposals, continuityRunning, continuityMode, continuityCounts,
  onRunContinuity, onAcceptProposal, onEditProposal, onRejectProposal, sending, llmMode, selection, onGenerateCowrite, onApplyCard, onDismissCard,
  onRunReview, onAddCraftTags, onSend, onSparkPreset, onAddChapter, onClose,
}: AgentPanelProps) {
  const [draft, setDraft] = useState('')
  const [face, setFace] = useState<CompanionFace>(DEFAULT_FACE[companionContext])
  const [moreOpen, setMoreOpen] = useState(false)
  const moreRef = useRef<HTMLDivElement | null>(null)
  // Session memory only: last face per ecosystem context. Reload still defaults to Chat.
  const lastFaceByContext = useRef<Partial<Record<CompanionContext, CompanionFace>>>({})
  const allowed = FACES[companionContext]
  const primaries = PRIMARY_FACES[companionContext]
  const overflow = allowed.filter((candidate) => candidate !== 'inbox' && !primaries.includes(candidate))
  const applyCards = transcript.filter((entry) => entry.role === 'apply')
  const pendingCount = proposals.length + applyCards.length
  const hasChapter = (project?.chapters?.length ?? 0) > 0

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

  const statusLine = useMemo(() => {
    const bits: string[] = []
    if (continuityRunning) bits.push('Continuity running…')
    else if (continuityMode) {
      const counts = continuityCounts
      if (counts && counts.red + counts.yellow + counts.proposals === 0) {
        bits.push(`Last Continuity (${continuityMode}): no issues found`)
      } else if (counts) {
        bits.push(`Last Continuity (${continuityMode}): ${counts.red} red · ${counts.yellow} yellow · ${counts.proposals} proposals`)
      } else {
        bits.push(`Last Continuity: ${continuityMode}`)
      }
    }
    if (llmMode === 'fixture') bits.push('Chat fixture')
    else if (llmMode === 'live') bits.push('Chat live')
    return bits.join(' · ')
  }, [continuityCounts, continuityMode, continuityRunning, llmMode])

  const continuityState = continuityRunning
    ? 'running'
    : continuityMode
      ? 'ready'
      : 'idle'

  function send() {
    const text = draft.trim()
    if (!text || sending) return
    onSend(text)
    setDraft('')
  }

  function generate(skill: CowriteSkill) {
    if (sending) return
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
      active?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    })
  }

  function renderProposals(list: Proposal[]) {
    const packIds = [...new Set(list.flatMap((proposal) => proposal.packId ? [proposal.packId] : []))]
    const alone = list.filter((proposal) => !proposal.packId)
    return (
      <section className="proposal-list" aria-label="Pending proposals">
        {packIds.map((packId) => (
          <SheetPackCard
            key={packId}
            proposals={list.filter((proposal) => proposal.packId === packId)}
            onAccept={onAcceptProposal}
            onEdit={onEditProposal}
            onReject={onRejectProposal}
          />
        ))}
        {alone.map((proposal) => (
          <ProposalCard
            key={proposal.id}
            proposal={proposal}
            onAccept={onAcceptProposal}
            onReject={onRejectProposal}
          />
        ))}
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
                  <>
                    <strong>No issues found</strong>
                    <p className="continuity-privacy">No marks or proposals for this chapter. Accept/Edit/Reject stay gated until something is pending.</p>
                  </>
                ) : (
                  <strong>{entry.red} red · {entry.yellow} yellow · {entry.proposals} proposals</strong>
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
    <div className="panel" data-companion-context={companionContext} data-companion-face={face}>
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
            {pendingCount > 0 ? <span className="companion__inbox-count">{pendingCount}</span> : null}
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
        <ResearchPanel project={project} onProject={onProject} beginMutation={beginMutation} trackMutation={trackMutation} />
      ) : face === 'inbox' ? (
        <div className="agent__transcript" aria-label="Companion inbox">
          {statusLine ? <p className="continuity-privacy">{statusLine}</p> : null}
          {pendingCount === 0 ? (
            <EmptyState title="Inbox clear" hint="Things arrive here from Continuity on Check, Send proposal in Canon, and Apply cards from co-write on Write. Accept/Edit/Reject stay gated until something is pending." />
          ) : (
            <>
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
                  <Button variant="primary" onClick={onAddChapter}>
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
                disabled={sending}
              />
              <div className="agent__cowrite-actions" aria-label="Co-write skills">
                <Button disabled={sending} onClick={() => generate('continue')}>
                  Continue
                </Button>
                <Button
                  disabled={sending || selection.start === selection.end}
                  onClick={() => generate('rewrite')}
                >
                  Rewrite
                </Button>
                <Button disabled={sending} onClick={() => generate('brainstorm')}>
                  Brainstorm
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
              hint="Check is the only place Continuity lives. It reads your chapter against accepted Canon, then leaves findings as marks and Inbox proposals — it never changes Canon on its own."
              action={
                onAddChapter ? (
                  <Button variant="primary" onClick={onAddChapter}>
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
                  Continuity is running on this chapter…
                </p>
              ) : continuityMode ? (
                <p className="companion__check-summary" data-continuity-state="ready" aria-live="polite">
                  {continuityCounts
                    ? continuityCounts.red + continuityCounts.yellow + continuityCounts.proposals === 0
                      ? `Last Continuity (${continuityMode}): no issues found.`
                      : `Last Continuity (${continuityMode}): ${continuityCounts.red} red · ${continuityCounts.yellow} yellow · ${continuityCounts.proposals} proposals. Open Inbox to Accept/Edit/Reject.`
                    : `Last Continuity finished in ${continuityMode} mode.`}
                </p>
              ) : (
                <EmptyState
                  title="Run Continuity on this chapter"
                  hint="Check is the only Continuity entry. It scans chapter prose against accepted Canon. Findings land as marks and Inbox proposals — never auto-canon."
                />
              )}
              {renderTranscript({ apply: false, status: false })}
            </div>
            <div className="panel__footer">
              <div className="agent__cowrite-actions" aria-label="Check tools">
                <Button
                  variant="primary"
                  disabled={continuityRunning}
                  data-continuity-state={continuityState}
                  aria-busy={continuityRunning}
                  onClick={() => void onRunContinuity().catch(() => undefined)}
                >
                  {continuityRunning ? 'Running…' : 'Run Continuity'}
                </Button>
                <Button disabled={sending} onClick={() => void onRunReview('review').catch(() => undefined)}>Review</Button>
                <Button disabled={sending} onClick={() => void onRunReview('craft').catch(() => undefined)}>Craft</Button>
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
              <Button onClick={() => onSparkPreset?.('place') ?? onSend('Brainstorm 3 places for the current board')}>Place</Button>
              <Button onClick={() => onSparkPreset?.('character-spark') ?? onSend('Spark a character for the Lab bench')}>Character</Button>
              <Button onClick={() => onSparkPreset?.('beat') ?? onSend('Suggest 3 plot beats for the Lab')}>Beat</Button>
              <Button onClick={() => onSparkPreset?.('what-if') ?? onSend('Fork a what-if for the Lab')}>What-if</Button>
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
                disabled={sending}
                onClick={() => {
                  if (draft.trim()) send()
                  else onSend(`Draft a character sheet pack for ${chapterTitle}`)
                }}
              >
                {sending ? 'Working…' : 'Propose'}
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
          {statusLine ? <p className="continuity-privacy">{statusLine}</p> : null}
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
                <Button variant="primary" onClick={onAddChapter}>
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
              <Button variant="primary" onClick={send} disabled={sending || draft.trim().length === 0}>
                {sending ? 'Sending…' : 'Send'}
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

