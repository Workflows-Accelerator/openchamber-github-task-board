import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  parseFriendlyTitle,
  resolveSimplifiedViewTitle,
  parseHumanTasks,
  collectHumanTodos,
  parseOpenQuestions,
  buildSessionIndexByRepo,
  findSessionForIssueByRepo,
  getSessionIssueRepo,
  sessionRepoKeys,
} from '../panel/core.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const INDEX_HTML = fs.readFileSync(path.join(here, '..', 'panel', 'index.html'), 'utf8');
const MAIN_TS = fs.readFileSync(path.join(here, '..', 'panel', 'main.ts'), 'utf8');

// ==========================================
// 1. Icon Distinction & Accessibility
// ==========================================
test('Icons: All Tasks view-mode button has distinct checklist SVG icon compared to List', () => {
  // Extract #btnViewAllTasks SVG
  const allTasksMatch = INDEX_HTML.match(/id="btnViewAllTasks"[^>]*>([\s\S]*?)<\/button>/);
  assert.ok(allTasksMatch, '#btnViewAllTasks must exist in index.html');
  const allTasksSvg = allTasksMatch[1];

  // Extract #btnViewList SVG
  const listMatch = INDEX_HTML.match(/id="btnViewList"[^>]*>([\s\S]*?)<\/button>/);
  assert.ok(listMatch, '#btnViewList must exist in index.html');
  const listSvg = listMatch[1];

  // Extract #btnViewHuman SVG
  const humanMatch = INDEX_HTML.match(/id="btnViewHuman"[^>]*>([\s\S]*?)<\/button>/);
  assert.ok(humanMatch, '#btnViewHuman must exist in index.html');
  const humanSvg = humanMatch[1];

  // Extract #btnViewQuestions SVG
  const questionsMatch = INDEX_HTML.match(/id="btnViewQuestions"[^>]*>([\s\S]*?)<\/button>/);
  assert.ok(questionsMatch, '#btnViewQuestions must exist in index.html');
  const questionsSvg = questionsMatch[1];

  // Extract path data
  const extractPath = (svg) => {
    const m = svg.match(/<path\s+d="([^"]+)"/);
    return m ? m[1] : '';
  };

  const pathAllTasks = extractPath(allTasksSvg);
  const pathList = extractPath(listSvg);
  const pathHuman = extractPath(humanSvg);
  const pathQuestions = extractPath(questionsSvg);

  assert.ok(pathAllTasks, 'All Tasks must have a valid SVG path');
  assert.ok(pathList, 'List must have a valid SVG path');
  assert.ok(pathHuman, 'Human must have a valid SVG path');
  assert.ok(pathQuestions, 'Questions must have a valid SVG path');

  // Assert paths are distinct from each other
  assert.notEqual(pathAllTasks, pathList, 'All Tasks icon must not match List icon');
  assert.notEqual(pathAllTasks, pathHuman, 'All Tasks icon must not match Human Tasks icon');
  assert.notEqual(pathAllTasks, pathQuestions, 'All Tasks icon must not match Questions icon');
  assert.notEqual(pathHuman, pathList, 'Human Tasks icon must not match List icon');
  assert.notEqual(pathQuestions, pathList, 'Questions icon must not match List icon');

  // Assert All Tasks contains checkmark segments (checklist shape)
  assert.ok(
    pathAllTasks.includes('5.54') || pathAllTasks.includes('7.46') || pathAllTasks.includes('15.46'),
    'All Tasks icon must contain checklist checkmark coordinates'
  );

  // Assert accessible attributes are preserved
  assert.ok(allTasksMatch[0].includes('title="All Tasks View"'), 'All Tasks button has title');
  assert.ok(allTasksMatch[0].includes('aria-label="All Tasks View"'), 'All Tasks button has aria-label');
  assert.ok(allTasksMatch[0].includes('role="radio"'), 'All Tasks button has role="radio"');
  assert.ok(allTasksMatch[0].includes('aria-checked='), 'All Tasks button has aria-checked');
});

test('Icons: sidebar layout toggle icon updates with distinct checklist SVG in all-tasks mode', () => {
  assert.ok(
    MAIN_TS.includes("mode === 'all-tasks'") &&
      MAIN_TS.includes('M22 7h-9v2h9V7zm0 8h-9v2h9v-2z'),
    'main.ts updateViewModeButtons must set checklist SVG for all-tasks mode'
  );
});

