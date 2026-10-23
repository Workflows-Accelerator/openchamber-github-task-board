import test from 'node:test';
import assert from 'node:assert/strict';
import {
  findSections,
  editableSections,
  replaceSectionText,
  setStatusLabel,
  SectionError,
} from '../server/sections.ts';

const BODY = [
  'Intro paragraph.',
  '',
  '## Overview',
  '',
  'The board reads GitHub issues.',
  '',
  '## Acceptance Criteria',
  '- [ ] A person can open the board',
  '- [x] A person can log in',
  '',
  '### Open Questions',
  '- [ ] Which port?',
  '',
  '## Human Tasks',
  '- [ ] Approve the rollout',
  '',
  '## Test Plan (Issue)',
  '- [ ] node --test web/tests/*.test.mjs',
  '',
].join('\n');

test('findSections splits headings and keeps the preamble', () => {
  const sections = findSections(BODY);
  const titles = sections.map((s) => s.title);
  assert.equal(titles[0], '(overview)');
  assert.ok(titles.includes('Overview'));
  assert.ok(titles.includes('Acceptance Criteria'));
  assert.ok(titles.includes('Open Questions'));
  assert.ok(titles.includes('Human Tasks'));
  assert.ok(titles.includes('Test Plan (Issue)'));
  const overview = sections.find((s) => s.title === '(overview)');
  assert.equal(overview.text, 'Intro paragraph.');
});

test('editableSections exposes the overview prose only', () => {
  const sections = editableSections(BODY);
  assert.deepEqual(
    sections.map((s) => s.id),
    ['overview'],
  );
  assert.equal(sections[0].text, 'Intro paragraph.');
});

test('editableSections falls back to an Overview heading when there is no preamble', () => {
  const body = '## Overview\n\nCurrent text.\n\n## Notes\n\nKeep me.\n';
  const sections = editableSections(body);
  assert.equal(sections.length, 1);
  assert.equal(sections[0].text, 'Current text.');
});

test('replaceSectionText preserves every other byte unchanged', () => {
  const next = replaceSectionText(BODY, 'overview', 'New intro.\nSecond line.');
  const expected = BODY.replace('Intro paragraph.', 'New intro.\nSecond line.');
  assert.equal(next, expected);

  const rest = next.split('\n');
  const original = BODY.split('\n');
  // Everything from the first duplicate-region heading onward is identical.
  const cut = expected.indexOf('## Acceptance Criteria');
  assert.equal(next.slice(cut), BODY.slice(BODY.indexOf('## Acceptance Criteria')));
  assert.equal(rest.length > 0 && original.length > 0, true);
});

test('replaceSectionText preserves CRLF line endings', () => {
  const crlf = 'Intro.\r\n\r\n## Acceptance Criteria\r\n- [ ] keep\r\n';
  const next = replaceSectionText(crlf, 'overview', 'Changed.');
  assert.equal(next, 'Changed.\r\n\r\n## Acceptance Criteria\r\n- [ ] keep\r\n');
});

test('replaceSectionText can create content in an empty body', () => {
  const next = replaceSectionText('', 'overview', 'First words.');
  assert.equal(next, 'First words.\n');
});

test('replaceSectionText inserts an overview before a leading heading', () => {
  const body = '## Acceptance Criteria\n- [ ] untouched\n';
  const next = replaceSectionText(body, 'overview', 'New overview.');
  assert.equal(next, 'New overview.\n\n## Acceptance Criteria\n- [ ] untouched\n');
});

test('replaceSectionText refuses unknown or protected sections', () => {
  for (const id of ['acceptance-criteria', 'open-questions', 'human-tasks', 'nope']) {
    assert.throws(
      () => replaceSectionText(BODY, id, 'x'),
      (err) => err instanceof SectionError && /not editable/.test(err.message),
      `expected refusal for ${id}`,
    );
  }
});

test('replaceSectionText rejects non-string text', () => {
  assert.throws(
    () => replaceSectionText(BODY, 'overview', null),
    (err) => err instanceof SectionError,
  );
});

test('setStatusLabel replaces status labels, preserving every other label', () => {
  const labels = ['priority:high', 'status:todo', 'bug', 'Status:In-Review'];
  const next = setStatusLabel(labels, 'status:planned');
  assert.deepEqual(next, ['priority:high', 'bug', 'status:planned']);
});

test('setStatusLabel accepts every agreed status and rejects anything else', () => {
  const agreed = [
    'status:draft',
    'status:backlog',
    'status:todo',
    'status:planned',
    'status:in-progress',
    'status:needs-human',
    'status:in-review',
    'status:done',
  ];
  for (const status of agreed) {
    assert.deepEqual(setStatusLabel(['bug'], status), ['bug', status]);
  }
  for (const status of ['status:closed', 'bug', 'status:', '']) {
    assert.throws(
      () => setStatusLabel(['bug'], status),
      (err) => err instanceof SectionError,
      `expected refusal for ${String(status)}`,
    );
  }
});

test('setStatusLabel can clear the status without touching other labels', () => {
  assert.deepEqual(setStatusLabel(['bug', 'status:todo'], null), ['bug']);
});

test('findSections and replaceSectionText handle BOM correctly', () => {
  const body = '\uFEFF## Overview\n\nText A\n\n## Human Tasks\n- [ ] keep\n';
  const sections = editableSections(body);
  assert.equal(sections.length, 1);
  assert.equal(sections[0].id, 'overview');
  assert.equal(sections[0].title, 'Overview');
  assert.equal(sections[0].text, 'Text A');

  const updated = replaceSectionText(body, 'overview', 'NEW');
  assert.ok(updated.startsWith('\uFEFF## Overview\n'));
  assert.ok(updated.includes('NEW\n\n## Human Tasks'));
  assert.ok(updated.includes('## Overview'));
});

test('headings inside fenced code blocks are ignored', () => {
  const body = [
    '## Overview',
    'Intro.',
    '',
    '```markdown',
    '## Not a real section',
    'Some code',
    '```',
    '',
    '## Acceptance Criteria',
    '- [ ] task',
  ].join('\n');
  const sections = findSections(body);
  const titles = sections.map((s) => s.title);
  assert.ok(!titles.includes('Not a real section'));
  assert.deepEqual(titles, ['Overview', 'Acceptance Criteria']);
});

test('ambiguous preamble containing a code fence is not offered as editable', () => {
  const body = '```\n# Overview inside code\ncode\n```\n## Human Tasks\n- [ ] keep\n';
  const editable = editableSections(body);
  assert.equal(editable.length, 0);
  assert.throws(
    () => replaceSectionText(body, 'overview', 'NEW'),
    (err) => err instanceof SectionError && /not editable/.test(err.message),
  );
});

test('duplicate headings only allow the first matching overview to be editable', () => {
  const body = '## Overview\nFirst text.\n\n## Overview\nSecond text.\n';
  const sections = findSections(body);
  assert.equal(sections[0].id, 'overview');
  assert.equal(sections[0].editable, true);
  assert.equal(sections[1].id, 'overview-2');
  assert.equal(sections[1].editable, false);

  const replaced = replaceSectionText(body, 'overview', 'Updated text.');
  assert.ok(replaced.includes('## Overview\nUpdated text.'));
  assert.ok(replaced.includes('## Overview\nSecond text.'));
});
