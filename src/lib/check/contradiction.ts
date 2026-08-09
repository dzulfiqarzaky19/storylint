/**
 * Pass A — contradiction detection (HANDOFF §7).
 *
 * Walks recorded facts, applies each matching rule to every sentence of every
 * paragraph, and emits a `conflict` mark when a rule reports a mismatch. The
 * rail / noteText / actions come from the rule's output plus a fixed action set,
 * never from a hardcoded list of the spec's marks.
 */

import type { Mark, MarkAction, WikiEntry, WikiFact, WikiSnapshot } from './index';
import { rules, type Rule, type RuleContext } from './rules';
import { normalizeQuote } from './normalize';
import { sha1 } from './hash';
import { splitSentences, occurrenceIndexOf } from './text';

// The three note actions for a contradiction (HANDOFF §6 m1/m4).
const CONFLICT_ACTIONS: MarkAction[] = [
  { id: 'wiki', label: 'The wiki is out of date — change it' },
  { id: 'text', label: 'Change the sentence' },
  { id: 'leave', label: 'It’s deliberate, leave it' },
];

function markKey(ruleId: string, quote: string, entryId: string): string {
  return sha1(`${ruleId}|${normalizeQuote(quote)}|${entryId}`);
}

/** Run one rule against one sentence for one fact-bearing entry. */
function applyRule(
  rule: Rule,
  ctx: RuleContext,
): { quote: string; entryId: string; rail: string; noteText: string } | null {
  const match = ctx.sentence.match(rule.extract);
  if (!match) return null;
  return rule.compare(match, ctx);
}

export function findContradictions(
  paragraphs: string[],
  wiki: WikiSnapshot,
): Mark[] {
  const marks: Mark[] = [];
  const seen = new Set<string>();

  // Index (factKey -> [{entry, fact}]) once, so each rule only visits entries
  // that actually record its factKey instead of re-scanning every entry's facts
  // for every (sentence, rule) pair.
  const byFactKey = new Map<string, { entry: WikiEntry; fact: WikiFact }[]>();
  for (const entry of wiki.entries) {
    for (const fact of entry.facts) {
      const list = byFactKey.get(fact.key);
      if (list) list.push({ entry, fact });
      else byFactKey.set(fact.key, [{ entry, fact }]);
    }
  }

  paragraphs.forEach((paragraph, paragraphIndex) => {
    for (const sentence of splitSentences(paragraph)) {
      for (const rule of rules) {
        const bearers = byFactKey.get(rule.factKey);
        if (!bearers) continue;
        for (const { entry, fact } of bearers) {
          const result = applyRule(rule, {
            sentence,
            entry,
            recordedValue: fact.value,
            wiki,
          });
          if (!result) continue;

          const key = markKey(rule.id, result.quote, result.entryId);
          if (seen.has(key)) continue;
          seen.add(key);

          marks.push({
            markKey: key,
            // Surface the exact entry this mark is anchored to (the SAME id that
            // fed markKey above), so explainMark can pin retrieval to it instead
            // of re-deriving via substring scan. Empty -> undefined (no anchor).
            entityId: result.entryId || undefined,
            kind: 'conflict',
            ruleId: rule.id,
            quote: result.quote,
            rail: result.rail,
            noteText: result.noteText,
            actions: CONFLICT_ACTIONS,
            position: {
              paragraphIndex,
              occurrenceIndex: occurrenceIndexOf(paragraph, result.quote),
            },
          });
        }
      }
    }
  });

  return marks;
}
