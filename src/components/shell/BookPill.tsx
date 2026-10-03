"use client";

import { useEffect, useRef, useState, startTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { WorldUniverseNode } from "@/domain/structure";
import { editWorldStructure, previewStructureDelete } from "@/server/actions/wiki/worldStructure";
import { lastChildHint } from "@/domain/wiki/structureEdit";
import { resolveActiveScope, scopedHref } from "@/domain/scope/activeScope";
import ConfirmModal from "../ui/ConfirmModal";
import NamePrompt from "./NamePrompt";
import switcher from "./SwitcherMenu.module.css";
import pill from "./ScopePill.module.css";

interface BookPillProps {
  tree: WorldUniverseNode[];
}

type NamePromptState = {
  title: string;
  initial: string;
  confirmLabel: string;
  onSubmit: (name: string) => void;
};

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
  const bookBlock = lastChildHint("book", books.length);

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

  const goBook = (bookId: string) => {
    setOpen(false);
    startTransition(() => router.push(scopedHref("/write", { ...scope, bookId })));
  };

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
            const res = await editWorldStructure({
              op: "create",
              level: "book",
              name,
              worldId: activeWorldId,
            });
            if (!res.ok) return res;
            startTransition(() => {
              router.push(scopedHref("/write", { ...scope, bookId: res.data.bookId! }));
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
      onSubmit: (name) =>
        void run(() =>
          editWorldStructure({ op: "rename", level: "book", id: activeBook.id, name }),
        ),
    });
  };

  const openDelete = async () => {
    if (!activeBook || bookBlock !== null) return;
    setOpen(false);
    setError(null);
    setPendingCount(null);
    setDeleteTarget({ id: activeBook.id, name: activeBook.name });
    const res = await previewStructureDelete({ level: "book", id: activeBook.id });
    if (res.ok) setPendingCount(res.data.total);
    else setError(res.error);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const target = deleteTarget;
    const nextBook = books.find((b) => b.id !== target.id);
    setDeleteTarget(null);
    setPendingCount(null);
    await run(
      () => editWorldStructure({ op: "delete", level: "book", id: target.id, confirmed: true }),
      () => {
        startTransition(() => {
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
        <span className={pill.wordmark}>{world?.title ?? "STORYLINT"}</span>
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
              disabled={busy || bookBlock !== null}
              title={bookBlock ?? undefined}
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
