// V4-3 hostile review: parser edge cases and every server route that can
// produce a waiting card. Synthetic fake GitHub only, local board only.
//
// Run from the V4-3 directory:
//   node scripts/attack/parser-and-routes.mjs
//
// Output is data, not an assertion run: each case prints what actually
// happened so a defect can be fixed against the recorded behaviour.

import { parseHumanReview } from '../../../../../../../web/server/board.ts';
import { startFakeGitHub, makeIssue } from '../../../../../../../web/tests/fake-github.mjs';
import { startBoard, browserConfig, HttpSession, SYNTHETIC_TOKEN } from '../../../../../../../web/tests/helpers.mjs';

const results = { parser: [], routes: [] };
const record = (group, name, detail) => results[group].push({ name, ...detail });

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

// ---- Parser ---------------------------------------------------------------
const parserCases = [
  ['CRLF image body', IMAGE.replace(/\n/g, '\r\n'), { state: 'ready', kind: 'image' }],
  ['CRLF question body', QUESTION.replace(/\n/g, '\r\n'), { state: 'ready', kind: 'question' }],
  ['body is only the section', '### Human Review:\n- Artifact: link\n- URL: https://example.com/x\n- Instruction: Look.\n', { state: 'ready', kind: 'link' }],
  ['two sections, last wins', `${IMAGE}\n\n### Human Review:\n- Artifact: link\n- URL: https://example.com/second\n- Instruction: Second wins.\n`, { state: 'ready', kind: 'link' }],
  ['valid then invalid artifact (same section)', '### Human Review:\n- Artifact: image\n- Artifact: video\n- URL: https://example.com/a.png\n- Instruction: Look.\n', { state: 'malformed', reason: 'duplicate_field' }],
  ['valid then invalid URL (same section)', '### Human Review:\n- Artifact: image\n- URL: https://example.com/a.png\n- URL: javascript:alert(1)\n- Instruction: Look.\n', { state: 'malformed', reason: 'duplicate_field' }],
  ['fenced heading', '```\n### Human Review:\n- Artifact: image\n- URL: https://example.com/a.png\n- Instruction: Look.\n```\n', { state: 'missing', reason: 'no_section' }],
  ['fenced heading then real heading', '```\n### Human Review:\n- Artifact: image\n```\n\n### Human Review:\n- Artifact: link\n- URL: https://example.com/x\n- Instruction: Look.\n', { state: 'ready', kind: 'link' }],
  ['indented heading', '    ### Human Review:\n    - Artifact: image\n', { state: 'missing', reason: 'no_section' }],
  ['heading level 1', '# Human Review:\n- Artifact: link\n- URL: https://example.com/x\n- Instruction: Look.\n', { state: 'ready', kind: 'link' }],
  ['heading level 6, no colon, lowercase', '###### human review\n- Artifact: link\n- URL: https://example.com/x\n- Instruction: Look.\n', { state: 'ready', kind: 'link' }],
  ['URL with query and fragment', '### Human Review:\n- Artifact: link\n- URL: https://example.com/a?b=1&c=2#frag\n- Instruction: Look.\n', { state: 'ready', url: 'https://example.com/a?b=1&c=2#frag' }],
  ['javascript: URL', '### Human Review:\n- Artifact: link\n- URL: javascript:alert(1)\n- Instruction: Look.\n', { state: 'malformed', reason: 'invalid_url' }],
  ['data: URL', '### Human Review:\n- Artifact: image\n- URL: data:image/png;base64,AAAA\n- Instruction: Look.\n', { state: 'malformed', reason: 'invalid_url' }],
  ['http: image URL is refused because the board renders it inline', '### Human Review:\n- Artifact: image\n- URL: http://example.com/a.png\n- Instruction: Look.\n', { state: 'malformed', reason: 'insecure_url' }],
  ['instruction at 200', `### Human Review:\n- Artifact: image\n- URL: https://example.com/a.png\n- Instruction: ${'x'.repeat(200)}\n`, { state: 'ready' }],
  ['instruction at 201', `### Human Review:\n- Artifact: image\n- URL: https://example.com/a.png\n- Instruction: ${'x'.repeat(201)}\n`, { state: 'malformed', reason: 'long_instruction' }],
  ['URL at 2048', `### Human Review:\n- Artifact: link\n- URL: https://example.com/${'a'.repeat(2048 - 'https://example.com/'.length)}\n- Instruction: Look.\n`, { state: 'ready' }],
  ['URL at 2049', `### Human Review:\n- Artifact: link\n- URL: https://example.com/${'a'.repeat(2049 - 'https://example.com/'.length)}\n- Instruction: Look.\n`, { state: 'malformed', reason: 'invalid_url' }],
  ['artifact kind uppercase', '### Human Review:\n- Artifact: IMAGE\n- URL: https://example.com/a.png\n- Instruction: Look.\n', { state: 'ready', kind: 'image' }],
  ['artifact kind mixed case', '### Human Review:\n- Artifact: Link\n- URL: https://example.com/x\n- Instruction: Look.\n', { state: 'ready', kind: 'link' }],
  ['instruction with Markdown', '### Human Review:\n- Artifact: link\n- URL: https://example.com/x\n- Instruction: **Bold** <img src=x onerror=alert(1)> `code`\n', { state: 'ready', instruction: '**Bold** <img src=x onerror=alert(1)> `code`' }],
  ['question with javascript: URL is silently accepted', '### Open Questions:\n- [ ] Pick.\n\n### Human Review:\n- Artifact: question\n- URL: javascript:alert(1)\n', { state: 'ready', kind: 'question' }],
  ['answered question is settled', QUESTION.replace('- [ ]', '- [x]'), { state: 'settled', reason: 'question_answered' }],
  ['question artifact with no Open Questions', '### Human Review:\n- Artifact: question\n', { state: 'malformed', reason: 'missing_question' }],
  ['repeated URL field', '### Human Review:\n- Artifact: link\n- URL: https://example.com/a\n- URL: https://example.com/b\n- Instruction: Look.\n', { state: 'malformed', reason: 'duplicate_field' }],
  ['heading with trailing prose is not a section', '### Human Review: please\n- Artifact: link\n- URL: https://example.com/x\n- Instruction: Look.\n', { state: 'missing', reason: 'no_section' }],
  ['fields after a subheading are ignored', '### Human Review:\n#### Details\n- Artifact: link\n- URL: https://example.com/x\n- Instruction: Look.\n', { state: 'malformed', reason: 'no_artifact' }],
];

