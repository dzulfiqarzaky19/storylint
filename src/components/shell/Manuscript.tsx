import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { ReadingProfile } from '../../design'
import { readingLabel } from '../../design'
import { CRAFT_TAGS, type Chapter, type CraftTag, type Mark } from '../../domain/types.ts'
import './shell.css'

export type EditorSelection = { start: number; end: number; text: string }

export type ManuscriptProps = {
  chapter: Chapter
  marks: Mark[]
  onChange: (patch: Partial<Pick<Chapter, 'title' | 'body'>>) => void
  onSelectionChange: (selection: EditorSelection) => void
  readOnly?: boolean
  reading: ReadingProfile
  onCycleReading: () => void
  onToggleCraftTag: (tag: CraftTag) => void
}

type Segment = { text: string; severity?: Mark['severity']; reason?: string }

function segments(body: string, marks: readonly Mark[]): Segment[] {
  const valid = marks
    .filter(
      (mark) =>
        mark.span.start >= 0 &&
        mark.span.end > mark.span.start &&
        mark.span.end <= body.length &&
        body.slice(mark.span.start, mark.span.end) === mark.span.text,
    )
    .sort((a, b) => a.span.start - b.span.start)
  const result: Segment[] = []
  let cursor = 0
  for (const mark of valid) {
    if (mark.span.start < cursor) continue
    if (mark.span.start > cursor) result.push({ text: body.slice(cursor, mark.span.start) })
    result.push({
      text: body.slice(mark.span.start, mark.span.end),
      severity: mark.severity,
      reason: mark.reason,
    })
    cursor = mark.span.end
  }
  if (cursor < body.length) result.push({ text: body.slice(cursor) })
  return result
}

function countWords(text: string): number {
  const trimmed = text.trim()
  if (!trimmed) return 0
  return trimmed.split(/\s+/).length
}

const READING_SHORT: Record<ReadingProfile, string> = {
  day: 'Day',
  sepia: 'Sepia',
  mint: 'Mint',
  night: 'Night',
}

/**
 * Continuous paper column (open bottom — scroll the reader, not a closed card).
 * Reading profile control is a bookmark on the paper, not app chrome.
 */
