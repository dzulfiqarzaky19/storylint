// tests/db/testDbUrl.ts — resolve the isolated test-DB URL from the committed
// .env.test WITHOUT touching process.env. Used by vitest.config.mts to wire the
// `int` project's `test.env.DATABASE_URL`, and by int-global-setup.ts to spawn
// db:setup against this DB explicitly — never against whatever DATABASE_URL
// happens to be set in the caller's shell (which could be the live dev DB).
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export function readTestDbUrl(): string {
  const text = readFileSync(resolve(process.cwd(), ".env.test"), "utf8");
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    if (key !== "DATABASE_URL") continue;
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!value.includes("ashkeld_test")) {
      throw new Error(`[int] .env.test DATABASE_URL is not the test DB (got ${value}).`);
    }
    return value;
  }
  throw new Error("[int] .env.test has no DATABASE_URL line.");
}
