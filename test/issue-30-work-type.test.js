import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  DEFAULT_AI_ISSUE_PROMPT,
  DEFAULT_TEMPLATES,
  buildConsolidatedIssuePrompt,
  DEFAULT_WORK_INSTRUCTIONS,
  resolveIssueWorkType,
  renderSingleIssueBrief,
  renderBatchLaunchPrompt,
} from '../panel/core.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const CONTRACT_MD = fs.readFileSync(path.join(here, '..', 'docs', 'issue-body-contract.md'), 'utf8');

function containsEmoji(text) {
  if (!text) return false;
  const emojiRegex = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F000}-\u{1F02F}\u{1F0A0}-\u{1F0FF}]/u;
  return emojiRegex.test(text);
}

test('Work Log contract in docs/issue-body-contract.md specifies single justification sentence and rules', () => {
  assert.ok(CONTRACT_MD.includes('### 2.8 `### Work Log:`'), 'Must include Section 2.8 Work Log');
  assert.ok(
    CONTRACT_MD.includes('optional at issue creation') &&
    CONTRACT_MD.includes('once work starts'),
    'Must specify Work Log is optional at issue creation and required once work starts'
  );
  assert.ok(
    CONTRACT_MD.includes('exactly one sentence stating the work type and the concrete reason'),
    'Must specify exactly one sentence stating work type and concrete reason'
  );
  assert.ok(
    CONTRACT_MD.includes('observed behaviour that contradicts a stated expectation') &&
    CONTRACT_MD.includes('desired outcome that does not exist yet'),
    'Must include concrete reason examples for bug vs feature'
  );
  assert.ok(
    CONTRACT_MD.includes('do not add fields, counters or machine state'),
    'Must forbid adding fields, counters, or machine state'
  );
  assert.ok(
    CONTRACT_MD.includes('`bug` and `enhancement`') &&
    CONTRACT_MD.includes('only work-type source'),
    'Must declare bug and enhancement as only work-type source'
  );
  assert.ok(
    CONTRACT_MD.includes('undecided and must be asked about, not guessed'),
    'Must declare undecided work type must be asked about, not guessed'
  );
  assert.ok(
    CONTRACT_MD.includes('never infer a type from the title, the mood of the report, or the area of the code'),
    'Must forbid inferring type from title, mood, or code area'
  );
  assert.ok(
    !CONTRACT_MD.includes('### Work Type:'),
    'Must not introduce ### Work Type: body field'
  );
});

