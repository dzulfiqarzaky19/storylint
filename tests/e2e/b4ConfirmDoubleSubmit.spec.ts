import { test, expect, type Page } from "@playwright/test";
import { countRows } from "./_helpers/db";

// TCK-HF2W-B4 — ConfirmModal async double-submit guard.
//
// The ONLY caller whose onConfirm is async is WorldSwitcher's delete
// (confirmDelete: setBusy -> await deleteWorld/deleteUniverse -> setDeleteTarget
// null AFTER the await). Before the guard, a fast SECOND click on the danger
// "Delete N rows" button re-entered confirmDelete before the modal unmounted, so
// onConfirm fired twice. ConfirmModal now wraps onConfirm in a per-open one-shot
// latch AND disables the confirm button after the first click, so a real
// double-click fires exactly once.
//
// This spec drives the REAL async path at :3100: it creates a unique EMPTY world
// (so "delete world" is enabled and the run is self-cleaning), opens the danger
// modal, then DOUBLE-CLICKS the confirm button and proves, on both the UI (the
// confirm button is disabled + aria-disabled the instant it is clicked, so a
// second click cannot re-fire) and the DATABASE (the universe's world count
// drops by EXACTLY ONE — a double-fire would be a second delete), that the guard
// holds. Isolated + self-cleaning: it only ever removes the world it created.

function worldSelect(page: Page) {
  return page.getByRole("combobox", { name: "Active world" });
}

test("ConfirmModal guard: a double-click on the async world-delete confirm deletes exactly once", async ({
  page,
}) => {
  await page.goto("/wiki");
  await expect(page.getByText("Maren", { exact: false }).first()).toBeVisible();

  // Baseline world count for universe-1 (the seeded universe).
  const before = await countRows("worlds", "universe_id = $1", ["universe-1"]);
  expect(before).toBeGreaterThanOrEqual(1);

  // Create a unique empty world so the universe has >1 world (which enables the
  // "delete world" affordance) and the run is self-cleaning.
  const unique = `Doomed ${Date.now()}`;
  await page.getByRole("button", { name: "+ world" }).click();
  const namePrompt = page.getByRole("dialog", { name: "Name the new world" });
  await namePrompt.getByRole("textbox").fill(unique);
  await namePrompt.getByRole("button", { name: "Create" }).click();
  await expect(
    worldSelect(page).locator("option", { hasText: unique }),
  ).toHaveCount(1);
  await expect
    .poll(async () => countRows("worlds", "universe_id = $1", ["universe-1"]))
    .toBe(before + 1);

  // Open the danger delete modal for the just-created (active) world.
  await page.getByRole("button", { name: "delete world" }).click();
  const confirm = page.getByRole("button", { name: /Delete \d+ rows/ });
  await expect(confirm).toBeEnabled();

  // Count the deleteWorld SERVER-ACTION calls. Next server actions POST to the
  // page URL carrying a `next-action` header (a per-action id hash); onConfirm ->
  // confirmDelete -> deleteWorld makes exactly ONE POST with the SAME action id
  // per fire. A single delete legitimately produces a SECOND, DIFFERENT action id
  // afterward (the post-delete active-world switch / RSC refresh), so we cannot
  // count all action POSTs. Instead we lock onto the FIRST action id we see (the
  // deleteWorld fire) and count only repeats of THAT id: the latch guarantees it
  // appears exactly once; a lost latch fires the identical deleteWorld action a
  // second time (same id). The DB count alone can't catch this — a second delete
  // of the already-removed world is an idempotent no-op.
  let deleteActionId: string | null = null;
  let deleteFires = 0;
  page.on("request", (req) => {
    const id = req.headers()["next-action"];
    if (req.method() !== "POST" || !id) return;
    if (deleteActionId === null) deleteActionId = id;
    if (id === deleteActionId) deleteFires += 1;
  });

  // THE GUARD UNDER TEST: two SYNCHRONOUS clicks in the SAME tick, before React
  // can re-render and disable the button. This is the true double-fire window the
  // one-shot LATCH guards — Playwright's own dblclick re-checks actionability
  // between clicks and would be stopped by `disabled` alone (the DOM-layer
  // belt), so it would NOT exercise the latch. Dispatching both native clicks in
  // one evaluate defeats that re-check, so only the latch can keep onConfirm to a
  // single fire. Removing the latch makes this POST deleteWorld twice.
  await confirm.evaluate((el) => {
    (el as HTMLButtonElement).click();
    (el as HTMLButtonElement).click();
  });

  // UI proof: the confirm button reads busy — disabled + aria-disabled — so the
  // second click could not have re-invoked onConfirm. (It disables before the
  // async delete resolves and the modal unmounts; assert immediately.)
  await expect(confirm).toBeDisabled();
  await expect(confirm).toHaveAttribute("aria-disabled", "true");

  // DB proof: exactly ONE world was removed — the count returns to baseline, not
  // below it. A double-fire would attempt a second delete on the same/again path.
  await expect
    .poll(async () => countRows("worlds", "universe_id = $1", ["universe-1"]))
    .toBe(before);

  // The doomed world is gone from the selector (delete completed once, cleanly).
  await expect(
    worldSelect(page).locator("option", { hasText: unique }),
  ).toHaveCount(0);

  // No WorldSwitcher delete-error surfaced: confirmDelete's own error banner
  // (`<p role="alert" class=…error>`, only rendered when a delete action returns
  // { ok:false }) is absent, so the async delete completed without a failing
  // second call. Scoped to the switcher's own region — /wiki has other,
  // always-present role="alert" live regions (WikiScreen/error boundaries) that a
  // global [role="alert"] count would wrongly capture.
  const switcher = page.getByRole("region", { name: "World switcher" });
  await expect(switcher.locator('p[role="alert"]')).toHaveCount(0);

  // PRIMARY single-fire proof: onConfirm -> deleteWorld fired EXACTLY ONCE. A
  // lost latch re-POSTs the identical deleteWorld action for the same open.
  // Polled so any (wrongly) in-flight second call has time to register.
  await expect.poll(() => deleteFires, { timeout: 2000 }).toBe(1);
});
