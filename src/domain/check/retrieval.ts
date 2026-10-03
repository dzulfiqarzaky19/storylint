import type { EntryWithDetails, WikiSnapshot } from "@/domain/types";
import { normalize } from "../check/normalize";
import { words } from "../check/text";

export interface GazetteerQuery {
  text: string;
  focusEntityIds?: string[];
  maxEntries?: number;
}

export interface GazetteerSelection {
  entries: EntryWithDetails[];
  capRaised: boolean;
}

const DEFAULT_MAX_ENTRIES = 15;

const STOPWORDS = new Set([
  "a", "an", "the", "her", "his", "their", "its", "my", "your", "own",
  "of", "and", "in", "on", "at", "to", "with", "since",
]);

function contentTokens(phrase: string): string[] {
  return words(phrase)
    .map((w) => normalize(w))
    .filter((t) => t.length > 0 && !STOPWORDS.has(t));
}

function matchTier(
  entry: EntryWithDetails,
  normText: string,
  textTokens: Set<string>,
): "exact" | "token" | null {
  const name = normalize(entry.name);
  if (name.length >= 3 && normText.includes(name)) return "exact";

  for (const fact of entry.facts) {
    const v = normalize(fact.value);
    if (v.length >= 3 && normText.includes(v)) return "exact";
    for (const part of fact.value.split(/[,;·]/)) {
      const p = normalize(part);
      if (p.length >= 4 && normText.includes(p)) return "exact";
    }
  }

  const nameTokens = contentTokens(entry.name);
  if (nameTokens.length > 0 && nameTokens.every((t) => textTokens.has(t))) {
    return "token";
  }
  return null;
}

export function selectGazetteer(
  wiki: WikiSnapshot,
  q: GazetteerQuery,
): GazetteerSelection {
  const maxEntries = q.maxEntries ?? DEFAULT_MAX_ENTRIES;
  const focus = new Set(q.focusEntityIds ?? []);

  const normText = normalize(q.text);
  const textTokens = new Set(contentTokens(q.text));

  const pinned = new Set<string>();
  const speculative: { id: string; mentions: number }[] = [];

  for (const entry of wiki.entries) {
    if (focus.has(entry.id)) {
      pinned.add(entry.id);
      continue;
    }
    const tier = matchTier(entry, normText, textTokens);
    if (tier === "exact") {
      pinned.add(entry.id);
    } else if (tier === "token") {
      const hits = contentTokens(entry.name).filter((t) => textTokens.has(t)).length;
      speculative.push({ id: entry.id, mentions: hits });
    }
  }

  const byId = wiki.byId ?? {};
  for (const id of [...pinned]) {
    const entry = byId[id];
    if (!entry) continue;
    for (const tie of entry.ties ?? []) {
      if (byId[tie.toEntryId]) pinned.add(tie.toEntryId);
    }
  }

  speculative.sort((a, b) => b.mentions - a.mentions);

  const capRaised = pinned.size > maxEntries;
  const room = Math.max(0, maxEntries - pinned.size);
  const tailIds = new Set(speculative.slice(0, room).map((s) => s.id));

  const entries = wiki.entries.filter(
    (e) => pinned.has(e.id) || tailIds.has(e.id),
  );

  return { entries, capRaised };
}

export function findRetrievalMisses(
  echoedEntryIds: readonly (string | undefined)[],
  sentEntryIds: readonly string[],
): string[] {
  const sent = new Set(sentEntryIds);
  const misses: string[] = [];
  const seen = new Set<string>();
  for (const raw of echoedEntryIds) {
    const id = (raw ?? "").trim();
    if (!id || sent.has(id) || seen.has(id)) continue;
    seen.add(id);
    misses.push(id);
  }
  return misses;
}
