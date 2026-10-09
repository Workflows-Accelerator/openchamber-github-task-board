import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_TEMPLATES,
  mergeTemplates,
  buildAgentIssuePrompt,
} from '../panel/core.ts';

export { DEFAULT_TEMPLATES, mergeTemplates, buildAgentIssuePrompt };

test('mergeTemplates preserves defaults when no custom templates exist', () => {
  const merged = mergeTemplates(DEFAULT_TEMPLATES, null);
  assert.equal(merged.bug.id, 'bug');
  assert.equal(merged.feature.id, 'feature');
  assert.equal(merged.task.id, 'task');
});

test('mergeTemplates allows user customizations to override template instructions', () => {
  const custom = {
    bug: {
      promptInstructions: 'Custom bug instructions with custom checklist:\n- [ ] Custom check',
    },
  };
  const merged = mergeTemplates(DEFAULT_TEMPLATES, custom);
  assert.equal(merged.bug.promptInstructions, 'Custom bug instructions with custom checklist:\n- [ ] Custom check');
  assert.equal(merged.feature.promptInstructions, DEFAULT_TEMPLATES.feature.promptInstructions);
});

test('mergeTemplates allows defining new custom template types', () => {
  const custom = {
    security: {
      id: 'security',
      name: 'Security Audit',
      description: 'Audit vulnerability',
      promptInstructions: '### Threat Model\n- [ ] Verify bounds',
    },
  };
  const merged = mergeTemplates(DEFAULT_TEMPLATES, custom);
  assert.ok(merged.security);
  assert.equal(merged.security.name, 'Security Audit');
});

test('buildAgentIssuePrompt incorporates repo, goal, and template instructions', () => {
  const prompt = buildAgentIssuePrompt({
    repo: 'Workflows-Accelerator/cmp',
    template: DEFAULT_TEMPLATES.bug,
    userGoal: 'Fix race condition in login session refresh',
  });
  assert.ok(prompt.includes('Workflows-Accelerator/cmp'));
  assert.ok(prompt.includes('Fix race condition in login session refresh'));
  assert.ok(prompt.includes('Reproduce with an isolated test'));
  assert.ok(prompt.includes('- [ ]'));
});
