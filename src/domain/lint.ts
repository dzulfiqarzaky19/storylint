import { claimFingerprint } from './fingerprint.ts'
import type { Claim, Fact, LintResult, Project, Proposal, Sheet } from './types.ts'

export const PROPOSAL_CONFIDENCE = 0.7

function normalized(value: string): string {
  return value.normalize('NFKC').trim().toLocaleLowerCase('en-US').replaceAll(/\s+/g, ' ')
}

function findSheet(project: Project, claim: Claim): Sheet | undefined {
  const entity = normalized(claim.entityName)
  return project.sheets.find(
    (sheet) =>
      sheet.kind === claim.sheetKind &&
      [sheet.name, ...sheet.aliases].some((name) => normalized(name) === entity),
  )
}

function findFact(sheet: Sheet | undefined, claim: Claim): Fact | undefined {
  if (!sheet) return undefined
  const key = normalized(claim.key)
  return sheet.facts.find((fact) => normalized(fact.key) === key)
}

function proposalFrom(claim: Claim, sheet: Sheet | undefined): Proposal {
  const fingerprint = claimFingerprint(claim)
  return {
    id: `proposal-${fingerprint}`,
    fingerprint,
    status: 'pending',
    entityName: claim.entityName.trim(),
    sheetKind: claim.sheetKind,
    targetSheetId: sheet?.id,
    key: claim.key.trim(),
    value: claim.value.trim(),
    statement: claim.statement.trim(),
    claimKind: claim.claimKind,
    confidence: claim.confidence,
    source: { ...claim.span },
    fromSheetId: claim.fromSheetId,
    toSheetId: claim.toSheetId,
  }
}

/** Deterministic continuity gates. Extraction is deliberately outside this module. */
export function lintClaims(project: Project, claims: readonly Claim[]): LintResult {
  const marks: LintResult['marks'] = []
  const proposals: Proposal[] = []
  const seen = new Set([
    ...project.proposals.map((proposal) => proposal.fingerprint),
    ...project.rejectedFingerprints,
  ])

  for (const claim of claims) {
    const sheet = findSheet(project, claim)
    const fact = findFact(sheet, claim)

    if (fact) {
      if (normalized(fact.value) !== normalized(claim.value)) {
        marks.push({
          id: `mark-${claimFingerprint(claim)}-${claim.span.start}`,
          severity: 'red',
          reason: `Conflicts with canon: ${fact.statement}`,
          sheetId: sheet?.id ?? '',
          factId: fact.id,
          span: { ...claim.span },
        })
      }
      continue
    }

    if (claim.confidence < PROPOSAL_CONFIDENCE) continue

    const proposal = proposalFrom(claim, sheet)
    if (seen.has(proposal.fingerprint)) continue
    seen.add(proposal.fingerprint)
    proposals.push(proposal)
  }

  return { marks, proposals }
}
