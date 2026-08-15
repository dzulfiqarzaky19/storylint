/**
 * renameWorld / renameUniverse DB mutations (mutations.ts).
 *
 * These two structural renames sit behind the manage screen's Rename affordance.
 * Their behavior-bearing contract mirrors renameCategory exactly:
 *
 *   1. TRIM the input before writing (no stored leading/trailing whitespace).
 *   2. A blank / whitespace-only name is a NO-OP: it must NOT issue an UPDATE,
 *      because a blank write would render a nameless world/universe in the
 *      switcher and manage screen.
 *   3. On a real name, issue exactly one parameterized UPDATE with the trimmed
 *      value and the id — worlds.title / universes.name respectively.
 *
 * We mock the pool `query` (no Postgres) and assert on the SQL + params, which
 * locks both the guard (blank -> zero queries) and the column each writes to.
 *
 * Mutation-proof anchors (behavior-bearing lines):
 *   - `if (title === "") return;`  drop it -> the blank-no-op test issues an
 *     UPDATE and its `query` call-count assertion goes RED.
 *   - `.trim()`                    drop it -> the "writes the trimmed value" test
 *     sees the padded string and goes RED.
 *   - `UPDATE worlds SET title`    swap the column/table -> the SQL assertion
 *     goes RED (guards renameWorld from writing universes.name and vice-versa).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const query = vi.fn(async (_sql: string, _params: unknown[]) => ({ rows: [] }));

vi.mock("@/lib/db/pool", () => ({
  query: (sql: string, params: unknown[]) => query(sql, params),
  // Siblings imported by mutations.ts; stub so the module loads. None reached
  // by the two functions under test.
  one: vi.fn(),
  rows: vi.fn(),
  withTransaction: vi.fn(),
}));

import { renameWorld, renameUniverse } from "@/lib/db/mutations";

beforeEach(() => {
  query.mockClear();
});

describe("renameWorld mutation", () => {
  it("issues one UPDATE worlds SET title with the TRIMMED value and id", async () => {
    await renameWorld({ id: "world-1", title: "  Kirn cycle  " });
    expect(query).toHaveBeenCalledTimes(1);
    const [sql, params] = query.mock.calls[0]!;
    expect(sql).toMatch(/UPDATE\s+worlds\s+SET\s+title/i);
    // $1 = id, $2 = trimmed title (locks both .trim() and the param order).
    expect(params).toEqual(["world-1", "Kirn cycle"]);
  });

  it("is a NO-OP for a blank / whitespace-only title (never writes)", async () => {
    await renameWorld({ id: "world-1", title: "   " });
    expect(query).not.toHaveBeenCalled();
  });

  it("is a NO-OP for an empty title", async () => {
    await renameWorld({ id: "world-1", title: "" });
    expect(query).not.toHaveBeenCalled();
  });
});

describe("renameUniverse mutation", () => {
  it("issues one UPDATE universes SET name with the TRIMMED value and id", async () => {
    await renameUniverse({ id: "uni-1", name: "  Ashkeld  " });
    expect(query).toHaveBeenCalledTimes(1);
    const [sql, params] = query.mock.calls[0]!;
    expect(sql).toMatch(/UPDATE\s+universes\s+SET\s+name/i);
    expect(params).toEqual(["uni-1", "Ashkeld"]);
  });

  it("is a NO-OP for a blank / whitespace-only name (never writes)", async () => {
    await renameUniverse({ id: "uni-1", name: "  \t " });
    expect(query).not.toHaveBeenCalled();
  });
});
