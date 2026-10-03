import type { ReactNode } from "react";
import type { PickerCategory, PickerEntry } from "./WikiTargetPicker";
import styles from "./WikiTargetPicker.module.css";

function Pill({
  checked,
  onSelect,
  children,
}: {
  checked: boolean;
  onSelect: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      className={checked ? styles.pillActive : styles.pill}
      onClick={onSelect}
    >
      {children}
    </button>
  );
}

function Level({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section className={styles.level} aria-label={label}>
      {children}
    </section>
  );
}

export function CategorySection({
  categories,
  categoryId,
  isNew,
  locked,
  newName,
  onPick,
  onPickNew,
  onNewName,
}: {
  categories: PickerCategory[];
  categoryId: string;
  isNew: boolean;
  locked: boolean;
  newName: string;
  onPick: (categoryId: string) => void;
  onPickNew: () => void;
  onNewName: (name: string) => void;
}) {
  return (
    <Level label="Category">
      <span className={styles.levelLabel}>Category</span>
      {locked ? (
        <span className={styles.fixedTarget}>
          {categories.find((c) => c.id === categoryId)?.label ?? categoryId}
        </span>
      ) : (
        <div className={styles.pills} role="radiogroup" aria-label="Category">
          {categories.map((c) => (
            <Pill key={c.id} checked={c.id === categoryId} onSelect={() => onPick(c.id)}>
              {c.label}
            </Pill>
          ))}
          <Pill checked={isNew} onSelect={onPickNew}>
            + Add new
          </Pill>
        </div>
      )}
      {!locked && isNew && (
        <input
          type="text"
          className={styles.field}
          placeholder="New category name"
          value={newName}
          onChange={(e) => onNewName(e.target.value)}
          aria-label="New category name"
        />
      )}
    </Level>
  );
}

export function EntrySection({
  entries,
  selectedId,
  isMint,
  lockedName,
  query,
  newName,
  onQuery,
  onPick,
  onPickNew,
  onNewName,
}: {
  entries: PickerEntry[];
  selectedId: string;
  isMint: boolean;
  /** Set when the picker edits one existing fact: the entry cannot change. */
  lockedName: string | undefined;
  query: string;
  newName: string;
  onQuery: (query: string) => void;
  onPick: (entryId: string) => void;
  onPickNew: () => void;
  onNewName: (name: string) => void;
}) {
  return (
    <Level label="Entry">
      <span className={styles.levelLabel}>Entry</span>
      {lockedName !== undefined ? (
        <span className={styles.fixedTarget}>{lockedName}</span>
      ) : (
        <>
          <input
            type="text"
            className={styles.search}
            placeholder="Search entries…"
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            aria-label="Search entries"
          />
          <div className={styles.pills} role="radiogroup" aria-label="Entry">
            <Pill checked={isMint} onSelect={onPickNew}>
              + Add new
            </Pill>
            {entries.map((e) => (
              <Pill key={e.id} checked={e.id === selectedId} onSelect={() => onPick(e.id)}>
                {e.name}
              </Pill>
            ))}
          </div>
          {isMint && (
            <input
              type="text"
              className={styles.field}
              placeholder="New entry name"
              value={newName}
              onChange={(e) => onNewName(e.target.value)}
              aria-label="New entry name"
            />
          )}
        </>
      )}
    </Level>
  );
}

export function DetailSection({
  label,
  factKey,
  factValue,
  keyLocked,
  onKey,
  onValue,
}: {
  label: string;
  factKey: string;
  factValue: string;
  keyLocked: boolean;
  onKey: (key: string) => void;
  onValue: (value: string) => void;
}) {
  return (
    <Level label="Detail">
      <span className={styles.levelLabel}>{label}</span>
      <div className={styles.kv}>
        <input
          type="text"
          className={styles.field}
          placeholder="Key (e.g. Carries)"
          value={factKey}
          onChange={(e) => onKey(e.target.value)}
          aria-label="Detail key"
          readOnly={keyLocked}
        />
        <input
          type="text"
          className={styles.field}
          placeholder="Value (e.g. a bone-handled knife)"
          value={factValue}
          onChange={(e) => onValue(e.target.value)}
          aria-label="Detail value"
        />
      </div>
    </Level>
  );
}
