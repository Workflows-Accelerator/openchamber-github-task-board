import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseFriendlyTitle } from '../panel/core.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const INDEX_HTML = fs.readFileSync(path.join(here, '..', 'panel', 'index.html'), 'utf8');
const MAIN_TS = fs.readFileSync(path.join(here, '..', 'panel', 'main.ts'), 'utf8');

export function getNextLayoutMode(currentLayout) {
  if (currentLayout === 'kanban') return 'graph';
  if (currentLayout === 'graph') return 'list';
  return 'kanban';
}

export function getActiveLayoutMode({ userLayoutPreference = 'auto', showArchivedOnly = false, isWideScreen = false }) {
  if (showArchivedOnly) return 'list';
  if (userLayoutPreference === 'graph') return 'graph';
  if (userLayoutPreference === 'kanban') return 'kanban';
  if (userLayoutPreference === 'list') return 'list';
  return isWideScreen ? 'kanban' : 'list';
}

test('getNextLayoutMode cycles list -> kanban -> graph -> list correctly', () => {
  assert.equal(getNextLayoutMode('list'), 'kanban');
  assert.equal(getNextLayoutMode(null), 'kanban');
  assert.equal(getNextLayoutMode(''), 'kanban');
  assert.equal(getNextLayoutMode('kanban'), 'graph');
  assert.equal(getNextLayoutMode('graph'), 'list');
});

test('getActiveLayoutMode determines current active view accurately', () => {
  assert.equal(getActiveLayoutMode({ userLayoutPreference: 'graph' }), 'graph');
  assert.equal(getActiveLayoutMode({ userLayoutPreference: 'kanban' }), 'kanban');
  assert.equal(getActiveLayoutMode({ userLayoutPreference: 'list' }), 'list');
  assert.equal(getActiveLayoutMode({ userLayoutPreference: 'auto', isWideScreen: true }), 'kanban');
  assert.equal(getActiveLayoutMode({ userLayoutPreference: 'auto', isWideScreen: false }), 'list');
  assert.equal(getActiveLayoutMode({ userLayoutPreference: 'graph', showArchivedOnly: true }), 'list');
});

test('panel/index.html drawer has zero dark blur and supports split push & full page', () => {
  // Drawer scrim must NOT apply blur or dark backdrop
  assert.ok(INDEX_HTML.includes('drawer-scrim'), 'drawer-scrim must exist');
  assert.ok(INDEX_HTML.includes('backdrop-filter: none !important'), 'drawer scrim must have blur disabled');
  assert.ok(INDEX_HTML.includes('background: transparent !important'), 'drawer scrim must have background transparent');

  // Drawer must support narrow screen full page mode
  assert.ok(INDEX_HTML.includes('@media (max-width: 767px)'), 'must define narrow screen drawer layout');
  assert.ok(INDEX_HTML.includes('max-width: 100vw'), 'must expand to full page width on narrow screen');

  // Drawer must support wide screen split push layout
  assert.ok(INDEX_HTML.includes('@media (min-width: 768px)'), 'must define wide screen drawer layout');
  assert.ok(INDEX_HTML.includes('flex-shrink: 0'), 'drawer must flex-shrink: 0 in split mode');

  // view-container must flex horizontally to push views side-by-side
  assert.ok(INDEX_HTML.includes('flex-direction: row'), 'view-container must have flex-direction row');

  // Drawer must feature smooth side-slide transition in sidebar mode
  assert.ok(INDEX_HTML.includes('transform: translateX(100%)'), 'drawer must be positioned off-screen to the right when inactive');
  assert.ok(INDEX_HTML.includes('transform: translateX(0)'), 'drawer must slide to translateX(0) when active');

  // Drawer must feature smooth width push transition and inner slide in wide mode
  assert.ok(INDEX_HTML.includes('transition: width 0.28s'), 'drawer must smoothly animate width push');
  assert.ok(INDEX_HTML.includes('transform: translateX(36px)'), 'drawer inner content must slide in from right');
});

