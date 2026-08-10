// Research-only DB wipe (F4 P0, the final phase). Clears the four research
// tables so the app starts from the REAL wiki with NO dummy research data,
// while leaving the protected wiki data (entries, chapters, and everything
// else) byte-identical.
//
// Usage: npm run db:reset-research
//
// SAFETY CONTRACT (all enforced in-script):
//   1. ONE transaction (withTransaction). Any throw -> ROLLBACK, nothing lands.
//   2. BACKUP-FIRST: before any DELETE, every row of the four research tables
//      is dumped to a timestamped JSON file under backups/. Reversible.
//   3. FK-safe, table-scoped DELETEs in a fixed order (wipeOrder()). No
//      TRUNCATE / CASCADE / wildcard / db:reset. research_turns.thread_id is
//      BARE TEXT with NO foreign key to research_threads, so turns MUST be
//      deleted before threads; propositions + kept_cards cascade off turns but
//      we delete them explicitly first (belt + suspenders).
//   4. NEGATIVE-PROOF: entries + chapters counts are captured BEFORE and AFTER.
//      If either changed, the guard throws -> ROLLBACK + exit 1. Protected data
//      can never be touched by a passing run.
//   5. All four research counts are asserted 0 after; counts are printed
//      before -> after.
//
// This module is a NODE SCRIPT, not runtime code. The destructive live run is
// executed by the coordinator against the live DB; the pure decision logic
// (wipeOrder / protectedCountsUnchanged / resetResearchWithin) is unit-tested
// with an injected fake client so the logic is mutation-provable without a DB.
import { loadEnv } from "./env";
import { getPool, closePool, withTransaction } from "./pool";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The four research tables, in the ONLY FK-safe delete order. Order is
 * behavior-bearing: research_turns has no FK from research_threads, so turns
 * must precede threads. Returned as data (not buried in the runner) so the
 * sequence itself is testable.
 */
export const RESEARCH_WIPE_ORDER = [
  "kept_cards",
  "propositions",
  "research_turns",
  "research_threads",
] as const;

export type ResearchTable = (typeof RESEARCH_WIPE_ORDER)[number];

/** The ordered list of research tables to delete (FK-safe). Pure. */
export function wipeOrder(): readonly ResearchTable[] {
  return RESEARCH_WIPE_ORDER;
}

/**
 * Protected tables whose row counts MUST be identical before and after the
 * wipe. If a wipe ever changed these, the run is aborted (rolled back).
 */
export const PROTECTED_TABLES = ["entries", "chapters"] as const;

export type ProtectedTable = (typeof PROTECTED_TABLES)[number];

export type ProtectedCounts = Record<ProtectedTable, number>;

/**
 * The protected-data guard. True only when EVERY protected table has the exact
 * same count before and after. Pure; this is the assertion the negative-proof
 * hinges on, so it is isolated and mutation-provable.
 */
export function protectedCountsUnchanged(
  before: ProtectedCounts,
  after: ProtectedCounts,
): boolean {
  for (const table of PROTECTED_TABLES) {
    if (before[table] !== after[table]) return false;
  }
  return true;
}

/** Raised when a wipe would alter protected data, forcing a ROLLBACK. */
export class ProtectedDataChangedError extends Error {
  constructor(
    public readonly before: ProtectedCounts,
    public readonly after: ProtectedCounts,
  ) {
    super(
      `Protected data changed during research wipe; rolling back. ` +
        `before=${JSON.stringify(before)} after=${JSON.stringify(after)}`,
    );
    this.name = "ProtectedDataChangedError";
  }
}

/** A backed-up row set, one entry per research table (whole rows). */
export type ResearchBackup = Record<ResearchTable, unknown[]>;

export interface ResetResult {
  backup: ResearchBackup;
  protectedBefore: ProtectedCounts;
  protectedAfter: ProtectedCounts;
  /** Research counts before the wipe, keyed by table. */
  researchBefore: Record<ResearchTable, number>;
  /** Research counts after the wipe (every value must be 0). */
  researchAfter: Record<ResearchTable, number>;
}

/**
 * Minimal client surface the reset needs. Both a real pg PoolClient and a test
 * fake satisfy it, so the core logic runs with no live DB.
 */
export interface ResetClient {
  query(
    text: string,
    params?: ReadonlyArray<unknown>,
  ): Promise<{ rows: unknown[] }>;
}

async function countOf(client: ResetClient, table: string): Promise<number> {
  // Table name is from a fixed internal allowlist (RESEARCH_WIPE_ORDER /
  // PROTECTED_TABLES), never user input, so identifier interpolation is safe.
  const res = await client.query(`SELECT count(*)::int AS n FROM ${table}`);
  const row = res.rows[0] as { n: number } | undefined;
  return row?.n ?? 0;
}

