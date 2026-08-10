"use client";

import type { EntryWithDetails } from "@/lib/domain/types";
import PortraitPlaceholder from "./PortraitPlaceholder";
import TiesBlock, { type TieCandidate } from "./TiesBlock";
import styles from "./EntryAside.module.css";

interface EntryAsideProps {
  entry: EntryWithDetails;
  /** Ids of every LIVE entry — passed through to the Ties tombstone resolver. */
  liveEntryIds: Set<string>;
  /** Every OTHER live entry — the add-tie search pool. */
  tieCandidates: TieCandidate[];
  onSelect: (id: string) => void;
  /** Drop a tile here → tie it to the selected entry. */
  onDropOnTies: () => void;
  /** Untie (hard-delete) a tie on the focused entry. */
  onUntie: (tieId: string) => void;
  /** Tie the focused entry to an existing entry with a writer-set rel. */
  onTieExisting: (toEntryId: string, rel: string) => void;
  /** Create a new entry and tie it to the focused entry, with a writer-set rel. */
  onCreateTied: (name: string, rel: string) => void;
}

// Entry band right column, fixed 340px (README Screen 1).
export default function EntryAside({
  entry,
  liveEntryIds,
  tieCandidates,
  onSelect,
  onDropOnTies,
  onUntie,
  onTieExisting,
  onCreateTied,
}: EntryAsideProps) {
  return (
    <aside className={styles.aside} aria-label="Portrait and ties">
      <PortraitPlaceholder />
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
    </aside>
  );
}
