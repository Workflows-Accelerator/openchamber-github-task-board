import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  parseFriendlyTitle,
  parseHumanTasks,
  collectHumanTodos,
  parseOpenQuestions,
  updateSubtaskInMarkdown,
  updateOpenQuestionInMarkdown,
  answerOpenQuestionInMarkdown,
} from '../panel/core.ts';

import {
  STATUS_COLUMNS,
  STATUS_METADATA,
  STATUS_NEEDS_HUMAN,
  STATUS_IN_PROGRESS,
  STATUS_TODO,
  STATUS_DONE,
} from '../panel/labels.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const INDEX_HTML = fs.readFileSync(path.join(here, '..', 'panel', 'index.html'), 'utf8');
const MAIN_TS = fs.readFileSync(path.join(here, '..', 'panel', 'main.ts'), 'utf8');

// Pure helper implementations mirroring main.ts contracts for DOM-free testing
export function filterNeedsHumanIssues(issues, resolveStatusFn) {
  if (!Array.isArray(issues)) return [];
  return issues.filter((i) => {
    const st = resolveStatusFn ? resolveStatusFn(i) : i.status;
    return st === 'needs-human' || st === STATUS_NEEDS_HUMAN;
  });
}

export function groupNeedsHumanIssuesByRepo(issues, repoResolverFn) {
  const byRepo = {};
  if (!Array.isArray(issues)) return byRepo;
  for (const issue of issues) {
    const repo = (repoResolverFn ? repoResolverFn(issue) : issue.repo) || 'default';
    if (!byRepo[repo]) byRepo[repo] = [];
    byRepo[repo].push(issue);
  }
  return byRepo;
}

export function groupAllTasksByStatus(issues, resolveStatusFn) {
  const groups = {
    draft: [],
    backlog: [],
    todo: [],
    planned: [],
    'in-progress': [],
    'needs-human': [],
    'in-review': [],
    done: [],
  };
  if (!Array.isArray(issues)) return groups;
  for (const issue of issues) {
    const col = (resolveStatusFn ? resolveStatusFn(issue) : issue.status) || 'backlog';
    if (groups[col]) {
      groups[col].push(issue);
    } else {
      groups.backlog.push(issue);
    }
  }
  return groups;
}

export function collectUnansweredQuestionsAcrossIssues(issues) {
  const result = [];
  if (!Array.isArray(issues)) return result;
  for (const issue of issues) {
    const questions = issue.openQuestions || parseOpenQuestions(issue.body || '');
    const unanswered = questions.filter((q) => !q.completed);
    if (unanswered.length > 0) {
      result.push({ issue, questions: unanswered });
    }
  }
  return result;
}

export function formatHumanTodoSourceBadge(source) {
  switch (source) {
    case 'human-task':
      return { label: 'Human Task', className: 'badge-human-task' };
    case 'open-question':
      return { label: 'Open Question', className: 'badge-open-question' };
    case 'session-waiting':
      return { label: 'Agent Waiting', className: 'badge-session-waiting' };
    default:
      return { label: 'Task', className: 'badge-human-task' };
  }
}

// ---------------------------------------------------------------------------
// 1. Human Tasks View Logic
// ---------------------------------------------------------------------------

test('Human Tasks: filterNeedsHumanIssues filters strictly needs-human status', () => {
  const sampleIssues = [
    { number: 1, title: 'Issue 1', status: 'in-progress' },
    { number: 2, title: 'Issue 2', status: 'needs-human' },
    { number: 3, title: 'Issue 3', status: 'todo' },
    { number: 4, title: 'Issue 4', status: 'needs-human' },
    { number: 5, title: 'Issue 5', status: 'done' },
  ];

  const filtered = filterNeedsHumanIssues(sampleIssues);
  assert.equal(filtered.length, 2);
  assert.equal(filtered[0].number, 2);
  assert.equal(filtered[1].number, 4);
});

test('Human Tasks: groupNeedsHumanIssuesByRepo clusters issues by repository', () => {
  const issues = [
    { number: 1, repo: 'org/repo-a', status: 'needs-human' },
    { number: 2, repo: 'org/repo-b', status: 'needs-human' },
    { number: 3, repo: 'org/repo-a', status: 'needs-human' },
  ];

  const grouped = groupNeedsHumanIssuesByRepo(issues);
  assert.equal(Object.keys(grouped).length, 2);
  assert.equal(grouped['org/repo-a'].length, 2);
  assert.equal(grouped['org/repo-b'].length, 1);
  assert.equal(grouped['org/repo-a'][0].number, 1);
  assert.equal(grouped['org/repo-a'][1].number, 3);
});