// ==========================================
// 2. Friendly Titles in Simplified Views
// ==========================================
test('Friendly Titles: resolveSimplifiedViewTitle correctly resolves friendly title and suppresses tech title to subtitle', () => {
  const issueWithFriendly = {
    number: 23,
    title: 'feat(board): implement simplified views and layout toggle',
    body: `### Friendly Title: Simplified Review and Intake Views\n\n**Overview:** Added three simplified views for rapid triage.`,
  };

  const resolved = resolveSimplifiedViewTitle(issueWithFriendly);
  assert.equal(resolved.displayTitle, 'Simplified Review and Intake Views');
  assert.equal(resolved.displaySubtitle, 'feat(board): implement simplified views and layout toggle');
  assert.equal(resolved.isPlaceholder, false);
});

test('Friendly Titles: resolveSimplifiedViewTitle uses quiet explicit placeholder when body lacks Friendly Title', () => {
  const issueWithoutFriendly = {
    number: 22,
    title: 'fix(core): resolve race condition on scratchpad debounce',
    body: `**Overview:** Scratchpad was saving simultaneously on keydown.`,
  };

  const resolved = resolveSimplifiedViewTitle(issueWithoutFriendly);
  assert.equal(resolved.displayTitle, '(No friendly title)');
  assert.equal(resolved.displaySubtitle, 'fix(core): resolve race condition on scratchpad debounce');
  assert.equal(resolved.isPlaceholder, true);
});

test('Friendly Titles: resolveSimplifiedViewTitle handles empty titles and missing bodies safely', () => {
  const issueEmpty = {
    number: 99,
    title: '',
    body: '',
  };

  const resolved = resolveSimplifiedViewTitle(issueEmpty);
  assert.equal(resolved.displayTitle, '(No friendly title)');
  assert.equal(resolved.displaySubtitle, 'Issue #99');
  assert.equal(resolved.isPlaceholder, true);
});

// ==========================================
// 3. Positive Queues: Human Tasks & Open Questions
// ==========================================
test('Queues: Human Tasks and Questions parse real populated issue bodies', () => {
  const issue23Body = `### Friendly Title: Simplified Review and Intake Views

**Overview:** Add Human Tasks, All Tasks, and Questions views to streamline triage.

### Human Tasks:
- [ ] Review three simplified view layouts on integration preview
- [ ] Validate checkbox toggle behavior on human tasks queue

### Open Questions:
- [ ] Should completed human tasks remain visible in the queue with a strikethrough?

### Actionable Subtasks Checklist:
- [x] Create view mode toolbar buttons
- [ ] Implement groupAllTasksByStatus`;

  const issue24Body = `### Friendly Title: Reliable Session Repository Discovery

**Overview:** Ensure the board defaults to current session repository and provides easy explicit switching.

### Human Tasks:
- [ ] Confirm repository switching resets correctly on active session change

### Open Questions:
- [ ] How should custom repositories not bound to OpenChamber projects be persisted?

### Actionable Subtasks Checklist:
- [ ] Support V2 session location directory
- [ ] Add Current session anchor to popover`;

  // Parse Human Tasks
  const humanTasks23 = parseHumanTasks(issue23Body);
  assert.equal(humanTasks23.length, 2);
  assert.equal(humanTasks23[0].text, 'Review three simplified view layouts on integration preview');
  assert.equal(humanTasks23[0].completed, false);
  assert.equal(humanTasks23[1].text, 'Validate checkbox toggle behavior on human tasks queue');
  assert.equal(humanTasks23[1].completed, false);

  const humanTasks24 = parseHumanTasks(issue24Body);
  assert.equal(humanTasks24.length, 1);
  assert.equal(humanTasks24[0].text, 'Confirm repository switching resets correctly on active session change');
  assert.equal(humanTasks24[0].completed, false);

  // Parse Open Questions
  const questions23 = parseOpenQuestions(issue23Body);
  assert.equal(questions23.length, 1);
  assert.equal(questions23[0].text, 'Should completed human tasks remain visible in the queue with a strikethrough?');
  assert.equal(questions23[0].completed, false);

  const questions24 = parseOpenQuestions(issue24Body);
  assert.equal(questions24.length, 1);
  assert.equal(questions24[0].text, 'How should custom repositories not bound to OpenChamber projects be persisted?');
  assert.equal(questions24[0].completed, false);

  // collectHumanTodos integration
  const todos23 = collectHumanTodos({ number: 23, body: issue23Body });
  assert.equal(todos23.length, 2);
  assert.equal(todos23[0].source, 'human-task');

  const todos24 = collectHumanTodos({ number: 24, body: issue24Body });
  assert.equal(todos24.length, 1);
  assert.equal(todos24[0].source, 'human-task');
});

