import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execSync } from 'node:child_process';
import {
  parseFriendlyTitle,
  parseAcceptanceCriteria,
  parseSubtasks,
  parseOpenQuestions,
  parseHumanTasks,
  parseTestPlan,
  updateSubtaskInMarkdown,
  normalizeGithubIssues,
  resolveV2Metadata,
  resolveIssueColumn,
  groupIssuesByAttention,
  filterIssuesByAttention,
} from '../panel/core.ts';

test('parseAcceptanceCriteria extracts checkboxes under ### Acceptance Criteria: and stops at next heading', () => {
  const body = `
# Feature RFC

### Acceptance Criteria:
- [ ] AC 1: First criterion
- [x] AC 2: Second criterion

### Actionable Subtasks Checklist:
- [ ] Task 1
  `;
  const ac = parseAcceptanceCriteria(body);
  assert.equal(ac.length, 2);
  assert.equal(ac[0].text, 'AC 1: First criterion');
  assert.equal(ac[0].completed, false);
  assert.equal(ac[0].id, 'ac-4');
  assert.equal(ac[1].text, 'AC 2: Second criterion');
  assert.equal(ac[1].completed, true);
  assert.equal(ac[1].id, 'ac-5');
});

test('parseAcceptanceCriteria handles aliases, whitespace, CRLF, BOM, and code fences', () => {
  const bodyWithFence = `\uFEFF## Acceptance criteria\r\n- [ ] Valid AC\r\n\`\`\`\r\n- [ ] Code block checkbox\r\n\`\`\`\r\n- [x] Post fence AC\r\n## Next Section\r\n- [ ] Outside AC`;
  const ac = parseAcceptanceCriteria(bodyWithFence);
  assert.equal(ac.length, 2);
  assert.equal(ac[0].text, 'Valid AC');
  assert.equal(ac[0].completed, false);
  assert.equal(ac[1].text, 'Post fence AC');
  assert.equal(ac[1].completed, true);

  // Edge cases
  assert.deepEqual(parseAcceptanceCriteria(null), []);
  assert.deepEqual(parseAcceptanceCriteria(undefined), []);
  assert.deepEqual(parseAcceptanceCriteria(''), []);
  assert.deepEqual(parseAcceptanceCriteria('No sections here'), []);
});

test('parseSubtasks strictly scopes to ### Actionable Subtasks Checklist: and legacy aliases', () => {
  const bodyCanonical = `
### Friendly Title: Section Scoped Parsing

### Acceptance Criteria:
- [ ] Zero cross counting

### Actionable Subtasks Checklist:
- [ ] Implement parseAcceptanceCriteria
- [x] Refactor parseSubtasks

### Open Questions:
- [ ] Any other aliases?

## Test Plan (Issue)
- [ ] Unit tests pass
  `;

  const subtasks = parseSubtasks(bodyCanonical);
  assert.equal(subtasks.length, 2);
  assert.equal(subtasks[0].text, 'Implement parseAcceptanceCriteria');
  assert.equal(subtasks[0].completed, false);
  assert.equal(subtasks[1].text, 'Refactor parseSubtasks');
  assert.equal(subtasks[1].completed, true);

  // Test legacy alias ### Subtasks:
  const bodyLegacyH3 = `
### Subtasks:
- [ ] Legacy subtask 1
### Other
- [ ] Ignored
  `;
  const subtasksLegacyH3 = parseSubtasks(bodyLegacyH3);
  assert.equal(subtasksLegacyH3.length, 1);
  assert.equal(subtasksLegacyH3[0].text, 'Legacy subtask 1');

  // Test legacy alias ## Subtasks:
  const bodyLegacyH2 = `
## Subtasks:
- [ ] Legacy H2 subtask
## Other
- [ ] Ignored
  `;
  const subtasksLegacyH2 = parseSubtasks(bodyLegacyH2);
  assert.equal(subtasksLegacyH2.length, 1);
  assert.equal(subtasksLegacyH2[0].text, 'Legacy H2 subtask');
});

test('zero cross-counting across all standard markdown checklist sections', () => {
  const fullBody = `
### Friendly Title: Complete Section Isolation

## Overview
A comprehensive test document with all five checklist section types.

### Acceptance Criteria:
- [ ] AC item 1
- [x] AC item 2

### Actionable Subtasks Checklist:
- [ ] Subtask item 1
- [x] Subtask item 2

### Open Questions:
- [ ] Question item 1?
- [x] Question item 2? (Answered inline)

### Human Tasks:
- [ ] Human task 1
- [x] Human task 2

## Test Plan (Issue)
- [ ] Issue test 1
- [x] Issue test 2

## Test Plan (Batch)
- [ ] Batch test 1
- [x] Batch test 2
  `;

  const ac = parseAcceptanceCriteria(fullBody);
  const subtasks = parseSubtasks(fullBody);
  const questions = parseOpenQuestions(fullBody);
  const humanTasks = parseHumanTasks(fullBody);
  const testPlan = parseTestPlan(fullBody);

  // Assert counts
  assert.equal(ac.length, 2, 'Acceptance criteria count');
  assert.equal(subtasks.length, 2, 'Subtasks count');
  assert.equal(questions.length, 2, 'Open questions count');
  assert.equal(humanTasks.length, 2, 'Human tasks count');
  assert.equal(testPlan.issueTests.length, 2, 'Issue tests count');
  assert.equal(testPlan.batchTests.length, 2, 'Batch tests count');

  // Assert specific items
  assert.equal(ac[0].text, 'AC item 1');
  assert.equal(subtasks[0].text, 'Subtask item 1');
  assert.equal(questions[0].text, 'Question item 1?');
  assert.equal(humanTasks[0].text, 'Human task 1');
  assert.equal(testPlan.issueTests[0].text, 'Issue test 1');
  assert.equal(testPlan.batchTests[0].text, 'Batch test 1');

  // Check that NO cross-contamination exists in subtasks
  const subtaskTexts = subtasks.map((s) => s.text);
  assert.ok(!subtaskTexts.includes('AC item 1'), 'subtasks must not include AC');
  assert.ok(!subtaskTexts.includes('Question item 1?'), 'subtasks must not include questions');
  assert.ok(!subtaskTexts.includes('Human task 1'), 'subtasks must not include human tasks');
  assert.ok(!subtaskTexts.includes('Issue test 1'), 'subtasks must not include issue tests');
  assert.ok(!subtaskTexts.includes('Batch test 1'), 'subtasks must not include batch tests');
});

test('legacy fallback: unsectioned raw markdown retains subtask checklist parsing', () => {
  const rawBody = `
Just a raw todo list without standard sections:
- [ ] Raw todo 1
- [x] Raw todo 2
* [ ] Bullet todo 3
1. [x] Numbered todo 4
  `;

  const subtasks = parseSubtasks(rawBody);
  assert.equal(subtasks.length, 4);
  assert.equal(subtasks[0].text, 'Raw todo 1');
  assert.equal(subtasks[1].text, 'Raw todo 2');
  assert.equal(subtasks[2].text, 'Bullet todo 3');
  assert.equal(subtasks[3].text, 'Numbered todo 4');
});

