import { describe, it, expect } from "vitest";
import { scopeDirective } from "@/lib/research/scopeDirective";

describe("scopeDirective", () => {
  it("for 'chat', says broad / no scope and does NOT constrain", () => {
    const d = scopeDirective("chat");
    expect(d).toContain("broad");
    expect(d).toContain("NO specific wiki scope");
    expect(d).not.toContain("Only answer within");
  });

  it("for a kind scope, constrains and offers to switch (self-police)", () => {
    const d = scopeDirective("character");
    expect(d).toContain("scoped to People");
    expect(d).toContain("(character)");
    expect(d).toContain("Only answer within that scope");
    expect(d).toContain("offer to switch scope");
  });

  it("names each kind's scope label", () => {
    expect(scopeDirective("world")).toContain("scoped to Places");
    expect(scopeDirective("organization")).toContain("scoped to Orders");
    expect(scopeDirective("lore")).toContain("scoped to Lore");
  });
});
