// plot-chronology-expand — add story-time chronology to plot beats.
//
// The /plot grid's X axis is CHAPTER NUMBER (reading order) — that stays, it is
// the neglect/sagging-middle spine. But a chapter's reading position is NOT its
// story-time position: loop stories, flashbacks, and "past fragments" happen in a
// different order than they are read (The Perfect Run reads CH64's Monaco century
// and CH89-90's origin loop late, though they happen chronologically first). This
// migration adds, to each beat (chapter_plotlines row), an optional STORY-TIME
// position so a reader can sort a plotline's beats by when they actually occur.
//
// Two additive columns (mirrors the summary column's NOT NULL DEFAULT convention):
//   chrono_order  integer NOT NULL DEFAULT 0  — sortable story-time rank (lower =
//                 earlier in-story). 0 = unset (falls back to chapter order). A
//                 dense integer scale the extractor assigns; ties keep chapter order.
//   chronology    text    NOT NULL DEFAULT '' — human label for that story-time
//                 position (e.g. "2020-05-08 (loop 1)", "~1996 flashback",
//                 "Monaco, ~1920s-2010s"). '' = unlabeled.
//
// ADDITIVE ONLY: two nullable-safe columns on an existing junction, no data touched.
// Fully reversible (down drops both columns). IF NOT EXISTS keeps re-runs idempotent.
// Moderate tier (unreleased greenfield): proof is expand -> columns exist + app
// boots + /plot still reads; down -> columns gone, app still boots.
//
// Apply:   npx tsx src/lib/db/migrations/plot-chronology-expand.mts
// Revert:  npx tsx src/lib/db/migrations/plot-chronology-expand.mts --down
import { loadEnv } from "../env";
import { getPool, closePool } from "../pool";

export async function migrate(): Promise<void> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `ALTER TABLE chapter_plotlines
         ADD COLUMN IF NOT EXISTS chrono_order integer NOT NULL DEFAULT 0`,
    );
    await client.query(
      `ALTER TABLE chapter_plotlines
         ADD COLUMN IF NOT EXISTS chronology text NOT NULL DEFAULT ''`,
    );
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function down(): Promise<void> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    await client.query(`ALTER TABLE chapter_plotlines DROP COLUMN IF EXISTS chrono_order`);
    await client.query(`ALTER TABLE chapter_plotlines DROP COLUMN IF EXISTS chronology`);
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
    console.log("[plot-chronology-expand] reverted: dropped chrono_order + chronology from chapter_plotlines.");
  } else {
    await migrate();
    console.log("[plot-chronology-expand] applied: added chrono_order + chronology to chapter_plotlines.");
  }
  await closePool();
}

const invokedDirectly =
  typeof process.argv[1] === "string" &&
  import.meta.url === new URL(`file://${process.argv[1].replace(/\\/g, "/")}`).href;

if (invokedDirectly) {
  main().catch(async (err) => {
    console.error("[plot-chronology-expand] failed:", err);
    await closePool();
    process.exit(1);
  });
}
