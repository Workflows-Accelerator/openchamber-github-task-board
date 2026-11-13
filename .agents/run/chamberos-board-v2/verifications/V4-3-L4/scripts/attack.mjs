// V4-3-L4 independent attack. Written by the independent reviewer, not by the
// authors. Synthetic fake GitHub only, local board only, no real GitHub call.
//
// Run from the V4-3-L4 directory:
//   node scripts/attack.mjs
//
// Every route case records: status, error code, whether the fake GitHub saw a
// write, and the resulting stored issue. Assertions are checked in-process so a
// silent regression cannot pass as "data".

import { parseHumanReview } from '../../../../../../web/server/board.ts';
import { startFakeGitHub, makeIssue } from '../../../../../../web/tests/fake-github.mjs';
import { startBoard, browserConfig, HttpSession, SYNTHETIC_TOKEN } from '../../../../../../web/tests/helpers.mjs';

const out = { parser: [], routes: [], failures: [] };
const check = (group, name, ok, detail) => {
  out[group].push({ name, ok, ...detail });
  if (!ok) out.failures.push({ group, name, ...detail });
};

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------
const IMAGE = [
  '## Overview', '', 'Review.', '',
  '### Human Review:', '- Artifact: image',
  '- URL: https://example.com/screenshots/login-empty.png',
  '- Instruction: Compare the empty state with the approved mockup.',
].join('\n');

const QUESTION = [
  '## Overview', '', 'Pick one.', '',
  '### Open Questions:', '- [ ] Which spacing should the list use?',
  '  - Compact :: Dense rows :: Best for scanning.',
  '  - Comfortable :: Roomier rows :: Easier on a phone.', '',
  '### Human Review:', '- Artifact: question',
].join('\n');

