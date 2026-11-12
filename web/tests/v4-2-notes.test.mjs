import test from 'node:test';
import assert from 'node:assert/strict';
import { buildNoteCommentBody, parseNoteComment, parseIssueNotes, issueFingerprint } from '../server/board.ts';
import { startFakeGitHub, makeIssue } from './fake-github.mjs';
import { startBoard, HttpSession } from './helpers.mjs';

const note = (id, text, created_at = '2026-11-12T12:00:00Z') => ({ id, body: buildNoteCommentBody(text), user: { login: 'author' }, created_at });
async function fixture(options, run) {
  const fake = await startFakeGitHub({ honorIfNoneMatch: true, issues: [makeIssue({ number: 1, body: '<!-- board-canvas: {"x":10,"y":20,"notes":[]} -->\n## Overview\nKeep this body.', labels: ['status:todo'] })], ...options });
  const board = await startBoard(fake);
  try { const session = new HttpSession(board.url); await session.login(); await run({ fake, board, session }); }
  finally { await board.app.close(); await fake.close(); }
}

test('V4-2 note marker is first, versioned, localised, and text round-trips', () => {
  for (const language of ['en', 'fr']) {
    const body = buildNoteCommentBody('  **Keep** `history`\n- one\n- two  ', language);
    assert.ok(body.startsWith('<!-- board-note: 1 -->\n'));
    assert.ok(body.includes(language === 'fr' ? 'Note pour l’agent' : 'Note for the agent'));
    assert.equal(parseNoteComment({ id: 1, body }).text, '**Keep** `history`\n- one\n- two');
  }
});
for (const body of ['Hello\n<!-- board-note: 1 -->\nquoted', '> <!-- board-note: 1 -->\nquoted', '<!-- board-note: 2 -->\nfuture', '<!-- board-note: 0 -->\ninvalid', '<!-- board-note: 1 -->\nNote for the agent\n\n']) {
  test(`V4-2 ignores non-note/unsupported marker ${JSON.stringify(body)}`, () => assert.equal(parseNoteComment({ id: 1, body }), null));
}
test('V4-2 note parser newest first with stable ID tie-break and limit', () => {
  assert.deepEqual(parseIssueNotes([note(1, 'first'), note(3, 'third'), note(2, 'second')], 2).map((n) => n.id), [3, 2]);
});
test('V4-2 note validation rejects blank, non-string, oversized text', () => {
  for (const text of ['', ' ', null, {}, 'a'.repeat(4001)]) assert.throws(() => buildNoteCommentBody(text));
});
test('V4-2 append-only comment, immediate payload, reload, agent author/time, no body/canvas change', async () => {
  await fixture({ comments: { 1: [{ body: 'Human comment stays intact.' }] } }, async ({ fake, session }) => {
    const before = structuredClone(fake.findIssue(1));
    const posted = await session.request('/api/issues/1/notes', { method: 'POST', body: { text: 'Please keep the audit trail.', language: 'fr' } });
    assert.equal(posted.status, 201);
    assert.equal(fake.state.commentCalls.length, 1);
    assert.match(fake.state.commentCalls[0].payload.body, /^<!-- board-note: 1 -->\nNote pour l’agent\n\n/);
    assert.equal(fake.state.commentsFor(1)[0].body, 'Human comment stays intact.');
    assert.equal(fake.findIssue(1).body, before.body);
    assert.equal(issueFingerprint(fake.findIssue(1)), issueFingerprint(before));
    assert.equal(fake.patchCalls.length, 0);
    assert.equal(posted.json.issue.notes[0].text, 'Please keep the audit trail.');
    assert.equal(posted.json.note.author, fake.login);
    assert.ok(posted.json.note.createdAt);
    assert.equal(posted.json.issue.noteCount, 1);
    assert.equal(posted.json.listItem.commentCount, 2);
    const reloaded = await session.request('/api/issues/1');
    assert.deepEqual(reloaded.json.issue.notes, posted.json.issue.notes);
    const rows = await session.request('/api/board');
    assert.equal(rows.json.issues[0].commentCount, 2);
    assert.ok(!fake.requests.some((r) => ['PATCH', 'DELETE'].includes(r.method) && r.path.includes('/comments')));
  });
});
test('V4-2 notes use If-None-Match/304; board render/list never reads comment pages', async () => {
  await fixture({}, async ({ fake, session }) => {
    await session.request('/api/board');
    assert.equal(fake.requests.filter((r) => r.path.endsWith('/comments')).length, 0);
    await session.request('/api/issues/1');
    await session.request('/api/issues/1');
    const reads = fake.requests.filter((r) => r.path.endsWith('/comments'));
    assert.equal(reads.length, 2);
    assert.ok(reads[1].ifNoneMatch);
    assert.equal(reads[1].responseStatus, 304);
  });
});
test('V4-2 reads newest GitHub page using count, not unsupported sort/direction', async () => {
  const comments = Array.from({ length: 101 }, (_, i) => ({ body: buildNoteCommentBody('Note ' + i) }));
  await fixture({ comments: { 1: comments } }, async ({ fake, session }) => {
    const read = await session.request('/api/issues/1');
    assert.equal(read.json.issue.notes[0].text, 'Note 100');
    assert.equal(read.json.issue.noteCountPartial, true);
    const request = fake.requests.find((r) => r.path.endsWith('/comments'));
    assert.equal(request.query, '?per_page=100&page=2');
    const sent = await session.request('/api/issues/1/notes', { method: 'POST', body: { text: 'Newest' } });
    assert.equal(sent.status, 201);
    assert.equal(sent.json.issue.notes[0].text, 'Newest');
  });
});
test('V4-2 qualified note route and CSRF protection', async () => {
  await fixture({}, async ({ fake, session }) => {
    assert.equal((await session.request('/api/issues/1/notes', { method: 'POST', csrf: false, body: { text: 'No' } })).status, 403);
    assert.equal(fake.state.commentCalls.length, 0);
    assert.equal((await session.request('/api/repos/owner/repo/issues/1/notes', { method: 'POST', body: { text: 'Yes' } })).status, 201);
  });
});
for (const [status, payload, expected] of [[403, { message: 'Resource not accessible by integration' }, 'note_forbidden'], [500, { message: 'Gateway lost response' }, 'note_outcome_unknown']]) {
  test(`V4-2 ${status} comment refusal/failure is honest and creates nothing`, async () => {
    await fixture({ commentHook: () => ({ status, payload }) }, async ({ fake, session }) => {
      const response = await session.request('/api/issues/1/notes', { method: 'POST', body: { text: 'Retain this text.' } });
      assert.equal(response.json.error, expected);
      assert.doesNotMatch(response.json.message, /outcome unknown/i);
      assert.equal(fake.state.commentsFor(1).length, 0);
    });
  });
}
test('V4-2 a 410 Gone comment refusal is definite, never an unknown outcome', async () => {
  await fixture({ commentHook: () => ({ status: 410, payload: { message: 'Issues are disabled for this repo' } }) }, async ({ fake, session }) => {
    const response = await session.request('/api/issues/1/notes', { method: 'POST', body: { text: 'Issues are disabled here' } });
    assert.equal(response.status, 404);
    assert.equal(response.json.error, 'not_found');
    assert.equal(response.json.noteSent, undefined);
    assert.match(response.json.message, /not saved/i);
    assert.doesNotMatch(response.json.message, /outcome unknown/i);
    assert.equal(fake.state.commentsFor(1).length, 0);
  });
});
test('V4-2 a locked issue is reported as locked, not as a token problem', async () => {
  await fixture({ commentHook: () => ({ status: 403, payload: { message: 'Issue is locked' } }) }, async ({ fake, session }) => {
    const response = await session.request('/api/issues/1/notes', { method: 'POST', body: { text: 'Locked issue note' } });
    assert.equal(response.status, 403);
    assert.equal(response.json.error, 'note_locked');
    assert.doesNotMatch(response.json.message, /permission|token/i);
    assert.match(response.json.message, /locked/i);
    assert.equal(fake.state.commentsFor(1).length, 0);
  });
});
test('V4-2 a human comment quoting the marker is not a note, end to end', async () => {
  await fixture({ comments: { 1: [
    { body: '> <!-- board-note: 1 -->\n> Note for the agent\n\nQuoted, so not a note.' },
    { body: 'The marker is `<!-- board-note: 1 -->` and must stay first.' },
  ] } }, async ({ session }) => {
    const read = await session.request('/api/issues/1');
    assert.equal(read.json.issue.commentCount, 2);
    assert.deepEqual(read.json.issue.notes, []);
    assert.equal(read.json.issue.noteCount, 0);
  });
});
test('V4-2 counts board notes separately from human comments', async () => {
  await fixture({ comments: { 1: [{ body: 'Human comment stays intact.' }, { body: 'Another human comment.' }] } }, async ({ fake, session }) => {
    const posted = await session.request('/api/issues/1/notes', { method: 'POST', body: { text: 'Only this one is a note' } });
    assert.equal(posted.json.issue.noteCount, 1);
    assert.equal(posted.json.issue.noteCountPartial, false);
    assert.equal(posted.json.issue.commentCount, 3);
    assert.equal(fake.state.commentsFor(1).length, 3);
  });
});
test('V4-2 unreadable comments degrade only the note surface', async () => {
  await fixture({}, async ({ fake, session }) => {
    fake.state.commentsReadHook = () => ({ status: 500, payload: { message: 'Comments unavailable' } });
    const read = await session.request('/api/issues/1');
    assert.equal(read.status, 200);
    assert.equal(read.json.issue.title, 'Synthetic issue 1');
    assert.equal(read.json.issue.notesDegraded, true);
    assert.deepEqual(read.json.issue.notes, []);
    assert.equal((await session.request('/api/board')).status, 200);
    fake.state.commentsReadHook = null;
    const sent = await session.request('/api/issues/1/notes', { method: 'POST', body: { text: 'Degraded but readable' } });
    assert.equal(sent.status, 201);
    assert.equal(sent.json.issue.notesDegraded, undefined);
    assert.equal(sent.json.note.text, 'Degraded but readable');
  });
});
for (const text of ['', 'a'.repeat(4001), null]) {
  test(`V4-2 invalid note ${text === null ? 'null' : text.length} never reaches GitHub POST`, async () => {
    await fixture({}, async ({ fake, session }) => {
      assert.equal((await session.request('/api/issues/1/notes', { method: 'POST', body: { text } })).status, 400);
      assert.equal(fake.state.commentCalls.length, 0);
    });
  });
}

