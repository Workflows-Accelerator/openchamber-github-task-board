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
} from '../panel/core.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const MAIN_TS = fs.readFileSync(path.join(here, '..', 'panel', 'main.ts'), 'utf8');
const CONTRACT_MD = fs.readFileSync(path.join(here, '..', 'docs', 'issue-body-contract.md'), 'utf8');

function containsEmoji(text) {
  if (!text) return false;
  const emojiRegex = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F000}-\u{1F02F}\u{1F0A0}-\u{1F0FF}]/u;
  return emojiRegex.test(text);
}

test('Work Log contract in docs/issue-body-contract.md specifies single justification sentence and rules', () => {
  assert.ok(CONTRACT_MD.includes('### 2.8 `### Work Log:`'), 'Must include Section 2.8 Work Log');
  assert.ok(
    CONTRACT_MD.includes('exactly one justification sentence') ||
    CONTRACT_MD.includes('exactly one required sentence'),
    'Must specify exactly one required/justification sentence'
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
    DEFAULT_WORK_INSTRUCTIONS.includes('when both or neither are present the work type is undecided and must be asked about, not guessed') ||
    DEFAULT_WORK_INSTRUCTIONS.includes('when both or neither are present, the work type is undecided and must be asked about, not guessed') ||
    DEFAULT_WORK_INSTRUCTIONS.includes('When both or neither are present, the work type is undecided and must be asked about, not guessed'),
    'Must state undecided rule when both or neither are present'
  );
  assert.ok(
    DEFAULT_WORK_INSTRUCTIONS.includes('never infer a type from the title, the mood of the report, or the area of the code') ||
    DEFAULT_WORK_INSTRUCTIONS.includes('Never infer a type from the title, the mood of the report, or the area of the code'),
    'Must forbid guessing type from title, mood, or area'
  );

  // Question protocol
  assert.ok(
    DEFAULT_WORK_INSTRUCTIONS.includes('Only block work that depends on the unanswered question; independent authorised work continues') ||
    DEFAULT_WORK_INSTRUCTIONS.includes('only block work that depends on the unanswered question; independent authorised work continues'),
    'Must state only block dependent work while independent work continues'
  );
  assert.ok(
    DEFAULT_WORK_INSTRUCTIONS.includes('Undecided work type is an alignment question to the user, not a default') ||
    DEFAULT_WORK_INSTRUCTIONS.includes('undecided work type is an alignment question to the user, not a default'),
    'Must state undecided is alignment question not default'
  );

  // Work Log justification sentence
  assert.ok(
    DEFAULT_WORK_INSTRUCTIONS.includes('exactly one required sentence') ||
    DEFAULT_WORK_INSTRUCTIONS.includes('Exactly one required sentence') ||
    DEFAULT_WORK_INSTRUCTIONS.includes('exactly one required justification sentence'),
    'Must require exactly one Work Log sentence'
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
    bugTmpl.includes('observed versus expected behaviour') ||
    bugTmpl.includes('Observed versus expected behaviour'),
    'Bug template must ask for observed versus expected behaviour'
  );
  assert.ok(
    bugTmpl.includes('Steps to Reproduce') || bugTmpl.includes('Reproduction'),
    'Bug template must ask for reproduction'
  );
  assert.ok(!bugTmpl.includes('Work Type:'), 'Bug template must not add a work type field');
  assert.ok(!bugTmpl.includes('type:'), 'Bug template must not add type:* labels');
  assert.ok(!/expir/i.test(bugTmpl), 'Bug template must not mention expiration');

  const featTmpl = DEFAULT_TEMPLATES.feature.promptInstructions;
  assert.ok(
    featTmpl.includes('Desired outcome') || featTmpl.includes('desired outcome'),
    'Feature template must ask for desired outcome'
  );
  assert.ok(
    featTmpl.includes('Research') || featTmpl.includes('Alternatives') || featTmpl.includes('research'),
    'Feature template must cover research and alternatives'
  );
  assert.ok(!featTmpl.includes('Work Type:'), 'Feature template must not add a work type field');
});

test('DEFAULT_AI_ISSUE_PROMPT enforces single work-type source, Work Log justification, and zero emojis', () => {
  assert.equal(containsEmoji(DEFAULT_AI_ISSUE_PROMPT), false);
  assert.ok(
    DEFAULT_AI_ISSUE_PROMPT.includes('`bug` and `enhancement`') ||
    DEFAULT_AI_ISSUE_PROMPT.includes('"bug" and "enhancement"'),
    'Must name bug and enhancement as work type source'
  );
  assert.ok(
    DEFAULT_AI_ISSUE_PROMPT.includes('undecided and must be asked about, not guessed') ||
    DEFAULT_AI_ISSUE_PROMPT.includes('undecided and must be asked about'),
    'Must state undecided rule'
  );
  assert.ok(
    DEFAULT_AI_ISSUE_PROMPT.includes('Work Log') &&
    (DEFAULT_AI_ISSUE_PROMPT.includes('one justification sentence') || DEFAULT_AI_ISSUE_PROMPT.includes('one required sentence')),
    'Must describe Work Log single sentence requirement'
  );
  assert.ok(!DEFAULT_AI_ISSUE_PROMPT.includes('### Work Type:'), 'Must not add ### Work Type: field');
});

test('buildConsolidatedIssuePrompt includes work instructions with proportionate paths', () => {
  const mockIssues = [
    { number: 1, title: 'Bug task', labels: [{ name: 'bug' }] },
    { number: 2, title: 'Feat task', labels: [{ name: 'enhancement' }] },
  ];
  const prompt = buildConsolidatedIssuePrompt(mockIssues);
  assert.ok(prompt.includes('Work Type & Proportionate Paths') || prompt.includes('Work Type'));
  assert.ok(prompt.includes('Bug path:'));
  assert.ok(prompt.includes('Feature path:'));
  assert.ok(prompt.includes('only work-type source'));
  assert.equal(containsEmoji(prompt), false);
});

test('panel/main.ts incorporates work instructions in single-issue preflight and launch prompts', () => {
  assert.ok(
    MAIN_TS.includes('DEFAULT_WORK_INSTRUCTIONS') ||
    (MAIN_TS.includes('Bug path:') && MAIN_TS.includes('Feature path:')),
    'panel/main.ts must incorporate work type instructions / proportionate paths'
  );
});
