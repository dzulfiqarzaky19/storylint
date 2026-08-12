import { test, expect, type Page } from "@playwright/test";

// TCK-E03 [a11y]: when a base-<Modal> dialog closes via Escape / Cancel /
// backdrop, keyboard focus MUST return to the control that opened it, never
// fall to <body>. Losing focus to <body> strands a keyboard/AT user at the top
// of the document — a WCAG 2.4.3 (Focus Order) failure.
//
// The base <Modal> (src/components/ui/Modal.tsx) owns focus restore for EVERY
// dialog surface — the danger ConfirmModals (entry delete, delete-category,
// delete-world, empty-trash) AND the NamePrompt (new world / new universe). Each
// is rendered CONDITIONALLY (`{flag ? <X/> : null}`), so on close the modal
// UNMOUNTS with open===true. The restore therefore has to run in the effect
// CLEANUP function (it never gets an open===false re-render). Proving it on ONE
// surface proves the shared primitive for all of them.
//
// We drive the "+ world" NamePrompt because it is fully DETERMINISTIC on the
// shared live DB: the trigger is always present when a universe is active, and
// Cancel / Escape close the dialog WITHOUT writing anything (no seeding, no
// cleanup, no DB churn — the failure mode that made an entry-delete drive flaky).
//
// This is an e2e drive because the repo runs vitest under environment:'node'
// (no DOM), so focus-restore can only be proven in a real browser.

async function openNewWorldPrompt(page: Page) {
  await page.goto("/wiki");
  await page.waitForLoadState("networkidle");

  const trigger = page.getByRole("button", { name: "+ world" }).first();
  await expect(trigger).toBeVisible();
  await expect(trigger).toBeEnabled();
  return trigger;
}

const promptDialog = (page: Page) =>
  page.getByRole("dialog", { name: "Name the new world" });

test.describe("TCK-E03 Modal focus restore", () => {
  test("Escape on the dialog restores focus to the trigger", async ({ page }) => {
    const trigger = await openNewWorldPrompt(page);

    await trigger.focus();
    await expect(trigger).toBeFocused();
    await trigger.click();

    const dialog = promptDialog(page);
    await expect(dialog).toBeVisible();

    // Guard 1 (no premature restore): while the dialog is OPEN, focus must stay
    // inside it — the cleanup must NOT have already yanked focus to the trigger.
    await expect(trigger).not.toBeFocused();

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();

    // THE ASSERTION: focus is back on the trigger, NOT on <body>.
    await expect(trigger).toBeFocused();
  });

  test("Cancel on the dialog restores focus to the trigger", async ({ page }) => {
    const trigger = await openNewWorldPrompt(page);

    await trigger.focus();
    await trigger.click();

    const dialog = promptDialog(page);
    await expect(dialog).toBeVisible();

    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toBeHidden();

    await expect(trigger).toBeFocused();
  });
});