test('DEFAULT_WORK_INSTRUCTIONS states unambiguous work-type rules and proportionate paths', () => {
  assert.equal(typeof DEFAULT_WORK_INSTRUCTIONS, 'string');
  assert.equal(containsEmoji(DEFAULT_WORK_INSTRUCTIONS), false, 'Must contain zero emojis');

  // Work type single source of truth
  assert.ok(
    DEFAULT_WORK_INSTRUCTIONS.includes('`bug` and `enhancement` are the only work-type source') ||
    DEFAULT_WORK_INSTRUCTIONS.includes('Labels `bug` and `enhancement` are the only work-type source'),
    'Must state bug and enhancement are only work-type source'
  );
  assert.ok(
    DEFAULT_WORK_INSTRUCTIONS.includes('When both or neither are present, the work type is undecided and must be asked about, not guessed'),
    'Must state undecided rule when both or neither are present'
  );
  assert.ok(
    DEFAULT_WORK_INSTRUCTIONS.includes('Never infer a type from the title, the mood of the report, or the area of the code'),
    'Must forbid guessing type from title, mood, or area'
  );

  // Question protocol
  assert.ok(
    DEFAULT_WORK_INSTRUCTIONS.includes('Only block work that depends on the unanswered question; independent authorised work continues'),
    'Must state only block dependent work while independent work continues'
  );
  assert.ok(
    DEFAULT_WORK_INSTRUCTIONS.includes('Undecided work type is an alignment question to the user, not a default'),
    'Must state undecided is alignment question not default'
  );
  assert.ok(
    DEFAULT_WORK_INSTRUCTIONS.includes('Undecided items must be asked about individually'),
    'Must state undecided items in batches must be asked about individually'
  );

  // Work Log justification sentence
  assert.ok(
    DEFAULT_WORK_INSTRUCTIONS.includes('optional at issue creation') &&
    DEFAULT_WORK_INSTRUCTIONS.includes('once work starts, the Work Log must contain exactly one sentence'),
    'Must require exactly one Work Log sentence once work starts'
  );

  // Proportionate paths
  assert.ok(
    DEFAULT_WORK_INSTRUCTIONS.includes('Bug path: observed versus expected behaviour, reproduction evidence, cause, minimal regression-tested fix, hostile review'),
    'Must state exact bug path requirements'
  );
  assert.ok(
    DEFAULT_WORK_INSTRUCTIONS.includes('Feature path: desired outcome, research and alternatives, user decisions, then implementation'),
    'Must state exact feature path requirements'
  );

  // Guard rails
  assert.ok(
    DEFAULT_WORK_INSTRUCTIONS.includes('human authority over release and closure'),
    'Must retain human authority over release and closure'
  );

  // Forbids second source of truth and expiration
  assert.ok(!DEFAULT_WORK_INSTRUCTIONS.includes('### Work Type:'), 'No body work-type field');
  assert.ok(!DEFAULT_WORK_INSTRUCTIONS.includes('type:bug'), 'No type:bug label');
  assert.ok(!DEFAULT_WORK_INSTRUCTIONS.includes('type:enhancement'), 'No type:enhancement label');
  assert.ok(!/expir/i.test(DEFAULT_WORK_INSTRUCTIONS), 'Must not implement, schedule or imply bug expiration');
});

test('resolveIssueWorkType determines bug vs feature vs undecided strictly from labels', () => {
  // Pure bug
  assert.equal(resolveIssueWorkType({ labels: [{ name: 'bug' }] }), 'bug');
  assert.equal(resolveIssueWorkType({ labels: ['bug'] }), 'bug');

  // Pure feature (enhancement)
  assert.equal(resolveIssueWorkType({ labels: [{ name: 'enhancement' }] }), 'feature');
  assert.equal(resolveIssueWorkType({ labels: ['enhancement'] }), 'feature');

  // Both labels -> undecided
  assert.equal(resolveIssueWorkType({ labels: [{ name: 'bug' }, { name: 'enhancement' }] }), 'undecided');

  // Neither label -> undecided
  assert.equal(resolveIssueWorkType({ labels: [{ name: 'documentation' }] }), 'undecided');
  assert.equal(resolveIssueWorkType({ labels: [] }), 'undecided');
  assert.equal(resolveIssueWorkType(null), 'undecided');
  assert.equal(resolveIssueWorkType(undefined), 'undecided');

  // Never infers from title, body, or area
  const misleadingIssue = {
    title: 'CRITICAL BUG CRASH IN CORE AUTH',
    body: 'There is an urgent bug here that does not work',
    labels: [{ name: 'documentation' }],
  };
  assert.equal(resolveIssueWorkType(misleadingIssue), 'undecided', 'Must never infer bug from title or body');
});