export function Manuscript({
  chapter,
  marks,
  onChange,
  onSelectionChange,
  readOnly = false,
  reading,
  onCycleReading,
  onToggleCraftTag,
}: ManuscriptProps) {
  const overlayRef = useRef<HTMLDivElement>(null)
  const bodyRef = useRef<HTMLTextAreaElement>(null)
  // Phone collapses fully; desktop caps visible chips (D8 density).
  const DESKTOP_CRAFT_VISIBLE = 5
  const [narrow, setNarrow] = useState(false)
  const [craftExpanded, setCraftExpanded] = useState(false)
  useEffect(() => {
    const media = window.matchMedia('(max-width: 767px)')
    const sync = () => setNarrow(media.matches)
    sync()
    media.addEventListener('change', sync)
    return () => media.removeEventListener('change', sync)
  }, [])
  const rendered = useMemo(() => segments(chapter.body, marks), [chapter.body, marks])
  const wordCount = useMemo(() => countWords(chapter.body), [chapter.body])
  const charCount = chapter.body.length

  useLayoutEffect(() => {
    const el = bodyRef.current
    if (!el) return
    el.style.height = 'auto'
    const min = el.parentElement?.clientHeight ?? 0
    el.style.height = `${Math.max(el.scrollHeight, min)}px`
  }, [chapter.body, chapter.title])

  useEffect(() => {
    const onResize = () => {
      const el = bodyRef.current
      if (!el) return
      el.style.height = 'auto'
      const min = el.parentElement?.clientHeight ?? 0
      el.style.height = `${Math.max(el.scrollHeight, min)}px`
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  return (
    <main id="workspace" className="manuscript" aria-label="Draft" tabIndex={-1}>
      <div className="manuscript__page">
        <div className="manuscript__sheet">
          <header className="manuscript__header">
            <div className="manuscript__header-main">
              <input
                className="manuscript__title"
                value={chapter.title}
                onChange={(event) => onChange({ title: event.target.value })}
                placeholder="Chapter title"
                aria-label="Chapter title"
                readOnly={readOnly}
              />
              <div className="manuscript__meta" aria-live="polite">
                <span>
                  {wordCount.toLocaleString()} {wordCount === 1 ? 'word' : 'words'}
                </span>
                <span className="manuscript__meta-sep" aria-hidden="true">
                  ·
                </span>
                <span>
                  {charCount.toLocaleString()} {charCount === 1 ? 'character' : 'characters'}
                </span>
              </div>
            </div>
            <button
              type="button"
              className="manuscript__bookmark"
              data-reading={reading}
              aria-label={`Paper: ${readingLabel(reading)}. Click for next profile.`}
              title={`${readingLabel(reading)} — click to change paper`}
              onClick={onCycleReading}
            >
              <span className="manuscript__bookmark-tab" aria-hidden="true" />
              <span className="manuscript__bookmark-label">{READING_SHORT[reading]}</span>
            </button>
          </header>

          {/* Craft tags: phone full collapse; desktop ≤5 + "n tags" (D8). */}
          {(() => {
            const active = CRAFT_TAGS.filter((tag) => chapter.craftTags.includes(tag))
            const inactive = CRAFT_TAGS.filter((tag) => !chapter.craftTags.includes(tag))
            const ordered = [...active, ...inactive]
            const chip = (tag: CraftTag) => {
              const on = chapter.craftTags.includes(tag)
              return (
                <button
                  key={tag}
                  type="button"
                  className="manuscript__craft-tag ui-focusable"
                  aria-pressed={on}
                  disabled={readOnly}
                  onClick={() => onToggleCraftTag(tag)}
                >
                  {tag}
                </button>
              )
            }
            if (narrow) {
              return (
                <details className="manuscript__craft-tags-disclosure">
                  <summary className="manuscript__craft-tags-summary ui-focusable">
                    <span>Tags</span>
                    {chapter.craftTags.length > 0 ? (
                      <span className="manuscript__craft-tags-count">{chapter.craftTags.length}</span>
                    ) : null}
                  </summary>
                  <div className="manuscript__craft-tags" aria-label="Chapter craft tags">
                    {ordered.map(chip)}
                  </div>
                </details>
              )
            }
            const limit = craftExpanded ? ordered.length : DESKTOP_CRAFT_VISIBLE
            const shown = ordered.slice(0, limit)
            const hidden = Math.max(0, ordered.length - shown.length)
            return (
              <div className="manuscript__craft-tags" aria-label="Chapter craft tags">
                {shown.map(chip)}
                {hidden > 0 ? (
                  <button
                    type="button"
                    className="manuscript__craft-tag manuscript__craft-tag--more ui-focusable"
                    onClick={() => setCraftExpanded(true)}
                    aria-label={'Show ' + hidden + ' more craft tags'}
                  >
                    {hidden + ' tags'}
                  </button>
                ) : null}
                {craftExpanded && ordered.length > DESKTOP_CRAFT_VISIBLE ? (
                  <button
                    type="button"
                    className="manuscript__craft-tag manuscript__craft-tag--more ui-focusable"
                    onClick={() => setCraftExpanded(false)}
                    aria-label="Show fewer craft tags"
                  >
                    Less
                  </button>
                ) : null}
              </div>
            )
          })()}

          <div className="manuscript__editor">
            <div ref={overlayRef} className="manuscript__overlay" aria-hidden="true">
              {rendered.map((segment, index) =>
                segment.severity ? (
                  <mark
                    key={index}
                    className={`manuscript__mark manuscript__mark--${segment.severity}`}
                    title={segment.reason}
                  >
                    {segment.text}
                  </mark>
                ) : (
                  segment.text
                ),
              )}
              {'\n'}
            </div>
            <textarea
              ref={bodyRef}
              className="manuscript__body"
              value={chapter.body}
              onChange={(event) => onChange({ body: event.target.value })}
              onSelect={(event) => {
                const { selectionStart: start, selectionEnd: end, value } = event.currentTarget
                onSelectionChange({ start, end, text: value.slice(start, end) })
              }}
              onKeyUp={(event) => {
                const { selectionStart: start, selectionEnd: end, value } = event.currentTarget
                onSelectionChange({ start, end, text: value.slice(start, end) })
              }}
              onMouseUp={(event) => {
                const { selectionStart: start, selectionEnd: end, value } = event.currentTarget
                onSelectionChange({ start, end, text: value.slice(start, end) })
              }}
              placeholder="Write…"
              aria-label="Chapter text"
              readOnly={readOnly}
              spellCheck
            />
          </div>
        </div>
      </div>
    </main>
  )
}
