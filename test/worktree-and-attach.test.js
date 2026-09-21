import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildWorktreeBranchName,
  findThemeWorktree,
  buildLaunchSessionPayload,
  buildSessionIndex,
  getIssueTheme,
  getIssueBatch,
  mergeSessionItems,
  attachIssueToSession,
} from '../panel/core.ts';

const here = path.dirname(fileURLToPath(import.meta.url));

test('a) buildWorktreeBranchName generates <theme>-<batch> and <theme>-issue-<n>-<slug>', () => {
  // Case 1: Issue with theme and batch -> <theme>-<batch>
  const issueWithBatch = {
    number: 10,
    title: 'Implement voice transcription websocket pipeline',
    labels: [{ name: 'theme:voice-supervisor' }, { name: 'batch:phase-1' }],
  };
  const branchBatch = buildWorktreeBranchName({
    issue: issueWithBatch,
    mode: 'theme',
  });
  assert.equal(branchBatch, 'voice-supervisor-phase-1');

  // Case 2: Single issue with theme (no batch) -> <theme>-issue-<n>-<slug>
  const singleIssue = {
    number: 42,
    title: 'Streaming audio buffer underflow fix',
    labels: [{ name: 'theme:voice-supervisor' }],
  };
  const branchSingle = buildWorktreeBranchName({
    issue: singleIssue,
    mode: 'theme',
  });
  assert.equal(branchSingle, 'voice-supervisor-issue-42-streaming-audio-buffer-underflow-fix');

  // Case 3: Single issue with tag fallback theme -> <theme>-issue-<n>-<slug>
  const issueTagTheme = {
    number: 99,
    title: 'Auth token expiration refresh modal',
    labels: [{ name: 'auth-flow' }, { name: 'priority:critical' }],
  };
  const branchTagTheme = buildWorktreeBranchName({
    issue: issueTagTheme,
    mode: 'theme',
  });
  assert.equal(branchTagTheme, 'auth-flow-issue-99-auth-token-expiration-refresh-modal');

  // Case 4: Issue with explicit theme and batch parameter override
  const branchOverride = buildWorktreeBranchName({
    issue: singleIssue,
    mode: 'theme',
    theme: 'custom-theme',
    batch: 'sprint-2',
  });
  assert.equal(branchOverride, 'custom-theme-sprint-2');
});

test('b) issue-<n> token is preserved in single-issue theme branch names for auto-attribution', () => {
  const issue = {
    number: 105,
    title: 'Payment gateway retry logic',
    labels: [{ name: 'theme:billing' }],
  };
  const branch = buildWorktreeBranchName({
    issue,
    mode: 'theme',
  });
  // Must preserve issue-<number>
  assert.ok(branch.includes('issue-105'), `Expected branch "${branch}" to include "issue-105"`);

  // Verify reverse-matching regex used by buildSessionIndex matches the token
  const regex = /(?:^|[^a-zA-Z0-9])issue-(\d+)(?=[^0-9]|$)/gi;
  const matches = [...branch.matchAll(regex)];
  assert.equal(matches.length, 1);
  assert.equal(matches[0][1], '105');

  // Verify buildSessionIndex auto-attributes the session via this branch name
  const dummySession = {
    id: 'session-theme-wt',
    activity: 'running',
    worktree: branch,
  };
  const index = buildSessionIndex([dummySession]);
  assert.ok(index.has(105), 'Session index should map issue 105');
  assert.equal(index.get(105).id, 'session-theme-wt');
});

