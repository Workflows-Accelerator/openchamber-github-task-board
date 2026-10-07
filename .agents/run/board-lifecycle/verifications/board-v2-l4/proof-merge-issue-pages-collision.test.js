import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mergeIssuePages,
  syncIncrementalRepoIssues,
} from '../../../../../panel/core.ts';

test('Hostile Proof 2: mergeIssuePages clobbers issues with the same issue number across different repositories', () => {
  // Existing collection in All Projects mode containing issue #10 from repo-A and repo-B
  const existingAllProjectsIssues = [
    { number: 10, title: 'Repo A Issue 10', repo: 'owner/repo-A', state: 'open' },
    { number: 20, title: 'Repo A Issue 20', repo: 'owner/repo-A', state: 'open' },
    { number: 10, title: 'Repo B Issue 10', repo: 'owner/repo-B', state: 'open' },
  ];

  // An update comes in for repo-A issue #10
  const incomingChanged = [
    { number: 10, title: 'Repo A Issue 10 (Updated)', repo: 'owner/repo-A', state: 'closed' },
  ];

  const merged = mergeIssuePages(existingAllProjectsIssues, incomingChanged);

  // Because mergeIssuePages keys solely by issue.number, Repo B's issue 10 is eliminated!
  assert.equal(merged.length, 2, 'Total issues reduced from 3 to 2');
  const issuesWithNum10 = merged.filter((i) => i.number === 10);
  assert.equal(issuesWithNum10.length, 1, 'Only one issue with number 10 remains in the collection');
  assert.equal(issuesWithNum10[0].repo, 'owner/repo-A');

  // Verify Repo B's issue 10 is gone
  const repoBIssue = merged.find((i) => i.repo === 'owner/repo-B' && i.number === 10);
  assert.equal(repoBIssue, undefined, 'CRITICAL: Repo B Issue 10 was silently destroyed by cross-repo collision in mergeIssuePages');
});

test('Hostile Proof 2b: syncIncrementalRepoIssues destroys cross-repo issues when updating in All Projects mode', async () => {
  const allProjectsCurrent = [
    { number: 5, title: 'Repo Alpha Task', repo: 'org/alpha', state: 'open' },
    { number: 5, title: 'Repo Beta Task', repo: 'org/beta', state: 'open' },
  ];

  const mockRequestFn = async () => [
    { number: 5, title: 'Repo Alpha Task - Completed', state: 'closed', updated_at: '2026-10-07T12:00:00Z' },
  ];

  const syncResult = await syncIncrementalRepoIssues({
    repo: 'org/alpha',
    since: '2026-10-07T11:00:00Z',
    currentIssues: allProjectsCurrent,
    requestFn: mockRequestFn,
  });

  const betaIssue = syncResult.issues.find((i) => i.repo === 'org/beta');
  assert.equal(betaIssue, undefined, 'Repo Beta issue #5 was destroyed when syncing Repo Alpha');
});
