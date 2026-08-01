#!/usr/bin/env node
// Guards the retired fact-check lane (docs/AGENT_PIPELINE.md § No fact-check lane).
//
// Why a test and not a paragraph: the thing being retired IS "a paragraph asserting a
// fact about the repo". A rule against stale doc-snapshots that is itself only a doc
// would rot the same way. This runs.
//
// It refuses two shapes:
//   1. A doc that pins itself to a tree AND claims to audit other docs (a fact-check).
//   2. Reintroduction of the retired files by name.
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const git = (...a) => execFileSync('git', a, { encoding: 'utf8', maxBuffer: 1e8 });
const tracked = git('ls-files').trim().split('\n');

const RETIRED = [
  'docs/decisions/density-pass-settled-positions-factcheck.md',
  'docs/decisions/doc-vs-code-corpus-factcheck.md',
  'docs/decisions/density-pass-settled-positions-adversarial.md',
];

test('retired fact-check documents are not reintroduced', () => {
  const back = RETIRED.filter((f) => tracked.includes(f));
  assert.deepEqual(
    back,
    [],
    `Retired fact-check docs are back: ${back.join(', ')}.\n` +
      'They pin file:line claims to a tree that moves. Fix docs in place instead.\n' +
      'See docs/AGENT_PIPELINE.md § No fact-check lane.',
  );
});

test('no new doc audits other docs against a pinned tree', () => {
  // A fact-check has both halves: a pinned tree, and a claim to be auditing docs.
  const PINNED = /(?:Tree|Code tree|Against|Target)\s*:?\s*`?(?:origin\/dev|origin\/[\w./-]+)`?\s*@\s*`?[0-9a-f]{7,40}`?/i;
  const AUDITS = /\b(fact[- ]?check|claim matrix|doc-vs-code|VERIFIED\s*\/\s*STALE|code-vs-doc)\b/i;

  const offenders = [];
  for (const f of tracked) {
    if (!f.startsWith('docs/') || !f.endsWith('.md')) continue;
    // The pipeline doc and the decisions index describe the ban; they are allowed to name it.
    if (f === 'docs/AGENT_PIPELINE.md' || f === 'docs/decisions/README.md') continue;
    if (f === 'docs/decisions/STANDING_RULES.md') continue;
    let t;
    try {
      t = readFileSync(f, 'utf8');
    } catch {
      continue;
    }
    if (PINNED.test(t) && AUDITS.test(t)) offenders.push(f);
  }

  assert.deepEqual(
    offenders,
    [],
    `These docs audit other docs against a pinned tree: ${offenders.join(', ')}.\n` +
      'That artifact rots silently: line numbers keep resolving while pointing at new code.\n' +
      'Fix the doc in place, or write an executable check.',
  );
});
