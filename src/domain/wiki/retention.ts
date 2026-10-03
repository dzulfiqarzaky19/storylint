export const RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

export function isPurgeable(
  deletedAt: number | null,
  nowMs: number,
  retentionMs: number = RETENTION_MS,
): boolean {
  if (deletedAt == null) return false;
  return nowMs - deletedAt >= retentionMs;
}
