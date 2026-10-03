"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import type { WorldUniverseNode } from "@/domain/structure";
import ScopePill from "./ScopePill";
import BookPill from "./BookPill";
import { scopedHref } from "@/domain/scope/activeScope";
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

export interface HeaderScope {
  tree: WorldUniverseNode[];
  basePath?: string;
}

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
          <span className={styles.wordmark}>STORYLINT</span>
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
