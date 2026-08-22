// /plot read layer (separate module, mirrors research.ts): assembles the plot
// progression VIEW — plotlines x chapters — from the plotline entries +
// chapter_plotlines beats + entry_plotlines owners, all world-scoped like /wiki.
//
// A plotline is an entry (kind='plotline'); its beats are chapter_plotlines rows
// with a per-chapter summary; its owner (a character) is an entry_plotlines edge.
// The grid the client renders is chapters (X) x lanes (Y), a cell = the beat for
// that (chapter, plotline). "Neglect" = latest chapter number minus the lane's
// last-advanced chapter number — the sagging-middle signal, computed here so the
// client is pure presentation. READ ONLY; no mutation lives here.
import { rows } from "./pool";

/** One chapter column of the grid (the X axis), ordered by number. */
export interface PlotChapter {
  id: string;
  number: number;
  title: string;
}

/** A beat = one chapter advancing one plotline (a filled grid cell). */
export interface PlotBeat {
  chapterNumber: number;
  summary: string;
}

/** One plotline row of the grid (a lane, the Y axis). */
export interface PlotLane {
  id: string;
  name: string;
  /** freeform kind label (character arc / power arc / main story / subplot). */
  label: string;
  /** the owning character's name, or null for a standalone world-level arc. */
  ownerName: string | null;
  /** beats in chapter order; the grid keys cells by chapterNumber. */
  beats: PlotBeat[];
  /** highest chapter number that advanced this lane, or null if it has no beats. */
  lastAdvanced: number | null;
  /** latestChapter - lastAdvanced (0 = current, higher = more neglected). */
  neglect: number;
}

/** The whole /plot payload for one world's active book. */
export interface PlotProgression {
  chapters: PlotChapter[];
  lanes: PlotLane[];
  /** the latest chapter number in the book (the "here" column). */
  latestChapter: number;
}

/** A raw beat row joined to its chapter number (the grouping key for a lane). */
interface BeatRow {
  plotlineId: string;
  chapterNumber: number;
  summary: string;
}

/**
 * Assemble the plot progression for one world's book. World-scoped exactly like
 * /wiki: plotline entries are filtered through world_entities on `worldId`, and
 * beats are bounded to `bookId`'s chapters so a (entry, chapter) tag from another
 * book never leaks in. Returns empty lanes/chapters (never throws) when the world
 * has no plotlines yet, so the page renders an honest empty state.
 */
export async function loadPlotProgression(
  worldId: string,
  bookId: string,
): Promise<PlotProgression> {
  // Chapters = the grid's X axis, one book, ordered by number.
  const chapters = await rows<PlotChapter>(
    `SELECT id, number, title FROM chapters WHERE book_id = $1 ORDER BY number`,
    [bookId],
  );

  // Plotline lanes = entries of kind 'plotline' VISIBLE in this world (same
  // world_entities membership /wiki reads), soft-delete filtered. `note` carries
  // the freeform kind label. LEFT JOIN entry_plotlines->entries resolves the
  // owning character's name (null = a standalone world-level arc).
  const laneRows = await rows<{
    id: string;
    name: string;
    label: string;
    ownerName: string | null;
  }>(
    `SELECT pl.id,
            pl.name,
            pl.note                       AS label,
            owner.name                    AS "ownerName"
       FROM entries pl
       JOIN world_entities we ON we.entity_id = pl.id AND we.world_id = $1
       LEFT JOIN entry_plotlines ep ON ep.plotline_id = pl.id
       LEFT JOIN entries owner ON owner.id = ep.entry_id AND owner.deleted_at IS NULL
      WHERE pl.kind = 'plotline' AND pl.deleted_at IS NULL
      ORDER BY pl.sort_order, pl.name`,
    [worldId],
  );

  // Beats = chapter_plotlines rows, joined to the chapter NUMBER (the grid key),
  // bounded to THIS book's chapters, ordered by chapter so a lane's beats are
  // chapter-ascending without a client sort.
  const beatRows = await rows<BeatRow>(
    `SELECT cp.plotline_id AS "plotlineId",
            c.number       AS "chapterNumber",
            cp.summary     AS summary
       FROM chapter_plotlines cp
       JOIN chapters c ON c.id = cp.chapter_id AND c.book_id = $1
      ORDER BY cp.plotline_id, c.number`,
    [bookId],
  );

  return assemble(chapters, laneRows, beatRows);
}

/**
 * PURE assembly (no I/O): group beats under their lane, compute lastAdvanced (the
 * highest beat chapter) and neglect (latestChapter - lastAdvanced). Extracted so
 * the neglect math is unit- and mutation-provable without a DB. A lane with no
 * beats reports lastAdvanced=null and neglect=0 (never advanced = not "neglected",
 * it simply hasn't started — the client shows it as awaiting its first beat).
 */
export function assemble(
  chapters: PlotChapter[],
  laneRows: Array<{ id: string; name: string; label: string; ownerName: string | null }>,
  beatRows: BeatRow[],
): PlotProgression {
  const latestChapter = chapters.reduce((max, c) => Math.max(max, c.number), 0);

  const beatsByLane = new Map<string, PlotBeat[]>();
  for (const b of beatRows) {
    const list = beatsByLane.get(b.plotlineId) ?? [];
    list.push({ chapterNumber: b.chapterNumber, summary: b.summary });
    beatsByLane.set(b.plotlineId, list);
  }

  const lanes: PlotLane[] = [];
  const laneById = new Map<string, PlotLane>();
  for (const l of laneRows) {
    // A plotline with N owners arrives as N rows (LEFT JOIN entry_plotlines). Fold
    // them into one lane so the grid never renders a duplicate row (which would
    // also collide on the React key). First non-null owner wins the label; the DB
    // orders owners deterministically, so this is stable.
    const existing = laneById.get(l.id);
    if (existing) {
      if (existing.ownerName === null && l.ownerName !== null) {
        existing.ownerName = l.ownerName;
      }
      continue;
    }
    const beats = beatsByLane.get(l.id) ?? [];
    const lastAdvanced =
      beats.length === 0
        ? null
        : beats.reduce((max, b) => Math.max(max, b.chapterNumber), 0);
    const neglect = lastAdvanced === null ? 0 : latestChapter - lastAdvanced;
    const lane: PlotLane = {
      id: l.id,
      name: l.name,
      label: l.label,
      ownerName: l.ownerName,
      beats,
      lastAdvanced,
      neglect,
    };
    laneById.set(l.id, lane);
    lanes.push(lane);
  }

  return { chapters, lanes, latestChapter };
}
