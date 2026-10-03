"use client";

import type { EntryWithDetails } from "@/domain/types";
import { resolveDanglingTies } from "./lib/danglingTies";
import Tabs from "./Tabs";
import Facts from "./Details/Facts";
import Ties, { type TieCandidate } from "./Ties";
import Profile from "./Profile/Profile";
import type { ShareWorld } from "./Profile/ShareControls";
import styles from "./EntryDetail.module.css";

interface EntryDetailProps {
  entry: EntryWithDetails;
  liveEntryIds: Set<string>;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  sharing: {
    worlds: ShareWorld[];
    activeWorldId: string;
    onError: (message: string) => void;
  };
  onDropOnTies: () => void;
  tieCandidates: TieCandidate[];
  onUntie: (tieId: string) => void;
  onTieExisting: (toEntryId: string, rel: string) => void;
  onCreateTied: (name: string, rel: string) => void;
  onDropSuggestion: (suggestionKey: string) => void;
  onEditEntryField: (
    entryId: string,
    field: "name" | "summary" | "note",
    value: string,
  ) => void;
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
  const liveTieCount = resolveDanglingTies(liveEntryIds, entry.ties).filter(
    (r) => !r.tombstoned,
  ).length;

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
            key: "details",
            label: "Details",
            count: entry.facts.length,
            panel: (
              <Facts
                entryId={entry.id}
                facts={entry.facts}
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
