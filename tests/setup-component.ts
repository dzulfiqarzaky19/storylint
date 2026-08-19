// Component-test setup: jest-dom matchers + vitest-axe a11y matcher, plus
// automatic DOM cleanup between tests. Loaded only by the `component` project.
import "@testing-library/jest-dom/vitest";
import "vitest-axe/extend-expect";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(() => {
  cleanup();
});
