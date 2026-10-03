"use client";

import type { FactRow } from "@/domain/types";
import { useDrag } from "@/features/wiki/dnd/DragContext";
import InlineText from "../components/InlineText";
import styles from "./Facts.module.css";

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
  onDropSuggestion: (suggestionKey: string) => void;
  onEditFactField: (
    entryId: string,
    factId: string,
    field: "key" | "value",
    value: string,
  ) => void;
  onAddFact: (entryId: string) => void;
  onDeleteFact: (entryId: string, factId: string) => void;
  ai?: {
    suggestions: { key: string; value: string }[];
    busy: boolean;
    onSuggest: () => void;
    onAdd: (key: string, value: string) => void;
    onDismiss: (key: string) => void;
  };
}

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
