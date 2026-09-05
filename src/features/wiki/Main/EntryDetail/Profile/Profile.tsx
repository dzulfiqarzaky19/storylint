"use client";

import { useState } from "react";
import type { EntryWithDetails } from "@/lib/domain/types";
import { kindLabelOf } from "@/lib/domain/types";
import ConfirmModal from "@/components/ui/ConfirmModal";
import InlineText from "../components/InlineText";
import PortraitPlaceholder from "./PortraitPlaceholder";
import ShareControls, { type ShareWorld } from "./ShareControls";
import styles from "./Profile.module.css";

interface ProfileProps {
  entry: EntryWithDetails;
  sharing: {
    worlds: ShareWorld[];
    activeWorldId: string;
    onError: (message: string) => void;
  };
  onEditEntryField: (
    entryId: string,
    field: "name" | "summary" | "note",
    value: string,
  ) => void;
  onDelete: (id: string) => void;
}

export default function Profile({
  entry,
  sharing,
  onEditEntryField,
  onDelete,
}: ProfileProps) {
  const kindLabel = kindLabelOf(entry.kind);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const activeWorld = sharing.worlds.find((w) => w.id === sharing.activeWorldId);
  const catalogueNo = entry.catalogueNo?.trim();
  const catalogueLine = [
    catalogueNo && catalogueNo !== "—" ? `No. ${catalogueNo}` : null,
    activeWorld ? `${activeWorld.title} world` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <>
      {/* Kicker is a flex CLUSTER (spans + ShareControls' <div>/<label> + a
          button), not prose. It MUST be a <div>: a <div>/<label> inside a <p>
          is invalid HTML, so the browser auto-closes the <p> and the SSR DOM
          diverges from the client React tree -> React #418 hydration mismatch
          on a clean /wiki load. TCK-E04. */}
      <div className={styles.kicker}>
        <span className={styles.kind}>{kindLabel}</span>
        <span className={styles.catalogueNo}>{catalogueLine}</span>
        <ShareControls
          entryId={entry.id}
          entryName={entry.name}
          activeWorldId={sharing.activeWorldId}
          worlds={sharing.worlds}
          onError={sharing.onError}
        />
        <button
          type="button"
          className={styles.deleteEntry}
          onClick={() => setConfirmingDelete(true)}
          aria-label={`Delete ${entry.name}`}
        >
          Delete
        </button>
      </div>
      <div className={styles.head}>
        <div className={styles.headPortrait}>
          <PortraitPlaceholder />
        </div>
        <div className={styles.headMain}>
          <h1 className={styles.name}>
            <InlineText
              value={entry.name}
              ariaLabel="entry name"
              onCommit={(v) => onEditEntryField(entry.id, "name", v)}
            />
          </h1>
          <p className={styles.summary}>
            <InlineText
              value={entry.summary}
              ariaLabel="entry summary"
              multiline
              placeholder="Add a summary"
              onCommit={(v) => onEditEntryField(entry.id, "summary", v)}
            />
          </p>
        </div>
      </div>
      {confirmingDelete ? (
        <ConfirmModal
          title={`Delete ${entry.name}?`}
          body="This removes the entry from the gazetteer. Ties pointing at it will be marked as removed."
          confirmLabel="Delete"
          cancelLabel="Cancel"
          danger
          onConfirm={() => {
            setConfirmingDelete(false);
            onDelete(entry.id);
          }}
          onCancel={() => setConfirmingDelete(false)}
        />
      ) : null}
    </>
  );
}
