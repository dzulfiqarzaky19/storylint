import { test, expect } from "@playwright/test";

// TCK-HF2W-D1: the Write chapter title (.title — 44px all-caps, 32px <=560px)
// must not overflow its column when a chapter title contains a very long
// unbroken word (a proper noun, a slug, a run of caps). The fix is
// `overflow-wrap: anywhere` + `min-width: 0` on `.title` so an unbreakable token
// wraps mid-word instead of pushing past the container edge.
//
// WHY THIS SHAPE (non-vacuous, mirrors wikiOverflowGuard.spec.ts): asserting
// only "the title does not overflow" is GREEN-BY-CONSTRUCTION when the real
// chapter title happens to be short. So the gate proves the fix two ways at each
// narrow width, driving a DELIBERATELY-too-long unbroken word into the live
// title node:
//   Layer A — the guard IS present: computed overflow-wrap on .title resolves to
//     'anywhere' (a plain word-break:normal title computes 'normal' -> the
//     regression this catches). This is the line the mutation strips.
//   Layer B — the guard WORKS: after injecting a 60-char unbroken word, the
//     title's own scrollWidth stays clamped to its clientWidth (it wrapped). A
//     title WITHOUT overflow-wrap:anywhere lets the long word render on one line
//     -> scrollWidth > clientWidth -> RED. The injected text is restored after
//     each assertion so it never leaks between widths.

const LONG_WORD = "Aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"; // 60 unbroken chars

for (const width of [320, 375, 414, 768]) {
  test(`chapter title long-word wrap holds at ${width}px (overflow-wrap + clamped)`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/write");
    await page.waitForLoadState("networkidle");

    const title = page.locator("h1").first();
    await expect(title).toBeVisible();

    // Layer A: the guard is present at THIS width.
    const overflowWrap = await title.evaluate(
      (el) => getComputedStyle(el).overflowWrap,
    );
    expect(
      overflowWrap,
      `.title overflow-wrap must be 'anywhere' (got '${overflowWrap}')`,
    ).toBe("anywhere");

    // Layer B: a deliberately-too-long unbroken word must WRAP, not overflow.
    const original = await title.evaluate((el) => el.textContent ?? "");
    await title.evaluate((el, word) => {
      el.textContent = word;
    }, LONG_WORD);

    const box = await title.evaluate((el) => ({
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
    }));

    // Restore the real title before asserting so a failure never leaves the
    // probe text behind.
    await title.evaluate((el, text) => {
      el.textContent = text;
    }, original);

    expect(
      box.scrollWidth,
      `a 60-char unbroken title word must wrap, not overflow (scrollWidth ${box.scrollWidth} vs clientWidth ${box.clientWidth})`,
    ).toBeLessThanOrEqual(box.clientWidth + 1);
  });
}
