"use server";

// ============================================================================
// Wiki trash (restore / purge) server actions
// Split out of the former monolithic wiki.ts (T-ARCH-7). Product rule 1 and the
// runAction envelope are unchanged; only file boundaries moved.
// ============================================================================

import { type EntryRow, type EntryWithDetails } from "../../domain/types";
import { type ActionResult, confirmWikiWrite, runAction } from "../confirmation";
import { getDeletedEntries as getDeletedEntriesRow, getEntryWithDetails } from "../../db/gazetteer";
import {
  purgeDeletedBefore as purgeDeletedBeforeRow,
  restoreEntry as restoreEntryRow,
} from "../../db/gazetteer-mutations";
import { RETENTION_MS } from "../../wiki/retention";

/**
 * Read the "recently deleted" list: every soft-deleted entry, newest deletion
 * first, for the trash panel. NOT a wiki write (pure read), so no confirmation
 * token. Each row carries `deletedAt` (a real number, see the CAST in the query)
 * so the UI can render the purge countdown via `isPurgeable`.
 */
export async function getDeletedEntries(): Promise<
  ActionResult<{ entries: EntryRow[] }>
> {
  return runAction("wiki.getDeletedEntries", async () => {
    const entries = await getDeletedEntriesRow();
    return { ok: true, data: { entries } };
  });
}

/**
 * WIKI WRITE (product rule 1). Restore a soft-deleted entry: clear `deleted_at`
 * so it re-enters every live read. Restoring content into the live wiki IS a
 * wiki write, so it requires a confirmation token (minted here — restore is
 * non-destructive, so no user confirm dialog is needed). Idempotent server-side
 * (the mutation's `AND deleted_at IS NOT NULL` guard).
 *
 * On success re-loads the now-live entry WITH its details and returns it, so the
 * reducer `RESTORE_ENTRY` re-adds a complete row to session state (its own facts
 * and ties come back; ties from OTHER entries re-link automatically once it is
 * live). Fails when the id was missing or already live (rowCount 0). Mirrors
 * reducer `RESTORE_ENTRY`.
 */
export async function restoreEntry(input: {
  id: string;
}): Promise<ActionResult<{ entry: EntryWithDetails }>> {
  return runAction("wiki.restoreEntry", async () => {
    const confirmation = confirmWikiWrite({ confirmed: true });
    const restored = await restoreEntryRow({ id: input.id }, confirmation);
    if (restored === 0) {
      return { ok: false, error: "Entry could not be restored (missing or already live)." };
    }
    const entry = await getEntryWithDetails(input.id);
    if (!entry) {
      return { ok: false, error: "Restored entry could not be reloaded." };
    }
    return { ok: true, data: { entry } };
  });
}

/**
 * WIKI WRITE (product rule 1, DESTRUCTIVE). Permanently purge every entry that
 * has been soft-deleted for at least the retention window (7 days). This is a
 * hard, irreversible delete (CASCADE removes children), so it REQUIRES an
 * explicit confirmation and is gated behind a danger confirm dialog in the
 * caller. The cutoff (`now - RETENTION_MS`) is OWNED HERE — mirroring how
 * softDeleteEntry owns `deletedAt = Date.now()` — so no caller can widen the
 * purge window. Returns the number of entries purged. Mirrors reducer `PURGE`
 * (which the trash panel handles by re-fetching getDeletedEntries).
 *
 * @param input.confirmed must be the literal `true` — the confirmation gate.
 */
export async function purgeExpiredDeleted(input: {
  confirmed: true;
}): Promise<ActionResult<{ purged: number }>> {
  return runAction("wiki.purgeExpiredDeleted", async () => {
    const confirmation = confirmWikiWrite({ confirmed: input.confirmed });
    const cutoffMs = Date.now() - RETENTION_MS;
    const purged = await purgeDeletedBeforeRow({ cutoffMs }, confirmation);
    return { ok: true, data: { purged } };
  });
}
