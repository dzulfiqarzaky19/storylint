/**
 * Trash server-action wrappers (F6-S6a, actions/wiki.ts).
 *
 * These wrappers sit between the trash panel and the DB layer. Their behavior-
 * bearing responsibilities:
 *
 *   - restoreEntry is a WIKI WRITE (it re-enters a tombstone into the live wiki),
 *     so it MUST mint a confirmWikiWrite token and pass it to the mutation, and
 *     on success it MUST reload the entry WITH details and return it (the reducer
 *     re-adds a complete row).
 *   - purgeExpiredDeleted is a DESTRUCTIVE WIKI WRITE, so it MUST mint a token AND
 *     OWN the cutoff (now - RETENTION_MS) — no caller may widen the purge window.
 *   - getDeletedEntries is a pure READ, so it must NOT mint a token.
 *
 * We mock the DB layer (no Postgres) and assert exactly what each wrapper
 * forwards, including token presence/absence via call arity and cutoff ownership.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { RETENTION_MS } from "@/lib/wiki/retention";
import type { EntryWithDetails } from "@/lib/domain/types";

const restoreEntryRow = vi.fn(async (_arg: unknown, _conf: unknown) => 1);
const purgeDeletedBeforeRow = vi.fn(async (_arg: unknown, _conf: unknown) => 2);
const getDeletedEntriesRow = vi.fn(async () => [] as unknown[]);
const getEntryWithDetails = vi.fn(async (_id: string) => detailed);

const detailed: EntryWithDetails = {
  id: "e1",
  kind: "character",
  name: "Restored",
  catalogueNo: "—",
  note: "",
  summary: "",
  shelf: "people",
  sortOrder: 0,
  deletedAt: null,
  facts: [],
  ties: [],
  appearances: [],
  openQuestions: [],
};

vi.mock("@/lib/db/gazetteer-mutations", () => ({
  restoreEntry: (arg: unknown, conf: unknown) => restoreEntryRow(arg, conf),
  purgeDeletedBefore: (arg: unknown, conf: unknown) => purgeDeletedBeforeRow(arg, conf),
  insertFact: vi.fn(),
  insertTie: vi.fn(),
  deleteTie: vi.fn(),
  createEntryWithTie: vi.fn(),
  updateFactEntry: vi.fn(),
  reorderShelf: vi.fn(),
  insertEntry: vi.fn(),
  updateEntryFields: vi.fn(),
  updateFact: vi.fn(),
  getMaxSortOrderForShelf: vi.fn(),
  softDeleteEntry: vi.fn(),
  renameCategory: vi.fn(),
  resetCategoryLabel: vi.fn(),
  deleteCategory: vi.fn(),
}));

vi.mock("@/lib/db/gazetteer", () => ({
  getDeletedEntries: () => getDeletedEntriesRow(),
  getEntryWithDetails: (id: string) => getEntryWithDetails(id),
  loadWikiSnapshot: vi.fn(),
  getCategories: vi.fn(),
}));

import {
  getDeletedEntries,
  restoreEntry,
  purgeExpiredDeleted,
} from "@/lib/actions/wiki";

beforeEach(() => {
  restoreEntryRow.mockClear();
  restoreEntryRow.mockResolvedValue(1);
  purgeDeletedBeforeRow.mockClear();
  purgeDeletedBeforeRow.mockResolvedValue(2);
  getDeletedEntriesRow.mockClear();
  getDeletedEntriesRow.mockResolvedValue([]);
  getEntryWithDetails.mockClear();
  getEntryWithDetails.mockResolvedValue(detailed);
});

describe("getDeletedEntries wrapper (READ — no token)", () => {
  it("forwards to the query with NO arguments and returns {entries}", async () => {
    getDeletedEntriesRow.mockResolvedValueOnce([{ id: "z" }]);
    const res = await getDeletedEntries();
    expect(res).toEqual({ ok: true, data: { entries: [{ id: "z" }] } });
    expect(getDeletedEntriesRow).toHaveBeenCalledTimes(1);
    // Pure read: the query takes no token. Zero args forwarded.
    expect(getDeletedEntriesRow.mock.calls[0]!.length).toBe(0);
  });

  it("surfaces a query failure as a failed ActionResult", async () => {
    getDeletedEntriesRow.mockRejectedValueOnce(new Error("db down"));
    const res = await getDeletedEntries();
    expect(res.ok).toBe(false);
    if (res.ok) throw new Error("expected failure");
    expect(res.error).toContain("wiki.getDeletedEntries");
  });
});

describe("restoreEntry wrapper (WIKI WRITE — product rule 1)", () => {
  it("mints a token, passes it as the 2nd arg, and returns the reloaded entry", async () => {
    const res = await restoreEntry({ id: "e1" });
    expect(res).toEqual({ ok: true, data: { entry: detailed } });

    expect(restoreEntryRow).toHaveBeenCalledTimes(1);
    const call = restoreEntryRow.mock.calls[0]!;
    // Two arguments: the payload AND the confirmation token.
    expect(call.length).toBe(2);
    expect(call[0]).toEqual({ id: "e1" });
    expect(call[1]).toBeDefined();
    expect(call[1]).not.toBeNull();

    // On success the wrapper reloads the now-live entry WITH details.
    expect(getEntryWithDetails).toHaveBeenCalledWith("e1");
  });

  it("fails without reloading when the mutation restored 0 rows (missing/already live)", async () => {
    restoreEntryRow.mockResolvedValueOnce(0);
    const res = await restoreEntry({ id: "gone" });
    expect(res.ok).toBe(false);
    if (res.ok) throw new Error("expected failure");
    expect(res.error).toContain("could not be restored");
    // The guard short-circuits: no reload attempted on a 0-row restore.
    expect(getEntryWithDetails).not.toHaveBeenCalled();
  });

  it("surfaces a mutation failure as a failed ActionResult", async () => {
    restoreEntryRow.mockRejectedValueOnce(new Error("boom"));
    const res = await restoreEntry({ id: "e1" });
    expect(res.ok).toBe(false);
    if (res.ok) throw new Error("expected failure");
    expect(res.error).toContain("wiki.restoreEntry");
  });
});

describe("purgeExpiredDeleted wrapper (DESTRUCTIVE WIKI WRITE — product rule 1)", () => {
  it("mints a token, OWNS the cutoff (now - RETENTION_MS), and returns {purged}", async () => {
    const before = Date.now();
    const res = await purgeExpiredDeleted({ confirmed: true });
    const after = Date.now();
    expect(res).toEqual({ ok: true, data: { purged: 2 } });

    expect(purgeDeletedBeforeRow).toHaveBeenCalledTimes(1);
    const call = purgeDeletedBeforeRow.mock.calls[0]!;
    // Two arguments: the payload AND the confirmation token.
    expect(call.length).toBe(2);
    const payload = call[0] as { cutoffMs: number };
    // Cutoff is owned here: now - RETENTION_MS, within the call window.
    expect(payload.cutoffMs).toBeGreaterThanOrEqual(before - RETENTION_MS);
    expect(payload.cutoffMs).toBeLessThanOrEqual(after - RETENTION_MS);
    expect(call[1]).toBeDefined();
    expect(call[1]).not.toBeNull();
  });

  it("returns the mutation's purged count as {purged}", async () => {
    purgeDeletedBeforeRow.mockResolvedValueOnce(5);
    const res = await purgeExpiredDeleted({ confirmed: true });
    expect(res.ok).toBe(true);
    if (!res.ok) throw new Error("expected ok");
    expect(res.data).toEqual({ purged: 5 });
  });

  it("surfaces a mutation failure as a failed ActionResult", async () => {
    purgeDeletedBeforeRow.mockRejectedValueOnce(new Error("boom"));
    const res = await purgeExpiredDeleted({ confirmed: true });
    expect(res.ok).toBe(false);
    if (res.ok) throw new Error("expected failure");
    expect(res.error).toContain("wiki.purgeExpiredDeleted");
  });
});
