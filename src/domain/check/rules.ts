import type { WikiEntry, CheckWiki } from './index';
import { normalize } from './normalize';

function capitalize(value: string): string {
  return value ? value[0]!.toUpperCase() + value.slice(1) : value;
}

export interface RuleContext {
  sentence: string;
  entry: WikiEntry;
  recordedValue: string;
  wiki: CheckWiki;
}

export interface RuleMatch {
  quote: string;
  entryId: string;
  rail: string;
  noteText: string;
  suggestedValue?: string;
}

export interface Rule {
  id: string;
  factKey: string;
  extract: RegExp;
  compare: (match: RegExpMatchArray, ctx: RuleContext) => RuleMatch | null;
}

function entryById(wiki: CheckWiki, id: string): WikiEntry | undefined {
  return wiki.entries.find((e) => e.id === id);
}

function factValue(
  wiki: CheckWiki,
  entryId: string,
  factKey: string,
): string | undefined {
  return entryById(wiki, entryId)
    ?.facts.find((f) => f.key === factKey)
    ?.value;
}

const attributeMismatch: Rule = {
  id: 'attribute-mismatch',
  factKey: 'Eyes',
  extract: /\b([a-z]+)\s+eyes\b/i,
  compare: (match, ctx) => {
    const asserted = match[1]!;
    if (normalize(asserted) === normalize(ctx.recordedValue)) return null;

    const idx = match.index ?? ctx.sentence.indexOf(match[0]);
    const before = ctx.sentence.slice(0, idx);
    const lead = before.match(/((?:\b(?:her|his|their|its|my|your|own)\b\s+)+)$/i);
    const quote = (lead ? lead[1] : '') + match[0];

    return {
      quote: quote.trim(),
      entryId: ctx.entry.id,
      suggestedValue: capitalize(asserted),
      rail: `${ctx.entry.name} · Eyes: ${ctx.recordedValue.toLowerCase()}.`,
      noteText: `${ctx.entry.name} records ${ctx.recordedValue.toLowerCase()} eyes, set in Chapter 1. This sentence gives them as ${asserted.toLowerCase()}.`,
    };
  },
};

const NUMBER_WORD_ALT =
  'zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty(?:-one|-two)?|thirty|forty|fifty|sixty(?:-one)?';

const constraintViolation: Rule = {
  id: 'constraint-violation',
  factKey: 'Age',
  extract: new RegExp(`\\b(${NUMBER_WORD_ALT})\\b.{0,12}\\bsworn\\b`, 'i'),
  compare: (match, ctx) => {
    const assertedNumber = match[1]!;

    const oathEntry = ctx.wiki.entries.find((e) => e.name === 'The Lantern Oath');
    const constraint = oathEntry
      ? factValue(ctx.wiki, oathEntry.id, 'Sworn at')
      : undefined;
    if (!constraint) return null;

    if (normalize(assertedNumber) === normalize(constraint)) return null;

    if (normalize(assertedNumber) !== normalize(ctx.recordedValue)) return null;

    return {
      quote: match[0].trim(),
      entryId: ctx.entry.id,
      rail: `${oathEntry!.name} is sworn at ${constraint.toLowerCase()}.`,
      noteText: `Your wiki says the ${oathEntry!.name} is sworn at ${constraint.toLowerCase()}, at the turn of the year, and has no provision for swearing early. This sentence has her sworn at ${assertedNumber.toLowerCase()}.`,
    };
  },
};

const MEMBER_NUMBER_WORD =
  'zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty(?:-(?:one|two|three|four|five|six|seven|eight|nine))?|thirty(?:-(?:one|two|three|four|five|six|seven|eight|nine))?|forty|fifty|sixty';

function leadingNumberWord(value: string): string | null {
  const m = value.match(new RegExp(`\\b(${MEMBER_NUMBER_WORD})\\b`, 'i'));
  return m ? m[1]! : null;
}

const memberCount: Rule = {
  id: 'member-count',
  factKey: 'Members',
  extract: new RegExp(`\\b(${MEMBER_NUMBER_WORD})\\s+members?\\b`, 'i'),
  compare: (match, ctx) => {
    const asserted = match[1]!;
    const recorded = leadingNumberWord(ctx.recordedValue);
    if (!recorded) return null;

    if (normalize(asserted) === normalize(recorded)) return null;

    return {
      quote: match[0].trim(),
      entryId: ctx.entry.id,
      suggestedValue: capitalize(asserted),
      rail: `${ctx.entry.name} · Members: ${ctx.recordedValue.toLowerCase()}.`,
      noteText: `Your wiki records ${ctx.entry.name} as ${ctx.recordedValue.toLowerCase()}. This sentence puts the count at ${asserted.toLowerCase()}.`,
    };
  },
};

export const rules: Rule[] = [attributeMismatch, constraintViolation, memberCount];
