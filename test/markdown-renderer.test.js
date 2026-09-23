import test from 'node:test';
import assert from 'node:assert/strict';
import { renderMarkdown, getIssueDescriptionPreview } from '../panel/markdown.ts';

export { renderMarkdown, getIssueDescriptionPreview };

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

test('renderMarkdown asserts <img src=x onerror=alert(1)> in comment body renders inert', () => {
  const malicious = '<img src=x onerror=alert(1)>';
  const rendered = renderMarkdown(malicious);
  assert.ok(!rendered.includes('<img'));
  assert.ok(rendered.includes('&lt;img'));
  assert.ok(rendered.includes('onerror=alert(1)&gt;') || rendered.includes('onerror=&quot;alert(1)&quot;&gt;'));

  // Test within table cell
  const tableWithXss = '| Column |\n| --- |\n| <img src=x onerror=alert(1)> |';
  const tableRendered = renderMarkdown(tableWithXss);
  assert.ok(!tableRendered.includes('<img'));
  assert.ok(tableRendered.includes('&lt;img'));

  // Test within list item
  const listWithXss = '- <img src=x onerror=alert(1)>';
  const listRendered = renderMarkdown(listWithXss);
  assert.ok(!listRendered.includes('<img'));
  assert.ok(listRendered.includes('&lt;img'));
});

test('renderMarkdown parses GFM tables with header, separator, body rows, and alignments', () => {
  const md = `| Item | Qty | Price | Status |
| :--- | :---: | ---: | --- |
| Apple | 10 | $1.50 | **In Stock** |
| Banana | 5 | $0.80 | \`Out of Stock\` |`;
  const rendered = renderMarkdown(md);

  assert.ok(rendered.includes('<div class="md-table-wrap"><table class="md-table">'));
  assert.ok(rendered.includes('<thead><tr>'));
  assert.ok(rendered.includes('<th style="text-align: left;">Item</th>'));
  assert.ok(rendered.includes('<th style="text-align: center;">Qty</th>'));
  assert.ok(rendered.includes('<th style="text-align: right;">Price</th>'));
  assert.ok(rendered.includes('<th>Status</th>') || rendered.includes('<th style="text-align: left;">Status</th>'));
  assert.ok(rendered.includes('<tbody><tr>'));
  assert.ok(rendered.includes('<td style="text-align: left;">Apple</td>'));
  assert.ok(rendered.includes('<td style="text-align: center;">10</td>'));
  assert.ok(rendered.includes('<td style="text-align: right;">$1.50</td>'));
  assert.ok(rendered.includes('<strong>In Stock</strong>'));
  assert.ok(rendered.includes('<code class="md-inline-code">Out of Stock</code>'));
  assert.ok(rendered.includes('</table></div>'));
});

test('renderMarkdown handles ragged table rows gracefully without breaking', () => {
  const md = `| Col A | Col B | Col C |
| --- | --- | --- |
| Cell 1 |
| Cell 1 | Cell 2 | Cell 3 | Cell 4 |`;
  const rendered = renderMarkdown(md);

  assert.ok(rendered.includes('<div class="md-table-wrap"><table class="md-table">'));
  // Col C missing in first row -> should have 3 td's
  assert.ok(rendered.includes('<td>Cell 1</td><td></td><td></td>'));
  // Extra cell in second row should be capped to 3 td's
  assert.ok(rendered.includes('<td>Cell 1</td><td>Cell 2</td><td>Cell 3</td>'));
  assert.ok(!rendered.includes('<td>Cell 4</td>'));
});

test('renderMarkdown handles header-only tables', () => {
  const md = `| Header 1 | Header 2 |
| --- | --- |`;
  const rendered = renderMarkdown(md);

  assert.ok(rendered.includes('<div class="md-table-wrap"><table class="md-table">'));
  assert.ok(rendered.includes('<th>Header 1</th>') || rendered.includes('<th style="text-align: left;">Header 1</th>'));
  assert.ok(rendered.includes('<th>Header 2</th>') || rendered.includes('<th style="text-align: left;">Header 2</th>'));
});

test('renderMarkdown parses unordered lists with - and * into ul/li', () => {
  const md = `- Item one\n- Item two\n* Item three`;
  const rendered = renderMarkdown(md);

  assert.ok(rendered.includes('<ul class="md-ul">'));
  assert.ok(rendered.includes('<li class="md-li">Item one</li>'));
  assert.ok(rendered.includes('<li class="md-li">Item two</li>'));
  assert.ok(rendered.includes('<li class="md-li">Item three</li>'));
  assert.ok(rendered.includes('</ul>'));
});

test('renderMarkdown parses ordered lists with numbers into ol/li', () => {
  const md = `1. Step one\n2. Step two\n3. Step three`;
  const rendered = renderMarkdown(md);

  assert.ok(rendered.includes('<ol class="md-ol">'));
  assert.ok(rendered.includes('<li class="md-li">Step one</li>'));
  assert.ok(rendered.includes('<li class="md-li">Step two</li>'));
  assert.ok(rendered.includes('<li class="md-li">Step three</li>'));
  assert.ok(rendered.includes('</ol>'));
});

