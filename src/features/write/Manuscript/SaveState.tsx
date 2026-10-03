import styles from "./Manuscript.module.css";

export interface SaveStateProps {
  error: string | null;
  dirty: boolean;
  aiChecking: boolean;
}

export default function SaveState({
  error,
  dirty,
  aiChecking,
}: SaveStateProps) {
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
