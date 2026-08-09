/**
 * Pass B — unrecorded detection (HANDOFF §7).
 *
 * §7 frames this as "an unmatched-proper-noun pass", but its own two target
 * phrases — "her mother’s brass ring" and "the tallow rule" — are lowercase, so
 * a proper-noun pass alone finds neither. §7 then suggests two shapes with a
 * "recurring ≥2×" filter. THAT FILTER IS INCONSISTENT WITH THE SEED DATA AND THE
 * ACCEPTANCE TEST: both phrases occur exactly once in the seeded Chapter 7, yet
 * engine.test.ts requires both to surface. The test is the contract, so ≥2× is
 * NOT used. (Flagged in the handoff report.)
 *
 * A determiner/possessive pass that flags EVERY 2–4 token noun phrase produces
 * ~13 false positives here ("the low water", "the sun", "her coat", …). The
 * signal that actually separates the two targets — and that the contract needs,
 * since every mark carries an `entryId` — is that each phrase is *unrecorded
 * detail about a KNOWN wiki entity*:
 *
 *   U1  possessed heirloom:  <poss-pron> <noun>’s <noun…>   → anchors to the
 *       character the pronoun refers to (e.g. "her mother’s brass ring" → maren).
 *       A bare "her coat" (no nested ’s) is not a named object and is skipped.
 *
 *   U2  named designator:    the <T> <designator>           → where T is a token
 *       already recorded on some entry E and <designator> ∈ {rule, oath, law,
 *       pact, …}. "the tallow rule": "tallow" is recorded on vergelight, but the
 *       *rule* is not → anchors to vergelight. "the Verge Light" is rejected by
 *       the lexicon (it is a recorded entry name).
 *
 * Both shapes are the spec's `<poss> <noun> <noun>` and `the <adj>? <noun>`
 * forms, tightened to their entity-anchored core. The rail / note / actions are
 * generated; nothing about the two marks is hardcoded.
 */

import type { Mark, MarkAction, MarkImportance, WikiEntry, WikiSnapshot } from './index';
import type { Lexicon } from './lexicon';
import { buildLexicon } from './lexicon';
import { normalize, normalizeQuote } from './normalize';
import { sha1 } from './hash';
import { occurrenceIndexOf } from './text';

const MISSING_ACTIONS: MarkAction[] = [
  { id: 'add', label: 'Add to the wiki' },
  { id: 'edit', label: 'Add, but let me word it' },
  { id: 'leave', label: 'Not now' },
];

// Nouns that turn "the <recorded-token> X" into a named rule/lore designator.
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

// Possessive pronouns that anchor a possessed object to a character.
const POSS_PRONOUNS: Record<string, 'female' | 'male' | 'any'> = {
  her: 'female',
  his: 'male',
  their: 'any',
  its: 'any',
  my: 'any',
  your: 'any',
};

// Words that must never be part of a possessed-object phrase. A conjunction or
// preposition here means the regex has run past the object into the next clause
// (e.g. "her mother's coat AND did not cry" → the object is "coat", not
// "coat and"). We stop the object at the first such word.
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

/**
 * Decide whether the object of a possessive ("her mother's <object>") is a
 * *named heirloom* worth flagging, and return its clean phrase. The importance
 * signal, the same one the module header describes, is that a genuine artifact
 * is QUALIFIED, a modifier plus a noun ("brass ring", "silver knife"), not a
 * bare common noun ("coat", "hands"). A bare noun after the possessive is an
 * incidental prop, so it is skipped rather than treated as gazetteer-worthy.
 *
 * Returns the trimmed object tokens (still excluding any trailing stop word), or
 * null when the object is a bare noun / begins with a stop word.
 */
function qualifiedObject(rawObject: string): string[] | null {
  const tokens = rawObject.trim().split(/\s+/).filter(Boolean);
  const kept: string[] = [];
  for (const tok of tokens) {
    if (OBJECT_STOP_WORDS.has(normalize(tok))) break; // ran into the next clause
    kept.push(tok);
  }
  // A named object needs a qualifier + noun (>= 2 content tokens). A single bare
  // noun ("coat") is an incidental prop, not a gazetteer entity.
  if (kept.length < 2) return null;
  return kept;
}

interface Candidate {
  quote: string;
  paragraphIndex: number;
  entryId: string;
}

