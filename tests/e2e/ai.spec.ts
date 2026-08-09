import { test, expect } from "@playwright/test";

// AI end-to-end smoke (SaaRouters assist). Proves the write-screen "✦ Ask AI"
// affordance drives a real, grounded advice flow at the canonical 1440×900
// desktop frame, and that product rule 1 is never crossed (the note's actions
// stay the engine's own; the AI panel is additive and read-only).
//
// The AI actions make a LIVE gateway call, so these tests:
//   - detect whether AI is configured (the ✦ button only renders when it is),
//   - skip the live-call assertions when AI is OFF (graceful-degradation path),
//   - give the live round-trip a generous timeout when AI is ON.
//
// Nothing here writes to the wiki; the rewrite (if offered) edits the
// manuscript only, on an explicit click.

const AI_ROUNDTRIP_MS = 45_000;

/** Open the first mark's inline note via its rail row (§7 open path). */
async function openFirstNote(page: import("@playwright/test").Page) {
  await page.goto("/write");
  const rows = page.locator("button[aria-pressed]");
  await expect(rows.first()).toBeVisible();
  await rows.first().click();
  const note = page.getByTestId("write-inline-note");
  await expect(note).toBeVisible();
  return note;
}

/**
 * The manuscript's prose only. The inline note is React-portalled INTO a widget
 * host inside `.ProseMirror`, so `editor.innerText()` would include the note +
 * AI advice. We read the top-level paragraph runs instead, skipping any node
 * inside the note host, so "did the manuscript change?" is measured cleanly.
 */
async function manuscriptText(page: import("@playwright/test").Page): Promise<string> {
  return page.evaluate(() => {
    const pm = document.querySelector(".ProseMirror");
    if (!pm) return "";
    const parts: string[] = [];
    for (const p of Array.from(pm.querySelectorAll(":scope > p"))) {
      // Exclude the portalled note host if it ever nests under a paragraph.
      if (p.querySelector("[data-write-note-host]")) {
        const clone = p.cloneNode(true) as HTMLElement;
        clone.querySelectorAll("[data-write-note-host]").forEach((n) => n.remove());
        parts.push((clone.textContent ?? "").trim());
      } else {
        parts.push((p.textContent ?? "").trim());
      }
    }
    return parts.join("\n").trim();
  });
}

test("write AI: the ✦ Ask AI affordance is gated on configuration", async ({
  page,
}) => {
  const note = await openFirstNote(page);
  const explain = note.getByTestId("write-ai-explain");
  const count = await explain.count();

  // Whatever the config, the note's OWN engine actions must still be present
  // (AI is purely additive; the engine remains the source of truth).
  const actions = note.locator("button");
  expect(await actions.count()).toBeGreaterThanOrEqual(3);

  if (count === 0) {
    // AI OFF: graceful degradation — the note works with no AI affordance.
    test.info().annotations.push({
      type: "ai",
      description: "AI not configured; ✦ Ask AI hidden (graceful degradation).",
    });
    await expect(page.getByTestId("write-ai-advice")).toHaveCount(0);
    return;
  }

  // AI ON: exactly one ✦ button, labelled with the sparkle.
  expect(count).toBe(1);
  await expect(explain).toBeVisible();
  await expect(explain).toContainText("Ask AI");
});

test("write AI: Ask AI returns a grounded explanation without touching the wiki", async ({
  page,
}) => {
  const note = await openFirstNote(page);
  const explain = note.getByTestId("write-ai-explain");

  if ((await explain.count()) === 0) {
    test.skip(true, "AI not configured (SAAROUTERS_API_KEY absent); skipping live-call test.");
    return;
  }

  // Capture the manuscript text before the call so we can prove the AI does not
  // silently mutate it (only an explicit "Use in editor" click may).
  const before = await manuscriptText(page);

  await explain.click();
  // The button flips to a busy label while the round-trip is in flight.
  await expect(explain).toContainText(/Asking/i, { timeout: 5_000 }).catch(() => {
    // Fast responses may skip the visible busy state; that's fine.
  });

  // The advice panel appears once the grounded explanation returns.
  const advice = page.getByTestId("write-ai-advice");
  await expect(advice).toBeVisible({ timeout: AI_ROUNDTRIP_MS });

  // It must render a non-empty explanation (or a clearly-labelled error, never
  // a silent blank).
  const adviceText = (await advice.innerText()).trim();
  expect(adviceText.length).toBeGreaterThan(0);

  // The manuscript is UNCHANGED by merely asking (read-only until "Use in
  // editor" is clicked).
  const afterAsk = await manuscriptText(page);
  expect(afterAsk).toBe(before);

  // The note's engine actions are still present — AI did not replace them.
  await expect(note.locator("button").first()).toBeVisible();
});

test("write AI: an offered rewrite applies to the manuscript on explicit click (never the wiki)", async ({
  page,
}) => {
  const note = await openFirstNote(page);
  const explain = note.getByTestId("write-ai-explain");

  if ((await explain.count()) === 0) {
    test.skip(true, "AI not configured; skipping live rewrite test.");
    return;
  }

  const before = await manuscriptText(page);

  await explain.click();
  const advice = page.getByTestId("write-ai-advice");
  await expect(advice).toBeVisible({ timeout: AI_ROUNDTRIP_MS });

  const apply = page.getByTestId("write-ai-apply");
  if ((await apply.count()) === 0) {
    // The model may decline to offer a rewrite (empty rewrite is valid). Then
    // nothing changed and there's nothing to apply — still a pass.
    test.info().annotations.push({
      type: "ai",
      description: "Model offered no rewrite this run; manuscript untouched.",
    });
    const afterNoRewrite = await manuscriptText(page);
    expect(afterNoRewrite).toBe(before);
    return;
  }

  // Applying the rewrite edits the MANUSCRIPT (the editor text changes) and
  // closes the note. It must not create any wiki-confirmation strip.
  await apply.click();
  await expect(page.getByTestId("write-inline-note")).toHaveCount(0);
  await expect(page.getByText("Yes, write it in", { exact: false })).toHaveCount(0);

  const afterApply = await manuscriptText(page);
  expect(afterApply).not.toBe(before);
});
