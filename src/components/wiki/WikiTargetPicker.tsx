"use client";

import { useMemo, useState } from "react";
import type { ResolvedTarget, CheckedAgainst } from "@/lib/check";
import type { PickerResult } from "@/lib/research/resolvePickerTarget";
import styles from "./WikiTargetPicker.module.css";

/** A live category pill (built-in or user-created). */
export interface PickerCategory {
  id: string;
  label: string;
}

/** A live wiki entry the picker can enrich, grouped under its category. */
export interface PickerEntry {
  id: string;
  name: string;
  /** Category id (kind) this entry belongs under — groups it beneath a pill. */
  kind: string;
}

export interface WikiTargetPickerProps {
  /**
   * The producer-resolved default the modal OPENS drilled to: category + entry
   * pre-selected, fact key/value prefilled. Synthesized from a research
   * proposition today, read from a check Mark on /write later — the modal never
   * knows which. Every level is still fully overridable below.
   */
  resolvedTarget: ResolvedTarget;
  /**
   * The wiki source the signal was checked against, shown as read-only
   * provenance ("checked against <entry> — <key>: <value>") when present. Absent
   * on /research (a proposal is checked against nothing).
   */
  checkedAgainst?: CheckedAgainst;
  /** Live categories for the top-level pills (world-scoped, same read /wiki uses). */
  categories: PickerCategory[];
  /** Live entries for the mid-level pills/search (deleted-filtered). */
  entries: PickerEntry[];
  /** Emitted once, on confirm — the writer's final (possibly edited) choice. */
  onConfirm: (result: PickerResult) => void;
  onCancel: () => void;
}

const NEW_ENTRY = "\u0000new-entry" as const;
const NEW_CATEGORY = "\u0000new-category" as const;

/**
 * The modal's default category id, by precedence. Pure + exported so the ordering
 * is unit-testable (it shipped inverted once: categories[0] ahead of proposeKind
 * defaulted every /write mark to the first pill, "People", regardless of kind).
 *
 *   1. `category.id`        — an explicit existing category (ENRICH / research).
 *   2. `entry.proposeKind`  — the RESOLVED kind the producer computed for THIS
 *                             mark; it must beat an arbitrary first pill so a
 *                             "New organization" mark defaults to Orders, not People.
 *   3. `categories[0]?.id`  — last-resort fallback when the target resolved neither.
 *   4. `"lore"`             — backstop for an empty category list.
 */
export function pickerCategoryDefault(
  resolvedTarget: ResolvedTarget,
  categories: PickerCategory[],
): string {
  return (
    resolvedTarget.category.id ??
    resolvedTarget.entry.proposeKind ??
    categories[0]?.id ??
    "lore"
  );
}

/**
 * The shared "Add to the wiki" drill-down modal. Category -> entry -> key/value,
 * every level suggested-but-editable, defaulted to `resolvedTarget`. Producer-
 * agnostic (props only, no /research or /write coupling) so /write reuses it
 * verbatim. The confirm button IS the wiki-write gate (product rule 1): it emits
 * a PickerResult the caller routes into the existing confirmCard, and writes
 * nothing itself.
 */
