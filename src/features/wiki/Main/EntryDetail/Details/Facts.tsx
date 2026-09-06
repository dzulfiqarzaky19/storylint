"use client";

import type { FactRow } from "@/lib/domain/types";
import { useDrag } from "@/components/dnd/DragContext";
import InlineText from "../components/InlineText";
import styles from "./Facts.module.css";

// TCK-HF2W-A1: replace the two text glyphs (U+2726 sparkle, U+2715 x) with inline
// SVGs in the same register as Sidebar's Chevron (viewBox 0 0 16 16, 1em box,
// stroke=currentColor, aria-hidden + focusable=false so they inherit colour and
// stay decorative — the visible label / aria-label carries the meaning). Crisp at
// any size, unlike font glyphs whose shape/baseline vary by platform font.
function SparkleIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 16 16"
      width="1em"
      height="1em"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M8 2 L9.4 6.6 L14 8 L9.4 9.4 L8 14 L6.6 9.4 L2 8 L6.6 6.6 Z" />
    </svg>
  );
}

function DismissIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 16 16"
      width="1em"
      height="1em"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <line x1="4" y1="4" x2="12" y2="12" />
      <line x1="12" y1="4" x2="4" y2="12" />
    </svg>
  );
}

function DeleteIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 16 16"
      width="1em"
      height="1em"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M3 4h10M5 4v10a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1V4M10 4V3a1 1 0 0 0-1-1H7a1 1 0 0 0-1 1v1" />
    </svg>
  );
}

interface FactsProps {
  entryId: string;
  facts: FactRow[];
  /** Drop a suggestion card here → add it as a fresh fact on this entry. */
  onDropSuggestion: (suggestionKey: string) => void;
  /** Edit a fact's key/value in place (manual authoring, Track A). */
  onEditFactField: (
    entryId: string,
    factId: string,
    field: "key" | "value",
    value: string,
  ) => void;
  /** Add a new blank fact to this entry. */
  onAddFact: (entryId: string) => void;
  /** Delete a fact from this entry. */
  onDeleteFact: (entryId: string, factId: string) => void;
  /** AI "suggest details" (optional). Writes nothing until the writer adds one. */
  ai?: {
    suggestions: { key: string; value: string }[];
    busy: boolean;
    onSuggest: () => void;
    onAdd: (key: string, value: string) => void;
    onDismiss: (key: string) => void;
  };
}

// Details column (flex:1): fact rows with 104px key cell. A fresh fact gets the
// --fresh background. Native HTML5 DnD: each fact row is a draggable SOURCE (move
// it onto a tile to reassign the fact) and the whole column is a drop TARGET for
// suggestion cards (add-as-fresh-fact). Card-drop active → --drop background.
// Key and value are inline-editable (Track A); "+ Add detail" appends a fact.
export default function Facts({
  entryId,
  facts,
  onDropSuggestion,
  onEditFactField,
  onAddFact,
  onDeleteFact,
  ai,
}: FactsProps) {
  const drag = useDrag();
  const dragging = drag.dragging;

  const isCardDropActive =
    dragging?.type === "card" &&
    drag.dropZone?.type === "board" &&
    drag.dropZone.id === entryId;

  return (
    <div
      className={`${styles.details} ${isCardDropActive ? styles.cardDrop : ""}`}
      onDragOver={(e) => {
        if (dragging?.type !== "card") return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
        drag.setZone({ type: "board", id: entryId });
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
          if (drag.dropZone?.type === "board" && drag.dropZone.id === entryId) {
            drag.setZone(null);
          }
        }
      }}
      onDrop={(e) => {
        e.preventDefault();
        if (dragging?.type === "card") onDropSuggestion(dragging.id);
        drag.endDrag();
      }}
    >
      <div className={styles.heading}>
        <h2 className={styles.title}>Details</h2>
      </div>
      <ul className={styles.list}>
        {facts.map((f) => (
          <li
            key={f.id}
            className={`${styles.row} ${f.fresh ? styles.fresh : ""}`}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.effectAllowed = "move";
              e.dataTransfer.setData("text/plain", f.id);
              drag.startDrag({ type: "fact", id: f.id, from: entryId });
            }}
            onDragEnd={() => drag.endDrag()}
          >
            <span className={styles.key}>
              <InlineText
                value={f.key}
                ariaLabel="detail label"
                placeholder="Label"
                onCommit={(v) => onEditFactField(entryId, f.id, "key", v)}
              />
            </span>
            <span className={styles.value}>
              <InlineText
                value={f.value}
                ariaLabel="detail value"
                placeholder="Value"
                onCommit={(v) => onEditFactField(entryId, f.id, "value", v)}
              />
            </span>
            <span className={styles.actions}>
              <button
                type="button"
                className={styles.deleteFact}
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteFact(entryId, f.id);
                }}
                aria-label={`Delete ${f.key}`}
              >
                <DeleteIcon />
              </button>
            </span>
          </li>
        ))}
      </ul>
      <button
        type="button"
        className={styles.addFact}
        onClick={() => onAddFact(entryId)}
      >
        + Add detail
      </button>

      {ai && (
        <div className={styles.aiBlock}>
          <button
            type="button"
            className={styles.aiSuggest}
            disabled={ai.busy}
            onClick={ai.onSuggest}
          >
            {ai.busy ? (
              "Thinking…"
            ) : (
              <>
                <SparkleIcon /> Suggest details
              </>
            )}
          </button>
          {ai.suggestions.length > 0 && (
            <ul className={styles.aiList}>
              {ai.suggestions.map((s) => (
                <li key={s.key} className={styles.aiItem}>
                  <span className={styles.aiText}>
                    <strong>{s.key}:</strong> {s.value}
                  </span>
                  <span className={styles.aiActions}>
                    <button
                      type="button"
                      className={styles.aiAdd}
                      onClick={() => ai.onAdd(s.key, s.value)}
                    >
                      Add
                    </button>
                    <button
                      type="button"
                      className={styles.aiDismiss}
                      onClick={() => ai.onDismiss(s.key)}
                      aria-label={`Dismiss ${s.key}`}
                    >
                      <DismissIcon />
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
