import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import {
  buildBoardListItem,
  buildIssueDetail,
  humanReviewGateMessage,
  parseHumanReview,
} from '../server/board.ts';
import { startFakeGitHub, makeIssue } from './fake-github.mjs';
import { startBoard, browserConfig, HttpSession, SYNTHETIC_TOKEN } from './helpers.mjs';

const IMAGE_BODY = `## Overview

Review the empty state.

### Human Review:
- Artifact: image
- URL: https://example.com/screenshots/login-empty.png
- Instruction: Compare the empty state with the approved mockup.`;

const VIDEO_BODY = `### Human Review:
- Artifact: video
- URL: https://example.com/clips/flow.mp4
- Instruction: Watch the first ten seconds of the sign-in flow.`;

const LINK_BODY = `### Human Review:
- Artifact: link
- URL: https://example.com/preview/login
- Instruction: Open the preview and confirm the button label.`;

const QUESTION_BODY = `## Overview

Pick a row density.

### Open Questions:
- [ ] Which spacing should the list use?
  - Compact :: Dense rows :: Best for scanning long queues.
  - Comfortable :: Roomier rows :: Easier on a phone.

### Human Review:
- Artifact: question`;

function issue(number, body, labels = ['status:todo']) {
  return makeIssue({ number, body, labels });
}

async function fixture(run, options = {}) {
  const fake = await startFakeGitHub({
    token: SYNTHETIC_TOKEN,
    issues: [
      issue(1, IMAGE_BODY),
      issue(2, '## Overview\n\nNo artifact here.\n'),
      issue(3, '### Human Review:\n- Artifact: image\n- URL: javascript:alert(1)\n- Instruction: Open it.'),
      issue(4, QUESTION_BODY),
      issue(5, LINK_BODY),
    ],
    ...options,
  });
  const board = await startBoard(fake, { config: browserConfig(fake, options.env ?? {}) });
  try {
    const session = new HttpSession(board.url);
    await session.login();
    await run({ fake, board, session });
  } finally {
    await board.app.close();
    await fake.close();
  }
}

async function detail(session, number) {
  const read = await session.request(`/api/issues/${number}`);
  assert.equal(read.status, 200);
  return read.json.issue;
}

test('V4-3 parser accepts image, video, link and preset question artifacts', () => {
  const image = parseHumanReview(IMAGE_BODY);
  assert.equal(image.state, 'ready');
  assert.equal(image.kind, 'image');
  assert.equal(image.url, 'https://example.com/screenshots/login-empty.png');
  assert.equal(image.instruction, 'Compare the empty state with the approved mockup.');

  assert.equal(parseHumanReview(VIDEO_BODY).kind, 'video');
  assert.equal(parseHumanReview(LINK_BODY).kind, 'link');

  const question = parseHumanReview(QUESTION_BODY);
  assert.equal(question.state, 'ready');
  assert.equal(question.kind, 'question');
  assert.equal(question.question.text, 'Which spacing should the list use?');
  assert.deepEqual(question.question.options.map((option) => option.label), ['Compact', 'Comfortable']);
  assert.equal(question.question.answerIndex, 0);
});

test('V4-3 parser reports precise reasons instead of accepting a gate', () => {
  // "missing" is the legacy state (no section at all); every other rejection is
  // "malformed", so a broken section is never mistaken for an absent one.
  const cases = [
    ['', 'missing', 'no_section'],
    ['## Overview\n\nNothing to click.\n', 'missing', 'no_section'],
    ['### Human Review:\n- Instruction: Look at it.\n', 'malformed', 'no_artifact'],
    ['### Human Review:\n- Artifact: animation\n- URL: https://example.com/a.gif\n- Instruction: Watch.\n', 'malformed', 'unknown_artifact'],
    ['### Human Review:\n- Artifact: image\n- Artifact: video\n- URL: https://example.com/a.png\n- Instruction: Look.\n', 'malformed', 'duplicate_field'],
    ['### Human Review:\n- Artifact: image\n- Instruction: Look.\n', 'malformed', 'missing_url'],
    ['### Human Review:\n- Artifact: link\n- URL: javascript:alert(1)\n- Instruction: Open.\n', 'malformed', 'invalid_url'],
    ['### Human Review:\n- Artifact: link\n- URL: https://example.com/a b\n- Instruction: Open.\n', 'malformed', 'invalid_url'],
    ['### Human Review:\n- Artifact: image\n- URL: https://example.com/a.png\n', 'malformed', 'missing_instruction'],
    ['### Human Review:\n- Artifact: image\n- URL: https://example.com/a.png\n- Instruction: ' + 'x'.repeat(201) + '\n', 'malformed', 'long_instruction'],
    ['### Human Review:\n- Artifact: question\n', 'malformed', 'missing_question'],
  ];
  for (const [body, state, reason] of cases) {
    const parsed = parseHumanReview(body);
    assert.equal(parsed.state, state, body);
    assert.equal(parsed.reason, reason, body);
    assert.ok(parsed.message.length > 10, 'reason must explain itself');
  }
});

