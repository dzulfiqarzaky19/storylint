"use client";

// World switcher (F7 S5). The top-of-wiki picker for the ACTIVE universe ->
// series -> book. Re-scoping is URL-driven: changing a select navigates to
// /wiki?u=&se=&b= and the SERVER re-renders loadWikiSnapshot for that scope, so
// the active world is shareable and E2E-testable (no client snapshot swap). New-*
// affordances call the structural create actions (no wiki token) then navigate to
// the freshly created scope. Delete opens a DANGER ConfirmModal that shows the
// REAL cascade row-count (advisory preview) before the writer confirms.

import { useCallback, useEffect, useRef, useState, startTransition } from "react";
import { useRouter } from "next/navigation";
import type { WorldUniverseNode } from "@/lib/db/queries";
import {
  createUniverse,
  createSeries,
  createBook,
  deleteUniverse,
  deleteSeries,
  deleteBook,
  previewCascade,
} from "@/lib/actions/wiki";
import ConfirmModal from "../ui/ConfirmModal";
import styles from "./WorldSwitcher.module.css";

interface WorldSwitcherProps {
  tree: WorldUniverseNode[];
  activeUniverseId: string;
  activeSeriesId: string;
  activeBookId: string;
}

type DeleteTarget =
  | { level: "universe"; id: string; name: string }
  | { level: "series"; id: string; name: string }
  | { level: "book"; id: string; name: string };

/** An open naming dialog: its heading and the callback that runs on submit. */
type NamePromptState = {
  title: string;
  onSubmit: (name: string) => void;
};

/** Build /wiki?u=&se=&b= for a scope. Omitted axes fall back on the server default. */
function scopeHref(u: string, se: string, b: string): string {
  const params = new URLSearchParams({ u, se, b });
  return `/wiki?${params.toString()}`;
}