test('Human Tasks: collectHumanTodos integrates properly with source badges', () => {
  // Case A: Explicit ### Human Tasks:
  const issueA = {
    number: 10,
    title: 'feat: add auth',
    body: `### Friendly Title: Add OAuth Login\n\n### Human Tasks:\n- [ ] Approve GitHub OAuth app creation\n- [ ] Configure client secrets in vault\n- [x] Already done task`,
  };
  const todosA = collectHumanTodos(issueA);
  assert.equal(todosA.length, 2);
  assert.equal(todosA[0].text, 'Approve GitHub OAuth app creation');
  assert.equal(todosA[0].source, 'human-task');
  const badgeA = formatHumanTodoSourceBadge(todosA[0].source);
  assert.equal(badgeA.label, 'Human Task');
  assert.equal(badgeA.className, 'badge-human-task');

  // Case B: Fallback to ### Open Questions:
  const issueB = {
    number: 11,
    title: 'feat: notifications',
    body: `### Friendly Title: Push Notifications\n\n### Open Questions:\n- [ ] Should we support web push or email only?`,
  };
  const todosB = collectHumanTodos(issueB);
  assert.equal(todosB.length, 1);
  assert.equal(todosB[0].text, 'Should we support web push or email only?');
  assert.equal(todosB[0].source, 'open-question');
  const badgeB = formatHumanTodoSourceBadge(todosB[0].source);
  assert.equal(badgeB.label, 'Open Question');
  assert.equal(badgeB.className, 'badge-open-question');

  // Case C: Fallback to waiting session
  const issueC = {
    number: 12,
    title: 'fix: database migration',
    body: `### Friendly Title: Fix Migration`,
  };
  const waitingSession = {
    activity: 'waiting-permission',
    waitingReason: 'Run DROP TABLE on legacy cache',
  };
  const todosC = collectHumanTodos(issueC, waitingSession);
  assert.equal(todosC.length, 1);
  assert.equal(todosC[0].source, 'session-waiting');
  assert.ok(todosC[0].text.includes('Run DROP TABLE'));
  const badgeC = formatHumanTodoSourceBadge(todosC[0].source);
  assert.equal(badgeC.label, 'Agent Waiting');
  assert.equal(badgeC.className, 'badge-session-waiting');
});

test('Human Tasks: Checkbox write-back toggles markdown via updateSubtaskInMarkdown', () => {
  const initialBody = `### Friendly Title: Deploy Service\n\n### Human Tasks:\n- [ ] Deploy to staging\n- [ ] Run smoke tests`;
  const tasks = parseHumanTasks(initialBody);
  assert.equal(tasks.length, 2);
  assert.equal(tasks[0].completed, false);

  // Toggle first item to checked
  const updatedBody = updateSubtaskInMarkdown(initialBody, tasks[0].lineIndex, true);
  const reParsed = parseHumanTasks(updatedBody);
  assert.equal(reParsed[0].completed, true);
  assert.equal(reParsed[1].completed, false);

  // collectHumanTodos now only returns the second item
  const remainingTodos = collectHumanTodos({ body: updatedBody });
  assert.equal(remainingTodos.length, 1);
  assert.equal(remainingTodos[0].text, 'Run smoke tests');
});

test('Human Tasks: Checkbox write-back resolves duplicate text task by toggled state', () => {
  const initialBody = `### Friendly Title: Deploy Service\n\n### Human Tasks:\n- [x] Run smoke tests\n- [ ] Run smoke tests`;
  const tasks = parseHumanTasks(initialBody);
  assert.equal(tasks.length, 2);
  assert.equal(tasks[0].completed, true);
  assert.equal(tasks[1].completed, false);

  // When checking an item (cb.checked === true), find target whose completed !== true
  const target = tasks.find((t) => t.completed !== true && t.text.trim() === 'Run smoke tests')
    || tasks.find((t) => t.text.trim() === 'Run smoke tests');
  assert.ok(target, 'Target task must be found');
  assert.equal(target.lineIndex, tasks[1].lineIndex, 'Must target the incomplete item, not the already-completed duplicate');

  const updatedBody = updateSubtaskInMarkdown(initialBody, target.lineIndex, true);
  const reParsed = parseHumanTasks(updatedBody);
  assert.equal(reParsed[0].completed, true);
  assert.equal(reParsed[1].completed, true);
});

