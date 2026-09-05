"use client";

// /wiki/manage — the shared "manage universes & worlds" screen (design 3c). One
// place to CREATE, RENAME, and DELETE universes and worlds, kept off the wiki
// header so the breadcrumb switcher (design 3a) stays a lean switch-and-create
// control. Every affordance here is one `editWorldStructure` intent; the minted
// ids, the revalidate target and the last-child guard live behind it.
//
// Deletes go through the danger ConfirmModal in its type-the-name variant
// (requireTypeToConfirm): the writer must retype the exact universe/world name,
// matching the app-wide "irreversible actions are gated" rule. The row-count is
// fetched from previewStructureDelete, which runs the SAME cascade plan the
// delete runs, so the stated blast radius is the real one.
//
// Last-world safety: a universe must keep at least one world (deleting the last
// would orphan every shared entity with no world to reclaim it in). The SERVER
// refuses that delete; the disabled affordance below is the advisory hint, in the
// server's own words (lastChildHint).

import { useCallback, useState, startTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { WorldUniverseNode } from "@/lib/db/queries";
import { editWorldStructure, previewStructureDelete } from "@/lib/actions/wiki";
import { lastChildHint } from "@/lib/wiki/structureEdit";
import ConfirmModal from "@/components/ui/ConfirmModal";
import Modal from "@/components/ui/Modal";
import { canSubmitName } from "@/lib/nameGate";
import styles from "./WikiManage.module.css";

interface WikiManageProps {
  tree: WorldUniverseNode[];
}

/** The target of an open delete flow (level + id + the exact name to retype). */
type DeleteTarget =
  | { level: "universe"; id: string; name: string }
  | { level: "world"; id: string; name: string };

/** An open naming dialog (create or rename): heading, the initial field value,
 *  the confirm-button label, and the callback that runs with the trimmed name. */
type NamePromptState = {
  title: string;
  initial: string;
  confirmLabel: string;
  onSubmit: (name: string) => void;
};

export default function WikiManage({ tree }: WikiManageProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [pendingCount, setPendingCount] = useState<number | null>(null);
  const [namePrompt, setNamePrompt] = useState<NamePromptState | null>(null);

  // ---- Shared action runner ------------------------------------------------
  // Every mutation (create/rename/delete) runs through this: set busy, clear the
  // last error, await, surface an error or re-render from the server so the tree
  // reflects the change. router.refresh() re-runs the server component's
  // getWorldTree, so the list is always the DB truth after a mutation.
  const run = useCallback(
    async (fn: () => Promise<{ ok: true } | { ok: false; error: string }>) => {
      setBusy(true);
      setError(null);
      const res = await fn();
      setBusy(false);
      if (!res.ok) {
        setError(res.error);
        return false;
      }
      startTransition(() => router.refresh());
      return true;
    },
    [router],
  );

  // ---- Create --------------------------------------------------------------
  const onNewUniverse = useCallback(() => {
    setNamePrompt({
      title: "Name the new universe",
      initial: "",
      confirmLabel: "Create",
      onSubmit: (name) =>
        void run(() => editWorldStructure({ op: "create", level: "universe", name })),
    });
  }, [run]);

  const onNewWorld = useCallback(
    (universeId: string) => {
      setNamePrompt({
        title: "Name the new world",
        initial: "",
        confirmLabel: "Create",
        onSubmit: (name) =>
          void run(() =>
            editWorldStructure({ op: "create", level: "world", name, universeId }),
          ),
      });
    },
    [run],
  );

  // ---- Rename --------------------------------------------------------------
  const onRenameUniverse = useCallback(
    (id: string, current: string) => {
      setNamePrompt({
        title: "Rename universe",
        initial: current,
        confirmLabel: "Rename",
        onSubmit: (name) =>
          void run(() => editWorldStructure({ op: "rename", level: "universe", id, name })),
      });
    },
    [run],
  );

  const onRenameWorld = useCallback(
    (id: string, current: string) => {
      setNamePrompt({
        title: "Rename world",
        initial: current,
        confirmLabel: "Rename",
        onSubmit: (name) =>
          void run(() => editWorldStructure({ op: "rename", level: "world", id, name })),
      });
    },
    [run],
  );

  // ---- Delete (type-the-name danger) ---------------------------------------
  const openDelete = useCallback(async (target: DeleteTarget) => {
    setError(null);
    setPendingCount(null);
    setDeleteTarget(target);
    const res = await previewStructureDelete({ level: target.level, id: target.id });
    if (res.ok) setPendingCount(res.data.total);
    else setError(res.error);
  }, []);

  const confirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setDeleteTarget(null);
    setPendingCount(null);
    await run(() =>
      editWorldStructure({ op: "delete", level: target.level, id: target.id, confirmed: true }),
    );
  }, [deleteTarget, run]);

  const deleteBody =
    deleteTarget && pendingCount !== null
      ? deleteTarget.level === "world"
        ? `This permanently removes ${pendingCount} row${pendingCount === 1 ? "" : "s"} (this world and its links). Shared entities are unlinked, not deleted, and survive in their other worlds. This cannot be undone.`
        : `This permanently removes ${pendingCount} row${pendingCount === 1 ? "" : "s"} (the universe and everything inside it). This cannot be undone.`
      : "Counting what will be removed...";

  return (
    <main className={styles.screen} aria-labelledby="manage-heading">
      <header className={styles.head}>
        <div>
          <h1 id="manage-heading" className={styles.title}>
            Manage universes &amp; worlds
          </h1>
          <p className={styles.sub}>
            Create, rename, and delete the universes and worlds behind the gazetteer.
          </p>
        </div>
        <Link href="/wiki" className={styles.back}>
          &larr; Back to the gazetteer
        </Link>
      </header>

      {error ? (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      ) : null}

      <div className={styles.toolbar}>
        <button type="button" className={styles.newUniverse} onClick={onNewUniverse} disabled={busy}>
          + New universe
        </button>
      </div>

      <ul className={styles.universes}>
        {tree.map((u) => {
          const worldBlock = lastChildHint("world", u.worlds.length);
          return (
            <li key={u.id} className={styles.universe}>
              <div className={styles.universeHead}>
                <h2 className={styles.universeName}>{u.name}</h2>
                <div className={styles.rowActions}>
                  <button
                    type="button"
                    className={styles.ghost}
                    onClick={() => onRenameUniverse(u.id, u.name)}
                    disabled={busy}
                  >
                    Rename
                  </button>
                  <button
                    type="button"
                    className={styles.danger}
                    onClick={() => void openDelete({ level: "universe", id: u.id, name: u.name })}
                    disabled={busy}
                  >
                    Delete
                  </button>
                </div>
              </div>

              <ul className={styles.worlds}>
                {u.worlds.map((w) => (
                  <li key={w.id} className={styles.world}>
                    <span className={styles.worldName}>{w.title}</span>
                    <div className={styles.rowActions}>
                      <button
                        type="button"
                        className={styles.ghost}
                        onClick={() => onRenameWorld(w.id, w.title)}
                        disabled={busy}
                      >
                        Rename
                      </button>
                      <button
                        type="button"
                        className={styles.danger}
                        // Never orphan the last world (see file header).
                        disabled={busy || worldBlock !== null}
                        title={worldBlock ?? undefined}
                        onClick={() => void openDelete({ level: "world", id: w.id, name: w.title })}
                      >
                        Delete
                      </button>
                    </div>
                  </li>
                ))}
                <li className={styles.worldNew}>
                  <button
                    type="button"
                    className={styles.ghost}
                    onClick={() => onNewWorld(u.id)}
                    disabled={busy}
                  >
                    + New world
                  </button>
                </li>
              </ul>
            </li>
          );
        })}
      </ul>

      {deleteTarget ? (
        <ConfirmModal
          title={`Delete ${deleteTarget.name}?`}
          body={deleteBody}
          confirmLabel={pendingCount === null ? "Counting..." : `Delete ${pendingCount} rows`}
          cancelLabel="Cancel"
          danger
          requireTypeToConfirm={deleteTarget.name}
          onConfirm={() => void confirmDelete()}
          onCancel={() => {
            setDeleteTarget(null);
            setPendingCount(null);
          }}
        />
      ) : null}

      {namePrompt ? (
        <NamePrompt
          title={namePrompt.title}
          initial={namePrompt.initial}
          confirmLabel={namePrompt.confirmLabel}
          onSubmit={(name) => {
            const target = namePrompt;
            setNamePrompt(null);
            target.onSubmit(name);
          }}
          onCancel={() => setNamePrompt(null)}
        />
      ) : null}
    </main>
  );
}