test('fallback exclusion: body with Acceptance Criteria or Test Plan but NO subtasks section produces 0 subtasks', () => {
  const bodyWithoutSubtasks = `
### Acceptance Criteria:
- [ ] AC item without subtasks section

## Test Plan (Issue)
- [ ] Test item without subtasks section
  `;

  const subtasks = parseSubtasks(bodyWithoutSubtasks);
  assert.equal(subtasks.length, 0, 'Must not capture AC or Test Plan as subtasks');

  const ac = parseAcceptanceCriteria(bodyWithoutSubtasks);
  assert.equal(ac.length, 1);
  assert.equal(ac[0].text, 'AC item without subtasks section');
});

test('lineIndex accuracy allows updateSubtaskInMarkdown to toggle target checkbox cleanly', () => {
  const body = `### Acceptance Criteria:
- [ ] AC 1
- [ ] AC 2

### Actionable Subtasks Checklist:
- [ ] Subtask 1
- [ ] Subtask 2`;

  const ac = parseAcceptanceCriteria(body);
  const subtasks = parseSubtasks(body);

  assert.equal(ac[0].lineIndex, 1);
  assert.equal(ac[1].lineIndex, 2);
  assert.equal(subtasks[0].lineIndex, 5);
  assert.equal(subtasks[1].lineIndex, 6);

  // Toggle AC 2
  const updatedAc = updateSubtaskInMarkdown(body, ac[1].lineIndex, true);
  const reParsedAc = parseAcceptanceCriteria(updatedAc);
  assert.equal(reParsedAc[1].completed, true);
  assert.equal(reParsedAc[0].completed, false);

  // Toggle Subtask 1
  const updatedSubtask = updateSubtaskInMarkdown(body, subtasks[0].lineIndex, true);
  const reParsedSubtasks = parseSubtasks(updatedSubtask);
  assert.equal(reParsedSubtasks[0].completed, true);
  assert.equal(reParsedSubtasks[1].completed, false);
});

test('normalizeGithubIssues attaches acceptanceCriteria and isolates subtasks', () => {
  const rawApiItems = [
    {
      number: 101,
      title: 'Issue with sections',
      body: '### Acceptance Criteria:\n- [ ] AC 1\n\n### Actionable Subtasks Checklist:\n- [ ] Task 1',
      state: 'open',
    },
    {
      number: 102,
      title: 'Issue without AC',
      body: '### Actionable Subtasks Checklist:\n- [ ] Only task',
      state: 'open',
    },
  ];

  const normalized = normalizeGithubIssues(rawApiItems);
  assert.equal(normalized.length, 2);
  assert.equal(normalized[0].acceptanceCriteria?.length, 1);
  assert.equal(normalized[0].acceptanceCriteria?.[0].text, 'AC 1');
  assert.equal(normalized[0].subtasks.length, 1);
  assert.equal(normalized[0].subtasks[0].text, 'Task 1');

  assert.equal(normalized[1].acceptanceCriteria, undefined);
  assert.equal(normalized[1].subtasks.length, 1);
  assert.equal(normalized[1].subtasks[0].text, 'Only task');
});

test('resolveV2Metadata correctly parses explicit v2 labels for all 4 axes', () => {
  const v2Exploration = {
    number: 201,
    title: 'Explore caching strategy',
    body: 'Investigate Redis vs SQLite in-memory',
    state: 'open',
    labels: [
      { name: 'phase:exploration' },
      { name: 'attention:needs-decision' },
      { name: 'liveness:idle' },
      { name: 'dependency:ready' },
    ],
  };

  const meta1 = resolveV2Metadata(v2Exploration);
  assert.equal(meta1.phase, 'exploration');
  assert.equal(meta1.attention, 'needs-decision');
  assert.equal(meta1.liveness, 'idle');
  assert.equal(meta1.dependencyState, 'ready');
  assert.equal(meta1.isExplicitV2, true);

  // Test hyphenated phase alias and permission attention
  const v2HumanVerif = {
    number: 202,
    title: 'Deploy to staging',
    body: 'Blocked by #201\n\n### Human Tasks:\n- [ ] Grant production access token',
    state: 'open',
    labels: [
      { name: 'phase:human-verification' },
      { name: 'attention:needs-permission' },
      { name: 'dependency:blocked' },
    ],
  };

  const meta2 = resolveV2Metadata(v2HumanVerif);
  assert.equal(meta2.phase, 'human_verification');
  assert.equal(meta2.attention, 'needs-permission');
  assert.equal(meta2.dependencyState, 'blocked-by-dependency');
  assert.equal(meta2.isExplicitV2, true);

  // Test review attention and running liveness
  const v2Verif = {
    number: 203,
    title: 'Review implementation PR',
    body: 'Implementation complete',
    state: 'open',
    labels: [
      { name: 'phase:verification' },
      { name: 'attention:needs-review' },
      { name: 'liveness:running' },
    ],
  };

  const meta3 = resolveV2Metadata(v2Verif);
  assert.equal(meta3.phase, 'verification');
  assert.equal(meta3.attention, 'needs-review');
  assert.equal(meta3.liveness, 'running');
  assert.equal(meta3.isExplicitV2, true);
});

test('resolveV2Metadata preserves orthogonality: phase is unaffected by attention state', () => {
  // Phase is exploration, questions drive attention to needs-decision
  const exploringWithQuestions = {
    number: 204,
    title: 'Spike on API',
    body: '### Open Questions:\n- [ ] Should we use GraphQL or REST?',
    state: 'open',
    labels: [{ name: 'phase:exploration' }],
  };
  const metaExp = resolveV2Metadata(exploringWithQuestions);
  assert.equal(metaExp.phase, 'exploration', 'Phase remains exploration');
  assert.equal(metaExp.attention, 'needs-decision', 'Attention driven by open questions');

  // Phase is execution, human task for permission drives attention to needs-permission
  const executingNeedsPerm = {
    number: 205,
    title: 'Setup cloud database',
    body: '### Human Tasks:\n- [ ] Grant AWS credentials for database access',
    state: 'open',
    labels: [{ name: 'phase:execution' }],
  };
  const metaExec = resolveV2Metadata(executingNeedsPerm);
  assert.equal(metaExec.phase, 'execution', 'Phase remains execution');
  assert.equal(metaExec.attention, 'needs-permission', 'Attention derived from credential task');

  // Phase is verification, human task for review drives attention to needs-review
  const verifNeedsReview = {
    number: 206,
    title: 'Final sign-off',
    body: '### Human Tasks:\n- [ ] Review PR #45 and approve',
    state: 'open',
    labels: [{ name: 'phase:verification' }],
  };
  const metaVerif = resolveV2Metadata(verifNeedsReview);
  assert.equal(metaVerif.phase, 'verification', 'Phase remains verification');
  assert.equal(metaVerif.attention, 'needs-review', 'Attention derived from review task');

  // Phase is planning with NO open questions or human tasks
  const planningClean = {
    number: 207,
    title: 'Draft architecture roadmap',
    body: '### Actionable Subtasks Checklist:\n- [ ] Step 1\n- [ ] Step 2',
    state: 'open',
    labels: [{ name: 'phase:planning' }],
  };
  const metaPlan = resolveV2Metadata(planningClean);
  assert.equal(metaPlan.phase, 'planning');
  assert.equal(metaPlan.attention, 'none');
});

