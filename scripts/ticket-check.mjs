#!/usr/bin/env node
/**
 * Storylint ticket priority check.
 * Parses docs/tickets/T-*.md YAML frontmatter; validates; recommends next work.
 *
 * Usage:
 *   node scripts/ticket-check.mjs
 *   node scripts/ticket-check.mjs --agent=name --story=slug
 *   node scripts/ticket-check.mjs --strict
 *   node scripts/ticket-check.mjs --help
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const TICKETS_DIR = process.env.TICKETS_DIR
  ? resolve(process.cwd(), process.env.TICKETS_DIR)
  : join(ROOT, 'docs', 'tickets');

const PRIORITIES = ['P0', 'P1', 'P2', 'P3'];
const STATUSES = [
  'open',
  'assigned',
  'in_progress',
  'in_review',
  'landing',
  'blocked',
  'integrated',
  'done',
  'wontfix',
];
const ACTIVE = new Set(['open', 'assigned', 'in_progress', 'in_review', 'landing', 'blocked']);
const OPENISH = new Set(['open', 'assigned', 'in_progress', 'in_review', 'landing']);
const REQUIRED = [
  'id',
  'title',
  'priority',
  'status',
  'story',
  'owner',
  'branch',
  'origin_dev_at_open',
  'acceptance',
  'shortest_repro',
  'l1_proof',
  'l2_required',
  'blocks',
  'blocked_by',
  'decision',
  'notes',
];

function help() {
  console.log(`ticket-check — validate docs/tickets and recommend next work

Usage:
  node scripts/ticket-check.mjs [--agent=name] [--story=slug] [--strict] [--json]

Exit codes:
  0  ok
  1  schema / priority conflicts
  2  --strict and a P0 is still active

--strict   fail if any P0 is open|assigned|in_progress|in_review|landing|blocked
           (use before L2 / story-close: "can we start composition?")
`);
}

function parseArgs(argv) {
  const out = { agent: null, story: null, strict: false, json: false, help: false };
  for (const a of argv) {
    if (a === '--help' || a === '-h') out.help = true;
    else if (a === '--strict') out.strict = true;
    else if (a === '--json') out.json = true;
    else if (a.startsWith('--agent=')) out.agent = a.slice('--agent='.length).trim() || null;
    else if (a.startsWith('--story=')) out.story = a.slice('--story='.length).trim() || null;
  }
  return out;
}

/** Minimal YAML frontmatter: key: value, key: | blocks, key: [a, b] */
function parseFrontmatter(text, file) {
  if (!text.startsWith('---')) {
    throw new Error(`${file}: missing YAML frontmatter opener`);
  }
  const end = text.indexOf('\n---', 3);
  if (end === -1) throw new Error(`${file}: missing YAML frontmatter closer`);
  const raw = text.slice(3, end).replace(/^\r?\n/, '');
  const lines = raw.split(/\r?\n/);
  const data = {};
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim() || line.trim().startsWith('#')) {
      i++;
      continue;
    }
    const m = line.match(/^([A-Za-z0-9_]+):\s*(.*)$/);
    if (!m) {
      throw new Error(`${file}: cannot parse frontmatter line: ${line}`);
    }
    const key = m[1];
    let val = m[2];
    if (val === '|' || val === '>') {
      const block = [];
      i++;
      while (i < lines.length) {
        const l = lines[i];
        if (l === '' || /^\s/.test(l)) {
          block.push(l.replace(/^\s/, ''));
          i++;
          continue;
        }
        if (/^[A-Za-z0-9_]+:/.test(l)) break;
        block.push(l);
        i++;
      }
      data[key] = block.join('\n').trim();
      continue;
    }
    if (val.startsWith('[') && val.endsWith(']')) {
      const inner = val.slice(1, -1).trim();
      data[key] = inner
        ? inner.split(',').map((s) => s.trim().replace(/^["']|["']$/g, ''))
        : [];
      i++;
      continue;
    }
    data[key] = val.replace(/^["']|["']$/g, '').trim();
    i++;
  }
  return data;
}

function asList(v) {
  if (Array.isArray(v)) return v;
  if (v == null || v === '' || v === '—') return [];
  return String(v)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function normalizeTicket(data, file) {
  const t = { ...data, file };
  t.blocks = asList(t.blocks);
  t.blocked_by = asList(t.blocked_by);
  t.files = asList(t.files);
  t.priority = String(t.priority || '').toUpperCase();
  t.status = String(t.status || '').toLowerCase();
  t.l2_required = String(t.l2_required || '').toLowerCase();
  t.notes = t.notes == null ? '' : String(t.notes);
  t.owner = t.owner == null || t.owner === '' ? 'unassigned' : String(t.owner);
  t.story = t.story == null || t.story === '' ? 'none' : String(t.story);
  return t;
}

function hasOverride(t) {
  return /override\s*:\s*(founder|rat)/i.test(t.notes || '') || /override\s*:\s*(founder|rat)/i.test(t.decision || '');
}

function loadTickets() {
  if (!existsSync(TICKETS_DIR)) {
    throw new Error(`missing ${TICKETS_DIR}`);
  }
  const files = readdirSync(TICKETS_DIR).filter(
    (f) =>
      /^T-\d+\.md$/i.test(f) ||
      /^feature-\d{2,}-ticket-\d{2,}(-fix-\d{2,})?\.md$/i.test(f),
  );
  const tickets = [];
  for (const f of files) {
    const text = readFileSync(join(TICKETS_DIR, f), 'utf8');
    const data = parseFrontmatter(text, f);
    tickets.push(normalizeTicket(data, f));
  }
  return tickets;
}

function validate(tickets) {
  const errors = [];
  const warnings = [];
  const byId = new Map();

  for (const t of tickets) {
    for (const k of REQUIRED) {
      if (t[k] === undefined) errors.push(`${t.file}: missing field ${k}`);
    }
    // Two id families:
    //   T-###                          standalone ticket
    //   feature-NN-ticket-MM[-fix-KK]  feature pipeline (FEATURE_PIPELINE.md)
    const idStr = String(t.id || '');
    const isLegacyId = /^T-\d{3,}$/i.test(idStr);
    const isFeatureId = /^feature-\d{2,}-ticket-\d{2,}(-fix-\d{2,})?$/i.test(idStr);
    if (!isLegacyId && !isFeatureId) {
      errors.push(`${t.file}: invalid id ${t.id} (want T-### or feature-NN-ticket-MM)`);
    } else {
      const id = String(t.id).toUpperCase();
      if (byId.has(id)) errors.push(`duplicate id ${id}: ${byId.get(id)} and ${t.file}`);
      else byId.set(id, t.file);
      const expect = t.file.replace(/\.md$/i, '').toUpperCase();
      if (id !== expect) errors.push(`${t.file}: id ${t.id} does not match filename`);
      // (id is upper-cased above; feature ids compare case-insensitively too)
    }
    if (!PRIORITIES.includes(t.priority)) {
      errors.push(`${t.file}: invalid priority ${t.priority}`);
    }
    if (!STATUSES.includes(t.status)) {
      errors.push(`${t.file}: invalid status ${t.status}`);
    }
    if (t.l2_required !== 'yes' && t.l2_required !== 'no') {
      errors.push(`${t.file}: l2_required must be yes|no (got ${t.l2_required})`);
    }

    // Feature-pipeline consistency. A ticket that claims a feature must belong to
    // it, and must land into it — a ticket pointing at dev would skip the
    // feature's E2E gate, which is the whole reason the branch exists.
    const idLower = String(t.id || '').toLowerCase();
    const featureFromId = idLower.match(/^(feature-\d{2,})-ticket-/);
    if (featureFromId) {
      const feature = featureFromId[1];
      if (t.feature && String(t.feature).toLowerCase() !== feature) {
        errors.push(
          `${t.file}: feature ${t.feature} disagrees with id ${t.id} (expected ${feature})`,
        );
      }
      const branch = String(t.branch || '').trim();
      if (branch && branch !== '—' && branch.toLowerCase() !== idLower) {
        errors.push(
          `${t.file}: branch ${branch} should be the ticket id ${t.id}`,
        );
      }
      const into = String(t.lands_into || '').trim();
      if (into && into.toLowerCase() !== feature) {
        errors.push(
          `${t.file}: lands_into ${into} must be ${feature} — a ticket landing anywhere ` +
            'else skips the feature E2E gate',
        );
      }
      if (String(t.lands_into || '').toLowerCase() === 'dev') {
        errors.push(
          `${t.file}: lands_into dev is invalid for a feature ticket (standing rule 36)`,
        );
      }
    }
  }

  // file conflicts: two in_progress claiming same path
  const fileOwners = new Map();
  for (const t of tickets) {
    if (t.status !== 'in_progress') continue;
    for (const f of t.files) {
      const key = f.replace(/\\/g, '/');
      if (!key || key === '—') continue;
      if (fileOwners.has(key)) {
        errors.push(
          `hard conflict: ${fileOwners.get(key)} and ${t.id} both in_progress on ${key}`,
        );
      } else {
        fileOwners.set(key, t.id);
      }
    }
  }

  const p0Active = tickets.filter((t) => t.priority === 'P0' && ACTIVE.has(t.status));
  const inProgress = tickets.filter((t) => t.status === 'in_progress');

  if (p0Active.length) {
    for (const ip of inProgress) {
      if (ip.priority === 'P0') continue;
      const workingP0 = p0Active.some(
        (p) =>
          p.owner !== 'unassigned' &&
          (p.owner === ip.owner || p.status === 'in_progress'),
      );
      // Fail: lower-priority in_progress while P0 active and this work has no override
      if (!hasOverride(ip) && !workingP0) {
        // Allow if some P0 is in_progress by someone (other agent) — still warn;
        // hard-fail when *this* agent is on non-P0 while any P0 is openish unworked
        const unworkedP0 = p0Active.some(
          (p) => p.status === 'open' || p.status === 'assigned' || (p.status === 'in_progress' && p.owner === 'unassigned'),
        );
        if (unworkedP0 || p0Active.some((p) => OPENISH.has(p.status))) {
          errors.push(
            `${ip.id} is in_progress (${ip.priority}) while P0 active (${p0Active.map((p) => p.id).join(', ')}); add notes override: founder/rat or pick P0`,
          );
        }
      }
    }
  }

  // dangling block refs
  for (const t of tickets) {
    for (const ref of [...t.blocks, ...t.blocked_by]) {
      const id = String(ref).toUpperCase();
      if (!byId.has(id)) warnings.push(`${t.id}: unknown ref ${ref}`);
    }
  }

  return { errors, warnings, p0Active };
}

function priorityRank(p) {
  const i = PRIORITIES.indexOf(p);
  return i === -1 ? 99 : i;
}

function sortOpen(tickets) {
  return tickets
    .filter((t) => OPENISH.has(t.status) || t.status === 'blocked')
    .slice()
    .sort((a, b) => {
      const pr = priorityRank(a.priority) - priorityRank(b.priority);
      if (pr !== 0) return pr;
      return String(a.id).localeCompare(String(b.id));
    });
}

function recommend(tickets, { agent, story }) {
  const pool = sortOpen(tickets).filter((t) => t.status !== 'blocked');
  const p0 = pool.filter((t) => t.priority === 'P0');
  if (p0.length) {
    if (agent) {
      const mine = p0.find((t) => t.owner === agent) || p0.find((t) => t.owner === 'unassigned');
      return mine || p0[0];
    }
    return p0[0];
  }
  if (story) {
    const storyTickets = pool.filter(
      (t) => t.story === story && t.priority === 'P1',
    );
    if (storyTickets.length) {
      if (agent) {
        return (
          storyTickets.find((t) => t.owner === agent) ||
          storyTickets.find((t) => t.owner === 'unassigned') ||
          storyTickets[0]
        );
      }
      return storyTickets[0];
    }
    const anyStory = pool.filter((t) => t.story === story);
    if (anyStory.length) return anyStory[0];
  }
  if (agent) {
    const assigned = pool.find((t) => t.owner === agent);
    if (assigned) return assigned;
  }
  return pool[0] || null;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    help();
    process.exit(0);
  }

  let tickets;
  try {
    tickets = loadTickets();
  } catch (e) {
    console.error(`FAIL: ${e.message}`);
    process.exit(1);
  }

  const { errors, warnings, p0Active } = validate(tickets);
  const open = sortOpen(tickets);
  const next = recommend(tickets, args);

  if (args.json) {
    console.log(
      JSON.stringify(
        {
          tickets: tickets.map((t) => ({
            id: t.id,
            priority: t.priority,
            status: t.status,
            story: t.story,
            owner: t.owner,
            title: t.title,
          })),
          open: open.map((t) => t.id),
          recommended: next ? next.id : null,
          errors,
          warnings,
          p0Active: p0Active.map((t) => t.id),
        },
        null,
        2,
      ),
    );
  } else {
    console.log(`tickets: ${tickets.length} file(s) in docs/tickets/`);
    console.log('');
    console.log('Open / active by priority:');
    if (!open.length) console.log('  (none)');
    for (const t of open) {
      console.log(
        `  ${t.priority} ${t.id} [${t.status}] story=${t.story} owner=${t.owner} — ${t.title}`,
      );
    }
    console.log('');
    if (next) {
      console.log(
        `Recommended next${args.agent ? ` --agent=${args.agent}` : ''}${args.story ? ` --story=${args.story}` : ''}: ${next.id} (${next.priority}) — ${next.title}`,
      );
    } else {
      console.log('Recommended next: (none open)');
    }
    if (warnings.length) {
      console.log('');
      console.log('Warnings:');
      for (const w of warnings) console.log(`  - ${w}`);
    }
    if (errors.length) {
      console.log('');
      console.log('Errors:');
      for (const e of errors) console.log(`  - ${e}`);
    }
    if (args.strict) {
      console.log('');
      if (p0Active.length) {
        console.log(
          `strict: FAIL — P0 still active: ${p0Active.map((t) => t.id).join(', ')}`,
        );
      } else {
        console.log('strict: OK — no active P0');
      }
    }
  }

  if (errors.length) process.exit(1);
  if (args.strict && p0Active.length) process.exit(2);
  process.exit(0);
}

main();
