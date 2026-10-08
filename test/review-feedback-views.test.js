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
import { createTestApp } from './test-app-harness.js';

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

// ==========================================
// 7. Defects Reproduction Tests
// ==========================================
test('F-01: Custom repo input marks manual override, survives background events, and resets on active session change', async () => {
  const { app, elements, emitSession, emitDirectory } = createTestApp();
  // Session 1 is active with repo 'org/default-repo'
  await emitSession({ id: 'ses_1', title: 'Session 1', items: [{ id: '1', data: { repo: 'org/default-repo' } }] });
  assert.equal(app.getState().currentRepo, 'org/default-repo');
  assert.equal(app.getState().isManualRepoOverride, false);

  // User enters custom repo via input and clicks Save
  elements.get('inputCustomRepo').value = 'custom-user/custom-repo';
  elements.get('btnSaveCustomRepo').click();

  assert.equal(app.getState().currentRepo, 'custom-user/custom-repo');
  assert.equal(app.getState().isManualRepoOverride, true, 'isManualRepoOverride must be true after saving custom repo');

  // Background event 1: session metadata update on same session must NOT overwrite manual repo
  await emitSession({ id: 'ses_1', title: 'Session 1 (renamed)', items: [{ id: '1', data: { repo: 'org/default-repo' } }] });
  assert.equal(app.getState().currentRepo, 'custom-user/custom-repo', 'Custom repo must survive background session metadata update');

  // Background event 2: directory change must NOT overwrite manual repo
  await emitDirectory('/workspace/other-dir');
  assert.equal(app.getState().currentRepo, 'custom-user/custom-repo', 'Custom repo must survive background directory change');

  // Also test Enter key submission on inputCustomRepo
  elements.get('inputCustomRepo').value = 'another-user/another-custom-repo';
  elements.get('inputCustomRepo').dispatchEvent({ type: 'keydown', key: 'Enter' });
  assert.equal(app.getState().currentRepo, 'another-user/another-custom-repo', 'Enter key must save custom repo');
  assert.equal(app.getState().isManualRepoOverride, true);

  // When active session changes to ses_2, manual override must reset per D13
  await emitSession({ id: 'ses_2', title: 'Session 2', items: [{ id: '2', data: { repo: 'org/session-2-repo' } }] });
  assert.equal(app.getState().isManualRepoOverride, false, 'isManualRepoOverride must reset to false on session change');
  assert.equal(app.getState().currentRepo, 'org/session-2-repo', 'Repository must reset to new session repo on session change');
});

test('F-02: Switching sessions while in All Projects mode resolves the new session own repo from sess.items', async () => {
  const { app, emitSession } = createTestApp();
  // Start on session 1
  await emitSession({ id: 'ses_1', title: 'Session 1', items: [{ id: '1', data: { repo: 'org/repo-1' } }] });
  assert.equal(app.getState().currentRepo, 'org/repo-1');

  // Put into All Projects mode
  app.setState({ isAllProjectsMode: true, currentRepo: '__all_projects__' });
  assert.equal(app.getState().isAllProjectsMode, true);

  // Active session identity changes to ses_2 with its own item repo
  await emitSession({ id: 'ses_2', title: 'Session 2', items: [{ id: '2', data: { repo: 'org/session-2-repo' } }] });

  // In pre-fix code, !isAllProjectsMode guard prevented resolving org/session-2-repo from sess.items
  assert.equal(app.getState().currentRepo, 'org/session-2-repo', 'Active session items repository must take precedence on session change even when in All Projects mode');
});