test('DEFAULT_TEMPLATES bug and feature templates satisfy proportionate path contract without second source of truth', () => {
  const bugTmpl = DEFAULT_TEMPLATES.bug.promptInstructions;
  assert.ok(
    bugTmpl.includes('observed versus expected behaviour'),
    'Bug template must ask for observed versus expected behaviour'
  );
  assert.ok(
    bugTmpl.includes('Steps to Reproduce'),
    'Bug template must ask for reproduction'
  );
  assert.ok(!bugTmpl.includes('Work Type:'), 'Bug template must not add a work type field');
  assert.ok(!bugTmpl.includes('type:'), 'Bug template must not add type:* labels');
  assert.ok(!/expir/i.test(bugTmpl), 'Bug template must not mention expiration');

  const featTmpl = DEFAULT_TEMPLATES.feature.promptInstructions;
  assert.ok(
    featTmpl.includes('Desired outcome:'),
    'Feature template must ask for desired outcome'
  );
  assert.ok(
    !featTmpl.includes('### Research & Alternatives'),
    'Feature template must not introduce uncontracted Research & Alternatives section'
  );
  assert.ok(
    !featTmpl.includes('Align on user decisions'),
    'Feature template must not add uncontracted Align on user decisions checklist item'
  );
  assert.ok(!featTmpl.includes('Work Type:'), 'Feature template must not add a work type field');
  assert.ok(!featTmpl.includes('type:'), 'Feature template must not add type:* labels');
});

test('DEFAULT_AI_ISSUE_PROMPT enforces single work-type source, Work Log justification, and zero emojis', () => {
  assert.equal(containsEmoji(DEFAULT_AI_ISSUE_PROMPT), false);
  assert.ok(
    DEFAULT_AI_ISSUE_PROMPT.includes('"bug" and "enhancement"') &&
    DEFAULT_AI_ISSUE_PROMPT.includes('single source of work type'),
    'Must name bug and enhancement as single source of work type'
  );
  assert.ok(
    DEFAULT_AI_ISSUE_PROMPT.includes('undecided and must be asked about, not guessed'),
    'Must state undecided rule'
  );
  assert.ok(
    DEFAULT_AI_ISSUE_PROMPT.includes('Work Log: The "### Work Log:" section is optional at issue creation; once work starts, the Work Log must contain exactly one sentence'),
    'Must describe Work Log optionality at creation and single required sentence once work starts'
  );
  assert.ok(!DEFAULT_AI_ISSUE_PROMPT.includes('### Work Type:'), 'Must not add ### Work Type: field');
  assert.ok(!DEFAULT_AI_ISSUE_PROMPT.includes('type:* label'), 'Must forbid type:* labels');
});

test('buildConsolidatedIssuePrompt includes work instructions with proportionate paths', () => {
  const mockIssues = [
    { number: 1, title: 'Bug task', labels: [{ name: 'bug' }] },
    { number: 2, title: 'Feat task', labels: [{ name: 'enhancement' }] },
  ];
  const prompt = buildConsolidatedIssuePrompt(mockIssues);
  assert.ok(prompt.includes('Work Type & Proportionate Paths'));
  assert.ok(prompt.includes('Bug path: observed versus expected behaviour, reproduction evidence, cause, minimal regression-tested fix, hostile review'));
  assert.ok(prompt.includes('Feature path: desired outcome, research and alternatives, user decisions, then implementation'));
  assert.ok(prompt.includes('only work-type source'));
  assert.ok(prompt.includes('Undecided items must be asked about individually'));
  assert.ok(prompt.includes('Work Log: The `### Work Log:` section is optional at issue creation; once work starts, the Work Log must contain exactly one sentence'));
  assert.equal(containsEmoji(prompt), false);
});

