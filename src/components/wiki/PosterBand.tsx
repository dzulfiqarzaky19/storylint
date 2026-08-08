import { sugHeadline } from "@/lib/domain/derive";
import styles from "./PosterBand.module.css";

// Minimal poster suggestion shape (README Screen 1 "Poster band"). The real
// Suggestion type is produced by the check engine in a later phase; this keeps
// the read-only screen decoupled from it.
export interface PosterSuggestion {
  key: string;
  source: string;
  text: string;
  value: string;
}

interface PosterBandProps {
  suggestions: PosterSuggestion[];
}

// Full-bleed accent poster. Renders ONLY when suggestions exist (HANDOFF §4);
// in read-only Phase 3 the list is always empty, so this renders nothing.
export default function PosterBand({ suggestions }: PosterBandProps) {
  if (suggestions.length === 0) return null;

  return (
    <section className={styles.band} aria-label="Suggestions from the manuscript">
      <h2 className={styles.headline}>{sugHeadline(suggestions.length)}</h2>
      <div className={styles.cards}>
        {suggestions.map((s) => (
          <article key={s.key} className={styles.card}>
            <p className={styles.source}>{s.source}</p>
            <p className={styles.text}>{s.text}</p>
            {/* Write it in / Leave it wired in Phase 4. */}
          </article>
        ))}
      </div>
    </section>
  );
}
