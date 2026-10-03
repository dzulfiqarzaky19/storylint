declare const wikiWriteBrand: unique symbol;

export interface WikiWriteConfirmation {
  readonly [wikiWriteBrand]: true;
}

export function confirmWikiWrite(input: { confirmed: true }): WikiWriteConfirmation {
  if (input.confirmed !== true) {
    throw new Error("confirmWikiWrite: explicit confirmation required (product rule 1).");
  }
  return {} as WikiWriteConfirmation;
}

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export function fail(err: unknown, where: string): { ok: false; error: string } {
  return { ok: false, error: `${where}: ${errorMessage(err)}` };
}

export async function runAction<T>(
  where: string,
  fn: () => Promise<ActionResult<T>>,
): Promise<ActionResult<T>> {
  try {
    return await fn();
  } catch (err) {
    return fail(err, where);
  }
}

export async function runActionBare<T>(
  fn: () => Promise<ActionResult<T>>,
): Promise<ActionResult<T>> {
  try {
    return await fn();
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

export function requireWorldId(
  worldId: string | undefined,
  where: string,
  suffix: string = " - refusing to create a world-orphan entry",
): { ok: true; worldId: string } | { ok: false; error: string } {
  const trimmed = worldId?.trim();
  if (!trimmed) {
    return { ok: false, error: `${where}: missing worldId${suffix}` };
  }
  return { ok: true, worldId: trimmed };
}
