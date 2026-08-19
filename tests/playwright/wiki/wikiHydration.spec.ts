import { test, expect, type Page } from "@playwright/test";

// TCK-E04: /wiki must hydrate cleanly — ZERO React hydration errors (notably
// React error #418 "Hydration failed…/Text content did not match") on a CLEAN
// load, and none after a short interaction either.
//
// The gate is HARD: any pageerror or console React-hydration error on /wiki
// fails this spec, which fails the whole gate. We attach the collectors BEFORE
// navigation so the very first client render is observed.

// React prod-minified hydration signatures. #418/#423/#425 are the hydration
// family; the message text ("Hydration failed", "did not match") appears in the
// dev build. We match either so the assertion holds against the prod bundle.
const HYDRATION_SIGNATURE =
  /(Minified React error #(418|423|425))|Hydration failed|did not match|hydrat/i;

function attachErrorCollectors(page: Page): { errors: string[] } {
  const errors: string[] = [];
  page.on("pageerror", (err) => {
    errors.push(`pageerror: ${err.message}`);
  });
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      errors.push(`console.error: ${msg.text()}`);
    }
  });
  return { errors };
}

test("/wiki hydrates with zero React hydration errors on a clean load", async ({
  page,
}) => {
  const { errors } = attachErrorCollectors(page);

  await page.goto("/wiki");
  await page.waitForLoadState("networkidle");
  // "Screen mounted + hydrated" signal that does NOT depend on any specific
  // seeded DB row (the suite shares a live Postgres other agents mutate): the
  // wiki shell's world-index rail is always present once the page renders.
  await expect(page.getByRole("navigation", { name: "The world" })).toBeVisible();

  const hydrationErrors = errors.filter((e) => HYDRATION_SIGNATURE.test(e));
  expect(
    hydrationErrors,
    `Expected no hydration errors on clean /wiki load. Saw:\n${errors.join("\n") || "(none)"}`,
  ).toEqual([]);
});

test("/wiki stays hydration-clean through a short interaction", async ({
  page,
}) => {
  const { errors } = attachErrorCollectors(page);

  await page.goto("/wiki");
  await page.waitForLoadState("networkidle");
  const worldIndex = page.getByRole("navigation", { name: "The world" });
  await expect(worldIndex).toBeVisible();

  // Short interaction: click the first control in the world index (whatever the
  // shared DB currently holds), which re-renders the wiki client tree — a common
  // place a latent mismatch surfaces once the client takes over. Keying off the
  // rail (not a seeded name) keeps the gate stable against concurrent DB writes.
  await worldIndex.locator("button").first().click();
  await page.waitForLoadState("networkidle");

  const hydrationErrors = errors.filter((e) => HYDRATION_SIGNATURE.test(e));
  expect(
    hydrationErrors,
    `Expected no hydration errors after interaction. Saw:\n${errors.join("\n") || "(none)"}`,
  ).toEqual([]);
});
