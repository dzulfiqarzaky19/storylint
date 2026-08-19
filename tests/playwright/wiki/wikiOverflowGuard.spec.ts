import { test, expect } from "@playwright/test";

// TCK-HF6: the horizontal-overflow guard (`html,body{overflow-x:clip;
// max-width:100%}`) must apply at ALL viewport widths, not only the <=560px
// phone tier where it used to live. The wide fixed-width desktop columns can
// overflow at any width, so the clamp is global. `clip` (not `hidden`) clips
// without establishing a scroll container.
//
// WHY THIS SHAPE (non-vacuous): asserting only `documentElement.scrollWidth <=
// clientWidth` is GREEN-BY-CONSTRUCTION here — BOTH `overflow-x:clip` and
// `overflow-x:hidden` clamp scrollWidth, and the assertion also passes when the
// rule is deleted entirely if no child happens to overflow at that width.
// smoke.spec.ts (L218-229) documents this exact clamp/mask trap. So the gate
// proves the guard two ways at each width:
//   Layer A — the guard IS present at THIS width: computed overflow-x === 'clip'
//     on both html and body (the phone-only version computes 'visible' at
//     768/1440, which is the regression this catches).
//   Layer B — the guard actually WORKS: inject a deliberately-too-wide (200vw)
//     probe child, then assert scrollWidth stays clamped to clientWidth. Without
//     the global guard this overflows at 768/1440 -> RED. The probe is removed
//     after each assertion so it never leaks between widths.

for (const width of [320, 768, 1440]) {
  test(`horizontal-overflow guard applies at ${width}px (clip + clamped)`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/wiki");
    await page.waitForLoadState("networkidle");

    // Layer A: the guard is present at THIS width (not just <=560).
    const guard = await page.evaluate(() => {
      const de = getComputedStyle(document.documentElement);
      const bo = getComputedStyle(document.body);
      return {
        htmlOverflowX: de.overflowX,
        bodyOverflowX: bo.overflowX,
        htmlMaxWidth: de.maxWidth,
        clientWidth: document.documentElement.clientWidth,
      };
    });
    expect(guard.htmlOverflowX).toBe("clip");
    expect(guard.bodyOverflowX).toBe("clip");
    // max-width:100% — getComputedStyle may return the literal "100%" or resolve
    // it to px depending on engine. Accept either the literal or px ~= client.
    const maxOk =
      guard.htmlMaxWidth === "100%" ||
      Math.abs(parseFloat(guard.htmlMaxWidth) - guard.clientWidth) <= 1;
    expect(maxOk, `html max-width must clamp to viewport (got ${guard.htmlMaxWidth})`).toBe(
      true,
    );

    // Layer B: a deliberately-too-wide child must NOT create a horizontal scroll.
    await page.evaluate(() => {
      const probe = document.createElement("div");
      probe.id = "__hf6ofprobe";
      probe.style.width = "200vw";
      probe.style.height = "1px";
      document.body.appendChild(probe);
    });
    const scroll = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    // Clean up the probe before asserting so a failure never leaves it behind.
    await page.evaluate(() => document.getElementById("__hf6ofprobe")?.remove());
    expect(
      scroll.scrollWidth,
      `a 200vw child must be clipped, not scrollable (scrollWidth ${scroll.scrollWidth} vs clientWidth ${scroll.clientWidth})`,
    ).toBeLessThanOrEqual(scroll.clientWidth + 1);
  });
}