for (const [name, body, expected] of parserCases) {
  const parsed = parseHumanReview(body);
  const ok = Object.entries(expected).every(([key, value]) => parsed[key] === value);
  record('parser', name, {
    ok,
    expected,
    actual: { state: parsed.state, kind: parsed.kind, reason: parsed.reason, url: parsed.url, instructionLength: parsed.instruction?.length ?? null },
  });
}

// ---- Routes ---------------------------------------------------------------
const noArtifactBody = '## Overview\n\nNothing to click.\n';
const malformedBody = '### Human Review:\n- Artifact: image\n- URL: javascript:alert(1)\n- Instruction: Look.\n';
const issues = [
  makeIssue({ number: 10, title: 'Closed waiting without artifact', body: noArtifactBody, state: 'closed', labels: ['status:needs-human'] }),
  makeIssue({ number: 11, title: 'Closed waiting with artifact', body: IMAGE, state: 'closed', labels: ['status:needs-human'] }),
  makeIssue({ number: 12, title: 'Open waiting without artifact', body: noArtifactBody, labels: ['status:needs-human'] }),
  makeIssue({ number: 13, title: 'Open waiting with artifact', body: IMAGE, labels: ['status:needs-human'] }),
  makeIssue({ number: 14, title: 'Waiting, open question, no gate', body: '## Overview\n\n### Open Questions:\n- [ ] Pick a colour?\n  - Blue :: Calm\n  - Red :: Loud\n', labels: ['status:needs-human'] }),
  makeIssue({ number: 15, title: 'Waiting, malformed gate, priority label', body: malformedBody, labels: ['status:needs-human', 'priority:high'] }),
  makeIssue({ number: 16, title: 'Todo without artifact', body: noArtifactBody, labels: ['status:todo'] }),
  makeIssue({ number: 17, title: 'Todo with artifact', body: IMAGE, labels: ['status:todo'] }),
  makeIssue({ number: 18, title: 'Closed waiting without artifact, reopen via patch', body: noArtifactBody, state: 'closed', labels: ['status:needs-human'] }),
  makeIssue({ number: 19, title: 'Open waiting with artifact, body edit target', body: IMAGE, labels: ['status:needs-human'] }),
  makeIssue({ number: 20, title: 'Open waiting, malformed gate, http target', body: malformedBody, labels: ['status:needs-human'] }),
  makeIssue({ number: 30, title: 'Todo, no gate, external label target', body: noArtifactBody, labels: ['status:todo'] }),
  makeIssue({ number: 31, title: 'Waiting with gate, external body edit target', body: IMAGE, labels: ['status:needs-human'] }),
  makeIssue({ number: 32, title: 'Qualified route todo without artifact', body: noArtifactBody, labels: ['status:todo'] }),
];

