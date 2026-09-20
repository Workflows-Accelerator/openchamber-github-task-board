import test from 'node:test';
import assert from 'node:assert/strict';

export function parseScratchPadThemes(text) {
  if (!text || typeof text !== 'string') {
    return { themes: [], totalIdeas: 0, totalQuestions: 0 };
  }

  const lines = text.split('\n');
  const themes = [];
  let currentTheme = { name: 'General Ideas', lines: [] };
  let hasExplicitHeader = false;

  for (const line of lines) {
    const trimmed = line.trim();
    const headingMatch = trimmed.match(/^#{1,3}\s+(?:\[Theme:\s*)?([^\]\n]+)\]?/i);
    if (headingMatch) {
      if (currentTheme.lines.length > 0 || hasExplicitHeader) {
        themes.push(currentTheme);
      }
      hasExplicitHeader = true;
      currentTheme = {
        name: headingMatch[1].trim(),
        lines: [],
      };
      continue;
    }
    currentTheme.lines.push(line);
  }

  if (currentTheme.lines.length > 0 || hasExplicitHeader) {
    themes.push(currentTheme);
  }

  // Filter out completely empty themes
  const activeThemes = themes.filter((t) => t.lines.some((l) => l.trim().length > 0) || t.name !== 'General Ideas');

  let totalIdeas = 0;
  let totalQuestions = 0;

  const analyzed = activeThemes.map((t) => {
    const content = t.lines.join('\n').trim();
    const ideaLines = t.lines.filter((l) => /^\s*(?:[-*+]|\d+\.)(?:\s*\[[ xX]?\])?\s+(?!\?|Q:|Question:)/i.test(l));
    const questionLines = t.lines.filter((l) => /(?:\?|\bQ:|\bQuestion:|\?\s*\[)/i.test(l));
    const ideasCount = ideaLines.length || (content ? 1 : 0);
    const questionsCount = questionLines.length;
    totalIdeas += ideasCount;
    totalQuestions += questionsCount;
    return {
      name: t.name,
      content,
      ideasCount,
      questionsCount,
    };
  });

  return {
    themes: analyzed,
    totalIdeas,
    totalQuestions,
  };
}

export const DEFAULT_AI_ALIGNMENT_PROMPT = `You are a principal engineer and architect conducting a deep technical alignment session for repository "{repo}".

User Scratch Pad / Multi-Theme Mind-Dump:
{userInput}

Instructions for the Alignment Session:
1. Review every theme, idea, feature, and bug in the user's scratch pad.
2. Ground yourself by inspecting project architecture, existing modules, conventions, and configuration files in this workspace.
3. Your primary goal is ALIGNMENT before issue creation:
   - For each distinct theme, identify unstated assumptions, ambiguities, technical tradeoffs, and potential edge cases.
   - Formulate probing, concise questions that need clarification (e.g. data modeling decisions, auth boundaries, UX state handling, error recovery).
   - Propose 2-3 architectural approaches or solutions for tricky decisions with pros/cons and a clear recommendation.
4. Interact directly with the user to align on answers.
5. Once aligned on each theme, synthesize the finalized decisions into clean, well-scoped GitHub issues containing:
   - Title in Conventional Commit format
   - Impacted files and architectural plan
   - Actionable Subtasks Checklist (- [ ])
   - Open Questions (- [ ] / - [x])
   - Suggested worktree branch slug`;

export function resolveAiAlignmentPrompt({ repo, userInput, storedPrompt }) {
  const template = storedPrompt?.trim() || DEFAULT_AI_ALIGNMENT_PROMPT;
  return template.replace(/\{repo\}/g, repo || '').replace(/\{userInput\}/g, (userInput || '').trim());
}

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
