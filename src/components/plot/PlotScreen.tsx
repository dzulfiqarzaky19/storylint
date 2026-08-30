"use client";

// The /plot timeline: chapters (X) x plotlines (Y). Each cell is a beat CARD (the
// beat prose + arc kind), not a dot — the grid is meant to be READ, so a neglected
// arc's silence and a resolved arc's payoff are both visible at a glance. The grid
// is also EDITABLE: rename a lane, set its arc state, create/edit/delete/move a
// beat, and create/delete a lane, each via a /plot server action that revalidates
// the page. Feature parity with prototypes/plot.{html,js} (the design source).
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useInlineRename } from "@/components/hooks/useInlineRename";
import type { PlotProgression, PlotLane, PlotBeat } from "@/lib/db/plot";
import {
  renamePlotlineAction,
  setPlotlineStateAction,
  upsertBeatAction,
  deleteBeatAction,
  moveBeatAction,
  createPlotlineAction,
  deletePlotlineAction,
} from "@/lib/actions/plot";
import { type ActionResult } from "@/lib/actions/confirmation";
import styles from "./PlotScreen.module.css";

// Client-side mirror of the loader's LONG_GAP (src/lib/db/plot.ts). Redeclared
// (not imported) so this "use client" module never pulls the pg-backed loader —
// and its node-only deps (dns/fs/net/tls) — into the browser bundle. The loader
// already derives `stalled` from the same threshold; this only drives the visual
// long-gap run + the drawer's collapsed "went quiet" rows. Keep the two in sync.
const LONG_GAP = 3;

// Six low-chroma arc hues, cycled by lane.colorIndex. The values live in
// globals.css (--lane-1..6) so a theme can restate them; here we only reference
// the tokens, never a hex, so the plot grid follows the active theme.
const LANE_COLORS = [
  "var(--lane-1)",
  "var(--lane-2)",
  "var(--lane-3)",
  "var(--lane-4)",
  "var(--lane-5)",
  "var(--lane-6)",
];
const laneColor = (lane: PlotLane) => LANE_COLORS[lane.colorIndex % LANE_COLORS.length]!;

/** The lane's status readout. A resolved/abandoned arc is DONE, not neglected, so
 *  it reports its cap; an open arc reports how long since it last moved (warm past
 *  LONG_GAP); a never-started lane reads "not yet begun". Mirrors the prototype. */
function statusLabel(lane: PlotLane, here: number): { cls: string; text: string } {
  if (lane.state === "resolved")
    return { cls: "done", text: `\u2713 resolved \u00b7 ch.${lane.resolvedAt}` };
  if (lane.state === "abandoned")
    return { cls: "abandoned", text: `dropped \u00b7 ch.${lane.resolvedAt}` };
  if (lane.lastAdvanced === null) return { cls: "idle", text: "not yet begun" };
  if (lane.state === "stalled")
    return { cls: "stalled", text: `\u26a0 stalled \u00b7 ${lane.neglect} chapters quiet` };
  if (lane.neglect <= 0)
    return { cls: "fresh", text: `advanced ch.${lane.lastAdvanced} \u00b7 current` };
  if (lane.neglect >= LONG_GAP)
    return { cls: "warm", text: `\u26a0 ${lane.neglect} chapters since it moved` };
  return { cls: "cool", text: `${lane.neglect} chapters since it moved` };
}

/** Chapters strictly between two consecutive beats that form a >= LONG_GAP run —
 *  the interior stall cells. A leading/trailing gap is not a sagging middle. */
function longGapChapters(lane: PlotLane): Set<number> {
  const filled = lane.beats.map((b) => b.chapterNumber).sort((a, b) => a - b);
  const flagged = new Set<number>();
  for (let i = 0; i < filled.length - 1; i++) {
    const from = filled[i]!;
    const to = filled[i + 1]!;
    if (to - from - 1 >= LONG_GAP) {
      for (let n = from + 1; n < to; n++) flagged.add(n);
    }
  }
  return flagged;
}