const parserCases = [
  // [name, body, expected partial]
  ['CRLF image body', IMAGE.replace(/\n/g, '\r\n'), { state: 'ready', kind: 'image' }],
  ['CR-only body', IMAGE.replace(/\n/g, '\r'), { state: 'ready', kind: 'image' }],
  ['body is only the section', '### Human Review:\n- Artifact: link\n- URL: https://example.com/x\n- Instruction: Look.\n', { state: 'ready', kind: 'link' }],
  ['two sections, last wins', `${IMAGE}\n\n### Human Review:\n- Artifact: link\n- URL: https://example.com/second\n- Instruction: Second wins.\n`, { state: 'ready', kind: 'link' }],
  ['two sections, last is malformed (last wins)', `${IMAGE}\n\n### Human Review:\n- Artifact: animation\n`, { state: 'malformed', reason: 'unknown_artifact' }],
  ['two sections, first is malformed, last ready', '### Human Review:\n- Artifact: animation\n\n### Human Review:\n- Artifact: link\n- URL: https://example.com/x\n- Instruction: Look.\n', { state: 'ready', kind: 'link' }],
  ['duplicate artifact', '### Human Review:\n- Artifact: image\n- Artifact: video\n- URL: https://example.com/a.png\n- Instruction: Look.\n', { state: 'malformed', reason: 'duplicate_field' }],
  ['duplicate url', '### Human Review:\n- Artifact: link\n- URL: https://example.com/a\n- URL: https://example.com/b\n- Instruction: Look.\n', { state: 'malformed', reason: 'duplicate_field' }],
  ['duplicate instruction', '### Human Review:\n- Artifact: link\n- URL: https://example.com/a\n- Instruction: A\n- Instruction: B\n', { state: 'malformed', reason: 'duplicate_field' }],
  ['fenced heading', '```\n### Human Review:\n- Artifact: image\n- URL: https://example.com/a.png\n- Instruction: Look.\n```\n', { state: 'missing', reason: 'no_section' }],
  ['indented heading', '    ### Human Review:\n    - Artifact: image\n', { state: 'missing', reason: 'no_section' }],
  ['heading with trailing prose', '### Human Review: please\n- Artifact: link\n- URL: https://example.com/x\n- Instruction: Look.\n', { state: 'missing', reason: 'no_section' }],
  ['heading level 1', '# Human Review:\n- Artifact: link\n- URL: https://example.com/x\n- Instruction: Look.\n', { state: 'ready', kind: 'link' }],
  ['heading level 6 lowercase no colon', '###### human review\n- Artifact: link\n- URL: https://example.com/x\n- Instruction: Look.\n', { state: 'ready', kind: 'link' }],
  ['fields after subheading ignored', '### Human Review:\n#### Details\n- Artifact: link\n- URL: https://example.com/x\n- Instruction: Look.\n', { state: 'malformed', reason: 'no_artifact' }],
  ['fields before heading ignored', '- Artifact: link\n- URL: https://example.com/x\n- Instruction: Look.\n\n### Human Review:\n- Artifact: image\n- URL: https://example.com/a.png\n- Instruction: Look.\n', { state: 'ready', kind: 'image' }],
  ['javascript URL', '### Human Review:\n- Artifact: link\n- URL: javascript:alert(1)\n- Instruction: Look.\n', { state: 'malformed', reason: 'invalid_url' }],
  ['data URL', '### Human Review:\n- Artifact: image\n- URL: data:image/png;base64,AAAA\n- Instruction: Look.\n', { state: 'malformed', reason: 'invalid_url' }],
  ['relative URL', '### Human Review:\n- Artifact: link\n- URL: /preview/login\n- Instruction: Look.\n', { state: 'malformed', reason: 'invalid_url' }],
  ['protocol-relative URL', '### Human Review:\n- Artifact: link\n- URL: //example.com/x\n- Instruction: Look.\n', { state: 'malformed', reason: 'invalid_url' }],
  ['https with no host', '### Human Review:\n- Artifact: link\n- URL: https://\n- Instruction: Look.\n', { state: 'malformed', reason: 'invalid_url' }],
  ['uppercase HTTPS', '### Human Review:\n- Artifact: image\n- URL: HTTPS://example.com/a.png\n- Instruction: Look.\n', { state: 'ready', kind: 'image' }],
  ['http image refused', '### Human Review:\n- Artifact: image\n- URL: http://example.com/a.png\n- Instruction: Look.\n', { state: 'malformed', reason: 'insecure_url' }],
  ['http link allowed', '### Human Review:\n- Artifact: link\n- URL: http://example.com/x\n- Instruction: Look.\n', { state: 'ready', kind: 'link' }],
  ['http video allowed', '### Human Review:\n- Artifact: video\n- URL: http://example.com/x.mp4\n- Instruction: Look.\n', { state: 'ready', kind: 'video' }],
  ['URL with quote refused', '### Human Review:\n- Artifact: link\n- URL: https://example.com/"><script>\n- Instruction: Look.\n', { state: 'malformed', reason: 'invalid_url' }],
  ['URL with space refused', '### Human Review:\n- Artifact: link\n- URL: https://example.com/a b\n- Instruction: Look.\n', { state: 'malformed', reason: 'invalid_url' }],
  ['URL with userinfo and port accepted', '### Human Review:\n- Artifact: link\n- URL: https://user:pass@example.com:8443/x?y=1#z\n- Instruction: Look.\n', { state: 'ready', kind: 'link' }],
  ['instruction 200 chars ready', `### Human Review:\n- Artifact: link\n- URL: https://example.com/x\n- Instruction: ${'x'.repeat(200)}\n`, { state: 'ready' }],
  ['instruction 201 chars refused', `### Human Review:\n- Artifact: link\n- URL: https://example.com/x\n- Instruction: ${'x'.repeat(201)}\n`, { state: 'malformed', reason: 'long_instruction' }],
  ['URL 2048 chars ready', `### Human Review:\n- Artifact: link\n- URL: https://example.com/${'a'.repeat(2048 - 'https://example.com/'.length)}\n- Instruction: Look.\n`, { state: 'ready' }],
  ['URL 2049 chars refused', `### Human Review:\n- Artifact: link\n- URL: https://example.com/${'a'.repeat(2049 - 'https://example.com/'.length)}\n- Instruction: Look.\n`, { state: 'malformed', reason: 'invalid_url' }],
  ['kind uppercase', '### Human Review:\n- Artifact: IMAGE\n- URL: https://example.com/a.png\n- Instruction: Look.\n', { state: 'ready', kind: 'image' }],
  ['field name uppercase', '### Human Review:\n- ARTIFACT: link\n- URL: https://example.com/x\n- INSTRUCTION: Look.\n', { state: 'ready', kind: 'link' }],
  ['markdown instruction is data', '### Human Review:\n- Artifact: link\n- URL: https://example.com/x\n- Instruction: **Bold** <img src=x onerror=alert(1)>\n', { state: 'ready', instruction: '**Bold** <img src=x onerror=alert(1)>' }],
  ['question with presets', QUESTION, { state: 'ready', kind: 'question' }],
  ['question without presets', '### Open Questions:\n- [ ] Is the wording right?\n\n### Human Review:\n- Artifact: question\n', { state: 'ready', kind: 'question', options: 0 }],
  ['question already answered', QUESTION.replace('- [ ]', '- [x]'), { state: 'settled', reason: 'question_answered' }],
  ['question with no Open Questions', '### Human Review:\n- Artifact: question\n', { state: 'malformed', reason: 'missing_question' }],
  ['question ignores a javascript URL', '### Open Questions:\n- [ ] Pick.\n\n### Human Review:\n- Artifact: question\n- URL: javascript:alert(1)\n', { state: 'ready', kind: 'question' }],
  ['question with prose only (not a checklist)', '### Open Questions:\nIs the wording right?\n\n### Human Review:\n- Artifact: question\n', { state: 'malformed', reason: 'missing_question' }],
  ['no artifact line', '### Human Review:\n- Instruction: Look.\n', { state: 'malformed', reason: 'no_artifact' }],
  ['unknown artifact', '### Human Review:\n- Artifact: animation\n', { state: 'malformed', reason: 'unknown_artifact' }],
  ['missing url', '### Human Review:\n- Artifact: image\n- Instruction: Look.\n', { state: 'malformed', reason: 'missing_url' }],
  ['missing instruction', '### Human Review:\n- Artifact: image\n- URL: https://example.com/a.png\n', { state: 'malformed', reason: 'missing_instruction' }],
  ['empty instruction', '### Human Review:\n- Artifact: image\n- URL: https://example.com/a.png\n- Instruction:   \n', { state: 'malformed', reason: 'missing_instruction' }],
  ['empty body', '', { state: 'missing', reason: 'no_section' }],
  ['null body', null, { state: 'missing', reason: 'no_section' }],
];

