// Independent L4 probe: security and blast-radius checks on the V4-2 note write path.
// Run from the worktree root. Uses the shipped test fakes only; no real GitHub calls.
import { startFakeGitHub, makeIssue } from '/workspace/code/openchamber-github-task-board/.worktrees/team-dev-board-v3/web/tests/fake-github.mjs';
import { startBoard, HttpSession } from '/workspace/code/openchamber-github-task-board/.worktrees/team-dev-board-v3/web/tests/helpers.mjs';
import { parseNoteComment, buildNoteCommentBody } from '/workspace/code/openchamber-github-task-board/.worktrees/team-dev-board-v3/web/server/board.ts';

const out = {};
const fake = await startFakeGitHub({
  honorIfNoneMatch: true,
  repositories: [
    {
      repo: 'owner/repo', id: 1, hasIssues: true,
      issues: [
        makeIssue({ number: 1, body: '<!-- board-canvas: {"x":10,"y":20,"notes":[]} -->\n## Overview\nKeep this body.', labels: ['status:todo'] }),
        makeIssue({ number: 2, body: '## Overview\nSecond issue.' }),
      ],
      comments: { 1: [{ body: 'Human comment.' }] },
    },
    { repo: 'other/place', id: 2, hasIssues: true, issues: [makeIssue({ number: 1, repo: 'other/place' })] },
  ],
});
const board = await startBoard(fake, { BOARD_REPO: 'owner/repo' });
const s = new HttpSession(board.url);
await s.login();
const post = (path, body, opts = {}) => s.request(path, { method: 'POST', body, ...opts });

try {
  // 1. CSRF on both route shapes.
  out.csrfPlain = (await post('/api/issues/1/notes', { text: 'no csrf' }, { csrf: false })).status;
  out.csrfQualified = (await post('/api/repos/owner/repo/issues/1/notes', { text: 'no csrf' }, { csrf: false })).status;
  out.commentsAfterCsrf = fake.state.commentCalls.length;

  // 2. Unconfigured repository on the multi-repo route.
  const unknown = await post('/api/repos/other/place/issues/1/notes', { text: 'wrong repo' });
  out.unknownRepo = { status: unknown.status, error: unknown.json?.error };
  out.commentsAfterUnknownRepo = fake.state.commentCalls.length;

  // 3. Size caps before any GitHub call.
  out.empty = (await post('/api/issues/1/notes', { text: '   ' })).status;
  out.tooLong = (await post('/api/issues/1/notes', { text: 'a'.repeat(4001) })).status;
  out.bigBody = (await post('/api/issues/1/notes', { text: 'a'.repeat(70 * 1024) })).status;
  out.nonObject = (await post('/api/issues/1/notes', ['x'])).status;
  out.commentsAfterCaps = fake.state.commentCalls.length;

  // 4. Lock released after a throw: fail once, then send again quickly.
  fake.state.commentHook = () => ({ status: 500, payload: { message: 'Gateway lost response' } });
  const failed = await post('/api/issues/1/notes', { text: 'first attempt fails' });
  fake.state.commentHook = null;
  const t0 = Date.now();
  const after = await post('/api/issues/1/notes', { text: 'second attempt succeeds' });
  out.lockAfterThrow = { failedStatus: failed.status, failedError: failed.json?.error, secondStatus: after.status, waitedMs: Date.now() - t0 };
  out.failureLeftNoComment = fake.state.commentsFor(1).filter((c) => c.body.includes('first attempt fails')).length;

  // 5. Nothing edited: no PATCH/DELETE on comments, issue body unchanged.
  out.writeMethods = [...new Set(fake.requests.map((r) => r.method))];
  out.commentMutations = fake.requests.filter((r) => ['PATCH', 'DELETE'].includes(r.method) && r.path.includes('/comments')).length;
  out.issueBody = fake.findIssue(1).body;

  // 6. Response carries no token/header material.
  out.responseKeys = Object.keys(after.json || {});
  out.responseTextHasToken = /gh[pousr]_|github_pat_|authorization|bearer/i.test(after.text);

  // 7. Conditional reads per repo#issue.
  const r1 = await s.request('/api/issues/1');
  const r2 = await s.request('/api/issues/1');
  const r3 = await s.request('/api/issues/2');
  const r4 = await s.request('/api/issues/1');
  const reads = fake.requests.filter((r) => r.path.endsWith('/comments'));
  out.conditional = {
    reads: reads.length,
    statuses: reads.map((r) => r.responseStatus),
    sent: reads.map((r) => Boolean(r.ifNoneMatch)),
    noteLists: [r1.json.issue.notes.length, r2.json.issue.notes.length, r3.json.issue.notes.length, r4.json.issue.notes.length],
  };

  // 8. Marker parsing is not spoofable from ordinary prose.
  const bodies = {
    laterMarker: 'Hello\n<!-- board-note: 1 -->\nquoted',
    quoted: '> <!-- board-note: 1 -->\n> Note for the agent\n\nquoted text',
    version2: '<!-- board-note: 2 -->\nNote for the agent\n\nfuture',
    insideFence: '```\n<!-- board-note: 1 -->\n```\ntext',
    firstLineMarker: '<!-- board-note: 1 -->\nI am a human pretending',
    firstLineWithLead: '<!-- board-note: 1 -->\nNote for the agent\n\nreal looking',
  };
  out.marker = Object.fromEntries(Object.entries(bodies).map(([k, v]) => [k, Boolean(parseNoteComment({ id: 1, body: v, user: { login: 'x' } }))]));

  // 9. User text whose first line equals the visible lead-in.
  const roundTrip = parseNoteComment({ id: 7, body: buildNoteCommentBody('Note for the agent\nsecond line') });
  out.leadInCollision = roundTrip?.text;

  // 10. Two independent POSTs for the same text are two comments (server does not dedupe).
  const before = fake.state.commentCalls.length;
  await Promise.all([
    post('/api/issues/2/notes', { text: 'same text twice' }),
    post('/api/issues/2/notes', { text: 'same text twice' }),
  ]);
  out.serverDedupe = fake.state.commentCalls.length - before;
} finally {
  await board.app.close();
  await fake.close();
}
console.log(JSON.stringify(out, null, 2));
