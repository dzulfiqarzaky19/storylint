"use client";

import {
  useEffect,
  useRef,
  useState,
  startTransition,
} from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { WorldUniverseNode } from "@/domain/structure";
import { editWorldStructure } from "@/server/actions/wiki/worldStructure";
import { resolveActiveScope, scopedHref } from "@/domain/scope/activeScope";
import { flattenSwitcher, breadcrumbLabel } from "./switcherMenu";
import NamePrompt from "./NamePrompt";
import styles from "./SwitcherMenu.module.css";
import pill from "./ScopePill.module.css";

interface ScopePillProps {
  tree: WorldUniverseNode[];
  basePath?: string;
}

type NamePromptState = {
  title: string;
  onSubmit: (name: string) => void;
};

export default function ScopePill({ tree, basePath = "/wiki" }: ScopePillProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [namePrompt, setNamePrompt] = useState<NamePromptState | null>(null);

  const rootRef = useRef<HTMLDivElement>(null);

  const { universeId: activeUniverseId, worldId: activeWorldId } = resolveActiveScope(tree, {
    u: searchParams.get("u") ?? undefined,
    w: searchParams.get("w") ?? undefined,
  });

  const items = flattenSwitcher(tree, activeUniverseId, activeWorldId);
  const crumb = breadcrumbLabel(tree, activeUniverseId, activeWorldId);

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

  const go = (u: string, w?: string) => {
    setOpen(false);
    startTransition(() => router.push(scopedHref(basePath, { universeId: u, worldId: w })));
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
          () => editWorldStructure({ op: "create", level: "universe", name }),
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
          () =>
            editWorldStructure({
              op: "create",
              level: "world",
              name,
              universeId: activeUniverseId,
            }),
          ({ worldId }) =>
            startTransition(() => {
              router.push(scopedHref(basePath, { universeId: activeUniverseId, worldId }));
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
            <span className={pill.wordmark}>STORYLINT</span>
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
