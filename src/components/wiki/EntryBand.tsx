import type { EntryWithDetails } from "@/lib/domain/types";
import { KIND_LABEL } from "@/lib/domain/types";
import Timeline from "./Timeline";
import DetailsColumn from "./DetailsColumn";
import OpenQuestions from "./OpenQuestions";
import EntryAside from "./EntryAside";
import { appearLine } from "@/lib/domain/derive";
import styles from "./EntryBand.module.css";

interface EntryBandProps {
  entry: EntryWithDetails;
  byId: Record<string, EntryWithDetails>;
  onSelect: (id: string) => void;
}

// Entry band: two columns, 40px gap, 34px top padding.
// Main column flex:1, right column fixed 340px (HANDOFF §4 / README Screen 1).
export default function EntryBand({ entry, onSelect }: EntryBandProps) {
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
        <h1 className={styles.name}>{entry.name}</h1>
        <div className={styles.rule} />
        <p className={styles.summary}>{entry.summary}</p>

        <div className={styles.storyHeading}>
          <h2 className={styles.sectionTitle}>The story so far</h2>
          <span className={styles.meta}>
            {appearLine(chapterCount, flaggedCount)}
          </span>
        </div>
        <Timeline appearances={entry.appearances} />

        <div className={styles.detailsRow}>
          <DetailsColumn facts={entry.facts} />
          <OpenQuestions questions={entry.openQuestions} />
        </div>
      </div>

      <EntryAside entry={entry} onSelect={onSelect} />
    </section>
  );
}
