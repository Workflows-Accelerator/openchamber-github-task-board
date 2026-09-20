import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_AI_ISSUE_PROMPT,
  resolveAiIssuePrompt,
} from '../panel/core.ts';

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
