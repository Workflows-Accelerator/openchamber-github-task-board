// V4-3-L4-delta: targeted probe for the F1-F4 corrections.
// Written by the independent reviewer of the delta, not by the authors.
// Synthetic fake GitHub only, local board only, no real GitHub call.
//
//   node scripts/delta.mjs

import { parseHumanReview } from '../../../../../../web/server/board.ts';
import { startFakeGitHub, makeIssue } from '../../../../../../web/tests/fake-github.mjs';
import { startBoard, browserConfig, HttpSession, SYNTHETIC_TOKEN } from '../../../../../../web/tests/helpers.mjs';

const out = { parser: [], routes: [], failures: [] };
const check = (group, name, ok, detail) => {
  out[group].push({ name, ok, ...detail });
  if (!ok) out.failures.push({ group, name, ...detail });
};

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
const NO_PRESETS = '### Open Questions:\n- [ ] Is the wording right?\n\n### Human Review:\n- Artifact: question\n';

// ---------------------------------------------------------------------------
// F4: is the new invalid_url sentence accurate for each refusal it covers?
// ---------------------------------------------------------------------------
const longUrl = 'https://example.com/' + 'a'.repeat(2049 - 'https://example.com/'.length);
const urlCases = [
  ['too long (2049)', longUrl, /2048/, /no spaces/],
  ['with a space', 'https://example.com/a b', /2048/, /no spaces/],
  ['relative', '/preview/login', /http:\/\/ or https:\/\/ link/, /2048/],
  ['javascript:', 'javascript:alert(1)', /http:\/\/ or https:\/\/ link/, /2048/],
  ['data:', 'data:image/png;base64,AAAA', /http:\/\/ or https:\/\/ link/, /2048/],
  ['https with no host', 'https://', /http:\/\/ or https:\/\/ link/, /2048/],
  ['with a double quote', 'https://example.com/"><script>', /http:\/\/ or https:\/\/ link/, /2048/],
  ['with a backslash', 'https://example.com/a\\b', /http:\/\/ or https:\/\/ link/, /2048/],
];
for (const [name, url, scheme, length] of urlCases) {
  const parsed = parseHumanReview(`### Human Review:\n- Artifact: link\n- URL: ${url}\n- Instruction: Look.\n`);
  const ok = parsed.state === 'malformed' && parsed.reason === 'invalid_url'
    && scheme.test(parsed.message) && length.test(parsed.message);
  check('parser', `invalid_url message: ${name}`, ok, { state: parsed.state, reason: parsed.reason, message: parsed.message });
}
{
  const okUrl = 'https://example.com/' + 'a'.repeat(2048 - 'https://example.com/'.length);
  const parsed = parseHumanReview(`### Human Review:\n- Artifact: link\n- URL: ${okUrl}\n- Instruction: Look.\n`);
  check('parser', 'invalid_url: 2048 is still ready', parsed.state === 'ready', { state: parsed.state, reason: parsed.reason });
}

// ---------------------------------------------------------------------------
// F3: the preset rule at the parser level.
// ---------------------------------------------------------------------------
{
  const parsed = parseHumanReview(NO_PRESETS);
  check('parser', 'preset-less question is malformed/missing_options',
    parsed.state === 'malformed' && parsed.reason === 'missing_options', { state: parsed.state, reason: parsed.reason, message: parsed.message });
  check('parser', 'the missing_options message names the preset line',
    /preset/.test(parsed.message) && /::/.test(parsed.message), { message: parsed.message });
}
{
  const onePreset = NO_PRESETS.replace('- [ ] Is the wording right?', '- [ ] Is the wording right?\n  - Yes :: Keep it :: Reads well.');
  const parsed = parseHumanReview(onePreset);
  check('parser', 'one preset line is enough',
    parsed.state === 'ready' && parsed.question?.options?.length === 1, { state: parsed.state, options: parsed.question?.options?.length });
}
{
  // The free-text path is a client path, but the parser must not treat an
  // answer that is not one of the presets as invalid.
  const answeredFreeText = QUESTION.replace('- [ ]', '- [x]').replace('Which spacing should the list use?', 'Which spacing should the list use?\n  > Custom: 17px');
  const parsed = parseHumanReview(answeredFreeText);
  check('parser', 'a question answered with free text reads settled',
    parsed.state === 'settled', { state: parsed.state, reason: parsed.reason });
}

// ---------------------------------------------------------------------------
// Routes.
// ---------------------------------------------------------------------------
const statuses = ['status:done', 'status:in-review', 'status:todo', 'status:in-progress'];
const issues = [
  ...statuses.map((status, offset) => makeIssue({ number: 50 + offset, body: QUESTION, labels: [status] })),
  makeIssue({ number: 54, body: QUESTION, labels: ['status:needs-human'] }),
  makeIssue({ number: 55, body: NO_PRESETS, labels: ['status:needs-human'] }),
  makeIssue({ number: 56, body: NO_PRESETS, labels: ['status:todo'] }),
  makeIssue({ number: 57, body: QUESTION, labels: ['status:needs-human'] }),
  // Delta: a live waiting issue whose gate is later edited on GitHub.
  makeIssue({ number: 58, body: IMAGE, labels: ['status:needs-human'] }),
  // Delta (F3): a closed waiting task whose gate has no presets.
  makeIssue({ number: 59, body: NO_PRESETS, state: 'closed', labels: ['status:needs-human'] }),
];

