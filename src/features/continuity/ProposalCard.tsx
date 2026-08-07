import { useEffect, useState } from 'react'
import type { Proposal } from '../../domain/types.ts'
import type { ProposalEdits } from '../project/api.ts'
import { Badge, Button, Input } from '../../components/ui'
import './continuity.css'

export type ProposalCardProps = {
  proposal: Proposal
  onAccept: (id: string, edits?: ProposalEdits) => Promise<void>
  onReject: (id: string) => Promise<void>
}

export function ProposalCard({ proposal, onAccept, onReject }: ProposalCardProps) {
  const [editing, setEditing] = useState(false)
  const [gateOpen, setGateOpen] = useState(false)
  const [value, setValue] = useState(proposal.value)
  const [statement, setStatement] = useState(proposal.statement)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setValue(proposal.value)
    setStatement(proposal.statement)
    setGateOpen(false)
  }, [proposal])

  async function perform(action: () => Promise<void>) {
    setBusy(true)
    try { await action() } catch { return } finally { setBusy(false) }
  }

  return (
    <article className="proposal-card">
      <div className="proposal-card__heading">
        <strong>{proposal.entityName}</strong>
        <Badge tone="warning">awaiting accept</Badge>
      </div>
      {editing ? (
        <div className="proposal-card__edit">
          <label><span>Value</span><Input value={value} onChange={(event) => setValue(event.target.value)} /></label>
          <label><span>Statement</span><Input value={statement} onChange={(event) => setStatement(event.target.value)} /></label>
        </div>
      ) : (
        <p><strong>{proposal.key}</strong>: {proposal.value}<small>{proposal.statement}</small></p>
      )}
      {gateOpen ? (
        <div className="proposal-card__confirm">
          <p className="proposal-card__confirm-line">
            Accepting adds 1 fact to {proposal.entityName} and makes it visible to Continuity.
          </p>
          {proposal.source.text ? (
            <p className="proposal-card__confirm-source">"{proposal.source.text}"</p>
          ) : null}
          <div className="proposal-card__actions">
            <Button
              variant="primary"
              disabled={busy || (editing && (!value.trim() || !statement.trim()))}
              onClick={() => void perform(() => onAccept(
                proposal.id,
                editing ? { value: value.trim(), statement: statement.trim() } : undefined,
              ))}
            >
              {editing ? 'Accept edits' : 'Accept'}
            </Button>
            <Button disabled={busy} onClick={() => setGateOpen(false)}>Back to Draft</Button>
          </div>
        </div>
      ) : (
        <div className="proposal-card__actions">
          <Button disabled={busy} onClick={() => setGateOpen(true)}>Promote to Canon →</Button>
          {editing ? (
            <Button disabled={busy} onClick={() => {
              setValue(proposal.value)
              setStatement(proposal.statement)
              setEditing(false)
            }}>Cancel edit</Button>
          ) : <Button disabled={busy} onClick={() => setEditing(true)}>Edit</Button>}
          <Button variant="danger" disabled={busy} onClick={() => void perform(() => onReject(proposal.id))}>Reject</Button>
        </div>
      )}
    </article>
  )
}
