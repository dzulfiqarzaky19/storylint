import { useEffect, useState } from 'react'
import { LAB_CARD_KINDS, type LabCardKind, type Project } from '../../domain/types.ts'
import { Button, Input, Textarea } from '../../components/ui'
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

export type BenchQuickAddProps = {
  boardId?: string | null
  initialTitle?: string
  onCreateCard: (input: { boardId?: string; kind: LabCardKind; title: string; body?: string }) => Promise<Project>
  onClose: () => void
}

/** Bench a selection without leaving the manuscript — full Lab view stays for deliberate sessions. */
export function BenchQuickAdd({ boardId, initialTitle = '', onCreateCard, onClose }: BenchQuickAddProps) {
  const [kind, setKind] = useState<LabCardKind>('lore-spark')
  const [title, setTitle] = useState(initialTitle)
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    setTitle(initialTitle)
  }, [initialTitle])

  async function create() {
    if (!title.trim() || busy) return
    setBusy(true)
    setNotice(null)
    try {
      await onCreateCard({ boardId: boardId ?? undefined, kind, title: title.trim(), body: body.trim() || undefined })
      setTitle('')
      setBody('')
      onClose()
    } catch (caught) {
      setNotice(caught instanceof Error ? caught.message : 'Could not create card')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="lab__composer" aria-label="Bench this selection">
      <h3 className="lab__section-label">Bench this</h3>
      <Input
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        placeholder="Title — a place, beat, or spark"
        aria-label="Lab card title"
      />
      <Textarea
        value={body}
        onChange={(event) => setBody(event.target.value)}
        placeholder="Notes (not canon)"
        aria-label="Lab card body"
        rows={4}
      />
      <div className="lab__composer-kinds" role="group" aria-label="Card kind">
        {LAB_CARD_KINDS.map((candidate) => (
          <Button key={candidate} aria-pressed={kind === candidate} onClick={() => setKind(candidate)}>
            {KIND_LABEL[candidate]}
          </Button>
        ))}
      </div>
      {notice ? <p className="lab__notice" role="status">{notice}</p> : null}
      <div className="lab__composer-actions">
        <Button variant="primary" disabled={busy || !title.trim()} onClick={() => void create()}>
          {busy ? 'Saving…' : 'Bench it'}
        </Button>
        <Button disabled={busy} onClick={onClose}>Cancel</Button>
      </div>
    </section>
  )
}