export default function WorldSwitcher({
  tree,
  activeUniverseId,
  activeSeriesId,
  activeBookId,
}: WorldSwitcherProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [pendingCount, setPendingCount] = useState<number | null>(null);
  const [namePrompt, setNamePrompt] = useState<NamePromptState | null>(null);

  const universe = tree.find((u) => u.id === activeUniverseId) ?? tree[0];
  const series =
    universe?.series.find((s) => s.id === activeSeriesId) ?? universe?.series[0];
  const books = series?.books ?? [];

  const go = useCallback(
    (u: string, se: string, b: string) => {
      startTransition(() => router.push(scopeHref(u, se, b)));
    },
    [router],
  );

  // ---- Scope selects -------------------------------------------------------
  const onPickUniverse = useCallback(
    (uId: string) => {
      const u = tree.find((x) => x.id === uId);
      const firstSe = u?.series[0];
      const firstB = firstSe?.books[0];
      go(uId, firstSe?.id ?? "", firstB?.id ?? "");
    },
    [tree, go],
  );

  const onPickSeries = useCallback(
    (seId: string) => {
      const se = universe?.series.find((x) => x.id === seId);
      const firstB = se?.books[0];
      go(activeUniverseId, seId, firstB?.id ?? "");
    },
    [universe, activeUniverseId, go],
  );

  const onPickBook = useCallback(
    (bId: string) => go(activeUniverseId, activeSeriesId, bId),
    [activeUniverseId, activeSeriesId, go],
  );

  // ---- New-* affordances ---------------------------------------------------
  const runCreate = useCallback(
    async (fn: () => Promise<{ ok: true } | { ok: false; error: string }>, after: () => void) => {
      setBusy(true);
      setError(null);
      const res = await fn();
      setBusy(false);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      after();
    },
    [],
  );

  const onNewUniverse = useCallback(() => {
    setNamePrompt({
      title: "Name the new universe",
      onSubmit: (name) =>
        void runCreate(
          () => createUniverse({ universeName: name }),
          // A fresh universe becomes the active scope; re-render from the server
          // so the picker shows it (and its empty wiki).
          () => router.refresh(),
        ),
    });
  }, [runCreate, router]);

  const onNewSeries = useCallback(() => {
    if (!universe) return;
    setNamePrompt({
      title: `Name the new series in "${universe.name}"`,
      onSubmit: (name) =>
        void runCreate(
          () => createSeries({ name, universeId: universe.id }),
          () => router.refresh(),
        ),
    });
  }, [runCreate, router, universe]);

  const onNewBook = useCallback(() => {
    if (!series) return;
    setNamePrompt({
      title: `Name the new book in "${series.name}"`,
      onSubmit: (name) =>
        void runCreate(
          () => createBook({ name, seriesId: series.id }),
          () => router.refresh(),
        ),
    });
  }, [runCreate, router, series]);

  // ---- Delete cascade (danger) --------------------------------------------
  const openDelete = useCallback(
    async (target: DeleteTarget) => {
      setError(null);
      setPendingCount(null);
      setDeleteTarget(target);
      // Fetch the advisory blast radius (server action) so the modal shows a REAL
      // number before the writer confirms.
      const res = await previewCascade({ level: target.level, id: target.id });
      if (res.ok) setPendingCount(res.data.total);
      else setError(res.error);
    },
    [],
  );

  const confirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    setBusy(true);
    setError(null);
    let res;
    if (deleteTarget.level === "universe") {
      res = await deleteUniverse({ universeId: deleteTarget.id, confirmed: true });
    } else if (deleteTarget.level === "series") {
      res = await deleteSeries({ seriesId: deleteTarget.id, confirmed: true });
    } else {
      res = await deleteBook({ bookId: deleteTarget.id, confirmed: true });
    }
    setBusy(false);
    setDeleteTarget(null);
    setPendingCount(null);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    // The deleted scope is gone; go home to the default world and re-render.
    startTransition(() => {
      router.push("/wiki");
      router.refresh();
    });
  }, [deleteTarget, router]);

  const deleteBody =
    deleteTarget && pendingCount !== null
      ? `This permanently removes ${pendingCount} row${pendingCount === 1 ? "" : "s"} (the ${deleteTarget.level} and everything inside it). This cannot be undone.`
      : "Counting what will be removed...";

  return (
    <section className={styles.switcher} aria-label="World switcher">
      <div className={styles.axes}>
        <label className={styles.axis}>
          <span className={styles.axisLabel}>Universe</span>
          <select
            aria-label="Active universe"
            value={universe?.id ?? ""}
            disabled={busy}
            onChange={(e) => onPickUniverse(e.target.value)}
          >
            {tree.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
        </label>

        <label className={styles.axis}>
          <span className={styles.axisLabel}>Series</span>
          <select
            aria-label="Active series"
            value={series?.id ?? ""}
            disabled={busy || !universe}
            onChange={(e) => onPickSeries(e.target.value)}
          >
            {(universe?.series ?? []).map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </label>

        <label className={styles.axis}>
          <span className={styles.axisLabel}>Book</span>
          <select
            aria-label="Active book"
            value={activeBookId}
            disabled={busy || !series}
            onChange={(e) => onPickBook(e.target.value)}
          >
            {books.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </label>
      </div>

      <div className={styles.actions}>
        <button type="button" onClick={onNewUniverse} disabled={busy}>+ universe</button>
        <button type="button" onClick={onNewSeries} disabled={busy || !universe}>+ series</button>
        <button type="button" onClick={onNewBook} disabled={busy || !series}>+ book</button>
        {series ? (
          <button
            type="button"
            className={styles.danger}
            disabled={busy}
            onClick={() => void openDelete({ level: "book", id: activeBookId, name: books.find((b) => b.id === activeBookId)?.name ?? "book" })}
          >
            delete book
          </button>
        ) : null}
        {universe ? (
          <button
            type="button"
            className={styles.danger}
            disabled={busy}
            onClick={() => void openDelete({ level: "universe", id: universe.id, name: universe.name })}
          >
            delete universe
          </button>
        ) : null}
      </div>

      {error ? <p role="alert" className={styles.error}>{error}</p> : null}

      {deleteTarget ? (
        <ConfirmModal
          title={`Delete ${deleteTarget.name}?`}
          body={deleteBody}
          confirmLabel={pendingCount === null ? "Counting..." : `Delete ${pendingCount} rows`}
          cancelLabel="Cancel"
          danger
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
          onSubmit={(name) => {
            const target = namePrompt;
            setNamePrompt(null);
            target.onSubmit(name);
          }}
          onCancel={() => setNamePrompt(null)}
        />
      ) : null}
    </section>
  );
}

/**
 * On-system inline naming dialog. Replaces the raw window.prompt so creating a
 * universe/series/book reads as part of the app: an Ashkeld-tokened panel over
 * the scrim, focus moved to the field on open, Enter submits, Escape and the
 * backdrop cancel. The confirm button is disabled until the trimmed name is
 * non-empty, so an empty name can never be submitted (was the prompt's `if
 * (!name) return` guard).
 */
function NamePrompt({
  title,
  onSubmit,
  onCancel,
}: {
  title: string;
  onSubmit: (name: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const trimmed = value.trim();

  useEffect(() => {
    inputRef.current?.focus();
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onCancel]);

  const submit = () => {
    if (trimmed) onSubmit(trimmed);
  };

  return (
    <div className={styles.promptBackdrop} onClick={onCancel}>
      <form
        className={styles.promptPanel}
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <h2 className={styles.promptTitle}>{title}</h2>
        <input
          ref={inputRef}
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
          <button type="submit" className={styles.promptConfirm} disabled={!trimmed}>
            Create
          </button>
        </div>
      </form>
    </div>
  );
}