test('panel/index.html modal and popover feature smooth open animations', () => {
  assert.ok(INDEX_HTML.includes('modalFadeIn'), 'modals must have fade-in backdrop animation');
  assert.ok(INDEX_HTML.includes('modalPopIn'), 'modals must have scale/slide pop-in animation');
  assert.ok(INDEX_HTML.includes('popoverSlideIn'), 'popovers must have slide-in animation');
});

test('panel/index.html scratchpad modal has increased height and flex textarea', () => {
  // Scratchpad modal must specify expanded height (82vh / max-height)
  assert.ok(INDEX_HTML.includes('height: 82vh'), 'scratchpad modal must have increased 82vh height');
  assert.ok(INDEX_HTML.includes('max-height: 720px'), 'scratchpad modal must clamp to max-height');

  // Scratchpad textarea must have flex: 1 and expanded min-height
  assert.ok(INDEX_HTML.includes('id="scratchpadTextarea"'), 'scratchpadTextarea must exist');
  assert.ok(INDEX_HTML.includes('min-height: 320px'), 'scratchpadTextarea must have min-height: 320px');
});

test('panel/index.html repo dropdown and button have expanded width', () => {
  // .repo-btn max-width increased from 150px to 260px (and up to 340px on wide screen)
  assert.ok(INDEX_HTML.includes('max-width: 260px'), 'repo-btn must allow up to 260px width');
  assert.ok(INDEX_HTML.includes('max-width: 340px'), 'repo-btn must allow up to 340px on wide screen');

  // #repoPopover must have 380px width
  assert.ok(INDEX_HTML.includes('#repoPopover'), 'repoPopover must have dedicated style');
  assert.ok(INDEX_HTML.includes('width: 380px'), 'repoPopover must have width: 380px');
});

test('panel/index.html has sidebar view cycle button for compact screens', () => {
  assert.ok(INDEX_HTML.includes('btn-cycle-views'), 'btn-cycle-views CSS class must exist');
  assert.ok(INDEX_HTML.includes('id="btnLayoutToggle"'), 'btnLayoutToggle button must exist in toolbar');
  assert.ok(INDEX_HTML.includes('display: none !important'), 'btn-cycle-views must hide on wide screen');
});

export function handleEscapeKey({
  activeModal = null,
  activeIssue = null,
  closeScratchpadModal = () => {},
  closePreflightModal = () => {},
  closeNewIssueModal = () => {},
  closeDrawer = () => {},
  flushScratchpadSave = () => {},
} = {}) {
  if (activeModal) {
    const modalId = typeof activeModal === 'string' ? activeModal : (activeModal.id || '');
    if (modalId === 'scratchpadModalBackdrop') {
      flushScratchpadSave();
      closeScratchpadModal();
    } else if (modalId === 'preflightModalBackdrop') {
      closePreflightModal();
    } else if (modalId === 'newIssueModalBackdrop') {
      closeNewIssueModal();
    } else if (typeof activeModal.classList?.remove === 'function') {
      activeModal.classList.remove('active');
    }
    return 'modal';
  }
  if (activeIssue) {
    closeDrawer();
    return 'drawer';
  }
  return 'none';
}