test('resolveV2Metadata correctly projects v1 status labels when v2 metadata is absent', () => {
  // status:draft -> phase: draft
  const v1Draft = {
    number: 1,
    title: 'Draft feature',
    body: 'Simple notes',
    state: 'open',
    labels: [{ name: 'status:draft' }],
  };
  const metaDraft = resolveV2Metadata(v1Draft);
  assert.equal(metaDraft.phase, 'draft');
  assert.equal(metaDraft.attention, 'none');
  assert.equal(metaDraft.isExplicitV2, false);

  // status:draft with questions -> phase: draft, attention: needs-decision
  const v1DraftQ = {
    number: 2,
    title: 'Draft with Qs',
    body: '### Open Questions:\n- [ ] What color?',
    state: 'open',
    labels: [{ name: 'status:draft' }],
  };
  const metaDraftQ = resolveV2Metadata(v1DraftQ);
  assert.equal(metaDraftQ.phase, 'draft');
  assert.equal(metaDraftQ.attention, 'needs-decision');

  // status:backlog -> phase: draft
  const v1Backlog = {
    number: 3,
    title: 'Backlog task',
    body: '',
    state: 'open',
    labels: [{ name: 'status:backlog' }],
  };
  assert.equal(resolveV2Metadata(v1Backlog).phase, 'draft');

  // status:todo -> phase: planning
  const v1Todo = {
    number: 4,
    title: 'Todo task',
    body: 'Ready for work',
    state: 'open',
    labels: [{ name: 'status:todo' }],
  };
  assert.equal(resolveV2Metadata(v1Todo).phase, 'planning');

  // status:planned -> phase: planning
  const v1Planned = {
    number: 5,
    title: 'Planned task',
    body: '',
    state: 'open',
    labels: [{ name: 'status:planned' }],
  };
  assert.equal(resolveV2Metadata(v1Planned).phase, 'planning');

  // status:in-progress -> phase: execution
  const v1InProgress = {
    number: 6,
    title: 'In progress task',
    body: '',
    state: 'open',
    labels: [{ name: 'status:in-progress' }],
  };
  assert.equal(resolveV2Metadata(v1InProgress).phase, 'execution');

  // status:in-review -> phase: verification
  const v1InReview = {
    number: 7,
    title: 'In review task',
    body: '',
    state: 'open',
    labels: [{ name: 'status:in-review' }],
  };
  assert.equal(resolveV2Metadata(v1InReview).phase, 'verification');

  // status:needs-human -> phase: execution, attention: needs-review
  const v1NeedsHuman = {
    number: 8,
    title: 'Needs human task',
    body: 'Agent blocked on validation',
    state: 'open',
    labels: [{ name: 'status:needs-human' }],
  };
  const metaNeedsHuman = resolveV2Metadata(v1NeedsHuman);
  assert.equal(metaNeedsHuman.phase, 'execution');
  assert.equal(metaNeedsHuman.attention, 'needs-review');

  // status:done -> phase: done
  const v1Done = {
    number: 9,
    title: 'Done task',
    body: '',
    state: 'closed',
    labels: [{ name: 'status:done' }],
  };
  const metaDone = resolveV2Metadata(v1Done);
  assert.equal(metaDone.phase, 'done');
  assert.equal(metaDone.attention, 'none');
  assert.equal(metaDone.liveness, 'completed');
});

test('resolveV2Metadata derives liveness and dependencyState from linked session and body dependencies', () => {
  const issueWithBlocker = {
    number: 301,
    title: 'Child task',
    body: '## Subtasks\n- [ ] Work\n\nBlocked by #300',
    state: 'open',
    labels: [{ name: 'status:todo' }],
  };

  // Blocked without session -> idle, blocked-by-dependency
  const metaBlocked = resolveV2Metadata(issueWithBlocker);
  assert.equal(metaBlocked.dependencyState, 'blocked-by-dependency');
  assert.equal(metaBlocked.liveness, 'idle');

  // When blocker is closed, resolve with allIssues
  const issuesList = [
    issueWithBlocker,
    { number: 300, title: 'Parent task', body: '', state: 'closed', labels: [{ name: 'status:done' }] },
  ];
  const metaResolved = resolveV2Metadata(issueWithBlocker, null, issuesList);
  assert.equal(metaResolved.dependencyState, 'ready');

  // Linked session running
  const runningSession = {
    id: 'ses_1',
    activity: 'running',
    items: [{ id: '301', data: { issueNumber: 301 } }],
  };
  const metaRunning = resolveV2Metadata(issueWithBlocker, runningSession);
  assert.equal(metaRunning.liveness, 'running');

  // Linked session waiting-permission
  const waitingPermSession = {
    id: 'ses_2',
    activity: 'waiting-permission',
    items: [{ id: '301' }],
  };
  const metaWaitingPerm = resolveV2Metadata(issueWithBlocker, waitingPermSession);
  assert.equal(metaWaitingPerm.liveness, 'idle');
  assert.equal(metaWaitingPerm.attention, 'needs-permission');

  // Linked session waiting-question
  const waitingQuestSession = {
    id: 'ses_3',
    activity: 'waiting-question',
    items: [{ id: '301' }],
  };
  const metaWaitingQuest = resolveV2Metadata(issueWithBlocker, waitingQuestSession);
  assert.equal(metaWaitingQuest.attention, 'needs-decision');

  // Linked session failed
  const failedSession = {
    id: 'ses_4',
    activity: 'failed',
    status: 'failed',
    items: [{ id: '301' }],
  };
  const metaFailed = resolveV2Metadata(issueWithBlocker, failedSession);
  assert.equal(metaFailed.liveness, 'failed');
});

test('resolveIssueColumn preserves exact v1 behavior and projects v2 issues into Kanban columns', () => {
  // 1. v1 issues resolve identically to baseline
  const legacyTodo = { number: 10, title: 'Todo', state: 'open', labels: [{ name: 'status:todo' }] };
  assert.equal(resolveIssueColumn(legacyTodo), 'todo');

  const legacyProgress = { number: 11, title: 'In Progress', state: 'open', labels: [{ name: 'status:in-progress' }] };
  assert.equal(resolveIssueColumn(legacyProgress), 'in-progress');

  const runningSession = { activity: 'running', items: [{ id: '10' }] };
  assert.equal(resolveIssueColumn(legacyTodo, runningSession), 'in-progress');

  const idleSession = { activity: 'idle', items: [{ id: '11' }] };
  assert.equal(resolveIssueColumn(legacyProgress, idleSession), 'needs-human');

  // 2. v2 issues project cleanly into Kanban columns
  const v2Exploration = {
    number: 20,
    title: 'v2 exploration',
    state: 'open',
    labels: [{ name: 'phase:exploration' }, { name: 'attention:none' }],
  };
  assert.equal(resolveIssueColumn(v2Exploration), 'draft');

  const v2ExplorationBlocked = {
    number: 21,
    title: 'v2 exploration with decision',
    state: 'open',
    labels: [{ name: 'phase:exploration' }, { name: 'attention:needs-decision' }],
  };
  assert.equal(resolveIssueColumn(v2ExplorationBlocked), 'needs-human');

  const v2Planning = {
    number: 22,
    title: 'v2 planning',
    state: 'open',
    labels: [{ name: 'phase:planning' }, { name: 'attention:none' }],
  };
  assert.equal(resolveIssueColumn(v2Planning), 'todo');

  const v2Execution = {
    number: 23,
    title: 'v2 execution',
    state: 'open',
    labels: [{ name: 'phase:execution' }, { name: 'attention:none' }],
  };
  assert.equal(resolveIssueColumn(v2Execution), 'in-progress');

  const v2Verification = {
    number: 24,
    title: 'v2 verification',
    state: 'open',
    labels: [{ name: 'phase:verification' }, { name: 'attention:none' }],
  };
  assert.equal(resolveIssueColumn(v2Verification), 'in-review');

  const v2Done = {
    number: 25,
    title: 'v2 done',
    state: 'open',
    labels: [{ name: 'phase:done' }, { name: 'attention:none' }],
  };
  assert.equal(resolveIssueColumn(v2Done), 'done');
});

