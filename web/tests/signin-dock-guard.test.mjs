import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(HERE, '..');
const THEME_CSS_PATH = path.join(ROOT_DIR, 'public/theme.css');
const INDEX_HTML_PATH = path.join(ROOT_DIR, 'public/index.html');

test('V3-5: theme.css contains pure-CSS signed-out dock and header suppression rules', () => {
  const css = fs.readFileSync(THEME_CSS_PATH, 'utf8');

  // Must contain body:has(#login-view:not([hidden])) #compact-nav-dock { display: none; }
  assert.match(
    css,
    /body:has\(#login-view:not\(\[hidden\]\)\)\s+#compact-nav-dock\s*\{[^}]*display:\s*none/s,
    'theme.css must suppress #compact-nav-dock when #login-view is not hidden'
  );

  // Must be inside or alongside the narrow <=768px media query
  const narrowMediaMatch = css.match(/@media\s*\(max-width:\s*768px\)\s*\{([\s\S]*?)(?=@media|$)/g);
  assert.ok(narrowMediaMatch && narrowMediaMatch.length > 0, 'theme.css must have @media (max-width: 768px)');
  const hasNarrowDockGuard = narrowMediaMatch.some((block) =>
    /body:has\(#login-view:not\(\[hidden\]\)\)\s+#compact-nav-dock\s*\{[^}]*display:\s*none/s.test(block)
  );
  assert.ok(hasNarrowDockGuard, 'dock guard rule must exist inside a <=768px media block');

  // Must also suppress .compact-header and #app-sidebar when signed out
  assert.match(
    css,
    /body:has\(#login-view:not\(\[hidden\]\)\)\s+\.compact-header\s*\{[^}]*display:\s*none/s,
    'theme.css must suppress .compact-header when signed out'
  );
  assert.match(
    css,
    /body:has\(#login-view:not\(\[hidden\]\)\)\s+#app-sidebar\s*\{[^}]*display:\s*none/s,
    'theme.css must suppress #app-sidebar when signed out'
  );
});

test('V3-5: index.html places #compact-nav-dock outside <main> and #login-view inside <main>', () => {
  const html = fs.readFileSync(INDEX_HTML_PATH, 'utf8');

  const mainCloseIndex = html.indexOf('</main>');
  const dockIndex = html.indexOf('id="compact-nav-dock"');
  const loginViewIndex = html.indexOf('id="login-view"');
  const mainOpenIndex = html.indexOf('<main');

  assert.ok(mainOpenIndex !== -1, '<main> element must exist in index.html');
  assert.ok(mainCloseIndex !== -1, '</main> element must exist in index.html');
  assert.ok(dockIndex !== -1, '#compact-nav-dock element must exist in index.html');
  assert.ok(loginViewIndex !== -1, '#login-view element must exist in index.html');

  assert.ok(
    loginViewIndex > mainOpenIndex && loginViewIndex < mainCloseIndex,
    '#login-view must live inside <main>'
  );

  assert.ok(
    dockIndex > mainCloseIndex,
    '#compact-nav-dock must live outside and after <main>'
  );
});

test('V3-5: sign-in card layout polish — centered, responsive width, and >=44px hit boxes', () => {
  const css = fs.readFileSync(THEME_CSS_PATH, 'utf8');

  // Centering & width
  assert.match(
    css,
    /#login-view\s*\{[^}]*margin:\s*auto/s,
    '#login-view must use margin: auto for vertical and horizontal centering'
  );
  assert.match(
    css,
    /#login-view\s*\{[^}]*width:\s*min\(420px,\s*calc\(100vw\s*-\s*32px\)\)/s,
    '#login-view must define responsive width min(420px, calc(100vw - 32px))'
  );

  // Form input and button >= 44x44px
  assert.match(
    css,
    /\.login-form\s+input\[type="password"\]\s*\{[^}]*min-height:\s*44px;[^}]*min-width:\s*44px/s,
    'password input must enforce min-height: 44px and min-width: 44px'
  );
  assert.match(
    css,
    /\.login-form\s+\.button\s*\{[^}]*min-height:\s*44px;[^}]*min-width:\s*44px/s,
    'sign-in button must enforce min-height: 44px and min-width: 44px'
  );
});
