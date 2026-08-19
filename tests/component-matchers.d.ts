// Registers the jest-dom + vitest-axe matcher type augmentations for tsc, so
// component tests can use toBeInTheDocument / toHaveNoViolations with types.
// The runtime registration lives in tests/setup-component.ts (setupFiles).
/// <reference types="@testing-library/jest-dom" />
import "vitest-axe/extend-expect";
