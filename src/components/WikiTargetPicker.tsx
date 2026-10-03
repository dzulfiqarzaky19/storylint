"use client";

import { useMemo, useState } from "react";
import type { ResolvedTarget, CheckedAgainst } from "@/domain/check";
import type { PickerResult } from "@/domain/wiki/pickedTarget";
import { CategorySection, DetailSection, EntrySection } from "./WikiTargetPickerSections";
import styles from "./WikiTargetPicker.module.css";

export interface PickerCategory {
  id: string;
  label: string;
}

export interface PickerEntry {
  id: string;
  name: string;
  kind: string;
}

export interface WikiTargetPickerProps {
  resolvedTarget: ResolvedTarget;
  checkedAgainst?: CheckedAgainst;
  categories: PickerCategory[];
  entries: PickerEntry[];
  onConfirm: (result: PickerResult) => void;
  onCancel: () => void;
}

const NEW_ENTRY = "\u0000new-entry" as const;
const NEW_CATEGORY = "\u0000new-category" as const;

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

  const [newCategoryName, setNewCategoryName] = useState(
    () => resolvedTarget.category.proposeName ?? "",
  );

  const isNewCategory = categoryId === NEW_CATEGORY;

  const [entrySel, setEntrySel] = useState<string>(
    () => resolvedTarget.entry.id ?? NEW_ENTRY,
  );

  const [newName, setNewName] = useState(
    () => resolvedTarget.entry.proposeName ?? "",
  );

  const [factKey, setFactKey] = useState(
    () => resolvedTarget.fact?.key ?? checkedAgainst?.factKey ?? "",
  );
  const [factValue, setFactValue] = useState(
    () => resolvedTarget.fact?.value ?? "",
  );

  const [entryQuery, setEntryQuery] = useState("");

  const isMint = entrySel === NEW_ENTRY;

  // Correcting a contradicted fact: category, entry and key are fixed, only
  // the value can change.
  const isLockedEdit = Boolean(checkedAgainst?.factId);

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

  const mintingEntry = isNewCategory || isMint;
  const confirmDisabled =
    (isNewCategory && newCategoryName.trim() === "") ||
    (mintingEntry
      ? newName.trim() === "" || factValue.trim() === ""
      : factKey.trim() === "" || factValue.trim() === "");

  const submit = () => {
    if (confirmDisabled) return;
    onConfirm({
      categoryId: isNewCategory ? "" : categoryId,
      proposeCategoryName: isNewCategory ? newCategoryName.trim() : undefined,
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

        <CategorySection
          categories={categories}
          categoryId={categoryId}
          isNew={isNewCategory}
          locked={isLockedEdit}
          newName={newCategoryName}
          onPick={(id) => {
            setCategoryId(id);
            setEntrySel(NEW_ENTRY);
          }}
          onPickNew={() => {
            setCategoryId(NEW_CATEGORY);
            setEntrySel(NEW_ENTRY);
          }}
          onNewName={setNewCategoryName}
        />

        <EntrySection
          entries={entriesInCategory}
          selectedId={entrySel}
          isMint={isMint}
          lockedName={isLockedEdit ? (checkedName ?? "") : undefined}
          query={entryQuery}
          newName={newName}
          onQuery={setEntryQuery}
          onPick={setEntrySel}
          onPickNew={() => setEntrySel(NEW_ENTRY)}
          onNewName={setNewName}
        />

        <DetailSection
          label={isLockedEdit ? "Changed value" : isMint ? "First detail" : "Detail to add"}
          factKey={factKey}
          factValue={factValue}
          keyLocked={isLockedEdit}
          onKey={setFactKey}
          onValue={setFactValue}
        />

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
