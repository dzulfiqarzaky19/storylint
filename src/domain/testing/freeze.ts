// Freezes a value all the way down, so a test fails loudly if code under test
// mutates its input instead of returning a new value. Imported by tests only.
export function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}
