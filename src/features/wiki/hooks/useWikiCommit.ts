"use client";

// =============================================================================
// The wiki write-through — ONE module (T-DEEP-1).
//
// WHY: every gazetteer mutation used to be TWO calls the caller had to keep in
// agreement — an optimistic `dispatch(WikiAction)` and a matching Server Action
// — plus four facts the caller had to supply correctly per call site:
//
//   1. WHO OWNS THE ID. `createEntry` took a client id; `createFact` took an
//      optional one nobody passed; `linkEntry` / `createEntryTied` /
//      `addSuggestionAsFact` minted their own server-side and returned ids the
//      caller discarded. So the session row and the persisted row could carry
//      DIFFERENT ids, and a later delete/untie on the session id hit 0 rows and
//      still reported `ok: true` — the fact left the screen and stayed in the
//      database. That was live in four places.
//   2. `sortOrder`, computed by the caller from `entry.facts.length` /
//      `state.order[shelf].length` — i.e. from state the caller had to hold.
//   3. `confirmed: true`, the product-rule-1 flag, spelled at each write site.
//   4. The error `label` string, and the reducer-action ↔ server-action pairing.
//
// This module hides all four. A caller now states an INTENT in the domain's own
// nouns — "add a fact to this entry", "untie this tie", "delete this category" —
// and learns nothing about ids, ordering, confirmation, or the two-call ritual.
// Id ownership is settled in exactly one place: the client mints, dispatches,
// and sends THE SAME id, so the session and the database always agree.
//
// The store, the server actions, and the error sink are composed INSIDE. The
// only thing that crosses the seam is `commit(intent)`.
// =============================================================================

import { useCallback, useEffect, useRef, startTransition } from "react";
import type { Dispatch } from "react";
import { useServerAction, clientErr } from "@/components/hooks/useServerAction";
import type { ActionResult } from "@/lib/actions/confirmation";
import type { Kind, Shelf } from "@/lib/domain/types";
import { KIND_FOR_SHELF, KIND_LABEL } from "@/lib/domain/types";
import type { WikiAction, WikiState, WikiSuggestion } from "@/lib/state/wikiStore";
import { defaultCategoryShelf } from "@/lib/wiki/categoryLabels";
import { kindForNewEntry } from "../lib/createEntryKind";
import {
  addSuggestionAsFact,
  createCategory,
  createEntry,
  createEntryTied,
  createFact,
  deleteCategory,
  deleteFact,
  dismissSuggestion,
  editEntry,
  editFact,
  linkEntry,
  moveEntry,
  moveFact,
  renameCategory,
  resetCategoryLabel,
  softDeleteEntry,
  untie,
} from "@/lib/actions/wiki";

/** Relationship label for a tie the writer drew without naming one. */
const LINKED_REL = "linked";

/**
 * One writer action against the gazetteer, in the domain's nouns.
 *
 * Deliberately absent from every arm: entry/fact/tie ids the module mints,
 * `sortOrder`, `confirmed`, `worldId`, and the focused entry (ties hang off
 * whatever is selected — the module reads that from the store).
 */
export type WikiIntent =
  // ---- Arrangement (moves recorded knowledge, writes none) ----
  | { type: "entry.move"; entryId: string; toShelf: Shelf; beforeId: string | null }
  | { type: "fact.move"; factId: string; fromEntryId: string; toEntryId: string }
  // ---- Entries ----
  | { type: "entry.create"; shelf: Shelf; categoryId?: string }
  | { type: "entry.edit"; entryId: string; field: "name" | "summary" | "note"; value: string }
  | { type: "entry.delete"; entryId: string }
  // ---- Facts ----
  | { type: "fact.create"; entryId: string; key: string; value: string }
  | { type: "fact.edit"; entryId: string; factId: string; field: "key" | "value"; value: string }
  | { type: "fact.delete"; entryId: string; factId: string }
  // ---- Ties (always on the focused entry) ----
  | { type: "tie.link"; toEntryId: string; rel?: string }
  | { type: "tie.untie"; tieId: string }
  | { type: "tie.createEntry"; name: string; rel?: string }
  // ---- Poster-band suggestions ----
  | { type: "suggestion.write"; suggestion: WikiSuggestion }
  | { type: "suggestion.dismiss"; suggestionKey: string }
  // ---- Categories ----
  | { type: "category.create"; id: string; label: string }
  | { type: "category.rename"; categoryId: string; label: string }
  | { type: "category.reset"; categoryId: string }
  | { type: "category.delete"; categoryId: string };

/** The whole write-through, as one call. Fire-and-forget; failures surface. */
export type WikiCommit = (intent: WikiIntent) => void;

function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/**
 * Build the gazetteer's write-through for a session.
 *
 * @param state    the live store — read for append positions and the focused
 *                 entry, held behind a ref so `commit` stays referentially
 *                 stable across renders (child props don't churn).
 * @param dispatch the store's dispatch; every intent's optimistic action goes here.
 * @param worldId  the active world every created entry is linked into.
 */