test('renderMarkdown parses task checkboxes in lists', () => {
  const md = `- [ ] Open task\n- [x] Done task`;
  const rendered = renderMarkdown(md);

  assert.ok(rendered.includes('<ul class="md-ul">'));
  assert.ok(rendered.includes('<input type="checkbox" disabled class="md-task-checkbox">'));
  assert.ok(rendered.includes('<input type="checkbox" disabled checked class="md-task-checkbox">'));
  assert.ok(rendered.includes('Open task'));
  assert.ok(rendered.includes('Done task'));
});

test('renderMarkdown parses nested lists properly', () => {
  const md = `- Parent\n  - Child 1\n  - Child 2\n- Next Parent`;
  const rendered = renderMarkdown(md);

  assert.ok(rendered.includes('<ul class="md-ul">'));
  assert.ok(rendered.includes('Parent'));
  assert.ok(rendered.includes('Child 1'));
  assert.ok(rendered.includes('Child 2'));
  assert.ok(rendered.includes('Next Parent'));
});

test('renderMarkdown does NOT parse tables or lists inside fenced code blocks', () => {
  const md = '```markdown\n| Not | Table |\n|---|---|\n| 1 | 2 |\n- not a list\n```';
  const rendered = renderMarkdown(md);

  assert.ok(!rendered.includes('<table'));
  assert.ok(!rendered.includes('<ul'));
  assert.ok(rendered.includes('<pre class="md-code-block">'));
  assert.ok(rendered.includes('| Not | Table |'));
});

test('renderMarkdown does NOT parse normal prose containing pipes as tables', () => {
  const md = 'This is a pipe | character in normal prose.\nNext line of prose.';
  const rendered = renderMarkdown(md);

  assert.ok(!rendered.includes('<table'));
  assert.ok(rendered.includes('<p class="md-p">'));
  assert.ok(rendered.includes('This is a pipe | character in normal prose.'));
});

test('renderMarkdown handles escaped pipes inside table cells', () => {
  const md = '| Command | Description |\n|---|---|\n| `grep \\| wc` | Pipes grep to wc |';
  const rendered = renderMarkdown(md);

  assert.ok(rendered.includes('<table class="md-table">'));
  assert.ok(rendered.includes('Pipes grep to wc'));
});

test('renderMarkdown parses tables without outer pipes', () => {
  const md = 'Col A | Col B\n---|---\n1 | 2';
  const rendered = renderMarkdown(md);

  assert.ok(rendered.includes('<table class="md-table">'));
  assert.ok(rendered.includes('<th>Col A</th>') || rendered.includes('<th style="text-align: left;">Col A</th>'));
  assert.ok(rendered.includes('<td>1</td>') || rendered.includes('<td style="text-align: left;">1</td>'));
});

test('renderMarkdown separates table from list containing pipe immediately following it', () => {
  const md = '| Table Col |\n| --- |\n| Cell Val |\n- list item | with pipe';
  const rendered = renderMarkdown(md);

  assert.ok(rendered.includes('<table class="md-table">'));
  assert.ok(rendered.includes('<td>Cell Val</td>') || rendered.includes('<td style="text-align: left;">Cell Val</td>'));
  assert.ok(rendered.includes('<ul class="md-ul">'));
  assert.ok(rendered.includes('<li class="md-li">list item | with pipe</li>'));
});

test('renderMarkdown preserves escaping against aggressive XSS injection vectors', () => {
  const vectors = [
    '<svg onload=alert(document.domain)>',
    '<iframe src="javascript:alert(1)"></iframe>',
    '<a href="javascript:alert(1)">click</a>',
    '| <script>alert(1)</script> |\n| --- |\n| <img src=x onerror=alert(1)> |',
    '- <body onload=alert(1)>',
    '1. <input autofocus onfocus=alert(1)>',
  ];

  for (const v of vectors) {
    const rendered = renderMarkdown(v);
    assert.ok(!rendered.includes('<svg'), `Raw svg leaked: ${v}`);
    assert.ok(!rendered.includes('<iframe'), `Raw iframe leaked: ${v}`);
    assert.ok(!rendered.includes('<script'), `Raw script leaked: ${v}`);
    assert.ok(!rendered.includes('<img'), `Raw img leaked: ${v}`);
    assert.ok(!rendered.includes('<body'), `Raw body leaked: ${v}`);
    assert.ok(!rendered.includes('<input autofocus'), `Active input leaked: ${v}`);
    assert.ok(!rendered.includes('<input onfocus'), `Active input leaked: ${v}`);
    assert.ok(!rendered.includes('href="javascript:'), `Javascript link leaked: ${v}`);
    assert.ok(rendered.includes('&lt;'), `HTML was not escaped: ${v}`);
  }
});

test('renderMarkdown parses multiple independent tables in one document', () => {
  const md = `| First Table |\n| --- |\n| 1 |\n\nMiddle paragraph.\n\n| Second Table |\n| --- |\n| 2 |`;
  const rendered = renderMarkdown(md);

  const tableMatches = rendered.match(/<table class="md-table">/g);
  assert.equal(tableMatches?.length, 2);
  assert.ok(rendered.includes('Middle paragraph.'));
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
