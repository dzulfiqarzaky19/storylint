/**
 * F8-S1 — pure Tiptap-doc → Markdown serializer.
 *
 * `tiptapDocToMarkdown(doc)` walks a Tiptap v3 / ProseMirror document JSON and
 * returns a Markdown string. It is pure: no I/O, no throw. Malformed input
 * (null, non-object, missing content) serializes to "".
 *
 * Node coverage (StarterKit): paragraph, heading, bulletList, orderedList,
 * listItem, blockquote, codeBlock, horizontalRule, hardBreak. Mark coverage:
 * bold `**`, italic `*`, code `` ` ``, strike `~~`. Unknown node types recurse
 * into their children (never throw); unknown marks pass through as plain text.
 *
 * Kept dependency-free so it stays trivially unit-testable and reusable by the
 * chapter/novel assemblers (F8-S2) and the export route (F8-S3).
 */

// --- Minimal structural view of a ProseMirror node (we read defensively). ---
interface PmMark {
  type?: string;
}
interface PmNode {
  type?: string;
  text?: string;
  content?: PmNode[];
  marks?: PmMark[];
  attrs?: { level?: number } & Record<string, unknown>;
}

function isNode(value: unknown): value is PmNode {
  return typeof value === 'object' && value !== null;
}

/** Wrap a text run's content in its marks, applied in declared order. */
function applyMarks(text: string, marks: PmMark[] | undefined): string {
  if (!Array.isArray(marks)) return text;
  let out = text;
  for (const mark of marks) {
    switch (mark?.type) {
      case 'bold':
        out = `**${out}**`;
        break;
      case 'italic':
        out = `*${out}*`;
        break;
      case 'code':
        out = `\`${out}\``;
        break;
      case 'strike':
        out = `~~${out}~~`;
        break;
      default:
        // Unknown mark: leave the text unchanged.
        break;
    }
  }
  return out;
}

/** Serialize the inline children of a block into a single line of Markdown. */
function serializeInline(children: PmNode[] | undefined): string {
  if (!Array.isArray(children)) return '';
  let out = '';
  for (const child of children) {
    if (!isNode(child)) continue;
    if (child.type === 'text') {
      out += applyMarks(child.text ?? '', child.marks);
    } else if (child.type === 'hardBreak') {
      out += '  \n';
    } else {
      // Unknown inline node: recurse into its own children.
      out += serializeInline(child.content);
    }
  }
  return out;
}

/** Prefix every line of `block` with `prefix` (for blockquote / list items). */
function prefixLines(block: string, prefix: string): string {
  return block
    .split('\n')
    .map((line) => `${prefix}${line}`)
    .join('\n');
}

/** Serialize one block-level node to Markdown, or "" if it produces nothing. */
function serializeBlock(node: PmNode): string {
  switch (node.type) {
    case 'paragraph':
      return serializeInline(node.content);
    case 'heading': {
      const level = node.attrs?.level ?? 1;
      return `${'#'.repeat(level)} ${serializeInline(node.content)}`;
    }
    case 'bulletList':
      return (node.content ?? [])
        .map((item) => prefixLines(serializeBlocks(item.content), '- '))
        .join('\n');
    case 'orderedList':
      return (node.content ?? [])
        .map((item, i) => prefixLines(serializeBlocks(item.content), `${i + 1}. `))
        .join('\n');
    case 'blockquote':
      return prefixLines(serializeBlocks(node.content), '> ');
    case 'codeBlock':
      return `\`\`\`\n${serializeInline(node.content)}\n\`\`\``;
    case 'horizontalRule':
      return '---';
    default:
      // Unknown block (and a stray top-level listItem): recurse into its
      // children so nothing is silently lost. A listItem inside a list is
      // handled inline by the bulletList/orderedList cases above, which read
      // `item.content` directly, so no dedicated listItem case is needed here.
      return serializeBlocks(node.content);
  }
}

/** Serialize a sequence of block nodes, joined by a blank line. */
function serializeBlocks(nodes: PmNode[] | undefined): string {
  if (!Array.isArray(nodes)) return '';
  return nodes
    .filter(isNode)
    .map(serializeBlock)
    .join('\n\n');
}

/**
 * Serialize a Tiptap/ProseMirror `doc` node to a Markdown string. Pure and
 * total: any malformed input yields "".
 */
export function tiptapDocToMarkdown(doc: unknown): string {
  if (!isNode(doc) || !Array.isArray(doc.content)) return '';
  return serializeBlocks(doc.content);
}