test('panel/index.html chkGraphShowDone is unchecked by default', () => {
  const match = INDEX_HTML.match(/<input[^>]*id=["']chkGraphShowDone["'][^>]*>/);
  assert.ok(match, 'chkGraphShowDone input must exist in panel/index.html');
  assert.equal(match[0].includes('checked'), false, 'chkGraphShowDone must not have checked attribute');
});

test('panel/main.ts initializes graphShowDone to false', () => {
  assert.match(
    MAIN_TS,
    /let\s+graphShowDone\s*:\s*boolean\s*=\s*false;/,
    'panel/main.ts initializes graphShowDone to false'
  );
});

test('Escape closes active modals before drawer', () => {
  // Static checks on main.ts keydown handler implementation
  const keydownListenerMatch = MAIN_TS.match(/window\.addEventListener\(['"]keydown['"],\s*\(e\)\s*=>\s*\{([\s\S]*?)\}\);/);
  assert.ok(keydownListenerMatch, 'main.ts must register keydown listener on window');
  const listenerBody = keydownListenerMatch[1];
  assert.ok(listenerBody.includes("e.key === 'Escape'"), 'listener must check for Escape key');
  assert.ok(listenerBody.includes('.modal-backdrop.active'), 'listener must query active modal backdrop');
  assert.ok(listenerBody.includes('closeNewIssueModal'), 'listener must close new issue modal');
  assert.ok(listenerBody.includes('closePreflightModal'), 'listener must close preflight modal');
  assert.ok(listenerBody.includes('closeScratchpadModal'), 'listener must close scratchpad modal');
  assert.ok(listenerBody.includes('flushScratchpadSave'), 'listener must flush scratchpad save before closing');

  // Precedence behavior checks: active modal takes precedence over drawer
  let closedModal = null;
  let closedDrawer = false;
  let flushedScratchpad = false;

  const mockCloseScratchpad = () => { closedModal = 'scratchpad'; };
  const mockClosePreflight = () => { closedModal = 'preflight'; };
  const mockCloseNewIssue = () => { closedModal = 'newIssue'; };
  const mockFlushScratchpad = () => { flushedScratchpad = true; };
  const mockCloseDrawer = () => { closedDrawer = true; };

  // Case 1: Scratchpad modal open with active issue - modal closes and flushes, drawer does NOT close
  closedModal = null;
  closedDrawer = false;
  flushedScratchpad = false;
  let result = handleEscapeKey({
    activeModal: { id: 'scratchpadModalBackdrop' },
    activeIssue: { id: 1 },
    closeScratchpadModal: mockCloseScratchpad,
    closePreflightModal: mockClosePreflight,
    closeNewIssueModal: mockCloseNewIssue,
    closeDrawer: mockCloseDrawer,
    flushScratchpadSave: mockFlushScratchpad,
  });
  assert.equal(result, 'modal');
  assert.equal(closedModal, 'scratchpad');
  assert.equal(flushedScratchpad, true);
  assert.equal(closedDrawer, false, 'drawer must not close when scratchpad modal is active');

  // Case 2: Preflight modal open with active issue - modal closes, drawer does NOT close
  closedModal = null;
  closedDrawer = false;
  flushedScratchpad = false;
  result = handleEscapeKey({
    activeModal: { id: 'preflightModalBackdrop' },
    activeIssue: { id: 1 },
    closeScratchpadModal: mockCloseScratchpad,
    closePreflightModal: mockClosePreflight,
    closeNewIssueModal: mockCloseNewIssue,
    closeDrawer: mockCloseDrawer,
    flushScratchpadSave: mockFlushScratchpad,
  });
  assert.equal(result, 'modal');
  assert.equal(closedModal, 'preflight');
  assert.equal(closedDrawer, false, 'drawer must not close when preflight modal is active');

  // Case 3: New issue modal open with active issue - modal closes, drawer does NOT close
  closedModal = null;
  closedDrawer = false;
  flushedScratchpad = false;
  result = handleEscapeKey({
    activeModal: { id: 'newIssueModalBackdrop' },
    activeIssue: { id: 1 },
    closeScratchpadModal: mockCloseScratchpad,
    closePreflightModal: mockClosePreflight,
    closeNewIssueModal: mockCloseNewIssue,
    closeDrawer: mockCloseDrawer,
    flushScratchpadSave: mockFlushScratchpad,
  });
  assert.equal(result, 'modal');
  assert.equal(closedModal, 'newIssue');
  assert.equal(closedDrawer, false, 'drawer must not close when new issue modal is active');

  // Case 4: No modal open, active issue set - drawer closes
  closedModal = null;
  closedDrawer = false;
  flushedScratchpad = false;
  result = handleEscapeKey({
    activeModal: null,
    activeIssue: { id: 1 },
    closeScratchpadModal: mockCloseScratchpad,
    closePreflightModal: mockClosePreflight,
    closeNewIssueModal: mockCloseNewIssue,
    closeDrawer: mockCloseDrawer,
    flushScratchpadSave: mockFlushScratchpad,
  });
  assert.equal(result, 'drawer');
  assert.equal(closedModal, null);
  assert.equal(closedDrawer, true, 'drawer must close when no modal is open');

  // Case 5: No modal open, no active issue - neither closes
  closedModal = null;
  closedDrawer = false;
  flushedScratchpad = false;
  result = handleEscapeKey({
    activeModal: null,
    activeIssue: null,
    closeScratchpadModal: mockCloseScratchpad,
    closePreflightModal: mockClosePreflight,
    closeNewIssueModal: mockCloseNewIssue,
    closeDrawer: mockCloseDrawer,
    flushScratchpadSave: mockFlushScratchpad,
  });
  assert.equal(result, 'none');
  assert.equal(closedModal, null);
  assert.equal(closedDrawer, false);
});

test('parseFriendlyTitle extracts friendly human title from markdown headers and bold markers', () => {
  // ### Friendly Title:
  const resH3 = parseFriendlyTitle(
    '### Friendly Title: Quick Search Shortcut\n\n### Overview\nDetails here...',
    'feat(search): add quick search shortcut'
  );
  assert.deepEqual(resH3, {
    title: 'Quick Search Shortcut',
    subtitle: 'feat(search): add quick search shortcut',
  });

  // ## Friendly Title:
  const resH2 = parseFriendlyTitle(
    '## Friendly Title: Clean Navigation Menu\n\nMore info...',
    'feat(nav): clean navigation menu'
  );
  assert.deepEqual(resH2, {
    title: 'Clean Navigation Menu',
    subtitle: 'feat(nav): clean navigation menu',
  });

  // **Friendly Title:**
  const resBold = parseFriendlyTitle(
    '**Friendly Title:** Fix Table Overflow\n\nBug details...',
    'fix(ui): prevent table horizontal overflow'
  );
  assert.deepEqual(resBold, {
    title: 'Fix Table Overflow',
    subtitle: 'fix(ui): prevent table horizontal overflow',
  });

  // Title on next line after heading
  const resNextLine = parseFriendlyTitle(
    '### Friendly Title:\nExport to CSV and PDF\n\n### Overview',
    'feat(export): add export options'
  );
  assert.deepEqual(resNextLine, {
    title: 'Export to CSV and PDF',
    subtitle: 'feat(export): add export options',
  });

  // When defaultTitle is not provided or empty
  const resNoDefault = parseFriendlyTitle('### Friendly Title: Simple Title');
  assert.deepEqual(resNoDefault, {
    title: 'Simple Title',
    subtitle: null,
  });
});

test('parseFriendlyTitle handles missing or malformed markdown gracefully', () => {
  // Missing friendly title
  const resMissing = parseFriendlyTitle(
    '### Overview\nJust a normal description',
    'feat(core): some feature'
  );
  assert.deepEqual(resMissing, {
    title: 'feat(core): some feature',
    subtitle: null,
  });

  // Empty / null / undefined body
  assert.deepEqual(parseFriendlyTitle('', 'feat(core): fallback'), {
    title: 'feat(core): fallback',
    subtitle: null,
  });
  assert.deepEqual(parseFriendlyTitle(null, 'feat(core): fallback'), {
    title: 'feat(core): fallback',
    subtitle: null,
  });
  assert.deepEqual(parseFriendlyTitle(undefined, 'feat(core): fallback'), {
    title: 'feat(core): fallback',
    subtitle: null,
  });
  assert.deepEqual(parseFriendlyTitle(null, undefined), {
    title: '',
    subtitle: null,
  });
});

test('renderIssueCard in main.ts renders friendly title and conditional card-subtitle-tech', () => {
  // Check main.ts defines or uses parseFriendlyTitle
  assert.ok(
    MAIN_TS.includes('parseFriendlyTitle(issue.body, issue.title)'),
    'main.ts must call parseFriendlyTitle(issue.body, issue.title)'
  );
  // Check main.ts renders card-title with titles.title
  assert.ok(
    MAIN_TS.includes('<div class="card-title">${escapeHtml(titles.title)}</div>'),
    'main.ts must render card-title with titles.title'
  );
  // Check main.ts renders card-subtitle-tech with specified styling
  assert.ok(
    MAIN_TS.includes('card-subtitle-tech'),
    'main.ts must render card-subtitle-tech'
  );
  assert.ok(
    MAIN_TS.includes('font-size: 10.5px; color: var(--fg-muted); font-family: var(--font-mono); margin-top: 2px;'),
    'main.ts must include exact required subtitle styling'
  );
  assert.ok(
    MAIN_TS.includes('${escapeHtml(titles.subtitle)}'),
    'main.ts must escape subtitle'
  );
});

test('card title and subtitle logic generates correct HTML snippets', () => {
  function renderCardTitles(issue) {
    const titles = parseFriendlyTitle(issue.body, issue.title);
    const subtitleHtml = titles.subtitle
      ? `<div class="card-subtitle-tech" style="font-size: 10.5px; color: var(--fg-muted); font-family: var(--font-mono); margin-top: 2px;">${titles.subtitle}</div>`
      : '';
    return {
      titleHtml: `<div class="card-title">${titles.title}</div>`,
      subtitleHtml,
    };
  }

  // Case 1: Issue with friendly title in body
  const issueWithFriendly = {
    title: 'feat(board): friendly human titles on cards',
    body: '### Friendly Title: Friendly Titles on Board Cards\n\n### Overview\nMore info...',
  };
  const rendered1 = renderCardTitles(issueWithFriendly);
  assert.equal(rendered1.titleHtml, '<div class="card-title">Friendly Titles on Board Cards</div>');
  assert.equal(
    rendered1.subtitleHtml,
    '<div class="card-subtitle-tech" style="font-size: 10.5px; color: var(--fg-muted); font-family: var(--font-mono); margin-top: 2px;">feat(board): friendly human titles on cards</div>'
  );

  // Case 2: Issue without friendly title in body
  const issueWithoutFriendly = {
    title: 'fix(core): resolve null pointer',
    body: '### Overview\nJust fixing a bug.',
  };
  const rendered2 = renderCardTitles(issueWithoutFriendly);
  assert.equal(rendered2.titleHtml, '<div class="card-title">fix(core): resolve null pointer</div>');
  assert.equal(rendered2.subtitleHtml, '', 'No subtitle rendered when friendly title is missing');
});

test('updatePreflightBrief in main.ts enriches brief with skill transclusions for bug, enhancement, documentation', () => {
  assert.ok(
    MAIN_TS.includes('[@.agents/skills/build/refactoring/surgical-patch/SKILL.md]'),
    'main.ts must include surgical-patch skill for bug'
  );
  assert.ok(
    MAIN_TS.includes('[@.agents/skills/build/domain/debugging-and-error-recovery/SKILL.md]'),
    'main.ts must include debugging-and-error-recovery skill for bug'
  );
  assert.ok(
    MAIN_TS.includes('[@.agents/skills/build/methodology/test-driven-development/SKILL.md]'),
    'main.ts must include test-driven-development skill for enhancement'
  );
  assert.ok(
    MAIN_TS.includes('[@.agents/skills/build/methodology/lean-build/SKILL.md]'),
    'main.ts must include lean-build skill for enhancement'
  );
  assert.ok(
    MAIN_TS.includes('[@.agents/skills/ship/docs/documentation-and-adrs/SKILL.md]'),
    'main.ts must include documentation-and-adrs skill for documentation'
  );
});

test('hostile edge cases: angle brackets, quotes, placeholder ignoring, bold variations, and next-line guards', () => {
  // Bold with colon outside asterisks
  const resBoldOutside = parseFriendlyTitle('**Friendly Title**: Clean Settings UI', 'feat: settings');
  assert.equal(resBoldOutside.title, 'Clean Settings UI');
  assert.equal(resBoldOutside.subtitle, 'feat: settings');

  // Angle brackets stripping
  const resAngle = parseFriendlyTitle('### Friendly Title: <Keyboard Navigation Shortcuts>', 'feat: shortcuts');
  assert.equal(resAngle.title, 'Keyboard Navigation Shortcuts');

  // Quotes stripping
  const resQuotes = parseFriendlyTitle('### Friendly Title: "Live Real-Time Sync"', 'feat: sync');
  assert.equal(resQuotes.title, 'Live Real-Time Sync');

  // Literal unreplaced template placeholder must be ignored
  const resPlaceholder1 = parseFriendlyTitle('### Friendly Title: <3-6 words plain English title>', 'fix(ui): actual title');
  assert.equal(resPlaceholder1.title, 'fix(ui): actual title');
  assert.equal(resPlaceholder1.subtitle, null);

  const resPlaceholder2 = parseFriendlyTitle('### Friendly Title: 3-6 words plain English title', 'fix(ui): actual title');
  assert.equal(resPlaceholder2.title, 'fix(ui): actual title');
  assert.equal(resPlaceholder2.subtitle, null);

  // Next-line with bullet/checklist items must NOT be treated as title
  const resBulletNext = parseFriendlyTitle('### Friendly Title:\n- [ ] First implementation task\n- [ ] Second', 'feat: task');
  assert.equal(resBulletNext.title, 'feat: task');
  assert.equal(resBulletNext.subtitle, null);

  // Next-line with another section header must NOT be treated as title
  const resHeaderNext = parseFriendlyTitle('### Friendly Title:\n### Overview\nDescription here', 'feat: header');
  assert.equal(resHeaderNext.title, 'feat: header');
  assert.equal(resHeaderNext.subtitle, null);

  // Next-line with bold section header must NOT be treated as title
  const resBoldHeaderNext = parseFriendlyTitle('### Friendly Title:\n**Overview:**\nDescription here', 'feat: bold header');
  assert.equal(resBoldHeaderNext.title, 'feat: bold header');
  assert.equal(resBoldHeaderNext.subtitle, null);
});

test('card-subtitle-tech styling supports narrow-screen word wrapping and XSS escaping', () => {
  // Check index.html has word-break and overflow-wrap for card-subtitle-tech
  const updatedHtml = fs.readFileSync(path.join(here, '..', 'panel', 'index.html'), 'utf8');
  assert.ok(updatedHtml.includes('.card-subtitle-tech'), 'index.html must have .card-subtitle-tech class');
  assert.ok(updatedHtml.includes('word-break: break-word'), 'card-subtitle-tech must have word-break');
  assert.ok(updatedHtml.includes('overflow-wrap: anywhere'), 'card-subtitle-tech must have overflow-wrap');

  // Verify XSS escaping behavior
  const maliciousIssue = {
    title: '<script>alert("xss")</script>',
    body: '### Friendly Title: <img src=x onerror=alert(1)>',
  };
  const titles = parseFriendlyTitle(maliciousIssue.body, maliciousIssue.title);
  assert.ok(!titles.title.includes('<script>'));
  // When escaping HTML:
  const escapedTitle = titles.title.replace(/</g, '&lt;').replace(/>/g, '&gt;');
  assert.ok(!escapedTitle.includes('<'));
});
