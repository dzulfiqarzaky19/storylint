// tests/e2e/_helpers/seed.ts — reset the database to the canonical fixtures.
//
// The suite seeds ONCE up front (via globalSetup / `npm run db:setup`). Specs
// run alphabetically over a shared Postgres, so any spec that PERSISTS runtime
// state (resolved_marks, kept_cards, entries, ...) must leave the DB pristine
// for later-sorting files. The rule we follow: a state-mutating spec calls
// `reseed()` in its OWN `test.afterAll` — never in `beforeEach` (a per-test
// full reseed is correct but needlessly slow, and read-only specs should never
// pay for it).
//
//   import { reseed } from "./_helpers/seed";
//   test.afterAll(reseed);
import { execFileSync } from "node:child_process";

/** Run `npm run db:seed` synchronously (TRUNCATE + reinsert the fixtures). */
export function reseed(): void {
  execFileSync("npm", ["run", "db:seed"], {
    stdio: "ignore",
    shell: process.platform === "win32",
  });
}

/** Full reset (drops + recreates schema, then seeds). Use when the schema changed. */
export function resetAndSeed(): void {
  execFileSync("npm", ["run", "db:setup"], {
    stdio: "ignore",
    shell: process.platform === "win32",
  });
}
