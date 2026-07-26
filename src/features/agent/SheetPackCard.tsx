import { useEffect, useState } from 'react'
import type { Proposal } from '../../domain/types.ts'
import type { ProposalEdits } from '../project/api.ts'
import { Badge, Button, Input } from '../../components/ui'

export function SheetPackCard({
  proposals,
  onAccept,
  onEdit,
  onReject,
}: {
  proposals: Proposal[]
  onAccept: (id: string) => Promise<void>
  onEdit: (id: string, edits: ProposalEdits) => Promise<void>
  onReject: (id: string) => Promise<void>
}) {
  const first = proposals[0]
  const [editing, setEditing] = useState(false)
  const [drafts, setDrafts] = useState(() => proposals.map(({ id, value, statement }) => ({ id, value, statement })))
  useEffect(() => setDrafts(proposals.map(({ id, value, statement }) => ({ id, value, statement }))), [proposals])

  async function saveEdits() {
    for (const draft of drafts) {
      await onEdit(draft.id, { value: draft.value.trim(), statement: draft.statement.trim() })
    }
    setEditing(false)
  }

  return (
    <article className="proposal-card">
      <div className="proposal-card__heading">
        <strong>{first.entityName}</strong>
        <Badge tone="pending">{first.sheetKind} pack</Badge>
      </div>
      {drafts.map((draft, index) => (
        editing ? (
          <div className="proposal-card__edit" key={draft.id}>
            <label><span>{proposals[index].key} value</span><Input value={draft.value} onChange={(event) => setDrafts((current) => current.map((item) => item.id === draft.id ? { ...item, value: event.target.value } : item))} /></label>
            <label><span>Statement</span><Input value={draft.statement} onChange={(event) => setDrafts((current) => current.map((item) => item.id === draft.id ? { ...item, statement: event.target.value } : item))} /></label>
          </div>
        ) : (
          <p key={draft.id}><strong>{proposals[index].key}</strong>: {draft.value}<small>{draft.statement}</small></p>
        )
      ))}
      <div className="proposal-card__actions">
        <Button variant="primary" disabled={editing} onClick={() => void onAccept(first.id).catch(() => undefined)}>Accept pack</Button>
        {editing ? (
          <Button disabled={drafts.some((draft) => !draft.value.trim() || !draft.statement.trim())} onClick={() => void saveEdits().catch(() => undefined)}>Save edits</Button>
        ) : <Button onClick={() => setEditing(true)}>Edit pack</Button>}
        <Button variant="danger" onClick={() => void onReject(first.id).catch(() => undefined)}>Reject pack</Button>
      </div>
    </article>
  )
}
