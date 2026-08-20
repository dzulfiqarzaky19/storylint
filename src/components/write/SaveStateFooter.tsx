import styles from "./Manuscript.module.css";

export interface SaveStateFooterProps {
  /** A failed body save (§8 lost-work message). When set, this branch wins. */
  error: string | null;
  /** True while an unsaved edit is pending (debounced save in flight). */
  dirty: boolean;
  /** True while the AI check is running. */
  aiChecking: boolean;
}

/**
 * The manuscript save-state footer. Its ONE load-bearing decision is a11y live
 * politeness: a save FAILURE is announced ASSERTIVELY (role="alert") because it
 * warns of lost work a screen-reader user must not miss, while the ordinary
 * saving/saved/checking status is POLITE (role="status") so it never interrupts.
 * Extracted from Manuscript so this branch is provable without mounting the
 * whole editor (the CSS presentation stays live-browser territory).
 */
export default function SaveStateFooter({
  error,
  dirty,
  aiChecking,
}: SaveStateFooterProps) {
  if (error) {
    return (
      <p className={`${styles.saveState} ${styles.saveError}`} role="alert">
        {error}
      </p>
    );
  }
  return (
    <p className={styles.saveState} role="status">
      {dirty ? "Unsaved changes" : aiChecking ? "Checking with AI…" : "Saved"}
    </p>
  );
}
