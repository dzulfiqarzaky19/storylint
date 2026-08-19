import { test, expect, type Page } from "@playwright/test";

// TCK-HF5 (browser-CSS tier) — touch-safe hover gating + a11y control states.
//
// The save-error live-region politeness half of the original TCK-HF5 spec moved
// to the component tier (SaveStateFooter.component.test.tsx) because it is a pure
// prop-driven role="alert"/role="status" render. What REMAINS here is genuinely
// browser-only: it reads the BUILT, applied CSSOM to prove hover paint is gated
// behind @media (hover: hover) (so a touch tap never leaves sticky hover), that
// an :active pressed state exists, and that disabled/focus-visible rules declare
// the right cursor + outline. Playwright cannot emulate the hover/any-hover media
// feature, so the gating is proven STRUCTURALLY from the real stylesheet rules.
//
// LOCATOR NOTE: CSS-module class names are hashed at build time, so we match the
// hashed suffix (e.g. `:hover` on a class whose name contains `aiSend`) via a
// CSSOM walk rather than a raw `.aiSend` selector.

async function ruleFacts(
  page: Page,
  classFragment: string,
): Promise<{ hoverGated: boolean; hoverUngated: boolean; hasActive: boolean }> {
  return page.evaluate((frag) => {
    let hoverGated = false;
    let hoverUngated = false;
    let hasActive = false;
    const hoverRe = new RegExp(`\\.[\\w-]*${frag}[\\w-]*:hover`, "i");
    const activeRe = new RegExp(`\\.[\\w-]*${frag}[\\w-]*:active`, "i");

    const scanStyleRule = (rule: CSSStyleRule, insideHoverMedia: boolean) => {
      if (hoverRe.test(rule.selectorText)) {
        if (insideHoverMedia) hoverGated = true;
        else hoverUngated = true;
      }
      if (activeRe.test(rule.selectorText)) hasActive = true;
    };

    const walk = (rules: CSSRuleList, insideHoverMedia: boolean) => {
      for (const rule of Array.from(rules)) {
        if (rule instanceof CSSMediaRule) {
          const gated =
            insideHoverMedia ||
            /\(\s*hover\s*:\s*hover\s*\)/i.test(rule.conditionText);
          walk(rule.cssRules, gated);
        } else if (rule instanceof CSSStyleRule) {
          scanStyleRule(rule, insideHoverMedia);
        }
      }
    };

    for (const sheet of Array.from(document.styleSheets)) {
      let rules: CSSRuleList | null = null;
      try {
        rules = sheet.cssRules;
      } catch {
        continue; // cross-origin sheet; skip
      }
      if (rules) walk(rules, false);
    }
    return { hoverGated, hoverUngated, hasActive };
  }, classFragment);
}

async function inputRuleFacts(
  page: Page,
  frag: string,
): Promise<{ disabledNotAllowed: boolean; focusVisibleOutline: boolean }> {
  return page.evaluate((f) => {
    let disabledNotAllowed = false;
    let focusVisibleOutline = false;
    const disRe = new RegExp(`\\.[\\w-]*${f}[\\w-]*:disabled`, "i");
    const fvRe = new RegExp(`\\.[\\w-]*${f}[\\w-]*:focus-visible`, "i");
    const walk = (rules: CSSRuleList) => {
      for (const rule of Array.from(rules)) {
        if (rule instanceof CSSMediaRule) {
          walk(rule.cssRules);
        } else if (rule instanceof CSSStyleRule) {
          if (
            disRe.test(rule.selectorText) &&
            /not-allowed/i.test(rule.style.cursor)
          ) {
            disabledNotAllowed = true;
          }
          if (
            fvRe.test(rule.selectorText) &&
            // The built rule is `outline: <w> solid var(--accent)`. A CSS
            // variable in the shorthand leaves the `outlineStyle` LONGHAND
            // empty in the CSSOM (it cannot be resolved at parse time), so we
            // read the shorthand text and require a real, non-`none` outline.
            /(^|[;{\s])outline\s*:/i.test(rule.cssText) &&
            !/(^|[;{\s])outline\s*:\s*none\b/i.test(rule.cssText)
          ) {
            focusVisibleOutline = true;
          }
        }
      }
    };
    for (const sheet of Array.from(document.styleSheets)) {
      let rules: CSSRuleList | null = null;
      try {
        rules = sheet.cssRules;
      } catch {
        continue;
      }
      if (rules) walk(rules);
    }
    return { disabledNotAllowed, focusVisibleOutline };
  }, frag);
}

test.describe("HF5 hover paint is gated behind hover-capable pointers (CSSOM)", () => {
  test("not-found .home: :hover is inside @media(hover:hover) and :active exists", async ({
    page,
  }) => {
    await page.goto("/this-route-does-not-exist");
    await expect(page.getByRole("link", { name: /home|back/i }).first()).toBeVisible();

    const facts = await ruleFacts(page, "home");
    expect(facts.hoverGated, ".home:hover must be inside @media(hover:hover)").toBe(true);
    expect(facts.hoverUngated, ".home:hover must NOT exist ungated (sticky-tap risk)").toBe(false);
    expect(facts.hasActive, ".home:active pressed state must exist").toBe(true);
  });
});

test.describe("HF5 part-B: research AI controls have touch-safe + a11y states (CSSOM)", () => {
  test(".aiSend: :hover is gated behind @media(hover:hover) and :active exists", async ({
    page,
  }) => {
    await page.goto("/research");
    // ResearchScreen mounts -> its CSS-module chunk is loaded, so the .aiSend
    // rules are in the CSSOM whether or not the AI box itself is rendered.
    await expect(page.locator("body")).toBeVisible();

    const facts = await ruleFacts(page, "aiSend");
    expect(facts.hoverGated, ".aiSend:hover must be inside @media(hover:hover)").toBe(true);
    expect(facts.hoverUngated, ".aiSend:hover must NOT exist ungated (sticky-tap risk)").toBe(false);
    expect(facts.hasActive, ".aiSend:active pressed state must exist").toBe(true);
  });

  test(".aiInput: :disabled shows not-allowed and :focus-visible has a real outline ring", async ({
    page,
  }) => {
    await page.goto("/research");
    await expect(page.locator("body")).toBeVisible();

    const facts = await inputRuleFacts(page, "aiInput");
    expect(facts.disabledNotAllowed, ".aiInput:disabled must set cursor:not-allowed").toBe(true);
    expect(facts.focusVisibleOutline, ".aiInput:focus-visible must declare a real outline ring").toBe(true);
  });
});
