import { test, expect, type Page, type Locator } from "@playwright/test";

// TCK-HF5 — a11y states (assertive save-error announce + touch-safe hover).
//
// TWO behavior-bearing changes are proven here:
//
//  1. Manuscript save-error is an ASSERTIVE live region. The editor's save-state
//     footer renders `state.error` (a failed body save, §8) in a
//     `<p class={saveState saveError}>`. Before HF5 that <p> carried
//     role="status" (polite) — a lost-work message a screen reader might never
//     interrupt to announce. HF5 flips the ERROR branch to role="alert"
//     (assertive) while the success/dirty branch stays role="status" (polite).
//     We induce a REAL save failure by faulting the write server-action POST so
//     `saveManuscript` resolves ok:false → SET_ERROR → the alert renders.
//
//  2. Hover paint is gated behind `@media (hover: hover)` so a touch tap never
//     leaves sticky hover styling, and a pointer press gets an `:active`
//     transform instead. Playwright cannot emulate the `hover`/`any-hover` media
//     feature (emulateMedia only covers media/colorScheme/forcedColors/
//     reducedMotion), so we prove the gating STRUCTURALLY from the live CSSOM:
//     the `:hover` rule for each named control must live INSIDE a
//     `@media (hover: hover)` block, and an `:active` rule must exist.
//
// LOCATOR NOTE: CSS-module class names are hashed at build time, so we match the
// hashed suffix (e.g. `:hover` on a class whose name contains `retry`) via a
// CSSOM walk rather than a raw `.retry` selector. Next.js renders a permanent
// EMPTY role="alert" route announcer (#__next-route-announcer__); a bare
// getByRole("alert") also matches it, so the save-error assertions scope to OUR
// alert via its visible induced text.

const INDUCED_MESSAGE = "Induced save failure (TCK-HF5 e2e)";

/** The manuscript save-state footer <p>, by whichever role it currently holds. */
function saveState(page: Page, role: "status" | "alert"): Locator {
  return page.locator(`p[role="${role}"]`);
}

/**
 * Fault the write-page SAVE server action. `saveManuscript` is a "use server"
 * action, not a REST route: the browser posts to the page path with a
 * `Next-Action` header and the action-client deserializes an RSC "flight"
 * response whose `1:` line IS the returned `ActionResult`. A raw 500 makes the
 * action-client REJECT (transport error) before the reducer's else-branch runs,
 * so it never surfaces `state.error`. To faithfully exercise the ok:false path
 * (a real body-save failure returns `{ok:false, error: messageOf(err)}` — the
 * §8 lost-work message), we fulfill a VALID flight body encoding exactly that
 * ActionResult. Only the SAVE action is faulted: its post body carries the
 * ProseMirror doc (`"body":{"type":"doc"`), which the sibling aiCheck action
 * (post body `{"paragraphs":[…]}`) never does, so the AI path is left untouched.
 *
 * Flight shape captured live from a real save round trip:
 *   0:{"a":"$@1","f":"","q":"","i":false,"b":"<buildId>"}
 *   1:{"ok":true,"data":"$undefined"}
 * We keep the module row (`0:`) verbatim and swap the result row (`1:`) to the
 * failure ActionResult. `b` (build id) is not validated by the action-client for
 * a same-build response, so a placeholder is safe.
 */
async function faultSave(page: Page): Promise<void> {
  const flightBody =
    `0:{"a":"$@1","f":"","q":"","i":false,"b":"e2e"}\n` +
    `1:${JSON.stringify({ ok: false, error: INDUCED_MESSAGE })}\n`;
  await page.route("**/write", async (route) => {
    const req = route.request();
    const isSave =
      req.method() === "POST" &&
      !!req.headers()["next-action"] &&
      (req.postData() ?? "").includes('"body":{"type":"doc"');
    if (isSave) {
      await route.fulfill({
        status: 200,
        contentType: "text/x-component",
        body: flightBody,
      });
      return;
    }
    await route.fallback();
  });
}

/** Type into the manuscript editor to trigger the debounced save (800ms). */
async function typeIntoEditor(page: Page): Promise<void> {
  const pm = page.locator(".ProseMirror").first();
  await expect(pm).toBeVisible();
  await pm.click();
  await page.keyboard.type(" hf5");
}

/**
 * Walk every stylesheet rule in the page and, for a class whose hashed name
 * CONTAINS `classFragment`, report whether its `:hover` rule is nested inside an
 * `@media (hover: hover)` block, and whether an `:active` rule exists. Runs in
 * the page so it reads the REAL built + applied CSSOM, not source text.
 */
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

test.describe("HF5 save-error is an assertive alert", () => {
  test("clean load: the save indicator is a polite role=status 'Saved'", async ({
    page,
  }) => {
    await page.goto("/write");
    const status = saveState(page, "status");
    await expect(status).toBeVisible();
    await expect(status).toHaveText(/saved/i);
    await expect(
      page.locator('p[role="alert"]', { hasText: INDUCED_MESSAGE }),
    ).toHaveCount(0);
  });

  test("induced save failure surfaces the error as role=alert (assertive)", async ({
    page,
  }) => {
    await page.goto("/write");
    await expect(saveState(page, "status")).toBeVisible();

    await faultSave(page);
    await typeIntoEditor(page);

    // The failed save → SET_ERROR → the footer <p> renders the error text with
    // role="alert". Scope to OUR alert so the empty Next route-announcer alert
    // can never satisfy this.
    const alert = page.locator('p[role="alert"]', { hasText: INDUCED_MESSAGE });
    await expect(alert).toBeVisible({ timeout: 10_000 });
    // The error must be assertive, never the polite role.
    await expect(
      page.locator('p[role="status"]', { hasText: INDUCED_MESSAGE }),
    ).toHaveCount(0);
  });
});

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

/**
 * Read declared-property facts for a class whose hashed name CONTAINS `frag`,
 * from the live CSSOM. Reports whether a `:disabled` rule sets
 * `cursor: not-allowed`, and whether a `:focus-visible` rule declares an
 * `outline` (a real focus ring, not just a border-color tweak). Runs in the
 * page so it reads the REAL built + applied CSSOM.
 */
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
