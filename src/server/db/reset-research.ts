import { loadEnv } from "./env";
import { closePool, withTransaction } from "./pool";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export const RESEARCH_WIPE_ORDER = [
  "propositions",
  "research_turns",
  "research_threads",
] as const;

export type ResearchTable = (typeof RESEARCH_WIPE_ORDER)[number];

export function wipeOrder(): readonly ResearchTable[] {
  return RESEARCH_WIPE_ORDER;
}

export const PROTECTED_TABLES = ["entries", "chapters"] as const;

export type ProtectedTable = (typeof PROTECTED_TABLES)[number];

export type ProtectedCounts = Record<ProtectedTable, number>;

export function protectedCountsUnchanged(
  before: ProtectedCounts,
  after: ProtectedCounts,
): boolean {
  for (const table of PROTECTED_TABLES) {
    if (before[table] !== after[table]) return false;
  }
  return true;
}

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

export type ResearchBackup = Record<ResearchTable, unknown[]>;

export interface ResetResult {
  backup: ResearchBackup;
  protectedBefore: ProtectedCounts;
  protectedAfter: ProtectedCounts;
  researchBefore: Record<ResearchTable, number>;
  researchAfter: Record<ResearchTable, number>;
}

export interface ResetClient {
  query(
    text: string,
    params?: ReadonlyArray<unknown>,
  ): Promise<{ rows: unknown[] }>;
}

async function countOf(client: ResetClient, table: string): Promise<number> {
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

export async function resetResearchWithin(
  client: ResetClient,
  onBackup?: (backup: ResearchBackup) => void | Promise<void>,
): Promise<ResetResult> {
  const backup = {} as ResearchBackup;
  for (const table of wipeOrder()) {
    const res = await client.query(`SELECT * FROM ${table}`);
    backup[table] = res.rows;
  }

  if (onBackup) await onBackup(backup);

  const protectedBefore = await protectedCounts(client);
  const researchBefore = {} as Record<ResearchTable, number>;
  for (const table of wipeOrder()) {
    researchBefore[table] = await countOf(client, table);
  }

  for (const table of wipeOrder()) {
    await client.query(`DELETE FROM ${table}`);
  }

  const protectedAfter = await protectedCounts(client);
  const researchAfter = {} as Record<ResearchTable, number>;
  for (const table of wipeOrder()) {
    researchAfter[table] = await countOf(client, table);
  }

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

function backupStamp(now: Date): string {
  return now.toISOString().replace(/[:.]/g, "-");
}

export function backupPath(stamp: string): string {
  return join(process.cwd(), "backups", `research-backup-${stamp}.json`);
}

async function main(): Promise<void> {
  loadEnv();

  const stamp = backupStamp(new Date());
  const outPath = backupPath(stamp);

  const result = await withTransaction(async (client) => {
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

if (process.argv[1] && process.argv[1].endsWith("reset-research.ts")) {
  main().catch(async (err) => {
    console.error("[db:reset-research] FAILED (rolled back):", err);
    await closePool();
    process.exit(1);
  });
}