async function protectedCounts(client: ResetClient): Promise<ProtectedCounts> {
  const counts = {} as ProtectedCounts;
  for (const table of PROTECTED_TABLES) {
    counts[table] = await countOf(client, table);
  }
  return counts;
}

/**
 * The transactional core. Given a client (real or fake):
 *   1. dump all research rows (backup),
 *   2. hand the backup to onBackup (the caller persists it to disk HERE, before
 *      any DELETE, so a recovery dump exists even if a later step fails),
 *   3. record protected + research counts BEFORE,
 *   4. DELETE each research table in wipeOrder(),
 *   5. record protected + research counts AFTER,
 *   6. throw ProtectedDataChangedError if the guard fails (=> ROLLBACK),
 *   7. return the full result (counts + backup) for the caller to report.
 *
 * Throwing on a protected-count change is what makes the wipe safe: the caller
 * runs this inside withTransaction, so any throw rolls the whole thing back.
 */
export async function resetResearchWithin(
  client: ResetClient,
  onBackup?: (backup: ResearchBackup) => void | Promise<void>,
): Promise<ResetResult> {
  // 1. BACKUP-FIRST: capture every row before touching anything.
  const backup = {} as ResearchBackup;
  for (const table of wipeOrder()) {
    const res = await client.query(`SELECT * FROM ${table}`);
    backup[table] = res.rows;
  }

  // 2. Persist the backup BEFORE any destructive step, so a dump survives even
  // a mid-DELETE failure (belt + suspenders on top of the transaction).
  if (onBackup) await onBackup(backup);

  // 3. Counts BEFORE.
  const protectedBefore = await protectedCounts(client);
  const researchBefore = {} as Record<ResearchTable, number>;
  for (const table of wipeOrder()) {
    researchBefore[table] = await countOf(client, table);
  }

  // 4. DELETE in FK-safe order (table-scoped, no TRUNCATE/CASCADE).
  for (const table of wipeOrder()) {
    await client.query(`DELETE FROM ${table}`);
  }

  // 5. Counts AFTER.
  const protectedAfter = await protectedCounts(client);
  const researchAfter = {} as Record<ResearchTable, number>;
  for (const table of wipeOrder()) {
    researchAfter[table] = await countOf(client, table);
  }

  // 6. NEGATIVE-PROOF: protected data must be byte-identical, else ROLLBACK.
  if (!protectedCountsUnchanged(protectedBefore, protectedAfter)) {
    throw new ProtectedDataChangedError(protectedBefore, protectedAfter);
  }

  return {
    backup,
    protectedBefore,
    protectedAfter,
    researchBefore,
    researchAfter,
  };
}

/** Timestamp for the backup filename: 2026-08-10T06-15-00-000Z style. */
function backupStamp(now: Date): string {
  return now.toISOString().replace(/[:.]/g, "-");
}

/** Absolute path of the backup file for a given timestamp. Pure. */
export function backupPath(stamp: string): string {
  return join(process.cwd(), "backups", `research-backup-${stamp}.json`);
}

// ---------------------------------------------------------------------------
// Thin node-script wire (NOT unit-tested: no branching, just IO + printing).
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  loadEnv();

  const stamp = backupStamp(new Date());
  const outPath = backupPath(stamp);

  const result = await withTransaction(async (client) => {
    // Persist the backup to disk the instant it is captured, BEFORE any DELETE
    // runs, so the recovery dump exists on disk even if a later step throws and
    // rolls the transaction back.
    return resetResearchWithin(client, (backup) => {
      mkdirSync(join(process.cwd(), "backups"), { recursive: true });
      writeFileSync(outPath, JSON.stringify(backup, null, 2), "utf8");
    });
  });

  console.log(`[db:reset-research] backup written: ${outPath}`);
  console.log("[db:reset-research] protected (must be unchanged):");
  for (const table of PROTECTED_TABLES) {
    console.log(
      `  ${table}: ${result.protectedBefore[table]} -> ${result.protectedAfter[table]}`,
    );
  }
  console.log("[db:reset-research] research (must be 0 after):");
  for (const table of wipeOrder()) {
    console.log(
      `  ${table}: ${result.researchBefore[table]} -> ${result.researchAfter[table]}`,
    );
  }
  await closePool();
}

// Only run when invoked directly as a script, not when imported by a test.
if (process.argv[1] && process.argv[1].endsWith("reset-research.ts")) {
  main().catch(async (err) => {
    console.error("[db:reset-research] FAILED (rolled back):", err);
    await closePool();
    process.exit(1);
  });
}
