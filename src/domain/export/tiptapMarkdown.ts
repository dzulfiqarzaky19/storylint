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
        break;
    }
  }
  return out;
}

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
      out += serializeInline(child.content);
    }
  }
  return out;
}

function prefixLines(block: string, prefix: string): string {
  return block
    .split('\n')
    .map((line) => `${prefix}${line}`)
    .join('\n');
}

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
      return serializeBlocks(node.content);
  }
}

function serializeBlocks(nodes: PmNode[] | undefined): string {
  if (!Array.isArray(nodes)) return '';
  return nodes
    .filter(isNode)
    .map(serializeBlock)
    .join('\n\n');
}

export function tiptapDocToMarkdown(doc: unknown): string {
  if (!isNode(doc) || !Array.isArray(doc.content)) return '';
  return serializeBlocks(doc.content);
}
