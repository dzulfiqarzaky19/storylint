#!/usr/bin/env node
// MANUAL DIAGNOSTIC — report only, deletes nothing.
//
// The question that matters is NOT "is this file mentioned somewhere" — docs cite
// docs in a closed loop, so almost everything looks alive. The question is:
//   does anything OUTSIDE the doc corpus depend on this file?
// i.e. product code, tests, scripts, or the rules index. A doc cited only by
// other docs is a leaf in a graph nobody enters.
//
// SCAR (2026-08-01): the first version of this script asked only "is this file\n// mentioned anywhere?" and reported 8 orphans out of 167 — almost everything looked
// alive, because docs cite docs in a closed loop. A doc referenced only by other dead
// docs scored as live.
//
// SCAR 2: "isolated" is NOT a delete list. Files land with zero inbound citations
// because they are NEW, not because they are dead — today every fresh ticket and
// review shows up here. Deleting on this signal removes the newest work first.
// Treat isolated as "needs an owner or an index entry", never as "safe to remove".
const { execSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const tracked = execSync('git ls-files', { encoding: 'utf8' }).trim().split('\n');

const isArtifact = (f) =>
  f.startsWith('docs/') || f.startsWith('e2e/proofs/') || f.startsWith('e2e/output/');

// "Live" = things that execute or that a human is routed to by name.
const isLive = (f) =>
  f.startsWith('src/') ||
  f.startsWith('scripts/') ||
  (f.startsWith('e2e/') && !f.startsWith('e2e/proofs/') && !f.startsWith('e2e/output/')) ||
  f === 'README.md' ||
  f === 'package.json';

const ENTRY_DOCS = new Set([
  'docs/decisions/STANDING_RULES.md',
  'docs/decisions/README.md',
  'docs/tickets/BACKLOG.md',
  'docs/GIT_WORKFLOW.md',
  'docs/FEATURE_PIPELINE.md',
  'docs/AGENT_PIPELINE.md',
]);

const text = new Map();
for (const f of tracked) {
  try {
    text.set(f, fs.readFileSync(f, 'utf8'));
  } catch {}
}

const artifacts = tracked.filter(isArtifact);
const rows = [];

for (const a of artifacts) {
  const base = path.basename(a);
  const stem = base.replace(/\.[^.]+$/, '');
  const hit = (f) => {
    const t = text.get(f);
    if (!t) return false;
    return t.includes(base) || t.includes(a) || (stem.length > 8 && t.includes(stem));
  };

  const liveRefs = tracked.filter((f) => f !== a && isLive(f) && hit(f));
  const entryRefs = [...ENTRY_DOCS].filter((f) => f !== a && hit(f));
  const docRefs = tracked.filter((f) => f !== a && isArtifact(f) && !ENTRY_DOCS.has(f) && hit(f));

  rows.push({
    file: a,
    live: liveRefs.length,
    entry: entryRefs.length,
    doc: docRefs.length,
    bytes: Buffer.byteLength(text.get(a) ?? ''),
  });
}

const anchored = rows.filter((r) => r.live > 0 || r.entry > 0);
const docOnly = rows.filter((r) => r.live === 0 && r.entry === 0 && r.doc > 0);
const isolated = rows.filter((r) => r.live === 0 && r.entry === 0 && r.doc === 0);

const kb = (rs) => Math.round(rs.reduce((s, r) => s + r.bytes, 0) / 1024);

console.log(`artifacts                       : ${rows.length}  (${kb(rows)} KB)`);
console.log(`  anchored (code or index cites): ${anchored.length}  (${kb(anchored)} KB)  KEEP`);
console.log(`  doc-only (docs cite docs)     : ${docOnly.length}  (${kb(docOnly)} KB)  REVIEW`);
console.log(`  isolated (nothing cites)      : ${isolated.length}  (${kb(isolated)} KB)  CANDIDATE`);

const group = (rs) => {
  const by = {};
  for (const r of rs) (by[path.dirname(r.file)] ||= []).push(r);
  return Object.entries(by).sort((a, b) => b[1].length - a[1].length);
};

console.log('\n-- doc-only, by directory --');
for (const [d, fs_] of group(docOnly)) console.log(`  ${String(fs_.length).padStart(3)}  ${d}`);

console.log('\n-- isolated, by directory --');
for (const [d, fs_] of group(isolated)) console.log(`  ${String(fs_.length).padStart(3)}  ${d}`);

fs.writeFileSync(
  '_cite_scan_report.json',
  JSON.stringify({ anchored, docOnly, isolated }, null, 2),
);
console.log('\nfull report -> _cite_scan_report.json');
