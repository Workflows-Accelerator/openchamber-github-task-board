import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseScratchPadThemes,
  resolveAiAlignmentPrompt,
  DEFAULT_AI_ALIGNMENT_PROMPT,
  extractTaskThemes,
  getIssueTheme,
} from '../panel/core.ts';

test('parseScratchPadThemes parses markdown headers into categorized themes and counts items', () => {
  const scratchpadContent = `
## [Theme: Authentication]
- [ ] Add session refresh tokens
- [ ] Remember me checkbox
- ? Should tokens be stored in HttpOnly cookies or localStorage?

## [Theme: UI Redesign]
- [ ] Dark mode toggle
- [ ] Responsive navigation drawer
- ? What breakpoint for tablet?
`;

  const parsed = parseScratchPadThemes(scratchpadContent);
  assert.equal(parsed.themes.length, 2);
  assert.equal(parsed.themes[0].name, 'Authentication');
  assert.equal(parsed.themes[0].ideasCount, 2);
  assert.equal(parsed.themes[0].questionsCount, 1);

  assert.equal(parsed.themes[1].name, 'UI Redesign');
  assert.equal(parsed.themes[1].ideasCount, 2);
  assert.equal(parsed.themes[1].questionsCount, 1);
  assert.equal(parsed.totalIdeas, 4);
  assert.equal(parsed.totalQuestions, 2);
});

test('parseScratchPadThemes handles unstructured raw mind-dump into General Ideas', () => {
  const rawText = `Fix crash on startup\nMake button blue\nIs postgres supported?`;
  const parsed = parseScratchPadThemes(rawText);
  assert.equal(parsed.themes.length, 1);
  assert.equal(parsed.themes[0].name, 'General Ideas');
  assert.equal(parsed.totalQuestions, 1);
});

test('resolveAiAlignmentPrompt incorporates repo and scratchpad text with zero emojis', () => {
  const prompt = resolveAiAlignmentPrompt({
    repo: 'my-org/my-app',
    userInput: '## [Theme: Billing]\nAdd Stripe webhook support',
  });
  assert.ok(prompt.includes('my-org/my-app'));
  assert.ok(prompt.includes('Theme: Billing'));
  assert.ok(prompt.includes('Add Stripe webhook support'));
  assert.ok(prompt.includes('ALIGNMENT before issue creation'));
  // Zero emojis rule
  const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
  assert.equal(emojiRegex.test(prompt), false);
});

test('extractTaskThemes extracts and ranks existing themes with task frequencies', () => {
  const sampleIssues = [
    { number: 1, labels: [{ name: 'theme:authentication' }] },
    { number: 2, labels: [{ name: 'theme:authentication' }] },
    { number: 3, labels: [{ name: 'frontend' }] },
    { number: 4, labels: [{ name: 'theme:billing' }] },
    { number: 5, labels: [{ name: 'theme:billing' }] },
    { number: 6, labels: [{ name: 'theme:billing' }] },
    { number: 7, labels: [{ name: 'status:todo' }] }, // No Theme
  ];

  const themes = extractTaskThemes(sampleIssues);
  assert.equal(themes.length, 3);
  // billing has 3
  assert.equal(themes[0].theme, 'billing');
  assert.equal(themes[0].count, 3);
  // authentication has 2
  assert.equal(themes[1].theme, 'authentication');
  assert.equal(themes[1].count, 2);
  // frontend has 1
  assert.equal(themes[2].theme, 'frontend');
  assert.equal(themes[2].count, 1);
});
