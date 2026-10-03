import { checkManuscript } from "@/domain/check";
import { projectSuggestion } from "@/domain/check/suggestions";
import { toCheckWiki } from "@/domain/write/adapters";
import type { WikiSnapshot } from "./types";
import type { WikiSuggestion } from "@/domain/types";

export interface CheckedWiki {
  suggestions: WikiSuggestion[];
  contradictionEntryIds: string[];
}

export function paragraphsFromBody(body: unknown): string[] {
  if (!body || typeof body !== "object") return [];
  const doc = body as { content?: unknown };
  if (!Array.isArray(doc.content)) return [];
  const out: string[] = [];
  for (const node of doc.content) {
    if (!node || typeof node !== "object") continue;
    const n = node as { type?: string; content?: unknown };
    if (n.type !== "paragraph" || !Array.isArray(n.content)) continue;
    let text = "";
    for (const child of n.content) {
      const c = child as { type?: string; text?: string };
      if (c.type === "text" && typeof c.text === "string") text += c.text;
    }
    out.push(text);
  }
  return out;
}

export function checkWiki(input: {
  snapshot: WikiSnapshot;
  paragraphs: string[];
  dismissedSuggestionKeys: string[];
  resolvedMarkKeys: string[];
}): CheckedWiki {
  const { snapshot, paragraphs, dismissedSuggestionKeys, resolvedMarkKeys } = input;

  const { marks, suggestions } = checkManuscript({
    paragraphs,
    wiki: toCheckWiki(snapshot),
    resolvedMarkKeys,
    dismissedSuggestionKeys,
  });

  const missingMarks = marks.filter((m) => m.kind === "missing");
  const wikiSuggestions: WikiSuggestion[] = suggestions.map((s) => {
    const mark = missingMarks.find((m) => projectSuggestion(m)?.key === s.key);
    return {
      suggestionKey: s.key,
      entryId: mark?.entityId ?? "",
      key: s.key,
      value: s.value,
      text: s.text,
      source: s.source,
    };
  });

  const contradictionEntryIds = Array.from(
    new Set(
      marks
        .filter((m) => m.kind === "conflict")
        .map((m) => m.entityId ?? "")
        .filter((id) => id !== ""),
    ),
  );

  return { suggestions: wikiSuggestions, contradictionEntryIds };
}

export function checkWikiBook(input: {
  snapshot: WikiSnapshot;
  chapters: { number: number; body: unknown }[];
  dismissedSuggestionKeys: string[];
  resolvedMarkKeys: string[];
}): CheckedWiki {
  const { snapshot, chapters, dismissedSuggestionKeys, resolvedMarkKeys } = input;

  const bySuggestionKey = new Map<string, WikiSuggestion>();
  const contradictionIds = new Set<string>();

  const ordered = [...chapters].sort((a, b) => a.number - b.number);

  for (const ch of ordered) {
    const { suggestions, contradictionEntryIds } = checkWiki({
      snapshot,
      paragraphs: paragraphsFromBody(ch.body),
      dismissedSuggestionKeys,
      resolvedMarkKeys,
    });
    for (const s of suggestions) {
      if (bySuggestionKey.has(s.suggestionKey)) continue;
      bySuggestionKey.set(s.suggestionKey, { ...s, source: `Chapter ${ch.number}` });
    }
    for (const id of contradictionEntryIds) contradictionIds.add(id);
  }

  return {
    suggestions: [...bySuggestionKey.values()],
    contradictionEntryIds: [...contradictionIds],
  };
}
