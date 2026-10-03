import type { Dispatch } from "react";
import type { ActionResult } from "@/domain/result";
import type { Shelf, WikiSuggestion } from "@/domain/types";
import type { WikiAction, WikiState } from "@/features/wiki/state";

export type WikiIntent =
  | { type: "entry.move"; entryId: string; toShelf: Shelf; beforeId: string | null }
  | { type: "entry.create"; shelf: Shelf; categoryId?: string }
  | { type: "entry.edit"; entryId: string; field: "name" | "summary" | "note"; value: string }
  | { type: "entry.delete"; entryId: string }
  | { type: "fact.move"; factId: string; fromEntryId: string; toEntryId: string }
  | { type: "fact.create"; entryId: string; key: string; value: string }
  | { type: "fact.edit"; entryId: string; factId: string; field: "key" | "value"; value: string }
  | { type: "fact.delete"; entryId: string; factId: string }
  | { type: "tie.link"; toEntryId: string; rel?: string }
  | { type: "tie.untie"; tieId: string }
  | { type: "tie.createEntry"; name: string; rel?: string }
  | { type: "suggestion.write"; suggestion: WikiSuggestion }
  | { type: "suggestion.dismiss"; suggestionKey: string }
  | { type: "category.create"; id: string; label: string }
  | { type: "category.rename"; categoryId: string; label: string }
  | { type: "category.reset"; categoryId: string }
  | { type: "category.delete"; categoryId: string };

export type IntentOf<Noun extends string> = Extract<WikiIntent, { type: `${Noun}.${string}` }>;

export interface CommitContext {
  /** The store as it was when the intent was committed. */
  state: WikiState;
  worldId: string;
  /**
   * The write-through: applies the optimistic action and fires its server call
   * together. Both carry the same client-minted id, so the row on screen and
   * the row in the database are the same row.
   */
  write(action: WikiAction, label: string, call: Promise<ActionResult<unknown>>): void;
  dispatch: Dispatch<WikiAction>;
  surfaceError(error: string): void;
}

// crypto.randomUUID only exists in secure contexts (https or localhost).
export function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export const LINKED_REL = "linked";
