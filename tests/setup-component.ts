// Component-test setup: jest-dom matchers + vitest-axe a11y matcher, plus
// automatic DOM cleanup between tests. Loaded only by the `component` project.
import "@testing-library/jest-dom/vitest";
import "vitest-axe/extend-expect";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// jsdom (as of v30) does not implement the native <dialog> methods showModal()/
// close(), so any component built on <dialog> (Modal, and thus ConfirmModal)
// throws on render. Polyfill the minimal behavior our components rely on: toggle
// the `open` attribute and fire the `cancel`/`close` events. This is test-env
// plumbing only — real browsers provide these natively.
if (typeof HTMLDialogElement !== "undefined") {
  const proto = HTMLDialogElement.prototype;
  if (!proto.showModal) {
    proto.showModal = function showModal(this: HTMLDialogElement) {
      this.open = true;
    };
  }
  if (!proto.show) {
    proto.show = function show(this: HTMLDialogElement) {
      this.open = true;
    };
  }
  if (!proto.close) {
    proto.close = function close(this: HTMLDialogElement, returnValue?: string) {
      this.open = false;
      if (returnValue !== undefined) this.returnValue = returnValue;
      this.dispatchEvent(new Event("close"));
    };
  }
}

afterEach(() => {
  cleanup();
});
