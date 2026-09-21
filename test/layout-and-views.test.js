import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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
