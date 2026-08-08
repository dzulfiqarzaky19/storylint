"use client";

import type { EntryWithDetails } from "@/lib/domain/types";
import { KIND_LABEL } from "@/lib/domain/types";
import Timeline from "./Timeline";
import DetailsColumn from "./DetailsColumn";
import OpenQuestions from "./OpenQuestions";
import EntryAside from "./EntryAside";
import InlineText from "./InlineText";
import { appearLine } from "@/lib/domain/derive";
import styles from "./EntryBand.module.css";

interface EntryBandProps {
  entry: EntryWithDetails;
  onSelect: (id: string) => void;
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
}

// Entry band: two columns, 40px gap, 34px top padding.
// Main column flex:1, right column fixed 340px (HANDOFF §4 / README Screen 1).
export default function EntryBand({
  entry,
  onSelect,
  onDropOnTies,
  onDropSuggestion,
  onEditEntryField,
  onEditFactField,
  onAddFact,
}: EntryBandProps) {
  const kindLabel = KIND_LABEL[entry.kind];
  const chapterCount = entry.appearances.length;
  const flaggedCount = entry.appearances.filter((a) => a.flag !== null).length;

  return (
    <section className={styles.band} aria-label="Entry">
      <div className={styles.main}>
        <p className={styles.kicker}>
          <span className={styles.kind}>{kindLabel}</span>
          <span className={styles.catalogueNo}>No. {entry.catalogueNo}</span>
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
          />
          <OpenQuestions questions={entry.openQuestions} />
        </div>
      </div>

      <EntryAside
        entry={entry}
        onSelect={onSelect}
        onDropOnTies={onDropOnTies}
      />
    </section>
  );
}
