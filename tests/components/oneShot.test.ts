import { describe, it, expect, vi } from "vitest";
import { createOneShot } from "@/components/ui/oneShot";

// ConfirmModal's double-submit guard (ConfirmModal.tsx) keys off THIS pure
// one-shot. A destructive confirm whose onConfirm is async (e.g. WorldSwitcher's
// world/universe delete: setBusy -> await -> unmount AFTER the await) leaves a
// real window where a fast second click fires onConfirm twice before the modal
// unmounts. The guard must let the FIRST click through and swallow the rest,
// then RE-ARM when the modal opens again (per-open, not per-lifetime), so a
// legitimate later delete on a still-mounted modal is not lost. The repo has no
// DOM test env, so the arming logic is proven here and the wiring is proven by a
// Firefox drive + e2e double-click, same split as nextFocusIndex / focusTrap.
describe("createOneShot", () => {
  it("fires the callback on the FIRST call", () => {
    const shot = createOneShot();
    const cb = vi.fn();
    shot.fire(cb);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("SWALLOWS every subsequent call until reset (double-click fires once)", () => {
    const shot = createOneShot();
    const cb = vi.fn();
    shot.fire(cb);
    shot.fire(cb); // the real double-click
    shot.fire(cb);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("RE-ARMS after reset so a later open fires again (per-open, not per-lifetime)", () => {
    const shot = createOneShot();
    const cb = vi.fn();
    shot.fire(cb); // first open: fires
    shot.fire(cb); // swallowed
    shot.reset(); // modal re-opens
    shot.fire(cb); // second open: fires again
    expect(cb).toHaveBeenCalledTimes(2);
  });

  it("reset before any fire is a harmless no-op (still armed)", () => {
    const shot = createOneShot();
    const cb = vi.fn();
    shot.reset();
    shot.fire(cb);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("reports whether it has already fired (for disabling the button)", () => {
    const shot = createOneShot();
    expect(shot.fired()).toBe(false);
    shot.fire(() => {});
    expect(shot.fired()).toBe(true);
    shot.reset();
    expect(shot.fired()).toBe(false);
  });

  it("does not invoke the callback at all once spent (no side effect leak)", () => {
    const shot = createOneShot();
    const first = vi.fn();
    const second = vi.fn();
    shot.fire(first);
    shot.fire(second); // different cb, still swallowed
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).not.toHaveBeenCalled();
  });
});
