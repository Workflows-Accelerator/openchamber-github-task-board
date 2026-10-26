import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as current from '../../panel/core.ts';

const root = fileURLToPath(new URL('../../', import.meta.url));
const directory = '/tmp/opencode/issue30-r3-byte-comparison';
fs.mkdirSync(directory, { recursive: true });
const filename = `${directory}/core-cf7dd92.ts`;
fs.writeFileSync(filename, execFileSync('git', ['show', 'cf7dd92:panel/core.ts'], { cwd: root }));
const baseline = await import(pathToFileURL(filename).href);
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
    compare(`single-${name}-worktree=${useWorktree}`,
      baseline.renderSingleIssueBrief(issue, { useWorktree }), current.renderSingleIssueBrief(issue, { useWorktree }));
  }
  compare(`batch-${name}`, baseline.renderBatchLaunchPrompt(issue), current.renderBatchLaunchPrompt(issue));
  compare(`consolidated-${name}`, baseline.buildConsolidatedIssuePrompt([issue]), current.buildConsolidatedIssuePrompt([issue]));
}
compare('single-null', baseline.renderSingleIssueBrief(null), current.renderSingleIssueBrief(null));
compare('batch-null', baseline.renderBatchLaunchPrompt(null), current.renderBatchLaunchPrompt(null));
compare('consolidated-empty', baseline.buildConsolidatedIssuePrompt([]), current.buildConsolidatedIssuePrompt([]));
console.log(`${comparisons}/${comparisons} byte-identical; baseline=cf7dd92; exit=0`);
