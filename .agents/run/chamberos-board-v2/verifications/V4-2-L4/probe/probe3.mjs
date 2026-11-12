import { startFakeGitHub, makeIssue } from '/workspace/code/openchamber-github-task-board/.worktrees/team-dev-board-v3/web/tests/fake-github.mjs';
import { startBoard, HttpSession } from '/workspace/code/openchamber-github-task-board/.worktrees/team-dev-board-v3/web/tests/helpers.mjs';
import { buildNoteCommentBody } from '/workspace/code/openchamber-github-task-board/.worktrees/team-dev-board-v3/web/server/board.ts';
const fake = await startFakeGitHub({ honorIfNoneMatch: true, issues: [makeIssue({ number: 1 }), makeIssue({ number: 2 })], comments: { 1: [{ body: buildNoteCommentBody('one') }], 2: [{ body: buildNoteCommentBody('two') }] } });
const board = await startBoard(fake, { BOARD_REPO: 'owner/repo' });
const s = new HttpSession(board.url); await s.login();
const out = {};
try {
  const b = await s.request('/api/board');
  out.boardStatus = b.status;
  out.commentRequestsAfterBoard = fake.requests.filter((r) => r.path.endsWith('/comments')).length;
  const d1 = await s.request('/api/issues/1');
  const n1 = fake.requests.filter((r) => r.path.endsWith('/comments')).length;
  const d2 = await s.request('/api/issues/1');
  const n2 = fake.requests.filter((r) => r.path.endsWith('/comments')).length;
  out.drawer = { firstOpenAddsRequests: n1 - n1 + 0, totalAfterFirst: n1, totalAfterSecond: n2, notes: d1.json.issue.notes.length };
  const reads = fake.requests.filter((r) => r.path.endsWith('/comments'));
  out.readDetail = reads.map((r) => ({ q: r.query, ifNoneMatch: Boolean(r.ifNoneMatch), status: r.responseStatus }));
  out.sameNote = JSON.stringify(d1.json.issue.notes) === JSON.stringify(d2.json.issue.notes);
  // Note text is returned raw from GitHub; client escapes it. Assert the wire payload is the raw text.
  out.rawText = d1.json.issue.notes[0].text;
} finally { await board.app.close(); await fake.close(); }
console.log(JSON.stringify(out, null, 2));