test('V4-2 sending an agent note preserves native blockers and dependents in every returned surface', async () => {
  await fixture({ issues: [makeIssue({ number: 1 }), makeIssue({ number: 2 }), makeIssue({ number: 3 })] }, async ({ fake, session }) => {
    fake.addDependency(1, 2);
    fake.addDependency(3, 1);
    const before = await session.request('/api/issues/1');
    assert.equal(before.json.issue.blockedBy.length, 1);
    assert.equal(before.json.issue.blocking.length, 1);
    const sent = await session.request('/api/issues/1/notes', { method: 'POST', body: { text: 'Keep dependency context' } });
    assert.equal(sent.status, 201);
    assert.deepEqual(sent.json.issue.blockedBy, before.json.issue.blockedBy);
    assert.deepEqual(sent.json.issue.blocking, before.json.issue.blocking);
    assert.deepEqual(sent.json.listItem.blockedBy, before.json.issue.blockedBy);
    assert.deepEqual(sent.json.listItem.blocking, before.json.issue.blocking);
  });
});
test('V4-2 dependency-read failure cannot append a note or invent empty wires', async () => {
  const fake = await startFakeGitHub({ issues: [makeIssue({ number: 1 }), makeIssue({ number: 2 })] });
  fake.addDependency(1, 2);
  const board = await startBoard(fake, { fetchImpl: async (url, options) => {
    if (new URL(url).pathname.includes('/dependencies/')) {
      return new Response(JSON.stringify({ message: 'Dependency context unavailable' }), { status: 503 });
    }
    return fetch(url, options);
  } });
  try {
    const session = new HttpSession(board.url); await session.login();
    const sent = await session.request('/api/issues/1/notes', { method: 'POST', body: { text: 'Keep dependency context' } });
    assert.equal(sent.status, 502);
    assert.equal(fake.state.commentCalls.length, 0);
    assert.equal(sent.json.issue, undefined);
  } finally { await board.app.close(); await fake.close(); }
});
test('V4-2 concurrent drawer reads singleflight one comment request', async () => {
  let entered;
  let release;
  const began = new Promise((resolve) => { entered = resolve; });
  const gate = new Promise((resolve) => { release = resolve; });
  let reads = 0;
  await fixture({ commentsReadHook: async () => { reads += 1; entered(); await gate; return null; } }, async ({ session }) => {
    const first = session.request('/api/issues/1');
    await began;
    const second = session.request('/api/issues/1');
    // Keep the first comment response pending while both drawer reads arrive.
    await new Promise((resolve) => setTimeout(resolve, 100));
    release();
    const results = await Promise.all([first, second]);
    assert.ok(results.every((result) => result.status === 200));
    assert.equal(reads, 1);
  });
});
test('V4-2 stale issue count after create cannot hide a note crossing a comment-page boundary', async () => {
  const comments = Array.from({ length: 100 }, (_, i) => ({ body: buildNoteCommentBody('Old ' + i) }));
  const fake = await startFakeGitHub({ comments: { 1: comments }, issues: [makeIssue({ number: 1 })] });
  const board = await startBoard(fake, { fetchImpl: async (url, options) => {
    const response = await fetch(url, options);
    if (new URL(url).pathname === '/repos/owner/repo/issues/1' && (!options?.method || options.method === 'GET')) {
      const item = await response.json();
      item.comments = 100;
      return new Response(JSON.stringify(item), { status: response.status, headers: response.headers });
    }
    return response;
  } });
  try {
    const session = new HttpSession(board.url); await session.login();
    const sent = await session.request('/api/issues/1/notes', { method: 'POST', body: { text: 'Cross the boundary' } });
    assert.equal(sent.status, 201);
    assert.equal(sent.json.note.text, 'Cross the boundary');
    assert.equal(sent.json.listItem.commentCount, 101);
    assert.ok(fake.requests.some((request) => request.path.endsWith('/comments') && request.query === '?per_page=100&page=2'));
  } finally { await board.app.close(); await fake.close(); }
});
