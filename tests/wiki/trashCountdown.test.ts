import { describe, expect, it } from "vitest";
import { trashCountdown } from "@/lib/wiki/trashCountdown";
import { RETENTION_MS } from "@/lib/wiki/retention";

// F6-S6b — the ONE pure decision the trash-countdown UI routes through. The
// panel row shows either "purges in N days" (still within retention) or a
// "ready to purge" state (retention elapsed). This helper owns that boundary so
// the JSX stays a dumb consumer and the decision is unit-mutation-locked.

const DAY = 24 * 60 * 60 * 1000;

describe("trashCountdown (F6-S6b)", () => {
  it("reports NOT purgeable with the whole window left the instant an entry is deleted", () => {
    const now = 1_000_000_000_000;
    const c = trashCountdown(now, now); // deleted just now
    expect(c.purgeable).toBe(false);
    expect(c.daysLeft).toBe(7); // full 7-day window remains
  });

  it("rounds the days-left UP so a partial day still shows a whole day left", () => {
    const now = 1_000_000_000_000;
    // deleted 6 days + 1ms ago -> 23h59m59.999s remain -> ceil -> 1 day left.
    const c = trashCountdown(now - (6 * DAY + 1), now);
    expect(c.purgeable).toBe(false);
    expect(c.daysLeft).toBe(1);
  });

  it("is purgeable with 0 days left exactly at the retention boundary (inclusive)", () => {
    const now = 1_000_000_000_000;
    const c = trashCountdown(now - RETENTION_MS, now); // deleted exactly 7d ago
    expect(c.purgeable).toBe(true);
    expect(c.daysLeft).toBe(0);
  });

  it("is purgeable with 0 days left once the window has fully elapsed", () => {
    const now = 1_000_000_000_000;
    const c = trashCountdown(now - (RETENTION_MS + 5 * DAY), now); // 12d ago
    expect(c.purgeable).toBe(true);
    expect(c.daysLeft).toBe(0); // never negative
  });
});
