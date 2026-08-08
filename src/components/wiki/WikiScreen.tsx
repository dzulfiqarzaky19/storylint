"use client";

import { useReducer } from "react";
import type { WikiSnapshot, EntryWithDetails } from "@/lib/domain/types";
import EntryBand from "./EntryBand";
import WorldBand from "./WorldBand";
import Shelf from "./Shelf";
import PosterBand from "./PosterBand";
import { SHELF_TITLES, type Shelf as ShelfKey } from "@/lib/domain/types";
import styles from "./WikiScreen.module.css";

// Read-only selection state. No server write for selection (HANDOFF §8 / brief).
interface WikiState {
  selectedId: string;
}

type WikiAction = { type: "select"; id: string };

function reducer(state: WikiState, action: WikiAction): WikiState {
  switch (action.type) {
    case "select":
      return state.selectedId === action.id ? state : { selectedId: action.id };
    default:
      return state;
  }
}

const SHELF_ORDER: ShelfKey[] = ["people", "places", "orders", "lore"];

export default function WikiScreen({ snapshot }: { snapshot: WikiSnapshot }) {
  const entries = snapshot.entries;
  // Default selection is the entry with the lowest persisted sortOrder (the
  // gazetteer's first entry, Maren), independent of the query's shelf ordering.
  const first = entries.reduce<EntryWithDetails | undefined>(
    (lowest, e) => (!lowest || e.sortOrder < lowest.sortOrder ? e : lowest),
    undefined,
  );
  const [state, dispatch] = useReducer(reducer, {
    selectedId: first ? first.id : "",
  });

  const selected: EntryWithDetails | undefined =
    snapshot.byId[state.selectedId] ?? first;

  const select = (id: string) => dispatch({ type: "select", id });

  // Derived: entries grouped per shelf, in persisted sort order.
  const byShelf = new Map<ShelfKey, EntryWithDetails[]>();
  for (const key of SHELF_ORDER) byShelf.set(key, []);
  for (const e of entries) {
    const list = byShelf.get(e.shelf as ShelfKey);
    if (list) list.push(e);
  }
  for (const list of byShelf.values()) {
    list.sort((a, b) => a.sortOrder - b.sortOrder);
  }

  if (!selected) {
    return (
      <main className={styles.body}>
        <p className={styles.empty}>No entries in the gazetteer yet.</p>
      </main>
    );
  }

  return (
    <main className={styles.body}>
      <EntryBand
        entry={selected}
        byId={snapshot.byId}
        onSelect={select}
      />
      <WorldBand entryCount={entries.length} />
      <div className={styles.shelves}>
        {SHELF_ORDER.map((key) => (
          <Shelf
            key={key}
            title={SHELF_TITLES[key]}
            entries={byShelf.get(key) ?? []}
            selectedId={selected.id}
            onSelect={select}
          />
        ))}
      </div>
      {/* Poster band renders only when suggestions exist. Suggestions come from
          the check engine in a later phase, so this is empty for now. */}
      <PosterBand suggestions={[]} />
    </main>
  );
}
