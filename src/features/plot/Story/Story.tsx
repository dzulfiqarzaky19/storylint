"use client";

import { useEffect, useRef, useState } from "react";
import type { PlotProgression, PlotLane } from "@/lib/db/plot";
import { useInlineRename } from "@/components/hooks/useInlineRename";
import type { PlotEdit } from "../hooks/usePlotEdit";
import { laneColor, statusLabel, buildStoryRows } from "../lib/plotModel";
import { BeatEditor } from "../components/BeatEditor";
import styles from "./Story.module.css";

export function Story({
  lane,
  chapters,
  latestChapter,
  onClose,
  edit,
}: {
  lane: PlotLane;
  chapters: PlotProgression["chapters"];
  latestChapter: number;
  onClose: () => void;
  edit: PlotEdit;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  // T-ARCH-7: shared useInlineRename hook. Plot keeps its OWN commit
  // decision, unchanged from before: a blank or unchanged trimmed draft is a
  // no-op (no onReset — this site has no reset-to-default affordance at all).
  const rename = useInlineRename(lane.name, {
    onCommit: (draft) => {
      const trimmed = draft.trim();
      if (trimmed && trimmed !== lane.name) edit.rename(lane.id, trimmed);
    },
  });
  const [editingBeat, setEditingBeat] = useState<number | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      // Escape closes the drawer only when no inline editor is capturing it.
      if (e.key === "Escape" && !rename.editing && editingBeat === null) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, rename.editing, editingBeat]);
  useEffect(() => {
    if (rename.editing) {
      rename.setDraft(lane.name);
      nameRef.current?.focus();
      nameRef.current?.select();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rename.editing, lane.name]);

  const rows = buildStoryRows(lane, chapters);
  const status = statusLabel(lane, latestChapter);
  const color = laneColor(lane);
  const pill =
    lane.state === "resolved"
      ? `\u2713 resolved \u00b7 ch.${lane.resolvedAt}`
      : lane.state === "abandoned"
        ? `dropped \u00b7 ch.${lane.resolvedAt}`
        : lane.state === "stalled"
          ? "stalled"
          : null;

  return (
    <div className={styles.scrim} onClick={onClose} data-open="true">
      <aside
        className={styles.drawer}
        role="dialog"
        aria-modal="true"
        aria-label={`Story so far, ${lane.name}`}
        style={{ ["--lane" as string]: color }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.dhead}>
          <div className={styles.dtitle}>
            {rename.editing ? (
              <input
                ref={nameRef}
                className={styles.dtitleInput}
                value={rename.draft}
                onChange={(e) => rename.setDraft(e.target.value)}
                onKeyDown={rename.onKeyDown}
                onBlur={rename.onBlur}
                aria-label="Plotline name"
              />
            ) : (
              <h2>
                Story so far &mdash; {lane.name}
                <button
                  type="button"
                  className={styles.dedit}
                  aria-label="Rename plotline"
                  onClick={() => rename.start(lane.name)}
                  disabled={edit.pending}
                >
                  rename
                </button>
              </h2>
            )}
            <button
              ref={closeRef}
              type="button"
              className={styles.dclose}
              aria-label="Close"
              onClick={onClose}
            >
              &times;
            </button>
          </div>
          <span className={styles.dkind}>{lane.label}</span>
          <span className={styles.dsub}>
            {pill ? <span className={styles.pill}>{pill}</span> : null}
            {status.text}
          </span>

          <div className={styles.dactions}>
            <span className={styles.dactionLabel}>arc state</span>
            <button
              type="button"
              className={`${styles.stateBtn} ${lane.state === "open" || lane.state === "stalled" ? styles.stateOn : ""}`}
              onClick={() => edit.setState(lane.id, "open", null)}
              disabled={edit.pending}
            >
              open
            </button>
            <button
              type="button"
              className={`${styles.stateBtn} ${lane.state === "resolved" ? styles.stateOn : ""}`}
              onClick={() => edit.setState(lane.id, "resolved", lane.lastAdvanced ?? latestChapter)}
              disabled={edit.pending}
            >
              resolved
            </button>
            <button
              type="button"
              className={`${styles.stateBtn} ${lane.state === "abandoned" ? styles.stateOn : ""}`}
              onClick={() => edit.setState(lane.id, "abandoned", lane.lastAdvanced ?? latestChapter)}
              disabled={edit.pending}
            >
              dropped
            </button>
          </div>
          {edit.error ? (
            <p className={styles.editError} role="alert">
              {edit.error}
            </p>
          ) : null}
        </div>

        <div className={styles.beatlist}>
          {rows.map((r) =>
            r.kind === "beat" ? (
              <div
                key={`b${r.chapterNumber}`}
                className={`${styles.beatrow} ${r.beat.warn ? styles.broken : ""}`}
              >
                <div className={styles.rowCh}>
                  Ch.{r.chapterNumber}
                  <small>{r.chapterTitle}</small>
                </div>
                <div className={styles.rowBody}>
                  {editingBeat === r.chapterNumber ? (
                    <BeatEditor
                      initial={r.beat.summary}
                      pending={edit.pending}
                      onSave={(text) => {
                        edit.saveBeat(lane.id, r.chapterNumber, text);
                        setEditingBeat(null);
                      }}
                      onCancel={() => setEditingBeat(null)}
                    />
                  ) : (
                    <>
                      {r.beat.summary}
                      {r.beat.warn ? (
                        <div className={styles.rowWarn}>
                          <span className={styles.glyph}>&#9888;</span>
                          {r.beat.warn}
                        </div>
                      ) : null}
                      <div className={styles.rowActions}>
                        <button
                          type="button"
                          className={styles.rowEdit}
                          onClick={() => setEditingBeat(r.chapterNumber)}
                          disabled={edit.pending}
                        >
                          edit
                        </button>
                        <button
                          type="button"
                          className={styles.rowDelete}
                          onClick={() => edit.removeBeat(lane.id, r.chapterNumber)}
                          disabled={edit.pending}
                        >
                          delete
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            ) : (
              <div key={`s${r.from}`} className={`${styles.beatrow} ${styles.stall}`}>
                <div className={styles.rowCh}>
                  Ch.{r.from}
                  {r.to > r.from ? `\u2013${r.to}` : ""}
                </div>
                <div className={styles.rowBody}>
                  arc went quiet &mdash; {r.to - r.from + 1} chapters with no beat
                </div>
              </div>
            ),
          )}
        </div>
      </aside>
    </div>
  );
}
