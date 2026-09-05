"use client";

// ShareControls (TCK-023, W-4b: the "share" op UI). Renders on the focused entry:
//   * "Share to …" — a picker of every OTHER world; choosing one LINKS this entry
//     into that world (it then appears in that world's gazetteer, additively).
//   * "Unlink from <active world>" — drops THIS entry's membership link in the
//     ACTIVE world. Non-destructive: the entry row and every other world link
//     survive (orphan = LEAVE), so switching to another world it's still linked to
//     shows it intact.
// Both are structural membership ops (no wiki-write confirmation) and each calls
// its server action; on success the router re-renders so the (revalidated) world
// snapshot reflects the new membership. A failed call surfaces via onError.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { shareEntityToWorld, unshareEntityFromWorld } from "@/lib/actions/wiki";
import { clientErr } from "@/components/hooks/useServerAction";
import styles from "./ShareControls.module.css";

export interface ShareWorld {
  id: string;
  title: string;
}

interface ShareControlsProps {
  entryId: string;
  entryName: string;
  /** The world currently being viewed (unlink target). */
  activeWorldId: string;
  /** Every world across universes — the share-target pool (active one is filtered out). */
  worlds: ShareWorld[];
  /** Surface a failed membership write in the screen's error bar. */
  onError: (message: string) => void;
}

export default function ShareControls({
  entryId,
  entryName,
  activeWorldId,
  worlds,
  onError,
}: ShareControlsProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);

  // Share targets = every world EXCEPT the one being viewed (sharing into the
  // active world would be a no-op link the writer can't observe).
  const targets = worlds.filter((w) => w.id !== activeWorldId);
  const activeWorld = worlds.find((w) => w.id === activeWorldId);

  const run = (
    label: string,
    action: () => Promise<{ ok: true } | { ok: false; error: string }>,
  ) => {
    setBusy(true);
    action()
      .then((res) => {
        if (!res.ok) {
          onError(res.error);
          return;
        }
        // The membership changed server-side; re-render so the world snapshot
        // reflects it (revalidatePath already invalidated the /wiki cache).
        startTransition(() => router.refresh());
      })
      .catch((err: unknown) => {
        onError(`${label}: ${clientErr(err)}`);
      })
      .finally(() => setBusy(false));
  };

  const onShare = (worldId: string) => {
    if (!worldId) return;
    run("shareEntityToWorld", () => shareEntityToWorld({ worldId, entityId: entryId }));
  };

  const onUnlink = () => {
    run("unshareEntityFromWorld", () =>
      unshareEntityFromWorld({ worldId: activeWorldId, entityId: entryId }),
    );
  };

  const disabled = busy || pending;

  return (
    <div className={styles.share} aria-label="World sharing">
      {targets.length > 0 ? (
        <label className={styles.shareLabel}>
          <span className={styles.srOnly}>Share {entryName} to a world</span>
          <select
            aria-label={`Share ${entryName} to a world`}
            className={styles.select}
            value=""
            disabled={disabled}
            onChange={(e) => onShare(e.target.value)}
          >
            <option value="" disabled>
              Share to…
            </option>
            {targets.map((w) => (
              <option key={w.id} value={w.id}>
                {w.title}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <button
        type="button"
        className={styles.unlink}
        disabled={disabled}
        onClick={onUnlink}
        aria-label={`Unlink ${entryName} from ${activeWorld?.title ?? "this world"}`}
      >
        Unlink from {activeWorld?.title ?? "world"}
      </button>
    </div>
  );
}