test('c) theme worktree reuse detection matches existing worktrees by theme name and batch', () => {
  const worktrees = [
    {
      name: 'voice-supervisor-phase-1',
      branch: 'voice-supervisor-phase-1',
      directory: '/workspace/.openchamber/worktree/voice-supervisor-phase-1',
    },
    {
      name: 'voice-supervisor',
      branch: 'voice-supervisor',
      directory: '/workspace/.openchamber/worktree/voice-supervisor',
    },
    {
      name: 'theme-billing',
      branch: 'theme-billing',
      directory: '/workspace/.openchamber/worktree/billing',
    },
    {
      name: 'random-feature',
      branch: 'issue-500-random',
      directory: '/workspace/.openchamber/worktree/random',
    },
  ];

  // Match 1: Matches <theme>-<batch> exactly
  const issueWithBatch = {
    number: 11,
    title: 'Batch audio task',
    labels: [{ name: 'theme:voice-supervisor' }, { name: 'batch:phase-1' }],
  };
  const matchedBatchWt = findThemeWorktree(worktrees, issueWithBatch);
  assert.ok(matchedBatchWt);
  assert.equal(matchedBatchWt.name, 'voice-supervisor-phase-1');

  // Match 2: Matches <theme> when issue has no batch
  const singleIssue = {
    number: 12,
    title: 'Single audio task',
    labels: [{ name: 'theme:voice-supervisor' }],
  };
  const matchedThemeWt = findThemeWorktree(worktrees, singleIssue);
  assert.ok(matchedThemeWt);
  assert.equal(matchedThemeWt.name, 'voice-supervisor');

  // Match 3: Matches theme by string name directly
  const matchedByString = findThemeWorktree(worktrees, 'billing');
  assert.ok(matchedByString);
  assert.equal(matchedByString.name, 'theme-billing');

  // Match 4: No match returns null
  const unlinkedIssue = {
    number: 13,
    title: 'Unlinked docs task',
    labels: [{ name: 'theme:documentation' }],
  };
  const unmatched = findThemeWorktree(worktrees, unlinkedIssue);
  assert.equal(unmatched, null);

  // Match 5: buildLaunchSessionPayload auto-reuses existing worktree payload
  const payloadReused = buildLaunchSessionPayload({
    issue: singleIssue,
    projectId: 'proj-openchamber',
    worktrees,
    prompt: 'Fix voice buffer',
  });
  assert.deepEqual(payloadReused.worktree, {
    kind: 'existing',
    name: 'voice-supervisor',
    directory: '/workspace/.openchamber/worktree/voice-supervisor',
  });
  assert.equal(payloadReused.directory, '/workspace/.openchamber/worktree/voice-supervisor');

  // Match 6: Preflight modal badge / notice element in panel/index.html
  const indexHtml = fs.readFileSync(path.join(here, '..', 'panel', 'index.html'), 'utf8');
  assert.ok(indexHtml.includes('id="preflightThemeNotice"'), 'panel/index.html must include #preflightThemeNotice');
  assert.ok(
    indexHtml.includes('Reusing active theme worktree:'),
    'panel/index.html must include "Reusing active theme worktree:" badge text'
  );

  const mainTs = fs.readFileSync(path.join(here, '..', 'panel', 'main.ts'), 'utf8');
  assert.ok(
    mainTs.includes('Reusing active theme worktree:'),
    'panel/main.ts must configure "Reusing active theme worktree: <theme>" notice'
  );
});

test('d) buildSessionIndex indexes multiple issues additively per session', () => {
  // Session 1 has multi-issue item with issueNumbers: [201, 202, 203] and item with issueNumber: 204
  const multiIssueSession = {
    id: 'session-multi-1',
    activity: 'idle',
    items: [
      {
        id: 'bundle-201-202-203',
        data: {
          issueNumbers: [201, 202, 203],
          count: 3,
        },
      },
      {
        id: '204',
        data: {
          issueNumber: 204,
        },
      },
    ],
  };

  // Session 2 is running and contains issue 202 (higher priority than idle) plus issue 205
  const runningSession = {
    id: 'session-running-2',
    activity: 'running',
    items: [
      {
        id: 'bundle-202-205',
        data: {
          issueNumbers: [202, 205],
        },
      },
    ],
  };

  // Session 3 is idle and also references issue 201 (should NOT overwrite session 1 because equal priority)
  const competingSession = {
    id: 'session-idle-3',
    activity: 'idle',
    items: [
      {
        id: 'bundle-201',
        data: {
          issueNumbers: [201],
        },
      },
    ],
  };

  const index = buildSessionIndex([multiIssueSession, runningSession, competingSession]);

  // Issue 201 should remain session-multi-1 (not overwritten by competing idle session)
  assert.equal(index.get(201)?.id, 'session-multi-1');

  // Issue 202 should be upgraded to session-running-2 (higher priority running > idle)
  assert.equal(index.get(202)?.id, 'session-running-2');

  // Issue 203 and 204 are indexed to session-multi-1
  assert.equal(index.get(203)?.id, 'session-multi-1');
  assert.equal(index.get(204)?.id, 'session-multi-1');

  // Issue 205 is indexed to session-running-2
  assert.equal(index.get(205)?.id, 'session-running-2');

  // Additive session items helper: mergeSessionItems preserves existing items additively
  const existingItems = [
    { id: 'item-1', data: { issueNumber: 301 } },
  ];
  const newItems = [
    { id: 'item-2', data: { issueNumbers: [302, 303] } },
  ];
  const merged = mergeSessionItems(existingItems, newItems);
  assert.equal(merged.length, 2);
  assert.equal(merged[0].id, 'item-1');
  assert.equal(merged[1].id, 'item-2');

  // attachIssueToSession attaches issue additively to session.items
  const session = { id: 'sess-attach', items: [{ id: 'item-existing', data: { issueNumber: 401 } }] };
  attachIssueToSession(session, { number: 402, title: 'Attached issue' });
  assert.equal(session.items.length, 2);
  assert.equal(session.items[0].id, 'item-existing');
  assert.equal(session.items[1].data.issueNumber, 402);
});
