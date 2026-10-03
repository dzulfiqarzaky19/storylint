"use client";

import type { ReactNode } from "react";
import styles from "../Thread.module.css";

export interface ComposerProps {
  children: ReactNode;
  ai?: {
    value: string;
    onChange: (value: string) => void;
    onSubmit: () => void;
    busy: boolean;
  };
}

export default function Composer({ children, ai }: ComposerProps) {
  return (
    <div className={styles.composer}>
      {ai ? (
        <div className={styles.aiRow}>
          <input
            className={styles.aiInput}
            type="text"
            value={ai.value}
            disabled={ai.busy}
            placeholder="Type anything. Half a thought is enough."
            aria-label="Ask the research AI"
            onChange={(e) => ai.onChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                ai.onSubmit();
              }
            }}
          />
          <button
            type="button"
            className={styles.aiSend}
            disabled={ai.busy || ai.value.trim().length === 0}
            onClick={ai.onSubmit}
          >
            {ai.busy ? "Thinking…" : "Ask"}
          </button>
        </div>
      ) : (
        <div className={styles.composerPlaceholder}>
          Type anything. Half a thought is enough.
        </div>
      )}
      <div className={styles.chips}>{children}</div>
    </div>
  );
}
