/**
 * Shared notion of "did this identity text change?" for sheets and Lab cards.
 * Trim only — type-space-delete is clean; internal whitespace is significant.
 * Do not fork a second trim rule in Lab or sheet forms; import this.
 */
export function normalizeIdentityText(value: string): string {
  return value.trim()
}
