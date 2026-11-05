import test from 'node:test';
import assert from 'node:assert/strict';
import { renderMarkdown, escapeHtml } from '../public/markdown.js';

test('escapeHtml escapes dangerous HTML characters', () => {
  assert.equal(escapeHtml('<script>alert("xss")</script>'), '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
  assert.equal(escapeHtml("Tom & Jerry's"), 'Tom &amp; Jerry&#39;s');
  assert.equal(escapeHtml(null), '');
  assert.equal(escapeHtml(undefined), '');
});

test('XSS payloads are strictly neutralized by renderMarkdown', () => {
  const payloads = [
    '<script>alert(1)</script>',
    '<img src=x onerror="alert(1)">',
    '<svg/onload=alert(1)>',
    '<iframe src="javascript:alert(1)"></iframe>',
    '<a href="javascript:alert(1)">click</a>',
    '"><script>alert(1)</script>',
    '<body onload=alert(1)>',
  ];

  for (const payload of payloads) {
    const rendered = renderMarkdown(payload);
    assert.doesNotMatch(rendered, /<script/i, `Payload must not produce <script>: ${payload}`);
    assert.doesNotMatch(rendered, /<img[^>]*onerror/i, `Payload must not produce unescaped img onerror: ${payload}`);
    assert.doesNotMatch(rendered, /<svg/i, `Payload must not produce unescaped svg: ${payload}`);
    assert.doesNotMatch(rendered, /<iframe/i, `Payload must not produce iframe: ${payload}`);
    assert.doesNotMatch(rendered, /href=["']javascript:/i, `Payload must not produce javascript: href: ${payload}`);
  }
});

test('Links with unsafe protocols are rejected (javascript:, data:, vbscript:)', () => {
  const badLinks = [
    '[xss](javascript:alert(1))',
    '[xss](JAVASCRIPT:alert(1))',
    '[xss](javascript :alert(1))',
    '[xss](data:text/html,<script>alert(1)</script>)',
    '[xss](vbscript:msgbox(1))',
    '[xss](file:///etc/passwd)',
  ];

  for (const bad of badLinks) {
    const rendered = renderMarkdown(bad);
    assert.doesNotMatch(rendered, /<a\s+href=["'](javascript|data|vbscript|file):/i);
  }
});

test('Safe links (https, http, mailto) open in new tab with rel=noopener', () => {
  const rendered = renderMarkdown('[Workflows](https://workflows.ac) and [Contact](mailto:info@workflows.ac)');
  assert.match(rendered, /<a href="https:\/\/workflows\.ac" target="_blank" rel="noopener noreferrer">Workflows<\/a>/);
  assert.match(rendered, /<a href="mailto:info@workflows\.ac" target="_blank" rel="noopener noreferrer">Contact<\/a>/);
});

test('Headings H1-H6 render properly', () => {
  assert.equal(renderMarkdown('# Heading 1'), '<h1>Heading 1</h1>');
  assert.equal(renderMarkdown('## Heading 2'), '<h2>Heading 2</h2>');
  assert.equal(renderMarkdown('### Heading 3 with **bold**'), '<h3>Heading 3 with <strong>bold</strong></h3>');
  assert.equal(renderMarkdown('###### Heading 6'), '<h6>Heading 6</h6>');
});

test('Emphasis: bold, italic, and nested combinations', () => {
  assert.match(renderMarkdown('This is **bold** text'), /<strong>bold<\/strong>/);
  assert.match(renderMarkdown('This is *italic* text'), /<em>italic<\/em>/);
  assert.match(renderMarkdown('This is ***bold and italic*** text'), /<strong><em>bold and italic<\/em><\/strong>/);
  assert.match(renderMarkdown('**Bold with *italic* inside**'), /<strong>Bold with <em>italic<\/em> inside<\/strong>/);
});

test('Inline code and fenced code blocks with language tag', () => {
  const inline = renderMarkdown('Run `npm test` now');
  assert.match(inline, /<code>npm test<\/code>/);

  const block = renderMarkdown('```javascript\nconst a = 1 < 2;\nconsole.log(a);\n```');
  assert.match(block, /<pre><code class="language-javascript">const a = 1 &lt; 2;\nconsole\.log\(a\);<\/code><\/pre>/);
});

test('Unordered lists, ordered lists, and nested lists', () => {
  const listMd = `- Item 1\n  - Subitem 1a\n  - Subitem 1b\n- Item 2`;
  const rendered = renderMarkdown(listMd);
  assert.match(rendered, /<ul>/);
  assert.match(rendered, /<li>Item 1/);
  assert.match(rendered, /<li>Subitem 1a<\/li>/);
  assert.match(rendered, /<li>Item 2<\/li>/);

  const orderedMd = `1. First\n2. Second`;
  const renderedOrdered = renderMarkdown(orderedMd);
  assert.match(renderedOrdered, /<ol>/);
  assert.match(renderedOrdered, /<li>First<\/li>/);
  assert.match(renderedOrdered, /<li>Second<\/li>/);
});

test('Task list checkboxes render display-only inputs', () => {
  const tasks = `- [ ] Open task\n- [x] Completed task\n- [X] Also completed`;
  const rendered = renderMarkdown(tasks);
  assert.match(rendered, /<input type="checkbox" disabled class="task-list-item-checkbox">\s*Open task/);
  assert.match(rendered, /<input type="checkbox" disabled class="task-list-item-checkbox" checked>\s*Completed task/);
  assert.match(rendered, /<input type="checkbox" disabled class="task-list-item-checkbox" checked>\s*Also completed/);
});

test('Large 4,000-character note payload executes cleanly without backtracking or delay', () => {
  let noteText = '# Architecture Note\n\nThis is a long canvas note for design discussion.\n\n';
  for (let i = 0; i < 60; i++) {
    noteText += `- [${i % 2 === 0 ? 'x' : ' '}] Check item #${i}: Review module parameter ${i} for https://example.com/api/${i}\n`;
  }
  noteText += '\n```bash\nnpm run test:heavy\n```\n';
  // Ensure length is >= 4000
  while (noteText.length < 4000) {
    noteText += 'Detailed notes on scaling and performance verification for Step A4.\n';
  }

  const start = performance.now();
  const rendered = renderMarkdown(noteText);
  const elapsed = performance.now() - start;

  assert.ok(elapsed < 30, `Parsing 4000-char note must complete in <30ms (actual: ${elapsed.toFixed(2)}ms)`);
  assert.ok(rendered.length > 0);
  assert.match(rendered, /<h1>Architecture Note<\/h1>/);
  assert.match(rendered, /<pre><code class="language-bash">/);
});

test('hostile markdown: strictly rejects /, #, and protocol-relative // URLs matching contract', () => {
  const relativeSlash = renderMarkdown('[Local page](/settings)');
  assert.ok(!relativeSlash.includes('<a href="/settings"'), 'Relative / link must not render as anchor tag');

  const hashLink = renderMarkdown('[Section](#heading)');
  assert.ok(!hashLink.includes('<a href="#heading"'), 'Anchor # link must not render as anchor tag');

  const protoRelative = renderMarkdown('[Evil](//evil.com/hack)');
  assert.ok(!protoRelative.includes('<a href="//evil.com/hack"'), 'Protocol-relative // link must not render as anchor tag');

  const dangerousWhitespace = renderMarkdown('[XSS]( jav&#x09;ascript:alert(1) )');
  assert.ok(!dangerousWhitespace.includes('<a href'), 'Obfuscated javascript: link must not render as anchor tag');
});

test('hostile markdown: attribute breakout in URLs is neutralized', () => {
  const payload = '[Payload](https://example.com/"onmouseover="alert(1))';
  const html = renderMarkdown(payload);
  assert.doesNotMatch(html, /<a\s+[^>]*\s+onmouseover\s*=/, 'Attribute breakout must not create onmouseover attribute on tag');
  assert.match(html, /href="https:\/\/example\.com\/&quot;onmouseover=&quot;alert\(1"/);
  assert.ok(!html.includes('&amp;quot;'), 'URL must be escaped exactly once');
});

test('hostile markdown: ampersands and quotes in URLs are escaped exactly once', () => {
  const html = renderMarkdown('[q](https://example.com/?a=1&b="2"&c=\'3\')');
  assert.match(html, /<a href="https:\/\/example\.com\/\?a=1&amp;b=&quot;2&quot;&amp;c=&#39;3&#39;" target="_blank" rel="noopener noreferrer">q<\/a>/);
  assert.ok(!html.includes('&amp;amp;'), 'Ampersand must not be double-escaped');
  assert.ok(!html.includes('&amp;quot;'), 'Quote must not be double-escaped');
});

test('hostile markdown: multi-backtick code fences (>=4) and nested code syntax', () => {
  const source = '````ts\nconst x = "```bash\\necho 1\\n```";\n````';
  const html = renderMarkdown(source);
  assert.match(html, /<pre><code class="language-ts">/);
  assert.ok(html.includes('```bash'), 'Inner 3-backtick fence preserved as literal code');
  assert.ok(!html.endsWith('````'));
});

test('hostile markdown: inline code preserves markdown syntax and prevents placeholder collisions', () => {
  const inline = '`*not bold* and [not link](https://test.com)`';
  const html = renderMarkdown(inline);
  assert.match(html, /<code>\*not bold\* and \[not link\]\(https:\/\/test\.com\)<\/code>/);
  assert.ok(!html.includes('<em>'));
  assert.ok(!html.includes('<a href'));

  // User text that looks like internal placeholder
  const tricky = 'Literal text with \\x1aMDX123X1XC0\\x1a in body';
  const trickyHtml = renderMarkdown(tricky);
  assert.ok(trickyHtml.includes('\\x1aMDX123X1XC0\\x1a'));
});
