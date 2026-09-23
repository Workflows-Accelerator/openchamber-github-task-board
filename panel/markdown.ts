// ==========================================
// Markdown Renderer & Description Preview
// ==========================================

const LIST_ITEM_REGEX = /^(\s*)(?:([-*])|(\d+)\.)\s+(.*)$/;

function splitTableRow(row: string): string[] {
  let line = row.trim();
  if (line.startsWith('|')) {
    line = line.slice(1);
  }
  if (line.endsWith('|') && !line.endsWith('\\|')) {
    line = line.slice(0, -1);
  }
  const rawCells = line.split(/(?<!\\)\|/);
  return rawCells.map((c) => c.replace(/\\\|/g, '|').trim());
}

function isTableSeparator(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed.includes('-') || !trimmed.includes('|')) return false;
  const cells = splitTableRow(trimmed);
  if (cells.length === 0) return false;
  return cells.every((cell) => /^:?-{1,}:?$/.test(cell));
}

function parseTableAlignment(sepCell: string): string {
  const trimmed = sepCell.trim();
  const left = trimmed.startsWith(':');
  const right = trimmed.endsWith(':');
  if (left && right) return 'center';
  if (right) return 'right';
  if (left) return 'left';
  return '';
}

function applyInlineMarkdown(text: string): string {
  let res = text;
  // Bold & Italic
  res = res.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  res = res.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  // Links
  res = res.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="md-link">$1 ↗</a>');
  return res;
}

function buildTableHtml(headerLine: string, sepLine: string, bodyLines: string[]): string {
  const headerCells = splitTableRow(headerLine);
  const sepCells = splitTableRow(sepLine);
  const colCount = Math.max(headerCells.length, sepCells.length);
  const alignments = sepCells.map(parseTableAlignment);

  const ths: string[] = [];
  for (let c = 0; c < colCount; c++) {
    const rawContent = headerCells[c] || '';
    const content = applyInlineMarkdown(rawContent);
    const align = alignments[c] || '';
    const alignAttr = align ? ` style="text-align: ${align};"` : '';
    ths.push(`<th${alignAttr}>${content}</th>`);
  }
  const thead = `<thead><tr>${ths.join('')}</tr></thead>`;

  let tbody = '';
  if (bodyLines.length > 0) {
    const trs = bodyLines.map((bLine) => {
      let cells = splitTableRow(bLine);
      if (cells.length > colCount) {
        cells = cells.slice(0, colCount);
      }
      const tds: string[] = [];
      for (let c = 0; c < colCount; c++) {
        const rawContent = cells[c] || '';
        const content = applyInlineMarkdown(rawContent);
        const align = alignments[c] || '';
        const alignAttr = align ? ` style="text-align: ${align};"` : '';
        tds.push(`<td${alignAttr}>${content}</td>`);
      }
      return `<tr>${tds.join('')}</tr>`;
    });
    tbody = `<tbody>${trs.join('')}</tbody>`;
  }

  return `<div class="md-table-wrap"><table class="md-table">${thead}${tbody}</table></div>`;
}

function buildListHtml(lines: string[]): string {
  const stack: { type: 'ul' | 'ol'; indent: number }[] = [];
  const out: string[] = [];

  for (const line of lines) {
    const m = line.match(LIST_ITEM_REGEX);
    if (!m) continue;
    const indent = m[1].replace(/\t/g, '  ').length;
    const type: 'ul' | 'ol' = m[2] ? 'ul' : 'ol';
    const rawContent = m[4];

    const taskMatch = rawContent.match(/^\[([ xX])\]\s+(.*)$/);
    let content: string;
    let liClass = 'md-li';
    if (taskMatch) {
      const checked = taskMatch[1].toLowerCase() === 'x';
      const checkbox = `<input type="checkbox" disabled ${checked ? 'checked ' : ''}class="md-task-checkbox"> `;
      content = `${checkbox}${applyInlineMarkdown(taskMatch[2])}`;
      liClass = 'md-li md-task-item';
    } else {
      content = applyInlineMarkdown(rawContent);
    }

    if (stack.length === 0) {
      stack.push({ type, indent });
      out.push(`<${type} class="md-${type}">\n<li class="${liClass}">${content}`);
    } else {
      let top = stack[stack.length - 1];
      if (indent > top.indent) {
        stack.push({ type, indent });
        out.push(`\n<${type} class="md-${type}">\n<li class="${liClass}">${content}`);
      } else if (indent < top.indent) {
        while (stack.length > 1 && indent < stack[stack.length - 1].indent) {
          const popped = stack.pop()!;
          out.push(`</li>\n</${popped.type}>`);
        }
        top = stack[stack.length - 1];
        if (top.type !== type) {
          stack.pop();
          out.push(`</li>\n</${top.type}>\n<${type} class="md-${type}">\n<li class="${liClass}">${content}`);
          stack.push({ type, indent });
        } else {
          out.push(`</li>\n<li class="${liClass}">${content}`);
        }
      } else {
        if (top.type !== type) {
          stack.pop();
          out.push(`</li>\n</${top.type}>\n<${type} class="md-${type}">\n<li class="${liClass}">${content}`);
          stack.push({ type, indent });
        } else {
          out.push(`</li>\n<li class="${liClass}">${content}`);
        }
      }
    }
  }

  while (stack.length > 0) {
    const popped = stack.pop()!;
    out.push(`</li>\n</${popped.type}>`);
  }

  return out.join('');
}

