"use client";

import { useMemo, useState } from "react";
import styles from "./ResearchScreen.module.css";
import {
  resolveConfirmTarget,
  type ConfirmRecommendation,
  type ConfirmTargetChoice,
} from "@/lib/research/resolveConfirmTarget";

/** Minimal live-entry shape the picker + recommender need. */
export interface StripEntry {
  id: string;
  name: string;
  kind: string;
}

export interface ConfirmationStripProps {
  /** The pending card's title, interpolated into the sentence. */
  title: string;
  /**
   * F6 enrich-vs-duplicate: the recommended existing entry to enrich, or null
   * when nothing confidently matches (then "new entry" is the default action).
   */
  recommendation: ConfirmRecommendation | null;
  /** Live entries for the "pick another entry" search picker. */
  entries: StripEntry[];
  /** enrichEntryId = undefined -> create a new entry; a string -> enrich that entry. */
  onConfirm: (enrichEntryId: string | undefined) => void;
  onCancel: () => void;
}

/**
 * Appears ONLY when a card is pending. "Yes, write it in" is the sole wiki-write
 * trigger; "Cancel" writes nothing. F6: when the recommender matches an existing
 * entry, the strip defaults to ENRICHING it (not spawning a duplicate), while
 * still offering "New entry instead" and a picker to enrich a different entry.
 * README §Screen 2.4
 */
export default function ConfirmationStrip({
  title,
  recommendation,
  entries,
  onConfirm,
  onCancel,
}: ConfirmationStripProps) {
  const [picking, setPicking] = useState(false);
  const [queryText, setQueryText] = useState("");

  const confirm = (choice: ConfirmTargetChoice) =>
    onConfirm(resolveConfirmTarget(choice, recommendation));

  const matches = useMemo(() => {
    const q = queryText.trim().toLowerCase();
    const pool = q
      ? entries.filter((e) => e.name.toLowerCase().includes(q))
      : entries;
    return pool.slice(0, 8);
  }, [entries, queryText]);

  // No match: keep today's behavior (create a new entry) but still allow picking.
  if (!recommendation) {
    return (
      <div className={styles.confirmStrip} role="group" aria-label="Confirm wiki write">
        <div className={styles.confirmSentence}>
          Add “{title}” to the wiki as a new entry? You can edit every word after.
        </div>
        <button type="button" className={styles.confirmYes} onClick={() => confirm({ kind: "new" })}>
          Yes, write it in
        </button>
        <button
          type="button"
          className={styles.confirmCancel}
          onClick={() => setPicking((p) => !p)}
        >
          Pick an entry
        </button>
        <button type="button" className={styles.confirmCancel} onClick={onCancel}>
          Cancel
        </button>
        {picking && (
          <EntryPicker
            matches={matches}
            queryText={queryText}
            onQuery={setQueryText}
            onPick={(id) => confirm({ kind: "pick", entryId: id })}
          />
        )}
      </div>
    );
  }

  return (
    <div className={styles.confirmStrip} role="group" aria-label="Confirm wiki write">
      <div className={styles.confirmSentence}>
        “{title}” looks like it belongs in <strong>{recommendation.name}</strong>. Enrich that
        entry, or write a new one? You can edit every word after.
      </div>
      <button
        type="button"
        className={styles.confirmYes}
        onClick={() => confirm({ kind: "recommended" })}
      >
        Enrich {recommendation.name}
      </button>
      <button
        type="button"
        className={styles.confirmCancel}
        onClick={() => confirm({ kind: "new" })}
      >
        New entry instead
      </button>
      <button
        type="button"
        className={styles.confirmCancel}
        onClick={() => setPicking((p) => !p)}
      >
        Pick another entry
      </button>
      <button type="button" className={styles.confirmCancel} onClick={onCancel}>
        Cancel
      </button>
      {picking && (
        <EntryPicker
          matches={matches}
          queryText={queryText}
          onQuery={setQueryText}
          onPick={(id) => confirm({ kind: "pick", entryId: id })}
        />
      )}
    </div>
  );
}

/** Small inline search list for choosing a different enrich target. */
function EntryPicker({
  matches,
  queryText,
  onQuery,
  onPick,
}: {
  matches: StripEntry[];
  queryText: string;
  onQuery: (q: string) => void;
  onPick: (entryId: string) => void;
}) {
  return (
    <div className={styles.entryPicker} role="listbox" aria-label="Pick an entry to enrich">
      <input
        type="text"
        className={styles.entryPickerInput}
        placeholder="Search entries…"
        value={queryText}
        onChange={(e) => onQuery(e.target.value)}
        aria-label="Search entries"
      />
      {matches.length === 0 ? (
        <div className={styles.entryPickerEmpty}>No entries match.</div>
      ) : (
        matches.map((e) => (
          <button
            key={e.id}
            type="button"
            role="option"
            aria-selected={false}
            className={styles.entryPickerOption}
            onClick={() => onPick(e.id)}
          >
            {e.name} <span className={styles.entryPickerKind}>{e.kind}</span>
          </button>
        ))
      )}
    </div>
  );
}
