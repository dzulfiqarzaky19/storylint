import type { Mark, MarkAction, MarkImportance, WikiEntry, CheckWiki } from './index';
import type { Lexicon } from './lexicon';
import { buildLexicon } from './lexicon';
import { normalize, normalizeQuote } from './normalize';
import { sha1 } from './hash';
import { occurrenceIndexOf } from './text';

const MISSING_ACTIONS: MarkAction[] = [
  { id: 'add', label: 'Add to the wiki' },
  { id: 'edit', label: 'Ask AI' },
  { id: 'leave', label: 'Remove suggestion' },
];

const DESIGNATORS = new Set([
  'rule',
  'oath',
  'law',
  'pact',
  'rite',
  'creed',
  'code',
  'watch',
  'ledger',
]);

const POSS_PRONOUNS: Record<string, 'female' | 'male' | 'any'> = {
  her: 'female',
  his: 'male',
  their: 'any',
  its: 'any',
  my: 'any',
  your: 'any',
};

const OBJECT_STOP_WORDS = new Set([
  'and',
  'or',
  'but',
  'nor',
  'so',
  'yet',
  'of',
  'in',
  'on',
  'at',
  'to',
  'with',
  'for',
  'from',
  'by',
  'as',
  'that',
  'which',
  'who',
  'did',
  'was',
  'is',
  'were',
  'are',
]);

function qualifiedObject(rawObject: string): string[] | null {
  const tokens = rawObject.trim().split(/\s+/).filter(Boolean);
  const kept: string[] = [];
  for (const tok of tokens) {
    if (OBJECT_STOP_WORDS.has(normalize(tok))) break;
    kept.push(tok);
  }
  if (kept.length < 2) return null;
  return kept;
}

interface Candidate {
  quote: string;
  paragraphIndex: number;
  // Offset of the match inside its paragraph.
  at: number;
  entryId: string;
}

function buildTokenOwners(wiki: CheckWiki): Map<string, WikiEntry> {
  const owners = new Map<string, WikiEntry>();
  const add = (raw: string, entry: WikiEntry) => {
    for (const w of raw.split(/[^\p{L}\p{N}]+/u)) {
      const n = normalize(w);
      if (n.length >= 3 && !owners.has(n)) owners.set(n, entry);
    }
  };
  for (const entry of wiki.entries) {
    add(entry.name, entry);
    if (entry.note) add(entry.note, entry);
    for (const fact of entry.facts) add(fact.value, entry);
  }
  return owners;
}

