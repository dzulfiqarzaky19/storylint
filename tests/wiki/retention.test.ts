// F6-S6a — pure purge-retention unit tests. isPurgeable is the ONE place the
// ">7d" purge boundary is decided, so this is where the mutation lock lives.
//
// Mutation locks proven here:
//  * null guard `deletedAt == null` -> drop it and "live entry never purgeable" RED.
//  * boundary `>=` -> weaken to `>` and "exactly RETENTION_MS is purgeable" RED.
//  * RETENTION_MS constant -> change it and the 6d59m/7d01m straddle tests RED.

import { describe, it, expect } from "vitest";
import { isPurgeable, RETENTION_MS } from "@/lib/wiki/retention";

const DAY = 24 * 60 * 60 * 1000;

describe("RETENTION_MS", () => {
  it("is exactly 7 days in milliseconds", () => {
    expect(RETENTION_MS).toBe(7 * 24 * 60 * 60 * 1000); // lock: the retention window
    expect(RETENTION_MS).toBe(7 * DAY);
  });
});

describe("isPurgeable", () => {
  const now = 1_000_000_000_000; // fixed clock so the boundary is deterministic

  it("is never purgeable when deletedAt is null (a live, never-deleted entry)", () => {
    // lock: the null guard. Drop it and `now - null` coerces to `now`, which is
    // >= retentionMs, so a live entry would wrongly report purgeable.
    expect(isPurgeable(null, now)).toBe(false);
  });

  it("purges at EXACTLY the retention boundary (inclusive >=)", () => {
    // deleted exactly RETENTION_MS ago -> now - deletedAt === RETENTION_MS.
    // lock: `>=`. Weaken to `>` and this flips to false.
    expect(isPurgeable(now - RETENTION_MS, now)).toBe(true);
  });

  it("does NOT purge one minute before the boundary (6d 23h 59m old)", () => {
    const MINUTE = 60 * 1000;
    expect(isPurgeable(now - (RETENTION_MS - MINUTE), now)).toBe(false);
  });

  it("purges one minute past the boundary (7d 00h 01m old)", () => {
    const MINUTE = 60 * 1000;
    expect(isPurgeable(now - (RETENTION_MS + MINUTE), now)).toBe(true);
  });

  it("does NOT purge a freshly-deleted entry (deleted just now)", () => {
    expect(isPurgeable(now, now)).toBe(false);
  });

  it("honors a custom retentionMs argument over the default", () => {
    // 2-day-old entry: purgeable under a 1-day window, not under the 7-day default.
    const twoDaysAgo = now - 2 * DAY;
    expect(isPurgeable(twoDaysAgo, now, DAY)).toBe(true);
    expect(isPurgeable(twoDaysAgo, now)).toBe(false);
  });
});