const fake = await startFakeGitHub({ token: SYNTHETIC_TOKEN, issues });
const board = await startBoard(fake, { config: browserConfig(fake, {}) });
try {
  const session = new HttpSession(board.url);
  await session.login();
  const read = async (number) => (await session.request(`/api/issues/${number}`)).json.issue;
  const writes = () => fake.requests.filter((request) => request.method !== 'GET');

  // 1. Status entry with no artifact.
  {
    const current = await read(16);
    const before = writes().length;
    const response = await session.request('/api/issues/16/status', {
      method: 'POST',
      body: { status: 'status:needs-human', fingerprint: current.fingerprint },
    });
    record('routes', 'status entry rejects no artifact and writes nothing', {
      status: response.status,
      error: response.json?.error,
      writesBefore: before,
      writesAfter: writes().length,
      resultingStatus: (await read(16)).statusLabel,
    });
  }

  // 2. Status entry with a valid artifact.
  {
    const current = await read(17);
    const response = await session.request('/api/issues/17/status', {
      method: 'POST',
      body: { status: 'status:needs-human', fingerprint: current.fingerprint },
    });
    record('routes', 'status entry accepts a valid artifact', {
      status: response.status,
      resultingStatus: (await read(17)).statusLabel,
      humanReviewState: (await read(17)).humanReview?.state,
    });
  }

  // 3. Dedicated reopen of a closed issue that still carries needs-human and no artifact.
  {
    const current = await read(10);
    const response = await session.request('/api/issues/10/reopen', {
      method: 'POST',
      body: { fingerprint: current.fingerprint },
    });
    const after = await read(10);
    record('routes', 'dedicated reopen route of closed waiting issue without artifact', {
      status: response.status,
      resultingState: after.state,
      resultingStatus: after.statusLabel,
      humanReviewState: after.humanReview?.state,
    });
  }

  // 4. Generic PATCH state open on a closed issue that still carries needs-human
  //    and no artifact. The dedicated reopen route is not the only API path.
  {
    const current = await read(18);
    const response = await session.request('/api/issues/18', {
      method: 'PATCH',
      body: { fingerprint: current.fingerprint, state: 'open' },
    });
    const after = await read(18);
    record('routes', 'generic PATCH state open on closed waiting issue without artifact', {
      status: response.status,
      resultingState: after.state,
      resultingStatus: after.statusLabel,
      humanReviewState: after.humanReview?.state,
    });
  }

  // 5. Body edit on a closed waiting issue removes the gate, then generic PATCH
  //    state open. Two requests, no gate at any point.
  {
    const current = await read(11);
    const bodyEdit = await session.request('/api/issues/11', {
      method: 'PATCH',
      body: { fingerprint: current.fingerprint, body: '## Overview\n\nRemoved while closed.\n' },
    });
    const afterEdit = await read(11);
    const reopen = await session.request('/api/issues/11', {
      method: 'PATCH',
      body: { fingerprint: afterEdit.fingerprint, state: 'open' },
    });
    const after = await read(11);
    record('routes', 'closed body edit removes gate then generic PATCH state open', {
      bodyEditStatus: bodyEdit.status,
      reopenStatus: reopen.status,
      resultingState: after.state,
      resultingStatus: after.statusLabel,
      humanReviewState: after.humanReview?.state,
    });
  }

  // 6. Answer a question while the gate is absent (legacy waiting).
  {
    const current = await read(14);
    const response = await session.request('/api/issues/14/questions/0/answer', {
      method: 'POST',
      body: { fingerprint: current.fingerprint, answer: 'Blue' },
    });
    const after = await read(14);
    record('routes', 'answer question while gate is absent', {
      status: response.status,
      resultingStatus: after.statusLabel,
      humanReviewState: after.humanReview?.state,
      openQuestions: after.openQuestions.map((q) => ({ index: q.index, answerIndex: q.answerIndex, completed: q.completed })),
    });
  }

  // 7. Legitimate label change (remove a non-status label) on a waiting issue
  //    with a malformed gate must not be blocked.
  {
    const current = await read(15);
    const response = await session.request('/api/issues/15/labels/remove', {
      method: 'POST',
      body: { fingerprint: current.fingerprint, label: 'priority:high' },
    });
    record('routes', 'remove non-status label on waiting issue with malformed gate', {
      status: response.status,
      error: response.json?.error,
      labels: (await read(15)).labels,
    });
  }

  // 8. Close a waiting issue with a valid gate: legitimate, not blocked.
  {
    const current = await read(13);
    const response = await session.request('/api/issues/13', {
      method: 'PATCH',
      body: { fingerprint: current.fingerprint, state: 'closed' },
    });
    const after = await read(13);
    record('routes', 'close waiting issue with valid gate', {
      status: response.status,
      resultingState: after.state,
      resultingStatus: after.statusLabel,
    });
  }

  // 9. Body edit on a waiting issue that preserves the gate: legitimate.
  {
    const current = await read(19);
    const body = current.body.replace('Review.', 'Review updated.');
    const response = await session.request('/api/issues/19', {
      method: 'PATCH',
      body: { fingerprint: current.fingerprint, body },
    });
    record('routes', 'body edit preserving the gate', {
      status: response.status,
      humanReviewState: (await read(19)).humanReview?.state,
    });
  }

  // 10. Body edit on a waiting issue that removes the gate: blocked, no write.
  {
    const current = await read(19);
    const before = writes().length;
    const response = await session.request('/api/issues/19', {
      method: 'PATCH',
      body: { fingerprint: current.fingerprint, body: '## Overview\n\nRemoved.\n' },
    });
    record('routes', 'body edit removing a ready gate', {
      status: response.status,
      error: response.json?.error,
      writesBefore: before,
      writesAfter: writes().length,
      bodyStillHasGate: /### Human Review:/.test((await read(19)).body),
    });
  }

  // 11. http image: parser accepts it, CSP cannot render it.
  {
    const current = await read(20);
    const httpBody = '### Human Review:\n- Artifact: image\n- URL: http://example.com/a.png\n- Instruction: Look.\n';
    const edit = await session.request('/api/issues/20', {
      method: 'PATCH',
      body: { fingerprint: current.fingerprint, body: httpBody },
    });
    const after = await read(20);
    record('routes', 'http image is refused by the parser even after a body edit', {
      bodyEditStatus: edit.status,
      humanReviewState: after.humanReview?.state,
      humanReviewUrl: after.humanReview?.url,
      statusLabel: after.statusLabel,
    });
  }

  // 12. Section editor cannot target Human Review at all.
  {
    const current = await read(19);
    record('routes', 'Human Review is not an editable section', {
      editableSections: current.editableSections.map((section) => section.id),
    });
  }

  // 13. The multi-repo qualified route resolves to the same guard.
  {
    const current = await read(32);
    const before = writes().length;
    const response = await session.request('/api/repos/owner/repo/issues/32/status', {
      method: 'POST',
      body: { status: 'status:needs-human', fingerprint: current.fingerprint },
    });
    record('routes', 'qualified multi-repo status entry rejects no artifact and writes nothing', {
      status: response.status,
      error: response.json?.error,
      writesBefore: before,
      writesAfter: writes().length,
    });
  }

  // 14. Another tool adds the waiting label on GitHub, outside the board. The
  //     board cannot refuse a write it never sees; it must present the absence
  //     honestly instead of implying an artifact exists.
  {
    const external = fake.issues.find((issue) => issue.number === 30);
    external.labels.push({ name: 'status:needs-human', color: 'ededed' });
    const detail = await read(30);
    const listItem = (await session.request('/api/board')).json.issues.find((issue) => issue.number === 30);
    record('routes', 'external label makes a gated-less task wait', {
      state: detail.state,
      statusLabel: detail.statusLabel,
      column: detail.column,
      humanReviewState: detail.humanReview?.state,
      humanReviewReason: detail.humanReview?.reason,
      listColumn: listItem?.column,
      listHumanReviewState: listItem?.humanReview?.state,
    });
  }

  // 15. The body is edited on GitHub outside the board and loses the section
  //     while the waiting label stays. The read model must report the loss.
  {
    const external = fake.issues.find((issue) => issue.number === 31);
    external.body = '## Overview\n\nEdited on GitHub, section removed.\n';
    external.updated_at = new Date().toISOString();
    const detail = await read(31);
    record('routes', 'external body edit removes the gate while waiting', {
      statusLabel: detail.statusLabel,
      humanReviewState: detail.humanReview?.state,
      humanReviewReason: detail.humanReview?.reason,
    });
  }
} finally {
  await board.app.close();
  await fake.close();
}

console.log(JSON.stringify(results, null, 2));
const parserFailures = results.parser.filter((row) => !row.ok);
if (parserFailures.length) console.error('parser expectation mismatches: ' + parserFailures.map((row) => row.name).join(', '));
