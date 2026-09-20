// ==========================================
// Markdown Renderer & Description Preview
// ==========================================

export function renderMarkdown(raw: string): string {
  if (!raw || typeof raw !== 'string') return '<p style="color: var(--fg-muted); font-style: italic;">No description provided.</p>';

  let html = raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  // Code blocks
  html = html.replace(/```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g, (_, lang, code) => {
    return `<pre class="md-code-block"><code class="language-${lang}">${code.trim()}</code></pre>`;
  });

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code class="md-inline-code">$1</code>');

  // Headings
  html = html.replace(/^#### (.*$)/gim, '<h4 class="md-h4">$1</h4>');
  html = html.replace(/^### (.*$)/gim, '<h3 class="md-h3">$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2 class="md-h2">$1</h2>');
  html = html.replace(/^# (.*$)/gim, '<h1 class="md-h1">$1</h1>');

  // Blockquotes
  html = html.replace(/^\> (.*$)/gim, '<blockquote class="md-quote">$1</blockquote>');

  // Bold & Italic
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');

  // Links
  html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="md-link">$1 ↗</a>');

  // Paragraphs
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
