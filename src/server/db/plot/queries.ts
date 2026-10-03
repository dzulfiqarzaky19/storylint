import { rows } from "@/server/db/pool";
import type { PlotBeat, PlotChapter, PlotLane, PlotProgression, PlotState } from "@/domain/plot";

interface BeatRow {
  plotlineId: string;
  chapterNumber: number;
  summary: string;
}

export async function loadPlotProgression(
  worldId: string,
  bookId: string,
): Promise<PlotProgression> {
  const chapters = await rows<PlotChapter>(
    `SELECT id, number, title FROM chapters WHERE book_id = $1 ORDER BY number`,
    [bookId],
  );

  const laneRows = await rows<{
    id: string;
    name: string;
    label: string;
    stateTag: string;
    ownerName: string | null;
  }>(
    `SELECT pl.id,
            pl.name,
            pl.note                       AS label,
            pl.summary                    AS "stateTag",
            owner.name                    AS "ownerName"
       FROM entries pl
       JOIN world_entries we ON we.entry_id = pl.id AND we.world_id = $1
       LEFT JOIN entry_plotlines ep ON ep.plotline_id = pl.id
       LEFT JOIN entries owner ON owner.id = ep.entry_id AND owner.deleted_at IS NULL
      WHERE pl.category_id = 'plotline' AND pl.deleted_at IS NULL
      ORDER BY pl.sort_order, pl.name`,
    [worldId],
  );

  const beatRows = await rows<BeatRow>(
    `SELECT b.plotline_id AS "plotlineId",
            c.number      AS "chapterNumber",
            b.summary     AS summary
       FROM beats b
       JOIN chapters c ON c.id = b.chapter_id AND c.book_id = $1
      ORDER BY b.plotline_id, c.number`,
    [bookId],
  );

  return assemble(chapters, laneRows, beatRows);
}

export const LONG_GAP = 3;

export function parseBeat(chapterNumber: number, raw: string): PlotBeat {
  let rest = raw;
  const resolves = /\u2691resolves$/.test(rest);
  const abandons = /\u2691abandons$/.test(rest);
  rest = rest.replace(/\s*\u2691(resolves|abandons)$/, "");
  const [text, ...warnParts] = rest.split("\u26a0");
  const warn = warnParts.length > 0 ? warnParts.join("\u26a0").trim() : null;
  return { chapterNumber, summary: (text ?? "").trim(), warn, resolves, abandons };
}

export function deriveState(
  tag: string,
  lastAdvanced: number | null,
  latestChapter: number,
): { state: PlotState; resolvedAt: number | null } {
  const [rawState, rawAt] = (tag ?? "").trim().split(":");
  const at = rawAt ? Number(rawAt) : lastAdvanced;
  if (rawState === "resolved") return { state: "resolved", resolvedAt: at };
  if (rawState === "abandoned") return { state: "abandoned", resolvedAt: at };
  const quiet = lastAdvanced === null ? 0 : latestChapter - lastAdvanced;
  if (rawState === "stalled" || quiet >= LONG_GAP)
    return { state: "stalled", resolvedAt: null };
  return { state: "open", resolvedAt: null };
}

export function assemble(
  chapters: PlotChapter[],
  laneRows: Array<{ id: string; name: string; label: string; stateTag: string; ownerName: string | null }>,
  beatRows: BeatRow[],
): PlotProgression {
  const latestChapter = chapters.reduce((max, c) => Math.max(max, c.number), 0);

  const beatsByLane = new Map<string, PlotBeat[]>();
  for (const b of beatRows) {
    const list = beatsByLane.get(b.plotlineId) ?? [];
    list.push(parseBeat(b.chapterNumber, b.summary));
    beatsByLane.set(b.plotlineId, list);
  }

  const lanes: PlotLane[] = [];
  const laneById = new Map<string, PlotLane>();
  for (const l of laneRows) {
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
    const { state, resolvedAt } = deriveState(l.stateTag, lastAdvanced, latestChapter);
    const neglect =
      lastAdvanced === null || state === "resolved" || state === "abandoned"
        ? 0
        : latestChapter - lastAdvanced;
    const lane: PlotLane = {
      id: l.id,
      name: l.name,
      label: l.label,
      ownerName: l.ownerName,
      beats,
      lastAdvanced,
      neglect,
      state,
      resolvedAt,
      colorIndex: lanes.length,
    };
    laneById.set(l.id, lane);
    lanes.push(lane);
  }

  const resolved = lanes.filter((l) => l.state === "resolved").length;
  const owed = lanes.filter((l) => l.state !== "abandoned").length;
  const percent = owed === 0 ? 0 : Math.round((resolved / owed) * 100);

  return { chapters, lanes, latestChapter, completion: { resolved, owed, percent } };
}
