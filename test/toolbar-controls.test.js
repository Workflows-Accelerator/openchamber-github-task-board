import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(here, '..');
const PANEL_HTML_PATH = path.join(ROOT_DIR, 'panel', 'index.html');
const html = fs.readFileSync(PANEL_HTML_PATH, 'utf8');

// Extract style contents from panel/index.html
const styleMatch = html.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
const css = styleMatch ? styleMatch[1] : '';

test('Defect 1: #selectSort has explicit toolbar select styling tokens and contrast protection', () => {
  // Must have dedicated styling for #selectSort / .toolbar-sort-select
  assert.ok(
    html.includes('class="toolbar-sort-select"') || /#selectSort|\.toolbar-sort-select/.test(css),
    'panel/index.html must reference #selectSort or .toolbar-sort-select in CSS'
  );

  // Background must reuse elevated/surface token rather than unstyled native select
  const hasBg = /(?:#selectSort|\.toolbar-sort-select|\.sort-control\s+select)[^{]*\{[^}]*background:\s*var\(--(?:bg-elev|surf)/.test(css);
  assert.ok(hasBg, '#selectSort must specify background: var(--bg-elev...) or var(--surf...)');

  // Color must explicitly match foreground token
  const hasColor = /(?:#selectSort|\.toolbar-sort-select|\.sort-control\s+select)[^{]*\{[^}]*color:\s*var\(--fg\)/.test(css);
  assert.ok(hasColor, '#selectSort must specify color: var(--fg)');

  // Border and radius matching toolbar control tokens
  const hasBorder = /(?:#selectSort|\.toolbar-sort-select|\.sort-control\s+select)[^{]*\{[^}]*border:\s*1px\s+solid\s+var\(--border\)/.test(css);
  assert.ok(hasBorder, '#selectSort must specify border: 1px solid var(--border)');

  const hasRadius = /(?:#selectSort|\.toolbar-sort-select|\.sort-control\s+select)[^{]*\{[^}]*border-radius:\s*var\(--(?:radius-xs|rad-sm|rad)/.test(css);
  assert.ok(hasRadius, '#selectSort must specify border-radius matching toolbar token');

  // Height: 28px, font-size: 11px, font-weight: 500
  const hasHeight = /(?:#selectSort|\.toolbar-sort-select|\.sort-control\s+select)[^{]*\{[^}]*height:\s*28px/.test(css);
  assert.ok(hasHeight, '#selectSort must specify height: 28px');

  const hasFontSize = /(?:#selectSort|\.toolbar-sort-select|\.sort-control\s+select)[^{]*\{[^}]*font-size:\s*11px/.test(css);
  assert.ok(hasFontSize, '#selectSort must specify font-size: 11px');

  const hasFontWeight = /(?:#selectSort|\.toolbar-sort-select|\.sort-control\s+select)[^{]*\{[^}]*font-weight:\s*500/.test(css);
  assert.ok(hasFontWeight, '#selectSort must specify font-weight: 500');

  // Option dropdown background/color or color-scheme protection against white-on-white
  const hasOptionStyle = /(?:#selectSort|\.toolbar-sort-select|\.sort-control\s+select)\s+option[^{]*\{[^}]*background:/.test(css) ||
    /(?:#selectSort|\.toolbar-sort-select|\.sort-control\s+select)[^{]*\{[^}]*color-scheme:/.test(css);
  assert.ok(hasOptionStyle, '#selectSort must provide option styling or color-scheme protection');

  // Light theme hover contrast protection
  const hasLightHoverProtection = /\[data-oc-theme="light"\][^{]*(?:#selectSort|\.toolbar-sort-select|\.sort-control\s+select)[^{]*:hover[^{]*\{[^}]*border-color:/.test(css);
  assert.ok(hasLightHoverProtection, '#selectSort must provide light-theme hover contrast protection');

  // Focus visible ring
  const hasFocus = /(?:#selectSort|\.toolbar-sort-select|\.sort-control\s+select):focus-visible/.test(css);
  assert.ok(hasFocus, '#selectSort must define focus-visible styling');
});

test('Defect 2: #btnRepoSelect / #txtRepoLabel has left-alignment, no start clipping, and end-only ellipsis', () => {
  // .repo-btn or .repo-select-btn or #btnRepoSelect must specify justify-content: flex-start
  const hasJustifyStart = /(?:\.repo-btn|\.repo-select-btn|#btnRepoSelect)[^{]*\{[^}]*justify-content:\s*flex-start/.test(css);
  assert.ok(hasJustifyStart, 'repo select button must have justify-content: flex-start');

  // Button or text element must specify text-align: left
  const hasAlignLeft = /(?:\.repo-btn|\.repo-select-btn|#btnRepoSelect|\.repo-label|#txtRepoLabel)[^{]*\{[^}]*text-align:\s*left/.test(css);
  assert.ok(hasAlignLeft, 'repo button or label must specify text-align: left');

  // #txtRepoLabel / .repo-label must have min-width: 0 and ellipsis truncation
  const hasMinZero = /(?:\.repo-label|#txtRepoLabel)[^{]*\{[^}]*min-width:\s*0/.test(css);
  assert.ok(hasMinZero, '#txtRepoLabel must specify min-width: 0 to allow flex container shrinking without clipping start');

  const hasEllipsis = /(?:\.repo-label|#txtRepoLabel)[^{]*\{[^}]*text-overflow:\s*ellipsis/.test(css);
  assert.ok(hasEllipsis, '#txtRepoLabel must specify text-overflow: ellipsis');

  // DOM attributes: title tooltip on repo select button
  assert.ok(
    html.includes('id="btnRepoSelect"') && html.includes('title="Select or switch target repository"'),
    '#btnRepoSelect must preserve title tooltip'
  );
  assert.ok(html.includes('id="txtRepoLabel"'), '#txtRepoLabel must exist');
});

test('Defect 3: #btnViewSelect / .toolbar-dropdown-wrap prevents crowding with flex-shrink: 0', () => {
  // #btnViewSelect or .btn-view-select or .toolbar-view-btn must have flex-shrink: 0
  const hasBtnShrinkZero = /(?:#btnViewSelect|\.btn-view-select|\.toolbar-view-btn)[^{]*\{[^}]*flex-shrink:\s*0/.test(css);
  assert.ok(hasBtnShrinkZero, '#btnViewSelect / .btn-view-select must specify flex-shrink: 0');

  // .view-select-wrapper or .toolbar-dropdown-wrap must have flex-shrink: 0
  const hasWrapShrinkZero = /(?:\.view-select-wrapper|\.toolbar-dropdown-wrap)[^{]*\{[^}]*flex-shrink:\s*0/.test(css);
  assert.ok(hasWrapShrinkZero, '.view-select-wrapper must specify flex-shrink: 0');

  // #btnViewSelect must have white-space: nowrap
  const hasNowrap = /(?:#btnViewSelect|\.btn-view-select|\.toolbar-view-btn|\.btn)[^{]*\{[^}]*white-space:\s*nowrap/.test(css);
  assert.ok(hasNowrap, '#btnViewSelect must have white-space: nowrap');

  // Wide screen toolbar integrity: .toolbar-right must prevent wrapping at >= 768px
  const hasWideNowrap = /@media\s*\([^)]*min-width:\s*768px[^)]*\)[^{]*\{[^}]*\.toolbar-right\s*\{[^}]*flex-wrap:\s*nowrap/.test(css);
  assert.ok(hasWideNowrap, '.toolbar-right must specify flex-wrap: nowrap at >= 768px to prevent #btnMoreMenu wrapping');

  // DOM elements and ARIA attributes
  assert.ok(html.includes('id="btnViewSelect"'), '#btnViewSelect must exist');
  assert.ok(html.includes('id="viewSelectPopover"'), '#viewSelectPopover must exist');
  assert.ok(html.includes('aria-haspopup="menu"'), '#btnViewSelect must have aria-haspopup="menu"');
});

test('Preservations: No restored legacy controls and toolbar integrity intact', () => {
  // Exactly 1 #selectSort, 1 #btnRepoSelect, 1 #btnViewSelect, 1 #btnFilterToggle
  const countMatches = (regex) => (html.match(regex) || []).length;
  assert.equal(countMatches(/id="selectSort"/g), 1, 'exactly one #selectSort');
  assert.equal(countMatches(/id="btnRepoSelect"/g), 1, 'exactly one #btnRepoSelect');
  assert.equal(countMatches(/id="btnViewSelect"/g), 1, 'exactly one #btnViewSelect');
  assert.equal(countMatches(/id="btnFilterToggle"/g), 1, 'exactly one #btnFilterToggle');

  // Four sort options preserved
  assert.ok(html.includes('value="priority"'), 'Priority sort option preserved');
  assert.ok(html.includes('value="updated"'), 'Updated sort option preserved');
  assert.ok(html.includes('value="created"'), 'Created sort option preserved');
  assert.ok(html.includes('value="manual"'), 'Manual sort option preserved');

  // No restored legacy view tabs or buttons
  assert.ok(!html.includes('id="btnViewAttention"'), 'No legacy Attention view button');
  assert.ok(!html.includes('id="viewTabs"'), 'No legacy view tabs container');
});