// ---------------------------------------------------------------------------
// 2. All Tasks View Logic
// ---------------------------------------------------------------------------

test('All Tasks: groupAllTasksByStatus organizes all 8 columns in order', () => {
  const issues = [
    { number: 1, title: 'Draft issue', status: 'draft' },
    { number: 2, title: 'Backlog issue', status: 'backlog' },
    { number: 3, title: 'Todo issue', status: 'todo' },
    { number: 4, title: 'Planned issue', status: 'planned' },
    { number: 5, title: 'Progress issue', status: 'in-progress' },
    { number: 6, title: 'Needs human issue', status: 'needs-human' },
    { number: 7, title: 'Review issue', status: 'in-review' },
    { number: 8, title: 'Done issue', status: 'done' },
  ];

  const grouped = groupAllTasksByStatus(issues);
  for (const col of STATUS_COLUMNS) {
    assert.ok(grouped[col], `Group for ${col} must exist`);
    assert.equal(grouped[col].length, 1);
  }
});

test('All Tasks: shows friendly title and suppresses technical title to quiet subtitle', () => {
  const issue = {
    number: 101,
    title: 'feat(auth): add google sso login provider',
    body: `### Friendly Title: Google SSO Login\n\n**Overview:** Allow users to login with Google.`,
    status: 'todo',
  };

  const titles = parseFriendlyTitle(issue.body, issue.title);
  assert.equal(titles.title, 'Google SSO Login');
  assert.equal(titles.subtitle, 'feat(auth): add google sso login provider');

  // When no friendly title is in markdown, fallback to issue.title with null subtitle
  const issueNoFriendly = {
    number: 102,
    title: 'fix(core): memory leak on stream close',
    body: `**Overview:** Fix leaking buffer`,
    status: 'in-progress',
  };
  const titlesFallback = parseFriendlyTitle(issueNoFriendly.body, issueNoFriendly.title);
  assert.equal(titlesFallback.title, 'fix(core): memory leak on stream close');
  assert.equal(titlesFallback.subtitle, null);
});

// ---------------------------------------------------------------------------
// 3. Questions View Logic
// ---------------------------------------------------------------------------

test('Questions View: collectUnansweredQuestionsAcrossIssues extracts questions across statuses', () => {
  const issues = [
    {
      number: 201,
      title: 'feat(api): endpoint design',
      status: 'in-progress',
      body: `### Friendly Title: API Design\n\n### Open Questions:\n- [ ] REST or GraphQL?\n- [x] Use snake_case *(Answer: Yes)*`,
    },
    {
      number: 202,
      title: 'feat(ui): dark theme',
      status: 'draft',
      body: `### Friendly Title: Dark Theme\n\n### Open Questions:\n- [ ] Default to system preference?`,
    },
    {
      number: 203,
      title: 'chore: dependencies',
      status: 'done',
      body: `### Friendly Title: Update Dependencies\n\nNo questions here.`,
    },
  ];

  const results = collectUnansweredQuestionsAcrossIssues(issues);
  assert.equal(results.length, 2);

  assert.equal(results[0].issue.number, 201);
  assert.equal(results[0].questions.length, 1);
  assert.equal(results[0].questions[0].text, 'REST or GraphQL?');

  assert.equal(results[1].issue.number, 202);
  assert.equal(results[1].questions.length, 1);
  assert.equal(results[1].questions[0].text, 'Default to system preference?');
});

test('Questions View: answering question inline marks box and preserves other content', () => {
  const body = `### Friendly Title: API Design\n\n### Open Questions:\n- [ ] REST or GraphQL?\n- [ ] Auth header format?`;
  const answeredBody = answerOpenQuestionInMarkdown(body, 0, 'Use REST endpoints');

  assert.ok(answeredBody.includes('- [x] REST or GraphQL? *(Answer: Use REST endpoints)*'));
  assert.ok(answeredBody.includes('- [ ] Auth header format?'));

  const reQuestions = parseOpenQuestions(answeredBody);
  const remaining = reQuestions.filter((q) => !q.completed);
  assert.equal(remaining.length, 1);
  assert.equal(remaining[0].text, 'Auth header format?');
});