test('normalizeGithubIssues attaches v2Metadata with zero undefined fields', () => {
  const rawApiItems = [
    {
      number: 401,
      title: 'v2 exploration item',
      body: '### Open Questions:\n- [ ] Choice A or B?',
      state: 'open',
      labels: [{ name: 'phase:exploration' }],
    },
    {
      number: 402,
      title: 'v1 legacy item',
      body: 'Working on implementation',
      state: 'open',
      labels: [{ name: 'status:in-progress' }],
    },
  ];

  const normalized = normalizeGithubIssues(rawApiItems);
  assert.equal(normalized.length, 2);

  // Check 401
  assert.ok(normalized[0].v2Metadata, 'v2Metadata must be present');
  assert.equal(normalized[0].v2Metadata?.phase, 'exploration');
  assert.equal(normalized[0].v2Metadata?.attention, 'needs-decision');
  assert.equal(normalized[0].v2Metadata?.isExplicitV2, true);

  // Check 402
  assert.ok(normalized[1].v2Metadata, 'v2Metadata must be present');
  assert.equal(normalized[1].v2Metadata?.phase, 'execution');
  assert.equal(normalized[1].v2Metadata?.attention, 'none');
  assert.equal(normalized[1].v2Metadata?.isExplicitV2, false);

  // Assert no undefined values in v2Metadata
  for (const item of normalized) {
    if (item.v2Metadata) {
      for (const [key, val] of Object.entries(item.v2Metadata)) {
        assert.notEqual(val, undefined, `v2Metadata property "${key}" must not be undefined`);
      }
    }
  }
});

test('groupIssuesByAttention partitions issues into needs-decision, needs-permission, needs-review, and none', () => {
  const issues = [
    {
      number: 501,
      title: 'Needs Decision Item',
      state: 'open',
      labels: [{ name: 'attention:needs-decision' }],
    },
    {
      number: 502,
      title: 'Needs Permission Item',
      state: 'open',
      labels: [{ name: 'attention:needs-permission' }],
    },
    {
      number: 503,
      title: 'Needs Review Item',
      state: 'open',
      labels: [{ name: 'attention:needs-review' }],
    },
    {
      number: 504,
      title: 'No Attention Needed Item',
      state: 'open',
      labels: [{ name: 'attention:none' }],
    },
  ];

  const grouped = groupIssuesByAttention(issues);
  assert.ok(grouped['needs-decision'], 'needs-decision bucket exists');
  assert.ok(grouped['needs-permission'], 'needs-permission bucket exists');
  assert.ok(grouped['needs-review'], 'needs-review bucket exists');
  assert.ok(grouped['none'], 'none bucket exists');

  assert.equal(grouped['needs-decision'].length, 1);
  assert.equal(grouped['needs-decision'][0].number, 501);

  assert.equal(grouped['needs-permission'].length, 1);
  assert.equal(grouped['needs-permission'][0].number, 502);

  assert.equal(grouped['needs-review'].length, 1);
  assert.equal(grouped['needs-review'][0].number, 503);

  assert.equal(grouped['none'].length, 1);
  assert.equal(grouped['none'][0].number, 504);
});

test('groupIssuesByAttention preserves orthogonality across diverse workflow phases', () => {
  const issues = [
    // Exploration phase with open questions -> needs-decision
    {
      number: 601,
      title: 'Exploration with questions',
      state: 'open',
      labels: [{ name: 'phase:exploration' }],
      body: '### Open Questions:\n- [ ] Which architecture to choose?',
    },
    // Alignment phase with open questions -> needs-decision
    {
      number: 602,
      title: 'Alignment with open questions',
      state: 'open',
      labels: [{ name: 'phase:alignment' }],
      body: '### Open Questions:\n- [ ] Clarify scope boundary',
    },
    // Planning phase with no questions or human tasks -> none
    {
      number: 603,
      title: 'Planning ready task',
      state: 'open',
      labels: [{ name: 'phase:planning' }],
      body: '### Actionable Subtasks Checklist:\n- [ ] Prepare schema',
    },
    // Planning phase with human task for credential -> needs-permission
    {
      number: 604,
      title: 'Planning with permission requirement',
      state: 'open',
      labels: [{ name: 'phase:planning' }],
      body: '### Human Tasks:\n- [ ] Grant AWS credentials for database provisioning',
    },
    // Execution phase with human task for deployment -> needs-permission
    {
      number: 605,
      title: 'Execution awaiting deployment permission',
      state: 'open',
      labels: [{ name: 'phase:execution' }],
      body: '### Human Tasks:\n- [ ] Provision and deploy staging environment',
    },
    // Execution phase with human task for manual testing/validation -> needs-review
    {
      number: 606,
      title: 'Execution awaiting human sanity check',
      state: 'open',
      labels: [{ name: 'phase:execution' }],
      body: '### Human Tasks:\n- [ ] Sanity check UI responsive layout on mobile',
    },
    // Verification phase with human task to review PR -> needs-review
    {
      number: 607,
      title: 'Verification awaiting PR sign-off',
      state: 'open',
      labels: [{ name: 'phase:verification' }],
      body: '### Human Tasks:\n- [ ] Review PR #42 and approve merge',
    },
    // Publication phase with explicit permission request -> needs-permission
    {
      number: 608,
      title: 'Publication needing release token',
      state: 'open',
      labels: [{ name: 'phase:publication' }, { name: 'attention:needs-permission' }],
    },
    // Done issue with open questions remaining -> none (completed tasks need no human attention)
    {
      number: 609,
      title: 'Done task with stale question',
      state: 'closed',
      labels: [{ name: 'phase:done' }],
      body: '### Open Questions:\n- [ ] Was this tested?',
    },
    // Archive issue -> none
    {
      number: 610,
      title: 'Archived historical task',
      state: 'open',
      labels: [{ name: 'phase:archive' }],
    },
    // Exploration phase with explicit attention:needs-permission (orthogonal override)
    {
      number: 611,
      title: 'Exploration needing cloud sandbox access',
      state: 'open',
      labels: [{ name: 'phase:exploration' }, { name: 'attention:needs-permission' }],
    },
    // Verification phase with explicit attention:needs-decision
    {
      number: 612,
      title: 'Verification needing product call on edge case',
      state: 'open',
      labels: [{ name: 'phase:verification' }, { name: 'attention:needs-decision' }],
    },
  ];

  const grouped = groupIssuesByAttention(issues);

  // needs-decision: 601 (exploration Q), 602 (alignment Q), 612 (verification explicit needs-decision)
  const decisionNums = grouped['needs-decision'].map((i) => i.number).sort((a, b) => a - b);
  assert.deepEqual(decisionNums, [601, 602, 612]);

  // needs-permission: 604 (planning AWS creds), 605 (execution deploy), 608 (publication explicit), 611 (exploration explicit)
  const permNums = grouped['needs-permission'].map((i) => i.number).sort((a, b) => a - b);
  assert.deepEqual(permNums, [604, 605, 608, 611]);

  // needs-review: 606 (execution sanity check), 607 (verification PR review)
  const reviewNums = grouped['needs-review'].map((i) => i.number).sort((a, b) => a - b);
  assert.deepEqual(reviewNums, [606, 607]);

  // none: 603 (planning clean), 609 (done), 610 (archive)
  const noneNums = grouped['none'].map((i) => i.number).sort((a, b) => a - b);
  assert.deepEqual(noneNums, [603, 609, 610]);
});

