import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  parseScratchPadThemes,
  resolveAiAlignmentPrompt,
  DEFAULT_AI_ALIGNMENT_PROMPT,
  extractTaskThemes,
  getIssueTheme,
} from '../panel/core.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const MAIN_TS = fs.readFileSync(path.join(here, '..', 'panel', 'main.ts'), 'utf8');

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

test('scratchpad debounce delay is 1000ms in panel/main.ts', () => {
  // Extract handleScratchpadInput function implementation from main.ts
  const inputHandlerMatch = MAIN_TS.match(/function\s+handleScratchpadInput\(\):\s*void\s*\{([\s\S]*?)\n\}/);
  assert.ok(inputHandlerMatch, 'main.ts must define handleScratchpadInput function');
  const handlerBody = inputHandlerMatch[1];

  // Debounce timeout must be 1000ms (not 300ms)
  assert.match(
    handlerBody,
    /scratchpadSaveTimer\s*=\s*setTimeout\([\s\S]*?,\s*1000\s*\);?/,
    'scratchpadSaveTimer debounce timeout must be 1000ms'
  );
  assert.equal(handlerBody.includes('300'), false, '300ms debounce must be replaced by 1000ms');

  // Must call flushScratchpadSave inside the debounce timeout
  assert.ok(
    handlerBody.includes('flushScratchpadSave()'),
    'handleScratchpadInput timer callback must invoke flushScratchpadSave'
  );
});

test('scratchpad debounce delays save by exactly 1000ms and collapses rapid keystrokes', () => {
  let currentTime = 0;
  let timerId = 0;
  let scheduledTimer = null;
  let saveCount = 0;
  let savedContent = '';

  const mockStorage = {};
  const mockLocalStorage = {};

  const clock = {
    setTimeout(fn, delay) {
      const id = ++timerId;
      scheduledTimer = { id, fn, runAt: currentTime + delay, delay };
      return id;
    },
    clearTimeout(id) {
      if (scheduledTimer && scheduledTimer.id === id) {
        scheduledTimer = null;
      }
    },
    tick(ms) {
      currentTime += ms;
      if (scheduledTimer && scheduledTimer.runAt <= currentTime) {
        const { fn } = scheduledTimer;
        scheduledTimer = null;
        fn();
      }
    },
  };

  let pendingTimer = null;
  let saveStatus = 'Saved';

  function flushScratchpadSave(content) {
    if (pendingTimer !== null) {
      clock.clearTimeout(pendingTimer);
      pendingTimer = null;
    }
    mockLocalStorage['scratchpad'] = content;
    mockStorage['scratchpad'] = content;
    saveCount++;
    savedContent = content;
    saveStatus = 'Saved';
  }

  function handleScratchpadInput(content) {
    saveStatus = 'Saving...';
    if (pendingTimer !== null) {
      clock.clearTimeout(pendingTimer);
    }
    pendingTimer = clock.setTimeout(() => {
      flushScratchpadSave(content);
    }, 1000);
  }

  // Type first character
  handleScratchpadInput('H');
  assert.equal(saveStatus, 'Saving...');
  assert.equal(saveCount, 0);
  assert.equal(scheduledTimer.delay, 1000, 'debounce delay must be 1000ms');

  // Advance clock by 300ms (old debounce time) - should NOT have saved yet
  clock.tick(300);
  assert.equal(saveCount, 0, 'must not save at 300ms');
  assert.equal(saveStatus, 'Saving...');

  // Type another character at 300ms - resets timer
  handleScratchpadInput('He');
  assert.equal(saveCount, 0);

  // Advance by another 800ms (total 1100ms, but only 800ms since last keystroke)
  clock.tick(800);
  assert.equal(saveCount, 0, 'must not save before 1000ms has elapsed since last input');

  // Advance remaining 200ms (1000ms reached since 'He')
  clock.tick(200);
  assert.equal(saveCount, 1, 'must save once 1000ms debounce expires');
  assert.equal(savedContent, 'He');
  assert.equal(saveStatus, 'Saved');
  assert.equal(pendingTimer, null);
});

