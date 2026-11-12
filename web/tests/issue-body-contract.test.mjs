import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseWebOpenQuestions, QUESTION_OPTION_MAX } from '../server/board.ts';

const CONTRACT = readFileSync(new URL('../../docs/issue-body-contract.md', import.meta.url), 'utf8');

function section25() {
  const start = CONTRACT.indexOf('### 2.5');
  const end = CONTRACT.indexOf('### 2.6');
  assert.ok(start >= 0 && end > start, 'docs/issue-body-contract.md must keep sections 2.5 and 2.6');
  return CONTRACT.slice(start, end);
}

function documentedExample() {
  const match = section25().match(/```markdown\n([\s\S]*?)```/);
  assert.ok(match, 'Section 2.5 must carry a fenced markdown example of preset options');
  return match[1];
}

test('contract §2.5 example parses verbatim into preset options', () => {
  const example = documentedExample();
  const parsed = parseWebOpenQuestions(example);
  assert.equal(parsed.length, 1, 'The documented example must parse as exactly one question');
  assert.equal(parsed[0].text, 'Which database should we use for the audit trail?');
  assert.deepEqual(parsed[0].options, [
    {
      label: 'PostgreSQL',
      gist: 'Mature and familiar',
      details: '**Operations stay unchanged**; `pg_dump` already works.',
    },
    {
      label: 'SQLite',
      gist: 'Zero operations',
      details: 'A single file, but no concurrent writers.',
    },
  ]);
});

test('contract §2.5 documented limits match the parser', () => {
  const section = section25();
  assert.match(section, /At most 8 options per question/);
  assert.match(section, /at most 120 characters/);
  assert.equal(QUESTION_OPTION_MAX, 8);

  const accepted = 'A'.repeat(120);
  const rejected = 'B'.repeat(121);
  const bounds = parseWebOpenQuestions([
    '## Open Questions',
    '- [ ] Which label lengths are accepted?',
    `  - ${accepted} :: gist`,
    `  - ${rejected} :: gist`,
  ].join('\n'));
  assert.deepEqual(bounds[0].options.map((option) => option.label), [accepted]);

  const capped = parseWebOpenQuestions([
    '## Open Questions',
    '- [ ] Which option should we pick?',
    ...Array.from({ length: 10 }, (_, index) => `  - Option ${index} :: gist`),
  ].join('\n'));
  assert.equal(capped[0].options.length, QUESTION_OPTION_MAX);
});