export default function WikiTargetPicker({
  resolvedTarget,
  checkedAgainst,
  categories,
  entries,
  onConfirm,
  onCancel,
}: WikiTargetPickerProps) {
  const [categoryId, setCategoryId] = useState(() =>
    pickerCategoryDefault(resolvedTarget, categories),
  );

  // New-category name (mint a category): seeded from the producer's proposed
  // category name when it named one without an id, still fully editable.
  const [newCategoryName, setNewCategoryName] = useState(
    () => resolvedTarget.category.proposeName ?? "",
  );

  const isNewCategory = categoryId === NEW_CATEGORY;

  // Entry: the resolved existing id (ENRICH default) or the NEW_ENTRY sentinel
  // (MINT default) when the producer proposes a name instead of an id.
  const [entrySel, setEntrySel] = useState<string>(
    () => resolvedTarget.entry.id ?? NEW_ENTRY,
  );

  // New-entry name (MINT): seed from the proposed name so the default mint is
  // one confirm away, still fully editable.
  const [newName, setNewName] = useState(
    () => resolvedTarget.entry.proposeName ?? "",
  );

  // Key/value: prefilled from the resolved fact so the default write is one
  // confirm away; both editable (suggested-but-editable at every level). On a
  // CONTRADICTION the resolvedTarget.fact may be absent (a legacy/cached mark, or
  // the model returned no `suggested` value) — fall back to checkedAgainst.factKey
  // so the locked key is never empty and the writer can always type the fix. The
  // value has no reliable fallback (recordedValue is the OLD, contradicted value,
  // not the correction), so it stays empty for the writer when unsuggested.
  const [factKey, setFactKey] = useState(
    () => resolvedTarget.fact?.key ?? checkedAgainst?.factKey ?? "",
  );
  const [factValue, setFactValue] = useState(
    () => resolvedTarget.fact?.value ?? "",
  );

  const [entryQuery, setEntryQuery] = useState("");

  const isMint = entrySel === NEW_ENTRY;

  // A CONTRADICTION resolves against a known existing fact, so its write is an
  // in-place CORRECTION, not an add: the target entry+fact are already decided by
  // the signal. In that case the modal LOCKS the category and entry to that target
  // — there is nothing to pick, only the value to fix — so the writer can't misfile
  // a correction onto the wrong entry. Gated on the resolved factId so the modal
  // shows EDIT exactly when resolveWikiWriteMode can actually edit that row in place
  // (both AI conflicts and the deterministic rules now resolve it); an AI conflict
  // the server never matched to a row, and /research and not-written-down signals,
  // carry no factId and stay in the free-pick add flow untouched.
  const isLockedEdit = Boolean(checkedAgainst?.factId);
  const lockedEntryName = useMemo(() => {
    if (!isLockedEdit) return undefined;
    return entries.find((e) => e.id === checkedAgainst?.entryId)?.name;
  }, [isLockedEdit, entries, checkedAgainst]);

  // Entries under the picked category, filtered by the search box. The resolved
  // default entry stays reachable even when it sorts past the slice cap.
  const entriesInCategory = useMemo(() => {
    const q = entryQuery.trim().toLowerCase();
    const pool = entries.filter((e) => e.kind === categoryId);
    const matched = q
      ? pool.filter((e) => e.name.toLowerCase().includes(q))
      : pool;
    return matched.slice(0, 12);
  }, [entries, categoryId, entryQuery]);

  const checkedName = useMemo(() => {
    if (!checkedAgainst?.entryId) return undefined;
    return entries.find((e) => e.id === checkedAgainst.entryId)?.name;
  }, [checkedAgainst, entries]);

  // A new category forces a mint (there are no existing entries under a category
  // that does not exist yet), so it needs BOTH its own name AND the new entry's
  // name before confirm is allowed. A plain mint needs the new entry name; an
  // enrich needs a fact key. Every branch needs a value.
  const mintingEntry = isNewCategory || isMint;
  const confirmDisabled =
    (isNewCategory && newCategoryName.trim() === "") ||
    (mintingEntry
      ? newName.trim() === "" || factValue.trim() === ""
      : factKey.trim() === "" || factValue.trim() === "");

  const submit = () => {
    if (confirmDisabled) return;
    onConfirm({
      // A brand-new category has no id yet; the caller mints it via createCategory
      // and uses the returned id as the entry's kind. categoryId carries the
      // sentinel in that case, so leave it empty and let proposeCategoryName drive.
      categoryId: isNewCategory ? "" : categoryId,
      proposeCategoryName: isNewCategory ? newCategoryName.trim() : undefined,
      // A new category can only hold a new entry -> always a mint.
      entryId: isNewCategory || isMint ? undefined : entrySel,
      entryName: isNewCategory || isMint ? newName.trim() : factKey.trim(),
      factKey: factKey.trim(),
      factValue: factValue.trim(),
    });
  };

  return (
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-label={isLockedEdit ? "Change the wiki" : "Add to the wiki"}
      onKeyDown={(e) => {
        if (e.key === "Escape") onCancel();
      }}
    >
      <div className={styles.panel}>
        <header className={styles.head}>
          <h2 className={styles.title}>
            {isLockedEdit ? "Change the wiki" : "Add to the wiki"}
          </h2>
          {checkedName && (
            <p className={styles.provenance}>
              Checked against <strong>{checkedName}</strong>
              {checkedAgainst?.factKey ? ` — ${checkedAgainst.factKey}` : ""}
              {checkedAgainst?.recordedValue
                ? `: ${checkedAgainst.recordedValue}`
                : ""}
            </p>
          )}
        </header>

        <section className={styles.level} aria-label="Category">
          <span className={styles.levelLabel}>Category</span>
          {isLockedEdit ? (
            <span className={styles.fixedTarget}>
              {categories.find((c) => c.id === categoryId)?.label ?? categoryId}
            </span>
          ) : (
          <div className={styles.pills} role="radiogroup" aria-label="Category">
            {categories.map((c) => (
              <button
                key={c.id}
                type="button"
                role="radio"
                aria-checked={c.id === categoryId}
                className={
                  c.id === categoryId ? styles.pillActive : styles.pill
                }
                onClick={() => {
                  setCategoryId(c.id);
                  // Switching category invalidates the selected entry (it lived
                  // under the old category) — fall back to a mint so the writer
                  // re-picks or names one under the new category.
                  setEntrySel(NEW_ENTRY);
                }}
              >
                {c.label}
              </button>
            ))}
            <button
              type="button"
              role="radio"
              aria-checked={isNewCategory}
              className={isNewCategory ? styles.pillActive : styles.pill}
              onClick={() => {
                setCategoryId(NEW_CATEGORY);
                setEntrySel(NEW_ENTRY);
              }}
            >
              + Add new
            </button>
          </div>
          )}
          {!isLockedEdit && isNewCategory && (
            <input
              type="text"
              className={styles.field}
              placeholder="New category name"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              aria-label="New category name"
            />
          )}
        </section>

        <section className={styles.level} aria-label="Entry">
          <span className={styles.levelLabel}>Entry</span>
          {isLockedEdit ? (
            <span className={styles.fixedTarget}>{lockedEntryName}</span>
          ) : (
          <>
          <input
            type="text"
            className={styles.search}
            placeholder="Search entries…"
            value={entryQuery}
            onChange={(e) => setEntryQuery(e.target.value)}
            aria-label="Search entries"
          />
          <div className={styles.pills} role="radiogroup" aria-label="Entry">
            <button
              type="button"
              role="radio"
              aria-checked={isMint}
              className={isMint ? styles.pillActive : styles.pill}
              onClick={() => setEntrySel(NEW_ENTRY)}
            >
              + Add new
            </button>
            {entriesInCategory.map((e) => (
              <button
                key={e.id}
                type="button"
                role="radio"
                aria-checked={e.id === entrySel}
                className={e.id === entrySel ? styles.pillActive : styles.pill}
                onClick={() => setEntrySel(e.id)}
              >
                {e.name}
              </button>
            ))}
          </div>
          {isMint && (
            <input
              type="text"
              className={styles.field}
              placeholder="New entry name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              aria-label="New entry name"
            />
          )}
          </>
          )}
        </section>

        <section className={styles.level} aria-label="Detail">
          <span className={styles.levelLabel}>
            {isLockedEdit
              ? "Changed value"
              : isMint
                ? "First detail"
                : "Detail to add"}
          </span>
          <div className={styles.kv}>
            <input
              type="text"
              className={styles.field}
              placeholder="Key (e.g. Carries)"
              value={factKey}
              onChange={(e) => setFactKey(e.target.value)}
              aria-label="Detail key"
              readOnly={isLockedEdit}
            />
            <input
              type="text"
              className={styles.field}
              placeholder="Value (e.g. a bone-handled knife)"
              value={factValue}
              onChange={(e) => setFactValue(e.target.value)}
              aria-label="Detail value"
            />
          </div>
        </section>

        <footer className={styles.actions}>
          <button
            type="button"
            className={styles.confirm}
            onClick={submit}
            disabled={confirmDisabled}
          >
            {isLockedEdit
              ? "Change it"
              : isMint
                ? "Create entry"
                : "Add detail"}
          </button>
          <button
            type="button"
            className={styles.cancel}
            onClick={onCancel}
          >
            Cancel
          </button>
        </footer>
      </div>
    </div>
  );
}