// ==========================================
// 4. Cross-Repository Isolation (Same Issue Number in Two Repos)
// ==========================================
test('Cross-Repo Isolation: same issue number in two repositories never binds cross-repo sessions', () => {
  const issueAlpha = {
    number: 24,
    repo: 'org/repo-alpha',
    title: 'Alpha Issue 24',
    body: 'Alpha body',
  };

  const issueBeta = {
    number: 24,
    repo: 'org/repo-beta',
    title: 'Beta Issue 24',
    body: 'Beta body',
  };

  const sessions = [
    {
      id: 'ses_alpha_24',
      title: 'Session for Alpha 24',
      activity: 'running',
      items: [
        {
          id: '24',
          data: { issueNumber: 24, repo: 'org/repo-alpha' },
        },
      ],
    },
    {
      id: 'ses_beta_24',
      title: 'Session for Beta 24',
      activity: 'waiting-permission',
      items: [
        {
          id: '24',
          data: { issueNumber: 24, repo: 'org/repo-beta' },
        },
      ],
    },
  ];

  const indexByRepo = buildSessionIndexByRepo(sessions);

  // Assert keys exist
  assert.ok(indexByRepo.has('org/repo-alpha#24'));
  assert.ok(indexByRepo.has('org/repo-beta#24'));

  // Assert lookup for Alpha gets Alpha session, not Beta
  const matchAlpha = findSessionForIssueByRepo(indexByRepo, issueAlpha);
  assert.equal(matchAlpha?.id, 'ses_alpha_24');
  assert.equal(matchAlpha?.activity, 'running');

  // Assert lookup for Beta gets Beta session, not Alpha
  const matchBeta = findSessionForIssueByRepo(indexByRepo, issueBeta);
  assert.equal(matchBeta?.id, 'ses_beta_24');
  assert.equal(matchBeta?.activity, 'waiting-permission');
});

test('Cross-Repo Isolation: sessionRepoKeys handles V2 data.repo projection cleanly', () => {
  const sessionV2 = {
    id: 'ses_1',
    items: [
      {
        id: '23',
        // In V2 host strips top-level url; repo is stored inside data
        data: { issueNumber: 23, repo: 'org/github-task-board' },
      },
    ],
  };

  const keys = sessionRepoKeys(sessionV2);
  assert.deepEqual(keys, ['org/github-task-board#23']);
  assert.equal(getSessionIssueRepo(sessionV2.items[0]), 'org/github-task-board');
});

// ==========================================
// 5. Issue 24 & Decision D13 (Session Follow & Repository Switching)
// ==========================================
test('Decision D13: popover provides Current session anchor back to default', () => {
  assert.ok(
    INDEX_HTML.includes('.current-session-option'),
    'index.html must style .current-session-option'
  );
  assert.ok(
    MAIN_TS.includes('current-session-option') &&
      MAIN_TS.includes('isManualRepoOverride = false'),
    'main.ts popover must provide Current session option resetting isManualRepoOverride'
  );
});

test('Decision D13: active session change resets manual repository override automatically', () => {
  assert.ok(
    MAIN_TS.includes('activeSessionId !== sess.id') &&
      MAIN_TS.includes('isManualRepoOverride = false'),
    'main.ts host.onSession must reset isManualRepoOverride on active session change per D13'
  );
});

test('Empty States: Empty, Inaccessible, and Failed repository states are visually distinguishable', () => {
  assert.ok(
    INDEX_HTML.includes('.empty-box.empty-state-inaccessible svg') &&
      INDEX_HTML.includes('.empty-box.empty-state-failed svg') &&
      INDEX_HTML.includes('.empty-box.empty-state-empty svg'),
    'index.html must provide distinct color styles for inaccessible, failed, and empty states'
  );

  assert.ok(
    MAIN_TS.includes('empty-state-inaccessible') &&
      MAIN_TS.includes('Repository Inaccessible') &&
      MAIN_TS.includes('empty-state-failed') &&
      MAIN_TS.includes('Failed to Load Repository') &&
      MAIN_TS.includes('empty-state-empty') &&
      MAIN_TS.includes('No Issues in Repository'),
    'main.ts renderEmptyState must distinguish empty, inaccessible, and failed states with distinct titles and icons'
  );
});

// ==========================================
// 6. Ground Truth: Refresh Trigger (No Timer Polling per D11)
// ==========================================
test('Refresh Trigger: No setInterval / timer polling exists in panel codebase (D11 enforced)', () => {
  // Disallow any setInterval in main.ts
  const setIntervalMatches = MAIN_TS.match(/setInterval\s*\(/g);
  assert.equal(
    setIntervalMatches,
    null,
    'main.ts must not contain any setInterval polling loops (Decision D11)'
  );

  // Assert idle refresh trigger is strictly event-driven via host.onSessions
  assert.ok(
    MAIN_TS.includes('becameIdle') && MAIN_TS.includes('handleIdleRefresh('),
    'Idle refresh must be event-driven via host.onSessions becameIdle transition'
  );
});