export function useWikiCommit(args: {
  state: WikiState;
  dispatch: Dispatch<WikiAction>;
  worldId: string;
}): WikiCommit {
  const { state, dispatch, worldId } = args;

  // Latest-ref: commit reads the CURRENT store when it fires, not the store as
  // of the render that created it, so its identity never changes. Synced in an
  // effect (refs must not be written during render); every intent originates
  // from an event handler, which runs after the effect has landed.
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const surfaceError = useCallback(
    (error: string) => dispatch({ type: "SET_ERROR", error }),
    [dispatch],
  );
  const { run } = useServerAction(surfaceError);

  return useCallback(
    (intent: WikiIntent) => {
      const s = stateRef.current;
      /** Optimistic reducer action + its paired persist, as one step. */
      const write = (
        action: WikiAction,
        label: string,
        call: Promise<ActionResult<unknown>>,
      ) => {
        dispatch(action);
        run(call, { label });
      };
      /** Append position among an entry's facts. */
      const nextFactOrder = (entryId: string) => s.byId[entryId]?.facts.length ?? 0;

      switch (intent.type) {
        // ---- Arrangement -----------------------------------------------
        case "entry.move": {
          const entry = s.byId[intent.entryId];
          if (!entry) return;
          if (intent.entryId === intent.beforeId) return; // dropped on itself
          const fromShelf = entry.shelf as Shelf;

          // The resulting orders, derived the same way the reducer derives them,
          // so the persisted arrangement equals what the screen now shows. This
          // duplication used to live in the caller.
          const without = (shelf: Shelf) =>
            s.order[shelf].filter((id) => id !== intent.entryId);
          const toOrder = without(intent.toShelf);
          const at = intent.beforeId ? toOrder.indexOf(intent.beforeId) : -1;
          if (at >= 0) toOrder.splice(at, 0, intent.entryId);
          else toOrder.push(intent.entryId);
          const fromOrder = fromShelf === intent.toShelf ? toOrder : without(fromShelf);

          return write(
            {
              type: "MOVE_ENTRY",
              entryId: intent.entryId,
              toShelf: intent.toShelf,
              beforeId: intent.beforeId,
            },
            "moveEntry",
            moveEntry({
              entryId: intent.entryId,
              toShelf: intent.toShelf,
              toShelfOrder: toOrder,
              fromShelf,
              fromShelfOrder: fromOrder,
            }),
          );
        }

        case "fact.move": {
          if (intent.fromEntryId === intent.toEntryId) return;
          if (!s.byId[intent.toEntryId]) return;
          return write(
            {
              type: "MOVE_FACT",
              factId: intent.factId,
              fromEntryId: intent.fromEntryId,
              toEntryId: intent.toEntryId,
            },
            "moveFact",
            moveFact({
              factId: intent.factId,
              toEntryId: intent.toEntryId,
              sortOrder: nextFactOrder(intent.toEntryId),
            }),
          );
        }

        // ---- Entries ----------------------------------------------------
        case "entry.create": {
          const kind = kindForNewEntry(intent.shelf, intent.categoryId);
          const name = `New ${KIND_LABEL[
            KIND_FOR_SHELF[intent.shelf]
          ].toLowerCase()}`;
          const entryId = newId();
          const sortOrder = s.order[intent.shelf].length;
          return write(
            {
              type: "CREATE_ENTRY",
              entryId,
              kind,
              shelf: intent.shelf,
              name,
              note: "",
              summary: "",
              sortOrder,
            },
            "createEntry",
            createEntry({ id: entryId, kind, shelf: intent.shelf, name, worldId }),
          );
        }

        case "entry.edit":
          return write(
            { type: "EDIT_ENTRY_FIELDS", entryId: intent.entryId, [intent.field]: intent.value },
            "editEntry",
            editEntry({ entryId: intent.entryId, [intent.field]: intent.value }),
          );

        case "entry.delete":
          return write(
            { type: "SOFT_DELETE_ENTRY", entryId: intent.entryId },
            "softDeleteEntry",
            softDeleteEntry({ id: intent.entryId }),
          );

        // ---- Facts ------------------------------------------------------
        case "fact.create": {
          if (!s.byId[intent.entryId]) return;
          const factId = newId();
          const sortOrder = nextFactOrder(intent.entryId);
          return write(
            {
              type: "CREATE_FACT",
              entryId: intent.entryId,
              factId,
              key: intent.key,
              value: intent.value,
              sortOrder,
            },
            "createFact",
            // `id` is the same one the reducer just used — without it the server
            // would mint its own and the later delete would hit 0 rows.
            createFact({
              id: factId,
              entryId: intent.entryId,
              key: intent.key,
              value: intent.value,
              sortOrder,
            }),
          );
        }

        case "fact.edit":
          return write(
            {
              type: "EDIT_FACT",
              entryId: intent.entryId,
              factId: intent.factId,
              [intent.field]: intent.value,
            },
            "editFact",
            editFact({ factId: intent.factId, [intent.field]: intent.value }),
          );

        case "fact.delete":
          return write(
            { type: "DELETE_FACT", entryId: intent.entryId, factId: intent.factId },
            "deleteFact",
            deleteFact({ factId: intent.factId }),
          );

        // ---- Ties -------------------------------------------------------
        case "tie.link": {
          const selected = s.selectedEntryId ? s.byId[s.selectedEntryId] : undefined;
          if (!selected || intent.toEntryId === selected.id) return;
          const tieId = newId();
          const rel = intent.rel?.trim() || LINKED_REL;
          return write(
            {
              type: "LINK_ENTRY",
              tieId,
              fromEntryId: selected.id,
              toEntryId: intent.toEntryId,
              rel,
            },
            "linkEntry",
            // Same id as the reducer's — without it `tie.untie` would delete 0 rows.
            linkEntry({
              id: tieId,
              fromEntryId: selected.id,
              toEntryId: intent.toEntryId,
              rel,
            }),
          );
        }

        case "tie.untie": {
          const selected = s.selectedEntryId ? s.byId[s.selectedEntryId] : undefined;
          if (!selected) return;
          return write(
            { type: "UNTIE", fromEntryId: selected.id, tieId: intent.tieId },
            "untie",
            untie({ tieId: intent.tieId }),
          );
        }

        case "tie.createEntry": {
          const selected = s.selectedEntryId ? s.byId[s.selectedEntryId] : undefined;
          if (!selected) return;
          const name = intent.name.trim();
          if (!name) return;
          const shelf = selected.shelf as Shelf;
          const kind: Kind = KIND_FOR_SHELF[shelf];
          const entryId = newId();
          const tieId = newId();
          const rel = intent.rel?.trim() || LINKED_REL;
          return write(
            {
              type: "CREATE_TIED",
              entryId,
              tieId,
              kind,
              shelf,
              name,
              toEntryId: selected.id,
              rel,
            },
            "createEntryTied",
            createEntryTied({
              entryId,
              tieId,
              name,
              kind,
              shelf,
              toEntryId: selected.id,
              rel,
              confirmed: true,
              worldId,
            }),
          );
        }

        // ---- Poster-band suggestions ------------------------------------
        case "suggestion.write": {
          const sug = intent.suggestion;
          const entry =
            s.byId[sug.entryId] ??
            (s.selectedEntryId ? s.byId[s.selectedEntryId] : undefined);
          if (!entry) return;
          const factId = newId();
          const sortOrder = entry.facts.length;
          return write(
            {
              type: "ADD_SUGGESTION_AS_FACT",
              suggestionKey: sug.suggestionKey,
              entryId: entry.id,
              factId,
              key: sug.key,
              value: sug.value,
              sortOrder,
            },
            "addSuggestionAsFact",
            addSuggestionAsFact({
              factId,
              suggestionKey: sug.suggestionKey,
              entryId: entry.id,
              key: sug.key,
              value: sug.value,
              sortOrder,
              confirmed: true,
            }),
          );
        }

        case "suggestion.dismiss":
          return write(
            { type: "DISMISS_SUGGESTION", suggestionKey: intent.suggestionKey },
            "dismissSuggestion",
            dismissSuggestion(intent.suggestionKey),
          );

        // ---- Categories --------------------------------------------------
        case "category.create": {
          const label = intent.label.trim();
          if (label === "") return;
          // The one SERVER-FIRST write: the reducer needs the created row, so the
          // optimistic action cannot be formed until the action returns. `id` is
          // minted once per form-open by the caller and the INSERT is ON CONFLICT
          // (id) DO NOTHING, so a double-fired transition writes exactly one row.
          startTransition(() => {
            createCategory({ id: intent.id, label, shelf: defaultCategoryShelf() })
              .then((res) => {
                if (res.ok) dispatch({ type: "CREATE_CATEGORY", category: res.data });
                else surfaceError(res.error);
              })
              .catch((err: unknown) => {
                surfaceError(`createCategory: ${clientErr(err)}`);
              });
          });
          return;
        }

        case "category.rename":
          return write(
            { type: "RENAME_CATEGORY", kind: intent.categoryId, label: intent.label },
            "renameCategory",
            renameCategory({ kind: intent.categoryId, label: intent.label }),
          );

        case "category.reset":
          return write(
            { type: "RESET_CATEGORY", kind: intent.categoryId },
            "resetCategoryLabel",
            resetCategoryLabel({ kind: intent.categoryId }),
          );

        case "category.delete":
          return write(
            { type: "DELETE_CATEGORY", kind: intent.categoryId },
            "deleteCategory",
            deleteCategory({ kind: intent.categoryId, confirmed: true }),
          );
      }
    },
    [dispatch, run, surfaceError, worldId],
  );
}
