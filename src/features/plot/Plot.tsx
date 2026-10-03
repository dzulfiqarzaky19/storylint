"use client";

import { useState } from "react";
import type { PlotProgression } from "@/domain/plot";
import { LANE_COLORS } from "./lib/plotModel";
import { usePlotEdit } from "./hooks/usePlotEdit";
import { NewPlotline } from "./NewPlotline";
import { Meter } from "./Meter";
import { Grid } from "./Grid/Grid";
import { Story } from "./Story/Story";
import styles from "./Plot.module.css";

export default function Plot({
  progression,
  worldId,
  bookId,
}: {
  progression: PlotProgression;
  worldId: string;
  bookId: string;
}) {
  const { chapters, lanes, latestChapter, completion } = progression;
  const [openLaneId, setOpenLaneId] = useState<string | null>(null);
  const edit = usePlotEdit(worldId, bookId);

  const openLane = lanes.find((l) => l.id === openLaneId) ?? null;

  if (lanes.length === 0) {
    return (
      <main className={styles.screen}>
        <header className={styles.head}>
          <p className={styles.kicker}>Plot</p>
          <h1 className={styles.title}>Nothing plotted yet</h1>
          <p className={styles.empty}>
            This world has no plotlines. Add a beat to a chapter and it appears
            here as an arc across the grid.
          </p>
          <NewPlotline edit={edit} />
          {edit.error ? (
            <p className={styles.editError} role="alert">
              {edit.error}
            </p>
          ) : null}
        </header>
      </main>
    );
  }

  return (
    <main className={styles.screen}>
      <div className={styles.toolbar}>
        <Meter completion={completion} />

        <div className={styles.legend}>
          <span>
            <i className={styles.legendBar} style={{ background: LANE_COLORS[0] }} /> arc advanced
          </span>
          <span>
            <i className={styles.legendWarn} /> breaks canon
          </span>
          <span>
            <i className={styles.legendGap} /> gap &mdash; arc went quiet
          </span>
        </div>

        <NewPlotline edit={edit} />
      </div>

      {edit.error ? (
        <p className={styles.editError} role="alert">
          {edit.error}
          <button type="button" onClick={edit.clearError} aria-label="Dismiss error">
            &times;
          </button>
        </p>
      ) : null}

      <section className={styles.board} aria-label="Plot timeline">
        <Grid
          lanes={lanes}
          chapters={chapters}
          latestChapter={latestChapter}
          onOpen={setOpenLaneId}
          edit={edit}
        />
      </section>

      {openLane ? (
        <Story
          lane={openLane}
          chapters={chapters}
          latestChapter={latestChapter}
          onClose={() => setOpenLaneId(null)}
          edit={edit}
        />
      ) : null}
    </main>
  );
}
