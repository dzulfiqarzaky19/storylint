import styles from "./ResearchScreen.module.css";

/**
 * The question the writer is turning over. Kicker + 46px/800 question + 2px rule.
 * README §Screen 2.1.
 */
export default function QuestionBlock({ question }: { question: string }) {
  return (
    <section className={styles.questionBlock}>
      <div className={styles.kicker}>You</div>
      <h1 className={styles.question}>{question}</h1>
      <div className={styles.majorRule} />
    </section>
  );
}
