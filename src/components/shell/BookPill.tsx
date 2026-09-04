"use client";

/* Hallmark · pre-emit critique: P4 H4 E4 S4 R5 V4 */

// T-SCOPE-2 — the /write scope pill. Same design-3a pattern as /wiki's ScopePill,
// but its axis is the BOOK: the pill reads <ACTIVE WORLD> · <ACTIVE BOOK> ▾ and
// the dropdown lists the ACTIVE WORLD's books (radio switch) plus footer actions
// (+ New book / Rename book / Delete book). Switching a book navigates to
// /write?u=&w=&book= so the server page re-renders listChapters(activeBookId) and
// the left index shows exactly that book's chapters (killing the six colliding
// "CHAPTER ONE" from the old un-filtered 42-chapter list).
//
// Wiring: the layout supplies the `tree` (getWorldTree, server-side). The active
// scope is URL-driven — this client reads ?u/?w/?book itself and resolves it with
// the SAME pure resolveWriteScope the /write server page uses (one resolver, no
// drift). Create/rename/delete reuse the EXISTING structural actions
// (createBook / renameBook / deleteBook + previewCascade), so there is no new
// backend beyond renameBook. Delete goes through the shared danger ConfirmModal in
// its type-the-name variant, and the LAST book in a world can't be deleted (a
// world must keep a home for chapters — mirrors the last-world guard).

