"use client";

import { useMemo, useState } from "react";
import type { ResolvedTie } from "@/lib/domain/types";
import { resolveDanglingTies } from "./lib/danglingTies";
import { roleVocabFor, ROLE_VOCAB } from "./lib/tieRoleVocab";
import { useDrag } from "@/components/dnd/DragContext";
import ConfirmModal from "@/components/ui/ConfirmModal";
import styles from "./Ties.module.css";

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
  const [replacingTie, setReplacingTie] = useState<ResolvedTie | null>(null);

  // Inline add-tie authoring state.
  const [adding, setAdding] = useState(false);
  const [queryText, setQueryText] = useState("");
  const [rel, setRel] = useState("");
  const [pickedKind, setPickedKind] = useState<string | null>(null);
  const [pickedId, setPickedId] = useState<string | null>(null);

  const matches = useMemo(() => {
    const q = queryText.trim().toLowerCase();
    if (!q) return tieCandidates;
    return tieCandidates.filter((c) => c.name.toLowerCase().includes(q));
  }, [tieCandidates, queryText]);

  function openReplace(t: ResolvedTie) {
    setReplacingTie(t);
    setAdding(true);
    setRel(t.rel || "");
    setQueryText(t.toName || "");
  }

  function closeAdd() {
    setAdding(false);
    setQueryText("");
    setRel("");
    setReplacingTie(null);
    setPickedKind(null);
    setPickedId(null);
  }

  function pickCandidate(c: TieCandidate) {
    setPickedId(c.id);
    setPickedKind(c.kind);
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
        {(() => {
          // a) Group by kind — group header + rows per group.
          const groups = new Map<string, typeof resolved>();
          for (const item of resolved) {
            const kind = item.tie.toKind || "lore";
            if (!groups.has(kind)) groups.set(kind, []);
            groups.get(kind)!.push(item);
          }
          return Array.from(groups.entries()).map(([kind, items]) => (
            <li key={kind} className={styles.group}>
              <div className={styles.groupHead}>
                <span className={styles.groupLabel}>{kind}</span>
                <span className={styles.groupCount}>{items.length}</span>
              </div>
              <ul className={styles.groupList}>
                {items.map(({ tie: t, tombstoned, removedName }) =>
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
                      <button
                        type="button"
                        className={styles.replaceTie}
                        onClick={() => openReplace(t)}
                        aria-label={`Replace tie to ${removedName}`}
                      >
                        Replace tie
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
            </li>
          ));
        })()}
      </ul>

      {adding ? (
        <div className={styles.addPanel}>
          <div className={styles.picker} role="listbox" aria-label="Pick an entry to tie">
            <input
              type="text"
              className={styles.pickerInput}
              placeholder="Search or name a new entry…"
              value={queryText}
              onChange={(e) => {
                setQueryText(e.target.value);
                if (pickedId) { setPickedId(null); setPickedKind(null); }
              }}
              aria-label="Search entries to tie"
            />
            {matches.map((c) => (
              <button
                key={c.id}
                type="button"
                role="option"
                aria-selected={pickedId === c.id}
                className={`${styles.pickerOption} ${pickedId === c.id ? styles.pickerOptionPicked : ""}`}
                onClick={() => pickCandidate(c)}
              >
                {c.name} <span className={styles.pickerKind}>{c.kind}</span>
              </button>
            ))}
            {queryText.trim() && !matches.some((m) => m.name.toLowerCase() === queryText.trim().toLowerCase()) && (
              <button
                type="button"
                className={styles.createOption}
                onClick={() => {
                  setPickedKind("character");
                  setPickedId(`__new__${queryText.trim()}`);
                }}
                aria-pressed={pickedId === `__new__${queryText.trim()}`}
              >
                + Create “{queryText.trim()}”
              </button>
            )}
          </div>

          {pickedKind ? (
            <>
              <div className={styles.pickedBanner} aria-live="polite">
                <span className={styles.pickedName}>{pickedId?.startsWith("__new__") ? pickedId.replace("__new__", "") : matches.find((m) => m.id === pickedId)?.name ?? "—"}</span>
                <span className={styles.pickedKind}>· {pickedKind}</span>
              </div>
              <div className={styles.roleSection}>
              <span className={styles.roleLabel}>
                Relationship to {pickedKind}:
              </span>
              <div className={styles.roleChips} aria-label="Quick role chips">
                {roleVocabFor(pickedKind).slice(0, 6).map((r) => (
                  <button
                    key={r}
                    type="button"
                    className={styles.chip}
                    onClick={() => {
                      setRel(r);
                      if (pickedId?.startsWith("__new__")) {
                        const name = pickedId.replace("__new__", "");
                        onCreateTied(name, r);
                        closeAdd();
                      } else if (pickedId) {
                        onTieExisting(pickedId, r);
                        closeAdd();
                      }
                    }}
                    aria-pressed={rel === r}
                    title={`Set relationship: ${r}`}
                  >
                    {r}
                  </button>
                ))}
              </div>
              <input
                type="text"
                className={styles.relInput}
                placeholder="or type a role…"
                value={rel}
                onChange={(e) => setRel(e.target.value)}
                aria-label="Relationship label"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && rel.trim()) {
                    if (pickedId?.startsWith("__new__")) {
                      const name = pickedId.replace("__new__", "");
                      onCreateTied(name, rel.trim());
                    } else if (pickedId) {
                      onTieExisting(pickedId, rel.trim());
                    }
                    closeAdd();
                  }
                }}
              />
            </div>
            </>
          ) : (
            <p className={styles.hint}>Pick an entry above to see role suggestions.</p>
          )}

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

      {/* T-WIKI-COCKPIT-4 STUB: AI-suggested ties (UI only; real action lands in lib/actions) */}
      <section className={styles.suggestedTies} aria-label="AI-suggested ties">
        <h3 className={styles.suggestedTitle}>Suggest ties</h3>
        <div className={styles.suggestedList}>
          <div className={styles.suggestedRow}>
            <span className={styles.suggestedName}>A returning ally</span>
            <span className={styles.suggestedRel}>ally · ch. 7</span>
            <div className={styles.suggestedActions}>
              <button
                type="button"
                className={styles.suggestedAccept}
                onClick={() => { /* stub: calls onTieExisting / createTied later */ }}
                aria-label="Accept suggested tie to A returning ally"
              >
                Add
              </button>
              <button
                type="button"
                className={styles.suggestedDismiss}
                onClick={() => { /* stub: dismisses suggestion */ }}
                aria-label="Dismiss suggested tie"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
        <p className={styles.suggestedHint}>AI suggestion — confirm to turn into a live tie.</p>
      </section>
    </div>
  );
}
