"use client";

import { useEffect } from "react";

export default function GlobalError({
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
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#f3f2f2",
          color: "#201e1d",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <main
          role="alert"
          style={{ maxWidth: "34rem", border: "2px solid #201e1d", background: "#ffffff", padding: "2rem" }}
        >
          <h1 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 700 }}>
            storylint could not start.
          </h1>
          <p style={{ marginTop: "0.75rem", color: "#605d5d", lineHeight: 1.5 }}>
            A critical error occurred while loading the application. Try again in
            a moment.
          </p>
          <button
            type="button"
            onClick={() => reset()}
            style={{
              marginTop: "1.5rem",
              border: "2px solid #201e1d",
              background: "#201e1d",
              color: "#f3f2f2",
              padding: "0.5rem 1.25rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