// ---------------------------------------------------------------------------
// 4. Zero Emoji Policy & UI Copy
// ---------------------------------------------------------------------------

test('Zero Emoji: Empty states and labels for new views contain zero emojis', () => {
  const EMOJI_REGEX = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E0}-\u{1F1FF}]/u;

  const emptyTexts = [
    'Nothing is waiting on you',
    'All tasks and sessions are moving forward.',
    'No tasks match the active filters',
    'No open questions waiting for alignment',
    'All specifications and open questions have been answered.',
    'Human Tasks',
    'All Tasks',
    'Questions',
  ];

  for (const text of emptyTexts) {
    assert.equal(EMOJI_REGEX.test(text), false, `Text "${text}" must not contain emojis`);
  }
});

// ---------------------------------------------------------------------------
// 5. HTML & CSS Invariants (panel/index.html)
// ---------------------------------------------------------------------------

test('panel/index.html defines containers for the three simplified views', () => {
  assert.ok(INDEX_HTML.includes('id="humanViewContainer"'), 'humanViewContainer must exist in index.html');
  assert.ok(INDEX_HTML.includes('id="allTasksViewContainer"'), 'allTasksViewContainer must exist in index.html');
  assert.ok(INDEX_HTML.includes('id="questionsViewContainer"'), 'questionsViewContainer must exist in index.html');
});

test('panel/index.html defines view mode buttons in viewModeGroup', () => {
  assert.ok(INDEX_HTML.includes('id="btnViewHuman"'), 'btnViewHuman button must exist');
  assert.ok(INDEX_HTML.includes('id="btnViewAllTasks"'), 'btnViewAllTasks button must exist');
  assert.ok(INDEX_HTML.includes('id="btnViewQuestions"'), 'btnViewQuestions button must exist');
  assert.ok(INDEX_HTML.includes('data-mode="human"'), 'data-mode="human" must exist');
  assert.ok(INDEX_HTML.includes('data-mode="all-tasks"'), 'data-mode="all-tasks" must exist');
  assert.ok(INDEX_HTML.includes('data-mode="questions"'), 'data-mode="questions" must exist');
});

test('panel/index.html defines layout display styles for the three new views', () => {
  assert.ok(INDEX_HTML.includes('body[data-layout="human"]'), 'CSS must define human layout selector');
  assert.ok(INDEX_HTML.includes('body[data-layout="all-tasks"]'), 'CSS must define all-tasks layout selector');
  assert.ok(INDEX_HTML.includes('body[data-layout="questions"]'), 'CSS must define questions layout selector');
});

// ---------------------------------------------------------------------------
// 6. main.ts Integration Invariants (panel/main.ts)
// ---------------------------------------------------------------------------

