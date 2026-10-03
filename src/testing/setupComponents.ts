import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Unmount whatever a test rendered, so one test's DOM never leaks into the next.
afterEach(cleanup);

// jsdom ships <dialog> without its methods. These stand-ins cover what the app
// relies on: the `open` state, and the `close` event.
HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
  this.setAttribute('open', '');
};
HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
  if (!this.hasAttribute('open')) return;
  this.removeAttribute('open');
  this.dispatchEvent(new Event('close'));
};
