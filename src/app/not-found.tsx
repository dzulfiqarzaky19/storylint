// TCK-E07: styled 404. Next renders this for an unmatched route or an explicit
// notFound() call. Without it Next serves a plain, unstyled default 404 that has
// none of the Ashkeld chrome. This is a Server Component (no interactivity
// needed) branded to the app tokens, with a link back to the gazetteer.

import Link from "next/link";
import styles from "./not-found.module.css";

export default function NotFound() {
  return (
    <main className={styles.wrap}>
      <div className={styles.panel}>
        <p className={styles.code}>404</p>
        <h1 className={styles.title}>This page is not in the gazetteer.</h1>
        <p className={styles.body}>
          The address you followed does not lead anywhere in Ashkeld.
        </p>
        <Link href="/wiki" className={styles.home}>
          Back to the gazetteer
        </Link>
      </div>
    </main>
  );
}
