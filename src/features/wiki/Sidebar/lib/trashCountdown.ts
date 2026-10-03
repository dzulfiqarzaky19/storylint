import { isPurgeable, RETENTION_MS } from "@/domain/wiki/retention";

export interface TrashCountdown {
  purgeable: boolean;
  daysLeft: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function trashCountdown(deletedAt: number, nowMs: number): TrashCountdown {
  const purgeable = isPurgeable(deletedAt, nowMs);
  const remainingMs = deletedAt + RETENTION_MS - nowMs;
  const daysLeft = Math.max(0, Math.ceil(remainingMs / DAY_MS));
  return { purgeable, daysLeft };
}
