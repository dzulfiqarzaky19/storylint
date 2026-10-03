import type { Mark, MarkAction, WikiEntry, WikiFact, CheckWiki } from './index';
import { rules, type Rule, type RuleContext, type RuleMatch } from './rules';
import { normalizeQuote } from './normalize';
import { sha1 } from './hash';
import { splitSentences, occurrenceIndexOf } from './text';

const CONFLICT_ACTIONS: MarkAction[] = [
  { id: 'wiki', label: 'The wiki is out of date — change it' },
  { id: 'text', label: 'Ask AI' },
];

function markKey(ruleId: string, quote: string, entryId: string): string {
  return sha1(`${ruleId}|${normalizeQuote(quote)}|${entryId}`);
}

function applyRule(
  rule: Rule,
  ctx: RuleContext,
): RuleMatch | null {
  const match = ctx.sentence.match(rule.extract);
  if (!match) return null;
  return rule.compare(match, ctx);
}

export function findContradictions(
  paragraphs: string[],
  wiki: CheckWiki,
): Mark[] {
  const marks: Mark[] = [];
  const seen = new Set<string>();

  const byFactKey = new Map<string, { entry: WikiEntry; fact: WikiFact }[]>();
  for (const entry of wiki.entries) {
    for (const fact of entry.facts) {
      const list = byFactKey.get(fact.key);
      if (list) list.push({ entry, fact });
      else byFactKey.set(fact.key, [{ entry, fact }]);
    }
  }

  paragraphs.forEach((paragraph, paragraphIndex) => {
    let sentenceFrom = 0;
    for (const sentence of splitSentences(paragraph)) {
      const sentenceAt = paragraph.indexOf(sentence, sentenceFrom);
      sentenceFrom = sentenceAt + sentence.length;
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

          const checkedAgainst = {
            factId: fact.id,
            entryId: entry.id,
            factKey: fact.key,
            recordedValue: fact.value,
          };
          const resolvedTarget = {
            category: {},
            entry: { id: entry.id },
            fact: { key: fact.key, value: result.suggestedValue ?? '' },
          };

          marks.push({
            markKey: key,
            entityId: result.entryId || undefined,
            kind: 'conflict',
            ruleId: rule.id,
            quote: result.quote,
            rail: result.rail,
            noteText: result.noteText,
            actions: CONFLICT_ACTIONS,
            checkedAgainst,
            resolvedTarget,
            position: {
              paragraphIndex,
              // The quote is anchored inside the sentence that tripped the rule,
              // not at an earlier sentence that happens to repeat the words.
              occurrenceIndex: occurrenceIndexOf(
                paragraph,
                result.quote,
                sentenceAt + Math.max(0, sentence.indexOf(result.quote)),
              ),
            },
          });
        }
      }
    }
  });

  return marks;
}
