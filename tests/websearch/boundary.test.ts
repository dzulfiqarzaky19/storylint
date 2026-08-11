import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

// M10 — the PORTABILITY BOUNDARY invariant.
//
// The web-search engine under src/lib/websearch/ must stay portable: it may
// import ONLY node builtins, its allowed third-party deps (undici, linkedom,
// defuddle), and its OWN siblings (@/lib/websearch/*). It must NEVER reach into
// storylint's app modules (@/lib/domain, @/lib/db, @/lib/research, @/lib/ai),
// or the engine could not be lifted into another project. This test scans every
// engine source file and fails on any forbidden import — the mechanical guard
// that keeps the boundary from eroding as the engine grows.

const ENGINE_DIR = join(process.cwd(), "src", "lib", "websearch");

// App modules the engine must never import (as @/lib/... or relative reach-out).
const FORBIDDEN = [
  "@/lib/domain",
  "@/lib/db",
  "@/lib/research",
  "@/lib/ai",
];

function collectTsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      out.push(...collectTsFiles(full));
    } else if (name.endsWith(".ts") && !name.endsWith(".test.ts")) {
      out.push(full);
    }
  }
  return out;
}

describe("websearch engine portability boundary", () => {
  const files = collectTsFiles(ENGINE_DIR);

  it("finds the engine source files to scan", () => {
    // Guard against a silent pass if the glob ever matches nothing.
    expect(files.length).toBeGreaterThan(5);
  });

  it("no engine file imports a storylint app module", () => {
    const violations: string[] = [];
    for (const file of files) {
      const src = readFileSync(file, "utf8");
      for (const forbidden of FORBIDDEN) {
        // Match an actual import/from of the forbidden module (in quotes),
        // never a mention in a comment/string like "@/lib/domain types".
        const pattern = new RegExp(`from\\s+["']${forbidden.replace(/[/@]/g, "\\$&")}`);
        if (pattern.test(src)) {
          violations.push(`${file} imports ${forbidden}`);
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it("every engine import is a node builtin, an allowed dep, or an engine sibling", () => {
    const ALLOWED_BARE = new Set(["undici", "linkedom", "defuddle", "defuddle/node"]);
    const violations: string[] = [];
    const importRe = /from\s+["']([^"']+)["']/g;
    for (const file of files) {
      const src = readFileSync(file, "utf8");
      let m: RegExpExecArray | null;
      while ((m = importRe.exec(src)) !== null) {
        const spec = m[1] ?? "";
        const ok =
          spec.startsWith("node:") ||
          spec.startsWith("@/lib/websearch/") ||
          spec.startsWith("./") ||
          spec.startsWith("../") ||
          ALLOWED_BARE.has(spec);
        if (!ok) violations.push(`${file}: ${spec}`);
      }
    }
    expect(violations).toEqual([]);
  });
});
