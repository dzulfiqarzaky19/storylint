"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
];

function activeItem(pathname: string): NavItem {
  const match = NAV.find(
    (item) => pathname === item.href || pathname.startsWith(item.href + "/"),
  );
  return match ?? WIKI;
}

export default function Header() {
  const pathname = usePathname();
  const current = activeItem(pathname);

  return (
    <header className={styles.header}>
      <div className={styles.brand}>
        <span className={styles.wordmark}>ASHKELD</span>
        <span className={styles.descriptor}>{current.descriptor}</span>
      </div>
      <nav className={styles.nav}>
        {NAV.map((item) => {
          const isActive = item.href === current.href;
          return (
            <Link
              key={item.href}
              href={item.href}
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
