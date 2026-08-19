import { test, expect } from "@playwright/test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// TCK-HF1 [CRITICAL]: the AI-suggest row (.aiItem in DetailsColumn.module.css)
// must ship `background: var(--fresh)` with NO inline hex fallback. The old rule
// `var(--fresh, #fbf4dd)` carried the WRONG fallback: #fbf4dd is pale-yellow
// while the real token --fresh:#ffe0d9 (globals.css:19) is pale-peach. If
// --fresh is ever unresolved, that fallback paints the wrong tint on the AI
// "Suggest details" row.
//
// GATE SHAPE (why not a live DOM probe): in this Turbopack PROD build the
// .aiItem CSS lives in a component chunk that /wiki does NOT link at load — the
// .aiItem element only mounts once live AI suggestions exist (a provider-backed,
// non-deterministic, test.skip-able path). So a mounted-element probe is not
// deterministically reachable in the gate. Instead we:
//   1. Exercise the real page live (render /wiki in the browser), AND
//   2. Assert the exact SHIPPED CSS artifact the server serves for .aiItem —
//      read from the build output (the same bytes the browser downloads once the
//      row renders) — carries `background:var(--fresh)` with NO hex fallback.
// The dev-server DOM probe (Firefox) separately confirms the live paint:
// resolved --fresh = rgb(255,224,217) peach, unresolved = transparent (fix) vs
// the wrong yellow rgb(251,244,221) (bug). Together they are non-vacuous: the
// artifact assertion goes RED the instant the #fbf4dd fallback returns.

// The build output dir the gate server was started from. Implementer/reviewer
// gate builds use an isolated dist (.next-verify / .next-review); fall back to
// .next. Env override wins so a reviewer on .next-review points here explicitly.
const DIST_DIR = process.env.NEXT_DIST_DIR || ".next-verify";

function readAiItemChunk(): string | null {
  const chunksDir = join(process.cwd(), DIST_DIR, "static", "chunks");
  let files: string[];
  try {
    files = readdirSync(chunksDir).filter((f) => f.endsWith(".css"));
  } catch {
    return null;
  }
  for (const f of files) {
    const css = readFileSync(join(chunksDir, f), "utf8");
    if (/__aiItem\b/.test(css)) return css;
  }
  return null;
}

test("wiki .aiItem ships background:var(--fresh) with NO wrong hex fallback", async ({
  page,
}) => {
  // (1) Exercise the real route live in the browser.
  await page.goto("/wiki");
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("navigation", { name: "The world" })).toBeVisible();
  // The AI block (whose row is .aiItem) is present on the details column.
  await expect(page.getByRole("button", { name: /Suggest details/i })).toBeVisible();

  // (2) Assert the shipped .aiItem CSS artifact the server serves.
  const css = readAiItemChunk();
  expect(
    css,
    `built CSS chunk with the .aiItem rule must exist under ${DIST_DIR}/static/chunks`,
  ).not.toBeNull();

  const decl = /__aiItem[^{}]*\{[^{}]*background:\s*var\(--fresh([^)]*)\)/i.exec(
    css as string,
  );
  expect(
    decl,
    ".aiItem must set background from the --fresh token (background:var(--fresh...))",
  ).not.toBeNull();

  // The captured group is everything between `var(--fresh` and `)`. With the fix
  // it is empty; with the bug it is `,#fbf4dd`. Require NO inline fallback — the
  // token is the single source of truth.
  const fallbackArg = ((decl as RegExpExecArray)[1] ?? "").trim();
  expect(
    fallbackArg,
    `.aiItem background must have NO inline fallback (found "var(--fresh${fallbackArg})")`,
  ).toBe("");

  // Explicit: the wrong yellow hex must never appear inside the .aiItem decl.
  expect(css as string).not.toMatch(/__aiItem[^{}]*\{[^{}]*#fbf4dd/i);
});
