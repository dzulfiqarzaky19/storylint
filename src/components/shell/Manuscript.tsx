import { useMemo, useRef, type UIEvent } from 'react'
import type { Chapter, Mark } from '../../domain/types.ts'
import './shell.css'

export type ManuscriptProps = {
  chapter: Chapter
  marks: Mark[]
  onChange: (patch: Partial<Pick<Chapter, 'title' | 'body'>>) => void
}

type Segment = { text: string; severity?: Mark['severity']; reason?: string }

function segments(body: string, marks: readonly Mark[]): Segment[] {
  const valid = marks
    .filter((mark) =>
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
    result.push({ text: body.slice(mark.span.start, mark.span.end), severity: mark.severity, reason: mark.reason })
    cursor = mark.span.end
  }
  if (cursor < body.length) result.push({ text: body.slice(cursor) })
  return result
}

/** Clean textarea plus diagnostic paint layer. Controls remain outside the manuscript surface. */
export function Manuscript({ chapter, marks, onChange }: ManuscriptProps) {
  const overlayRef = useRef<HTMLDivElement>(null)
  const rendered = useMemo(() => segments(chapter.body, marks), [chapter.body, marks])

  function syncScroll(event: UIEvent<HTMLTextAreaElement>) {
    if (!overlayRef.current) return
    overlayRef.current.scrollTop = event.currentTarget.scrollTop
    overlayRef.current.scrollLeft = event.currentTarget.scrollLeft
  }

  return (
    <main className="manuscript" aria-label="Manuscript">
      <div className="manuscript__sheet">
        <input
          className="manuscript__title"
          value={chapter.title}
          onChange={(event) => onChange({ title: event.target.value })}
          placeholder="Chapter title"
          aria-label="Chapter title"
        />
        <div className="manuscript__editor">
          <div ref={overlayRef} className="manuscript__overlay" aria-hidden="true">
            {rendered.map((segment, index) =>
              segment.severity ? (
                <mark key={index} className={`manuscript__mark manuscript__mark--${segment.severity}`} title={segment.reason}>
                  {segment.text}
                </mark>
              ) : segment.text,
            )}
            {'\n'}
          </div>
          <textarea
            className="manuscript__body"
            value={chapter.body}
            onChange={(event) => onChange({ body: event.target.value })}
            onScroll={syncScroll}
            placeholder="Write…"
            aria-label="Chapter text"
            spellCheck
          />
        </div>
      </div>
    </main>
  )
}
