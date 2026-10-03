"use server";

import { type EntryRow, type EntryWithDetails } from "@/domain/types";
import { type ActionResult, confirmWikiWrite, runAction } from "@/domain/result";
import { getDeletedEntries as getDeletedEntriesRow } from "@/server/db/gazetteer/reads";
import { getEntryWithDetails } from "@/server/db/gazetteer/snapshots";
import { purgeDeletedBefore as purgeDeletedBeforeRow, restoreEntry as restoreEntryRow } from "@/server/db/gazetteer/mutations/entries";
import { RETENTION_MS } from "@/domain/wiki/retention";

export async function getDeletedEntries(): Promise<
  ActionResult<{ entries: EntryRow[] }>
> {
  return runAction("wiki.getDeletedEntries", async () => {
    const entries = await getDeletedEntriesRow();
    return { ok: true, data: { entries } };
  });
}

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
