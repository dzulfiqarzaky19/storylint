// tests/e2e/global-teardown.ts — remove throwaway run artifacts after the suite.
//
// We never commit test-results/ or playwright-report/ (they are gitignored) and
// never trust a stale report — any code change means retesting the whole flow.
// This mirrors `tests/e2e/clean.mjs` so a normal `playwright test` run leaves
// the tree clean without a manual step. Set E2E_KEEP_ARTIFACTS=1 to inspect a
// failing run's traces/screenshots.
import { rm } from "node:fs/promises";
import { resolve } from "node:path";

export default async function globalTeardown(): Promise<void> {
  if (process.env.E2E_KEEP_ARTIFACTS === "1") {
    process.stdout.write("[e2e] E2E_KEEP_ARTIFACTS=1 — keeping artifacts\n");
    return;
  }
  for (const t of ["test-results", "playwright-report"]) {
    await rm(resolve(process.cwd(), t), { recursive: true, force: true }).catch(
      () => {},
    );
  }
}
