// tests/e2e/clean.mjs — remove Playwright run artifacts.
//
// Rationale: we never commit test-results/ or playwright-report/ (they are
// gitignored) and we never trust a stale report — any code change means we
// retest the whole flow anyway. So these dirs are pure throwaway. This script
// deletes them deterministically on any OS (avoids `rm -rf` vs `rmdir /s`
// shell differences). Wire it as an npm script (`e2e:clean`) and/or call it
// from a globalTeardown so every run leaves the tree clean.
import { rm, stat } from "node:fs/promises";
import { resolve } from "node:path";

const targets = ["test-results", "playwright-report"];

const root = process.cwd();
await Promise.all(
  targets.map(async (t) => {
    const path = resolve(root, t);
    const existed = await stat(path).then(
      () => true,
      () => false,
    );
    try {
      await rm(path, { recursive: true, force: true });
      if (existed) process.stdout.write(`[e2e:clean] removed ${t}\n`);
    } catch (err) {
      process.stdout.write(`[e2e:clean] skip ${t}: ${err.message}\n`);
    }
  }),
);