test('V4-3 parser ignores fenced and indented headings, and the last section wins', () => {
  const fenced = '```markdown\n### Human Review:\n- Artifact: image\n- URL: https://example.com/a.png\n- Instruction: Look.\n```\n';
  assert.equal(parseHumanReview(fenced).reason, 'no_section');
  const indented = '    ### Human Review:\n    - Artifact: image\n';
  assert.equal(parseHumanReview(indented).reason, 'no_section');
  const two = `${IMAGE_BODY}\n\n### Human Review:\n- Artifact: link\n- URL: https://example.com/second\n- Instruction: Second wins.\n`;
  const parsed = parseHumanReview(two);
  assert.equal(parsed.kind, 'link');
  assert.equal(parsed.instruction, 'Second wins.');
});

test('V4-3 answered question is settled, never a silent ready gate', () => {
  const answered = QUESTION_BODY.replace('- [ ] Which spacing', '- [x] Which spacing');
  const parsed = parseHumanReview(answered);
  assert.equal(parsed.state, 'settled');
  assert.equal(parsed.reason, 'question_answered');
  assert.match(humanReviewGateMessage(parsed), /Move this task back to the agent/);
});

test('V4-3 payload exposes the artifact on rows and in the detail view', () => {
  const row = buildBoardListItem(issue(1, IMAGE_BODY), null);
  assert.equal(row.humanReview.state, 'ready');
  assert.equal(row.humanReview.kind, 'image');
  const plain = buildBoardListItem(issue(2, '## Overview\n\nNo artifact here.\n'), null);
  assert.equal(plain.humanReview.state, 'missing');
  assert.equal(plain.humanReview.reason, 'no_section');
  const full = buildIssueDetail(issue(4, QUESTION_BODY), null);
  assert.equal(full.humanReview.kind, 'question');
  assert.equal(full.humanReview.question.options.length, 2);
});

test('V4-3 status endpoint rejects a human gate with no artifact and writes nothing', async () => {
  await fixture(async ({ fake, session }) => {
    const current = await detail(session, 2);
    const rejected = await session.request('/api/issues/2/status', {
      method: 'POST',
      body: { status: 'status:needs-human', fingerprint: current.fingerprint },
    });
    assert.equal(rejected.status, 400);
    assert.equal(rejected.json.error, 'human_review_required');
    assert.match(rejected.json.message, /Human Review/);
    assert.match(rejected.json.message, /no artifact/i);
    assert.equal(fake.patchCalls.length, 0);
    assert.equal((await detail(session, 2)).statusLabel, 'status:todo');
  });
});

test('V4-3 PATCH status accepts a valid artifact and rejects a malformed one', async () => {
  await fixture(async ({ fake, session }) => {
    const valid = await detail(session, 1);
    const accepted = await session.request('/api/issues/1', {
      method: 'PATCH',
      body: { status: 'status:needs-human', fingerprint: valid.fingerprint },
    });
    assert.equal(accepted.status, 200);
    assert.equal(accepted.json.issue.statusLabel, 'status:needs-human');
    assert.equal(accepted.json.issue.humanReview.state, 'ready');

    const malformed = await detail(session, 3);
    const rejected = await session.request('/api/issues/3', {
      method: 'PATCH',
      body: { status: 'status:needs-human', fingerprint: malformed.fingerprint },
    });
    assert.equal(rejected.status, 400);
    assert.equal(rejected.json.error, 'human_review_required');
    assert.match(rejected.json.message, /must be an http:\/\/ or https:\/\/ link/);
    assert.equal(fake.findIssue(3).labels.some((label) => label.name === 'status:needs-human'), false);
  });
});

test('V4-3 creation cannot be born waiting for a human without an artifact', async () => {
  await fixture(async ({ fake, session }) => {
    const rejected = await session.request('/api/issues', {
      method: 'POST',
      body: { title: 'Born waiting', body: '## Overview\n\nNothing to click.', labels: ['status:needs-human'] },
    });
    assert.equal(rejected.status, 400);
    assert.equal(rejected.json.error, 'human_review_required');
    assert.equal(fake.findIssue(6), null);

    const accepted = await session.request('/api/issues', {
      method: 'POST',
      body: { title: 'Born with a gate', body: IMAGE_BODY, labels: ['status:needs-human'] },
    });
    assert.equal(accepted.status, 201);
    assert.equal(accepted.json.issue.humanReview.state, 'ready');
  });
});