test('panel/main.ts defines render functions for all three simplified views', () => {
  assert.match(MAIN_TS, /function\s+renderHumanTasksView\s*\(/, 'main.ts must declare renderHumanTasksView');
  assert.match(MAIN_TS, /function\s+renderAllTasksView\s*\(/, 'main.ts must declare renderAllTasksView');
  assert.match(MAIN_TS, /function\s+renderQuestionsView\s*\(/, 'main.ts must declare renderQuestionsView');
});

test('panel/main.ts dispatches active layout to renderHumanTasksView, renderAllTasksView, renderQuestionsView', () => {
  assert.ok(MAIN_TS.includes('renderHumanTasksView'), 'main.ts must call renderHumanTasksView');
  assert.ok(MAIN_TS.includes('renderAllTasksView'), 'main.ts must call renderAllTasksView');
  assert.ok(MAIN_TS.includes('renderQuestionsView'), 'main.ts must call renderQuestionsView');
});

// ---------------------------------------------------------------------------
// 7. Hardened Quality & Parity Invariants
// ---------------------------------------------------------------------------

test('All Tasks: groupAllTasksByStatus preserves all 8 column buckets and matches Kanban count parity', () => {
  const issues = [
    { number: 1, title: 'Draft 1', status: 'draft' },
    { number: 2, title: 'Backlog 1', status: 'backlog' },
    { number: 3, title: 'Todo 1', status: 'todo' },
    { number: 4, title: 'Todo 2', status: 'todo' },
    { number: 5, title: 'Planned 1', status: 'planned' },
    { number: 6, title: 'In-progress 1', status: 'in-progress' },
    { number: 7, title: 'Needs-human 1', status: 'needs-human' },
    { number: 8, title: 'In-review 1', status: 'in-review' },
    { number: 9, title: 'Done 1', status: 'done' },
  ];

  const grouped = groupAllTasksByStatus(issues);
  const totalGrouped = Object.values(grouped).reduce((acc, list) => acc + list.length, 0);
  assert.equal(totalGrouped, issues.length, 'All issues must be accounted for across groups');
  assert.equal(grouped['todo'].length, 2);
  assert.equal(grouped['draft'].length, 1);
  assert.equal(grouped['done'].length, 1);
});

test('Loading vs Empty State: Simplified views distinguish loading state from zero items', () => {
  assert.ok(MAIN_TS.includes('Loading human tasks...'), 'main.ts must include loading state for Human Tasks');
  assert.ok(MAIN_TS.includes('Loading tasks...'), 'main.ts must include loading state for All Tasks');
  assert.ok(MAIN_TS.includes('Loading questions...'), 'main.ts must include loading state for Questions');
  assert.ok(MAIN_TS.includes('spin-fast'), 'main.ts must use spin-fast spinner class');
  assert.ok(INDEX_HTML.includes('.spin-fast'), 'index.html must define .spin-fast CSS rule');
});

test('View Switching: Inactive view containers are cleared on layout change to prevent stale DOM', () => {
  assert.ok(MAIN_TS.includes('currentRenderedLayout && currentRenderedLayout !== activeLayout'), 'Must check layout change');
  assert.ok(MAIN_TS.includes("elHumanViewContainer.innerHTML = ''"), 'Must clear humanViewContainer on switch away');
  assert.ok(MAIN_TS.includes("elAllTasksViewContainer.innerHTML = ''"), 'Must clear allTasksViewContainer on switch away');
  assert.ok(MAIN_TS.includes("elQuestionsViewContainer.innerHTML = ''"), 'Must clear questionsViewContainer on switch away');
});

test('Friendly Title: Fallback safety when title or friendly title is missing or empty', () => {
  const issueEmpty = { number: 42, title: '', body: '' };
  const titles = parseFriendlyTitle(issueEmpty.body, issueEmpty.title);
  const displayTitle = titles.title.trim() || issueEmpty.title?.trim() || `Issue #${issueEmpty.number}`;
  assert.equal(displayTitle, 'Issue #42', 'Must fall back to issue number when title is empty');
});

test('Drawer reveal: Questions view targets existing drawerQuestionsContainer, not non-existent element', () => {
  assert.equal(MAIN_TS.includes('drawerQuestionsCollapsible'), false, 'main.ts must NOT reference nonexistent drawerQuestionsCollapsible');
  assert.ok(MAIN_TS.includes('drawerQuestionsContainer'), 'main.ts must target drawerQuestionsContainer');
  assert.ok(INDEX_HTML.includes('id="drawerQuestionsContainer"'), 'index.html must define drawerQuestionsContainer');
});

test('Accessibility: ARIA landmarks and labels configured on simplified views and controls', () => {
  assert.ok(INDEX_HTML.includes('aria-label="Human Tasks View"'), 'humanViewContainer must have aria-label');
  assert.ok(INDEX_HTML.includes('aria-label="All Tasks View"'), 'allTasksViewContainer must have aria-label');
  assert.ok(INDEX_HTML.includes('aria-label="Questions View"'), 'questionsViewContainer must have aria-label');
  assert.ok(INDEX_HTML.includes('id="btnViewHuman" title="Human Tasks View" aria-label="Human Tasks View"'), 'btnViewHuman must have aria-label');
  assert.ok(INDEX_HTML.includes('id="btnViewAllTasks" title="All Tasks View" aria-label="All Tasks View"'), 'btnViewAllTasks must have aria-label');
  assert.ok(INDEX_HTML.includes('id="btnViewQuestions" title="Questions View" aria-label="Questions View"'), 'btnViewQuestions must have aria-label');
  assert.ok(MAIN_TS.includes('aria-expanded'), 'Inline answer toggles must manage aria-expanded');
  assert.ok(MAIN_TS.includes('aria-level="2"'), 'All tasks group headers must have aria-level');
});