test('groupIssuesByAttention derives attention from linked sessions via sessionIndex', () => {
  const issues = [
    { number: 701, title: 'Issue 701', state: 'open', labels: [{ name: 'status:in-progress' }] },
    { number: 702, title: 'Issue 702', state: 'open', labels: [{ name: 'status:in-progress' }] },
    { number: 703, title: 'Issue 703', state: 'open', labels: [{ name: 'status:in-progress' }] },
    { number: 704, title: 'Issue 704', state: 'open', labels: [{ name: 'status:in-progress' }] },
    { number: 705, title: 'Issue 705', state: 'open', labels: [{ name: 'status:todo' }] },
  ];

  const sessionIndex = new Map();
  sessionIndex.set(701, { id: 's-1', activity: 'waiting-permission' });
  sessionIndex.set(702, { id: 's-2', activity: 'waiting-question' });
  sessionIndex.set(703, { id: 's-3', activity: 'waiting-review' });
  sessionIndex.set(704, { id: 's-4', activity: 'running' });
  // 705 has no session

  const grouped = groupIssuesByAttention(issues, sessionIndex);

  assert.equal(grouped['needs-permission'].length, 1);
  assert.equal(grouped['needs-permission'][0].number, 701);

  assert.equal(grouped['needs-decision'].length, 1);
  assert.equal(grouped['needs-decision'][0].number, 702);

  assert.equal(grouped['needs-review'].length, 1);
  assert.equal(grouped['needs-review'][0].number, 703);

  // 704 (running, no human tasks) and 705 (todo, no session, clean) both resolve to none
  const noneNums = grouped['none'].map((i) => i.number).sort((a, b) => a - b);
  assert.deepEqual(noneNums, [704, 705]);
});

test('filterIssuesByAttention filters issues by specified attention state', () => {
  const issues = [
    { number: 801, title: 'Issue 801', state: 'open', labels: [{ name: 'attention:needs-decision' }] },
    { number: 802, title: 'Issue 802', state: 'open', labels: [{ name: 'attention:needs-permission' }] },
    { number: 803, title: 'Issue 803', state: 'open', labels: [{ name: 'attention:needs-review' }] },
    { number: 804, title: 'Issue 804', state: 'open', labels: [{ name: 'attention:none' }] },
  ];

  const decisions = filterIssuesByAttention(issues, 'needs-decision');
  assert.equal(decisions.length, 1);
  assert.equal(decisions[0].number, 801);

  const permissions = filterIssuesByAttention(issues, 'needs-permission');
  assert.equal(permissions.length, 1);
  assert.equal(permissions[0].number, 802);

  const reviews = filterIssuesByAttention(issues, 'needs-review');
  assert.equal(reviews.length, 1);
  assert.equal(reviews[0].number, 803);

  const nones = filterIssuesByAttention(issues, 'none');
  assert.equal(nones.length, 1);
  assert.equal(nones[0].number, 804);
});

test('groupIssuesByAttention and filterIssuesByAttention defend against empty, null, undefined, and malformed inputs', () => {
  // Empty array
  const emptyGrouped = groupIssuesByAttention([]);
  assert.deepEqual(emptyGrouped, {
    'needs-decision': [],
    'needs-permission': [],
    'needs-review': [],
    none: [],
  });

  // Null and undefined issues
  assert.deepEqual(groupIssuesByAttention(null), {
    'needs-decision': [],
    'needs-permission': [],
    'needs-review': [],
    none: [],
  });
  assert.deepEqual(groupIssuesByAttention(undefined), {
    'needs-decision': [],
    'needs-permission': [],
    'needs-review': [],
    none: [],
  });

  // Malformed items in array
  const malformedList = [
    null,
    undefined,
    123,
    'non-issue string',
    {},
    { number: 901, title: null, body: null, labels: null },
  ];
  const malformedGrouped = groupIssuesByAttention(malformedList);
  // Empty object and 901 without attention should safely default to none
  assert.equal(malformedGrouped['needs-decision'].length, 0);
  assert.equal(malformedGrouped['needs-permission'].length, 0);
  assert.equal(malformedGrouped['needs-review'].length, 0);
  assert.equal(malformedGrouped['none'].length, 2);

  // filterIssuesByAttention defenses
  assert.deepEqual(filterIssuesByAttention([], 'needs-decision'), []);
  assert.deepEqual(filterIssuesByAttention(null, 'none'), []);
  assert.deepEqual(filterIssuesByAttention(undefined, 'none'), []);
  assert.deepEqual(filterIssuesByAttention(malformedList, 'invalid-attention'), []);
  assert.deepEqual(filterIssuesByAttention(malformedList, null), []);
  assert.deepEqual(filterIssuesByAttention(malformedList, undefined), []);

  // Null/undefined sessionIndex handling
  const validIssues = [{ number: 902, title: 'Clean', state: 'open', labels: [{ name: 'attention:needs-review' }] }];
  assert.equal(groupIssuesByAttention(validIssues, null)['needs-review'].length, 1);
  assert.equal(groupIssuesByAttention(validIssues, undefined)['needs-review'].length, 1);
  assert.equal(filterIssuesByAttention(validIssues, 'needs-review', null).length, 1);
});

test('L3 integration: parse real Issue #26 body with zero cross-counting and accurate 4-axis projection', () => {
  function getIssue26Body() {
    const possiblePaths = [
      new URL('../../../team-research-task-centred-proposal/.agents/run/task-centred-architecture/issue-draft.md', import.meta.url).pathname,
      '/workspace/extensions/github-task-board/.worktrees/team-research-task-centred-proposal/.agents/run/task-centred-architecture/issue-draft.md',
      new URL('../.agents/run/task-centred-architecture/issue-draft.md', import.meta.url).pathname,
    ];
    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        return fs.readFileSync(p, 'utf8');
      }
    }
    try {
      return execSync('git show c1d1df6:.agents/run/task-centred-architecture/issue-draft.md', { encoding: 'utf8' });
    } catch {
      return null;
    }
  }

  const body = getIssue26Body();
  assert.ok(body, 'Issue #26 body must be available');

  // Verify section-scoped extraction
  const title = parseFriendlyTitle(body);
  assert.equal(title?.title, 'All Work Runs on the Board');

  const ac = parseAcceptanceCriteria(body);
  assert.equal(ac.length, 15, 'Acceptance criteria count must strictly be 15');

  const subtasks = parseSubtasks(body);
  assert.equal(subtasks.length, 26, 'Subtasks count must strictly be 26 (scoped, not 58)');

  const questions = parseOpenQuestions(body);
  assert.equal(questions.length, 5, 'Open questions count must strictly be 5');

  const humanTasks = parseHumanTasks(body);
  assert.equal(humanTasks.length, 5, 'Human tasks count must strictly be 5');

  const testPlan = parseTestPlan(body);
  assert.equal(testPlan.issueTests.length, 17, 'Issue test plan count must strictly be 17');
  assert.equal(testPlan.batchTests.length, 0, 'Batch test plan count must strictly be 0');

  // Verify complete absence of cross-contamination in subtasks
  const subtaskTexts = new Set(subtasks.map((s) => s.text));
  for (const item of ac) {
    assert.ok(!subtaskTexts.has(item.text), `Subtasks must not contain AC: ${item.text}`);
  }
  for (const item of testPlan.issueTests) {
    assert.ok(!subtaskTexts.has(item.text), `Subtasks must not contain Test Plan item: ${item.text}`);
  }
  for (const item of questions) {
    assert.ok(!subtaskTexts.has(item.text), `Subtasks must not contain Question: ${item.text}`);
  }
  for (const item of humanTasks) {
    assert.ok(!subtaskTexts.has(item.text), `Subtasks must not contain Human Task: ${item.text}`);
  }

  // Verify 4-axis metadata resolution and Kanban projection
  const issue26 = {
    number: 26,
    title: 'All work runs from the task board',
    body,
    state: 'open',
    labels: [{ name: 'status:draft' }],
  };

  const meta = resolveV2Metadata(issue26);
  assert.equal(meta.phase, 'draft');
  assert.equal(meta.attention, 'needs-decision', 'Questions drive attention to needs-decision');
  assert.equal(meta.liveness, 'idle');
  assert.equal(meta.dependencyState, 'ready');
  assert.equal(meta.isExplicitV2, false);

  const column = resolveIssueColumn(issue26);
  assert.equal(column, 'draft');

  const grouped = groupIssuesByAttention([issue26]);
  assert.equal(grouped['needs-decision'].length, 1);
  assert.equal(grouped['needs-decision'][0].number, 26);
  assert.equal(grouped['needs-permission'].length, 0);
  assert.equal(grouped['needs-review'].length, 0);
  assert.equal(grouped['none'].length, 0);

  const normalized = normalizeGithubIssues([issue26]);
  assert.equal(normalized[0].acceptanceCriteria?.length, 15);
  assert.equal(normalized[0].subtasks.length, 26);
  assert.equal(normalized[0].v2Metadata?.phase, 'draft');
  assert.equal(normalized[0].v2Metadata?.attention, 'needs-decision');
});