type Projection = "chapter" | "arc";

/** The edit surface handed down to the grid + drawer. Each method fires a /plot
 *  server action inside a transition, then refreshes the route so the server-
 *  rendered grid reflects the write; `pending` disables controls mid-flight and
 *  `error` surfaces a failed write (the store never swallows it). Scope
 *  (worldId/bookId) is captured here so callers pass only the row-level ids. */
interface PlotEdit {
  pending: boolean;
  error: string | null;
  clearError: () => void;
  rename: (plotlineId: string, name: string) => void;
  setState: (plotlineId: string, state: "open" | "resolved" | "abandoned", resolvedAt: number | null) => void;
  saveBeat: (plotlineId: string, chapterNumber: number, summary: string) => void;
  removeBeat: (plotlineId: string, chapterNumber: number) => void;
  moveBeat: (plotlineId: string, fromChapterNumber: number, toChapterNumber: number) => void;
  createLane: (name: string) => void;
  deleteLane: (plotlineId: string) => void;
}

function usePlotEdit(worldId: string, bookId: string): PlotEdit {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Run one action, surface its error, and refresh on success so the server
  // re-reads the grid. Kept generic so every method below is a one-liner.
  const run = (fn: () => Promise<ActionResult<unknown>>) => {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) setError(res.error);
      else router.refresh();
    });
  };

  return {
    pending,
    error,
    clearError: () => setError(null),
    rename: (plotlineId, name) => run(() => renamePlotlineAction({ plotlineId, name })),
    setState: (plotlineId, state, resolvedAt) =>
      run(() => setPlotlineStateAction({ plotlineId, state, resolvedAt })),
    saveBeat: (plotlineId, chapterNumber, summary) =>
      run(() => upsertBeatAction({ bookId, plotlineId, chapterNumber, summary })),
    removeBeat: (plotlineId, chapterNumber) =>
      run(() => deleteBeatAction({ bookId, plotlineId, chapterNumber })),
    moveBeat: (plotlineId, fromChapterNumber, toChapterNumber) =>
      run(() => moveBeatAction({ bookId, plotlineId, fromChapterNumber, toChapterNumber })),
    createLane: (name) => run(() => createPlotlineAction({ worldId, name })),
    deleteLane: (plotlineId) => run(() => deletePlotlineAction({ plotlineId })),
  };
}

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

/** The "+ new plotline" affordance (feature 4, create). Collapsed to a button;
 *  clicking reveals a one-field inline form. Empty/blank name is rejected by the
 *  action, so the button just needs a non-empty submit. */
function NewPlotlineButton({ edit }: { edit: PlotEdit }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  if (!open) {
    return (
      <button
        type="button"
        className={styles.newLane}
        onClick={() => setOpen(true)}
        disabled={edit.pending}
      >
        + new plotline
      </button>
    );
  }
  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    edit.createLane(trimmed);
    setName("");
    setOpen(false);
  };
  return (
    <form
      className={styles.newLaneForm}
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <input
        ref={inputRef}
        className={styles.newLaneInput}
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setOpen(false);
            setName("");
          }
        }}
        placeholder="Plotline name"
        aria-label="New plotline name"
      />
      <button type="submit" className={styles.newLaneSave} disabled={edit.pending || !name.trim()}>
        add
      </button>
      <button
        type="button"
        className={styles.newLaneCancel}
        onClick={() => {
          setOpen(false);
          setName("");
        }}
      >
        cancel
      </button>
    </form>
  );
}

function CompletionMeter({
  completion,
}: {
  completion: PlotProgression["completion"];
}) {
  const { resolved, owed, percent } = completion;
  const tail = owed > 0 && resolved === owed ? " \u00b7 all arcs landed" : "";
  return (
    <div className={styles.meter} aria-live="polite">
      <span className={styles.meterBar}>
        <i style={{ width: `${percent}%` }} />
      </span>
      <span>
        <b>
          {resolved} of {owed}
        </b>{" "}
        arcs landed{tail}
      </span>
    </div>
  );
}

