export function nextFocusIndex(
  count: number,
  current: number,
  shift: boolean,
): number {
  if (count <= 0) return -1;
  if (current < 0) return shift ? count - 1 : 0;
  const step = shift ? count - 1 : 1;
  return (current + step) % count;
}
