"use client";

import type { FactRow, OpenQuestionRow } from "@/lib/domain/types";
import Facts from "./Facts";
import OpenQuestions from "./OpenQuestions";
import styles from "./Details.module.css";

interface DetailsProps {
  entryId: string;
  facts: FactRow[];
  openQuestions: OpenQuestionRow[];
  onDropSuggestion: (suggestionKey: string) => void;
  onEditFactField: (
    entryId: string,
    factId: string,
    field: "key" | "value",
    value: string,
  ) => void;
  onAddFact: (entryId: string) => void;
  onDeleteFact: (entryId: string, factId: string) => void;
  ai?: {
    suggestions: { key: string; value: string }[];
    busy: boolean;
    onSuggest: () => void;
    onAdd: (key: string, value: string) => void;
    onDismiss: (key: string) => void;
  };
}

// Details tab — wraps the existing DetailsColumn + OpenQuestions components
// verbatim, side by side (T-WIKI-COCKPIT-1: tab-pane wrapper only).
export default function Details({
  entryId,
  facts,
  openQuestions,
  onDropSuggestion,
  onEditFactField,
  onAddFact,
  onDeleteFact,
  ai,
}: DetailsProps) {
  return (
    <div className={styles.row}>
      <Facts
        entryId={entryId}
        facts={facts}
        onDropSuggestion={onDropSuggestion}
        onEditFactField={onEditFactField}
        onAddFact={onAddFact}
        onDeleteFact={onDeleteFact}
        ai={ai}
      />
      <OpenQuestions questions={openQuestions} />
    </div>
  );
}
