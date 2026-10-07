import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mergeIssuePages,
  normalizeGithubIssues,
  buildMultiIssueAttachPayload,
  sessionRepoKeys,
  getSessionIssueRepo,
} from '/workspace/extensions/github-task-board/.worktrees/team-dev-v2-binding-ratelimit-review-repair/panel/core.ts';

test('Hostile Check 1: 3 repos with colliding issue numbers and closed duplicate', () => {
  const existing = [
    { number: 42, title: 'Repo A issue 42', repo: 'org/repo-a', state: 'open' },
    { number: 42, title: 'Repo B issue 42', repo: 'org/repo-b', state: 'open' },
    { number: 42, title: 'Repo C issue 42', repo: 'org/repo-c', state: 'closed' },
  ];

  // Incoming update for Repo B #42 closing it
  const incoming = [
    { number: 42, title: 'Repo B issue 42 (closed now)', repo: 'org/repo-b', state: 'closed' },
  ];

  const merged = mergeIssuePages(existing, incoming);

  assert.equal(merged.length, 3, 'All 3 issues must survive');
  const a = merged.find((i) => i.repo === 'org/repo-a' && i.number === 42);
  const b = merged.find((i) => i.repo === 'org/repo-b' && i.number === 42);
  const c = merged.find((i) => i.repo === 'org/repo-c' && i.number === 42);

  assert.ok(a, 'Repo A #42 must exist');
  assert.equal(a.state, 'open', 'Repo A #42 must still be open');

  assert.ok(b, 'Repo B #42 must exist');
  assert.equal(b.state, 'closed', 'Repo B #42 must be closed');
  assert.equal(b.title, 'Repo B issue 42 (closed now)');

  assert.ok(c, 'Repo C #42 must exist');
  assert.equal(c.state, 'closed', 'Repo C #42 must still be closed');
});

test('Hostile Check 2: Legacy issue without repo attribute during merge', () => {
  const existing = [
    { number: 42, title: 'Legacy issue without repo' }, // bare key "42"
    { number: 42, title: 'Repo A issue 42', repo: 'org/repo-a', state: 'open' },
  ];

  // Incoming update for Repo C #42
  const incoming = [
    { number: 42, title: 'Repo C issue 42', repo: 'org/repo-c', state: 'open' },
  ];

  const merged = mergeIssuePages(existing, incoming);

  // In mergeIssuePages lines 1968-1976:
  // If an incoming issue has key "org/repo-c#42" and prev is not found,
  // it checks bareKey "42". If bareIssue exists without repo, it claims it as prev and deletes bareKey!
  console.log('Merged issues with bare legacy item:', merged.map(i => ({ number: i.number, repo: i.repo, title: i.title })));

  const c = merged.find((i) => i.repo === 'org/repo-c' && i.number === 42);
  const bare = merged.find((i) => !i.repo && i.number === 42);

  // Notice: bare issue was claimed by Repo C!
  assert.ok(c, 'Repo C issue must exist');
});

test('Hostile Check 3: Multi-issue session spanning 3 repos', () => {
  const issues = [
    { number: 10, title: 'Task 1', repo: 'org/alpha' },
    { number: 20, title: 'Task 2', repo: 'org/beta' },
    { number: 30, title: 'Task 3', repo: 'org/gamma' },
  ];

  const payload = buildMultiIssueAttachPayload(issues);
  assert.equal(payload.data.issues.length, 3);
  assert.equal(payload.data.issues[0].repo, 'org/alpha');
  assert.equal(payload.data.issues[1].repo, 'org/beta');
  assert.equal(payload.data.issues[2].repo, 'org/gamma');

  const session = {
    id: 'ses_123',
    items: [{ id: payload.id, data: payload.data }],
  };

  const keys = sessionRepoKeys(session);
  assert.equal(keys.length, 3);
  assert.ok(keys.includes('org/alpha#10'));
  assert.ok(keys.includes('org/beta#20'));
  assert.ok(keys.includes('org/gamma#30'));

  // getSessionIssueRepo on multi-repo session must return null (not guess first repo)
  const singleRepo = getSessionIssueRepo(session.items[0]);
  assert.equal(singleRepo, null, 'getSessionIssueRepo must return null when multiple distinct repos exist');
});
