"use client";

/* Hallmark · pre-emit critique: P4 H4 E4 S4 R5 V4 */

// T-SCOPE-1 — design 3a: the scope switcher folded INTO the header wordmark.
// The old standalone <WorldSwitcher> band is gone; the wordmark ASHKELD now
// reads as a breadcrumb pill (ASHKELD · <active world> ▾) that opens the SAME
// universe/world dropdown the band used to own (universe groups, world radios,
// + New world / + New universe, Manage link).
//
// Wiring (path a): the surface layout supplies the `tree` (loaded server-side by
// getWorldTree). The ACTIVE scope is still URL-driven, so this client component
// reads ?u/?w itself via useSearchParams and resolves it with the SAME pure
// resolveWikiScope the /wiki server page uses — one resolver, no drift. Picking a
// world navigates to /wiki?u=&w= (server re-renders loadWorldSnapshot), which is
// why Vosk Reach + Halen City are now reachable from the menu, not only by URL.
//
// The pure model (flattenSwitcher) and the label (breadcrumbLabel) stay in
// switcherMenu.ts (unit-tested); the interactive open/close + create flow is
// proven by the Firefox / playwright drive.

import {
  useEffect,
  useRef,
  useState,
  startTransition,
} from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { WorldUniverseNode } from "@/lib/db/queries";
import { createUniverse, createWorld } from "@/lib/actions/wiki";
import { resolveWikiScope } from "@/app/wiki/scope";
import Modal from "../ui/Modal";
import { canSubmitName } from "../wiki/nameGate";
import { scopeHref } from "../wiki/scopeHref";
import { flattenSwitcher, breadcrumbLabel } from "../wiki/switcherMenu";
import styles from "../wiki/WorldSwitcher.module.css";
import pill from "./ScopePill.module.css";

interface ScopePillProps {
  tree: WorldUniverseNode[];
}

/** An open naming dialog: its heading and the callback that runs on submit. */
type NamePromptState = {
  title: string;
  onSubmit: (name: string) => void;
};

export default function ScopePill({ tree }: ScopePillProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [namePrompt, setNamePrompt] = useState<NamePromptState | null>(null);

  const rootRef = useRef<HTMLDivElement>(null);

  // Active scope is URL-driven; resolve it with the SAME pure helper the /wiki
  // server page uses so the pill and the page never disagree on which world is
  // active (a layout can't read searchParams, so we read them here).
  const { activeUniverseId, activeWorldId } = resolveWikiScope(
    tree,
    searchParams.get("u") ?? undefined,
    searchParams.get("w") ?? undefined,
  );

  // Pure model (unit-tested in switcherMenu.test.ts).
  const items = flattenSwitcher(tree, activeUniverseId, activeWorldId);
  const crumb = breadcrumbLabel(tree, activeUniverseId, activeWorldId);

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

  // Scope navigation + new-* affordances. These are plain functions: the React
  // Compiler auto-memoizes them, and manual useCallback here can't be preserved
  // (activeUniverseId is a compiler-derived local, not a stable prop) — which
  // trips react-hooks/preserve-manual-memoization. Let the compiler own it.
  const go = (u: string, w?: string) => {
    setOpen(false);
    startTransition(() => router.push(scopeHref(u, w)));
  };

  const runCreate = async <T,>(
    fn: () => Promise<{ ok: true; data: T } | { ok: false; error: string }>,
    after: (data: T) => void,
  ) => {
    setBusy(true);
    setError(null);
    const res = await fn();
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    after(res.data);
  };

  const onNewUniverse = () => {
    setOpen(false);
    setNamePrompt({
      title: "Name the new universe",
      onSubmit: (name) =>
        void runCreate(
          () => createUniverse({ universeName: name }),
          () => router.refresh(),
        ),
    });
  };

  const onNewWorld = () => {
    setOpen(false);
    setNamePrompt({
      title: "Name the new world",
      onSubmit: (name) =>
        void runCreate(
          () => createWorld({ worldName: name, universeId: activeUniverseId }),
          // TCK-E02: land ON the new (empty) world via ?w=, not the universe's
          // first world (a bare refresh snaps back to worlds[0]).
          ({ worldId }) =>
            startTransition(() => {
              router.push(scopeHref(activeUniverseId, worldId));
              router.refresh();
            }),
        ),
    });
  };

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
        {crumb ? (
          <>
            <span className={pill.wordmark}>{crumb.universe}</span>
            <span className={pill.world}>{crumb.world}</span>
          </>
        ) : (
          <>
            <span className={pill.wordmark}>ASHKELD</span>
            <span className={pill.world}>No worlds</span>
          </>
        )}
        <span className={pill.caret} aria-hidden="true">
          ▾
        </span>
      </button>

      {open ? (
        <div className={styles.menu} role="menu" aria-label="Switch universe or world">
          <ul className={styles.menuList}>
            {tree.map((u) => (
              <li key={u.id} className={styles.group}>
                <p className={styles.groupHead}>{u.name}</p>
                <ul className={styles.groupList}>
                  {items
                    .filter((it) => it.universeId === u.id)
                    .map((it) => (
                      <li key={it.worldId}>
                        <button
                          type="button"
                          role="menuitemradio"
                          aria-checked={it.active}
                          className={
                            it.active ? `${styles.item} ${styles.itemActive}` : styles.item
                          }
                          onClick={() => go(it.universeId, it.worldId)}
                        >
                          <span className={styles.tick} aria-hidden="true">
                            {it.active ? "✓" : ""}
                          </span>
                          {it.worldTitle}
                        </button>
                      </li>
                    ))}
                </ul>
              </li>
            ))}
          </ul>

          <div className={styles.menuFooter}>
            <button
              type="button"
              role="menuitem"
              className={styles.footerAction}
              onClick={onNewWorld}
              disabled={busy}
            >
              + New world
            </button>
            <button
              type="button"
              role="menuitem"
              className={styles.footerAction}
              onClick={onNewUniverse}
              disabled={busy}
            >
              + New universe
            </button>
            <Link
              href="/wiki/manage"
              role="menuitem"
              className={styles.manageLink}
              onClick={() => setOpen(false)}
            >
              Manage universes &amp; worlds…
            </Link>
          </div>
        </div>
      ) : null}

      {error ? (
        <p role="alert" className={styles.error}>
          {error}
        </p>
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
    </div>
  );
}

/**
 * On-system inline naming dialog (unchanged from the old band). Built on the base
 * <Modal>; supplies title, the name field (first focusable), and actions. Enter
 * submits; Create is gated by canSubmitName, and submit() re-checks the SAME gate
 * so an empty/whitespace name can never be created even via Enter. A synchronous
 * re-entrancy guard makes a same-tick Enter+click create only one.
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
          autoFocus
        />
        <div className={styles.promptActions}>
          <button
            type="button"
            className={styles.promptCancel}
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="submit"
            className={styles.promptConfirm}
            disabled={!submittable}
          >
            Create
          </button>
        </div>
      </form>
    </Modal>
  );
}
