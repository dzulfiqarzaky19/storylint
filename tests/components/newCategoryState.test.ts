import { describe, it, expect } from "vitest";
import { resolveNewCategory } from "@/components/wiki/newCategoryState";

// TCK-019: the "New category" popup delegates its Add commit to
// resolveNewCategory (the modal can't be rendered under vitest
// environment:'node'). These tests lock the two behavior-bearing branches:
// the blank guard, and the idempotency contract that the caller-minted id is
// echoed verbatim so a double-invoked commit reuses ONE id (the server INSERT
// ON CONFLICT then dedupes to a single row).
describe("resolveNewCategory", () => {
  it("is a noop for a blank label (empty or whitespace-only)", () => {
    expect(resolveNewCategory("", "id-1")).toEqual({ action: "noop" });
    expect(resolveNewCategory("   ", "id-1")).toEqual({ action: "noop" });
    expect(resolveNewCategory("\t\n ", "id-1")).toEqual({ action: "noop" });
  });

  it("creates with the trimmed label keyed by the minted id", () => {
    expect(resolveNewCategory("Guilds", "id-42")).toEqual({
      action: "create",
      id: "id-42",
      label: "Guilds",
    });
    // Surrounding whitespace is trimmed off the label the server stores.
    expect(resolveNewCategory("  Doomed  ", "id-7")).toEqual({
      action: "create",
      id: "id-7",
      label: "Doomed",
    });
  });

  it("echoes the SAME minted id on two commits of one open (idempotency)", () => {
    // A single click can fire the submit handler twice. Because the caller mints
    // the id ONCE per open and passes that same id in, both commits carry the
    // identical id, so the server dedupes them to one category row.
    const first = resolveNewCategory("Sects", "open-id-9");
    const second = resolveNewCategory("Sects", "open-id-9");
    expect(first).toEqual({ action: "create", id: "open-id-9", label: "Sects" });
    expect(second).toEqual({ action: "create", id: "open-id-9", label: "Sects" });
    // The load-bearing invariant: the id is reused, not regenerated per commit.
    expect(first).toEqual(second);
    if (first.action === "create" && second.action === "create") {
      expect(first.id).toBe(second.id);
    }
  });
});
