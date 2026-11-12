import { startFakeGitHub, makeIssue } from '/workspace/code/openchamber-github-task-board/.worktrees/team-dev-board-v3/web/tests/fake-github.mjs';
import { startBoard, HttpSession } from '/workspace/code/openchamber-github-task-board/.worktrees/team-dev-board-v3/web/tests/helpers.mjs';
const fake = await startFakeGitHub({ repositories: [{ repo: 'owner/repo', id: 1, hasIssues: true, issues: [makeIssue({ number: 1 })] }] });
const board = await startBoard(fake, { BOARD_REPO: 'owner/repo' });
const s = new HttpSession(board.url); await s.login();
const out = {};
try {
  for (const path of ['/api/repos/nope/nothing/issues/1/notes', '/api/repos/owner/issues/1/notes', '/api/repos/owner/repo/issues/1/notes']) {
    const r = await s.request(path, { method: 'POST', body: { text: 'x' } });
    out[path] = { status: r.status, error: r.json?.error, message: r.json?.message };
  }
  out.commentCalls = fake.state.commentCalls.length;

} finally { await board.app.close(); await fake.close(); }
console.log(JSON.stringify(out, null, 2));
