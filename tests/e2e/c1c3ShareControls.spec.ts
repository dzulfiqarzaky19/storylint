import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// TCK-HF2W-C1C3: wiki share/delete controls.
//
// C1 (height base): .select and .unlink in ShareControls.module.css must share a
// height base so the two controls line up. They now carry identical min-height +
// identical padding (+ identical border/font), so they render equal client-rect
// heights by construction.
//   GATE SHAPE: the seed has ONE world ("Ashkeld"), so ShareControls renders
//   .unlink but NOT .select (the share-to-OTHER-world <select> only appears when
//   another world exists — targets.length>0). So .select's live height is not
//   gate-reachable. We therefore assert (a) LIVE that .unlink renders at the
//   shared 22px base, and (b) the shipped source carries the SAME height-
//   determining declarations (min-height + padding) on BOTH .select and .unlink —
//   the property that guarantees equal heights once both mount.
//
// C3 (net-new keyboard-focus parity): neither .unlink nor .deleteEntry had a
// :focus-visible rule before; a keyboard user Tabbing to them got no fill. Both
// now get a :focus-visible that mirrors :hover exactly. Both controls ARE live on
// /wiki, so we Tab to each and assert the focused fill equals the hover fill.

const CSS_SRC = (rel: string) => readFileSync(join(process.cwd(), rel), "utf8");

function rule(css: string, selector: string): string {
  const re = new RegExp(
    selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s*\\{([^}]*)\\}",
  );
  const m = re.exec(css);
  return m?.[1] ?? "";
}

test("C1: .unlink renders at the shared 22px height base on /wiki", async ({
  page,
}) => {
  await page.goto("/wiki");
  await page.waitForLoadState("networkidle");
  const unlink = page.locator('[class*="ShareControls-module"][class*="unlink"]');
  await expect(unlink).toBeVisible();
  const h = await unlink.evaluate((el) => el.getBoundingClientRect().height);
  expect(h).toBe(22);
});

test("C1: .select and .unlink carry identical height-determining declarations", () => {
  const css = CSS_SRC("src/components/wiki/ShareControls.module.css");
  const selectBlock = rule(css, ".select");
  const unlinkBlock = rule(css, ".unlink");

  const minH = /min-height:\s*22px/;
  const pad = /padding:\s*2px 8px/;

  expect(selectBlock, ".select must set the shared min-height").toMatch(minH);
  expect(unlinkBlock, ".unlink must set the shared min-height").toMatch(minH);
  expect(selectBlock, ".select must set the shared padding").toMatch(pad);
  expect(unlinkBlock, ".unlink must set the shared padding").toMatch(pad);
});

test("C3: Tab to .unlink shows the same fill as :hover (accent)", async ({
  page,
}) => {
  await page.goto("/wiki");
  await page.waitForLoadState("networkidle");
  const unlink = page.locator('[class*="ShareControls-module"][class*="unlink"]');
  await expect(unlink).toBeVisible();

  await unlink.focus();
  const bg = await unlink.evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(bg).not.toBe("rgba(0, 0, 0, 0)");
  expect(bg).not.toBe("transparent");
  const accentRgb = await page.evaluate(() => {
    const d = document.createElement("div");
    d.style.color = "var(--accent)";
    document.body.appendChild(d);
    const c = getComputedStyle(d).color;
    d.remove();
    return c;
  });
  expect(bg).toBe(accentRgb);
});

test("C3: Tab to .deleteEntry shows the same fill as :hover (danger)", async ({
  page,
}) => {
  await page.goto("/wiki");
  await page.waitForLoadState("networkidle");
  const del = page.locator('[class*="EntryBand-module"][class*="deleteEntry"]');
  await expect(del).toBeVisible();

  await del.focus();
  const bg = await del.evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(bg).not.toBe("rgba(0, 0, 0, 0)");
  expect(bg).not.toBe("transparent");
  const dangerRgb = await page.evaluate(() => {
    const d = document.createElement("div");
    d.style.color = "var(--danger)";
    document.body.appendChild(d);
    const c = getComputedStyle(d).color;
    d.remove();
    return c;
  });
  expect(bg).toBe(dangerRgb);
});

test("C3: :focus-visible rules mirror :hover in both stylesheets", () => {
  const share = CSS_SRC("src/components/wiki/ShareControls.module.css");
  const band = CSS_SRC("src/components/wiki/EntryBand.module.css");

  const unlinkHover = rule(share, ".unlink:hover");
  const unlinkFocus = rule(share, ".unlink:focus-visible");
  expect(unlinkFocus, ".unlink:focus-visible must exist").not.toBe("");
  expect(unlinkFocus.replace(/\s+/g, "")).toBe(unlinkHover.replace(/\s+/g, ""));

  const delHover = rule(band, ".deleteEntry:hover");
  const delFocus = rule(band, ".deleteEntry:focus-visible");
  expect(delFocus, ".deleteEntry:focus-visible must exist").not.toBe("");
  expect(delFocus.replace(/\s+/g, "")).toBe(delHover.replace(/\s+/g, ""));
});