function resolvePronounEntity(
  characters: { entry: WikiEntry; firstNameRe: RegExp }[],
  seenBefore: string,
): WikiEntry | undefined {
  for (const { entry, firstNameRe } of characters) {
    if (firstNameRe.test(seenBefore)) return entry;
  }
  return characters[0]?.entry;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const U1 = /\b(her|his|their|its|my|your)\s+([\p{L}]+(?:’s|'s))\s+([\p{L}]+(?:\s+[\p{L}]+)?)/giu;
const U2 = /\b(the)\s+([\p{L}]+)\s+(rule|oath|law|pact|rite|creed|code|watch|ledger)\b/giu;

export function findUnrecorded(
  paragraphs: string[],
  wiki: CheckWiki,
  lexicon: Lexicon = buildLexicon(wiki),
  chapterCounts?: ReadonlyMap<string, number>,
): Mark[] {
  const tokenOwners = buildTokenOwners(wiki);
  const characters = wiki.entries
    .filter((e) => e.kind === 'character')
    .map((entry) => {
      const first = entry.name.split(/\s+/)[0] ?? entry.name;
      return { entry, firstNameRe: new RegExp(`\\b${escapeRegExp(first)}\\b`, 'i') };
    });
  const candidates: Candidate[] = [];
  const running: string[] = [];

  paragraphs.forEach((paragraph, paragraphIndex) => {
    for (const m of paragraph.matchAll(U1)) {
      const pron = m[1]!.toLowerCase();
      if (!(pron in POSS_PRONOUNS)) continue;
      const objectTokens = qualifiedObject(m[3] ?? '');
      if (!objectTokens) continue;
      const quote = `${m[1]} ${m[2]} ${objectTokens.join(' ')}`;
      const before = running.join(' ') + ' ' + paragraph.slice(0, m.index ?? 0);
      const entity = resolvePronounEntity(characters, before);
      if (!entity) continue;
      candidates.push({ quote, paragraphIndex, at: m.index ?? 0, entryId: entity.id });
    }

    for (const m of paragraph.matchAll(U2)) {
      const t = normalize(m[2] ?? '');
      const designator = (m[3] ?? '').toLowerCase();
      if (!DESIGNATORS.has(designator)) continue;
      const owner = tokenOwners.get(t);
      if (!owner) continue;
      candidates.push({
        quote: m[0].trim(),
        paragraphIndex,
        at: m.index ?? 0,
        entryId: owner.id,
      });
    }

    running.push(paragraph);
  });

  const marks: Mark[] = [];
  const seen = new Set<string>();

  for (const cand of candidates) {
    if (lexicon.has(cand.quote)) continue;

    const key = sha1(`unrecorded|${normalizeQuote(cand.quote)}|${cand.entryId}`);
    if (seen.has(key)) continue;
    seen.add(key);

    const paragraph = paragraphs[cand.paragraphIndex]!;
    const recurrence = countOccurrences(paragraphs, cand.quote);
    const chapterCount = chapterCounts?.get(phraseIndexKey(cand.quote));
    const importance: MarkImportance = importanceOf(recurrence, chapterCount);
    marks.push({
      markKey: key,
      kind: 'missing',
      ruleId: 'unrecorded',
      quote: cand.quote,
      rail: railFor(cand.quote, recurrence),
      noteText: noteFor(cand.quote),
      actions: MISSING_ACTIONS,
      entityId: cand.entryId || undefined,
      position: {
        paragraphIndex: cand.paragraphIndex,
        occurrenceIndex: occurrenceIndexOf(paragraph, cand.quote, cand.at),
      },
      importance,
      recurrence,
    });
  }

  return marks;
}

function countOccurrences(paragraphs: string[], quote: string): number {
  let total = 0;
  for (const paragraph of paragraphs) {
    let from = 0;
    while (true) {
      const at = paragraph.indexOf(quote, from);
      if (at === -1) break;
      total += 1;
      from = at + quote.length;
    }
  }
  return total;
}

function importanceOf(recurrence: number, chapterCount?: number): MarkImportance {
  if (recurrence >= 2) return 'high';
  if ((chapterCount ?? 0) >= 2) return 'high';
  return 'normal';
}

function railFor(quote: string, recurrence = 1): string {
  if (recurrence >= 2) {
    return `“${quote}” appears ${recurrence} times but is not written down yet.`;
  }
  return `“${quote}” is not written down in the wiki yet.`;
}
function noteFor(quote: string): string {
  return `“${quote}” appears in the manuscript but nothing in the wiki records it. Add it to the gazetteer?`;
}

export function phraseIndexKey(phrase: string): string {
  return phrase
    .toLowerCase()
    .replace(/\u2019/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export function extractCandidatePhrases(paragraphs: string[]): Map<string, number> {
  const phrases = new Set<string>();

  for (const paragraph of paragraphs) {
    for (const m of paragraph.matchAll(U1)) {
      const pron = m[1]!.toLowerCase();
      if (!(pron in POSS_PRONOUNS)) continue;
      const objectTokens = qualifiedObject(m[3] ?? '');
      if (!objectTokens) continue;
      phrases.add(phraseIndexKey(`${m[1]} ${m[2]} ${objectTokens.join(' ')}`));
    }
    for (const m of paragraph.matchAll(U2)) {
      const designator = (m[3] ?? '').toLowerCase();
      if (!DESIGNATORS.has(designator)) continue;
      phrases.add(phraseIndexKey(m[0]));
    }
  }

  const lowerParagraphs = paragraphs.map((p) => phraseIndexKey(p));
  const counts = new Map<string, number>();
  for (const phrase of phrases) {
    counts.set(phrase, countOccurrences(lowerParagraphs, phrase));
  }
  return counts;
}
