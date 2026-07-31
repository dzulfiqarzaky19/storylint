import { useEffect, useMemo, useState } from 'react'
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

const FACES: Record<CompanionContext, CompanionFace[]> = {
  writing: ['chat', 'write', 'check', 'research', 'inbox'],
  lab: ['chat', 'spark', 'inbox'],
  details: ['chat', 'fill', 'research', 'inbox'],
  graph: ['chat', 'inspect', 'inbox'],
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
  tipsDismissed: boolean
  onDismissTips: () => void
  selection: { start: number; end: number; text: string }
  onGenerateCowrite: (skill: CowriteSkill, instruction: string) => Promise<void>
  onApplyCard: (id: string) => Promise<void>
  onDismissCard: (id: string) => void
  onRunReview: (kind: ReviewKind) => Promise<void>
  onAddCraftTags: (tags: CraftTag[]) => void
  onSend: (text: string) => void
  onSparkPreset?: (kind: 'place' | 'character-spark' | 'beat' | 'what-if') => void
  onClose?: () => void
}

export function AgentPanel({
  transcript, project, onProject, beginMutation, trackMutation, chapterTitle,
  companionContext = 'writing', contextLabel,
  proposals, continuityRunning, continuityMode, continuityCounts,
  onRunContinuity, onAcceptProposal, onEditProposal, onRejectProposal, sending, llmMode, tipsDismissed,
  onDismissTips, selection, onGenerateCowrite, onApplyCard, onDismissCard,
  onRunReview, onAddCraftTags, onSend, onSparkPreset, onClose,
}: AgentPanelProps) {
  const [draft, setDraft] = useState('')
  const [face, setFace] = useState<CompanionFace>(DEFAULT_FACE[companionContext])
  const allowed = FACES[companionContext]
  const applyCards = transcript.filter((entry) => entry.role === 'apply')
  const pendingCount = proposals.length + applyCards.length

  useEffect(() => {
    setFace(DEFAULT_FACE[companionContext])
  }, [companionContext])

  useEffect(() => {
    if (!allowed.includes(face)) setFace(DEFAULT_FACE[companionContext])
  }, [allowed, companionContext, face])

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

  function renderTranscript(options?: { tools?: boolean; apply?: boolean; review?: boolean }) {
    const showTools = options?.tools !== false
    const showApply = options?.apply !== false
    const showReview = options?.review !== false
    return (
      <div className="agent__transcript" aria-label="Agent transcript">
        {statusLine ? (
          <p className="continuity-privacy" data-continuity-status={continuityState} aria-live="polite">
            {statusLine}
          </p>
        ) : null}
        {transcript.length === 0 && !tipsDismissed && face === 'chat' ? (
          <EmptyState
            title={companionContext === 'lab' ? 'Brainstorm onto the bench' : 'Start with one small step'}
            hint={companionContext === 'lab'
              ? 'Ask for places, character sparks, or what-ifs. Results land as Lab cards — not bible.'
              : 'Run Continuity from Check, or ask me to draft a character sheet. Try: /sheet Kael'}
            action={<Button onClick={onDismissTips}>Dismiss tips</Button>}
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

  return (
    <div className="panel" data-companion-context={companionContext} data-companion-face={face}>
      <div className="panel__header">
        <h2 className="panel__title">Companion</h2>
        {onClose ? <IconButton label="Close companion" onClick={onClose}>✕</IconButton> : null}
      </div>

      <div className="companion__faces" role="tablist" aria-label="Companion faces">
        {allowed.map((candidate) => (
          <Button
            key={candidate}
            aria-pressed={face === candidate}
            onClick={() => setFace(candidate)}
          >
            {FACE_LABEL[candidate]}
            {candidate === 'inbox' && pendingCount > 0 ? ` ${pendingCount}` : ''}
          </Button>
        ))}
      </div>

      {face === 'research' ? (
        <ResearchPanel project={project} onProject={onProject} beginMutation={beginMutation} trackMutation={trackMutation} />
      ) : face === 'inbox' ? (
        <div className="agent__transcript" aria-label="Companion inbox">
          {statusLine ? <p className="continuity-privacy">{statusLine}</p> : null}
          {pendingCount === 0 ? (
            <EmptyState title="Inbox clear" hint="Pending proposals and Apply cards land here." />
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
        <>
          {renderTranscript({ tools: false, review: false, apply: true })}
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
              <Button disabled={sending} onClick={() => generate('continue')}>Continue</Button>
              <Button disabled={sending || selection.start === selection.end} onClick={() => generate('rewrite')}>Rewrite</Button>
              <Button disabled={sending} onClick={() => generate('brainstorm')}>Brainstorm</Button>
            </div>
          </div>
        </>
      ) : face === 'check' && companionContext === 'writing' ? (
        <>
          {renderTranscript({ apply: false })}
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
      ) : face === 'spark' && companionContext === 'lab' ? (
        <>
          {renderTranscript({ tools: false, apply: false, review: false })}
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
          {renderTranscript({ apply: false, review: false })}
          <div className="panel__footer">
            <div className="agent__chips"><Badge tone="accent">{chipLabel}</Badge><Badge tone="pending">@bible</Badge></div>
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
      ) : (
        <>
          {renderTranscript({
            tools: companionContext === 'writing',
            apply: companionContext === 'writing',
            review: companionContext === 'writing',
          })}
          <div className="panel__footer">
            <div className="agent__chips">
              <Badge tone="accent">{chipLabel}</Badge>
              {companionContext === 'writing' ? <Badge tone="pending">@bible</Badge> : null}
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
