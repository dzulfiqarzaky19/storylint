"use client";

// World switcher — design 3a (wordmark breadcrumb + dropdown). Replaces the old
// toolbar band of two <select>s and four buttons. The header now reads as a
// breadcrumb — "Universe / World ▾" — that opens ONE dropdown listing every
// universe (as a group header) with its worlds beneath; picking a world
// navigates to that scope. Creating a universe/world lives in the same menu;
// DELETE and RENAME moved to the dedicated /wiki/manage screen (design 3c),
// reached via the menu's "Manage…" link, so this control stays a lean
// switch-and-create affordance.
//
// Re-scoping is still URL-driven (the SERVER re-renders loadWorldSnapshot for the
// picked scope, so the active world is shareable + E2E-testable): picking a world
// navigates to /wiki?u=&w=. New-* affordances call the structural create actions
// (no wiki token) then navigate. The menu's open/close + outside-click/Escape
// dismissal is local UI state; the selectable model (flattenSwitcher) and the
// breadcrumb label (breadcrumbLabel) are pure and unit-tested (switcherMenu.ts).

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  startTransition,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { WorldUniverseNode } from "@/lib/db/queries";
import { createUniverse, createWorld } from "@/lib/actions/wiki";
import Modal from "../ui/Modal";
import { canSubmitName } from "./nameGate";
import { scopeHref } from "./scopeHref";
import { flattenSwitcher, breadcrumbLabel } from "./switcherMenu";
import styles from "./WorldSwitcher.module.css";

interface WorldSwitcherProps {
  tree: WorldUniverseNode[];
  activeUniverseId: string;
  /** The active world id (TCK-022: resolved from ?w= against the universe's worlds). */
  activeWorldId: string;
}

/** An open naming dialog: its heading and the callback that runs on submit. */
type NamePromptState = {
  title: string;
  onSubmit: (name: string) => void;
};

export default function WorldSwitcher({
  tree,
  activeUniverseId,
  activeWorldId,
}: WorldSwitcherProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [namePrompt, setNamePrompt] = useState<NamePromptState | null>(null);

  const rootRef = useRef<HTMLDivElement>(null);

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

  // ---- Scope navigation ----------------------------------------------------
  const go = useCallback(
    (u: string, w?: string) => {
      setOpen(false);
      startTransition(() => router.push(scopeHref(u, w)));
    },
    [router],
  );

  // ---- New-* affordances ---------------------------------------------------
  const runCreate = useCallback(
    async <T,>(
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
    },
    [],
  );

  const onNewUniverse = useCallback(() => {
    setOpen(false);
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
    setOpen(false);
    setNamePrompt({
      title: "Name the new world",
      onSubmit: (name) =>
        void runCreate(
          () => createWorld({ worldName: name, universeId: activeUniverseId }),
          // TCK-E02: the new world lands under the active universe — NAVIGATE to
          // it (?w=<newWorldId>) so the writer lands ON the new (empty) world.
          // A bare router.refresh() left ?w= absent and resolveWikiScope snapped
          // back to the universe's first world (its gazetteer, not the new one).
          ({ worldId }) =>
            startTransition(() => {
              router.push(scopeHref(activeUniverseId, worldId));
              router.refresh();
            }),
        ),
    });
  }, [runCreate, router, activeUniverseId]);

  return (
    <section className={styles.switcher} aria-label="World switcher">
      <div className={styles.bar} ref={rootRef}>
        <button
          type="button"
          className={styles.crumb}
          aria-haspopup="menu"
          aria-expanded={open}
          disabled={busy || !crumb}
          onClick={() => setOpen((o) => !o)}
        >
          {crumb ? (
            <>
              <span className={styles.crumbUniverse}>{crumb.universe}</span>
              <span className={styles.crumbSep} aria-hidden="true">
                /
              </span>
              <span className={styles.crumbWorld}>{crumb.world}</span>
            </>
          ) : (
            <span className={styles.crumbWorld}>No worlds</span>
          )}
          <span className={styles.caret} aria-hidden="true">
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
      </div>

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
    </section>
  );
}

/**
 * On-system inline naming dialog. Replaces the raw window.prompt so creating a
 * universe/world reads as part of the app. Built on the base <Modal>, which owns
 * the scrim, the centered Ashkeld panel, the focus trap + restore, and dismissal
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
