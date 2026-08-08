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

import type { Mark, MarkAction, WikiEntry, WikiSnapshot } from './index';
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
  wiki: WikiSnapshot,
  seenBefore: string,
): WikiEntry | undefined {
  // Prefer a character whose name appears earlier in the manuscript window.
  const characters = wiki.entries.filter((e) => e.kind === 'character');
  for (const entry of characters) {
    const first = entry.name.split(/\s+/)[0] ?? entry.name;
    if (new RegExp(`\\b${escapeRegExp(first)}\\b`, 'i').test(seenBefore)) {
      return entry;
    }
  }
  return characters[0];
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
): Mark[] {
  const tokenOwners = buildTokenOwners(wiki);
  const candidates: Candidate[] = [];
  const running: string[] = []; // manuscript seen so far (for pronoun resolution)

  paragraphs.forEach((paragraph, paragraphIndex) => {
    // U1 — possessed heirloom.
    for (const m of paragraph.matchAll(U1)) {
      const quote = m[0].trim();
      const pron = m[1]!.toLowerCase();
      if (!(pron in POSS_PRONOUNS)) continue;
      const before = running.join(' ') + ' ' + paragraph.slice(0, m.index ?? 0);
      const entity = resolvePronounEntity(wiki, before);
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
    marks.push({
      markKey: key,
      kind: 'missing',
      ruleId: 'unrecorded',
      quote: cand.quote,
      rail: railFor(cand.quote),
      noteText: noteFor(cand.quote),
      actions: MISSING_ACTIONS,
      position: {
        paragraphIndex: cand.paragraphIndex,
        occurrenceIndex: occurrenceIndexOf(paragraph, cand.quote),
      },
    });
  }

  return marks;
}

function railFor(quote: string): string {
  return `“${quote}” is not written down in the wiki yet.`;
}
function noteFor(quote: string): string {
  return `“${quote}” appears in the manuscript but nothing in the wiki records it. Add it to the gazetteer?`;
}