import { useEffect, useRef, useState, startTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { WorldUniverseNode } from "@/lib/db/queries";
import { createBook, renameBook, deleteBook, previewCascade } from "@/lib/actions/wiki";
import { resolveActiveScope, scopedHref } from "@/lib/scope/activeScope";
import Modal from "../ui/Modal";
import ConfirmModal from "../ui/ConfirmModal";
import { canSubmitName } from "../wiki/nameGate";
import switcher from "../wiki/WorldSwitcher.module.css";
import pill from "./ScopePill.module.css";

interface BookPillProps {
  tree: WorldUniverseNode[];
}

/** An open naming dialog (create or rename): heading, initial value, confirm
 *  label, and the callback that runs with the trimmed name. */
type NamePromptState = {
  title: string;
  initial: string;
  confirmLabel: string;
  onSubmit: (name: string) => void;
};

/** The target of an open book-delete flow (id + exact name to retype). */
type DeleteTarget = { id: string; name: string };

export default function BookPill({ tree }: BookPillProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [namePrompt, setNamePrompt] = useState<NamePromptState | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [pendingCount, setPendingCount] = useState<number | null>(null);

  const rootRef = useRef<HTMLDivElement>(null);

  // Active scope is URL-driven; resolve it with the ONE resolver every surface
  // uses so the pill and the page never disagree on the active book.
  const scope = resolveActiveScope(tree, {
    u: searchParams.get("u") ?? undefined,
    w: searchParams.get("w") ?? undefined,
    book: searchParams.get("book") ?? undefined,
  });
  const { universeId: activeUniverseId, worldId: activeWorldId, bookId: activeBookId } = scope;

  const universe = tree.find((u) => u.id === activeUniverseId);
  const world = universe?.worlds.find((w) => w.id === activeWorldId);
  const books = world?.books ?? [];
  const activeBook = books.find((b) => b.id === activeBookId) ?? null;
  // Last-book guard: a world must keep at least one book (a home for chapters),
  // mirroring the last-world guard on /wiki/manage.
  const canDeleteBook = books.length > 1;

  // ---- Menu dismissal: outside-click + Escape ------------------------------
  useEffect(() => {
    if (!open) return;
    const onDocPointer = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDocPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDocPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Navigate to a book within the active world. The server re-renders
  // listChapters(activeBookId), so the left index re-scopes to that book.
  const goBook = (bookId: string) => {
    setOpen(false);
    startTransition(() => router.push(scopedHref("/write", { ...scope, bookId })));
  };

  // Shared runner for create/rename/delete: busy + error handling, then re-render
  // from the server so the pill + chapter list reflect the DB truth.
  const run = async (
    fn: () => Promise<{ ok: true } | { ok: false; error: string }>,
    after?: () => void,
  ) => {
    setBusy(true);
    setError(null);
    const res = await fn();
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    if (after) after();
    else startTransition(() => router.refresh());
  };

  const onNewBook = () => {
    setOpen(false);
    setNamePrompt({
      title: "Name the new book",
      initial: "",
      confirmLabel: "Create",
      onSubmit: (name) =>
        void run(
          async () => {
            const res = await createBook({ name, worldId: activeWorldId });
            if (!res.ok) return res;
            // Land ON the new book so the writer sees its (empty) chapter set.
            startTransition(() => {
              router.push(scopedHref("/write", { ...scope, bookId: res.data.bookId }));
              router.refresh();
            });
            return res;
          },
          () => {},
        ),
    });
  };

  const onRenameBook = () => {
    if (!activeBook) return;
    setOpen(false);
    setNamePrompt({
      title: "Rename book",
      initial: activeBook.name,
      confirmLabel: "Rename",
      onSubmit: (name) => void run(() => renameBook({ bookId: activeBook.id, name })),
    });
  };

  const openDelete = async () => {
    if (!activeBook || !canDeleteBook) return;
    setOpen(false);
    setError(null);
    setPendingCount(null);
    setDeleteTarget({ id: activeBook.id, name: activeBook.name });
    const res = await previewCascade({ level: "book", id: activeBook.id });
    if (res.ok) setPendingCount(res.data.total);
    else setError(res.error);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const target = deleteTarget;
    // Where to land after delete: the first SURVIVING book of this world.
    const nextBook = books.find((b) => b.id !== target.id);
    setDeleteTarget(null);
    setPendingCount(null);
    await run(
      () => deleteBook({ bookId: target.id, confirmed: true }),
      () => {
        startTransition(() => {
          // No surviving book means no book axis to carry, so /write resolves one.
          router.push(scopedHref("/write", { ...scope, bookId: nextBook?.id }));
          router.refresh();
        });
      },
    );
  };

  const deleteBody =
    pendingCount !== null
      ? `This permanently removes ${pendingCount} row${pendingCount === 1 ? "" : "s"} (this book and its chapters). Sibling books, the world, and shared entities survive. This cannot be undone.`
      : "Counting what will be removed...";

  return (
    <div className={pill.root} ref={rootRef}>
      <button
        type="button"
        className={pill.pill}
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={busy}
        onClick={() => setOpen((o) => !o)}
      >
        <span className={pill.wordmark}>{world?.title ?? "ASHKELD"}</span>
        <span className={pill.world}>{activeBook?.name ?? "No book"}</span>
        <span className={pill.caret} aria-hidden="true">
          ▾
        </span>
      </button>

      {activeBook ? (
        <a
          className={pill.export}
          href={`/api/export/${activeBook.id}`}
          title={`Export "${activeBook.name}" as Markdown`}
          data-testid="export-book"
        >
          Export
        </a>
      ) : (
        <span
          className={pill.export}
          aria-disabled="true"
          title="No book to export"
          data-testid="export-book"
        >
          Export
        </span>
      )}

      {open ? (
        <div className={switcher.menu} role="menu" aria-label="Switch book">
          <ul className={switcher.menuList}>
            <li className={switcher.group}>
              <p className={switcher.groupHead}>{world?.title ?? "Books"}</p>
              <ul className={switcher.groupList}>
                {books.map((b) => (
                  <li key={b.id}>
                    <button
                      type="button"
                      role="menuitemradio"
                      aria-checked={b.id === activeBookId}
                      className={
                        b.id === activeBookId
                          ? `${switcher.item} ${switcher.itemActive}`
                          : switcher.item
                      }
                      onClick={() => goBook(b.id)}
                    >
                      <span className={switcher.tick} aria-hidden="true">
                        {b.id === activeBookId ? "✓" : ""}
                      </span>
                      {b.name}
                    </button>
                  </li>
                ))}
              </ul>
            </li>
          </ul>

          <div className={switcher.menuFooter}>
            <button
              type="button"
              role="menuitem"
              className={switcher.footerAction}
              onClick={onNewBook}
              disabled={busy}
            >
              + New book
            </button>
            <button
              type="button"
              role="menuitem"
              className={switcher.footerAction}
              onClick={onRenameBook}
              disabled={busy || !activeBook}
            >
              Rename book
            </button>
            <button
              type="button"
              role="menuitem"
              className={switcher.footerAction}
              onClick={() => void openDelete()}
              disabled={busy || !canDeleteBook}
              title={canDeleteBook ? undefined : "A world must keep at least one book"}
            >
              Delete book
            </button>
          </div>
        </div>
      ) : null}

      {error ? (
        <p role="alert" className={switcher.error}>
          {error}
        </p>
      ) : null}

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
    </div>
  );
}

/**
 * On-system inline naming dialog for create AND rename (same base <Modal> +
 * canSubmitName gate as ScopePill/WikiManage). Enter submits; Confirm is disabled
 * until the name is submittable, and submit() re-checks the SAME gate so a blank
 * can't be created via Enter. Seeds with the current name for rename.
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
  const submittingRef = useRef(false);

  const submit = () => {
    if (submittingRef.current) return;
    if (!canSubmitName(value)) return;
    submittingRef.current = true;
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
        <h2 className={switcher.promptTitle}>{title}</h2>
        <input
          className={switcher.promptInput}
          type="text"
          aria-label={title}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          autoFocus
        />
        <div className={switcher.promptActions}>
          <button type="button" className={switcher.promptCancel} onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className={switcher.promptConfirm} disabled={!submittable}>
            {confirmLabel}
          </button>
        </div>
      </form>
    </Modal>
  );
}