test('V4-3 editing the body of a waiting task cannot silently remove its artifact', async () => {
  await fixture(async ({ fake, session }) => {
    const waiting = await detail(session, 1);
    await session.request('/api/issues/1/status', {
      method: 'POST',
      body: { status: 'status:needs-human', fingerprint: waiting.fingerprint },
    });
    const gated = await detail(session, 1);
    const rejected = await session.request('/api/issues/1', {
      method: 'PATCH',
      body: { body: '## Overview\n\nRemoved the section.\n', fingerprint: gated.fingerprint },
    });
    assert.equal(rejected.status, 400);
    assert.equal(rejected.json.error, 'human_review_required');
    assert.match(fake.findIssue(1).body, /### Human Review:/);
  });
});

test('V4-3 answering the gated question is allowed and settles the artifact', async () => {
  await fixture(async ({ session }) => {
    const waiting = await detail(session, 4);
    await session.request('/api/issues/4/status', {
      method: 'POST',
      body: { status: 'status:needs-human', fingerprint: waiting.fingerprint },
    });
    const gated = await detail(session, 4);
    const answered = await session.request('/api/issues/4/questions/0/answer', {
      method: 'POST',
      body: { answer: 'Comfortable', fingerprint: gated.fingerprint },
    });
    assert.equal(answered.status, 200);
    // Answering the gated question settles the artifact, so the task must leave
    // the waiting column and return to the agent instead of showing a wait.
    assert.equal(answered.json.issue.statusLabel, 'status:in-progress');
    assert.ok(answered.json.issue.labels.includes('status:in-progress'));
    assert.equal(answered.json.issue.labels.includes('status:needs-human'), false);
    assert.equal(answered.json.issue.humanReview.state, 'settled');
    assert.equal(answered.json.issue.humanReview.reason, 'question_answered');
  });
});

test('V4-3 multi-repo qualified status route enforces the same gate', async () => {
  const fake = await startFakeGitHub({
    token: SYNTHETIC_TOKEN,
    repositories: [
      { repo: 'owner/alpha', id: 101, issues: [issue(1, IMAGE_BODY), issue(2, '## Overview\n\nNo artifact.\n')] },
      { repo: 'owner/beta', id: 102, issues: [issue(1, '## Overview\n\nNo artifact.\n')] },
    ],
  });
  const board = await startBoard(fake, { config: browserConfig(fake, {}) });
  try {
    const session = new HttpSession(board.url);
    await session.login();
    const read = await session.request('/api/repos/owner/alpha/issues/2');
    assert.equal(read.status, 200);
    const rejected = await session.request('/api/repos/owner/alpha/issues/2/status', {
      method: 'POST',
      body: { status: 'status:needs-human', fingerprint: read.json.issue.fingerprint },
    });
    assert.equal(rejected.status, 400);
    assert.equal(rejected.json.error, 'human_review_required');

    const beta = await session.request('/api/repos/owner/beta/issues/1');
    assert.equal(beta.status, 200);
    const accepted = await session.request('/api/repos/owner/alpha/issues/1/status', {
      method: 'POST',
      body: { status: 'status:needs-human', fingerprint: (await session.request('/api/repos/owner/alpha/issues/1')).json.issue.fingerprint },
    });
    assert.equal(accepted.status, 200);
  } finally {
    await board.app.close();
    await fake.close();
  }
});

// The document and the parser must not drift apart again: the fenced example in
// docs/issue-body-contract.md is parsed by the shipped parser, and a one-token
// mutation of it must stop being accepted.
const CONTRACT = readFileSync(new URL('../../docs/issue-body-contract.md', import.meta.url), 'utf8');

function documentedExample() {
  const start = CONTRACT.indexOf('### 2.9');
  const end = CONTRACT.indexOf('### 2.10');
  assert.ok(start >= 0 && end > start, 'docs/issue-body-contract.md must carry section 2.9 and a following 2.10');
  const section = CONTRACT.slice(start, end);
  const match = section.match(/```markdown\n([\s\S]*?)```/);
  assert.ok(match, 'Section 2.9 must carry a fenced markdown example of a human review artifact');
  return match[1];
}

test('V4-3 contract §2.9 example parses verbatim with the real parser', () => {
  const parsed = parseHumanReview(documentedExample());
  assert.equal(parsed.state, 'ready');
  assert.equal(parsed.kind, 'image');
  assert.ok(parsed.url.startsWith('https://'));
  assert.ok(parsed.instruction.length > 0);
});

test('V4-3 contract lock fails when the documented example drifts', () => {
  const example = documentedExample();
  const mutated = example.replace('- Artifact: image', '- Artifact: screenshot');
  assert.notEqual(mutated, example);
  assert.equal(parseHumanReview(mutated).state, 'malformed');
  assert.equal(parseHumanReview(mutated).reason, 'unknown_artifact');
});

test('V4-3 contract lock is non-destructive: the document stays byte-identical', () => {
  const path = new URL('../../docs/issue-body-contract.md', import.meta.url);
  const before = readFileSync(path);
  const mutated = documentedExample().replace('- Artifact: image', '- Artifact: screenshot');
  assert.equal(parseHumanReview(mutated).reason, 'unknown_artifact');
  const after = readFileSync(path);
  assert.deepEqual(after, before);
  assert.equal(
    createHash('sha256').update(after).digest('hex'),
    createHash('sha256').update(before).digest('hex'),
    'the lock test must never rewrite the canonical document',
  );
});

// The prompt constants exist twice: panel/core.ts (tests, main.ts) and the
// shipped panel/main.js. They must carry the same Human Review rule verbatim.
function promptConstant(source, name) {
  const marker = name + ' = `';
  const start = source.indexOf(marker);
  assert.ok(start >= 0, `missing ${name}`);
  let i = start + marker.length;
  let out = '';
  while (i < source.length) {
    const char = source[i];
    if (char === '\\') { out += source.slice(i, i + 2); i += 2; continue; }
    if (char === '`') return out;
    out += char;
    i += 1;
  }
  throw new Error(`unterminated ${name}`);
}

test('V4-3 prompts document the human gate identically in core.ts and shipped main.js', () => {
  const core = readFileSync(new URL('../../panel/core.ts', import.meta.url), 'utf8');
  const shipped = readFileSync(new URL('../../panel/main.js', import.meta.url), 'utf8');
  for (const name of ['DEFAULT_AI_ISSUE_PROMPT', 'DEFAULT_AI_ALIGNMENT_PROMPT']) {
    const fromCore = promptConstant(core, name);
    const fromShipped = promptConstant(shipped, name);
    assert.equal(fromShipped, fromCore, `${name} drifted between core.ts and main.js`);
    assert.match(fromCore, /### Human Review:/, `${name} must document the Human Review section`);
    assert.match(fromCore, /status:needs-human/, `${name} must tie the gate to the waiting label`);
  }
});

test('V4-3 reopening a closed waiting task without an artifact is refused', async () => {
  const fake = await startFakeGitHub({
    token: SYNTHETIC_TOKEN,
    issues: [
      makeIssue({ number: 20, body: '## Overview\n\nNo artifact.\n', state: 'closed', labels: ['status:needs-human'] }),
      makeIssue({ number: 21, body: IMAGE_BODY, state: 'closed', labels: ['status:needs-human'] }),
    ],
  });
  const board = await startBoard(fake, { config: browserConfig(fake, {}) });
  try {
    const session = new HttpSession(board.url);
    await session.login();

    const closed = (await session.request('/api/issues/20')).json.issue;
    const rejected = await session.request('/api/issues/20', {
      method: 'PATCH',
      body: { fingerprint: closed.fingerprint, state: 'open' },
    });
    assert.equal(rejected.status, 400);
    assert.equal(rejected.json.error, 'human_review_required');
    assert.match(rejected.json.message, /no artifact/i);
    assert.equal(fake.findIssue(20).state, 'closed', 'the refused reopen wrote nothing');

    const valid = (await session.request('/api/issues/21')).json.issue;
    const accepted = await session.request('/api/issues/21', {
      method: 'PATCH',
      body: { fingerprint: valid.fingerprint, state: 'open' },
    });
    assert.equal(accepted.status, 200);
    assert.equal(accepted.json.issue.state, 'open');
    assert.equal(accepted.json.issue.humanReview.state, 'ready');
  } finally {
    await board.app.close();
    await fake.close();
  }
});

test('V4-3 a closed body edit cannot remove the gate and then reopen', async () => {
  const fake = await startFakeGitHub({
    token: SYNTHETIC_TOKEN,
    issues: [
      makeIssue({ number: 22, body: IMAGE_BODY, state: 'closed', labels: ['status:needs-human'] }),
    ],
  });
  const board = await startBoard(fake, { config: browserConfig(fake, {}) });
  try {
    const session = new HttpSession(board.url);
    await session.login();
    const closed = (await session.request('/api/issues/22')).json.issue;
    const edit = await session.request('/api/issues/22', {
      method: 'PATCH',
      body: { fingerprint: closed.fingerprint, body: '## Overview\n\nRemoved while closed.\n' },
    });
    assert.equal(edit.status, 200);
    const afterEdit = (await session.request('/api/issues/22')).json.issue;
    const reopen = await session.request('/api/issues/22', {
      method: 'PATCH',
      body: { fingerprint: afterEdit.fingerprint, state: 'open' },
    });
    assert.equal(reopen.status, 400);
    assert.equal(reopen.json.error, 'human_review_required');
    assert.equal(fake.findIssue(22).state, 'closed');
  } finally {
    await board.app.close();
    await fake.close();
  }
});