test('hostile fuzz: checkboxes inside fenced code blocks are strictly excluded across all checklist parsers', () => {
  const hostileBody = [
    '# Complex Issue with Code Blocks',
    '',
    '### Acceptance Criteria:',
    '- [ ] Valid AC 1',
    '```markdown',
    '- [ ] Fake AC in backticks',
    '### Subtasks:',
    '- [ ] Fake subtask in backticks',
    '```',
    '- [x] Valid AC 2',
    '',
    '### Actionable Subtasks Checklist:',
    '- [ ] Valid Subtask 1',
    '~~~yaml',
    '- [ ] Fake subtask in tilde block',
    '  - [ ] Nested fake checkbox',
    '~~~',
    '- [x] Valid Subtask 2',
    '',
    '### Open Questions:',
    '- [ ] Valid Question 1?',
    '  ```typescript',
    '  // Code example with checkbox syntax in comments',
    '  // - [ ] What if we do this?',
    '  ```',
    '- [x] Valid Question 2?',
    '',
    '### Human Tasks:',
    '- [ ] Valid Human Task 1',
    '````',
    '- [ ] Fake Human Task in 4-backtick block',
    '````',
    '- [x] Valid Human Task 2',
    '',
    '## Test Plan (Issue)',
    '- [ ] Valid Issue Test 1',
    '```',
    '- [ ] Fake test in block',
    '```',
    '- [x] Valid Issue Test 2',
    '',
    '## Test Plan (Batch)',
    '- [ ] Valid Batch Test 1',
    '```',
    '- [ ] Fake batch test in block',
    '```',
    '- [x] Valid Batch Test 2',
    '',
    '### Trailing Section with Unclosed Code Block',
    '```',
    '- [ ] Fake trailing item in unclosed code fence',
    '### Acceptance Criteria:',
    '- [ ] Fake AC after unclosed fence',
  ].join('\n');

  const ac = parseAcceptanceCriteria(hostileBody);
  assert.equal(ac.length, 2, 'Must only parse real AC items');
  assert.deepEqual(ac.map((i) => i.text), ['Valid AC 1', 'Valid AC 2']);

  const subtasks = parseSubtasks(hostileBody);
  assert.equal(subtasks.length, 2, 'Must only parse real subtasks');
  assert.deepEqual(subtasks.map((i) => i.text), ['Valid Subtask 1', 'Valid Subtask 2']);

  const questions = parseOpenQuestions(hostileBody);
  assert.equal(questions.length, 2, 'Must only parse real questions');
  assert.deepEqual(questions.map((i) => i.text), ['Valid Question 1?', 'Valid Question 2?']);

  const humanTasks = parseHumanTasks(hostileBody);
  assert.equal(humanTasks.length, 2, 'Must only parse real human tasks');
  assert.deepEqual(humanTasks.map((i) => i.text), ['Valid Human Task 1', 'Valid Human Task 2']);

  const testPlan = parseTestPlan(hostileBody);
  assert.equal(testPlan.issueTests.length, 2, 'Must only parse real issue tests');
  assert.deepEqual(testPlan.issueTests.map((i) => i.text), ['Valid Issue Test 1', 'Valid Issue Test 2']);
  assert.equal(testPlan.batchTests.length, 2, 'Must only parse real batch tests');
  assert.deepEqual(testPlan.batchTests.map((i) => i.text), ['Valid Batch Test 1', 'Valid Batch Test 2']);

  // Also verify fallback mode ignores code blocks in raw unsectioned issues:
  const rawFallbackWithCode = [
    'Unsectioned issue description',
    '- [ ] Real top-level task 1',
    '```markdown',
    '- [ ] Fake task in code fence',
    '```',
    '- [ ] Real top-level task 2',
  ].join('\n');
  const fallbackSubtasks = parseSubtasks(rawFallbackWithCode);
  assert.equal(fallbackSubtasks.length, 2);
  assert.deepEqual(fallbackSubtasks.map((i) => i.text), ['Real top-level task 1', 'Real top-level task 2']);
});

test('hostile fuzz: heading variations (missing colons, extra whitespace, case-insensitivity, levels) parse robustly', () => {
  // 1. Acceptance Criteria heading variations
  const acVariations = [
    '## ACCEPTANCE CRITERIA\n- [ ] AC Upper H2',
    '###   acceptance   criteria   \n- [ ] AC Spaces Lower',
    '#### Acceptance Criteria:\n- [ ] AC H4 Colon',
    '  ### Acceptance Criteria  \n- [ ] AC Indented',
  ];
  for (const body of acVariations) {
    const res = parseAcceptanceCriteria(body);
    assert.equal(res.length, 1, `Failed to parse AC variation: ${body}`);
  }

  // 2. Subtasks heading variations
  const subtaskVariations = [
    '### ACTIONABLE SUBTASKS CHECKLIST\n- [ ] Task Upper No Colon',
    '###   Actionable   Subtasks   Checklist:   \n- [ ] Task Spaces Colon',
    '## subtasks\n- [ ] Task H2 Lower',
    '### Subtasks:\n- [ ] Task H3 Alias Colon',
    '### Tasks\n- [ ] Task Legacy Alias',
  ];
  for (const body of subtaskVariations) {
    const res = parseSubtasks(body);
    assert.equal(res.length, 1, `Failed to parse Subtask variation: ${body}`);
  }

  // 3. Open Questions heading variations
  const qVariations = [
    '## OPEN QUESTIONS\n- [ ] Question Upper H2?',
    '###   open   questions:   \n- [ ] Question Spaces Lower Colon?',
    '### Questions:\n- [ ] Question Alias Colon?',
  ];
  for (const body of qVariations) {
    const res = parseOpenQuestions(body);
    assert.equal(res.length, 1, `Failed to parse Question variation: ${body}`);
  }

  // 4. Human Tasks heading variations
  const htVariations = [
    '## HUMAN TASKS\n- [ ] Human Task Upper H2',
    '###   human   tasks:   \n- [ ] Human Task Spaces Lower Colon',
    '### Human tasks\n- [ ] Human Task Sentence Case',
  ];
  for (const body of htVariations) {
    const res = parseHumanTasks(body);
    assert.equal(res.length, 1, `Failed to parse Human Task variation: ${body}`);
  }

  // 5. Test Plan heading variations
  const tpVariations = [
    '## TEST PLAN (ISSUE)\n- [ ] Test Issue Upper\n## TEST PLAN (BATCH)\n- [ ] Test Batch Upper',
    '###   test   plan   (issue):   \n- [ ] Test Issue Spaces H3\n###   test   plan   (batch):   \n- [ ] Test Batch Spaces H3',
  ];
  for (const body of tpVariations) {
    const res = parseTestPlan(body);
    assert.equal(res.issueTests.length, 1, `Failed to parse Test Plan Issue variation: ${body}`);
    assert.equal(res.batchTests.length, 1, `Failed to parse Test Plan Batch variation: ${body}`);
  }
});

