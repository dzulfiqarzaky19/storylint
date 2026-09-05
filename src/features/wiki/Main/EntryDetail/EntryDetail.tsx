"use client";

import type { EntryWithDetails } from "@/lib/domain/types";
import { resolveDanglingTies } from "./lib/danglingTies";
import Tabs from "./Tabs";
import Overview from "./Overview";
import Timeline from "./Timeline";
import Details from "./Details/Details";
import Ties, { type TieCandidate } from "./Ties";
import Profile from "./Profile/Profile";
import type { ShareWorld } from "./Profile/ShareControls";
import styles from "./EntryDetail.module.css";

interface EntryDetailProps {
  entry: EntryWithDetails;
  /** Ids of every LIVE entry, passed through to the Ties tombstone resolver. */
  liveEntryIds: Set<string>;
  onSelect: (id: string) => void;
  /** Soft-delete this entry (removes it from the gazetteer; ties to it tombstone). */
  onDelete: (id: string) => void;
  /** TCK-023 (W-4b): world-membership controls (share into a world / unlink here). */
  sharing: {
    worlds: ShareWorld[];
    activeWorldId: string;
    onError: (message: string) => void;
  };
  /** Drop a tile onto the Ties block → create a tie from this entry. */
  onDropOnTies: () => void;
  /** Every OTHER live entry — the add-tie search pool for the Ties block. */
  tieCandidates: TieCandidate[];
  /** Untie (hard-delete) a tie on this entry (gated behind a danger confirm). */
  onUntie: (tieId: string) => void;
  /** Tie this entry to an existing entry with a writer-set relationship. */
  onTieExisting: (toEntryId: string, rel: string) => void;
  /** Create a new entry and tie it to this entry, with a writer-set rel. */
  onCreateTied: (name: string, rel: string) => void;
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
  /** Delete a fact from this entry. */
  onDeleteFact: (entryId: string, factId: string) => void;
  /** AI "suggest details" panel (optional). */
  ai?: {
    suggestions: { key: string; value: string }[];
    busy: boolean;
    onSuggest: () => void;
    onAdd: (key: string, value: string) => void;
    onDismiss: (key: string) => void;
  };
}

/**
 * Focused-entry workspace. Identity lives in Profile; the four tabs
 * (Overview/Timeline/Details/Ties) are the body.
 *
 * The summary is the head blurb under the name — and it lives there ONLY.
 * Rendering the same editable field twice would give one value two
 * inline-edit surfaces that can disagree mid-edit, so Overview does not
 * repeat it; Overview's own summary slot is the deferred AI synthesis.
 */
export default function EntryDetail({
  entry,
  liveEntryIds,
  onSelect,
  onDelete,
  sharing,
  onDropOnTies,
  tieCandidates,
  onUntie,
  onTieExisting,
  onCreateTied,
  onDropSuggestion,
  onEditEntryField,
  onEditFactField,
  onAddFact,
  onDeleteFact,
  ai,
}: EntryDetailProps) {
  // The Ties pill counts LIVE ties only — a tombstoned tie points at a deleted
  // entry and reads as "needs replacement", not as a standing relationship.
  const liveTieCount = resolveDanglingTies(liveEntryIds, entry.ties).filter(
    (r) => !r.tombstoned,
  ).length;
  const hasFlaggedBeat = entry.appearances.some((a) => a.flag !== null);

  return (
    <section className={styles.band} aria-label="Entry">
      <Profile
        entry={entry}
        sharing={sharing}
        onEditEntryField={onEditEntryField}
        onDelete={onDelete}
      />

      <Tabs
        tabs={[
          {
            key: "overview",
            label: "Overview",
            panel: <Overview entry={entry} />,
          },
          {
            key: "timeline",
            label: "Timeline",
            warn: hasFlaggedBeat,
            panel: <Timeline appearances={entry.appearances} />,
          },
          {
            key: "details",
            label: "Details",
            count: entry.facts.length,
            panel: (
              <Details
                entryId={entry.id}
                facts={entry.facts}
                openQuestions={entry.openQuestions}
                onDropSuggestion={onDropSuggestion}
                onEditFactField={onEditFactField}
                onAddFact={onAddFact}
                onDeleteFact={onDeleteFact}
                ai={ai}
              />
            ),
          },
          {
            key: "ties",
            label: "Ties",
            count: liveTieCount,
            panel: (
              <Ties
                ties={entry.ties}
                liveEntryIds={liveEntryIds}
                tieCandidates={tieCandidates}
                onSelect={onSelect}
                onDropOnTies={onDropOnTies}
                onUntie={onUntie}
                onTieExisting={onTieExisting}
                onCreateTied={onCreateTied}
              />
            ),
          },
        ]}
      />
    </section>
  );
}