const fake = await startFakeGitHub({ token: SYNTHETIC_TOKEN, issues });
const board = await startBoard(fake, { config: browserConfig(fake, {}) });
try {
  const session = new HttpSession(board.url);
  await session.login();
  const read = async (number) => (await session.request(`/api/issues/${number}`)).json.issue;
  const writes = () => fake.requests.filter((request) => request.method !== 'GET');
  const stored = (number) => fake.issues.find((issue) => issue.number === number);

  async function route(name, fn, expect) {
    const before = writes().length;
    let response;
    try {
      response = await fn();
    } catch (error) {
      check('routes', name, false, { threw: String(error) });
      return null;
    }
    const writesMade = writes().length - before;
    let ok = true;
    if (expect.status !== undefined) ok = ok && response?.status === expect.status;
    if (expect.error !== undefined) ok = ok && response?.json?.error === expect.error;
    if (expect.writes !== undefined) ok = ok && writesMade === expect.writes;
    check('routes', name, ok, { status: response?.status, error: response?.json?.error, message: response?.json?.message, writes: writesMade, expect });
    return response;
  }

  const answer = async (number, value = 'Comfortable') => {
    const current = await read(number);
    return session.request(`/api/issues/${number}/questions/0/answer`, {
      method: 'POST', body: { answer: value, fingerprint: current.fingerprint },
    });
  };

  // F1: five statuses, answered through the real route.
  for (let offset = 0; offset < statuses.length; offset += 1) {
    const number = 50 + offset;
    const labelsBefore = stored(number).labels.map((label) => label.name);
    const response = await answer(number);
    const detail = response.json?.issue;
    check('routes', `answer on ${statuses[offset]} keeps the status and settles the gate`,
      response.status === 200 && detail?.statusLabel === statuses[offset] && detail?.humanReview?.state === 'settled'
        && JSON.stringify(stored(number).labels.map((label) => label.name)) === JSON.stringify(labelsBefore),
      { status: response.status, statusLabel: detail?.statusLabel, humanReview: detail?.humanReview?.state, labelsBefore, labelsAfter: stored(number).labels.map((label) => label.name) });
  }
  {
    const response = await answer(54);
    const row = (await session.request('/api/board?refresh=1')).json.issues.find((issue) => issue.number === 54);
    check('routes', 'answer on a waiting task moves it to in-progress and leaves the waiting column',
      response.status === 200 && response.json?.issue?.statusLabel === 'status:in-progress'
        && !stored(54).labels.some((label) => label.name === 'status:needs-human')
        && response.json?.issue?.humanReview?.state === 'settled'
        && row?.column === 'in-progress',
      { statusLabel: response.json?.issue?.statusLabel, humanReview: response.json?.issue?.humanReview?.state, column: row?.column });
  }

  // F3: the status route, the body edit, and the external edit.
  await route('status route refuses a preset-less question gate', async () => {
    const current = await read(56);
    return session.request('/api/issues/56', { method: 'PATCH', body: { status: 'status:needs-human', fingerprint: current.fingerprint } });
  }, { status: 400, error: 'human_review_required', writes: 0 });
  check('routes', 'the refused status write left the task in status:todo', (await read(56)).statusLabel === 'status:todo', { statusLabel: (await read(56)).statusLabel });

  await route('body edit replaces a ready gate with a preset-less question gate', async () => {
    const current = await read(57);
    return session.request('/api/issues/57', { method: 'PATCH', body: { fingerprint: current.fingerprint, body: NO_PRESETS } });
  }, { status: 400, error: 'human_review_required', writes: 0 });
  check('routes', 'the refused body edit left the stored body untouched', /Compact ::/.test(stored(57).body), { hasPresets: /Compact ::/.test(stored(57).body) });

  await route('body edit that keeps presets is allowed', async () => {
    const current = await read(57);
    return session.request('/api/issues/57', { method: 'PATCH', body: { fingerprint: current.fingerprint, body: current.body.replace('Pick one.', 'Pick one, please.') } });
  }, { status: 200, writes: 1 });

  // A live issue edited on GitHub: the board can only report it honestly.
  {
    const external = stored(55);
    check('routes', 'a waiting issue whose gate has no presets reads malformed/missing_options',
      (await read(55)).humanReview.state === 'malformed' && (await read(55)).humanReview.reason === 'missing_options'
        && (await read(55)).statusLabel === 'status:needs-human',
      { humanReview: (await read(55)).humanReview, statusLabel: (await read(55)).statusLabel });
    const row = (await session.request('/api/board?refresh=1')).json.issues.find((issue) => issue.number === 55);
    check('routes', 'that card stays in the waiting column and says it is malformed',
      row?.column === 'needs-human' && row?.humanReview?.state === 'malformed',
      { column: row?.column, humanReview: row?.humanReview?.state });
    check('routes', 'the question is still listed as an open question (answerable surface)',
      (await read(55)).openQuestions.some((question) => !question.completed),
      { openQuestions: (await read(55)).openQuestions });
    const answered = await answer(55, 'Yes, keep it');
    const after = await read(55);
    check('routes', 'answering that preset-less question is accepted and settles it',
      answered.status === 200 && after.humanReview.state === 'settled',
      { status: answered.status, state: after.humanReview.state, statusLabel: after.statusLabel, note: 'the task keeps status:needs-human; the reader must move it out' });
    check('routes', 'the settled preset-less card is not a dead end: the status control path still works',
      after.statusLabel === 'status:needs-human',
      { statusLabel: after.statusLabel });
    const escape = await session.request('/api/issues/55/status', {
      method: 'POST', body: { status: 'status:in-progress', fingerprint: after.fingerprint },
    });
    check('routes', 'the reader can move that task out of waiting after answering',
      escape.status === 200 && (await read(55)).statusLabel === 'status:in-progress',
      { status: escape.status, statusLabel: (await read(55)).statusLabel });
  }

  await route('reopening a closed task whose gate has no presets is refused', async () => {
    const current = await read(59);
    return session.request('/api/issues/59', { method: 'PATCH', body: { fingerprint: current.fingerprint, state: 'open' } });
  }, { status: 400, error: 'human_review_required', writes: 0 });
  check('routes', 'the refused reopen left the task closed', stored(59).state === 'closed', { state: stored(59).state });

  // F3: a live issue edited on GitHub, outside the board.
  {
    const external = stored(58);
    external.body = NO_PRESETS;
    external.updated_at = new Date().toISOString();
    const detail = await read(58);
    check('routes', 'an external body edit that removes the presets reads malformed/missing_options',
      detail.humanReview.state === 'malformed' && detail.humanReview.reason === 'missing_options' && detail.statusLabel === 'status:needs-human',
      { humanReview: detail.humanReview, statusLabel: detail.statusLabel });
    const row = (await session.request('/api/board?refresh=1')).json.issues.find((issue) => issue.number === 58);
    check('routes', 'the externally broken gate stays in the waiting column and is honest about it',
      row?.column === 'needs-human' && row?.humanReview?.state === 'malformed',
      { column: row?.column, humanReview: row?.humanReview?.state });
  }

  // F3: free text alongside presets.
  {
    const answered = await answer(57, 'Something else entirely');
    check('routes', 'a free-text answer that is not a preset is accepted',
      answered.status === 200 && answered.json?.issue?.humanReview?.state === 'settled',
      { status: answered.status, humanReview: answered.json?.issue?.humanReview?.state });
  }

  // F2: the precise refusal.
  {
    const before = fake.issues.length;
    const patchesBefore = fake.patchCalls.length;
    const writesBefore = fake.requests.filter((request) => request.method !== 'GET').length;
    const rejected = await session.request('/api/issues', {
      method: 'POST', body: { title: 'Two statuses', body: IMAGE, labels: ['status:todo', 'status:needs-human'] },
    });
    check('routes', 'F2 message names both labels and the one-status rule',
      rejected.status === 400 && /status:todo/.test(rejected.json?.message) && /status:needs-human/.test(rejected.json?.message) && /exactly one status label/.test(rejected.json?.message),
      { status: rejected.status, message: rejected.json?.message });
    check('routes', 'F2 refusal created nothing and made no write of any kind',
      fake.issues.length === before && fake.patchCalls.length === patchesBefore
        && fake.requests.filter((request) => request.method !== 'GET').length === writesBefore,
      { issuesBefore: before, issuesAfter: fake.issues.length, patchCallsBefore: patchesBefore, patchCallsAfter: fake.patchCalls.length, writesBefore, writesAfter: fake.requests.filter((request) => request.method !== 'GET').length });
    const accepted = await session.request('/api/issues', {
      method: 'POST', body: { title: 'Single waiting', body: QUESTION, labels: ['status:needs-human'] },
    });
    check('routes', 'F2 does not block a legitimate single-status waiting create with an artifact',
      accepted.status === 201 && accepted.json?.issue?.statusLabel === 'status:needs-human' && accepted.json?.issue?.humanReview?.state === 'ready',
      { status: accepted.status, statusLabel: accepted.json?.issue?.statusLabel, humanReview: accepted.json?.issue?.humanReview?.state });
  }
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
  console.error(`all delta checks passed (${out.parser.length} parser, ${out.routes.length} route)`);
}
