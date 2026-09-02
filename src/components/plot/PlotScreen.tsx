"use client";

// The /plot timeline: chapters (X) x plotlines (Y). Each cell is a beat CARD (the
// beat prose + arc kind), not a dot — the grid is meant to be READ, so a neglected
// arc's silence and a resolved arc's payoff are both visible at a glance. The grid
// is also EDITABLE: rename a lane, set its arc state, create/edit/delete/move a
// beat, and create/delete a lane, each via a /plot server action that revalidates
// the page. Feature parity with prototypes/plot.{html,js} (the design source).
//
// T-ARCH-11: this file is now composition only. The grid, drawer, beat card/editor,
// new-plotline button, completion meter, the usePlotEdit hook, and the pure grid
// model (plotModel.ts) each live in their own sibling module.
import { useMemo, useState } from "react";
import type { PlotProgression } from "@/lib/db/plot";
import { LANE_COLORS, type Projection } from "./plotModel";
import { usePlotEdit } from "./usePlotEdit";
import { NewPlotlineButton } from "./NewPlotlineButton";
import { CompletionMeter } from "./CompletionMeter";
import { PlotGrid } from "./PlotGrid";
import { StoryDrawer } from "./StoryDrawer";
import styles from "./PlotScreen.module.css";

export default function PlotScreen({
  progression,
  worldId,
  bookId,
}: {
  progression: PlotProgression;
  worldId: string;
  bookId: string;
}) {
  const { chapters, lanes, latestChapter, completion } = progression;
  const [projection, setProjection] = useState<Projection>("chapter");
  const [openLaneId, setOpenLaneId] = useState<string | null>(null);
  const edit = usePlotEdit(worldId, bookId);

  // "chapter" is reading order (the seeded chapter axis). "chronology" re-lays the
  // X axis in STORY-TIME: columns sort by each chapter's chrono rank, so a fragment
  // that reads late but happens early (a flashback, an origin loop) slides left. The
  // rank is the min chronoOrder of any beat in that chapter; a chapter with no
  // chrono data (rank 0) falls back to its chapter number so it stays put.
  const orderedChapters = useMemo(() => {
    if (projection === "chapter") return chapters;
    const rankByChapter = new Map<number, number>();
    for (const lane of lanes) {
      for (const beat of lane.beats) {
        if (beat.chronoOrder === 0) continue;
        const prev = rankByChapter.get(beat.chapterNumber);
        if (prev === undefined || beat.chronoOrder < prev) {
          rankByChapter.set(beat.chapterNumber, beat.chronoOrder);
        }
      }
    }
    const rankOf = (n: number) => rankByChapter.get(n) ?? n;
    return [...chapters].sort((a, b) => rankOf(a.number) - rankOf(b.number));
  }, [chapters, lanes, projection]);

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
          <NewPlotlineButton edit={edit} />
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
        <div className={styles.proj}>
          <span className={styles.projLabel}>timeline by</span>
          <div className={styles.seg} role="group" aria-label="Projection">
            <button
              type="button"
              aria-pressed={projection === "chapter"}
              onClick={() => setProjection("chapter")}
            >
              chapter
            </button>
            <button
              type="button"
              aria-pressed={projection === "arc"}
              onClick={() => setProjection("arc")}
            >
              chronology
            </button>
          </div>
        </div>

        <CompletionMeter completion={completion} />

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

        <NewPlotlineButton edit={edit} />
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
        <PlotGrid
          lanes={lanes}
          chapters={orderedChapters}
          latestChapter={latestChapter}
          onOpen={setOpenLaneId}
          edit={edit}
          projection={projection}
        />
      </section>

      {openLane ? (
        <StoryDrawer
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
