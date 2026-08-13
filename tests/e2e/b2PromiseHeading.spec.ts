import { test, expect } from "@playwright/test";

// TCK-HF2W-B2 [trivial]: the Write OutstandingRail's closing promise copy
// ("Nothing enters the gazetteer until you write it in.") was a styled <div>
// (.promiseHead) with no heading semantics. Promote it to an <h2> so it exposes
// a heading role/level in the accessibility tree. The enclosing <aside> already
// carries aria-label="Outstanding marks" (a labelled complementary landmark), so
// this only adds the missing heading — it does NOT touch the landmark.
//
// No visual regression: globals.css has a universal reset (*{margin:0;padding:0}),
// and .promiseHead sets its own font-size/weight/line-height explicitly, so a
// <div>->/<h2> swap is pixel-identical. Markup-only, no behaviour-bearing logic,
// so no mutation-proof (trivial tier).
//
// GATE SHAPE: the OutstandingRail (and its promise block) renders on /write
// unconditionally — the promise copy is not gated on marks — so it is
// SEED-REACHABLE. We assert the mounted heading in the a11y tree directly.

test("Write OutstandingRail promise head is exposed as a level-2 heading in the a11y tree", async ({
  page,
}) => {
  await page.goto("/write");
  await page.waitForLoadState("networkidle");

  // The promise copy is exposed as a heading with the right accessible name.
  const heading = page.getByRole("heading", {
    name: /Nothing enters the gazetteer until you write it in\./,
  });
  await expect(heading).toBeVisible();

  // It is specifically an <h2> (level 2) — the first section heading inside the
  // labelled complementary landmark, so it does not skip from the page <h1>. An
  // <h2> carries an IMPLICIT aria-level of 2 (no explicit aria-level attribute),
  // so asserting the tagName is the correct level check.
  await expect(heading).toHaveJSProperty("tagName", "H2");
  expect(await heading.getAttribute("aria-level")).toBeNull(); // implicit, not overridden

  // Sanity: it lives inside the "Outstanding marks" complementary landmark.
  const rail = page.getByRole("complementary", { name: "Outstanding marks" });
  await expect(rail.getByRole("heading", { name: /Nothing enters the gazetteer/ })).toBeVisible();
});

test("source of truth: promiseHead is an <h2>, not a <div>", () => {
  const { readFileSync } = require("node:fs") as typeof import("node:fs");
  const { join } = require("node:path") as typeof import("node:path");
  const src = readFileSync(
    join(process.cwd(), "src/components/write/OutstandingRail.tsx"),
    "utf8",
  );
  // The promise head element is an <h2> carrying the styles.promiseHead class.
  expect(src).toMatch(/<h2 className=\{styles\.promiseHead\}>/);
  // No <div> still wears the promiseHead class (the old markup is gone).
  expect(src).not.toMatch(/<div className=\{styles\.promiseHead\}>/);
});
