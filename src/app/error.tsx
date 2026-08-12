"use client";

// TCK-E07: route-segment error boundary. Next renders this when a Server
// Component under src/app throws during render — e.g. a DB read in wiki/
// research/write page.tsx propagates a pool/query failure into the RSC. Without
// this file Next serves a BLANK document (html#__next_error__, empty body) and
// a bare React #4xx in prod, stranding the user with no context and no recovery.
//
// It must be a Client Component ("use client") with the {error, reset} contract:
// `reset()` re-renders the failed segment so a transient failure (DB hiccup)
// recovers without a full reload. Branded to the Ashkeld tokens so a failure
// still reads as part of the app, not a framework default.

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
    // Surface the real error to the server/browser log for diagnosis; the digest
    // ties a user-facing report back to the server-side stack in prod.
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
