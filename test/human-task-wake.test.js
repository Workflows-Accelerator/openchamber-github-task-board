import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseHumanTasks,
  updateSubtaskInMarkdown,
  buildHumanTaskResumePrompt,
  shouldNotifyAgentOnHumanTasksComplete,
} from '../panel/core.ts';

test('Issue #14: buildHumanTaskResumePrompt formats prompt with issue number and exact contract', () => {
  const prompt14 = buildHumanTaskResumePrompt(14);
  assert.equal(
    prompt14,
    'All human tasks for issue #14 are now complete. Resume work, run your verification suite, and advance the issue to the next step.'
  );

  const prompt42 = buildHumanTaskResumePrompt(42);
  assert.equal(
    prompt42,
    'All human tasks for issue #42 are now complete. Resume work, run your verification suite, and advance the issue to the next step.'
  );
});

test('Issue #14: shouldNotifyAgentOnHumanTasksComplete triggers only when transitioning to all complete', () => {
  const t1Open = { id: '1', lineIndex: 1, completed: false, text: 'Task 1', rawLine: '- [ ] Task 1' };
  const t1Done = { id: '1', lineIndex: 1, completed: true, text: 'Task 1', rawLine: '- [x] Task 1' };
  const t2Open = { id: '2', lineIndex: 2, completed: false, text: 'Task 2', rawLine: '- [ ] Task 2' };
  const t2Done = { id: '2', lineIndex: 2, completed: true, text: 'Task 2', rawLine: '- [x] Task 2' };

  // 1. Partial completion: checking 1 of 2 tasks -> should NOT notify
  const partial = shouldNotifyAgentOnHumanTasksComplete([t1Open, t2Open], [t1Done, t2Open]);
  assert.equal(partial, false, 'Partial task completion must not trigger notification');

  // 2. Final completion: checking the last of 2 tasks -> MUST notify
  const completedAll = shouldNotifyAgentOnHumanTasksComplete([t1Done, t2Open], [t1Done, t2Done]);
  assert.equal(completedAll, true, 'Checking the last human task must trigger notification');

  // 3. Unchecking a task: all complete -> 1 open -> should NOT notify
  const unchecked = shouldNotifyAgentOnHumanTasksComplete([t1Done, t2Done], [t1Done, t2Open]);
  assert.equal(unchecked, false, 'Unchecking a task must not trigger notification');

  // 4. Already all complete (no transition): all complete -> all complete -> should NOT notify
  const redundant = shouldNotifyAgentOnHumanTasksComplete([t1Done, t2Done], [t1Done, t2Done]);
  assert.equal(redundant, false, 'Already complete human tasks must not re-trigger notification');

  // 5. Empty task lists -> should NOT notify
  assert.equal(shouldNotifyAgentOnHumanTasksComplete([], []), false);
  assert.equal(shouldNotifyAgentOnHumanTasksComplete(null, []), false);
  assert.equal(shouldNotifyAgentOnHumanTasksComplete([], [t1Open]), false);
});

test('Issue #14: markdown updates correctly reflect human task transitions', () => {
  const initialBody = `### Human Tasks:\n- [ ] Sign off on DB schema\n- [ ] Verify staging token\n`;
  const tasks1 = parseHumanTasks(initialBody);
  assert.equal(tasks1.length, 2);
  assert.equal(tasks1[0].completed, false);
  assert.equal(tasks1[1].completed, false);

  // Check first task
  const body2 = updateSubtaskInMarkdown(initialBody, tasks1[0].lineIndex, true);
  const tasks2 = parseHumanTasks(body2);
  assert.equal(shouldNotifyAgentOnHumanTasksComplete(tasks1, tasks2), false);

  // Check second (last) task
  const body3 = updateSubtaskInMarkdown(body2, tasks2[1].lineIndex, true);
  const tasks3 = parseHumanTasks(body3);
  assert.equal(shouldNotifyAgentOnHumanTasksComplete(tasks2, tasks3), true);

  // Uncheck second task
  const body4 = updateSubtaskInMarkdown(body3, tasks3[1].lineIndex, false);
  const tasks4 = parseHumanTasks(body4);
  assert.equal(shouldNotifyAgentOnHumanTasksComplete(tasks3, tasks4), false);
});
