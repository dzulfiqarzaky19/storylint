"use client";

import { useEffect } from "react";
import styles from "./error.module.css";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className={styles.wrap} role="alert" aria-live="assertive">
      <div className={styles.panel}>
        <p className={styles.kicker}>Something went wrong</p>
        <h1 className={styles.title}>The gazetteer could not be loaded.</h1>
        <p className={styles.body}>
          A background service did not respond. This is usually temporary — try
          again in a moment.
        </p>
        <div className={styles.actions}>
          <button type="button" className={styles.retry} onClick={() => reset()}>
            Try again
          </button>
        </div>
        {error.digest ? (
          <p className={styles.digest}>Reference: {error.digest}</p>
        ) : null}
      </div>
    </main>
  );
}