test('renderSingleIssueBrief and renderBatchLaunchPrompt enforce work-type resolution and path isolation across all 5 cases', () => {
  const bugIssue = {
    number: 101,
    title: 'Fix edge crash',
    labels: [{ name: 'bug' }],
    body: 'App crashes on launch',
  };

  const featIssue = {
    number: 102,
    title: 'Add CSV export',
    labels: [{ name: 'enhancement' }],
    body: 'Allow exporting issues as CSV',
  };

  const bothIssue = {
    number: 103,
    title: 'Conflicting labels task',
    labels: [{ name: 'bug' }, { name: 'enhancement' }],
    body: 'Has both labels',
  };

  const neitherIssue = {
    number: 104,
    title: 'Docs only task',
    labels: [{ name: 'documentation' }],
    body: 'Update documentation',
  };

  const nullIssue = null;

  // Case 1: Bug issue
  for (const render of [
    (issue) => renderSingleIssueBrief(issue, { useWorktree: false }),
    (issue) => renderBatchLaunchPrompt(issue),
  ]) {
    const prompt = render(bugIssue);
    assert.ok(prompt.includes('resolved as `bug`'), 'Bug issue must resolve as bug');
    assert.ok(prompt.includes('Bug path: observed versus expected behaviour'), 'Must include bug path');
    assert.ok(!prompt.includes('Feature path:'), 'Bug prompt must isolate path and exclude feature path');
    assert.ok(!prompt.includes('Explicit alignment question:'), 'Bug prompt must not include alignment question');
    assert.ok(
      prompt.includes('The `### Work Log:` section is optional at issue creation; once work starts, the Work Log must contain exactly one sentence'),
      'Must include single Work Log sentence requirement'
    );
    assert.ok(
      prompt.includes('human authority over release and closure'),
      'Must retain human authority over release and closure'
    );
  }

  // Case 2: Feature issue (enhancement label)
  for (const render of [
    (issue) => renderSingleIssueBrief(issue, { useWorktree: false }),
    (issue) => renderBatchLaunchPrompt(issue),
  ]) {
    const prompt = render(featIssue);
    assert.ok(prompt.includes('resolved as `feature`'), 'Feature issue must resolve as feature');
    assert.ok(prompt.includes('Feature path: desired outcome'), 'Must include feature path');
    assert.ok(!prompt.includes('Bug path:'), 'Feature prompt must isolate path and exclude bug path');
    assert.ok(!prompt.includes('Explicit alignment question:'), 'Feature prompt must not include alignment question');
    assert.ok(
      prompt.includes('The `### Work Log:` section is optional at issue creation; once work starts, the Work Log must contain exactly one sentence'),
      'Must include single Work Log sentence requirement'
    );
    assert.ok(
      prompt.includes('human authority over release and closure'),
      'Must retain human authority over release and closure'
    );
  }

  // Case 3: Both labels -> undecided
  for (const render of [
    (issue) => renderSingleIssueBrief(issue, { useWorktree: false }),
    (issue) => renderBatchLaunchPrompt(issue),
  ]) {
    const prompt = render(bothIssue);
    assert.ok(
      prompt.includes('Explicit alignment question: Which label (`bug` or `enhancement`) applies to this issue'),
      'Must emit explicit alignment question when both labels are present'
    );
    assert.ok(
      prompt.includes('Only block work that depends on the unanswered question; independent authorised work continues.'),
      'Must state independent work continues while alignment question is open'
    );
    assert.ok(!prompt.includes('resolved as `bug`'), 'Must not claim resolved as bug');
    assert.ok(!prompt.includes('resolved as `feature`'), 'Must not claim resolved as feature');
    assert.ok(
      prompt.includes('The `### Work Log:` section is optional at issue creation; once work starts, the Work Log must contain exactly one sentence'),
      'Must include single Work Log sentence requirement'
    );
    assert.ok(
      prompt.includes('human authority over release and closure'),
      'Must retain human authority over release and closure'
    );
  }

  // Case 4: Neither label -> undecided
  for (const render of [
    (issue) => renderSingleIssueBrief(issue, { useWorktree: false }),
    (issue) => renderBatchLaunchPrompt(issue),
  ]) {
    const prompt = render(neitherIssue);
    assert.ok(
      prompt.includes('Explicit alignment question: Which label (`bug` or `enhancement`) applies to this issue'),
      'Must emit explicit alignment question when neither label is present'
    );
    assert.ok(
      prompt.includes('Only block work that depends on the unanswered question; independent authorised work continues.'),
      'Must state independent work continues while alignment question is open'
    );
    assert.ok(!prompt.includes('resolved as `bug`'), 'Must not claim resolved as bug');
    assert.ok(!prompt.includes('resolved as `feature`'), 'Must not claim resolved as feature');
    assert.ok(
      prompt.includes('The `### Work Log:` section is optional at issue creation; once work starts, the Work Log must contain exactly one sentence'),
      'Must include single Work Log sentence requirement'
    );
    assert.ok(
      prompt.includes('human authority over release and closure'),
      'Must retain human authority over release and closure'
    );
  }

  // Case 5: Null issue -> undecided
  for (const render of [
    (issue) => renderSingleIssueBrief(issue, { useWorktree: false }),
    (issue) => renderBatchLaunchPrompt(issue),
  ]) {
    const prompt = render(nullIssue);
    assert.ok(
      prompt.includes('Explicit alignment question: Which label (`bug` or `enhancement`) applies to this issue'),
      'Must emit explicit alignment question when issue is null'
    );
    assert.ok(
      prompt.includes('Only block work that depends on the unanswered question; independent authorised work continues.'),
      'Must state independent work continues while alignment question is open'
    );
    assert.ok(!prompt.includes('resolved as `bug`'), 'Must not claim resolved as bug');
    assert.ok(!prompt.includes('resolved as `feature`'), 'Must not claim resolved as feature');
    assert.ok(
      prompt.includes('The `### Work Log:` section is optional at issue creation; once work starts, the Work Log must contain exactly one sentence'),
      'Must include single Work Log sentence requirement'
    );
    assert.ok(
      prompt.includes('human authority over release and closure'),
      'Must retain human authority over release and closure'
    );
  }

  // Worktree option differentiation for single-issue brief
  const briefWt = renderSingleIssueBrief(bugIssue, { useWorktree: true });
  assert.ok(briefWt.includes('Please inspect the codebase in this worktree'));
  assert.ok(!briefWt.includes('in this workspace'));

  const briefWs = renderSingleIssueBrief(bugIssue, { useWorktree: false });
  assert.ok(briefWs.includes('Please inspect the codebase in this workspace'));
  assert.ok(!briefWs.includes('in this worktree'));
});

