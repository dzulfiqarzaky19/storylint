import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ConfirmModal from "@/components/ui/ConfirmModal";

// Migrated from the e2e spec `b4ConfirmDoubleSubmit.spec.ts` (TCK-HF2W-B4). The
// double-submit LATCH is the behavior under test, and it lives entirely in
// ConfirmModal (createOneShot). The old e2e drove the whole /wiki/manage delete
// against a live server + DB just to click the confirm twice; that browser round
// trip proved nothing the component can't prove in isolation. The pure latch is
// already covered by oneShot.test.ts; here we prove ConfirmModal WIRES it — two
// clicks in the same tick fire onConfirm exactly once and the button disables.

describe("ConfirmModal double-submit guard (wiring)", () => {
  const base = {
    title: "Delete Doomed?",
    confirmLabel: "Delete 3 rows",
    danger: true,
    onCancel: () => {},
  };

  it("fires onConfirm exactly ONCE for two synchronous clicks", () => {
    const onConfirm = vi.fn();
    render(<ConfirmModal {...base} onConfirm={onConfirm} />);
    const confirm = screen.getByRole("button", { name: "Delete 3 rows" });

    // Two native clicks in the SAME tick — the true double-fire window the latch
    // guards (React's disabled state is batched and not yet applied between them).
    confirm.click();
    confirm.click();

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("disables the confirm button after the first fire", () => {
    render(<ConfirmModal {...base} onConfirm={() => {}} />);
    const confirm = screen.getByRole("button", { name: "Delete 3 rows" });
    fireEvent.click(confirm);
    expect(confirm).toBeDisabled();
    expect(confirm).toHaveAttribute("aria-disabled", "true");
  });

  it("holds the confirm behind the type-the-name gate until the exact name is typed", async () => {
    const { default: userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <ConfirmModal
        {...base}
        onConfirm={onConfirm}
        requireTypeToConfirm="Doomed"
      />,
    );
    const confirm = screen.getByRole("button", { name: "Delete 3 rows" });

    // Armed only after the exact name is typed.
    expect(confirm).toBeDisabled();
    confirm.click();
    expect(onConfirm).not.toHaveBeenCalled();

    await user.type(
      screen.getByRole("textbox", { name: "Type Doomed to confirm" }),
      "Doomed",
    );
    expect(confirm).toBeEnabled();
    confirm.click();
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
