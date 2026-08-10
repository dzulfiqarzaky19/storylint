"use client";

import { useMemo, useState } from "react";
import type { ResolvedTie } from "@/lib/domain/types";
import { resolveDanglingTies } from "@/lib/wiki/danglingTies";
import { useDrag } from "@/components/dnd/DragContext";
import ConfirmModal from "../ui/ConfirmModal";
import styles from "./TiesBlock.module.css";

/** A candidate the writer can tie the focused entry to (every OTHER live entry). */
export interface TieCandidate {
  id: string;
  name: string;
  kind: string;
}

interface TiesBlockProps {
  ties: ResolvedTie[];
  /** Ids of every LIVE (non-deleted) entry — a tie to anything else is dangling. */
  liveEntryIds: Set<string>;
  /** Every OTHER live entry (excludes the focused one) — the add-tie search pool. */
  tieCandidates: TieCandidate[];
  onSelect: (id: string) => void;
  /** Drop a tile from a shelf here → tie it to the selected entry. */
  onDropOnTies: () => void;
  /**
   * Remove a tie (HARD-delete). Fired ONLY after the writer confirms the danger
   * dialog — the guard lives here in the caller, the modal stays presentational.
   */
  onUntie: (tieId: string) => void;
  /** Tie the focused entry to an EXISTING entry with a writer-set relationship. */
  onTieExisting: (toEntryId: string, rel: string) => void;
  /** Create a NEW entry and tie it to the focused entry, with a writer-set rel. */
  onCreateTied: (name: string, rel: string) => void;
}

// Ties block — clickable rows select that entry. Native HTML5 drop TARGET: drag
// a tile from a shelf onto this column to create a `linked` tie. Active drop gets
// a 2px accent border + --drop background (README Interactions). Each live tie
// carries an untie (×) affordance gated behind a danger confirm (untie is a HARD,
// non-reversible delete). The "+ add tie" control opens an inline picker to tie
// an existing entry OR create a brand-new one, each with a writer-set rel label.
export default function TiesBlock({
  ties,
  liveEntryIds,
  tieCandidates,
  onSelect,
  onDropOnTies,
  onUntie,
  onTieExisting,
  onCreateTied,
}: TiesBlockProps) {
  const drag = useDrag();
  const dragging = drag.dragging;

  // A tie whose target is no longer live (soft-deleted or purged) renders as a
  // RED "removed — needs replacement" tombstone instead of a clickable link.
  const resolved = resolveDanglingTies(liveEntryIds, ties);

  const isDropActive =
    dragging?.type === "entry" &&
    drag.dropZone?.type === "ties" &&
    drag.dropZone.id === "ties";

  // The tie pending the danger confirm (null = no dialog open). Untie is a HARD
  // delete, so it only fires from the modal's Confirm — Cancel/Escape/backdrop
  // leave the tie untouched (ConfirmModal wires those to onCancel).
  const [pendingUntie, setPendingUntie] = useState<ResolvedTie | null>(null);

  // Inline add-tie authoring state.
  const [adding, setAdding] = useState(false);
  const [queryText, setQueryText] = useState("");
  const [rel, setRel] = useState("");

  const matches = useMemo(() => {
    const q = queryText.trim().toLowerCase();
    if (!q) return tieCandidates;
    return tieCandidates.filter((c) => c.name.toLowerCase().includes(q));
  }, [tieCandidates, queryText]);

  function closeAdd() {
    setAdding(false);
    setQueryText("");
    setRel("");
  }

  function tieExisting(id: string) {
    onTieExisting(id, rel.trim());
    closeAdd();
  }

  function createTied() {
    const name = queryText.trim();
    if (!name) return;
    onCreateTied(name, rel.trim());
    closeAdd();
  }

  return (
    <div
      className={`${styles.block} ${isDropActive ? styles.dropActive : ""}`}
      onDragOver={(e) => {
        if (dragging?.type !== "entry") return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "link";
        drag.setZone({ type: "ties", id: "ties" });
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
          if (drag.dropZone?.type === "ties") drag.setZone(null);
        }
      }}
      onDrop={(e) => {
        e.preventDefault();
        if (dragging?.type === "entry") onDropOnTies();
        drag.endDrag();
      }}
    >
      <div className={styles.heading}>
        <h2 className={styles.title}>Ties</h2>
        <span className={styles.count}>{ties.length}</span>
      </div>
      <ul className={styles.list}>
        {resolved.map(({ tie: t, tombstoned, removedName }) =>
          tombstoned ? (
            <li key={t.id} className={styles.rowItem}>
              <div className={styles.tombstone} role="note">
                <span className={styles.tombstoneName}>{removedName}</span>
                <span className={styles.tombstoneNote}>removed — needs replacement</span>
              </div>
              <button
                type="button"
                className={styles.untie}
                onClick={() => setPendingUntie(t)}
                aria-label={`Untie ${removedName}`}
              >
                ×
              </button>
            </li>
          ) : (
            <li key={t.id} className={styles.rowItem}>
              <button
                type="button"
                className={styles.row}
                onClick={() => onSelect(t.toEntryId)}
              >
                <span className={styles.name}>{t.toName}</span>
                <span className={styles.rel}>{t.rel}</span>
              </button>
              <button
                type="button"
                className={styles.untie}
                onClick={() => setPendingUntie(t)}
                aria-label={`Untie ${t.toName}`}
              >
                ×
              </button>
            </li>
          ),
        )}
      </ul>

      {adding ? (
        <div className={styles.addPanel}>
          <input
            type="text"
            className={styles.relInput}
            placeholder="Relationship (e.g. uncle)"
            value={rel}
            onChange={(e) => setRel(e.target.value)}
            aria-label="Relationship label"
          />
          <div className={styles.picker} role="listbox" aria-label="Pick an entry to tie">
            <input
              type="text"
              className={styles.pickerInput}
              placeholder="Search or name a new entry…"
              value={queryText}
              onChange={(e) => setQueryText(e.target.value)}
              aria-label="Search entries to tie"
            />
            {matches.map((c) => (
              <button
                key={c.id}
                type="button"
                role="option"
                aria-selected={false}
                className={styles.pickerOption}
                onClick={() => tieExisting(c.id)}
              >
                {c.name} <span className={styles.pickerKind}>{c.kind}</span>
              </button>
            ))}
            {queryText.trim() && (
              <button
                type="button"
                className={styles.createOption}
                onClick={createTied}
              >
                + Create “{queryText.trim()}”
              </button>
            )}
          </div>
          <button type="button" className={styles.addCancel} onClick={closeAdd}>
            Cancel
          </button>
        </div>
      ) : (
        <button
          type="button"
          className={styles.addTie}
          onClick={() => setAdding(true)}
        >
          + Add tie
        </button>
      )}

      <p className={styles.hint}>
        Drop any tile from below onto this column to tie it in.
      </p>

      {pendingUntie && (
        <ConfirmModal
          title={`Untie ${pendingUntie.toName}?`}
          body="This removes the relationship for good. Ties are not restorable like deleted entries."
          confirmLabel="Untie"
          danger
          onConfirm={() => {
            onUntie(pendingUntie.id);
            setPendingUntie(null);
          }}
          onCancel={() => setPendingUntie(null)}
        />
      )}
    </div>
  );
}
