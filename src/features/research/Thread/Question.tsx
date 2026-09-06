import styles from "./Thread.module.css";

/**
 * The thread head — the question the writer is turning over, over a mono meta
 * line ("8 TURNS · ASHKELD WORLD"). Fixed above the scrolling chat, so a long
 * thread never pushes the question out of view.
 */
export default function Question({
  question,
  turnCount,
  worldName,
}: {
  question: string;
  turnCount: number;
  worldName?: string;
}) {
  const meta = [
    `${turnCount} ${turnCount === 1 ? "turn" : "turns"}`,
    worldName ? `${worldName} world` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <section className={styles.questionBlock}>
      <h1 className={styles.question}>{question}</h1>
      <div className={styles.questionMeta}>{meta}</div>
    </section>
  );
}
