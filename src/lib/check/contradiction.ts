/**
 * Pass A — contradiction detection (HANDOFF §7).
 *
 * Walks recorded facts, applies each matching rule to every sentence of every
 * paragraph, and emits a `conflict` mark when a rule reports a mismatch. The
 * rail / noteText / actions come from the rule's output plus a fixed action set,
 * never from a hardcoded list of the spec's marks.
 */

import type { Mark, MarkAction, WikiSnapshot } from './index';
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

  paragraphs.forEach((paragraph, paragraphIndex) => {
    for (const sentence of splitSentences(paragraph)) {
      for (const rule of rules) {
        for (const entry of wiki.entries) {
          const fact = entry.facts.find((f) => f.key === rule.factKey);
          if (!fact) continue;

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
