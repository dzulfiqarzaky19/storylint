import styles from "./Thread.module.css";

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
