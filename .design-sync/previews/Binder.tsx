import { Binder } from 'storylint'
import { asyncNoop, chapters, noop, sheets } from '../fixtures.ts'

const frame: React.CSSProperties = {
  display: 'flex',
  height: 460,
  width: 320,
  overflow: 'hidden',
  borderRadius: 'var(--radius-md)',
  border: 'var(--border-width) solid var(--color-border)',
}

export function DraftLeading() {
  return (
    <div style={frame}>
      <Binder
        chapters={chapters}
        sheets={sheets}
        activeChapterId="ch-1"
        projectId="harbour-bell"
        onSelectChapter={noop}
        onAddChapter={noop}
        onSaveSheet={asyncNoop}
        onSaveFact={asyncNoop}
        onDeleteFact={asyncNoop}
      />
    </div>
  )
}

export function CanonMode() {
  return (
    <div style={frame}>
      <Binder
        chapters={chapters}
        sheets={sheets}
        activeChapterId="ch-2"
        projectId="harbour-bell"
        canonMode
        onSelectChapter={noop}
        onAddChapter={noop}
        onSaveSheet={asyncNoop}
        onSaveFact={asyncNoop}
        onDeleteFact={asyncNoop}
      />
    </div>
  )
}

export function EmptyProject() {
  return (
    <div style={frame}>
      <Binder
        chapters={[]}
        sheets={[]}
        activeChapterId=""
        projectId="new-project"
        onSelectChapter={noop}
        onAddChapter={noop}
        onSaveSheet={asyncNoop}
        onSaveFact={asyncNoop}
        onDeleteFact={asyncNoop}
      />
    </div>
  )
}
