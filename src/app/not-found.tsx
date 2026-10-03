import Link from "next/link";
import styles from "./not-found.module.css";

export default function NotFound() {
  return (
    <main className={styles.wrap}>
      <div className={styles.panel}>
        <p className={styles.code}>404</p>
        <h1 className={styles.title}>This page is not in the gazetteer.</h1>
        <p className={styles.body}>
          The address you followed does not lead anywhere in storylint.
        </p>
        <Link href="/wiki" className={styles.home}>
          Back to the gazetteer
        </Link>
      </div>
    </main>
  );
}
