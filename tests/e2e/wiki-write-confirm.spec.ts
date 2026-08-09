import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Client } from "pg";

// Playwright does not load .env.local, but the app (and db:seed) read
// DATABASE_URL from it. Mirror the app's tiny loader (src/lib/db/env.ts) so the
// read-back client points at the SAME Postgres the server under test uses.
function databaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  for (const file of [".env.local", ".env"]) {
    try {
      const text = readFileSync(resolve(process.cwd(), file), "utf8");
      for (const raw of text.split(/\r?\n/)) {
        const line = raw.trim();
        if (!line || line.startsWith("#")) continue;
        const eq = line.indexOf("=");
        if (eq === -1) continue;
        if (line.slice(0, eq).trim() !== "DATABASE_URL") continue;
        let value = line.slice(eq + 1).trim();
        if ((value.startsWith(String.fromCharCode(34)) && value.endsWith(String.fromCharCode(34))) || (value.startsWith(String.fromCharCode(39)) && value.endsWith(String.fromCharCode(39)))) value = value.slice(1, -1);
        return value;
      }
    } catch {}
  }
  throw new Error("DATABASE_URL not found in env or .env.local for read-back");
}

// -----------------------------------------------------------------------------
// WIKI-WRITE CONFIRMATION (integration, DB read-back).
//
// PRODUCT RULE 1 — "Nothing enters the wiki without an explicit confirmation."
// smoke.spec.ts already proves the "Yes, write it in" UI flips a kept card to the
// "In the wiki" state. This file goes one layer deeper and proves the confirmed
// write actually LANDS IN POSTGRES: after the confirmation, a real `entries` row
// exists (id `prop-<propositionId>`) and its `kept_cards.in_wiki` flag is TRUE.
// It also proves the negative half of the rule — that BEFORE a confirmation, no
// such entry exists — so the read-back cannot false-green on seeded data.
//
// Deterministic on purpose: the whole flow (Keep -> Make it an entry -> Yes)
// goes through `confirmCard`, which needs NO AI, so this runs green with or
// without SAAROUTERS_API_KEY. `db:seed` TRUNCATEs kept_cards so we start from a
// clean board every run.
//
// Gotchas: Playwright drives `next start -p 3100` (production build) with a live
// Postgres; the read-back opens its own pg Client on DATABASE_URL (same env the
// app uses). Serial only (fullyParallel:false) so the DB isn't raced.
// -----------------------------------------------------------------------------

const DB_URL = databaseUrl();

test.beforeAll(() => {
  execFileSync("npm", ["run", "db:seed"], {
    stdio: "ignore",
    shell: process.platform === "win32",
  });
});

/** One-shot DB read helper; opens, queries, closes. */
async function queryOne<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
): Promise<T | null> {
  if (!DB_URL) throw new Error("DATABASE_URL not set for the read-back client");
  const client = new Client({ connectionString: DB_URL });
  await client.connect();
  try {
    const res = await client.query(sql, params);
    return (res.rows[0] as T) ?? null;
  } finally {
    await client.end();
  }
}

test("wiki write: confirming a research card LANDS the fact in Postgres (product rule 1)", async ({
  page,
}) => {
  // --- Negative half: a fresh seeded board has written NO card into the wiki. ---
  const before = await queryOne<{ n: string }>(
    "SELECT count(*)::text AS n FROM entries WHERE id LIKE 'prop-%'",
  );
  expect(before?.n).toBe("0");
  const flaggedBefore = await queryOne<{ n: string }>(
    "SELECT count(*)::text AS n FROM kept_cards WHERE in_wiki = TRUE",
  );
  expect(flaggedBefore?.n).toBe("0");

  await page.goto("/research");
  await expect(
    page.getByText("If a salt-name is a debt", { exact: false }),
  ).toBeVisible();

  // Keep a card, make it an entry, and confirm — the ONLY wiki-write path here.
  await page.getByRole("button", { name: "Keep", exact: true }).first().click();
  await page
    .getByRole("button", { name: "Make it an entry", exact: true })
    .first()
    .click();
  await expect(
    page.getByText("Yes, write it in", { exact: false }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Yes, write it in", exact: false })
    .click();

  // The UI reflects the write (guard so the read-back races nothing).
  await expect(
    page.getByText("In the wiki", { exact: false }).first(),
  ).toBeVisible();

  // --- Positive half: the fact actually persisted to Postgres. ---
  // A real entries row was written through the confirmed path (id `prop-<id>`).
  const entry = await queryOne<{ id: string; name: string }>(
    "SELECT id, name FROM entries WHERE id LIKE 'prop-%' ORDER BY sort_order DESC LIMIT 1",
  );
  expect(entry, "a prop-* entry must exist after confirmation").not.toBeNull();
  expect(entry!.id).toMatch(/^prop-/);
  expect((entry!.name ?? "").length).toBeGreaterThan(0);

  // And the kept card is flagged in_wiki = TRUE (board <-> wiki stay in sync).
  const flagged = await queryOne<{ n: string }>(
    "SELECT count(*)::text AS n FROM kept_cards WHERE in_wiki = TRUE",
  );
  expect(Number(flagged?.n)).toBeGreaterThanOrEqual(1);
});
