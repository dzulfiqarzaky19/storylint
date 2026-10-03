"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { shareEntityToWorld, unshareEntityFromWorld } from "@/server/actions/wiki/worldStructure";
import { clientErr } from "@/hooks/useServerAction";
import styles from "./ShareControls.module.css";

export interface ShareWorld {
  id: string;
  title: string;
}

interface ShareControlsProps {
  entryId: string;
  entryName: string;
  activeWorldId: string;
  worlds: ShareWorld[];
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
