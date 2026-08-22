// Idempotent /plot demo seed: plotline ENTRIES (kind='plotline') + their owner
// links (entry_plotlines) + per-chapter beats (chapter_plotlines), all grounded
// in the REAL seeded book-1 arcs so /plot shows true data, not fixtures.
//
// A plotline reuses the wiki entry machinery (spec Option A): each arc is an
// `entries` row with kind='plotline', made world-visible via world_entities (the
// same membership every entry needs), owned by a character via entry_plotlines
// (absent = a standalone world-level arc), and advanced chapter-by-chapter via
// chapter_plotlines(chapter_id, plotline_id, summary) — the beats.
//
// The Maren arc reproduces the canonical "Story so far, Maren Vell" example from
// the spec verbatim, INCLUDING the two canon-break beats (Ch.4 oath, Ch.7 grey)
// whose contradiction text mirrors what the wiki-check engine already computes.
//
// ON CONFLICT DO NOTHING everywhere => safe to re-run; never overwrites an edit.
//
// Run:  npx tsx src/lib/db/seed-plot.ts
import { loadEnv } from "./env";
import { getPool, closePool } from "./pool";
import { DEFAULT_UNIVERSE_ID, DEFAULT_WORLD_ID } from "./scope";

interface PlotlineSeed {
  id: string;
  name: string;
  /** kind label the grid reads (power arc / main story / character arc / subplot). */
  label: string;
  /** the entry that OWNS this arc (a character), or null for a standalone arc. */
  ownerEntryId: string | null;
  /** beats keyed by chapter id; summary is the one-line "what advanced here". */
  beats: Array<{ chapterId: string; summary: string }>;
}

// Arcs grounded in the real book-1 chapters (ch1..ch7) and characters
// (maren / halvard). Labels double as the plotline entry's `note` (a freeform
// kind tag the AI reads for flavor, per spec §242 — label only, no behavior).
const PLOTLINES: PlotlineSeed[] = [
  {
    id: "pl-maren",
    name: "Maren's reckoning",
    label: "character arc",
    ownerEntryId: "maren",
    beats: [
      { chapterId: "ch1", summary: "Lights the Verge alone for the first time, three days after the funeral." },
      { chapterId: "ch2", summary: "Reads a salt-name on the harbour wall and tells no one whose it is." },
      { chapterId: "ch3", summary: "Counts forty-one names struck from her uncle's ledger and says nothing." },
      { chapterId: "ch4", summary: "Swears the Lantern Oath at nineteen, out of season." },
      { chapterId: "ch5", summary: "Refuses Halvard's berth out to the drowned quarter." },
      { chapterId: "ch6", summary: "Asks Idra about the empty chair, and is told to go and light her lamp." },
      { chapterId: "ch7", summary: "Meets the Ferrier at low water. Her eyes are described as grey." },
    ],
  },
  {
    id: "pl-power",
    name: "The Lantern Oath binds",
    label: "power arc",
    ownerEntryId: "maren",
    beats: [
      { chapterId: "ch1", summary: "The Verge answers her hand — the first sign the oath is taking hold." },
      { chapterId: "ch4", summary: "The oath, sworn out of season, costs her more than she is told." },
    ],
  },
  {
    id: "pl-mainstory",
    name: "Who struck the ledger",
    label: "main story",
    ownerEntryId: null,
    beats: [
      { chapterId: "ch3", summary: "Forty-one names struck — someone is unmaking the drift roll on purpose." },
      { chapterId: "ch6", summary: "The empty chair names the one who profits if the roll stays broken." },
      { chapterId: "ch7", summary: "The Ferrier confirms the strike was paid for, not lost." },
    ],
  },
  {
    id: "pl-ferrymen",
    name: "Halvard's berth",
    label: "subplot",
    ownerEntryId: "halvard",
    beats: [
      { chapterId: "ch5", summary: "Offers Maren the berth she refuses — his own passage out goes with it." },
    ],
  },
];

// The two canon breaks from the canonical example, attached to their beat. These
// mirror marks the wiki-check engine already derives; seeded as beat prose so the
// grid can DISPLAY the break anchored to the chapter without a live check run.
const BEAT_WARNINGS: Record<string, string> = {
  "ch4:pl-maren": 'contradicts "The Lantern Oath — sworn at twenty-one"',
  "ch7:pl-maren": "entry says her eyes are green",
};

export async function seedPlot(): Promise<void> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    // Derive the universe from the target world rather than trusting a constant —
    // a fresh reseed can rebuild ids, so we read the FK target we actually need.
    const uni = await client.query<{ universe_id: string }>(
      `SELECT universe_id FROM worlds WHERE id = $1`,
      [DEFAULT_WORLD_ID],
    );
    const universeId = uni.rows[0]?.universe_id ?? DEFAULT_UNIVERSE_ID;
    for (const pl of PLOTLINES) {
      // 1. The plotline as an entry (kind='plotline'). catalogue_no/shelf mirror the
      //    entry contract; note carries the freeform kind label. universe stamped so
      //    it satisfies the NOT NULL universe_id FK like every entry.
      await client.query(
        `INSERT INTO entries (id, kind, name, catalogue_no, note, summary, shelf, sort_order, universe_id)
           VALUES ($1, 'plotline', $2, $3, $4, '', 'plots', 0, $5)
         ON CONFLICT (id) DO NOTHING`,
        [pl.id, pl.name, `PL-${pl.id}`, pl.label, universeId],
      );
      // 2. World membership — the same junction /wiki + /research read to scope an
      //    entry to a world, so /plot's world-scoped read sees the arc.
      await client.query(
        `INSERT INTO world_entities (world_id, entity_id)
           VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [DEFAULT_WORLD_ID, pl.id],
      );
      // 3. Owner link (a character owns this arc), when the arc isn't standalone.
      if (pl.ownerEntryId) {
        await client.query(
          `INSERT INTO entry_plotlines (entry_id, plotline_id)
             VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [pl.ownerEntryId, pl.id],
        );
      }
      // 4. Beats — the per-chapter tag with its summary; the neglect/grid spine.
      for (const b of pl.beats) {
        const warn = BEAT_WARNINGS[`${b.chapterId}:${pl.id}`];
        const summary = warn ? `${b.summary}  \u26a0 ${warn}` : b.summary;
        await client.query(
          `INSERT INTO chapter_plotlines (chapter_id, plotline_id, summary)
             VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
          [b.chapterId, pl.id, summary],
        );
      }
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

async function main(): Promise<void> {
  loadEnv();
  await seedPlot();
  console.log(
    `[seed-plot] applied: ${PLOTLINES.length} plotline entries + owner links + beats ` +
      "(grounded in book-1 ch1-7).",
  );
  await closePool();
}

const invokedDirectly =
  typeof process.argv[1] === "string" &&
  import.meta.url === new URL(`file://${process.argv[1].replace(/\\/g, "/")}`).href;

if (invokedDirectly) {
  main().catch(async (err) => {
    console.error("[seed-plot] failed:", err);
    await closePool();
    process.exit(1);
  });
}