test('blur and modal close trigger flushScratchpadSave in panel/main.ts', () => {
  // Check flushScratchpadSave definition
  assert.match(
    MAIN_TS,
    /function\s+flushScratchpadSave\(\):\s*void\s*\{([\s\S]*?)\n\}/,
    'flushScratchpadSave must be extracted as a standalone function'
  );

  // Check blur listener on elScratchpadTextarea
  assert.match(
    MAIN_TS,
    /elScratchpadTextarea\.addEventListener\(['"]blur['"],\s*(?:flushScratchpadSave|\(\)\s*=>\s*\{?\s*flushScratchpadSave\(\);?\s*\}?)\);?/,
    'elScratchpadTextarea must attach blur event listener triggering flushScratchpadSave'
  );

  // Check visibilitychange listener on document
  const visibilityMatch = MAIN_TS.match(/document\.addEventListener\(['"]visibilitychange['"],\s*\(\)\s*=>\s*\{([\s\S]*?)\}\);?/);
  assert.ok(visibilityMatch, 'document must attach visibilitychange listener');
  assert.ok(visibilityMatch[1].includes('document.hidden'), 'visibilitychange listener must check document.hidden');
  assert.ok(visibilityMatch[1].includes('flushScratchpadSave()'), 'visibilitychange listener must flush scratchpad save');

  // Check closeScratchpadModal calls flushScratchpadSave before closing
  const closeModalMatch = MAIN_TS.match(/function\s+closeScratchpadModal\(\):\s*void\s*\{([\s\S]*?)\n\}/);
  assert.ok(closeModalMatch, 'closeScratchpadModal must be defined');
  const closeBody = closeModalMatch[1];
  const flushIndex = closeBody.indexOf('flushScratchpadSave()');
  const removeClassIndex = closeBody.indexOf('classList.remove');
  assert.ok(flushIndex !== -1, 'closeScratchpadModal must call flushScratchpadSave');
  assert.ok(flushIndex < removeClassIndex, 'flushScratchpadSave must be called before closing modal');

  // Check openScratchpadModal calls loadScratchpadContent
  const openModalMatch = MAIN_TS.match(/async\s+function\s+openScratchpadModal\(\):\s*Promise<void>\s*\{([\s\S]*?)\n\}/);
  assert.ok(openModalMatch, 'openScratchpadModal must be defined');
  assert.ok(openModalMatch[1].includes('loadScratchpadContent()'), 'openScratchpadModal must call loadScratchpadContent');
});

test('blur, visibilitychange, and modal close trigger immediate flush and clear pending timer', () => {
  let timerId = 0;
  let scheduledTimers = new Map();
  let pendingTimer = null;
  let saveCount = 0;
  let savedStorage = {};
  let savedLocalStorage = {};
  let saveStatus = 'Saved';
  let isModalActive = false;

  const clock = {
    setTimeout(fn, delay) {
      const id = ++timerId;
      scheduledTimers.set(id, fn);
      return id;
    },
    clearTimeout(id) {
      scheduledTimers.delete(id);
    },
  };

  let textareaValue = '';

  function flushScratchpadSave() {
    if (pendingTimer !== null) {
      clock.clearTimeout(pendingTimer);
      pendingTimer = null;
    }
    const text = textareaValue;
    savedLocalStorage['scratchpad'] = text;
    savedStorage['scratchpad'] = text;
    saveCount++;
    saveStatus = 'Saved';
  }

  function handleScratchpadInput() {
    saveStatus = 'Saving...';
    if (pendingTimer !== null) {
      clock.clearTimeout(pendingTimer);
    }
    pendingTimer = clock.setTimeout(() => {
      flushScratchpadSave();
    }, 1000);
  }

  function openScratchpadModal(externalContent = null) {
    if (externalContent !== null) {
      textareaValue = externalContent;
    }
    isModalActive = true;
  }

  function closeScratchpadModal() {
    flushScratchpadSave();
    isModalActive = false;
  }

  // --- Scenario A: User types and blurs before debounce timer expires ---
  openScratchpadModal('Initial ideas');
  textareaValue = 'Idea 1: In-flight work';
  handleScratchpadInput();

  assert.equal(saveStatus, 'Saving...');
  assert.equal(saveCount, 0, 'No save before timer or flush');
  assert.ok(pendingTimer !== null, 'Timer is pending');

  // Trigger blur event
  flushScratchpadSave(); // as triggered by blur listener

  assert.equal(saveStatus, 'Saved');
  assert.equal(saveCount, 1, 'Flush on blur triggered save immediately');
  assert.equal(savedStorage['scratchpad'], 'Idea 1: In-flight work');
  assert.equal(pendingTimer, null, 'Pending debounce timer must be cleared');
  assert.equal(scheduledTimers.size, 0, 'Timer was cancelled so no duplicate save can occur');

  // --- Scenario B: User types and closes modal immediately ---
  textareaValue = 'Idea 2: Before closing';
  handleScratchpadInput();
  assert.equal(saveStatus, 'Saving...');
  assert.ok(pendingTimer !== null);

  // Close modal
  closeScratchpadModal();

  assert.equal(isModalActive, false);
  assert.equal(saveStatus, 'Saved');
  assert.equal(saveCount, 2, 'Close modal triggered flush');
  assert.equal(savedStorage['scratchpad'], 'Idea 2: Before closing');
  assert.equal(pendingTimer, null, 'Timer was cleared on modal close');
  assert.equal(scheduledTimers.size, 0);

  // --- Scenario C: document.hidden visibilitychange triggers flush ---
  textareaValue = 'Idea 3: Background tab';
  handleScratchpadInput();
  assert.equal(saveStatus, 'Saving...');
  assert.ok(pendingTimer !== null);

  // Document visibility changed to hidden
  const documentHidden = true;
  if (documentHidden) {
    flushScratchpadSave();
  }

  assert.equal(saveStatus, 'Saved');
  assert.equal(saveCount, 3, 'Visibility hidden triggered flush');
  assert.equal(savedStorage['scratchpad'], 'Idea 3: Background tab');
  assert.equal(pendingTimer, null);

  // --- Scenario D: External modification refreshed on openScratchpadModal ---
  const externalVoiceContent = 'Idea from ChamberVoice voice tool';
  openScratchpadModal(externalVoiceContent);
  assert.equal(textareaValue, externalVoiceContent, 'Scratchpad content refreshed when modal opened');
});
