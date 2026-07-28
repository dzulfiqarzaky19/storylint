import { useState } from 'react'
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

export type AgentPanelProps = {
  transcript: TranscriptEntry[]
  project: Project | null
  onProject: (project: Project, generation?: number) => void
  beginMutation: () => number | null
  trackMutation: <T>(operation: Promise<T>) => Promise<T>
  chapterTitle: string
  proposals: Proposal[]
  continuityRunning: boolean
  continuityMode: 'fixture' | 'live' | null
  onRunContinuity: () => Promise<void>
  onAcceptProposal: (id: string, edits?: ProposalEdits) => Promise<void>
  onEditProposal: (id: string, edits: ProposalEdits) => Promise<void>
  onRejectProposal: (id: string) => Promise<void>
  sending: boolean
  tipsDismissed: boolean
  onDismissTips: () => void
  selection: { start: number; end: number; text: string }
  onGenerateCowrite: (skill: CowriteSkill, instruction: string) => Promise<void>
  onApplyCard: (id: string) => Promise<void>
  onDismissCard: (id: string) => void
  onRunReview: (kind: ReviewKind) => Promise<void>
  onAddCraftTags: (tags: CraftTag[]) => void
  onSend: (text: string) => void
  onClose?: () => void
}

export function AgentPanel({
  transcript, project, onProject, beginMutation, trackMutation, chapterTitle, proposals, continuityRunning, continuityMode,
  onRunContinuity, onAcceptProposal, onEditProposal, onRejectProposal, sending, tipsDismissed,
  onDismissTips, selection, onGenerateCowrite, onApplyCard, onDismissCard,
  onRunReview, onAddCraftTags, onSend, onClose,
}: AgentPanelProps) {
  const [draft, setDraft] = useState('')
  const [panelMode, setPanelMode] = useState<'agent' | 'research'>('agent')
  const packs = [...new Set(proposals.flatMap((proposal) => proposal.packId ? [proposal.packId] : []))]
  const standalone = proposals.filter((proposal) => !proposal.packId)

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

  return (
    <div className="panel">
      <div className="panel__header">
        <h2 className="panel__title">{panelMode === 'agent' ? 'Agent' : 'Research'}</h2>
        <Button aria-pressed={panelMode === 'agent'} onClick={() => setPanelMode('agent')}>Agent</Button>
        <Button aria-pressed={panelMode === 'research'} onClick={() => setPanelMode('research')}>Research</Button>
        {onClose ? <IconButton label="Close agent panel" onClick={onClose}>✕</IconButton> : null}
      </div>

      {panelMode === 'research' ? (
        <ResearchPanel project={project} onProject={onProject} beginMutation={beginMutation} trackMutation={trackMutation} />
      ) : (
        <>
      <div className="agent__transcript" aria-label="Agent transcript">
        <Button variant="primary" disabled={continuityRunning} onClick={() => void onRunContinuity().catch(() => undefined)}>
          {continuityRunning ? 'Running…' : 'Run Continuity'}
        </Button>
        <p className="continuity-privacy">
          Live mode sends this chapter and a bible digest to the configured model provider.
          {continuityMode ? ` Last run: ${continuityMode}.` : ''}
        </p>
        {proposals.length > 0 ? (
          <section className="proposal-list" aria-label="Pending proposals">
            {packs.map((packId) => (
              <SheetPackCard
                key={packId}
                proposals={proposals.filter((proposal) => proposal.packId === packId)}
                onAccept={onAcceptProposal}
                onEdit={onEditProposal}
                onReject={onRejectProposal}
              />
            ))}
            {standalone.map((proposal) => (
              <ProposalCard
                key={proposal.id}
                proposal={proposal}
                onAccept={onAcceptProposal}
                onReject={onRejectProposal}
              />
            ))}
          </section>
        ) : null}
        {transcript.length === 0 && proposals.length === 0 && !tipsDismissed ? (
          <EmptyState
            title="Start with one small step"
            hint="Run Continuity after a scene, or ask me to draft a character sheet. Try: /sheet Kael"
            action={<Button onClick={onDismissTips}>Dismiss tips</Button>}
          />
        ) : null}
        {transcript.map((entry) =>
          entry.role === 'tool' ? (
            <article key={entry.id} className="agent__tool-card">
              <span className="agent__message-role">Continuity · {entry.mode}</span>
              <strong>{entry.red} red · {entry.yellow} yellow · {entry.proposals} proposals</strong>
            </article>
          ) : entry.role === 'apply' ? (
            <ApplyCard key={entry.id} card={entry.card} onApply={onApplyCard} onDismiss={onDismissCard} />
          ) : entry.role === 'review' ? (
            <ReviewCard key={entry.id} result={entry.result} onAddTags={onAddCraftTags} />
          ) : (
            <div key={entry.id} className={`agent__message agent__message--${entry.role}`}>
              <span className="agent__message-role">{entry.role}</span>{entry.text}
            </div>
          ),
        )}
      </div>

      <div className="panel__footer">
        <div className="agent__chips"><Badge tone="accent">@{chapterTitle || 'chapter'}</Badge><Badge tone="pending">@bible</Badge></div>
        <Textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); send() }
          }}
          placeholder="Ask about this chapter…"
          aria-label="Message the agent"
          rows={3}
        />
        <div className="agent__cowrite-actions" aria-label="Review tools">
          <Button disabled={sending} onClick={() => void onRunReview('review').catch(() => undefined)}>
            Review chapter
          </Button>
          <Button disabled={sending} onClick={() => void onRunReview('craft').catch(() => undefined)}>
            Craft check
          </Button>
        </div>
        <div className="agent__cowrite-actions" aria-label="Co-write skills">
          <Button disabled={sending} onClick={() => generate('continue')}>Continue</Button>
          <Button disabled={sending || selection.start === selection.end} onClick={() => generate('rewrite')}>Rewrite selection</Button>
          <Button disabled={sending} onClick={() => generate('brainstorm')}>Brainstorm beats</Button>
        </div>
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
