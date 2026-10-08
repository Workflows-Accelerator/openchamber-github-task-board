import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSessionIndexByRepo,
  findSessionForIssueByRepo,
  resolveWorkspaceRootProject,
  parseRetryAfterMs,
  isSecondaryRateLimit,
  computeBackoffMs,
  retryWithBackoff,
  mapWithConcurrency,
} from '../panel/core.ts';
import { resolveIssueColumn, StatusReconciler } from '../panel/labels.ts';

const mkProject = (id, name, directory) => ({
  id,
  name,
  directory,
  gitRepo: null,
  linkedRepo: null,
});

// A non-vague, unlabelled issue so column resolution is driven purely by the
// attached session (idle -> in-review) rather than by labels or draft heuristics.
const mkIssue = (repo, number = 5) => ({
  number,
  repo,
  state: 'open',
  body: 'word '.repeat(30),
  labels: [],
  subtasks: [{ text: 'x' }],
});

test('A) session from repo A never binds to the same-numbered issue in repo B', () => {
  const sessions = [
    {
      id: 'sess-a',
      activity: 'idle',
      title: '#5 in A',
      items: [{ id: '5', url: 'https://github.com/acme/a/issues/5', data: { issueNumber: 5 } }],
    },
  ];
  const byRepo = buildSessionIndexByRepo(sessions);
  const issueA = mkIssue('acme/a');
  const issueB = mkIssue('acme/b');

  assert.equal(findSessionForIssueByRepo(byRepo, issueA)?.id, 'sess-a');
  assert.equal(findSessionForIssueByRepo(byRepo, issueB), null);

  // Column resolution follows the repo-matched session only.
  assert.equal(resolveIssueColumn(issueA, findSessionForIssueByRepo(byRepo, issueA)), 'in-review');
  assert.equal(resolveIssueColumn(issueB, findSessionForIssueByRepo(byRepo, issueB)), 'todo');
});

test('A) statusReconciler transitions only the repo that owns the session', async () => {
  const sessions = [
    { id: 'sess-a', activity: 'idle', items: [{ id: '5', url: 'https://github.com/acme/a/issues/5' }] },
  ];
  const byRepo = buildSessionIndexByRepo(sessions);
  const issueA = mkIssue('acme/a');
  const issueB = mkIssue('acme/b');

  const moved = [];
  const reconciler = new StatusReconciler({
    debounceMs: 0,
    updateStatus: async (issue, column) => {
      moved.push({ repo: issue.repo, column });
    },
    getSession: (issue) => findSessionForIssueByRepo(byRepo, issue),
  });

  const result = await reconciler.reconcile([issueA, issueB]);

  assert.deepEqual(moved, [{ repo: 'acme/a', column: 'in-review' }]);
  assert.equal(result.length, 1);
  assert.equal(result[0].issueNumber, 5);
});

test('A) session keying uses explicit repo and ignores repo-less items', () => {
  const explicit = buildSessionIndexByRepo([{ id: 's', items: [{ repo: 'Acme/A', id: '9' }] }]);
  assert.ok(findSessionForIssueByRepo(explicit, { number: 9, repo: 'acme/a' }));

  const noRepo = buildSessionIndexByRepo([{ id: 's2', items: [{ id: '9' }] }]);
  assert.equal(findSessionForIssueByRepo(noRepo, { number: 9, repo: 'acme/a' }), null);

  // An issue without a repo cannot be attributed either.
  assert.equal(findSessionForIssueByRepo(explicit, { number: 9 }), null);
});