test('hostile fuzz: malformed, empty, and adversarial inputs never crash parser functions', () => {
  const malformedInputs = [
    null,
    undefined,
    '',
    '   ',
    '\n\n\n',
    '\uFEFF',
    '\r\n\r\n',
    12345,
    true,
    false,
    {},
    [],
    Symbol('test'),
    () => {},
  ];

  for (const input of malformedInputs) {
    assert.doesNotThrow(() => parseAcceptanceCriteria(input));
    assert.doesNotThrow(() => parseSubtasks(input));
    assert.doesNotThrow(() => parseOpenQuestions(input));
    assert.doesNotThrow(() => parseHumanTasks(input));
    assert.doesNotThrow(() => parseTestPlan(input));
    assert.doesNotThrow(() => resolveV2Metadata(input));
    assert.doesNotThrow(() => resolveIssueColumn(input));
    assert.doesNotThrow(() => groupIssuesByAttention(input));
    assert.doesNotThrow(() => filterIssuesByAttention(input, 'needs-decision'));
  }

  // Malformed checklist syntax
  const adversarialMarkdown = [
    '### Acceptance Criteria:',
    '- [] missing space between brackets',
    '- [?] question mark in checkbox',
    '- [!] exclamation in checkbox',
    '- [ x ] extra spaces in brackets',
    '- [x]   ', // empty text after checkbox
    '* [ ]', // no text
    '1. [ ]   ',
    'A'.repeat(50000), // Huge single line without newlines
    '### Actionable Subtasks Checklist:',
    '### Open Questions:',
    '### Human Tasks:',
    '## Test Plan (Issue)',
  ].join('\n');

  assert.doesNotThrow(() => {
    const ac = parseAcceptanceCriteria(adversarialMarkdown);
    const subtasks = parseSubtasks(adversarialMarkdown);
    const questions = parseOpenQuestions(adversarialMarkdown);
    const humanTasks = parseHumanTasks(adversarialMarkdown);
    const tp = parseTestPlan(adversarialMarkdown);
    assert.ok(Array.isArray(ac));
    assert.ok(Array.isArray(subtasks));
    assert.ok(Array.isArray(questions));
    assert.ok(Array.isArray(humanTasks));
    assert.ok(Array.isArray(tp.issueTests));
    assert.ok(Array.isArray(tp.batchTests));
  });
});

test('hostile fuzz: large payload performance parses 5,000 checkboxes across sections in <50ms without catastrophic backtracking', () => {
  const acLines = ['### Acceptance Criteria:'];
  const subtaskLines = ['### Actionable Subtasks Checklist:'];
  const questionLines = ['### Open Questions:'];
  const humanTaskLines = ['### Human Tasks:'];
  const testPlanLines = ['## Test Plan (Issue)'];

  for (let i = 0; i < 1000; i++) {
    acLines.push(`- [${i % 2 === 0 ? ' ' : 'x'}] Acceptance criterion #${i}: Verify edge condition ${i}`);
    subtaskLines.push(`- [${i % 2 === 0 ? 'x' : ' '}] Subtask #${i}: Execute worker unit ${i}`);
    questionLines.push(`- [${i % 2 === 0 ? ' ' : 'x'}] Question #${i}: Should parameter ${i} be configurable?`);
    humanTaskLines.push(`- [${i % 2 === 0 ? 'x' : ' '}] Human task #${i}: Confirm credential approval for stage ${i}`);
    testPlanLines.push(`- [${i % 2 === 0 ? ' ' : 'x'}] Test plan #${i}: Verify integration scenario ${i}`);
  }

  const megaBody = [
    acLines.join('\n'),
    subtaskLines.join('\n'),
    questionLines.join('\n'),
    humanTaskLines.join('\n'),
    testPlanLines.join('\n'),
  ].join('\n\n');

  // Warm-up run to allow V8 JIT optimization
  parseAcceptanceCriteria(megaBody);
  parseSubtasks(megaBody);
  parseOpenQuestions(megaBody);
  parseHumanTasks(megaBody);
  parseTestPlan(megaBody);

  // Timed execution across all 5 parsers
  const startTime = performance.now();
  const ac = parseAcceptanceCriteria(megaBody);
  const subtasks = parseSubtasks(megaBody);
  const questions = parseOpenQuestions(megaBody);
  const humanTasks = parseHumanTasks(megaBody);
  const testPlan = parseTestPlan(megaBody);
  const durationMs = performance.now() - startTime;

  assert.equal(ac.length, 1000, 'AC count must be exactly 1000');
  assert.equal(subtasks.length, 1000, 'Subtask count must be exactly 1000');
  assert.equal(questions.length, 1000, 'Question count must be exactly 1000');
  assert.equal(humanTasks.length, 1000, 'Human task count must be exactly 1000');
  assert.equal(testPlan.issueTests.length, 1000, 'Test plan count must be exactly 1000');

  // Check performance threshold (<50ms)
  assert.ok(
    durationMs < 50,
    `5,000 checkbox payload parsing must execute in <50ms (actual: ${durationMs.toFixed(2)}ms)`
  );
});

