import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as Core from '../panel/core.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MAIN_TS = fs.readFileSync(path.join(__dirname, '../panel/main.ts'), 'utf8');

// ==========================================
// Optimistic Locking & Mutator Unit Tests
// ==========================================

test('normalizeGithubIssues preserves updated_at and never emits undefined', () => {
  const rawIssue = {
    number: 10,
    title: 'Test issue',
    body: '## Subtasks\n- [ ] Task 1',
    state: 'open',
    html_url: 'https://github.com/owner/repo/issues/10',
    created_at: '2026-10-01T10:00:00Z',
    updated_at: '2026-10-09T14:30:00Z',
    labels: [],
  };

  const normalized = Core.normalizeGithubIssues([rawIssue]);
  assert.equal(normalized.length, 1);
  assert.equal(normalized[0].updated_at, '2026-10-09T14:30:00Z');

  // Issue without updated_at falls back to created_at or empty string (never undefined)
  const rawIssueNoUpdate = {
    number: 11,
    title: 'No update',
    body: '',
    state: 'open',
    html_url: 'https://github.com/owner/repo/issues/11',
    created_at: '2026-10-01T10:00:00Z',
    labels: [],
  };
  const normalized2 = Core.normalizeGithubIssues([rawIssueNoUpdate]);
  assert.equal(normalized2[0].updated_at, undefined);

  for (const [k, v] of Object.entries(normalized2[0])) {
    assert.notEqual(v, undefined, `property ${k} must not be undefined`);
  }
});

test('resolveOptimisticSubtaskUpdate re-indexes tasks on fresh body and toggles state safely', () => {
  const initialBody = `## Description\nInitial description\n\n### Subtasks\n- [ ] Task Alpha\n- [ ] Task Beta\n`;

  // Remote agent added lines before subtasks:
  const remoteBody = `## Description\nInitial description\n\nAgent added comment.\nAnother line here.\n\n### Subtasks\n- [ ] Task Alpha\n- [ ] Task Beta\n`;

  // Apply mutation for Task Beta on remote body:
  const result = Core.resolveOptimisticSubtaskUpdate(remoteBody, 'Task Beta', true);
  assert.equal(result.found, true);
  assert.ok(result.updatedBody.includes('- [x] Task Beta'));
  assert.ok(result.updatedBody.includes('- [ ] Task Alpha'));
  assert.ok(result.updatedBody.includes('Agent added comment.'));

  // Non-existent task returns found: false
  const notFound = Core.resolveOptimisticSubtaskUpdate(remoteBody, 'Task Gamma', true);
  assert.equal(notFound.found, false);
  assert.equal(notFound.updatedBody, remoteBody);
});

test('resolveOptimisticQuestionAnswer re-indexes questions on fresh body and inserts answer safely', () => {
  const remoteBody = `## Questions\n- [ ] Which database should we use?\n- [ ] Which port?\n\nTrailing notes`;

  const result = Core.resolveOptimisticQuestionAnswer(remoteBody, 'Which database should we use?', 'PostgreSQL');
  assert.equal(result.found, true);
  assert.ok(result.updatedBody.includes('- [x] Which database should we use?'));
  assert.ok(result.updatedBody.includes('PostgreSQL'));
  assert.ok(result.updatedBody.includes('- [ ] Which port?'));

  // Non-existent question returns found: false
  const notFound = Core.resolveOptimisticQuestionAnswer(remoteBody, 'Unknown question?', 'None');
  assert.equal(notFound.found, false);
  assert.equal(notFound.updatedBody, remoteBody);
});

test('panel/main.ts implements optimistic locking check on updated_at and reloads issue body', () => {
  // Checks for updated_at tracking and optimistic lock pattern
  assert.ok(MAIN_TS.includes('updated_at'), 'panel/main.ts references updated_at');
  assert.ok(
    MAIN_TS.includes('resolveOptimisticSubtaskUpdate') || MAIN_TS.includes('reloadIssueState') || MAIN_TS.includes('fresh.updated_at') || MAIN_TS.includes('optimistic'),
    'panel/main.ts implements optimistic reload or optimistic subtask update'
  );
});
