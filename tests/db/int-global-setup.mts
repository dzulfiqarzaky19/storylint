// tests/db/int-global-setup.mts — reset + seed the ISOLATED test DB (db_test,
// :5435/ashkeld_test) once before the `int` vitest project runs, so every
// `.int.test.ts` file sees the SAME deterministic fixtures regardless of
// whatever state the live dev DB (:5434/ashkeld) happens to be in.
//
// T-ARCH-8: two prior gates (T-ARCH-4/5) failed on stale-id drift because
// `.int.test.ts` files ran under plain `vitest` against the live dev DB, which
// gets reseeded/reimported by unrelated work (novel-extraction sessions, demo
// data). DEFAULT_UNIVERSE_ID fixtures rotted the moment the live DB's default
// universe stopped being named `universe-<DEFAULT_BOOK_SLUG>`. Mirrors the
// e2e suite's tests/e2e/global-setup.ts pattern, pointed at the same db_test
// Postgres e2e already uses for exactly this isolation reason.
import { execFileSync } from "node:child_process";
import { readTestDbUrl } from "./testDbUrl.mts";

export default function setup(): void {
  const url = readTestDbUrl(); // throws if .env.test doesn't point at ashkeld_test
  if (process.env.INT_SKIP_SEED === "1") {
    process.stdout.write("[int] INT_SKIP_SEED=1 — reusing existing test DB\n");
    return;
  }
  process.stdout.write("[int] db:setup (reset + seed) on isolated test DB...\n");
  execFileSync("npm", ["run", "db:setup"], {
    stdio: "inherit",
    shell: process.platform === "win32",
    env: { ...process.env, DATABASE_URL: url },
  });
}
