"use client";

import { useEffect, useRef, useState } from "react";
import type { PlotEdit } from "./usePlotEdit";
import styles from "./PlotScreen.module.css";

/** The "+ new plotline" affordance (feature 4, create). Collapsed to a button;
 *  clicking reveals a one-field inline form. Empty/blank name is rejected by the
 *  action, so the button just needs a non-empty submit. */
export function NewPlotlineButton({ edit }: { edit: PlotEdit }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  if (!open) {
    return (
      <button
        type="button"
        className={styles.newLane}
        onClick={() => setOpen(true)}
        disabled={edit.pending}
      >
        + new plotline
      </button>
    );
  }
  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    edit.createLane(trimmed);
    setName("");
    setOpen(false);
  };
  return (
    <form
      className={styles.newLaneForm}
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <input
        ref={inputRef}
        className={styles.newLaneInput}
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setOpen(false);
            setName("");
          }
        }}
        placeholder="Plotline name"
        aria-label="New plotline name"
      />
      <button type="submit" className={styles.newLaneSave} disabled={edit.pending || !name.trim()}>
        add
      </button>
      <button
        type="button"
        className={styles.newLaneCancel}
        onClick={() => {
          setOpen(false);
          setName("");
        }}
      >
        cancel
      </button>
    </form>
  );
}
