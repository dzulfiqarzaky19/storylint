/**
 * Test fixtures for the consistency-check engine (HANDOFF §6 seed data + §6 Write
 * manuscript). Built here so engine.test.ts / normalize.test.ts stay readable.
 *
 * Everything below is transcribed VERBATIM from HANDOFF §6, including the curly
 * apostrophes (’) and curly quotes (“ ”). The design is typographically
 * deliberate; do not "straighten" these.
 */

import { createHash } from 'node:crypto';
import type { WikiEntry, WikiSnapshot } from '@/lib/check';

// ---------------------------------------------------------------------------
// Wiki snapshot (subset of §6 relevant to the check engine).
//
// The engine only needs entries + their recorded facts + notes to reproduce
// m1–m4 and s1–s2. Ties/timeline/questions do not participate in the check, so
// they are omitted to keep the fixture legible. The three "deviation" facts on
// `oath` and `saltnames` (HANDOFF §9.1) ARE included — without them m1 (the
// cross-entry constraint) cannot be derived.
// ---------------------------------------------------------------------------

const entries: WikiEntry[] = [
  {
    id: 'maren',
    kind: 'character',
    name: 'Maren Vell',
    note:
      'Lamp-keeper of the Verge Light since her father drowned, and the only person in Kirn who can still read a salt-name. Nineteen, sworn to the Quiet Sept out of season, and not forgiven for it.',
    facts: [
      { id: 'f1', entryId: 'maren', key: 'Age', value: 'Nineteen' },
      { id: 'f2', entryId: 'maren', key: 'Eyes', value: 'Green' },
      {
        id: 'f3',
        entryId: 'maren',
        key: 'Born',
        value: 'Kirn Harbour, the year after the Ebb',
      },
      { id: 'f4', entryId: 'maren', key: 'Keeps', value: 'Verge Light, since Ch. 1' },
      { id: 'f5', entryId: 'maren', key: 'Sworn', value: 'Lantern Oath, Ch. 4' },
    ],
  },
  {
    id: 'vergelight',
    kind: 'world',
    name: 'Verge Light',
    note:
      'The lighthouse at the mouth of Kirn. Burns tallow, not oil, and has never once gone dark on a recorded night.',
    facts: [
      { id: 'i1', entryId: 'vergelight', key: 'Burns', value: 'Tallow' },
      { id: 'i2', entryId: 'vergelight', key: 'Height', value: 'Eleven fathoms' },
    ],
  },
  {
    id: 'sept',
    kind: 'organization',
    name: 'The Quiet Sept',
    note: 'The order that keeps the salt-names. Twenty-one members, never more, never fewer.',
    facts: [{ id: 'j1', entryId: 'sept', key: 'Members', value: 'Twenty-one, never more' }],
  },
  {
    id: 'oath',
    kind: 'lore',
    name: 'The Lantern Oath',
    note:
      'Sworn at twenty-one, at the turn of the year, in front of the light. There is no provision for swearing it early.',
    // §9.1 deviation facts — required for the cross-entry constraint rule (m1).
    facts: [
      { id: 'oath-1', entryId: 'oath', key: 'Sworn at', value: 'Twenty-one' },
      { id: 'oath-2', entryId: 'oath', key: 'When', value: 'Turn of the year' },
    ],
  },
  {
    id: 'saltnames',
    kind: 'lore',
    name: 'Salt-names',
    note:
      'A name the tide writes before the person it belongs to is born. Contested; the Assembly calls it weather.',
    // §9.1 deviation fact.
    facts: [{ id: 'salt-1', entryId: 'saltnames', key: 'Written', value: 'Before birth' }],
  },
];

export const wiki: WikiSnapshot = { entries };