function PlotGrid({
  lanes,
  chapters,
  latestChapter,
  onOpen,
  edit,
  projection,
}: {
  lanes: PlotLane[];
  chapters: PlotProgression["chapters"];
  latestChapter: number;
  onOpen: (laneId: string) => void;
  edit: PlotEdit;
  projection: Projection;
}) {
  // The beat being dragged, keyed by lane + source chapter. A drag is HORIZONTAL
  // and lane-local: a card can only be dropped on an empty cell of its OWN lane
  // (feature 1), so the drop target checks laneId matches before accepting.
  const [drag, setDrag] = useState<{ laneId: string; from: number } | null>(null);
  // The empty cell currently being edited into a new beat (feature 2).
  const [adding, setAdding] = useState<{ laneId: string; chapter: number } | null>(null);

  // Fixed track widths (not 1fr) so the board scrolls horizontally past ~12
  // chapters instead of crushing beat cards below tap size on a long book.
  const cols = `var(--lane-col) repeat(${chapters.length}, var(--beat-col))`;

  // In chronology mode the column header carries the story-time label of the
  // earliest-ranked beat in that chapter (the same beat the reorder sorts on), so
  // a reader sees WHY a late chapter sits early. Keyed by chapter number.
  const chronoMode = projection === "arc";
  const chronoLabel = useMemo(() => {
    const label = new Map<number, string>();
    if (!chronoMode) return label;
    const rank = new Map<number, number>();
    for (const lane of lanes) {
      for (const beat of lane.beats) {
        if (beat.chronoOrder === 0 || beat.chronology === "") continue;
        const prev = rank.get(beat.chapterNumber);
        if (prev === undefined || beat.chronoOrder < prev) {
          rank.set(beat.chapterNumber, beat.chronoOrder);
          label.set(beat.chapterNumber, beat.chronology);
        }
      }
    }
    return label;
  }, [lanes, chronoMode]);

  return (
    <div
      className={styles.grid}
      style={{ gridTemplateColumns: cols }}
      role="grid"
      aria-label={chronoMode ? "Plot progression by story chronology" : "Plot progression by chapter"}
    >
      <div className={`${styles.corner} ${styles.headCell}`} role="columnheader">
        plotline &darr;&nbsp; {chronoMode ? "story-time" : "chapter"} &rarr;
      </div>
      {chapters.map((c) => {
        const chrono = chronoLabel.get(c.number);
        return (
          <div
            key={c.id}
            className={`${styles.chapHead} ${styles.headCell} ${
              c.number === latestChapter ? styles.here : ""
            }`}
            role="columnheader"
            title={chrono ? `${c.title} \u2014 ${chrono}` : c.title}
          >
            <span className={styles.chapNum}>Ch.{c.number}</span>
            <span className={styles.chapTitle}>{chrono ?? c.title}</span>
          </div>
        );
      })}

      {lanes.map((lane) => {
        const gaps = longGapChapters(lane);
        const status = statusLabel(lane, latestChapter);
        const byChapter = new Map(lane.beats.map((b) => [b.chapterNumber, b]));
        // Cells after a closed arc's cap are the greyed "past" tail (done, not quiet).
        const cap =
          lane.state === "resolved" || lane.state === "abandoned"
            ? lane.resolvedAt
            : null;
        const color = laneColor(lane);
        const draggingHere = drag?.laneId === lane.id;
        return (
          <div key={lane.id} className={styles.laneRow} role="row">
            <div
              className={styles.laneLabel}
              role="rowheader"
              tabIndex={0}
              aria-label={`Open ${lane.name} story so far`}
              onClick={() => onOpen(lane.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onOpen(lane.id);
                }
              }}
            >
              <span className={styles.laneName}>
                <span className={styles.swatch} style={{ background: color }} />
                {lane.name}
              </span>
              <span className={styles.laneKind}>{lane.label}</span>
              {lane.ownerName ? (
                <span className={styles.laneOwner}>{lane.ownerName}</span>
              ) : null}
              <span className={styles.statusRow}>
                <span className={`${styles.status} ${styles[status.cls] ?? ""}`}>
                  {status.text}
                </span>
                <button
                  type="button"
                  className={styles.laneTrash}
                  aria-label={`Delete plotline ${lane.name}`}
                  title="Delete plotline"
                  disabled={edit.pending}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm(`Delete plotline "${lane.name}"? Its beats are hidden with it.`)) {
                      edit.deleteLane(lane.id);
                    }
                  }}
                >
                  &#128465;
                </button>
              </span>
            </div>

            {chapters.map((c) => {
              const beat = byChapter.get(c.number);
              const isHere = c.number === latestChapter;
              const isEditing = adding?.laneId === lane.id && adding.chapter === c.number;
              if (beat) {
                return (
                  <div
                    key={c.id}
                    className={`${styles.cell} ${isHere ? styles.here : ""}`}
                    role="gridcell"
                  >
                    {isEditing ? (
                      <BeatEditor
                        initial={beat.summary}
                        pending={edit.pending}
                        onSave={(text) => {
                          edit.saveBeat(lane.id, c.number, text);
                          setAdding(null);
                        }}
                        onCancel={() => setAdding(null)}
                      />
                    ) : (
                      <BeatCard
                        beat={beat}
                        kind={lane.label}
                        color={color}
                        onOpen={() => setAdding({ laneId: lane.id, chapter: c.number })}
                        draggable={!edit.pending}
                        onDragStart={() => setDrag({ laneId: lane.id, from: c.number })}
                        onDragEnd={() => setDrag(null)}
                      />
                    )}
                  </div>
                );
              }
              if (cap !== null && c.number > cap) {
                return (
                  <div
                    key={c.id}
                    className={`${styles.cell} ${styles.past} ${isHere ? styles.here : ""}`}
                    role="gridcell"
                  />
                );
              }
              // An empty cell is a drop target for THIS lane's dragged card, and
              // a click-to-add slot when idle. A pending write freezes both.
              const isGap = gaps.has(c.number);
              const dropTarget = draggingHere && drag.from !== c.number;
              return (
                <div
                  key={c.id}
                  className={`${styles.cell} ${styles.empty} ${
                    isGap ? styles.longgap : ""
                  } ${isHere ? styles.here : ""} ${dropTarget ? styles.dropTarget : ""}`}
                  role="gridcell"
                  aria-label={isGap ? `arc stalled at chapter ${c.number}` : undefined}
                  onDragOver={(e) => {
                    if (dropTarget) e.preventDefault();
                  }}
                  onDrop={(e) => {
                    if (!dropTarget) return;
                    e.preventDefault();
                    edit.moveBeat(lane.id, drag.from, c.number);
                    setDrag(null);
                  }}
                >
                  {isEditing ? (
                    <BeatEditor
                      initial=""
                      pending={edit.pending}
                      onSave={(text) => {
                        edit.saveBeat(lane.id, c.number, text);
                        setAdding(null);
                      }}
                      onCancel={() => setAdding(null)}
                    />
                  ) : isGap ? (
                    <button
                      type="button"
                      className={styles.gapflag}
                      onClick={() => setAdding({ laneId: lane.id, chapter: c.number })}
                      disabled={edit.pending}
                    >
                      arc stalled
                    </button>
                  ) : (
                    <button
                      type="button"
                      className={styles.addBeat}
                      aria-label={`Add a beat to ${lane.name} at chapter ${c.number}`}
                      onClick={() => setAdding({ laneId: lane.id, chapter: c.number })}
                      disabled={edit.pending}
                    >
                      +
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

function BeatCard({
  beat,
  kind,
  color,
  onOpen,
  draggable,
  onDragStart,
  onDragEnd,
}: {
  beat: PlotBeat;
  kind: string;
  color: string;
  onOpen: () => void;
  draggable?: boolean;
  onDragStart?: () => void;
  onDragEnd?: () => void;
}) {
  const capped = beat.resolves || beat.abandons;
  return (
    <button
      type="button"
      className={`${styles.beatcard} ${beat.warn ? styles.broken : ""} ${
        capped ? styles.capped : ""
      } ${beat.abandons ? styles.abandoned : ""}`}
      style={{ ["--lane" as string]: color }}
      onClick={onOpen}
      draggable={draggable}
      onDragStart={(e) => {
        // A payload is required for Firefox to start a drag; the real move data
        // lives in React state, this is just the enabling handshake.
        e.dataTransfer.setData("text/plain", "beat");
        e.dataTransfer.effectAllowed = "move";
        onDragStart?.();
      }}
      onDragEnd={onDragEnd}
    >
      <span className={styles.beatText}>{beat.summary}</span>
      <span className={styles.beatMeta}>
        <span className={styles.beatKind}>{kind}</span>
      </span>
      {beat.resolves ? (
        <span className={styles.capnote}>&#10003; arc resolved here</span>
      ) : beat.abandons ? (
        <span className={styles.capnote}>arc dropped here</span>
      ) : null}
      {beat.warn ? (
        <span className={styles.beatWarn}>
          <span className={styles.glyph}>&#9888;</span>
          {beat.warn}
        </span>
      ) : null}
    </button>
  );
}

/** Inline beat text editor (feature 2 create + edit). A small textarea with
 *  save/cancel; Enter (no shift) saves, Escape cancels. Blank text can't save.
 *  Used both in an empty grid cell (create) and in the drawer (edit). */
function BeatEditor({
  initial,
  pending,
  onSave,
  onCancel,
}: {
  initial: string;
  pending: boolean;
  onSave: (text: string) => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState(initial);
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);
  const save = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSave(trimmed);
  };
  return (
    <div className={styles.beatEditor}>
      <textarea
        ref={ref}
        className={styles.beatInput}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            save();
          } else if (e.key === "Escape") {
            e.preventDefault();
            onCancel();
          }
        }}
        placeholder="Beat summary"
        aria-label="Beat summary"
      />
      <div className={styles.beatEditorRow}>
        <button type="button" className={styles.beatSave} onClick={save} disabled={pending || !text.trim()}>
          save
        </button>
        <button type="button" className={styles.beatCancelBtn} onClick={onCancel}>
          cancel
        </button>
      </div>
    </div>
  );
}

type Row =
  | { kind: "beat"; chapterNumber: number; chapterTitle: string; beat: PlotBeat }
  | { kind: "stall"; from: number; to: number };

/** Build the drawer's chapter-ordered "story so far": each beat is a row, and a
 *  run of >= LONG_GAP quiet chapters collapses into a single "went quiet" row so
 *  the sagging middle reads on the list too. Mirrors the prototype's openArc walk. */
function buildStoryRows(
  lane: PlotLane,
  chapters: PlotProgression["chapters"],
): Row[] {
  const gaps = longGapChapters(lane);
  const byChapter = new Map(lane.beats.map((b) => [b.chapterNumber, b]));
  const titleOf = new Map(chapters.map((c) => [c.number, c.title]));
  const rows: Row[] = [];
  let stallOpen = false;
  for (const c of chapters) {
    const beat = byChapter.get(c.number);
    if (beat) {
      stallOpen = false;
      rows.push({
        kind: "beat",
        chapterNumber: c.number,
        chapterTitle: titleOf.get(c.number) ?? "",
        beat,
      });
    } else if (gaps.has(c.number) && !stallOpen) {
      stallOpen = true;
      let end = c.number;
      while (gaps.has(end + 1)) end++;
      rows.push({ kind: "stall", from: c.number, to: end });
    }
  }
  return rows;
}

function StoryDrawer({
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
  // T-ARCH-7: shared useInlineRename hook. PlotScreen keeps its OWN commit
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
