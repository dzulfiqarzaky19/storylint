import { describe, it, expect } from "vitest";
import {
  resolveConfirmTarget,
  type ConfirmRecommendation,
} from "@/lib/research/resolveConfirmTarget";

// -----------------------------------------------------------------------------
// F6-S3b — resolveConfirmTarget (PURE). Locks the strip-choice -> enrichEntryId
// mapping that drives confirmCard's enrich-vs-new branch.
// -----------------------------------------------------------------------------

const rec: ConfirmRecommendation = { entryId: "e-tower", name: "The Tower" };

describe("resolveConfirmTarget", () => {
  it("'recommended' choice enriches the recommended entry", () => {
    expect(resolveConfirmTarget({ kind: "recommended" }, rec)).toBe("e-tower");
  });

  it("'new' choice creates a new entry (undefined enrichEntryId)", () => {
    expect(resolveConfirmTarget({ kind: "new" }, rec)).toBeUndefined();
  });

  it("'pick' choice enriches the explicitly chosen entry", () => {
    expect(
      resolveConfirmTarget({ kind: "pick", entryId: "e-maren" }, rec),
    ).toBe("e-maren");
  });

  it("'recommended' with NO recommendation falls back to new (undefined)", () => {
    expect(resolveConfirmTarget({ kind: "recommended" }, null)).toBeUndefined();
  });
});
