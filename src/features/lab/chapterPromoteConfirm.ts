import type { LabCard, LabCardKind, LabCardSource } from '../../domain/types.ts'

/**
 * Chapter promote confirm is destination-shaped consent for **model** text
 * entering a stored chapter title (ox lab-promote-consent-provenance).
 *
 * Gate is kind === 'beat' AND source === 'model'.
 * Author beats promote one-click (title already owned).
 * Sheet sparks never use this gate (Accept is the write consent).
 */
export function needsChapterPromoteConfirm(
  card: Pick<LabCard, 'kind' | 'source'> | { kind: LabCardKind; source: LabCardSource },
): boolean {
  return card.kind === 'beat' && card.source === 'model'
}