// ---------------------------------------------------------------------------
// Chapter 7 manuscript — verbatim from HANDOFF §6 "Write" section.
//
// The [m…] annotations in the handoff mark the runs the engine must underline;
// they are NOT part of the text and are omitted here. Curly quotes preserved.
//
//   m1 conflict  “nineteen and sworn”
//   m2 missing   “her mother’s brass ring”
//   m3 missing   “the tallow rule”
//   m4 conflict  “Her own grey eyes”
// ---------------------------------------------------------------------------

export const chapter7Paragraphs: string[] = [
  'The Ferrier came in on the low water with the sun still an hour off the roofs. Maren had lit the Verge at four, as she had every night since she was nineteen and sworn.',
  'She kept her mother’s brass ring in her coat and turned it twice, the way the tallow rule said, before she went down to the water.',
  'He looked at her with the flat attention of a man counting what he is owed. Her own grey eyes did not move.',
  'Neither of them said the name. That was the arrangement, and it had been the arrangement since before she was born.',
];

// A consistent manuscript for the negative case: nothing contradicts the wiki,
// and it names nothing the wiki has not already written down. Should yield zero
// marks and zero suggestions.
export const consistentParagraphs: string[] = [
  'Maren had kept the Verge Light since Chapter 1, and it burned tallow the way it always had.',
  'She was nineteen, and the Sept had twenty-one members, never more.',
];

// ---------------------------------------------------------------------------
// Expected marks / suggestions (the exact contract the engine must satisfy).
// ---------------------------------------------------------------------------

export interface ExpectedMark {
  id: string;
  kind: 'conflict' | 'missing';
  quote: string;
  /** The entry the mark is anchored to (used in markKey). */
  entryId: string;
  paragraphIndex: number;
}

export const expectedMarks: ExpectedMark[] = [
  {
    id: 'm1',
    kind: 'conflict',
    quote: 'nineteen and sworn',
    entryId: 'maren',
    paragraphIndex: 0,
  },
  {
    id: 'm2',
    kind: 'missing',
    quote: 'her mother’s brass ring',
    entryId: 'maren',
    paragraphIndex: 1,
  },
  {
    id: 'm3',
    kind: 'missing',
    quote: 'the tallow rule',
    entryId: 'vergelight',
    paragraphIndex: 1,
  },
  {
    id: 'm4',
    kind: 'conflict',
    quote: 'Her own grey eyes',
    entryId: 'maren',
    paragraphIndex: 2,
  },
];

export interface ExpectedSuggestion {
  id: string;
  source: string;
  key: string;
  value: string;
}

export const expectedSuggestions: ExpectedSuggestion[] = [
  { id: 's1', source: 'Chapter 7', key: 'Carries', value: 'Her mother’s brass ring' },
  { id: 's2', source: 'Chapter 7', key: 'Rule', value: 'The tallow rule — no oil in the Verge Light' },
];

// ---------------------------------------------------------------------------
// markKey helper — the documented contract:
//   markKey = sha1(ruleId | normalizedQuote | entryId)
//
// The engine owns `normalize`; here we reproduce the SAME formula so the
// regression test can pre-compute the key it will feed back as resolved. The
// normalized quote for m1 is "nineteen and sworn" lowercased with collapsed
// whitespace (the documented normalization is casing + articles + number-words;
// none of the number-words/articles apply mid-phrase here, so the lower-cased
// form is the stable one). Implementers must match this.
// ---------------------------------------------------------------------------

export function normalizedQuoteForKey(quote: string): string {
  return quote.toLowerCase().replace(/\s+/g, ' ').trim();
}

export function markKeyOf(ruleId: string, quote: string, entryId: string): string {
  const normalizedQuote = normalizedQuoteForKey(quote);
  return createHash('sha1')
    .update(`${ruleId}|${normalizedQuote}|${entryId}`)
    .digest('hex');
}

/** Rule ids the engine must use (HANDOFF §7 Pass A / Pass B). */
export const RULE_IDS = {
  attributeMismatch: 'attribute-mismatch',
  constraintViolation: 'constraint-violation',
  unrecorded: 'unrecorded',
} as const;