/**
 * On-system inline naming dialog for create AND rename. Built on the base
 * <Modal> (scrim, centered panel, focus trap + restore, Escape/backdrop
 * dismissal). The Confirm button is disabled until the name is submittable
 * (canSubmitName — the same non-empty/non-whitespace gate the switcher uses),
 * and the submit handler re-checks the SAME gate so Enter can't submit a blank.
 * For rename it seeds with the current name; a blank submit is blocked here and
 * the rename action itself treats blank as a no-op (belt and suspenders).
 */
function NamePrompt({
  title,
  initial,
  confirmLabel,
  onSubmit,
  onCancel,
}: {
  title: string;
  initial: string;
  confirmLabel: string;
  onSubmit: (name: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(initial);
  const submittable = canSubmitName(value);

  const submit = () => {
    if (!canSubmitName(value)) return;
    onSubmit(value.trim());
  };

  return (
    <Modal open onClose={onCancel} ariaLabel={title}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <h2 className={styles.promptTitle}>{title}</h2>
        <input
          className={styles.promptInput}
          type="text"
          aria-label={title}
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        <div className={styles.promptActions}>
          <button type="button" className={styles.promptCancel} onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className={styles.promptConfirm} disabled={!submittable}>
            {confirmLabel}
          </button>
        </div>
      </form>
    </Modal>
  );
}
