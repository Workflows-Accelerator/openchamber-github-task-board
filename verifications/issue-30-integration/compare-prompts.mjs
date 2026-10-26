import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import * as currentCore from '../../panel/core.ts';
import { runPreflightBrief, runBatchLaunchSessions } from '../../test/test-issue-launch-harness.js';

const directory = '/tmp/antigravity/prompt-comparison-scratch';
fs.mkdirSync(directory, { recursive: true });
const filename = `${directory}/core-959bfd2.ts`;
fs.writeFileSync(filename, execFileSync('git', ['show', '959bfd2:panel/core.ts']));
const baselineCore = await import(pathToFileURL(filename).href);

const fixtures = {
  undecided: { number: 30, title: 'Work type contract', body: 'Some body', labels: [{ name: 'documentation' }] },
  bug: { number: 31, title: 'Crash on launch', body: 'Observed versus expected', labels: [{ name: 'bug' }, { name: 'ui' }] },
  feature: { number: 32, title: 'Add CSV export', body: 'Desired outcome', labels: [{ name: 'enhancement' }, { name: 'api' }] },
  both: { number: 33, title: 'Both labels', body: 'body', labels: ['bug', 'enhancement'] },
  caseInsensitive: { number: 34, title: 'Uppercase label', labels: [{ name: 'BUG' }] },
  skillsAndSubtasks: {
    number: 35,
    title: 'Skill-aware task — UTF-8',
    body: '### Overview\nCheck source, skills, and subtasks.',
    labels: [{ name: 'enhancement' }, { name: 'theme:ui' }],
    skills: ['custom-skill'],
    subtasks: [{ text: 'Investigate', completed: true }, { text: 'Verify', completed: false }],
  },
};

let comparisons = 0;
function compare(name, before, after) {
  assert.equal(Buffer.compare(Buffer.from(before, 'utf8'), Buffer.from(after, 'utf8')), 0, name);
  comparisons++;
  console.log(`byte-identical ${name} (${Buffer.byteLength(after, 'utf8')} bytes)`);
}

for (const [name, issue] of Object.entries(fixtures)) {
  for (const useWorktree of [false, true]) {
    const baselinePreflight = baselineCore.renderSingleIssueBrief(issue, { useWorktree });
    const currentPreflight = currentCore.renderSingleIssueBrief(issue, { useWorktree });
    compare(`renderSingleIssueBrief-${name}-worktree=${useWorktree}`, baselinePreflight, currentPreflight);

    // Live preflight function execution via harness
    const livePreflight = runPreflightBrief(issue, { useWorktree });
    compare(`livePreflight-${name}-worktree=${useWorktree}`, currentPreflight, livePreflight);
  }

  const baselineBatch = baselineCore.renderBatchLaunchPrompt(issue);
  const currentBatch = currentCore.renderBatchLaunchPrompt(issue);
  compare(`renderBatchLaunchPrompt-${name}`, baselineBatch, currentBatch);

  // Live batch launch session execution via harness
  const liveBatch = await runBatchLaunchSessions([issue]);
  assert.equal(liveBatch.payloads.length, 1);
  compare(`liveBatch-${name}`, currentBatch, liveBatch.payloads[0].text);

  const baselineConsolidated = baselineCore.buildConsolidatedIssuePrompt([issue]);
  const currentConsolidated = currentCore.buildConsolidatedIssuePrompt([issue]);
  compare(`buildConsolidatedIssuePrompt-${name}`, baselineConsolidated, currentConsolidated);
}

// Edge cases
compare('renderSingleIssueBrief-null', baselineCore.renderSingleIssueBrief(null), currentCore.renderSingleIssueBrief(null));
compare('renderBatchLaunchPrompt-null', baselineCore.renderBatchLaunchPrompt(null), currentCore.renderBatchLaunchPrompt(null));
compare('buildConsolidatedIssuePrompt-empty', baselineCore.buildConsolidatedIssuePrompt([]), currentCore.buildConsolidatedIssuePrompt([]));

console.log(`${comparisons}/${comparisons} prompt byte-comparisons identical; baseline=959bfd2; exit=0`);
