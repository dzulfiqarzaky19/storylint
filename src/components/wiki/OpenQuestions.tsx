import type { OpenQuestionRow } from "@/lib/domain/types";
import styles from "./OpenQuestions.module.css";

interface OpenQuestionsProps {
  questions: OpenQuestionRow[];
}

// "Still open" — 300px fixed column, accent em-dash at 800 weight. Fallback copy
// for entries with none (HANDOFF §6).
export default function OpenQuestions({ questions }: OpenQuestionsProps) {
  return (
    <div className={styles.column}>
      <div className={styles.heading}>
        <h2 className={styles.title}>Still open</h2>
      </div>
      {questions.length === 0 ? (
        <p className={styles.fallback}>Nothing open on this one.</p>
      ) : (
        <ul className={styles.list}>
          {questions.map((q) => (
            <li key={q.id} className={styles.row}>
              <span className={styles.dash} aria-hidden="true">
                —
              </span>
              <span className={styles.text}>{q.text}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
