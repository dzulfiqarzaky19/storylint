"use client";

// World switcher (TCK-017, W-5 UI cut-over; TCK-022 W-4a multi-world). The
// top-of-wiki picker for the ACTIVE universe -> world. Series and Book are no
// longer surfaced here (book handling moved to /write). Re-scoping is URL-driven:
// changing the universe navigates to /wiki?u= and picking a world to /wiki?u=&w=;
// the SERVER re-renders loadWorldSnapshot for that scope, so the active world is
// shareable and E2E-testable (no client snapshot swap). The World select lists
// the active universe's REAL worlds (TCK-022) — a second world is now creatable
// (`+ world`) and selectable. New-* affordances call the structural create
// actions (no wiki token) then navigate. Delete opens a DANGER ConfirmModal that
// shows the REAL cascade row-count.

import { useCallback, useRef, useState, startTransition } from "react";
import { useRouter } from "next/navigation";
import type { WorldUniverseNode } from "@/lib/db/queries";
import {
  createUniverse,
  createWorld,
  deleteUniverse,
  previewCascade,
} from "@/lib/actions/wiki";
import ConfirmModal from "../ui/ConfirmModal";
import Modal from "../ui/Modal";
import { canSubmitName } from "./nameGate";
import styles from "./WorldSwitcher.module.css";

interface WorldSwitcherProps {
  tree: WorldUniverseNode[];
  activeUniverseId: string;
  /** The active world id (TCK-022: resolved from ?w= against the universe's worlds). */
  activeWorldId: string;
}

type DeleteTarget = { level: "universe"; id: string; name: string };

/** An open naming dialog: its heading and the callback that runs on submit. */
type NamePromptState = {
  title: string;
  onSubmit: (name: string) => void;
};

/**
 * Build /wiki?u=&w= for a scope. `w` is optional: omit it (picking a universe)
 * and the server resolves that universe's first world; pass it (picking a world)
 * to select a specific world. Omitted axes fall back on the server default.
 */
function scopeHref(u: string, w?: string): string {
  const params = new URLSearchParams({ u });
  if (w) params.set("w", w);
  return `/wiki?${params.toString()}`;
}

export default function WorldSwitcher({
  tree,
  activeUniverseId,
  activeWorldId,
}: WorldSwitcherProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [pendingCount, setPendingCount] = useState<number | null>(null);
  const [namePrompt, setNamePrompt] = useState<NamePromptState | null>(null);

  const universe = tree.find((u) => u.id === activeUniverseId) ?? tree[0];

  const go = useCallback(
    (u: string, w?: string) => {
      startTransition(() => router.push(scopeHref(u, w)));
    },
    [router],
  );

  // ---- Scope selects -------------------------------------------------------
  // Picking a universe drops the world param so the server resolves that
  // universe's first world; picking a world keeps the active universe and sets w.
  const onPickUniverse = useCallback((uId: string) => go(uId), [go]);
  const onPickWorld = useCallback(
    (wId: string) => go(activeUniverseId, wId),
    [go, activeUniverseId],
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

  const onNewWorld = useCallback(() => {
    setNamePrompt({
      title: "Name the new world",
      onSubmit: (name) =>
        void runCreate(
          () => createWorld({ worldName: name, universeId: activeUniverseId }),
          // The new world lands under the active universe; re-render from the
          // server so the World select lists it. The writer then switches to it.
          () => router.refresh(),
        ),
    });
  }, [runCreate, router, activeUniverseId]);

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
    const res = await deleteUniverse({ universeId: deleteTarget.id, confirmed: true });
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
          <span className={styles.axisLabel}>World</span>
          <select
            aria-label="Active world"
            value={activeWorldId}
            disabled={busy || !universe}
            onChange={(e) => onPickWorld(e.target.value)}
          >
            {/* TCK-022 (W-4a): the active universe's REAL worlds, ordered by
                sort_order (getWorldTree). A second world is now selectable and
                switching navigates to /wiki?u=&w=. */}
            {(universe?.worlds ?? []).map((w) => (
              <option key={w.id} value={w.id}>{w.title}</option>
            ))}
          </select>
        </label>
      </div>

      <div className={styles.actions}>
        <button type="button" onClick={onNewUniverse} disabled={busy}>+ universe</button>
        <button type="button" onClick={onNewWorld} disabled={busy || !universe}>+ world</button>
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
 * universe reads as part of the app. Built on the base <Modal>, which owns the
 * scrim, the centered Ashkeld panel, the focus trap + restore, and dismissal
 * (Escape and backdrop click both fire onClose -> onCancel). This dialog only
 * supplies its content: a title, the name field (the first focusable, so Modal
 * moves focus straight to it on open), and the actions.
 *
 * Enter submits via the form. The Create button is disabled until the name is
 * submittable, and the submit handler re-checks the SAME gate (canSubmitName) so
 * an empty or whitespace-only name can never be created even via Enter (this is
 * the safety net that was the prompt's `if (!name) return`).
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
  const submittable = canSubmitName(value);
  // Re-entrancy guard: a same-tick Enter + Create-click (or a React double-fire)
  // must create only ONE world/universe. Flip this true SYNCHRONOUSLY at the top
  // of submit() before onSubmit runs, so the second same-tick call is dropped.
  // Mirrors ResearchScreen's askInFlight ref. The prompt unmounts on success, so
  // it never needs resetting on the happy path.
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
            Create
          </button>
        </div>
      </form>
    </Modal>
  );
}