for (const [name, body, expected] of parserCases) {
  const parsed = parseHumanReview(body);
  const ok = Object.entries(expected).every(([key, value]) => {
    if (key === 'options') return (parsed.question?.options?.length ?? 0) === value;
    return parsed[key] === value;
  });
  check('parser', name, ok, {
    expected,
    actual: { state: parsed.state, kind: parsed.kind, reason: parsed.reason, url: parsed.url, instructionLength: parsed.instruction?.length ?? null, options: parsed.question?.options?.length ?? 0 },
  });
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------
const noArtifact = '## Overview\n\nNothing to click.\n';
const malformed = '### Human Review:\n- Artifact: image\n- URL: javascript:alert(1)\n- Instruction: Look.\n';
const questionNoPresets = '### Open Questions:\n- [ ] Is the wording right?\n\n### Human Review:\n- Artifact: question\n';

const issues = [
  makeIssue({ number: 10, body: noArtifact, state: 'closed', labels: ['status:needs-human'] }),
  makeIssue({ number: 11, body: IMAGE, state: 'closed', labels: ['status:needs-human'] }),
  makeIssue({ number: 12, body: noArtifact, labels: ['status:needs-human'] }),
  makeIssue({ number: 13, body: IMAGE, labels: ['status:needs-human'] }),
  makeIssue({ number: 14, body: '## Overview\n\n### Open Questions:\n- [ ] Pick a colour?\n  - Blue :: Calm\n  - Red :: Loud\n', labels: ['status:needs-human'] }),
  makeIssue({ number: 15, body: malformed, labels: ['status:needs-human', 'priority:high'] }),
  makeIssue({ number: 16, body: noArtifact, labels: ['status:todo'] }),
  makeIssue({ number: 17, body: IMAGE, labels: ['status:todo'] }),
  makeIssue({ number: 18, body: noArtifact, state: 'closed', labels: ['status:needs-human'] }),
  makeIssue({ number: 19, body: IMAGE, labels: ['status:needs-human'] }),
  makeIssue({ number: 20, body: malformed, labels: ['status:needs-human'] }),
  makeIssue({ number: 21, body: QUESTION, labels: ['status:needs-human'] }),
  makeIssue({ number: 22, body: questionNoPresets, labels: ['status:needs-human'] }),
  makeIssue({ number: 23, body: IMAGE, labels: ['status:done'] }),
  makeIssue({ number: 24, body: QUESTION, labels: ['status:done'] }),
  makeIssue({ number: 25, body: IMAGE, labels: ['status:in-review'] }),
  makeIssue({ number: 26, body: QUESTION, labels: ['status:in-review'] }),
  makeIssue({ number: 27, body: IMAGE, labels: ['status:needs-human'] }),
  makeIssue({ number: 28, body: noArtifact, labels: ['status:todo'] }),
  makeIssue({ number: 29, body: IMAGE, labels: ['status:needs-human'], state: 'closed' }),
  makeIssue({ number: 30, body: noArtifact, labels: ['status:todo'] }),
  makeIssue({ number: 31, body: IMAGE, labels: ['status:needs-human'] }),
  makeIssue({ number: 32, body: noArtifact, labels: ['status:todo'] }),
  makeIssue({ number: 33, body: '## Overview\n\n### Open Questions:\n- [ ] Pick.\n', labels: ['status:todo'] }),
];

const fake = await startFakeGitHub({ token: SYNTHETIC_TOKEN, issues });
const board = await startBoard(fake, { config: browserConfig(fake, {}) });
try {
  const session = new HttpSession(board.url);
  await session.login();
  const read = async (number) => (await session.request(`/api/issues/${number}`)).json.issue;
  const writes = () => fake.requests.filter((request) => request.method !== 'GET');
  const writeCount = () => writes().length;
  const stored = (number) => fake.issues.find((issue) => issue.number === number);

  async function route(name, fn, expect) {
    const before = writeCount();
    let response;
    try {
      response = await fn();
    } catch (error) {
      check('routes', name, false, { threw: String(error) });
      return null;
    }
    const writesMade = writeCount() - before;
    const detail = { status: response?.status, error: response?.json?.error, writes: writesMade };
    let ok = true;
    if (expect.status !== undefined) ok = ok && response?.status === expect.status;
    if (expect.error !== undefined) ok = ok && response?.json?.error === expect.error;
    if (expect.writes !== undefined) ok = ok && writesMade === expect.writes;
    check('routes', name, ok, { ...detail, expect });
    return response;
  }

  // 1. Creation in the waiting state.
  await route('create needs-human with no artifact', () => session.request('/api/issues', {
    method: 'POST', body: { title: 'Born waiting', body: noArtifact, labels: ['status:needs-human'] },
  }), { status: 400, error: 'human_review_required', writes: 0 });

  await route('create needs-human with no body', () => session.request('/api/issues', {
    method: 'POST', body: { title: 'Born waiting', labels: ['status:needs-human'] },
  }), { status: 400, error: 'human_review_required', writes: 0 });

  await route('create needs-human with a malformed artifact', () => session.request('/api/issues', {
    method: 'POST', body: { title: 'Born waiting', body: malformed, labels: ['status:needs-human'] },
  }), { status: 400, error: 'human_review_required', writes: 0 });

  const created = await route('create needs-human with a ready image artifact', () => session.request('/api/issues', {
    method: 'POST', body: { title: 'Born gated', body: IMAGE, labels: ['status:needs-human'] },
  }), { status: 201 });
  check('routes', 'created gated issue is actually waiting with a ready artifact',
    created?.json?.issue?.statusLabel === 'status:needs-human' && created?.json?.issue?.humanReview?.state === 'ready',
    { statusLabel: created?.json?.issue?.statusLabel, humanReview: created?.json?.issue?.humanReview?.state });

  const createdNoPresets = await route('create needs-human with a question artifact with no preset answers', () => session.request('/api/issues', {
    method: 'POST', body: { title: 'Born typed', body: questionNoPresets, labels: ['status:needs-human'] },
  }), { status: 201 });
  check('routes', 'question gate with no presets is accepted as ready (needs typing, not clicking)',
    createdNoPresets?.json?.issue?.humanReview?.state === 'ready' && (createdNoPresets?.json?.issue?.humanReview?.question?.options?.length ?? 0) === 0,
    { humanReview: createdNoPresets?.json?.issue?.humanReview });

  // 2. Status routes.
  await route('POST /status needs-human with no artifact', async () => {
    const current = await read(16);
    return session.request('/api/issues/16/status', { method: 'POST', body: { status: 'status:needs-human', fingerprint: current.fingerprint } });
  }, { status: 400, error: 'human_review_required', writes: 0 });
  check('routes', 'status refusal left the issue in status:todo', (await read(16)).statusLabel === 'status:todo', { statusLabel: (await read(16)).statusLabel });

  await route('PATCH status needs-human with a malformed artifact', async () => {
    const current = await read(20);
    return session.request('/api/issues/20', { method: 'PATCH', body: { status: 'status:needs-human', fingerprint: current.fingerprint } });
  }, { status: 400, error: 'human_review_required', writes: 0 });

  await route('PATCH status needs-human with a settled question', async () => {
    const current = await read(33);
    return session.request('/api/issues/33', { method: 'PATCH', body: { status: 'status:needs-human', fingerprint: current.fingerprint } });
  }, { status: 400, error: 'human_review_required', writes: 0 });

  await route('qualified multi-repo status route with no artifact', async () => {
    const current = await read(32);
    return session.request('/api/repos/owner/repo/issues/32/status', { method: 'POST', body: { status: 'status:needs-human', fingerprint: current.fingerprint } });
  }, { status: 400, error: 'human_review_required', writes: 0 });

  await route('PATCH status needs-human with a ready artifact', async () => {
    const current = await read(17);
    return session.request('/api/issues/17', { method: 'PATCH', body: { status: 'status:needs-human', fingerprint: current.fingerprint } });
  }, { status: 200, writes: 1 });

  // 3. Reopen paths.
  await route('generic PATCH state open on a closed waiting task with no artifact', async () => {
    const current = await read(18);
    return session.request('/api/issues/18', { method: 'PATCH', body: { fingerprint: current.fingerprint, state: 'open' } });
  }, { status: 400, error: 'human_review_required', writes: 0 });
  check('routes', 'refused reopen left the issue closed', stored(18).state === 'closed', { state: stored(18).state });

  await route('generic PATCH state open + status needs-human on a closed task with no artifact', async () => {
    const current = await read(10);
    return session.request('/api/issues/10', { method: 'PATCH', body: { fingerprint: current.fingerprint, state: 'open', status: 'status:needs-human' } });
  }, { status: 400, error: 'human_review_required', writes: 0 });

  await route('dedicated /reopen on a closed waiting task with no artifact', async () => {
    const current = await read(10);
    return session.request('/api/issues/10/reopen', { method: 'POST', body: { fingerprint: current.fingerprint } });
  }, { status: 200 });
  check('routes', '/reopen moved the legacy task to backlog, not back to waiting', (await read(10)).statusLabel === 'status:backlog', { statusLabel: (await read(10)).statusLabel });

  await route('close a closed waiting task again is refused as unchanged', async () => {
    const current = await read(10);
    return session.request('/api/issues/10', { method: 'PATCH', body: { fingerprint: current.fingerprint, state: 'closed' } });
  }, { status: 200 });

  // 4. Label paths.
  await route('remove a non-status label on a waiting task with a malformed gate', async () => {
    const current = await read(15);
    return session.request('/api/issues/15/labels/remove', { method: 'POST', body: { fingerprint: current.fingerprint, label: 'priority:high' } });
  }, { status: 200 });

  await route('remove status:needs-human on a legacy waiting task', async () => {
    const current = await read(12);
    return session.request('/api/issues/12/labels/remove', { method: 'POST', body: { fingerprint: current.fingerprint, label: 'status:needs-human' } });
  }, { status: 200 });
  check('routes', 'removing the waiting label leaves the task with no status, not waiting', (await read(12)).statusLabel === null, { statusLabel: (await read(12)).statusLabel });

  // 5. Body edits.
  await route('body edit removes a ready gate from an open waiting task', async () => {
    const current = await read(19);
    return session.request('/api/issues/19', { method: 'PATCH', body: { fingerprint: current.fingerprint, body: '## Overview\n\nRemoved.\n' } });
  }, { status: 400, error: 'human_review_required', writes: 0 });
  check('routes', 'the refused body edit left the stored body untouched', /### Human Review:/.test(stored(19).body), { bodyHasGate: /### Human Review:/.test(stored(19).body) });

  await route('body edit replaces a ready gate with a malformed one', async () => {
    const current = await read(27);
    return session.request('/api/issues/27', { method: 'PATCH', body: { fingerprint: current.fingerprint, body: malformed } });
  }, { status: 400, error: 'human_review_required', writes: 0 });

  await route('body edit replaces a ready gate with a settled question', async () => {
    const current = await read(27);
    return session.request('/api/issues/27', { method: 'PATCH', body: { fingerprint: current.fingerprint, body: QUESTION.replace('- [ ]', '- [x]') } });
  }, { status: 400, error: 'human_review_required', writes: 0 });

  await route('body edit preserves a ready gate', async () => {
    const current = await read(27);
    return session.request('/api/issues/27', { method: 'PATCH', body: { fingerprint: current.fingerprint, body: current.body.replace('Review.', 'Review updated.') } });
  }, { status: 200 });

  await route('section editor cannot target Human Review', async () => {
    const current = await read(27);
    return session.request('/api/issues/27/section', { method: 'PUT', body: { fingerprint: current.fingerprint, sectionId: 'human-review', text: 'gone' } });
  }, { status: 400, error: 'invalid_edit', writes: 0 });

  await route('section edit that injects a broken Human Review heading on a waiting task', async () => {
    const current = await read(27);
    return session.request('/api/issues/27/section', { method: 'PUT', body: { fingerprint: current.fingerprint, sectionId: 'overview', text: 'Review.\n\n### Human Review:\n' } });
  }, { status: 400, error: 'human_review_required', writes: 0 });

  await route('body edit on a closed waiting task may remove the gate', async () => {
    const current = await read(29);
    return session.request('/api/issues/29', { method: 'PATCH', body: { fingerprint: current.fingerprint, body: '## Overview\n\nRemoved while closed.\n' } });
  }, { status: 200 });
  await route('reopening after that closed body edit is refused', async () => {
    const current = await read(29);
    return session.request('/api/issues/29', { method: 'PATCH', body: { fingerprint: current.fingerprint, state: 'open' } });
  }, { status: 400, error: 'human_review_required', writes: 0 });

  // 6. Question answer paths.
  const answered = await route('answer the gated question on a waiting task', async () => {
    const current = await read(21);
    return session.request('/api/issues/21/questions/0/answer', { method: 'POST', body: { fingerprint: current.fingerprint, answer: 'Comfortable' } });
  }, { status: 200 });
  check('routes', 'answering the gated question moves the task to in-progress and settles the gate',
    answered?.json?.issue?.statusLabel === 'status:in-progress' && answered?.json?.issue?.humanReview?.state === 'settled',
    { statusLabel: answered?.json?.issue?.statusLabel, humanReview: answered?.json?.issue?.humanReview?.state });

  const answeredDone = await route('answer a gated question on a task that is NOT waiting (status:done)', async () => {
    const current = await read(24);
    return session.request('/api/issues/24/questions/0/answer', { method: 'POST', body: { fingerprint: current.fingerprint, answer: 'Comfortable' } });
  }, { status: 200 });
  check('routes', 'answering a gated question on a done task does NOT steal the done status',
    answeredDone?.json?.issue?.statusLabel === 'status:done',
    { statusLabel: answeredDone?.json?.issue?.statusLabel, note: 'a done task with a ready question gate is flipped to in-progress by the F2 fix' });

  const answeredReview = await route('answer a gated question on an in-review task', async () => {
    const current = await read(26);
    return session.request('/api/issues/26/questions/0/answer', { method: 'POST', body: { fingerprint: current.fingerprint, answer: 'Comfortable' } });
  }, { status: 200 });
  check('routes', 'answering a gated question on an in-review task does NOT steal the in-review status',
    answeredReview?.json?.issue?.statusLabel === 'status:in-review',
    { statusLabel: answeredReview?.json?.issue?.statusLabel });

  await route('answer a non-gated question while an image gate waits', async () => {
    const current = await read(23);
    return session.request('/api/issues/23/questions/0/answer', { method: 'POST', body: { fingerprint: current.fingerprint, answer: 'Blue' } });
  }, { status: 400 });

  await route('answer a question on a legacy waiting task with no gate', async () => {
    const current = await read(14);
    return session.request('/api/issues/14/questions/0/answer', { method: 'POST', body: { fingerprint: current.fingerprint, answer: 'Blue' } });
  }, { status: 200 });
  check('routes', 'answering on a legacy waiting task leaves it waiting with nothing to click (limitation F5)',
    (await read(14)).statusLabel === 'status:needs-human' && (await read(14)).humanReview.state === 'missing',
    { statusLabel: (await read(14)).statusLabel, humanReview: (await read(14)).humanReview.state });

  // 7. External writers: a tool outside the board adds the waiting label, or
  //    edits the body on GitHub. The board cannot refuse a write it never sees.
  {
    const external = stored(30);
    external.labels.push({ name: 'status:needs-human', color: 'ededed' });
    const detail = await read(30);
    const row = (await session.request('/api/board')).json.issues.find((issue) => issue.number === 30);
    check('routes', 'external waiting label is presented honestly, not as a silent wait',
      detail.statusLabel === 'status:needs-human' && detail.humanReview.state === 'missing' && detail.humanReview.reason === 'no_section' && row?.column === 'needs-human',
      { statusLabel: detail.statusLabel, state: detail.humanReview.state, reason: detail.humanReview.reason, column: row?.column });
    // Recoverable? The drawer status control is the way out; prove the write works.
    const escaped = await session.request('/api/issues/30/status', { method: 'POST', body: { status: 'status:in-progress', fingerprint: detail.fingerprint } });
    check('routes', 'a legacy waiting task can be moved out of waiting by the reader', escaped.status === 200 && (await read(30)).statusLabel === 'status:in-progress',
      { status: escaped.status, statusLabel: (await read(30)).statusLabel });
  }

  {
    const external = stored(31);
    external.body = '## Overview\n\nEdited on GitHub, section removed.\n';
    external.updated_at = new Date().toISOString();
    const detail = await read(31);
    check('routes', 'external body edit that removes the gate is reported as missing, not as ready',
      detail.humanReview.state === 'missing' && detail.humanReview.reason === 'no_section',
      { state: detail.humanReview.state, reason: detail.humanReview.reason, statusLabel: detail.statusLabel });
  }

  // 8. Blast radius: a waiting task still accepts the ordinary board writes it
  //    needs (close, label, note) and refuses nothing it should accept.
  await route('close a waiting task with a ready gate', async () => {
    const current = await read(13);
    return session.request('/api/issues/13', { method: 'PATCH', body: { fingerprint: current.fingerprint, state: 'closed' } });
  }, { status: 200 });
} finally {
  await board.app.close();
  await fake.close();
}

console.log(JSON.stringify(out, null, 2));
if (out.failures.length) {
  console.error(`FAILURES ${out.failures.length}`);
  for (const failure of out.failures) console.error(`- ${failure.group}: ${failure.name}`);
  process.exitCode = 1;
} else {
  console.error('all attack checks passed');
}
