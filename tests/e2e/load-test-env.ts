// tests/e2e/load-test-env.ts — force the e2e suite onto the ISOLATED test DB.
//
// Read by playwright.config.ts BEFORE anything connects. It overwrites
// process.env.DATABASE_URL from the committed .env.test so every e2e process —
// this runner, the db:reset/db:seed children spawned by global-setup, and the
// `next start -p 3100` webServer — all point at :5435/ashkeld_test, never the
// live dev DB on :5434/ashkeld.
//
// Unlike src/lib/db/env.ts (which never overrides an already-set DATABASE_URL),
// this deliberately OVERWRITES it: if a shell already exported the live URL, we
// must still win so tests can never reset live data. It returns the URL so the
// config can hand it to the webServer command explicitly.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export function loadTestEnv(): string {
  const text = readFileSync(resolve(process.cwd(), ".env.test"), "utf8");
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value; // overwrite: the test DB must always win
  }
  const url = process.env.DATABASE_URL;
  if (!url || !url.includes("ashkeld_test")) {
    throw new Error(
      `[e2e] refusing to run: DATABASE_URL is not the test DB (got ${url}). ` +
        "Check .env.test — the e2e suite must never touch the live database.",
    );
  }
  return url;
}
