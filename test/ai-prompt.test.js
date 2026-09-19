import test from 'node:test';
import assert from 'node:assert/strict';

export const DEFAULT_AI_ISSUE_PROMPT = `You are an expert software engineer creating GitHub issues for repository "{repo}".

Input Objective / User Mind-Dump:
{userInput}

Instructions for the Agent:
1. Analyze the user's input. If the user described multiple independent tasks, bugs, or features, decompose them into distinct, well-scoped GitHub issues. If it describes a single topic, create one focused issue.
2. Ground all details in the actual codebase by inspecting relevant project files, function names, and architecture.
3. Every generated issue must follow this exact structure tailored for the OpenChamber Task Board:
   - Title: Conventional commit format (e.g. "feat(auth): add remember-me token refresh" or "fix(ui): prevent horizontal overflow in mobile table").
   - Overview: Clear description of the problem, motivation, or user value.
   - Files Impacted: List candidate file paths grounded in the codebase.
   - Actionable Subtasks Checklist: Mandatory interactive Markdown checkboxes (- [ ]) for each discrete implementation and verification step:
     - [ ] Reproduce with test / define contract
     - [ ] Implement core changes
     - [ ] Run test suite and verify green
   - Recommended Worktree Branch: Suggest an isolated git branch name following "issue-<number>-<slug>".
   - Labels: Recommend labels (e.g. "bug", "enhancement", "documentation").
4. If a GitHub token or gh CLI is available in the environment, you can create the issues directly using the GitHub API. Otherwise, present the complete, ready-to-copy issue titles and bodies for user review.`;

export function resolveAiIssuePrompt({ repo, userInput, storedRepoPrompt, storedGlobalPrompt }) {
  const template = storedRepoPrompt?.trim() || storedGlobalPrompt?.trim() || DEFAULT_AI_ISSUE_PROMPT;
  return template
    .replace(/\{repo\}/g, repo)
    .replace(/\{userInput\}/g, userInput.trim());
}

export function containsEmoji(text) {
  if (!text) return false;
  // Regex matching emojis, symbols, and sparkles
  const emojiRegex = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F000}-\u{1F02F}\u{1F0A0}-\u{1F0FF}]/u;
  return emojiRegex.test(text);
}

test('DEFAULT_AI_ISSUE_PROMPT contains zero emojis', () => {
  assert.equal(containsEmoji(DEFAULT_AI_ISSUE_PROMPT), false);
});

test('resolveAiIssuePrompt uses repository prompt when present', () => {
  const customRepoPrompt = 'Custom repo prompt for {repo}: {userInput}';
  const resolved = resolveAiIssuePrompt({
    repo: 'my-org/my-repo',
    userInput: 'Add login button',
    storedRepoPrompt: customRepoPrompt,
    storedGlobalPrompt: 'Global prompt',
  });
  assert.equal(resolved, 'Custom repo prompt for my-org/my-repo: Add login button');
});

test('resolveAiIssuePrompt falls back to global prompt when repo prompt is absent', () => {
  const customGlobalPrompt = 'Custom global prompt for {repo}: {userInput}';
  const resolved = resolveAiIssuePrompt({
    repo: 'my-org/my-repo',
    userInput: 'Add login button',
    storedRepoPrompt: null,
    storedGlobalPrompt: customGlobalPrompt,
  });
  assert.equal(resolved, 'Custom global prompt for my-org/my-repo: Add login button');
});

test('resolveAiIssuePrompt falls back to default prompt when neither is configured', () => {
  const resolved = resolveAiIssuePrompt({
    repo: 'Workflows-Accelerator/cmp',
    userInput: 'Fix modal flicker on mobile and add export to CSV',
  });
  assert.ok(resolved.includes('Workflows-Accelerator/cmp'));
  assert.ok(resolved.includes('Fix modal flicker on mobile and add export to CSV'));
  assert.ok(resolved.includes('Actionable Subtasks Checklist'));
  assert.equal(containsEmoji(resolved), false);
});