/** Index every recorded content token → the entry that records it. */
function buildTokenOwners(wiki: WikiSnapshot): Map<string, WikiEntry> {
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

/** The character entity a possessive pronoun most plausibly refers to. */
function resolvePronounEntity(
  characters: { entry: WikiEntry; firstNameRe: RegExp }[],
  seenBefore: string,
): WikiEntry | undefined {
  // Prefer a character whose name appears earlier in the manuscript window.
  for (const { entry, firstNameRe } of characters) {
    if (firstNameRe.test(seenBefore)) return entry;
  }
  return characters[0]?.entry;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const U1 = /\b(her|his|their|its|my|your)\s+([\p{L}]+(?:’s|'s))\s+([\p{L}]+(?:\s+[\p{L}]+)?)/giu;
// Anchor on the <designator> and capture the preceding recorded token, so an
// earlier "the … the" cannot consume the article and hide the match.
const U2 = /\b(the)\s+([\p{L}]+)\s+(rule|oath|law|pact|rite|creed|code|watch|ledger)\b/giu;

export function findUnrecorded(
  paragraphs: string[],
  wiki: WikiSnapshot,
  lexicon: Lexicon = buildLexicon(wiki),
  chapterCounts?: ReadonlyMap<string, number>,
): Mark[] {
  const tokenOwners = buildTokenOwners(wiki);
  // Precompute each character's first-name matcher once (was rebuilt per U1 match).
  const characters = wiki.entries
    .filter((e) => e.kind === 'character')
    .map((entry) => {
      const first = entry.name.split(/\s+/)[0] ?? entry.name;
      return { entry, firstNameRe: new RegExp(`\\b${escapeRegExp(first)}\\b`, 'i') };
    });
  const candidates: Candidate[] = [];
  const running: string[] = []; // manuscript seen so far (for pronoun resolution)

  paragraphs.forEach((paragraph, paragraphIndex) => {
    // U1 — possessed heirloom.
    for (const m of paragraph.matchAll(U1)) {
      const pron = m[1]!.toLowerCase();
      if (!(pron in POSS_PRONOUNS)) continue;
      // The object must be a qualified artifact (modifier + noun), and any
      // trailing conjunction that the regex grabbed ("coat and") is stripped.
      const objectTokens = qualifiedObject(m[3] ?? '');
      if (!objectTokens) continue; // bare noun / ran into the next clause
      // Rebuild the quote from the possessive prefix + cleaned object so the
      // underline never spans a conjunction or the following clause.
      const quote = `${m[1]} ${m[2]} ${objectTokens.join(' ')}`;
      const before = running.join(' ') + ' ' + paragraph.slice(0, m.index ?? 0);
      const entity = resolvePronounEntity(characters, before);
      if (!entity) continue;
      candidates.push({ quote, paragraphIndex, entryId: entity.id });
    }

    // U2 — named designator anchored to a recorded token.
    for (const m of paragraph.matchAll(U2)) {
      const t = normalize(m[2] ?? '');
      const designator = (m[3] ?? '').toLowerCase();
      if (!DESIGNATORS.has(designator)) continue;
      const owner = tokenOwners.get(t);
      if (!owner) continue; // token isn't recorded → not "detail about a known entity"
      candidates.push({
        quote: m[0].trim(),
        paragraphIndex,
        entryId: owner.id,
      });
    }

    running.push(paragraph);
  });

  const marks: Mark[] = [];
  const seen = new Set<string>();

  for (const cand of candidates) {
    if (lexicon.has(cand.quote)) continue; // already written down

    const key = sha1(`unrecorded|${normalizeQuote(cand.quote)}|${cand.entryId}`);
    if (seen.has(key)) continue;
    seen.add(key);

    const paragraph = paragraphs[cand.paragraphIndex]!;
    // Within-chapter recurrence: how many times this exact phrase appears across
    // the whole chapter. A phrase the author leans on (>=2) ranks as important;
    // a single mention still surfaces, it just ranks 'normal'. RANK, never gate.
    const recurrence = countOccurrences(paragraphs, cand.quote);
    // Cross-chapter signal (Tier 2): how many chapters this phrase appears in
    // book-wide. The index keys phrases lowercased (see extractCandidatePhrases),
    // so match that. Undefined map → Tier 1 (within-chapter only).
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
      position: {
        paragraphIndex: cand.paragraphIndex,
        occurrenceIndex: occurrenceIndexOf(paragraph, cand.quote),
      },
      importance,
      recurrence,
    });
  }

  return marks;
}

/** Total occurrences of `quote` across every paragraph of the chapter. */
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

/**
 * Decide a mark's importance from the two recurrence signals. RANK, never gate:
 * a single-mention phrase still surfaces, it just ranks 'normal'.
 *   - within-chapter recurrence >= 2  → the author leans on it here, or
 *   - cross-chapter count      >= 2   → it recurs across the book (Tier 2)
 * either makes it 'high'. `chapterCount` is how many chapters the phrase appears
 * in book-wide (from the phrase_mentions index); undefined when the index is not
 * loaded, which cleanly degrades to Tier 1 (within-chapter only).
 */
function importanceOf(recurrence: number, chapterCount?: number): MarkImportance {
  if (recurrence >= 2) return 'high';
  if ((chapterCount ?? 0) >= 2) return 'high';
  return 'normal';
}

function railFor(quote: string, recurrence = 1): string {
  // A recurring phrase reads as deliberate, so assert it; a single mention is
  // gently offered. Copy stays under one line either way.
  if (recurrence >= 2) {
    return `“${quote}” appears ${recurrence} times but is not written down yet.`;
  }
  return `“${quote}” is not written down in the wiki yet.`;
}
function noteFor(quote: string): string {
  return `“${quote}” appears in the manuscript but nothing in the wiki records it. Add it to the gazetteer?`;
}

/**
 * Canonical key for the book-wide phrase index. Folds the two things that
 * otherwise split one phrase into two rows: letter case, and the curly vs
 * straight apostrophe (U+2019 vs U+0027). Both the extractor that WRITES the
 * index and the engine that READS it must key through here, or a phrase
 * written with one apostrophe never matches the same phrase read with the
 * other.
 */
export function phraseIndexKey(phrase: string): string {
  return phrase
    .toLowerCase()
    .replace(/\u2019/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Extract candidate phrases from a chapter's plain text, WITHOUT any wiki
 * lookup, for the book-wide `phrase_mentions` index (Tier 2 cross-chapter
 * recurrence). Uses the same U1 (qualified possessed object) and U2 (named
 * designator) SHAPES the live engine uses, so a phrase indexed here is the same
 * phrase the engine would flag. Returns each phrase mapped to how many times it
 * occurs in this chapter.
 *
 * Wiki-independent on purpose: the index records that a phrase RECURS across
 * chapters even before it is anchored to a wiki entity, which is exactly the
 * signal we want (a phrase the author leans on, recorded or not).
 */
export function extractCandidatePhrases(paragraphs: string[]): Map<string, number> {
  // Canonical (lowercased) phrase set so "Her ring" and "her ring" are one key.
  const phrases = new Set<string>();

  for (const paragraph of paragraphs) {
    // U1 — qualified possessed object ("her mother's brass ring").
    for (const m of paragraph.matchAll(U1)) {
      const pron = m[1]!.toLowerCase();
      if (!(pron in POSS_PRONOUNS)) continue;
      const objectTokens = qualifiedObject(m[3] ?? '');
      if (!objectTokens) continue;
      phrases.add(phraseIndexKey(`${m[1]} ${m[2]} ${objectTokens.join(' ')}`));
    }
    // U2 — named designator ("the tallow rule"). Shape-only; the engine's
    // wiki-owner check anchors it, but the phrase itself is index-worthy.
    for (const m of paragraph.matchAll(U2)) {
      const designator = (m[3] ?? '').toLowerCase();
      if (!DESIGNATORS.has(designator)) continue;
      phrases.add(phraseIndexKey(m[0]));
    }
  }

  // Count occurrences of each distinct phrase across the whole chapter. The
  // index is case-insensitive: "Her ring" at a sentence start and "her ring"
  // mid-sentence are the SAME phrase for recurrence, so a capitalized repeat
  // still counts. (The live within-chapter count stays case-exact because it
  // anchors a specific underline; this index only needs the tally.)
  const lowerParagraphs = paragraphs.map((p) => phraseIndexKey(p));
  const counts = new Map<string, number>();
  for (const phrase of phrases) {
    counts.set(phrase, countOccurrences(lowerParagraphs, phrase));
  }
  return counts;
}
