export function matchesDeleteName(typed: string, target: string): boolean {
  const t = target.trim();
  if (t.length === 0) return false;
  return typed.trim() === t;
}
