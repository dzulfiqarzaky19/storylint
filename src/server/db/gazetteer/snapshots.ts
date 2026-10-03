import { rows } from "../pool";
import type {
  CategoryLabelOverrides,
  CategoryRow,
  EntryRow,
  EntryWithDetails,
  FactRow,
  Kind,
  ResolvedTie,
  WikiSnapshot,
} from "@/domain/types";
import { KIND_SHELF, SHELF_TITLES } from "@/domain/types";
import { ENTRY_COLS, FACT_COLS, getCategories } from "./reads";

const TIE_SELECT = `
  SELECT t.id,
         t.from_entry_id AS "fromEntryId",
         t.to_entry_id   AS "toEntryId",
         t.rel,
         e.name          AS "toName",
         e.category_id   AS "toKind",
         e.catalogue_no  AS "toCatalogueNo"
    FROM ties t
    JOIN entries e ON e.id = t.to_entry_id`;

async function withDetails(entries: EntryRow[]): Promise<EntryWithDetails[]> {
  const entryIds = entries.map((e) => e.id);
  const [facts, ties] = await Promise.all([
    rows<FactRow>(
      `SELECT ${FACT_COLS} FROM facts WHERE entry_id = ANY($1) ORDER BY sort_order, id`,
      [entryIds],
    ),
    rows<ResolvedTie>(
      `${TIE_SELECT} WHERE t.from_entry_id = ANY($1) ORDER BY t.id`,
      [entryIds],
    ),
  ]);

  const byId = new Map<string, EntryWithDetails>(
    entries.map((e) => [e.id, { ...e, facts: [], ties: [] }]),
  );
  for (const f of facts) byId.get(f.entryId)?.facts.push(f);
  for (const t of ties) byId.get(t.fromEntryId)?.ties.push(t);
  return [...byId.values()];
}

// A built-in category counts as renamed when its label differs from its shelf title.
function labelOverrides(categories: CategoryRow[]): CategoryLabelOverrides {
  const overrides: CategoryLabelOverrides = {};
  for (const c of categories) {
    if (!(c.id in KIND_SHELF)) continue;
    const kind = c.id as Kind;
    if (c.label !== SHELF_TITLES[KIND_SHELF[kind]]) overrides[kind] = c.label;
  }
  return overrides;
}

async function snapshotOf(entryRows: EntryRow[]): Promise<WikiSnapshot> {
  const [entries, categories] = await Promise.all([withDetails(entryRows), getCategories()]);
  const byId: Record<string, EntryWithDetails> = {};
  for (const e of entries) byId[e.id] = e;
  return { entries, byId, overrides: labelOverrides(categories), categories };
}

/** Every live entry of a universe, across all its worlds. */
export async function loadWikiSnapshot(universeId: string): Promise<WikiSnapshot> {
  return snapshotOf(
    await rows<EntryRow>(
      `SELECT ${ENTRY_COLS} FROM entries
        WHERE deleted_at IS NULL AND universe_id = $1 AND category_id <> 'plotline'
        ORDER BY shelf, sort_order, name`,
      [universeId],
    ),
  );
}

/** The live entries linked to one world. */
export async function loadWorldSnapshot(worldId: string): Promise<WikiSnapshot> {
  return snapshotOf(
    await rows<EntryRow>(
      `SELECT ${ENTRY_COLS} FROM entries
         JOIN world_entries we ON we.entry_id = id AND we.world_id = $1
        WHERE deleted_at IS NULL AND category_id <> 'plotline'
        ORDER BY shelf, sort_order, name`,
      [worldId],
    ),
  );
}

export async function getEntryWithDetails(id: string): Promise<EntryWithDetails | null> {
  const entries = await withDetails(
    await rows<EntryRow>(
      `SELECT ${ENTRY_COLS} FROM entries WHERE id = $1 AND deleted_at IS NULL`,
      [id],
    ),
  );
  return entries[0] ?? null;
}
