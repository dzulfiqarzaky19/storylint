/**
 * requireWorldId / fail (T-ARCH-5 GUARD-DEDUP).
 *
 * wiki.ts and plot.ts each hand-copied a `requireWorldId` (fail-closed blank/
 * missing worldId guard) and a `fail` (err -> ActionResult envelope) pair.
 * This is the one shared home, next to confirmWikiWrite. Each call site keeps
 * its EXACT prior error text (wiki's fuller "- refusing to create a
 * world-orphan entry" suffix is the default; plot's shorter text passes an
 * empty suffix override) — zero intended behavior change, just one source.
 *
 * MUTANT (must RED): drop the `if (!trimmed)` guard in requireWorldId. Then a
 * blank worldId is no longer refused (returns ok:true instead) — the "refuses
 * a blank worldId" test goes RED for that exact reason.
 */

import { describe, it, expect } from "vitest";
import { requireWorldId, fail } from "@/lib/actions/confirmation";

describe("requireWorldId", () => {
  it("refuses a missing (undefined) worldId with the default entry suffix", () => {
    const result = requireWorldId(undefined, "wiki.createEntry");
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected refuse");
    expect(result.error).toBe(
      "wiki.createEntry: missing worldId - refusing to create a world-orphan entry",
    );
  });

  it("refuses a blank/whitespace worldId", () => {
    const result = requireWorldId("   ", "wiki.createEntryTied");
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected refuse");
    expect(result.error).toBe(
      "wiki.createEntryTied: missing worldId - refusing to create a world-orphan entry",
    );
  });

  it("accepts a custom (empty) suffix, matching plot.ts's original shorter text", () => {
    const result = requireWorldId(undefined, "plot.createPlotline", "");
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected refuse");
    expect(result.error).toBe("plot.createPlotline: missing worldId");
  });

  it("accepts a custom suffix, matching research.ts createThread's original text", () => {
    const result = requireWorldId(undefined, "createThread", " - refusing to create a world-orphan thread");
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected refuse");
    expect(result.error).toBe("createThread: missing worldId - refusing to create a world-orphan thread");
  });

  it("returns the TRIMMED worldId on success", () => {
    const result = requireWorldId("  world-mol  ", "wiki.createEntry");
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok");
    expect(result.worldId).toBe("world-mol");
  });
});

describe("fail", () => {
  it("wraps an Error's message with the where-label", () => {
    const result = fail(new Error("boom"), "wiki.createEntry");
    expect(result).toEqual({ ok: false, error: "wiki.createEntry: boom" });
  });

  it("stringifies a non-Error thrown value", () => {
    const result = fail("plain string", "plot.upsertBeat");
    expect(result).toEqual({ ok: false, error: "plot.upsertBeat: plain string" });
  });
});
