import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DEFAULT_AI_ISSUE_PROMPT,
  DEFAULT_AI_ALIGNMENT_PROMPT,
  resolveAiIssuePrompt,
  resolveAiAlignmentPrompt,
  buildConsolidatedIssuePrompt,
  DEFAULT_TEMPLATES,
  mergeTemplates,
  buildAgentIssuePrompt,
} from '../panel/core.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MAIN_TS = fs.readFileSync(path.join(__dirname, '../panel/main.ts'), 'utf8');

// Zero emoji helper
function containsEmoji(text) {
  if (!text) return false;
  const emojiRegex = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F000}-\u{1F02F}\u{1F0A0}-\u{1F0FF}]/u;
  return emojiRegex.test(text);
}

test('DEFAULT_AI_ISSUE_PROMPT adheres strictly to Issue Body Contract v1 and contains zero emojis', () => {
  assert.equal(containsEmoji(DEFAULT_AI_ISSUE_PROMPT), false);

  // Exact section order
  const sections = [
    '### Friendly Title:',
    'Overview:',
    '### Acceptance Criteria:',
    '### Actionable Subtasks Checklist:',
    '### Open Questions:',
    '### Human Tasks:',
    '## Test Plan (Issue):',
  ];

  let prevIdx = -1;
  for (const s of sections) {
    const idx = DEFAULT_AI_ISSUE_PROMPT.indexOf(s);
    assert.ok(idx >= 0, `Missing required section: "${s}"`);
    assert.ok(idx > prevIdx, `Section "${s}" must appear after previous section in contract`);
    prevIdx = idx;
  }

  // AFK & Autonomous protocol
  assert.ok(DEFAULT_AI_ISSUE_PROMPT.includes('Autonomous & AFK Protocol'));
  assert.ok(DEFAULT_AI_ISSUE_PROMPT.includes('status:needs-human'));
  assert.ok(DEFAULT_AI_ISSUE_PROMPT.includes('status:draft'));
  assert.ok(DEFAULT_AI_ISSUE_PROMPT.includes('status:todo'));

  // curl with git-credentials
  assert.ok(DEFAULT_AI_ISSUE_PROMPT.includes('~/.git-credentials'));
  assert.ok(DEFAULT_AI_ISSUE_PROMPT.includes('curl'));
});

test('DEFAULT_AI_ALIGNMENT_PROMPT enforces Issue Body Contract v1 sections and contains zero emojis', () => {
  assert.equal(containsEmoji(DEFAULT_AI_ALIGNMENT_PROMPT), false);

  assert.ok(DEFAULT_AI_ALIGNMENT_PROMPT.includes('### Friendly Title:'));
  assert.ok(DEFAULT_AI_ALIGNMENT_PROMPT.includes('## Overview'));
  assert.ok(DEFAULT_AI_ALIGNMENT_PROMPT.includes('### Acceptance Criteria:'));
  assert.ok(DEFAULT_AI_ALIGNMENT_PROMPT.includes('### Actionable Subtasks Checklist:'));
  assert.ok(DEFAULT_AI_ALIGNMENT_PROMPT.includes('### Open Questions:'));
  assert.ok(DEFAULT_AI_ALIGNMENT_PROMPT.includes('### Human Tasks:'));
  assert.ok(DEFAULT_AI_ALIGNMENT_PROMPT.includes('## Test Plan (Issue):'));
  assert.ok(DEFAULT_AI_ALIGNMENT_PROMPT.includes('issue-lifecycle'));
});

test('buildConsolidatedIssuePrompt avoids duplicate subtasks checklist and adds AFK protocol', () => {
  // Case A: Issue body already contains checklist
  const issueWithChecklist = {
    number: 10,
    title: 'Multi-task issue',
    body: '## Overview\nSome body\n\n### Actionable Subtasks Checklist:\n- [ ] Task in body',
    subtasks: [{ text: 'Task in body', completed: false }],
  };
  const promptA = buildConsolidatedIssuePrompt([issueWithChecklist]);
  const checklistOccurrences = (promptA.match(/### Actionable Subtasks Checklist:/g) || []).length;
  assert.equal(checklistOccurrences, 1, 'Checklist header must not be duplicated when already present in issue body');
  assert.ok(promptA.includes('Autonomous & AFK Protocol'));

  // Case B: Issue body lacks checklist, subtasks array provides it
  const issueWithoutChecklist = {
    number: 11,
    title: 'Issue without checklist in body',
    body: '## Overview\nJust body text without checklist',
    subtasks: [{ text: 'Subtask from array', completed: true }],
  };
  const promptB = buildConsolidatedIssuePrompt([issueWithoutChecklist]);
  assert.ok(promptB.includes('### Actionable Subtasks Checklist:'));
  assert.ok(promptB.includes('- [x] Subtask from array'));
});

test('DEFAULT_TEMPLATES, mergeTemplates, and buildAgentIssuePrompt are first-class exports in core.ts', () => {
  assert.ok(DEFAULT_TEMPLATES.bug);
  assert.ok(DEFAULT_TEMPLATES.feature);
  assert.ok(DEFAULT_TEMPLATES.task);

  const custom = {
    doc: {
      id: 'doc',
      name: 'Documentation Update',
      promptInstructions: '### Overview\n- [ ] Write docs',
    },
  };
  const merged = mergeTemplates(DEFAULT_TEMPLATES, custom);
  assert.ok(merged.doc);
  assert.equal(merged.doc.name, 'Documentation Update');

  const prompt = buildAgentIssuePrompt({
    repo: 'my-org/my-repo',
    template: DEFAULT_TEMPLATES.bug,
    userGoal: 'Fix crash on startup',
  });
  assert.ok(prompt.includes('my-org/my-repo'));
  assert.ok(prompt.includes('Fix crash on startup'));
  assert.ok(prompt.includes('Bug Report'));
});

test('panel/main.ts preflight brief includes extended skills (UI, API, Perf, Security, Refactor) and AFK protocol', () => {
  assert.ok(MAIN_TS.includes('frontend-ui-engineering'));
  assert.ok(MAIN_TS.includes('api-and-interface-design'));
  assert.ok(MAIN_TS.includes('performance-optimization'));
  assert.ok(MAIN_TS.includes('security-and-hardening'));
  assert.ok(MAIN_TS.includes('code-simplification'));
  assert.ok(MAIN_TS.includes('safe-refactor'));
  assert.ok(MAIN_TS.includes('Autonomous & AFK Protocol'));
  assert.ok(MAIN_TS.includes('Load relevant skills'));
  assert.ok(MAIN_TS.includes('Transclusion references for worker sessions'));
});

test('panel/main.ts handleFilePathClick checks currentDirectory and currentProject candidates', () => {
  assert.ok(MAIN_TS.includes('cleanCurDir'));
  assert.ok(MAIN_TS.includes('cleanProjDir'));
  assert.ok(MAIN_TS.includes('${cleanCurDir}/${cleanPath}'));
});
