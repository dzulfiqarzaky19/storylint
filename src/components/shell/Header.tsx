"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import type { WorldUniverseNode } from "@/lib/db/queries";
import ScopePill from "./ScopePill";
import BookPill from "./BookPill";
import { scopedHref } from "@/lib/scope/activeScope";
import styles from "./Header.module.css";

type NavItem = {
  href: string;
  label: string;
  descriptor: string;
};

const WIKI: NavItem = {
  href: "/wiki",
  label: "wiki",
  descriptor: "a gazetteer in progress",
};

const NAV: NavItem[] = [
  WIKI,
  { href: "/research", label: "research", descriptor: "the workings" },
  { href: "/write", label: "write", descriptor: "chapter seven, in proof" },
  { href: "/plot", label: "plot", descriptor: "the arcs, chapter by chapter" },
];

function activeItem(pathname: string): NavItem {
  const match = NAV.find(
    (item) => pathname === item.href || pathname.startsWith(item.href + "/"),
  );
  return match ?? WIKI;
}

/**
 * Global header. On a scope-bearing surface (wiki), pass `scope={{ tree }}` and
 * the brand becomes the design-3a ScopePill (ASHKELD · world ▾ dropdown). With no
 * scope (research/write/home), it degrades to the static ASHKELD wordmark +
 * descriptor — no scope data required, so those surfaces never crash.
 */
export interface HeaderScope {
  tree: WorldUniverseNode[];
  /**
   * T-RESEARCH-2: the surface the ScopePill navigates on a world switch.
   * Defaults to "/wiki" (the pill's own default) when omitted, so /wiki is
   * unchanged; /research passes "/research" so switching worlds re-scopes
   * /research rather than jumping to /wiki.
   */
  basePath?: string;
}

/**
 * T-SCOPE-2: the /write surface passes `bookScope={{ tree }}` to render the
 * BookPill (ACTIVE WORLD -> ACTIVE BOOK, book dropdown). It takes precedence over
 * `scope` (the world ScopePill) and the static wordmark; a surface passes at most
 * one. Both degrade gracefully to the wordmark when omitted.
 */
export interface HeaderBookScope {
  tree: WorldUniverseNode[];
}

export default function Header({
  scope,
  bookScope,
}: {
  scope?: HeaderScope;
  bookScope?: HeaderBookScope;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const current = activeItem(pathname);
  // Carry the active world across surfaces so switching world on any surface
  // stays active when you navigate to another (the "global scope" intent).
  // scopedHref decides per destination which axes survive the hop, so the book
  // axis is not carried to a surface that cannot use it.
  const navScope = {
    universeId: searchParams.get("u") ?? undefined,
    worldId: searchParams.get("w") ?? undefined,
  };

  return (
    <header className={styles.header}>
      {bookScope ? (
        <BookPill tree={bookScope.tree} />
      ) : scope ? (
        <ScopePill tree={scope.tree} basePath={scope.basePath} />
      ) : (
        <div className={styles.brand}>
          <span className={styles.wordmark}>ASHKELD</span>
          <span className={styles.descriptor}>{current.descriptor}</span>
        </div>
      )}
      <nav className={styles.nav} aria-label="Primary">
        {NAV.map((item) => {
          const isActive = item.href === current.href;
          return (
            <Link
              key={item.href}
              href={scopedHref(item.href, navScope)}
              className={isActive ? styles.navActive : styles.navItem}
              aria-current={isActive ? "page" : undefined}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
