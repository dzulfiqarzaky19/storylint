"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import styles from "./Tabs.module.css";

export type TabKey = "overview" | "timeline" | "details" | "ties";

interface TabSpec {
  key: TabKey;
  label: string;
  /** A count pill next to the label (e.g. fact count, active-tie count). Omit for none. */
  count?: number;
  /** A dot flagging unresolved state (e.g. a contradiction in the Timeline). */
  warn?: boolean;
  panel: ReactNode;
}

interface TabsProps {
  tabs: TabSpec[];
}

/**
 * Tab shell for the focused-entry workspace (T-WIKI-COCKPIT-1). Pure UI state:
 * one tab "on" at a time, its panel rendered, the rest unmounted — mirrors the
 * prototype's `.tab`/`.panel` on-class toggle (wiki-c-cockpit.html).
 */
export default function Tabs({ tabs }: TabsProps) {
  const [active, setActive] = useState<TabKey>(tabs[0]?.key ?? "overview");
  const activeTab = tabs.find((t) => t.key === active) ?? tabs[0];

  return (
    <div className={styles.shell}>
      <div className={styles.tabs} role="tablist" aria-label="Entry sections">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={t.key === active}
            className={`${styles.tab} ${t.key === active ? styles.on : ""}`}
            onClick={() => setActive(t.key)}
          >
            {t.label}
            {t.warn && <span className={styles.warn} aria-hidden="true" />}
            {t.count !== undefined && (
              <span className={styles.pillN}>{t.count}</span>
            )}
          </button>
        ))}
      </div>
      <div className={styles.body}>{activeTab?.panel}</div>
    </div>
  );
}
