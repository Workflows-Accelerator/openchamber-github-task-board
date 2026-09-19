import test from 'node:test';
import assert from 'node:assert/strict';

export const DEFAULT_TEMPLATES = {
  bug: {
    id: 'bug',
    name: 'Bug Report',
    description: 'Investigate unexpected behavior, identify root cause, and draft fix subtasks',
    promptInstructions: `### Problem Description
[Detailed explanation of what went wrong, including error messages or unexpected behavior]

### Steps to Reproduce
1. [First step]
2. [Second step]

### Root Cause Analysis
[Inspect the relevant codebase files and explain the underlying mechanism]

### Actionable Fix Subtasks
- [ ] Reproduce with an isolated test
- [ ] Implement narrow surgical fix
- [ ] Verify test suite passes
- [ ] Verify regression resistance`,
  },
  feature: {
    id: 'feature',
    name: 'Feature / Enhancement',
    description: 'Design and specify new functionality with architectural plan and subtasks',
    promptInstructions: `### Goal & User Value
[Why this feature is needed and what problem it solves]

### Architectural & UI Design
[Proposed technical architecture, component structure, or API changes]

### Actionable Implementation Subtasks
- [ ] Define interfaces and types
- [ ] Implement core logic / components
- [ ] Add unit and integration tests
- [ ] Verify end-to-end user flow`,
  },
  task: {
    id: 'task',
    name: 'Technical Debt / Refactor',
    description: 'Code cleanup, performance optimization, or architecture simplification',
    promptInstructions: `### Motivation
[Identify dead code, performance bottlenecks, or architectural complexity]

### Scope of Refactoring
[Specific files and modules to touch, and what must remain unchanged]

### Actionable Checklist
- [ ] Establish baseline test coverage
- [ ] Perform behavior-preserving refactoring
- [ ] Verify existing tests continue to pass without regressions`,
  },
};

export function mergeTemplates(defaults, userCustomTemplates) {
  if (!userCustomTemplates || typeof userCustomTemplates !== 'object') {
    return { ...defaults };
  }
  const result = { ...defaults };
  for (const [key, val] of Object.entries(userCustomTemplates)) {
    if (val && typeof val === 'object' && val.promptInstructions) {
      result[key] = {
        ...(result[key] || { id: key, name: key }),
        ...val,
      };
    }
  }
  return result;
}

export function buildAgentIssuePrompt({ repo, template, userGoal }) {
  return `You are tasked with drafting and creating a new GitHub Issue for repository "${repo}".

User Objective / Summary:
${userGoal.trim()}

Template Specification (${template.name}):
Follow this exact structure and include actionable markdown subtasks (- [ ]):

${template.promptInstructions.trim()}

Instructions for the Agent:
1. Inspect the relevant repository files in the project to gather accurate context, file paths, and function names.
2. Structure the issue clearly with a concise title and the markdown body following the template above.
3. Include an interactive checklist of subtasks with "- [ ]".
4. Once you have drafted the complete issue, ask the user for confirmation or output the finalized issue so it can be committed to GitHub.`;
}

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
