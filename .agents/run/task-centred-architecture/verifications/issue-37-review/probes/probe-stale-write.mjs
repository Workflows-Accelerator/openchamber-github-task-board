import { startFakeGitHub, makeIssue } from '/workspace/extensions/github-task-board/.worktrees/team-dev-issue-37-multi-repo/web/tests/fake-github.mjs';
import { startBoard, browserConfig, HttpSession } from '/workspace/extensions/github-task-board/.worktrees/team-dev-issue-37-multi-repo/web/tests/helpers.mjs';

const body = '## Overview\nAlpha body\n\n## Open Questions\n- [ ] Decide?\n';
const fake = await startFakeGitHub({
  token: 'ghp_synthetic_board_token_000000000000',
  repositories: [
    { repo: 'owner/alpha', id: 101, issues: [makeIssue({ number: 1, title: 'Alpha', body, labels: ['status:todo'], repo: 'owner/alpha' })] },
    { repo: 'owner/beta', id: 102, issues: [makeIssue({ number: 1, title: 'Beta', body, labels: ['status:todo'], repo: 'owner/beta' })] },
  ],
});
let now = 1_700_000_000_000;
let releaseDiscovery;
const discoveryGate = new Promise((resolve) => { releaseDiscovery = resolve; });
let discoveryCalls = 0;
let gated = false;
const fetchImpl = async (input, init) => {
  const url = new URL(typeof input === 'string' ? input : input.url);
  if (url.pathname === '/user/repos') {
    discoveryCalls++;
    if (discoveryCalls === 2) { gated = true; await discoveryGate; }
  }
  return fetch(fake.url + url.pathname + url.search, init);
};
const config = browserConfig(fake, { BOARD_REPO: 'owner/alpha' });
const board = await startBoard(fake, { config, now: () => now, repositoryTtlMs: 60_000, fetchImpl });
const client = new HttpSession(board.url);
await client.login();
const warm = await client.request('/api/repos');
const detail = await client.request('/api/repos/owner/alpha/issues/1');
const fingerprint = detail.json.issue.fingerprint;
fake.setRepoAccessible('owner/alpha', false);
now += 61_000;
const refreshing = client.request('/api/repos');
for (let i = 0; i < 200 && !gated; i++) await new Promise((resolve) => setTimeout(resolve, 5));
const before = fake.requests.length;
const write = await client.request('/api/repos/owner/alpha/issues/1/status', {
  method: 'POST', body: { status: 'status:done', fingerprint },
});
const dispatched = fake.requests.slice(before).map((request) => request.method + ' ' + request.path);
console.log(JSON.stringify({
  warmVisible: warm.json.visibleCount,
  gated,
  writeStatus: write.status,
  writeError: write.json && write.json.error,
  dispatched,
  patchCalls: fake.patchCalls.length,
}));
releaseDiscovery();
await refreshing;
await board.app.close();
await fake.close();
