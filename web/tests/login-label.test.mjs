import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startFakeGitHub, makeIssue } from './fake-github.mjs';
import { startBoard, HttpSession, BOARD_PASSWORD } from './helpers.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const INDEX_HTML_PATH = path.join(ROOT, 'public/index.html');
const THEME_CSS_PATH = path.join(ROOT, 'public/theme.css');

test('issue #49: login form semantic markup and autocomplete contracts are intact', () => {
  const html = fs.readFileSync(INDEX_HTML_PATH, 'utf8');

  // Verify username hidden field attributes
  assert.match(
    html,
    /<input[^>]*id="username"[^>]*>/,
    '#username input element must exist in index.html',
  );
  const usernameMatch = html.match(/<input[^>]*id="username"[^>]*>/)[0];
  assert.match(usernameMatch, /autocomplete="username"/, 'username input must declare autocomplete="username"');
  assert.match(usernameMatch, /readonly/, 'username input must be readonly');
  assert.match(usernameMatch, /tabindex="-1"/, 'username input must have tabindex="-1"');
  assert.match(usernameMatch, /value="board"/, 'username input must have default value="board"');
  assert.match(usernameMatch, /class="[^"]*sr-only[^"]*"/, 'username input must have sr-only class');

  // Verify password field attributes
  assert.match(
    html,
    /<input[^>]*id="password"[^>]*>/,
    '#password input element must exist in index.html',
  );
  const passwordMatch = html.match(/<input[^>]*id="password"[^>]*>/)[0];
  assert.match(passwordMatch, /type="password"/, 'password input must have type="password"');
  assert.match(passwordMatch, /autocomplete="current-password"/, 'password input must declare autocomplete="current-password"');
  assert.match(passwordMatch, /required/, 'password input must be required');

  // Verify labels
  assert.match(
    html,
    /<label[^>]*for="username"[^>]*class="[^"]*sr-only[^"]*"[^>]*>\s*Username\s*<\/label>/,
    'accessible label for username must exist with sr-only class',
  );
  assert.match(
    html,
    /<label[^>]*for="password"[^>]*>\s*Password\s*<\/label>/,
    'visible label for password must exist',
  );
});

test('issue #49: minimal off-layout CSS contract in theme.css', () => {
  const css = fs.readFileSync(THEME_CSS_PATH, 'utf8');

  // .sr-only definition must maintain standard clipping and layout exclusion
  assert.match(css, /\.sr-only\s*\{[^}]*position:\s*absolute/);
  assert.match(css, /\.sr-only\s*\{[^}]*overflow:\s*hidden/);
  assert.match(css, /\.sr-only\s*\{[^}]*clip:\s*rect\(0,\s*0,\s*0,\s*0\)/);

  // Must NOT include redundant clip-path or opacity: 0 on .sr-only
  const srOnlyBlock = css.match(/\.sr-only\s*\{([^}]+)\}/)[1];
  assert.ok(!srOnlyBlock.includes('clip-path'), '.sr-only must not contain global clip-path');
  assert.ok(!srOnlyBlock.includes('opacity'), '.sr-only must not contain opacity');

  // input.sr-only scoped rule must position off-layout without redundant opacity
  assert.match(
    css,
    /input\.sr-only\s*\{[^}]*left:\s*-9999px/,
    'input.sr-only must specify left: -9999px to move rendered text primitives off-layout',
  );
  const inputSrOnlyMatch = css.match(/input\.sr-only\s*\{([^}]+)\}/);
  assert.ok(inputSrOnlyMatch, 'input.sr-only rule must exist');
  assert.ok(
    !inputSrOnlyMatch[1].includes('opacity'),
    'input.sr-only must not include opacity: 0 to protect browser autofill heuristics',
  );
});

test('issue #49: other .sr-only accessibility elements remain intact', () => {
  const html = fs.readFileSync(INDEX_HTML_PATH, 'utf8');

  // Announcer
  assert.match(
    html,
    /<div[^>]*id="announcer"[^>]*class="[^"]*sr-only[^"]*"[^>]*role="status"[^>]*aria-live="polite"[^>]*>/,
    '#announcer must exist with sr-only class, role="status" and aria-live="polite"',
  );

  // Screen reader labels for drawer and forms
  const requiredSrOnlyLabels = [
    'quick-add-input',
    'quick-add-description',
    'quick-add-project',
    'overview-text',
  ];

  for (const labelFor of requiredSrOnlyLabels) {
    const hasLabel =
      new RegExp(`<label[^>]*for="${labelFor}"[^>]*class="[^"]*sr-only[^"]*"`, 'i').test(html) ||
      new RegExp(`<label[^>]*class="[^"]*sr-only[^"]*"[^>]*for="${labelFor}"`, 'i').test(html);
    assert.ok(hasLabel, `label with for="${labelFor}" must have sr-only class`);
  }
});

test('issue #49: synthetic sign-in succeeds and returns HttpOnly Secure SameSite session cookie', async () => {
  const fake = await startFakeGitHub({
    repositories: [
      {
        repo: 'Workflows-Accelerator/openchamber-github-task-board',
        issues: [makeIssue({ number: 1, title: 'Sample issue' })],
      },
    ],
  });
  let board;
  try {
    board = await startBoard(fake);
    const session = new HttpSession(board.url);

    // Initial unauthenticated request fails
    const initial = await session.request('/api/repos');
    assert.equal(initial.status, 401);

    // Login with password only (username is preserved in DOM for autofill, not sent in payload)
    const login = await session.login(BOARD_PASSWORD);
    assert.equal(login.status, 200);
    assert.ok(login.json.csrfToken, 'login response must include csrfToken');

    const setCookie = login.headers.get('set-cookie');
    assert.ok(setCookie, 'login response must return Set-Cookie header');
    assert.match(setCookie, /board_session=/);
    assert.match(setCookie, /HttpOnly/i);
    assert.match(setCookie, /Secure/i);
    assert.match(setCookie, /SameSite=Strict/i);

    // Authenticated request now succeeds
    const repos = await session.request('/api/repos');
    assert.equal(repos.status, 200);
  } finally {
    if (board) await board.app.close();
    if (fake) await fake.close();
  }
});