test('B) resolveWorkspaceRootProject pins exact /workspace and never fabricates a root', () => {
  const exact = resolveWorkspaceRootProject([
    mkProject('a', 'Alpha', '/workspace/alpha'),
    mkProject('root', 'root', '/workspace'),
  ]);
  assert.equal(exact.pinned, true);
  assert.equal(exact.reason, 'exact');
  assert.equal(exact.project?.id, 'root');

  const named = resolveWorkspaceRootProject([
    mkProject('a', 'Alpha', '/workspace/alpha'),
    mkProject('ws', 'Workspace', '/srv/ws'),
  ]);
  assert.equal(named.pinned, false);
  assert.equal(named.reason, 'named');
  assert.equal(named.project?.id, 'ws');

  // Two sub-projects but no /workspace project: must NOT pick one silently.
  const missing = resolveWorkspaceRootProject([
    mkProject('a', 'Alpha', '/workspace/alpha'),
    mkProject('b', 'Beta', '/workspace/beta'),
  ]);
  assert.equal(missing.project, null);
  assert.equal(missing.pinned, false);
  assert.equal(missing.reason, 'missing');

  assert.deepEqual(resolveWorkspaceRootProject(null), { project: null, pinned: false, reason: 'missing' });
  assert.deepEqual(resolveWorkspaceRootProject([]), { project: null, pinned: false, reason: 'missing' });
});

test('C) secondary-rate-limit 403 is detected and backs off without crashing', async () => {
  const secondaryHeaders = { 'retry-after': '2', 'x-ratelimit-remaining': '0' };
  assert.equal(isSecondaryRateLimit(403, secondaryHeaders, ''), true);
  assert.equal(isSecondaryRateLimit(403, null, 'You have exceeded a secondary rate limit'), true);
  assert.equal(isSecondaryRateLimit(403, { 'x-ratelimit-remaining': '42' }, 'Forbidden'), false);
  assert.equal(isSecondaryRateLimit(401, secondaryHeaders, ''), false);

  assert.equal(parseRetryAfterMs(secondaryHeaders, 0), 2000);
  assert.equal(parseRetryAfterMs({}, 0), 0);
  assert.equal(computeBackoffMs(0, 0, 1000, 60000), 1000);
  assert.equal(computeBackoffMs(2, 0, 1000, 60000), 4000);
  assert.equal(computeBackoffMs(5, 12345, 1000, 60000), 12345);

  const rateErr = Object.assign(new Error('secondary rate limit'), { rateLimited: true, retryAfterMs: 2000 });
  let calls = 0;
  const delays = [];
  const result = await retryWithBackoff(async () => {
    calls++;
    if (calls < 2) throw rateErr;
    return 'ok';
  }, {
    maxAttempts: 3,
    isRetryable: (e) => Boolean(e.rateLimited),
    getRetryAfterMs: (e) => e.retryAfterMs,
    sleep: async (ms) => { delays.push(ms); },
  });
  assert.equal(result, 'ok');
  assert.equal(calls, 2);
  assert.deepEqual(delays, [2000]);

  // Exhausting retries rejects cleanly instead of hanging or looping forever.
  let attempts = 0;
  await assert.rejects(
    retryWithBackoff(async () => {
      attempts++;
      throw rateErr;
    }, {
      maxAttempts: 2,
      isRetryable: () => true,
      getRetryAfterMs: () => 0,
      baseMs: 1,
      sleep: async () => {},
    }),
    /secondary rate limit/
  );
  assert.equal(attempts, 2);
});

test('C) mapWithConcurrency caps in-flight work and isolates failures', async () => {
  let active = 0;
  let maxActive = 0;
  const items = Array.from({ length: 10 }, (_, i) => i);
  const settled = await mapWithConcurrency(items, 3, async (n) => {
    active++;
    maxActive = Math.max(maxActive, active);
    await new Promise((resolve) => setTimeout(resolve, 5));
    active--;
    return n * 2;
  });

  assert.equal(settled.length, 10);
  assert.ok(maxActive <= 3, `max in-flight was ${maxActive}, expected <= 3`);
  assert.deepEqual(settled.map((r) => r.value), items.map((n) => n * 2));

  // One rejected worker must not reject the whole batch.
  const mixed = await mapWithConcurrency([1, 2, 3], 2, async (n) => {
    if (n === 2) throw new Error('boom');
    return n;
  });
  assert.equal(mixed[0].status, 'fulfilled');
  assert.equal(mixed[1].status, 'rejected');
  assert.equal(mixed[2].status, 'fulfilled');
  assert.equal(mixed[0].value, 1);
  assert.equal(mixed[2].value, 3);
});
