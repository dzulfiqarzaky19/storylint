"use client";

import { useState } from "react";
import type { EntryWithDetails } from "@/lib/domain/types";
import { kindLabelOf } from "@/lib/domain/types";
import { resolveDanglingTies } from "@/lib/wiki/danglingTies";
import EntryTabs from "./EntryTabs";
import OverviewTab from "./OverviewTab";
import TimelineTab from "./TimelineTab";
import DetailsTab from "./DetailsTab";
import TiesBlock, { type TieCandidate } from "./TiesBlock";
import PortraitPlaceholder from "./PortraitPlaceholder";
import ShareControls, { type ShareWorld } from "./ShareControls";
import InlineText from "./InlineText";
import ConfirmModal from "../ui/ConfirmModal";
import styles from "./EntryBand.module.css";

interface EntryBandProps {
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
 * Focused-entry workspace. T-WIKI-COCKPIT-1 restructured this from one long
 * scroll into a fixed head (identity + portrait) over a 4-tab body
 * (Overview/Timeline/Details/Ties), mirroring prototypes/wiki-c-cockpit.html.
 *
 * The summary lives ONLY in the Overview tab, not the head: rendering the same
 * editable field twice would give one value two inline-edit surfaces that can
 * disagree mid-edit. Overview is the default tab, so it stays visible on load.
 */
export default function EntryBand({
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
}: EntryBandProps) {
  const kindLabel = kindLabelOf(entry.kind);
  // Guard the irreversible soft-delete behind a confirm dialog: the trigger only
  // OPENS the modal; the actual delete fires from the modal's confirm button.
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  // The Ties pill counts LIVE ties only — a tombstoned tie points at a deleted
  // entry and reads as "needs replacement", not as a standing relationship.
  const liveTieCount = resolveDanglingTies(liveEntryIds, entry.ties).filter(
    (r) => !r.tombstoned,
  ).length;
  const hasFlaggedBeat = entry.appearances.some((a) => a.flag !== null);

  return (
    <section className={styles.band} aria-label="Entry">
      <div className={styles.head}>
        <div className={styles.headMain}>
          {/* Kicker is a flex CLUSTER (spans + ShareControls' <div>/<label> + a
              button), not prose. It MUST be a <div>: a <div>/<label> inside a <p>
              is invalid HTML, so the browser auto-closes the <p> and the SSR DOM
              diverges from the client React tree -> React #418 hydration mismatch
              on a clean /wiki load. TCK-E04. */}
          <div className={styles.kicker}>
            <span className={styles.kind}>{kindLabel}</span>
            <span className={styles.catalogueNo}>No. {entry.catalogueNo}</span>
            <ShareControls
              entryId={entry.id}
              entryName={entry.name}
              activeWorldId={sharing.activeWorldId}
              worlds={sharing.worlds}
              onError={sharing.onError}
            />
            <button
              type="button"
              className={styles.deleteEntry}
              onClick={() => setConfirmingDelete(true)}
              aria-label={`Delete ${entry.name}`}
            >
              Delete
            </button>
          </div>
          <h1 className={styles.name}>
            <InlineText
              value={entry.name}
              ariaLabel="entry name"
              onCommit={(v) => onEditEntryField(entry.id, "name", v)}
            />
          </h1>
        </div>
        <div className={styles.headPortrait}>
          <PortraitPlaceholder />
        </div>
      </div>

      <EntryTabs
        tabs={[
          {
            key: "overview",
            label: "Overview",
            panel: (
              <OverviewTab
                entry={entry}
                onEditSummary={(v) => onEditEntryField(entry.id, "summary", v)}
              />
            ),
          },
          {
            key: "timeline",
            label: "Timeline",
            warn: hasFlaggedBeat,
            panel: <TimelineTab appearances={entry.appearances} />,
          },
          {
            key: "details",
            label: "Details",
            count: entry.facts.length,
            panel: (
              <DetailsTab
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
              <TiesBlock
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
