import test from 'node:test';
import assert from 'node:assert/strict';

export function renderMarkdown(raw) {
  if (!raw || typeof raw !== 'string') return '<p style="color: var(--fg-muted); font-style: italic;">No description provided.</p>';

  // 1. Escape HTML
  let html = raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  // 2. Code blocks (```lang ... ```)
  html = html.replace(/```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g, (_, lang, code) => {
    return `<pre class="md-code-block"><code class="language-${lang}">${code.trim()}</code></pre>`;
  });

  // 3. Inline code (`...`)
  html = html.replace(/`([^`]+)`/g, '<code class="md-inline-code">$1</code>');

  // 4. Headings (# h1, ## h2, ### h3, #### h4)
  html = html.replace(/^#### (.*$)/gim, '<h4 class="md-h4">$1</h4>');
  html = html.replace(/^### (.*$)/gim, '<h3 class="md-h3">$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2 class="md-h2">$1</h2>');
  html = html.replace(/^# (.*$)/gim, '<h1 class="md-h1">$1</h1>');

  // 5. Blockquotes (> ...)
  html = html.replace(/^\> (.*$)/gim, '<blockquote class="md-quote">$1</blockquote>');

  // 6. Bold & Italic (**bold**, *italic*)
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');

  // 7. Links ([text](url)) - sanitize url to http/https only
  html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="md-link">$1 ↗</a>');

  // 8. Line breaks to paragraphs / brs (avoid double br inside pre)
  const paragraphs = html.split(/\n\n+/);
  html = paragraphs
    .map((p) => {
      const trimmed = p.trim();
      if (!trimmed) return '';
      if (trimmed.startsWith('<h') || trimmed.startsWith('<pre') || trimmed.startsWith('<blockquote')) {
        return trimmed;
      }
      return `<p class="md-p">${trimmed.replace(/\n/g, '<br/>')}</p>`;
    })
    .filter(Boolean)
    .join('\n');

  return html;
}

export function getIssueDescriptionPreview(body) {
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

test('renderMarkdown converts headings, bold, code, and links properly', () => {
  const md = `# Title\n\nThis is **bold** and *italic* with \`inline code\`.\n\n[OpenChamber](https://openchamber.dev)`;
  const rendered = renderMarkdown(md);

  assert.ok(rendered.includes('<h1 class="md-h1">Title</h1>'));
  assert.ok(rendered.includes('<strong>bold</strong>'));
  assert.ok(rendered.includes('<em>italic</em>'));
  assert.ok(rendered.includes('<code class="md-inline-code">inline code</code>'));
  assert.ok(rendered.includes('href="https://openchamber.dev"'));
});

test('renderMarkdown escapes raw script tags to prevent XSS', () => {
  const malicious = `<script>alert("xss")</script>`;
  const rendered = renderMarkdown(malicious);
  assert.ok(!rendered.includes('<script>'));
  assert.ok(rendered.includes('&lt;script&gt;'));
});

test('getIssueDescriptionPreview extracts clean 1-line summary skipping generic headers', () => {
  assert.equal(getIssueDescriptionPreview(''), '');
  assert.equal(getIssueDescriptionPreview(null), '');

  const mdWithHeading = `## Overview\nWe need to fix dropdown clipping on Linux browsers.\nMore details here.`;
  assert.equal(getIssueDescriptionPreview(mdWithHeading), 'We need to fix dropdown clipping on Linux browsers.');

  const mdWithChecklist = `- [ ] Check dropdown rendering\n- [x] Fix line height`;
  assert.equal(getIssueDescriptionPreview(mdWithChecklist), 'Check dropdown rendering');

  const mdWithFormatting = `**Critical:** Please check [docs](https://example.com) for \`api\` details.`;
  assert.equal(getIssueDescriptionPreview(mdWithFormatting), 'Critical: Please check docs for api details.');

  const mdHeadingOnly = `### Standalone feature requirement`;
  assert.equal(getIssueDescriptionPreview(mdHeadingOnly), 'Standalone feature requirement');
});
