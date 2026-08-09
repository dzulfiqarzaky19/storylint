"use client";

import type { ReactNode } from "react";
import styles from "./ResearchScreen.module.css";

export interface ComposerProps {
  /** The prompt chip row (rendered by the screen so chips carry handlers). */
  children: ReactNode;
  /** AI ask box (optional; only shown when AI is configured). */
  ai?: {
    value: string;
    onChange: (value: string) => void;
    onSubmit: () => void;
    busy: boolean;
  };
}

/**
 * Left side of the footer. When `ai` is provided, a real input replaces the
 * static placeholder: the writer types a question/half-thought and Enter (or
 * "Ask") sends it to the grounded AI. Otherwise the verbatim static placeholder
 * is kept (README §Screen 2.5). The prompt chip row renders below either way.
 */
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
