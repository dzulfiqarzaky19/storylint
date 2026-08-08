// Track A — Product Rule 1 proof for the NEW manual-authoring mutations.
//
// "Nothing enters the wiki without an explicit confirmation." The invariant is
// enforced in the TYPE SYSTEM: every wiki-writing DB helper demands a
// `WikiWriteConfirmation`, a branded token that ONLY `confirmWikiWrite({confirmed:true})`
// can mint. This test proves, at the type level, that the new helpers
// `updateEntryFields` / `updateFact` keep that gate — a call without a token, or
// with a plain object, does not type-check.
//
// We assert this with compile-time `@ts-expect-error` markers (the file is type
// checked by `npm run typecheck`) plus a runtime check that the gate itself
// rejects a forged `confirmed`.

import { describe, it, expect } from "vitest";
import { confirmWikiWrite } from "@/lib/actions/confirmation";
import { updateEntryFields, updateFact } from "@/lib/db/mutations";

describe("Product Rule 1 — new manual-authoring helpers are confirmation-gated", () => {
  it("confirmWikiWrite throws if confirmed is not literally true (defence in depth)", () => {
    // The type signature already blocks this at compile time; this guards
    // erased/JS callers.
    expect(() =>
      // @ts-expect-error confirmed must be the literal true
      confirmWikiWrite({ confirmed: false }),
    ).toThrow(/product rule 1/i);
  });

  it("the gated helpers require a WikiWriteConfirmation token at the type level", () => {
    // These are TYPE assertions, not executed against a DB. Referencing the
    // functions keeps them in the type graph; the @ts-expect-error lines fail
    // `npm run typecheck` if the token parameter is ever dropped.
    const _typeChecks = () => {
      // @ts-expect-error updateEntryFields must receive a confirmation token
      updateEntryFields({ id: "e1", summary: "x" });
      // @ts-expect-error a plain object is not a WikiWriteConfirmation
      updateEntryFields({ id: "e1", summary: "x" }, {});
      // @ts-expect-error updateFact must receive a confirmation token
      updateFact({ id: "f1", value: "x" });
      // A minted token type-checks (not executed — no DB).
      void updateEntryFields({ id: "e1", summary: "x" }, confirmWikiWrite({ confirmed: true }));
      void updateFact({ id: "f1", value: "x" }, confirmWikiWrite({ confirmed: true }));
    };
    expect(typeof _typeChecks).toBe("function");
    expect(typeof updateEntryFields).toBe("function");
    expect(typeof updateFact).toBe("function");
  });
});
