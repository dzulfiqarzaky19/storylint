// tests/e2e/_helpers/rail.ts — the Outstanding-marks rail (right panel).
//
// Shared selectors + locators for the write screen's rail. Extracted from the
// copies that had drifted across write / write-lifecycle / write-conflict /
// smoke. IMPORTANT: rows are scoped to the Outstanding-marks aside. Keep/tile
// buttons elsewhere ALSO use `aria-pressed`, so an unscoped
// `button[aria-pressed]` over-matches — always go through `railRows`.
import { expect, type Page, type Locator } from "@playwright/test";

/** The Outstanding-marks aside (the write screen's right panel). */
export const RAIL = 'aside[aria-label="Outstanding marks"]';

/** The rail container. */
export function rail(page: Page): Locator {
  return page.locator(RAIL);
}

/** The mark-toggle rows inside the rail (scoped so Keep/tile toggles never leak in). */
export function railRows(page: Page): Locator {
  return page.locator(`${RAIL} button[aria-pressed]`);
}

/** Rows currently expanded/open (aria-pressed="true"). */
export function pressedRows(page: Page): Locator {
  return page.locator(`${RAIL} button[aria-pressed="true"]`);
}

/** Open the rail row whose text contains `quote`; asserts exactly one match. */
export async function openRow(page: Page, quote: string): Promise<Locator> {
  const row = railRows(page).filter({ hasText: quote });
  await expect(row).toHaveCount(1);
  await row.click();
  return row;
}

/** Escape a string for safe use inside a RegExp (for name/text matchers). */
export function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
