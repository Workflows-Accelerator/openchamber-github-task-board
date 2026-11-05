// web/public/markdown.js
// Safe, dependency-free Markdown renderer for ChamberOS Board V2 notes and issues.
// Escapes HTML first to defend against XSS, validates link protocols, supports nested lists,
// task checkboxes, code blocks, and nested emphasis.

const ESCAPE_CHARS = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/[&<>"']/g, (ch) => ESCAPE_CHARS[ch] || ch);
}

// Allowed protocols for links: strictly http, https, mailto (only absolute URLs with these schemes)
const ALLOWED_PROTOCOLS = /^(https?:\/\/|mailto:)/i;

function isSafeUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return false;
  const trimmed = rawUrl.trim();
  // Strip control characters, zero-width chars, and leading/trailing whitespace
  const sanitized = trimmed.replace(/[\x00-\x20\x7f-\x9f\u200b-\u200f\uFEFF]/g, '');
  // Reject protocol-relative URLs (//)
  if (sanitized.startsWith('//')) {
    return false;
  }
  // Reject dangerous protocols
  if (/^(javascript|data|vbscript|file):/i.test(sanitized)) {
    return false;
  }
  return ALLOWED_PROTOCOLS.test(sanitized);
}

let parseNonceSeq = 0;

function parseInlines(text) {
  if (!text) return '';

  const nonce = `\x1aMDX${Date.now()}X${++parseNonceSeq}X`;

  // 1. Code spans: `code`
  // We extract code spans first to avoid parsing markdown syntax inside them.
  const codeSpans = [];
  let processed = text.replace(/`([^`\n]+)`/g, (_m, code) => {
    const idx = codeSpans.length;
    codeSpans.push(`<code>${code}</code>`);
    return `${nonce}C${idx}\x1a`;
  });

  // 2. Links: [text](url)
  // Extract links to placeholders to avoid emphasis replacing _blank with <em>blank
  const links = [];
  processed = processed.replace(/\[([^\]\n]+)\]\(([^)\s]+)(?:\s+"([^"\n]*)")?\)/g, (fullMatch, linkText, url, title) => {
    const cleanUrl = url.trim();
    if (!isSafeUrl(cleanUrl)) {
      // Disallowed/unsafe protocol: render as plain escaped text
      return fullMatch;
    }
    const idx = links.length;
    const parsedLinkText = parseInlines(linkText);
    // renderMarkdown escapes the whole source before inline parsing, so cleanUrl and
    // title are already HTML-escaped; escaping again would turn & into &amp;amp;.
    const safeHref = cleanUrl;
    const titleAttr = title ? ` title="${title}"` : '';
    links.push(`<a href="${safeHref}" target="_blank" rel="noopener noreferrer"${titleAttr}>${parsedLinkText}</a>`);
    return `${nonce}L${idx}\x1a`;
  });

  // 3. Bold & Italic (support nested combinations)
  // Triple: ***text*** or ___text___
  processed = processed.replace(/(\*\*\*|___)(.+?)\1/g, '<strong><em>$2</em></strong>');
  // Double: **text** or __text__
  processed = processed.replace(/(\*\*|__)(.+?)\1/g, '<strong>$2</strong>');
  // Single: *text* or _text_
  processed = processed.replace(/(^|[^\w*])\*([^\s*](?:.*?[^\s*])?)\*(?!\*)/g, '$1<em>$2</em>');
  processed = processed.replace(/(^|[^\w_])_([^\s_](?:.*?[^\s_])?)_(?!_)/g, '$1<em>$2</em>');

  // Restore links
  const linkRestoreRegex = new RegExp(`${nonce}L(\\d+)\x1a`, 'g');
  processed = processed.replace(linkRestoreRegex, (_m, idx) => links[Number(idx)] || '');

  // Restore code spans
  const codeRestoreRegex = new RegExp(`${nonce}C(\\d+)\x1a`, 'g');
  processed = processed.replace(codeRestoreRegex, (_m, idx) => codeSpans[Number(idx)] || '');

  return processed;
}

export function renderMarkdown(source) {
  if (!source || typeof source !== 'string') return '';

  // 1. Clean line endings and escape HTML
  const raw = source.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const escaped = escapeHtml(raw);
  const lines = escaped.split('\n');

  const out = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Fenced Code Block: ``` or ~~~ (supports fences >= 3 characters)
    const fenceMatch = /^[ \t]*(`{3,}|~{3,})([a-zA-Z0-9_-]*)[ \t]*$/.exec(line);
    if (fenceMatch) {
      const fenceMarker = fenceMatch[1];
      const markerChar = fenceMarker[0];
      const markerLen = fenceMarker.length;
      const lang = fenceMatch[2] ? ` class="language-${escapeHtml(fenceMatch[2])}"` : '';
      const codeLines = [];
      i++;
      const closingPattern = new RegExp(`^[ \\t]*${markerChar}{${markerLen},}[ \\t]*$`);
      while (i < lines.length) {
        if (closingPattern.test(lines[i])) {
          i++;
          break;
        }
        codeLines.push(lines[i]);
        i++;
      }
      out.push(`<pre><code${lang}>${codeLines.join('\n')}</code></pre>`);
      continue;
    }

    // Blank line
    if (!line.trim()) {
      i++;
      continue;
    }

    // Headings: # H1 through ###### H6
    const headingMatch = /^[ \t]*(#{1,6})[ \t]+(.*?)[ \t]*#*[ \t]*$/.exec(line);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const content = parseInlines(headingMatch[2].trim());
      out.push(`<h${level}>${content}</h${level}>`);
      i++;
      continue;
    }

    // Horizontal Rule: ---, ***, ___
    if (/^[ \t]*(?:---|\*\*\*|___)[ \t]*$/.test(line)) {
      out.push('<hr>');
      i++;
      continue;
    }

    // Lists (unordered or ordered, with nesting and task list checkboxes)
    const listMatch = /^( *)(-|\*|\d+\.)[ \t]+(.*)$/.exec(line);
    if (listMatch) {
      const listStack = [];
      while (i < lines.length) {
        const itemMatch = /^( *)(-|\*|\d+\.)[ \t]+(.*)$/.exec(lines[i]);
        if (!itemMatch) {
          // If indented continuation line
          if (listStack.length > 0 && /^[ \t]+/.test(lines[i]) && lines[i].trim()) {
            const lastList = listStack[listStack.length - 1];
            if (lastList.lastLi) {
              lastList.lastLiContent += ' ' + lines[i].trim();
            }
            i++;
            continue;
          }
          break;
        }

        const indent = itemMatch[1].length;
        const bullet = itemMatch[2];
        const isOrdered = /^\d+\./.test(bullet);
        const tag = isOrdered ? 'ol' : 'ul';
        const rawContent = itemMatch[3];

        // Adjust stack based on indentation
        while (listStack.length > 0 && indent < listStack[listStack.length - 1].indent) {
          const closed = listStack.pop();
          out.push(`</${closed.tag}></li>`);
        }

        if (listStack.length === 0 || indent > listStack[listStack.length - 1].indent) {
          out.push(`<${tag}>`);
          listStack.push({ indent, tag, lastLi: true, lastLiContent: rawContent });
        } else {
          listStack[listStack.length - 1].lastLi = true;
          listStack[listStack.length - 1].lastLiContent = rawContent;
        }

        // Parse task checkbox: - [ ] or - [x]
        let liClass = '';
        let itemContent = rawContent;
        const taskMatch = /^\[([ xX])\][ \t]+(.*)$/.exec(rawContent);
        if (taskMatch) {
          const checked = taskMatch[1].toLowerCase() === 'x' ? ' checked' : '';
          liClass = ' class="task-list-item"';
          itemContent = `<input type="checkbox" disabled class="task-list-item-checkbox"${checked}> ${taskMatch[2]}`;
        }

        // Lookahead to check if next item is indented (nested child)
        const hasNestedChild = (i + 1 < lines.length) && (function () {
          const nextItem = /^( *)(-|\*|\d+\.)[ \t]+(.*)$/.exec(lines[i + 1]);
          return nextItem && nextItem[1].length > indent;
        })();

        if (hasNestedChild) {
          out.push(`<li${liClass}>${parseInlines(itemContent)}`);
        } else {
          out.push(`<li${liClass}>${parseInlines(itemContent)}</li>`);
        }

        i++;
      }

      while (listStack.length > 0) {
        const closed = listStack.pop();
        out.push(`</${closed.tag}>`);
      }
      continue;
    }

    // Paragraph
    const paraLines = [];
    while (i < lines.length && lines[i].trim()) {
      // If next line starts a heading, list, or fence, stop paragraph
      if (/^[ \t]*(?:#{1,6}[ \t]|(?:---|\*\*\*|___)[ \t]*$|```|~~~|(?:-|\*|\d+\.)[ \t])/.test(lines[i])) {
        break;
      }
      paraLines.push(lines[i].trim());
      i++;
    }
    if (paraLines.length > 0) {
      out.push(`<p>${parseInlines(paraLines.join(' '))}</p>`);
    }
  }

  return out.join('\n');
}

if (typeof window !== 'undefined') {
  window.escapeHtml = escapeHtml;
  window.renderMarkdown = renderMarkdown;
}
