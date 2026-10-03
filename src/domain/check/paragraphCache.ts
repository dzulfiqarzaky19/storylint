import type { Mark } from './index';
import { mergeMarks } from './ai';
import { sha1 } from './hash';

// The AI check is paid per paragraph, so only paragraphs whose hash changed
// since the last check are sent again; marks on the others are kept.

function paragraphHash(paragraph: string): string {
  return sha1(paragraph.replace(/\s+/g, ' ').trim());
}

export function hashParagraphs(paragraphs: string[]): string[] {
  return paragraphs.map(paragraphHash);
}

export function changedParagraphIndices(
  paragraphs: string[],
  previousHashes: string[],
): number[] {
  const changed: number[] = [];
  for (let i = 0; i < paragraphs.length; i++) {
    if (previousHashes[i] !== paragraphHash(paragraphs[i]!)) changed.push(i);
  }
  return changed;
}

export function reconcileAiMarks(
  previousAiMarks: Mark[],
  freshAiMarks: Mark[],
  changedIndices: number[],
  paragraphCount: number,
): Mark[] {
  const changed = new Set(changedIndices);
  const kept = previousAiMarks.filter(
    (m) =>
      !changed.has(m.position.paragraphIndex) &&
      m.position.paragraphIndex < paragraphCount,
  );
  return mergeMarks(kept, freshAiMarks);
}