export function renderMarkdown(raw: string): string {
  if (!raw || typeof raw !== 'string') return '<p style="color: var(--fg-muted); font-style: italic;">No description provided.</p>';

  // 1. Critical Security: Escape HTML first
  let html = raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  // 2. Protect fenced code blocks (```lang ... ```)
  const codeBlocks: string[] = [];
  html = html.replace(/```([a-zA-Z0-9_-]*)\r?\n([\s\S]*?)```/g, (_, lang, code) => {
    const placeholder = `%%MD_CODE_BLOCK_${codeBlocks.length}%%`;
    codeBlocks.push(`<pre class="md-code-block"><code class="language-${lang}">${code.trim()}</code></pre>`);
    return `\n\n${placeholder}\n\n`;
  });

  // 3. Protect inline code (`...`)
  const inlineCodes: string[] = [];
  html = html.replace(/`([^`\n]+)`/g, (_, code) => {
    const placeholder = `%%MD_INLINE_CODE_${inlineCodes.length}%%`;
    inlineCodes.push(`<code class="md-inline-code">${code}</code>`);
    return placeholder;
  });

  // 4. Parse block-level elements line by line
  const lines = html.split(/\r?\n/);
  const blocks: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      i++;
      continue;
    }

    // Code block placeholder
    if (trimmed.startsWith('%%MD_CODE_BLOCK_') && trimmed.endsWith('%%')) {
      blocks.push(trimmed);
      i++;
      continue;
    }

    // Headings
    const headingMatch = line.match(/^(#{1,4})\s+(.*)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const hContent = applyInlineMarkdown(headingMatch[2].trim());
      blocks.push(`<h${level} class="md-h${level}">${hContent}</h${level}>`);
      i++;
      continue;
    }

    // Blockquotes
    if (line.match(/^>\s*(.*)$/)) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].match(/^>\s*(.*)$/)) {
        const qm = lines[i].match(/^>\s*(.*)$/);
        quoteLines.push(qm ? qm[1] : '');
        i++;
      }
      const qContent = quoteLines.map((ql) => applyInlineMarkdown(ql.trim())).join('<br/>');
      blocks.push(`<blockquote class="md-quote">${qContent}</blockquote>`);
      continue;
    }

    // GFM Tables: line and line+1 form header + separator
    if (line.includes('|') && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
      const headerLine = line;
      const sepLine = lines[i + 1];
      const bodyLines: string[] = [];
      i += 2;
      while (i < lines.length) {
        const cur = lines[i];
        const curTrimmed = cur.trim();
        if (!curTrimmed) break;
        if (!cur.includes('|')) break;
        if (cur.match(/^#{1,4}\s+/) || cur.startsWith('> ') || cur.startsWith('%%MD_CODE_BLOCK_') || cur.match(LIST_ITEM_REGEX)) break;
        bodyLines.push(cur);
        i++;
      }
      blocks.push(buildTableHtml(headerLine, sepLine, bodyLines));
      continue;
    }

    // Lists (unordered & ordered)
    if (line.match(LIST_ITEM_REGEX)) {
      const listLines: string[] = [];
      while (i < lines.length) {
        const cur = lines[i];
        const curTrimmed = cur.trim();
        if (cur.match(LIST_ITEM_REGEX)) {
          listLines.push(cur);
          i++;
        } else if (!curTrimmed) {
          if (i + 1 < lines.length && lines[i + 1].match(LIST_ITEM_REGEX)) {
            i++;
          } else {
            break;
          }
        } else {
          break;
        }
      }
      blocks.push(buildListHtml(listLines));
      continue;
    }

    // Paragraph
    const paraLines: string[] = [];
    while (i < lines.length) {
      const cur = lines[i];
      const curTrimmed = cur.trim();
      if (!curTrimmed) break;
      if (cur.startsWith('%%MD_CODE_BLOCK_')) break;
      if (cur.match(/^#{1,4}\s+/)) break;
      if (cur.match(/^>\s*/)) break;
      if (cur.match(LIST_ITEM_REGEX)) break;
      if (cur.includes('|') && i + 1 < lines.length && isTableSeparator(lines[i + 1])) break;

      paraLines.push(cur);
      i++;
    }

    if (paraLines.length > 0) {
      const paraContent = paraLines.map((pl) => applyInlineMarkdown(pl.trim())).join('<br/>');
      blocks.push(`<p class="md-p">${paraContent}</p>`);
    }
  }

  let result = blocks.join('\n');

  // 5. Restore inline code and code block placeholders
  result = result.replace(/%%MD_INLINE_CODE_(\d+)%%/g, (_, idx) => inlineCodes[Number(idx)]);
  result = result.replace(/%%MD_CODE_BLOCK_(\d+)%%/g, (_, idx) => codeBlocks[Number(idx)]);

  return result;
}

export function getIssueDescriptionPreview(body: string | null | undefined): string {
  if (!body || typeof body !== 'string') return '';
  const lines = body.split(/\r?\n/);
  const GENERIC_HEADERS = /^(overview|description|context|summary|details|background|goal|problem|about)$/i;
  let fallback = '';
  for (let rawLine of lines) {
    let line = rawLine.trim();
    if (!line) continue;
    if (line.startsWith('```') || line.startsWith('~~~')) continue;
    const isHeading = line.startsWith('#');
    line = line.replace(/^#+\s*/, '');
    line = line.replace(/^>\s*/, '');
    line = line.replace(/^[-*+]\s*\[[ xX]\]\s*/, '');
    line = line.replace(/^[-*+]\s+/, '');
    line = line.replace(/^\d+\.\s+/, '');
    line = line.replace(/(\*\*|__)(.*?)\1/g, '$2');
    line = line.replace(/(\*|_)(.*?)\1/g, '$2');
    line = line.replace(/`([^`]+)`/g, '$1');
    line = line.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
    line = line.replace(/<[^>]*>/g, '');
    line = line.trim();
    if (!line) continue;
    if (isHeading && GENERIC_HEADERS.test(line)) {
      if (!fallback) fallback = line;
      continue;
    }
    return line;
  }
  return fallback;
}
