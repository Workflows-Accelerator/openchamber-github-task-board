import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const INDEX_HTML = fs.readFileSync(path.join(here, '..', 'panel', 'index.html'), 'utf8');

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
