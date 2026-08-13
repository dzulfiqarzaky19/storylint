import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// TCK-HF2W-C2: Wiki index row hover used the wrong token.
//
// `.item:hover` in WikiIndex.module.css painted `var(--surface)` (#ffffff, the
// panel-background token) where the app's dedicated hover-purpose token
// `--hover` (#eae7e7) is intended — the same token 13 other hover rules across
// the app already use (Shelf, WorldSwitcher, TrashPanel, InlineText,
// ConfirmModal, ...). On a white panel a `--surface` hover is invisible: the row
// gives no hover feedback at all. The fix swaps that ONE rule to `var(--hover)`.
//
// BINDING PIN (raccoon): `--surface` is still a legitimate token used 7 other
// times across the wiki CSS (InlineText:40, PosterBand:26, TrashPanel:52,
// WikiIndex:132, WorldSwitcher:41/75/128). This is NOT a blanket rename — those
// 7 MUST stay byte-identical. This spec asserts both: the hover flipped to
// --hover LIVE, AND exactly those 7 --surface usages remain, unchanged.

const WIKI_CSS_DIR = "src/components/wiki";
const read = (rel: string) => readFileSync(join(process.cwd(), rel), "utf8");

// The 7 --surface usages that must survive the C2 swap, as (file, 1-based line,
// exact source line). If the swap ever touched one of these, or a blanket
// rename fired, this snapshot breaks.
const SURVIVING_SURFACE: ReadonlyArray<readonly [string, number]> = [
  ["InlineText.module.css", 40],
  ["PosterBand.module.css", 26],
  ["TrashPanel.module.css", 52],
  ["WikiIndex.module.css", 132],
  ["WorldSwitcher.module.css", 41],
  ["WorldSwitcher.module.css", 75],
  ["WorldSwitcher.module.css", 128],
];

test("C2: .item:hover paints --hover (not the white --surface) on /wiki", async ({
  page,
}) => {
  await page.goto("/wiki");
  await page.waitForLoadState("networkidle");

  // Hover a NON-active index row so no .itemActive background is in play — the
  // bare .item:hover rule is what we are gating. Scope to the row <button>
  // itself: [class*="item"] also substring-matches inner .itemName/.itemNote
  // spans (which carry no background), so we pin the element type to button.
  const items = page.locator(
    'button[class*="WikiIndex-module"][class*="item"]:not([class*="itemActive"])',
  );
  await expect(items.first()).toBeVisible();
  const row = items.first();
  await row.hover();

  const bg = await row.evaluate(
    (el) => getComputedStyle(el).backgroundColor,
  );

  // Resolve the two tokens live so the assertion is theme-accurate, not a
  // hardcoded hex that would rot if the palette changes.
  const resolve = (name: string) =>
    page.evaluate((n) => {
      const d = document.createElement("div");
      d.style.background = `var(${n})`;
      document.body.appendChild(d);
      const c = getComputedStyle(d).backgroundColor;
      d.remove();
      return c;
    }, name);

  const hoverToken = await resolve("--hover");
  const surfaceToken = await resolve("--surface");

  // The bug was that these two were the SAME paint on the row; the fix makes the
  // hover read --hover and NOT --surface.
  expect(hoverToken).not.toBe(surfaceToken);
  expect(bg, ".item:hover must paint --hover").toBe(hoverToken);
  expect(bg, ".item:hover must NOT paint the white --surface").not.toBe(
    surfaceToken,
  );
});

test("C2: the .item:hover rule in source references --hover, not --surface", () => {
  const css = read(join(WIKI_CSS_DIR, "WikiIndex.module.css"));
  const m = /\.item:hover\s*\{([^}]*)\}/.exec(css);
  expect(m, ".item:hover rule must exist").not.toBeNull();
  const block = m?.[1] ?? "";
  expect(block, ".item:hover must use var(--hover)").toMatch(
    /background:\s*var\(--hover\)/,
  );
  expect(block, ".item:hover must no longer use var(--surface)").not.toMatch(
    /var\(--surface\)/,
  );
});

test("C2 BINDING PIN: the 7 other --surface usages stay byte-identical (no blanket swap)", () => {
  const found: Array<readonly [string, number]> = [];
  for (const [file, line] of SURVIVING_SURFACE) {
    const lines = read(join(WIKI_CSS_DIR, file)).split(/\r?\n/);
    const src = lines[line - 1];
    expect(
      src,
      `${file}:${line} expected the surviving --surface usage`,
    ).toBe("  background: var(--surface);");
    found.push([file, line]);
  }
  // And the total count of var(--surface) across the whole wiki CSS is EXACTLY
  // these 7 — proving the swapped .item:hover no longer counts and nothing else
  // was flipped in either direction.
  const files = [
    "InlineText.module.css",
    "PosterBand.module.css",
    "TrashPanel.module.css",
    "WikiIndex.module.css",
    "WorldSwitcher.module.css",
  ];
  let total = 0;
  for (const f of files) {
    const matches = read(join(WIKI_CSS_DIR, f)).match(/var\(--surface\)/g);
    total += matches ? matches.length : 0;
  }
  expect(total, "exactly 7 --surface usages must remain across wiki CSS").toBe(
    7,
  );
  expect(found.length).toBe(7);
});
