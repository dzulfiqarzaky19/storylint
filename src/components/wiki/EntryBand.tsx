"use client";

import { useState } from "react";
import type { EntryWithDetails } from "@/lib/domain/types";
import { KIND_LABEL } from "@/lib/domain/types";
import Timeline from "./Timeline";
import DetailsColumn from "./DetailsColumn";
import OpenQuestions from "./OpenQuestions";
import EntryAside from "./EntryAside";
import InlineText from "./InlineText";
import ConfirmModal from "../ui/ConfirmModal";
import { appearLine } from "@/lib/domain/derive";
import styles from "./EntryBand.module.css";

interface EntryBandProps {
  entry: EntryWithDetails;
  /** Ids of every LIVE entry, passed through to the Ties tombstone resolver. */
  liveEntryIds: Set<string>;
  onSelect: (id: string) => void;
  /** Soft-delete this entry (removes it from the gazetteer; ties to it tombstone). */
  onDelete: (id: string) => void;
  /** Drop a tile onto the Ties block → create a tie from this entry. */
  onDropOnTies: () => void;
  /** Drop a suggestion card onto Details → add it as a fresh fact. */
  onDropSuggestion: (suggestionKey: string) => void;
  /** Edit a scalar field on this entry in place (manual authoring, Track A). */
  onEditEntryField: (
    entryId: string,
    field: "name" | "summary" | "note",
    value: string,
  ) => void;
  /** Edit a fact's key/value in place. */
  onEditFactField: (
    entryId: string,
    factId: string,
    field: "key" | "value",
    value: string,
  ) => void;
  /** Add a new blank fact to this entry. */
  onAddFact: (entryId: string) => void;
  /** AI "suggest details" panel (optional). */
  ai?: {
    suggestions: { key: string; value: string }[];
    busy: boolean;
    onSuggest: () => void;
    onAdd: (key: string, value: string) => void;
    onDismiss: (key: string) => void;
  };
}

// Entry band: two columns, 40px gap, 34px top padding.
// Main column flex:1, right column fixed 340px (HANDOFF §4 / README Screen 1).
export default function EntryBand({
  entry,
  liveEntryIds,
  onSelect,
  onDelete,
  onDropOnTies,
  onDropSuggestion,
  onEditEntryField,
  onEditFactField,
  onAddFact,
  ai,
}: EntryBandProps) {
  const kindLabel = KIND_LABEL[entry.kind];
  const chapterCount = entry.appearances.length;
  const flaggedCount = entry.appearances.filter((a) => a.flag !== null).length;
  // Guard the irreversible soft-delete behind a confirm dialog: the trigger only
  // OPENS the modal; the actual delete fires from the modal's confirm button.
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  return (
    <section className={styles.band} aria-label="Entry">
      <div className={styles.main}>
        <p className={styles.kicker}>
          <span className={styles.kind}>{kindLabel}</span>
          <span className={styles.catalogueNo}>No. {entry.catalogueNo}</span>
          <button
            type="button"
            className={styles.deleteEntry}
            onClick={() => setConfirmingDelete(true)}
            aria-label={`Delete ${entry.name}`}
          >
            Delete
          </button>
        </p>
        <h1 className={styles.name}>
          <InlineText
            value={entry.name}
            ariaLabel="entry name"
            onCommit={(v) => onEditEntryField(entry.id, "name", v)}
          />
        </h1>
        <div className={styles.rule} />
        <p className={styles.summary}>
          <InlineText
            value={entry.summary}
            ariaLabel="entry summary"
            multiline
            placeholder="Add a summary"
            onCommit={(v) => onEditEntryField(entry.id, "summary", v)}
          />
        </p>

        <div className={styles.storyHeading}>
          <h2 className={styles.sectionTitle}>The story so far</h2>
          <span className={styles.meta}>
            {appearLine(chapterCount, flaggedCount)}
          </span>
        </div>
        <Timeline appearances={entry.appearances} />

        <div className={styles.detailsRow}>
          <DetailsColumn
            entryId={entry.id}
            facts={entry.facts}
            onDropSuggestion={onDropSuggestion}
            onEditFactField={onEditFactField}
            onAddFact={onAddFact}
            ai={ai}
          />
          <OpenQuestions questions={entry.openQuestions} />
        </div>
      </div>

      <EntryAside
        entry={entry}
        liveEntryIds={liveEntryIds}
        onSelect={onSelect}
        onDropOnTies={onDropOnTies}
      />

      {confirmingDelete ? (
        <ConfirmModal
          title={`Delete ${entry.name}?`}
          body="This removes the entry from the gazetteer. Ties pointing at it will be marked as removed."
          confirmLabel="Delete"
          cancelLabel="Cancel"
          danger
          onConfirm={() => {
            setConfirmingDelete(false);
            onDelete(entry.id);
          }}
          onCancel={() => setConfirmingDelete(false)}
        />
      ) : null}
    </section>
  );
}
