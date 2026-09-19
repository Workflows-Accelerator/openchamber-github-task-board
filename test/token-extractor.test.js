import test from 'node:test';
import assert from 'node:assert/strict';

export function extractGitHubTokenFromCredentials(content) {
  if (!content || typeof content !== 'string') return null;
  const match = content.match(/https:\/\/(?:[^:]+?:)?(gh[pousr]_[A-Za-z0-9_]+)@github\.com/);
  if (match) return match[1];
  const generic = content.match(/gh[pousr]_[A-Za-z0-9_]+/);
  return generic ? generic[0] : null;
}

test('extracts personal access token from .git-credentials content', () => {
  const sample = 'https://x-access-token:ghp_1234567890abcdef@github.com\n';
  assert.equal(extractGitHubTokenFromCredentials(sample), 'ghp_1234567890abcdef');
});

test('extracts personal access token from gitconfig url', () => {
  const sample = '[url "https://x-access-token:ghp_secretToken_123@github.com/"]';
  assert.equal(extractGitHubTokenFromCredentials(sample), 'ghp_secretToken_123');
});
