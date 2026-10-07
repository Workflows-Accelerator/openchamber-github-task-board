import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeGithubIssues,
  buildMultiIssueAttachPayload,
  getSessionIssueRepo,
  sessionRepoKeys,
} from '../../../../../panel/core.ts';

test('Hostile Proof 5: normalizeGithubIssues strips repo property in submitNewIssue', () => {
  const createdRaw = {
    number: 77,
    title: 'Brand New Task',
    body: 'Details',
    state: 'open',
    html_url: 'https://github.com/owner/repo/issues/77',
    labels: [],
  };

  // submitNewIssue in panel/main.ts line 5859:
  const normalizedCreated = normalizeGithubIssues([{ ...createdRaw, repo: 'owner/repo' }]);

  // Inspect normalizedCreated[0]
  assert.equal(normalizedCreated[0].number, 77);
  assert.equal(
    normalizedCreated[0].repo,
    undefined,
    'Bug confirmed: normalizeGithubIssues stripped the repo property!'
  );
});

test('Hostile Proof 6: buildMultiIssueAttachPayload on cross-repo issues falsely maps all issues to repo 1', () => {
  const issueA = {
    number: 1,
    title: 'Issue in Repo Alpha',
    repo: 'org/alpha',
    html_url: 'https://github.com/org/alpha/issues/1',
  };
  const issueB = {
    number: 2,
    title: 'Issue in Repo Beta',
    repo: 'org/beta',
    html_url: 'https://github.com/org/beta/issues/2',
  };

  // User in All Projects mode selects issueA and issueB and packages them
  const payload = buildMultiIssueAttachPayload([issueA, issueB]);

  // Inspect payload.data
  assert.equal(payload.data.repo, 'org/alpha', 'Only first repo is recorded');
  assert.deepEqual(payload.data.issueNumbers, [1, 2]);

  // When session items are indexed:
  const mockSession = {
    id: 'multi-sess',
    activity: 'running',
    items: [
      {
        id: payload.id,
        data: payload.data,
      },
    ],
  };

  const keys = sessionRepoKeys(mockSession);
  // It binds org/alpha#1 and org/alpha#2!
  assert.ok(keys.includes('org/alpha#1'));
  assert.ok(keys.includes('org/alpha#2'), 'Falsely attributed Issue 2 to org/alpha!');
  assert.ok(!keys.includes('org/beta#2'), 'CRITICAL: Issue 2 in org/beta was NOT bound to the session!');
});
