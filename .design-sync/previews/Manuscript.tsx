import { Manuscript } from 'storylint'
import { chapter, marks, noop } from '../fixtures.ts'

export function DaytimeClear() {
  return (
    <div
      data-reading="day"
      style={{
        height: 420,
        display: 'grid',
        overflow: 'hidden',
        borderRadius: 'var(--radius-md)',
        border: 'var(--border-width) solid var(--color-border)',
      }}
    >
      <Manuscript
        chapter={chapter}
        marks={marks}
        reading="day"
        onChange={noop}
        onSelectionChange={noop}
        onCycleReading={noop}
        onToggleCraftTag={noop}
      />
    </div>
  )
}

export function CozySepia() {
  return (
    <div
      data-reading="sepia"
      style={{
        height: 420,
        display: 'grid',
        overflow: 'hidden',
        borderRadius: 'var(--radius-md)',
        border: 'var(--border-width) solid var(--color-border)',
      }}
    >
      <Manuscript
        chapter={chapter}
        marks={marks}
        reading="sepia"
        onChange={noop}
        onSelectionChange={noop}
        onCycleReading={noop}
        onToggleCraftTag={noop}
      />
    </div>
  )
}

export function NightObsidian() {
  return (
    <div
      data-reading="night"
      style={{
        height: 420,
        display: 'grid',
        overflow: 'hidden',
        borderRadius: 'var(--radius-md)',
        border: 'var(--border-width) solid var(--color-border)',
      }}
    >
      <Manuscript
        chapter={chapter}
        marks={marks}
        reading="night"
        readOnly
        onChange={noop}
        onSelectionChange={noop}
        onCycleReading={noop}
        onToggleCraftTag={noop}
      />
    </div>
  )
}