test('hostile fuzz: deterministic precedence for mixed and conflicting v2/v1 labels', () => {
  // 1. Attention precedence: needs-permission (4) > needs-decision (3) > needs-review (2) > none (1)
  const conflictingAttention1 = {
    number: 501,
    title: 'Conflicting attention 1',
    state: 'open',
    labels: [
      { name: 'attention:none' },
      { name: 'attention:needs-permission' },
      { name: 'attention:needs-review' },
    ],
  };
  const metaAtt1 = resolveV2Metadata(conflictingAttention1);
  assert.equal(metaAtt1.attention, 'needs-permission');

  // Reverse array order to prove determinism independent of label array ordering
  const conflictingAttention2 = {
    number: 502,
    title: 'Conflicting attention 2',
    state: 'open',
    labels: [
      { name: 'attention:needs-permission' },
      { name: 'attention:none' },
    ],
  };
  const metaAtt2 = resolveV2Metadata(conflictingAttention2);
  assert.equal(metaAtt2.attention, 'needs-permission');

  const conflictingAttention3 = {
    number: 503,
    title: 'Conflicting attention 3',
    state: 'open',
    labels: [
      { name: 'attention:needs-review' },
      { name: 'attention:needs-decision' },
    ],
  };
  assert.equal(resolveV2Metadata(conflictingAttention3).attention, 'needs-decision');

  const conflictingAttention4 = {
    number: 504,
    title: 'Conflicting attention 4',
    state: 'open',
    labels: [
      { name: 'attention:needs-decision' },
      { name: 'attention:needs-review' },
    ],
  };
  assert.equal(resolveV2Metadata(conflictingAttention4).attention, 'needs-decision');

  // 2. Phase precedence: maturity order (done > archive > publication > human_verification > verification > execution > planning > alignment > exploration > draft)
  const conflictingPhase1 = {
    number: 505,
    title: 'Conflicting phase 1',
    state: 'open',
    labels: [
      { name: 'phase:draft' },
      { name: 'phase:done' },
      { name: 'phase:planning' },
    ],
  };
  assert.equal(resolveV2Metadata(conflictingPhase1).phase, 'done');

  const conflictingPhase2 = {
    number: 506,
    title: 'Conflicting phase 2',
    state: 'open',
    labels: [
      { name: 'phase:exploration' },
      { name: 'phase:execution' },
      { name: 'phase:planning' },
    ],
  };
  assert.equal(resolveV2Metadata(conflictingPhase2).phase, 'execution');

  const conflictingPhase3 = {
    number: 507,
    title: 'Conflicting phase 3',
    state: 'open',
    labels: [
      { name: 'phase:execution' },
      { name: 'phase:exploration' },
    ],
  };
  assert.equal(resolveV2Metadata(conflictingPhase3).phase, 'execution');

  // 3. Dependency precedence: blocked-by-dependency > ready
  const conflictingDep1 = {
    number: 508,
    title: 'Conflicting dependency 1',
    state: 'open',
    labels: [
      { name: 'dependency:ready' },
      { name: 'dependency:blocked' },
    ],
  };
  assert.equal(resolveV2Metadata(conflictingDep1).dependencyState, 'blocked-by-dependency');

  const conflictingDep2 = {
    number: 509,
    title: 'Conflicting dependency 2',
    state: 'open',
    labels: [
      { name: 'dependency:blocked' },
      { name: 'dependency:ready' },
    ],
  };
  assert.equal(resolveV2Metadata(conflictingDep2).dependencyState, 'blocked-by-dependency');

  // 4. Liveness precedence: failed (5) > retrying (4) > running (3) > completed (2) > idle (1)
  const conflictingLive1 = {
    number: 510,
    title: 'Conflicting liveness 1',
    state: 'open',
    labels: [
      { name: 'liveness:idle' },
      { name: 'liveness:failed' },
      { name: 'liveness:running' },
    ],
  };
  assert.equal(resolveV2Metadata(conflictingLive1).liveness, 'failed');

  const conflictingLive2 = {
    number: 511,
    title: 'Conflicting liveness 2',
    state: 'open',
    labels: [
      { name: 'liveness:running' },
      { name: 'liveness:completed' },
    ],
  };
  assert.equal(resolveV2Metadata(conflictingLive2).liveness, 'running');

  // 5. Mixed v2 and v1 labels
  const mixedV1V2 = {
    number: 512,
    title: 'Mixed v1 and v2 labels',
    state: 'open',
    labels: [
      { name: 'status:in-progress' },
      { name: 'phase:planning' },
      { name: 'attention:needs-review' },
    ],
  };
  // resolveV2Metadata respects explicit v2 phase & attention
  const metaMixed = resolveV2Metadata(mixedV1V2);
  assert.equal(metaMixed.phase, 'planning');
  assert.equal(metaMixed.attention, 'needs-review');
  assert.equal(metaMixed.isExplicitV2, true);

  // resolveIssueColumn preserves legacy Kanban column when v1 status is present
  const colMixed = resolveIssueColumn(mixedV1V2);
  assert.equal(colMixed, 'in-progress');
});

test('hostile fuzz: CRLF and mixed line endings preserve lineIndex and updateSubtaskInMarkdown cleanly', () => {
  const crlfBody =
    '\uFEFF### Acceptance Criteria:\r\n' +
    '- [ ] AC 1 CRLF\r\n' +
    '- [x] AC 2 CRLF\r\n' +
    '\r\n' +
    '### Actionable Subtasks Checklist:\r\n' +
    '- [ ] Subtask 1 CRLF\r\n' +
    '- [x] Subtask 2 CRLF\r\n' +
    '\r\n' +
    '### Open Questions:\r\n' +
    '- [ ] Question 1 CRLF?\r\n' +
    '\r\n' +
    '### Human Tasks:\r\n' +
    '- [ ] Human Task 1 CRLF\r\n' +
    '\r\n' +
    '## Test Plan (Issue)\r\n' +
    '- [ ] Test 1 CRLF\r\n';

  // Ensure no trailing \r in any extracted text
  const ac = parseAcceptanceCriteria(crlfBody);
  assert.equal(ac.length, 2);
  assert.equal(ac[0].text, 'AC 1 CRLF');
  assert.equal(ac[0].completed, false);
  assert.ok(!ac[0].text.includes('\r'));

  const subtasks = parseSubtasks(crlfBody);
  assert.equal(subtasks.length, 2);
  assert.equal(subtasks[0].text, 'Subtask 1 CRLF');
  assert.equal(subtasks[0].completed, false);
  assert.ok(!subtasks[0].text.includes('\r'));

  const questions = parseOpenQuestions(crlfBody);
  assert.equal(questions.length, 1);
  assert.equal(questions[0].text, 'Question 1 CRLF?');
  assert.ok(!questions[0].text.includes('\r'));

  const humanTasks = parseHumanTasks(crlfBody);
  assert.equal(humanTasks.length, 1);
  assert.equal(humanTasks[0].text, 'Human Task 1 CRLF');
  assert.ok(!humanTasks[0].text.includes('\r'));

  const testPlan = parseTestPlan(crlfBody);
  assert.equal(testPlan.issueTests.length, 1);
  assert.equal(testPlan.issueTests[0].text, 'Test 1 CRLF');
  assert.ok(!testPlan.issueTests[0].text.includes('\r'));

  // Verify updateSubtaskInMarkdown toggles checkbox without corrupting CRLF line endings
  const targetSubtask = subtasks[0];
  const toggled = updateSubtaskInMarkdown(crlfBody, targetSubtask.lineIndex, true);
  assert.ok(toggled.includes('- [x] Subtask 1 CRLF\r\n'), 'Toggled line must preserve CRLF line ending');
  assert.ok(!toggled.includes('\r\r'), 'Must not create double carriage return');

  // Verify mixed line endings (alternating \r\n and \n)
  const mixedBody =
    '### Actionable Subtasks Checklist:\n' +
    '- [ ] Item LF 1\n' +
    '- [ ] Item CRLF 2\r\n' +
    '- [ ] Item LF 3\n';
  const mixedSubtasks = parseSubtasks(mixedBody);
  assert.equal(mixedSubtasks.length, 3);
  assert.equal(mixedSubtasks[0].text, 'Item LF 1');
  assert.equal(mixedSubtasks[1].text, 'Item CRLF 2');
  assert.equal(mixedSubtasks[2].text, 'Item LF 3');
});
