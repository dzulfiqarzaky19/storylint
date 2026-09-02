"use client";

import type { ChapterAppearanceRow } from "@/lib/domain/types";
import { appearLine } from "@/lib/domain/derive";
import Timeline from "./Timeline";
import styles from "./TimelineTab.module.css";

interface TimelineTabProps {
  appearances: ChapterAppearanceRow[];
}

// Timeline tab — wraps the existing Timeline component verbatim (T-WIKI-COCKPIT-1:
// tab-pane wrapper only, no behavior change inside Timeline itself).
export default function TimelineTab({ appearances }: TimelineTabProps) {
  const chapterCount = appearances.length;
  const flaggedCount = appearances.filter((a) => a.flag !== null).length;

  return (
    <div className={styles.tab}>
      <div className={styles.heading}>
        <h2 className={styles.sectionTitle}>The story so far</h2>
        <span className={styles.meta}>
          {appearLine(chapterCount, flaggedCount)}
        </span>
      </div>
      <Timeline appearances={appearances} />
    </div>
  );
}
