import { upsertFact, upsertSheet } from './project.ts'
import type { Fact, Project, Proposal, Sheet } from './types.ts'

function pendingProposal(project: Project, proposalId: string): Proposal {
  const proposal = project.proposals.find((candidate) => candidate.id === proposalId)
  if (!proposal) throw new Error(`Proposal not found: ${proposalId}`)
  if (proposal.status !== 'pending') throw new Error(`Proposal is already ${proposal.status}`)
  return proposal
}

function pack(project: Project, proposal: Proposal): Proposal[] {
  return proposal.packId
    ? project.proposals.filter((candidate) => candidate.packId === proposal.packId)
    : [proposal]
}

function withStatus(
  project: Project,
  proposalIds: ReadonlySet<string>,
  status: 'accepted' | 'rejected',
): Project {
  return {
    ...project,
    proposals: project.proposals.map((proposal) =>
      proposalIds.has(proposal.id) ? { ...proposal, status } : proposal,
    ),
  }
}

export type ProposalEdits = Partial<Pick<Proposal, 'entityName' | 'key' | 'value' | 'statement' | 'claimKind'>>

export function acceptProposal(project: Project, proposalId: string, edits: ProposalEdits = {}): Project {
  const original = pendingProposal(project, proposalId)
  const members = pack(project, original)
  if (members.some((proposal) => proposal.status !== 'pending')) {
    throw new Error('Proposal pack has already been decided')
  }
  const accepted = members.map((proposal) =>
    proposal.id === proposalId ? { ...proposal, ...edits } : proposal,
  )
  let next = project
  let sheet = original.targetSheetId
    ? project.sheets.find((candidate) => candidate.id === original.targetSheetId)
    : project.sheets.find((candidate) =>
        candidate.kind === original.sheetKind &&
        candidate.name.toLocaleLowerCase('en-US') === original.entityName.toLocaleLowerCase('en-US'),
      )

  if (!sheet) {
    sheet = {
      id: `sheet-${original.packId ?? original.fingerprint}`,
      kind: original.sheetKind,
      name: original.entityName,
      aliases: [],
      summary: original.sheetSummary ?? '',
      notes: '',
      facts: [],
    } satisfies Sheet
    next = upsertSheet(next, sheet)
  }

  for (const proposal of accepted) {
    const fact: Fact = {
      id: proposal.targetFactId ?? `fact-${proposal.fingerprint}`,
      key: proposal.key,
      value: proposal.value,
      statement: proposal.statement,
      claimKind: proposal.claimKind,
      fromSheetId: proposal.fromSheetId,
      toSheetId: proposal.toSheetId,
    }
    next = upsertFact(next, sheet.id, fact)
  }

  next = {
    ...next,
    proposals: next.proposals.map((candidate) => {
      const acceptedMember = accepted.find((proposal) => proposal.id === candidate.id)
      return acceptedMember ?? candidate
    }),
  }
  return withStatus(next, new Set(accepted.map((proposal) => proposal.id)), 'accepted')
}

export function rejectProposal(project: Project, proposalId: string): Project {
  const proposal = pendingProposal(project, proposalId)
  const members = pack(project, proposal)
  const fingerprints = members.map((member) => member.fingerprint)
  const rejectedFingerprints = [
    ...project.rejectedFingerprints,
    ...fingerprints.filter((fingerprint) => !project.rejectedFingerprints.includes(fingerprint)),
  ]
  return withStatus(
    { ...project, rejectedFingerprints },
    new Set(members.map((member) => member.id)),
    'rejected',
  )
}
