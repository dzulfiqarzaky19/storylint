import { test, expect, type Page, type Locator } from "@playwright/test";

// -----------------------------------------------------------------------------
// WRITE — LEFT-INDEX SEVERITY DOTS (Feature 1, integration). The left chapter
// index shows a per-chapter dot: RED for a contradiction, YELLOW for an
// unrecorded-only chapter, and NONE for a clean chapter OR the ACTIVE chapter
// (whose marks the writer already sees in the right rail). page.tsx re-runs the
// pure engine per chapter and forces the active chapter to null — these are
// integration-only glue lines that no unit test covers, so this spec asserts the
// DOT ELEMENT actually renders in the real page and that the active chapter is
// suppressed. Dropping the active-null force (page.tsx) turns these RED.
//
// Seed reality (from `npm run db:seed`, measured against the seeded wiki):
//   • Chapter 7 "Low Water"   -> conflict (RED)
//   • Chapter 6 "The Empty Chair" -> unrecorded-only (YELLOW)
//   • Chapters 1-5            -> clean (no dot)
// /write defaults to the LAST chapter (7), so the RED chapter is active by
// default and must show NO dot. We therefore drive the active selection via
// ?chapter= to exercise BOTH the red path (Ch7 non-active) and active
// suppression (the active chapter never shows a dot), from the seed as-is.
//
// Read-only: this spec never persists resolutions, so it needs no reseed. It
// relies only on the canonical seeded state that globalSetup establishes.
// -----------------------------------------------------------------------------

const CHAPTERS = 'nav[aria-label="Chapters"]';
const RED_LABEL = "Has a contradiction";
const YELLOW_LABEL = "Has an unrecorded detail";

/** The chapter row whose visible text contains `chapterWord` (e.g. "Seven"). */
function chapterRow(page: Page, chapterWord: string): Locator {
  return page
    .locator(`${CHAPTERS} button`)
    .filter({ hasText: new RegExp(`Chapter ${chapterWord}`, "i") });
}

/** Every severity dot in the index (either colour), by its aria-label. */
function dots(page: Page): Locator {
  return page.locator(
    `${CHAPTERS} [aria-label="${RED_LABEL}"], ${CHAPTERS} [aria-label="${YELLOW_LABEL}"]`,
  );
}

test("write index: default landing — active chapter shows NO dot, a non-active unrecorded chapter shows a YELLOW dot", async ({
  page,
}) => {
  // Default landing = Chapter 7 (the last chapter), which carries a conflict but
  // is ACTIVE, so it must render no dot at all.
  await page.goto("/write");
  const active = chapterRow(page, "Seven");
  await expect(active).toHaveAttribute("aria-current", "true");
  await expect(active.locator(`[aria-label="${RED_LABEL}"]`)).toHaveCount(0);
  await expect(active.locator(`[aria-label="${YELLOW_LABEL}"]`)).toHaveCount(0);

  // A NON-active unrecorded-only chapter (Ch6) shows exactly one YELLOW dot and
  // no red dot.
  const yellowChapter = chapterRow(page, "Six");
  await expect(
    yellowChapter.locator(`[aria-label="${YELLOW_LABEL}"]`),
  ).toHaveCount(1);
  await expect(
    yellowChapter.locator(`[aria-label="${RED_LABEL}"]`),
  ).toHaveCount(0);
});

test("write index: a NON-active chapter with a contradiction shows a RED dot, and the active chapter is suppressed", async ({
  page,
}) => {
  // Make Chapter 6 active so Chapter 7 (the conflict chapter) is NON-active and
  // must render its RED dot.
  await page.goto("/write?chapter=6");
  const active = chapterRow(page, "Six");
  await expect(active).toHaveAttribute("aria-current", "true");

  // Chapter 7 is now non-active and shows exactly one RED dot ("Has a
  // contradiction"), and no yellow dot.
  const redChapter = chapterRow(page, "Seven");
  const redDot = redChapter.locator(`[aria-label="${RED_LABEL}"]`);
  await expect(redDot).toHaveCount(1);
  await expect(redDot).toBeVisible();
  await expect(
    redChapter.locator(`[aria-label="${YELLOW_LABEL}"]`),
  ).toHaveCount(0);

  // The ACTIVE chapter (Ch6) is suppressed: it carries an unrecorded mark but,
  // being active, shows no dot of either colour. This is the active-null force.
  await expect(active.locator(`[aria-label="${YELLOW_LABEL}"]`)).toHaveCount(0);
  await expect(active.locator(`[aria-label="${RED_LABEL}"]`)).toHaveCount(0);

  // Exactly one dot is visible across the whole index in this state: the Ch7 red
  // one (Ch6's yellow is suppressed by being active; Ch1-5 are clean). This pins
  // the active-null force — dropping it would surface Ch6's yellow dot too.
  await expect(dots(page)).toHaveCount(1);
});
