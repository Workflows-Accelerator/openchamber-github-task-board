import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  parseDraftIssueFromMarkdown,
  formatDraftReviewMeta,
  createDraftIssuePayload,
} from '../panel/core.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const INDEX_HTML = fs.readFileSync(path.join(__dirname, '../panel/index.html'), 'utf8');

// Zero emoji helper
function containsEmoji(text) {
  if (!text) return false;
  const emojiRegex = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F000}-\u{1F02F}\u{1F0A0}-\u{1F0FF}]/u;
  return emojiRegex.test(text);
}

test('Stream 2: parseDraftIssueFromMarkdown extracts H1 title, subtasks, questions, and body', () => {
  const sample = `# feat(auth): add remember-me token refresh

### Friendly Title: Remember-Me Refresh

## Overview
Implement remember-me token persistence with auto-rotation.

### Actionable Subtasks Checklist:
- [ ] Implement token hashing and db table
- [ ] Add rotation endpoint
- [ ] Verify green with test suite

### Open Questions:
- [ ] What is the expiration window for tokens?
`;

  const parsed = parseDraftIssueFromMarkdown(sample);
  assert.ok(parsed, 'Parsed draft issue must not be null');
  assert.equal(parsed.title, 'feat(auth): add remember-me token refresh');
  assert.ok(parsed.body.includes('### Friendly Title: Remember-Me Refresh'));
  assert.ok(parsed.body.includes('Implement remember-me token persistence'));
  assert.deepEqual(parsed.subtasks, [
    'Implement token hashing and db table',
    'Add rotation endpoint',
    'Verify green with test suite',
  ]);
  assert.deepEqual(parsed.openQuestions, [
    'What is the expiration window for tokens?',
  ]);
  assert.ok(parsed.labels.includes('status:todo'));
});

test('Stream 2: parseDraftIssueFromMarkdown extracts Title: and Labels: prefixes', () => {
  const sample = `Title: fix(ui): repair overflow in drawer
Labels: bug, frontend, priority:high

## Overview
Prevent drawer container from horizontally scrolling when issue title is long.
`;

  const parsed = parseDraftIssueFromMarkdown(sample);
  assert.ok(parsed);
  assert.equal(parsed.title, 'fix(ui): repair overflow in drawer');
  assert.ok(parsed.labels.includes('bug'));
  assert.ok(parsed.labels.includes('frontend'));
  assert.ok(parsed.labels.includes('priority:high'));
  assert.ok(parsed.labels.includes('status:todo'));
});

test('Stream 2: parseDraftIssueFromMarkdown handles unstructured plain text fallback', () => {
  const sample = `Refactor storage caching layer
We should optimize how issue caching stores payloads to prevent duplicate disk writes.`;

  const parsed = parseDraftIssueFromMarkdown(sample);
  assert.ok(parsed);
  assert.equal(parsed.title, 'Refactor storage caching layer');
  assert.equal(
    parsed.body,
    'We should optimize how issue caching stores payloads to prevent duplicate disk writes.'
  );
  assert.ok(parsed.labels.includes('status:todo'));
});

test('Stream 2: parseDraftIssueFromMarkdown handles empty, malformed, and adversarial inputs safely', () => {
  assert.equal(parseDraftIssueFromMarkdown(null), null);
  assert.equal(parseDraftIssueFromMarkdown(undefined), null);
  assert.equal(parseDraftIssueFromMarkdown(''), null);
  assert.equal(parseDraftIssueFromMarkdown('   \n\n  \t '), null);

  // Single line input
  const single = parseDraftIssueFromMarkdown('One line quick note');
  assert.ok(single);
  assert.equal(single.title, 'One line quick note');
  assert.equal(single.body, '');

  // Bold / markdown delimiters in title
  const boldTitle = parseDraftIssueFromMarkdown('# **feat(core): bold title**\n\nSome body text');
  assert.ok(boldTitle);
  assert.equal(boldTitle.title, 'feat(core): bold title');
});

test('Stream 2: formatDraftReviewMeta formats singular and plural counts correctly', () => {
  assert.equal(formatDraftReviewMeta(0, 0), '0 subtasks · 0 questions');
  assert.equal(formatDraftReviewMeta(1, 1), '1 subtask · 1 question');
  assert.equal(formatDraftReviewMeta(3, 2), '3 subtasks · 2 questions');
  assert.equal(formatDraftReviewMeta(1, 5), '1 subtask · 5 questions');
});

test('Stream 2: createDraftIssuePayload enforces title presence and valid payload defaults', () => {
  const payload = createDraftIssuePayload({
    title: '  feat(board): add live draft preview  ',
    body: '  Detailed description  ',
    labels: ['enhancement'],
  });

  assert.equal(payload.title, 'feat(board): add live draft preview');
  assert.equal(payload.body, 'Detailed description');
  assert.ok(payload.labels.includes('enhancement'));
  assert.ok(payload.labels.includes('status:todo'));

  // Throws if title is empty
  assert.throws(() => {
    createDraftIssuePayload({ title: '   ', body: 'body' });
  }, /non-empty title/);
});

test('Stream 2: panel/index.html defines required live draft review card elements and contains zero emojis', () => {
  assert.ok(INDEX_HTML.includes('id="aiDraftReviewCard"'));
  assert.ok(INDEX_HTML.includes('id="draftStatusIndicator"'));
  assert.ok(INDEX_HTML.includes('id="draftStatusText"'));
  assert.ok(INDEX_HTML.includes('id="draftReviewTitleInput"'));
  assert.ok(INDEX_HTML.includes('id="draftReviewBodyInput"'));
  assert.ok(INDEX_HTML.includes('id="draftReviewMeta"'));
  assert.ok(INDEX_HTML.includes('id="btnAcceptAndPostDraft"'));
  assert.ok(INDEX_HTML.includes('id="btnEditDraftInManual"'));
  assert.ok(INDEX_HTML.includes('id="btnDismissDraftReview"'));

  // Extract review card markup and check for zero emojis
  const startIdx = INDEX_HTML.indexOf('id="aiDraftReviewCard"');
  assert.ok(startIdx > 0);
  const cardMarkup = INDEX_HTML.slice(startIdx - 50, startIdx + 2000);
  assert.equal(containsEmoji(cardMarkup), false);
});
