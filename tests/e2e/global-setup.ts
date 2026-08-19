// tests/e2e/global-setup.ts — seed the database ONCE before the suite.
//
// The app reads a live Postgres, and the specs share it. Seeding here (instead
// of per-file `beforeEach`) means read-only specs never pay for a reseed, and
// state-mutating specs are responsible for restoring the DB in their own
// `test.afterAll` (see _helpers/seed.ts). Set E2E_SKIP_SEED=1 to reuse an
// already-seeded DB (e.g. when iterating on a single spec).
import { execFileSync } from "node:child_process";

export default function globalSetup(): void {
  // Safety net: playwright.config.ts already overwrote DATABASE_URL to the test
  // DB (via loadTestEnv) before this runs, and execFileSync children inherit it.
  // Re-assert here so a future refactor can never silently reset the LIVE DB.
  const url = process.env.DATABASE_URL;
  if (!url || !url.includes("ashkeld_test")) {
    throw new Error(
      `[e2e] refusing db:setup: DATABASE_URL is not the test DB (got ${url}).`,
    );
  }
  if (process.env.E2E_SKIP_SEED === "1") {
    process.stdout.write("[e2e] E2E_SKIP_SEED=1 — reusing existing DB\n");
    return;
  }
  process.stdout.write(`[e2e] db:setup (reset + seed) on ${url}…\n`);
  execFileSync("npm", ["run", "db:setup"], {
    stdio: "inherit",
    shell: process.platform === "win32",
  });
}