test('panel/main.ts source wiring connects live launch paths to pure renderers and rejects generic fallback', () => {
  const MAIN_TS = fs.readFileSync(path.join(here, '..', 'panel', 'main.ts'), 'utf8');

  const updatePreflightMatch = MAIN_TS.match(/function updatePreflightBrief\(\): void \{([\s\S]*?)\n\}/);
  assert.ok(updatePreflightMatch, 'updatePreflightBrief function body must be present in panel/main.ts');
  const updatePreflightBody = updatePreflightMatch[1];

  assert.match(
    updatePreflightBody,
    /\brenderSingleIssueBrief\s*\(/,
    'updatePreflightBrief must invoke renderSingleIssueBrief'
  );
  assert.ok(
    !updatePreflightBody.includes('DEFAULT_WORK_INSTRUCTIONS'),
    'updatePreflightBrief must not fall back to generic DEFAULT_WORK_INSTRUCTIONS'
  );

  const launchBatchMatch = MAIN_TS.match(/async function launchBatchSeparateSessions\(\): Promise<void> \{([\s\S]*?)\n\}/);
  assert.ok(launchBatchMatch, 'launchBatchSeparateSessions function body must be present in panel/main.ts');
  const launchBatchBody = launchBatchMatch[1];

  assert.match(
    launchBatchBody,
    /\brenderBatchLaunchPrompt\s*\(/,
    'launchBatchSeparateSessions must invoke renderBatchLaunchPrompt'
  );
  assert.ok(
    !launchBatchBody.includes('DEFAULT_WORK_INSTRUCTIONS'),
    'launchBatchSeparateSessions must not fall back to generic DEFAULT_WORK_INSTRUCTIONS'
  );
});
