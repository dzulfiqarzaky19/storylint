import { AgentPanel } from 'storylint'
import {
  asyncNoop,
  chapter,
  noop,
  project,
  proposals,
  selection,
  transcript,
} from '../fixtures.ts'

const frame: React.CSSProperties = {
  display: 'flex',
  height: 620,
  width: 400,
  overflow: 'hidden',
  borderRadius: 'var(--radius-md)',
  border: 'var(--border-width) solid var(--color-border)',
}

const base = {
  project,
  chapterTitle: chapter.title,
  chapterBody: chapter.body,
  selection,
  onProject: noop,
  beginMutation: () => 1,
  trackMutation: <T,>(operation: Promise<T>) => operation,
  onRunContinuity: asyncNoop,
  onAcceptProposal: asyncNoop,
  onEditProposal: asyncNoop,
  onRejectProposal: asyncNoop,
  onGenerateCowrite: asyncNoop,
  onApplyCard: asyncNoop,
  onDismissCard: noop,
  onRunReview: asyncNoop,
  onAddCraftTags: noop,
  onSend: noop,
  llmMode: 'fixture' as const,
}

export function WritingContext() {
  return (
    <div style={frame}>
      <AgentPanel
        {...base}
        transcript={transcript}
        proposals={proposals}
        companionContext="writing"
        contextLabel="1. The Lighthouse Keeper"
        continuityRunning={false}
        continuityMode="fixture"
        continuityCounts={{ red: 1, yellow: 0, proposals: 1 }}
      />
    </div>
  )
}

export function ContinuityRunning() {
  return (
    <div style={frame}>
      <AgentPanel
        {...base}
        transcript={transcript.slice(0, 1)}
        proposals={[]}
        companionContext="writing"
        contextLabel="1. The Lighthouse Keeper"
        continuityRunning
        continuityMode="fixture"
      />
    </div>
  )
}

export function LabContext() {
  return (
    <div style={frame}>
      <AgentPanel
        {...base}
        transcript={[]}
        proposals={[]}
        companionContext="lab"
        contextLabel="Lab"
        continuityRunning={false}
        continuityMode={null}
      />
    </div>
  )
}
