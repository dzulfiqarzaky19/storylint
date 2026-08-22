// TCK-PLOT migration: plotlines (reuse-wiki, Option A) EXPAND phase.
//
// Resolves the plot-progression-spec's settled storage fork (spec 320-349): a
// plotline is NOT a dedicated table. It is a wiki ENTRY of a new 'plotline'
// category, so it inherits entry CRUD + cards + the confirm-gate write-back for
// free (and soft-delete via entries.deleted_at). name/intent/state/kind/stakes/
// expected_resolution live as FACTS on that entry, never as columns here.
//
// The ONLY net-new storage is the two edge junctions, mirroring the existing
// world_entities / entry_facets junction convention (text FKs, ON DELETE CASCADE,
// no soft-delete column — a junction is a pure edge that dies with either endpoint):
//   chapter_plotlines(chapter_id -> chapters.id, plotline_id -> entries.id, summary)
//     THE per-chapter tag / neglect spine; `summary` is the per-beat note (what the
//     chapter did to the arc), NOT NULL DEFAULT '' so a bare tag needs no prose.
//   entry_plotlines(entry_id -> entries.id, plotline_id -> entries.id)
//     a character (or any entry) OWNS an arc; absence of a row = a standalone
//     world-level arc. BOTH ends FK entries(id) = the one-graph model (a cross-edge
//     resolves against the SAME entries table as every entity).
//
// ADDITIVE ONLY: seeds one category row + creates two tables. Touches no existing
// column. Fully reversible (down drops both tables + deletes the seeded category
// IF it has no plotline entries left). IF NOT EXISTS / ON CONFLICT keep re-runs
// idempotent. Moderate tier (unreleased greenfield, no prod data): proof is
// expand -> tables+FKs exist; down -> clean rollback; app still boots.
//
// Apply:   npx tsx src/lib/db/migrations/plot-plotlines-expand.mts
// Revert:  npx tsx src/lib/db/migrations/plot-plotlines-expand.mts --down
import { loadEnv } from "../env";
import { getPool, closePool } from "../pool";

const PLOTLINE_CATEGORY_ID = "plotline";

export async function migrate(): Promise<void> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");

    // 1. Seed the 'plotline' entry category. is_builtin=true + world_id NULL mirror
    //    the 4 shipped built-ins (a plotline kind must resolve in ANY world, like
    //    'character'/'lore'). Its own shelf 'plots' keeps arcs off the wiki shelves.
    //    ON CONFLICT DO NOTHING => idempotent; a pre-existing row is left untouched.
    //
    //    FOLLOW-UP for the /plot wiring ticket (out of scope here): the domain
    //    `Shelf` union (types.ts:5) is "people"|"places"|"orders"|"lore" — it does
    //    NOT yet include 'plots'. Nothing traverses this category today (the wiki
    //    composition filters to `id in KIND_SHELF`, the 4 built-ins), so app-boot is
    //    unaffected; but whoever wires /plot must extend `Shelf` + SHELF_TITLES +
    //    KIND_SHELF to cover 'plots' before rendering it on a shelf.
    await client.query(
      `INSERT INTO categories (id, label, shelf, sort_order, is_builtin)
         VALUES ($1, 'Plotlines', 'plots', 4, true)
       ON CONFLICT (id) DO NOTHING`,
      [PLOTLINE_CATEGORY_ID],
    );

    // 2. chapter_plotlines — the per-chapter tag / neglect spine. Composite PK
    //    dedupes a (chapter, plotline) pair; both FKs CASCADE so deleting a chapter
    //    or a plotline entry cleans its tags. `summary` is the per-beat note.
    await client.query(
      `CREATE TABLE IF NOT EXISTS chapter_plotlines (
         chapter_id   text NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
         plotline_id  text NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
         summary      text NOT NULL DEFAULT '',
         PRIMARY KEY (chapter_id, plotline_id)
       )`,
    );

    // 3. entry_plotlines — a character (or any entry) OWNS an arc. Composite PK
    //    dedupes an (entry, plotline) pair; both ends FK entries(id) (the one-graph
    //    model). No row for a plotline = a standalone world-level arc.
    await client.query(
      `CREATE TABLE IF NOT EXISTS entry_plotlines (
         entry_id     text NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
         plotline_id  text NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
         PRIMARY KEY (entry_id, plotline_id)
       )`,
    );

    // Indexes for the reverse lookups the /plot view needs: "which plotlines does
    // this chapter/entry touch" AND "which chapters/entries touch this plotline".
    // The composite PKs already index the leading column, so only the trailing-key
    // reverse indexes are net-new.
    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_chapter_plotlines_plotline ON chapter_plotlines (plotline_id)`,
    );
    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_entry_plotlines_plotline ON entry_plotlines (plotline_id)`,
    );

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

// Reversible down: drop the two junctions, then remove the seeded 'plotline'
// category — but ONLY when no plotline entries remain, so a rollback never orphans
// real arcs a user authored (their entries.kind would dangle to a deleted category).
// DROP TABLE IF EXISTS / the guarded delete keep it idempotent and safe to re-run.
export async function down(): Promise<void> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");

    await client.query(`DROP TABLE IF EXISTS chapter_plotlines`);
    await client.query(`DROP TABLE IF EXISTS entry_plotlines`);

    // Delete the seeded category only if it owns NO entries (live or soft-deleted),
    // so we never strand a real plotline entry on a missing kind FK. If any remain,
    // leave the category in place (the tables are gone, but the arcs survive as
    // orphan-free wiki entries the user can still see/edit).
    const inUse = await client.query<{ n: string }>(
      `SELECT count(*) AS n FROM entries WHERE kind = $1`,
      [PLOTLINE_CATEGORY_ID],
    );
    if (Number(inUse.rows[0]?.n ?? "0") === 0) {
      await client.query(`DELETE FROM categories WHERE id = $1`, [
        PLOTLINE_CATEGORY_ID,
      ]);
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
  const isDown = process.argv.includes("--down");
  if (isDown) {
    await down();
    console.log(
      "[plot-plotlines-expand] reverted: dropped chapter_plotlines + entry_plotlines; " +
        "removed 'plotline' category if unused.",
    );
  } else {
    await migrate();
    console.log(
      "[plot-plotlines-expand] applied: seeded 'plotline' category + created " +
        "chapter_plotlines + entry_plotlines junctions (reuse-wiki, Option A).",
    );
  }
  await closePool();
}

// Run only when invoked directly (npx tsx …/plot-plotlines-expand.mts [--down]),
// never on import — so a test/verify harness can import { migrate, down } without
// the module self-executing against whatever DATABASE_URL happens to be set.
const invokedDirectly =
  typeof process.argv[1] === "string" &&
  import.meta.url === new URL(`file://${process.argv[1].replace(/\\/g, "/")}`).href;

if (invokedDirectly) {
  main().catch(async (err) => {
    console.error("[plot-plotlines-expand] failed:", err);
    await closePool();
    process.exit(1);
  });
}

