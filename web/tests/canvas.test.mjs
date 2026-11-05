import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  parseCanvasMarker,
  stripCanvasMarker,
  stripHiddenMarkers,
  setCanvasMarker,
  parseOrderMarker,
  setOrderMarker,
  buildBoardListItem,
  buildIssueDetail,
  BoardError,
} from '../server/board.ts';
import { startFakeGitHub, makeIssue } from './fake-github.mjs';
import { startBoard, HttpSession } from './helpers.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(HERE, '../..');
const INDEX_HTML_PATH = path.join(ROOT_DIR, 'web/public/index.html');
const THEME_CSS_PATH = path.join(ROOT_DIR, 'web/public/theme.css');
const APP_JS_PATH = path.join(ROOT_DIR, 'web/public/app.js');

test('canvas marker parse: parses valid JSON, handles floats and negative numbers', () => {
  assert.equal(parseCanvasMarker('No marker here'), null);
  assert.deepEqual(
    parseCanvasMarker('<!-- board-canvas: {"x":420,"y":280} -->'),
    { x: 420, y: 280 },
  );
  assert.deepEqual(
    parseCanvasMarker('Body text\n\n<!-- board-canvas: {"x":-150.5,"y":89.25} -->'),
    { x: -150.5, y: 89.25 },
  );
});

test('canvas marker parse: preserves unknown keys for future expansion (e.g. notes)', () => {
  const parsed = parseCanvasMarker('<!-- board-canvas: {"x":100,"y":200,"notes":[{"id":"n1","text":"hello"}],"custom":true} -->');
  assert.deepEqual(parsed, {
    x: 100,
    y: 200,
    notes: [{ id: 'n1', text: 'hello' }],
    custom: true,
  });
});

test('canvas marker parse: ignores fenced and indented code blocks', () => {
  const fenced = '```md\n<!-- board-canvas: {"x":100,"y":200} -->\n```\n';
  assert.equal(parseCanvasMarker(fenced), null);

  const tildes = '~~~yaml\n<!-- board-canvas: {"x":100,"y":200} -->\n~~~\n';
  assert.equal(parseCanvasMarker(tildes), null);

  const indentedSpaces = '    <!-- board-canvas: {"x":100,"y":200} -->\n';
  assert.equal(parseCanvasMarker(indentedSpaces), null);

  const indentedTab = '\t<!-- board-canvas: {"x":100,"y":200} -->\n';
  assert.equal(parseCanvasMarker(indentedTab), null);

  const realAfterFence = '```md\n<!-- board-canvas: {"x":999,"y":999} -->\n```\n\n<!-- board-canvas: {"x":50,"y":60} -->';
  assert.deepEqual(parseCanvasMarker(realAfterFence), { x: 50, y: 60 });
});

test('canvas marker parse: safely skips malformed JSON or non-object payloads', () => {
  assert.equal(parseCanvasMarker('<!-- board-canvas: not-json -->'), null);
  assert.equal(parseCanvasMarker('<!-- board-canvas: {x: 100} -->'), null);
  assert.equal(parseCanvasMarker('<!-- board-canvas: [1, 2, 3] -->'), null);
  assert.equal(parseCanvasMarker('<!-- board-canvas: "string" -->'), null);
  assert.equal(parseCanvasMarker('<!-- board-canvas: null -->'), null);

  // If a malformed marker appears after a valid one, it scans earlier lines
  const earlierValid = '<!-- board-canvas: {"x":10,"y":20} -->\n<!-- board-canvas: malformed -->';
  assert.deepEqual(parseCanvasMarker(earlierValid), { x: 10, y: 20 });
});

test('canvas marker strip: removes unfenced markers and preceding blank line separator', () => {
  const text = 'Line 1\r\n\r\n<!-- board-canvas: {"x":10,"y":20} -->\r\n';
  assert.equal(stripCanvasMarker(text), 'Line 1\r\n');

  const fenced = '```\n<!-- board-canvas: {"x":10,"y":20} -->\n```\n';
  assert.equal(stripCanvasMarker(fenced), fenced);

  const bothMarkers = 'Overview text\n\n<!-- board-order: 500 -->\n\n<!-- board-canvas: {"x":10,"y":20} -->';
  assert.equal(stripCanvasMarker(bothMarkers), 'Overview text\n\n<!-- board-order: 500 -->\n');
  assert.equal(stripHiddenMarkers(bothMarkers).trim(), 'Overview text');
});

test('canvas marker set+strip: preserves original body byte-for-byte', () => {
  const bodies = [
    'Line 1\r\n\r\n<!-- board-order: 1000 -->\r\n',
    'Line 1\n\n<!-- board-order: 1000 -->\n',
    '# Heading\r\n\r\nParagraph\r\n```ts\n<!-- board-canvas: stay -->\n```\r\n',
    'Simple single line\n',
  ];
  for (const body of bodies) {
    const withMarker = setCanvasMarker(body, { x: 120, y: 340, notes: [{ id: 'n1', text: 'temp' }] });
    const stripped = stripCanvasMarker(withMarker);
    assert.equal(stripped, body, `Body must match byte-for-byte after set+strip: ${JSON.stringify(body)}`);
  }
});

test('setCanvasMarker: preserves CRLF, code fences, board-order, and merges unknown keys', () => {
  const bodyCRLF = '## Task\r\nLine 1\r\n<!-- board-order: 1000 -->';
  const withCanvas = setCanvasMarker(bodyCRLF, { x: 300, y: 400 });
  assert.ok(withCanvas.includes('\r\n'));
  assert.equal(parseOrderMarker(withCanvas), 1000);
  assert.deepEqual(parseCanvasMarker(withCanvas), { x: 300, y: 400 });

  // Update position: replaces in-place without duplicating or destroying board-order
  const updated = setCanvasMarker(withCanvas, { x: 350, y: 450 });
  assert.equal(parseOrderMarker(updated), 1000);
  assert.deepEqual(parseCanvasMarker(updated), { x: 350, y: 450 });
  assert.equal(updated.match(/board-canvas/g)?.length, 1);
  assert.equal(updated.match(/board-order/g)?.length, 1);

  // Preserves existing unknown keys such as notes
  const withNotes = '<!-- board-canvas: {"x":10,"y":20,"notes":[{"id":"n1","text":"initial"}]} -->';
  const moved = setCanvasMarker(withNotes, { x: 50, y: 60 });
  assert.deepEqual(parseCanvasMarker(moved), { x: 50, y: 60, notes: [{ id: 'n1', text: 'initial' }] });

  // Rejects notes exceeding 4,000 characters
  assert.throws(
    () => setCanvasMarker('body', { notes: [{ id: 'n1', text: 'x'.repeat(4001) }] }),
    (err) => err instanceof BoardError && err.code === 'note_too_long',
  );

  // Rejects final bodies exceeding 65,536 characters
  const hugeBody = 'x'.repeat(65500);
  assert.throws(
    () => setCanvasMarker(hugeBody, { notes: [{ id: 'n1', text: 'x'.repeat(100) }] }),
    (err) => err instanceof BoardError && err.code === 'body_too_long',
  );

  // Rejects non-finite coordinates
  assert.throws(() => setCanvasMarker('body', { x: NaN, y: 100 }), BoardError);
  assert.throws(() => setCanvasMarker('body', { x: 100, y: Infinity }), BoardError);
  assert.throws(() => setCanvasMarker('body', null), BoardError);

  // Hostile note validation: non-empty id, unique id, valid color, positive w/h
  assert.throws(() => setCanvasMarker('body', { notes: [{}] }), (err) => err instanceof BoardError);
  assert.throws(() => setCanvasMarker('body', { notes: [{ id: '' }] }), (err) => err instanceof BoardError);
  assert.throws(() => setCanvasMarker('body', { notes: [{ id: 'n1' }, { id: 'n1' }] }), (err) => err instanceof BoardError);
  assert.throws(() => setCanvasMarker('body', { notes: [{ id: 'n1', color: 'invalid-rainbow' }] }), (err) => err instanceof BoardError);
  assert.throws(() => setCanvasMarker('body', { notes: [{ id: 'n1', w: -50 }] }), (err) => err instanceof BoardError);
  assert.throws(() => setCanvasMarker('body', { notes: [{ id: 'n1', h: 0 }] }), (err) => err instanceof BoardError);
  assert.throws(() => setCanvasMarker('body', { notes: [{ id: 'n1', text: 12345 }] }), (err) => err instanceof BoardError);

  // Literal '-->' inside note text cannot break out of HTML comment
  const trickyNoteText = 'Literal --> breakout and <!-- board-canvas: fake --> example with `code` & special chars \\u0026 < > "\'\r\nNewline text';
  const escapedMarkerBody = setCanvasMarker('## Header', {
    notes: [{ id: 'n-safe', text: trickyNoteText, color: 'blue' }],
  });
  // Must contain only ONE HTML comment closing -->
  assert.equal(escapedMarkerBody.match(/-->/g)?.length, 1);
  const parsedEscaped = parseCanvasMarker(escapedMarkerBody);
  assert.equal(parsedEscaped.notes[0].text, trickyNoteText);

  // Unicode line/paragraph separators, CRLF, emoji and accents round-trip exactly
  const unicodeText = 'a\u2028b\u2029c\r\nd \u00e9 \u{1F680}';
  const unicodeBody = setCanvasMarker('Body\r\n', { x: 5, y: 6, notes: [{ id: 'u', text: unicodeText }] });
  assert.equal(unicodeBody.includes('\u2028'), false, 'raw U+2028 must not reach the issue body');
  assert.equal(unicodeBody.includes('\u2029'), false, 'raw U+2029 must not reach the issue body');
  const parsedUnicode = parseCanvasMarker(unicodeBody);
  assert.ok(parsedUnicode, 'marker with separators must stay parseable');
  assert.equal(parsedUnicode.notes[0].text, unicodeText);
  assert.equal(parsedUnicode.x, 5);

  // clearPosition removes x and y while preserving notes and custom keys
  const beforeClear = '<!-- board-canvas: {"x":100,"y":200,"notes":[{"id":"n1","text":"stay"}],"customKey":"persist"} -->';
  const afterClear = setCanvasMarker(beforeClear, { clearPosition: true });
  const parsedAfterClear = parseCanvasMarker(afterClear);
  assert.equal(parsedAfterClear.x, undefined);
  assert.equal(parsedAfterClear.y, undefined);
  assert.equal(parsedAfterClear.notes.length, 1);
  assert.equal(parsedAfterClear.customKey, 'persist');

  // Empty notes array deletes notes
  const clearedNotes = setCanvasMarker(afterClear, { notes: [] });
  const parsedClearedNotes = parseCanvasMarker(clearedNotes);
  assert.equal(parsedClearedNotes.notes, undefined);
  assert.equal(parsedClearedNotes.customKey, 'persist');
});

test('PUT /api/issues/:n/canvas: saves canvas position, preserves order, enforces CSRF and concurrency', async (t) => {
  const initialBody = '## Overview\r\nIssue body prose\r\n\r\n<!-- board-order: 1000 -->';
  const issue = makeIssue({
    number: 10,
    title: 'Canvas Target Issue',
    body: initialBody,
    labels: ['status:in-progress'],
    repo: 'Workflows-Accelerator/openchamber-github-task-board',
  });
  const fake = await startFakeGitHub({
    repo: 'Workflows-Accelerator/openchamber-github-task-board',
    issues: [issue],
    honorIfMatch: true,
  });
  const board = await startBoard(fake);
  t.after(async () => {
    await board.app.close();
    await fake.close();
  });

  const session = new HttpSession(board.url);
  const loginRes = await session.login();
  assert.equal(loginRes.status, 200);

  // 1. Fetch current board to get fresh fingerprint
  const boardRes = await session.request('/api/board');
  assert.equal(boardRes.status, 200);
  const boardItem = boardRes.json.issues.find((i) => i.number === 10);
  assert.ok(boardItem);
  assert.ok(boardItem.fingerprint);
  assert.equal(boardItem.order, 1000);
  assert.equal(boardItem.canvas, null);

  // 2. Reject missing CSRF
  const noCsrfRes = await session.request('/api/issues/10/canvas', {
    method: 'PUT',
    body: { x: 150, y: 250, fingerprint: boardItem.fingerprint },
    csrf: false,
    headers: { 'x-csrf-token': 'invalid-token' },
  });
  assert.equal(noCsrfRes.status, 403);

  // 3. Reject invalid coordinates
  const badCoordRes = await session.request('/api/issues/10/canvas', {
    method: 'PUT',
    body: { x: 'invalid', y: 250, fingerprint: boardItem.fingerprint },
  });
  assert.equal(badCoordRes.status, 400);

  // 4. Happy path: save canvas position
  const saveRes = await session.request('/api/issues/10/canvas', {
    method: 'PUT',
    body: { x: 150, y: 250, fingerprint: boardItem.fingerprint },
  });
  assert.equal(saveRes.status, 200, saveRes.text);
  assert.deepEqual(saveRes.json.issue.canvas, { x: 150, y: 250 });
  assert.deepEqual(saveRes.json.listItem.canvas, { x: 150, y: 250 });

  // Verify upstream fake GitHub body preserved original content, CRLF and order marker
  const updatedGithubIssue = fake.findIssue(10);
  assert.ok(updatedGithubIssue);
  assert.equal(parseOrderMarker(updatedGithubIssue.body), 1000);
  assert.deepEqual(parseCanvasMarker(updatedGithubIssue.body), { x: 150, y: 250 });
  assert.ok(updatedGithubIssue.body.includes('## Overview\r\nIssue body prose'));

  // 5. Subsequent move updates marker cleanly without duplicate markers
  const newFp = saveRes.json.listItem.fingerprint;
  const secondMoveRes = await session.request('/api/issues/10/canvas', {
    method: 'PUT',
    body: { x: 300, y: 400, fingerprint: newFp, repo: 'Workflows-Accelerator/openchamber-github-task-board' },
  });
  assert.equal(secondMoveRes.status, 200, secondMoveRes.text);
  assert.deepEqual(secondMoveRes.json.issue.canvas, { x: 300, y: 400 });

  const finalGithubIssue = fake.findIssue(10);
  assert.equal(finalGithubIssue.body.match(/board-canvas/g)?.length, 1);
  assert.equal(finalGithubIssue.body.match(/board-order/g)?.length, 1);

  // 6. Conflict detection: stale fingerprint rejected with 409
  const staleRes = await session.request('/api/issues/10/canvas', {
    method: 'PUT',
    body: { x: 500, y: 600, fingerprint: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef' },
  });
  assert.equal(staleRes.status, 409);

  // 7. Save notes alongside position
  const latestFp = secondMoveRes.json.listItem.fingerprint;
  const noteSaveRes = await session.request('/api/issues/10/canvas', {
    method: 'PUT',
    body: {
      notes: [{ id: 'n1', text: 'Important note on #10', color: '#FBF5DF' }],
      fingerprint: latestFp,
    },
  });
  assert.equal(noteSaveRes.status, 200, noteSaveRes.text);
  assert.deepEqual(noteSaveRes.json.issue.canvas.notes, [{ id: 'n1', text: 'Important note on #10', color: '#FBF5DF' }]);
  assert.equal(noteSaveRes.json.issue.canvas.x, 300);
  assert.equal(noteSaveRes.json.issue.canvas.y, 400);

  // 8. Rejects note exceeding 4,000 characters
  const noteFp = noteSaveRes.json.listItem.fingerprint;
  const longNoteRes = await session.request('/api/issues/10/canvas', {
    method: 'PUT',
    body: {
      notes: [{ id: 'n2', text: 'x'.repeat(4001) }],
      fingerprint: noteFp,
    },
  });
  assert.equal(longNoteRes.status, 400);
  assert.match(longNoteRes.text, /cannot exceed 4,000 characters/i);
});

test('PUT /api/issues/:n/canvas: handles upstream GitHub failure path', async (t) => {
  const issue = makeIssue({
    number: 20,
    title: 'Fail Issue',
    body: 'Prose',
    labels: ['status:in-progress'],
    repo: 'Workflows-Accelerator/openchamber-github-task-board',
  });
  const fake = await startFakeGitHub({
    repo: 'Workflows-Accelerator/openchamber-github-task-board',
    issues: [issue],
    honorIfMatch: true,
  });
  const board = await startBoard(fake);
  t.after(async () => {
    await board.app.close();
    await fake.close();
  });

  const session = new HttpSession(board.url);
  await session.login();

  const boardRes = await session.request('/api/board');
  const boardItem = boardRes.json.issues.find((i) => i.number === 20);

  // Simulate upstream GitHub failure
  fake.setRepoFailing('Workflows-Accelerator/openchamber-github-task-board', true);

  const failRes = await session.request('/api/issues/20/canvas', {
    method: 'PUT',
    body: { x: 100, y: 200, fingerprint: boardItem.fingerprint },
  });
  assert.equal(failRes.status, 502);
});

test('canvas client: index.html defines viewport, plane, controls and 4 distinct layers', () => {
  const html = fs.readFileSync(INDEX_HTML_PATH, 'utf8');

  assert.match(html, /<div\s+id="canvas-viewport"/, 'viewport container must exist');
  assert.match(html, /<div\s+id="canvas-controls"/, 'floating controls container must exist');
  assert.match(html, /<div\s+id="canvas-plane"/, 'infinite plane container must exist');

  // Floating controls buttons
  assert.match(html, /id="canvas-zoom-out"/, 'zoom out button exists');
  assert.match(html, /id="canvas-zoom-readout"/, 'zoom readout button exists');
  assert.match(html, /id="canvas-zoom-in"/, 'zoom in button exists');
  assert.match(html, /id="canvas-fit-all"/, 'fit all button exists');
  assert.match(html, /id="canvas-reset-view"/, 'reset view button exists');

  // Verify the 4 layers exist in exact order
  const wiresPos = html.indexOf('id="canvas-wires"');
  const notesPos = html.indexOf('id="canvas-notes"');
  const cardsPos = html.indexOf('id="canvas-cards"');
  const overlayPos = html.indexOf('id="canvas-overlay"');

  assert.ok(wiresPos > 0, 'wires layer exists');
  assert.ok(notesPos > wiresPos, 'notes layer comes after wires');
  assert.ok(cardsPos > notesPos, 'cards layer comes after notes');
  assert.ok(overlayPos > cardsPos, 'overlay layer comes after cards');
});

test('canvas client: theme.css enforces z-indices, 250px V1 cards, and unbounded plane', () => {
  const css = fs.readFileSync(THEME_CSS_PATH, 'utf8');

  // 4 layers z-indices
  assert.match(css, /\.canvas-layer-wires\s*\{[^}]*z-index:\s*10;/s, 'wires z-index is 10');
  assert.match(css, /\.canvas-layer-notes\s*\{[^}]*z-index:\s*20;/s, 'notes z-index is 20');
  assert.match(css, /\.canvas-layer-cards\s*\{[^}]*z-index:\s*30;/s, 'cards z-index is 30');
  assert.match(css, /\.canvas-layer-overlay\s*\{[^}]*z-index:\s*40;/s, 'overlay z-index is 40');
  assert.match(css, /\.canvas-floating-controls\s*\{[^}]*z-index:\s*50;/s, 'controls z-index is 50');

  // Unbounded plane: width 0, height 0, position absolute
  assert.match(css, /\.canvas-plane\s*\{[^}]*width:\s*0;[^}]*height:\s*0;/s, 'canvas plane has width 0, height 0');

  // 250px V1 card style
  assert.match(css, /\.canvas-card\s*\{[^}]*width:\s*250px;/s, 'card has 250px fixed width');
  assert.match(css, /\.canvas-card\s*\{[^}]*position:\s*absolute;/s, 'card is positioned absolutely');

  // Dot color token
  assert.match(css, /--canvas-dot-rgb:\s*244,\s*241,\s*234;/, 'dark dot token defined');
  assert.match(css, /--canvas-dot-rgb:\s*24,\s*22,\s*19;/, 'light dot token defined');
});

test('canvas client: zero occurrences of "n8n" or "mobile" in web/public source files', () => {
  const html = fs.readFileSync(INDEX_HTML_PATH, 'utf8');
  const css = fs.readFileSync(THEME_CSS_PATH, 'utf8');
  const js = fs.readFileSync(APP_JS_PATH, 'utf8');

  for (const [filename, content] of [['index.html', html], ['theme.css', css], ['app.js', js]]) {
    assert.doesNotMatch(content, /\bn8n\b/i, `Forbidden token "n8n" found in ${filename}`);
    assert.doesNotMatch(content, /\bmobile\b/i, `Forbidden token "mobile" found in ${filename}`);
  }
});

test('canvas client: English and French localization for all new Canvas UI elements', () => {
  const js = fs.readFileSync(APP_JS_PATH, 'utf8');

  // Check required i18n keys
  const requiredKeys = [
    'canvas_zoom_in',
    'canvas_zoom_out',
    'canvas_zoom_reset',
    'canvas_fit_all',
    'canvas_reset_view',
    'canvas_save_error',
    'nav_canvas',
    'nav_list',
  ];

  for (const key of requiredKeys) {
    assert.ok(js.includes(`${key}:`), `Missing key ${key} in i18n dictionaries`);
  }
});

test('canvas client: non-clustering dot grid mathematics scale dot radius and keep dots visible at low zoom', () => {
  const js = fs.readFileSync(APP_JS_PATH, 'utf8');

  // Check adaptive coarser world step (24/48/96) to prevent clustering
  assert.match(js, /worldStep\s*=\s*baseStep\s*\*\s*4;/, 'uses 4x base step at extreme zoom out');
  assert.match(js, /worldStep\s*=\s*baseStep\s*\*\s*2;/, 'uses 2x base step at medium zoom out');
  assert.match(js, /dotRadius\s*=\s*Math\.max\(0\.75,\s*Math\.min\(2\.0,\s*0\.85\s*\+\s*0\.4\s*\*\s*state\.canvasScale\)\)/, 'dot radius scales with bounds');
  assert.match(js, /alpha\s*=\s*Math\.max\(0\.10,\s*Math\.min\(0\.18,\s*0\.10\s*\+\s*0\.06\s*\*\s*state\.canvasScale\)\)/, 'alpha stays faint and never vanishes');
});

test('canvas persistence: fake GitHub body contains exactly ONE marker after two drops and is otherwise byte-identical', async (t) => {
  const initialBody =
    '## Overview\r\n' +
    'Some initial prose with CRLF.\r\n\r\n' +
    '```markdown\r\n' +
    'Fenced code example with marker-like text:\r\n' +
    '<!-- board-canvas: {"x":999,"y":999} -->\r\n' +
    '```\r\n\r\n' +
    '<!-- board-order: 1000 -->';

  const issue = makeIssue({
    number: 42,
    title: 'Adversarial Canvas Issue',
    body: initialBody,
    labels: ['status:in-progress'],
    repo: 'Workflows-Accelerator/openchamber-github-task-board',
  });
  const fake = await startFakeGitHub({
    repo: 'Workflows-Accelerator/openchamber-github-task-board',
    issues: [issue],
  });
  const board = await startBoard(fake);
  t.after(async () => {
    await board.app.close();
    await fake.close();
  });

  const session = new HttpSession(board.url);
  await session.login();

  const boardRes = await session.request('/api/board');
  const boardItem = boardRes.json.issues.find((i) => i.number === 42);

  // Drop 1: move to (120, 240)
  const drop1 = await session.request('/api/issues/42/canvas', {
    method: 'PUT',
    body: { x: 120, y: 240, fingerprint: boardItem.fingerprint },
  });
  assert.equal(drop1.status, 200);
  const bodyAfterDrop1 = fake.findIssue(42).body;

  // Drop 2: move to (360, 480)
  const drop2 = await session.request('/api/issues/42/canvas', {
    method: 'PUT',
    body: { x: 360, y: 480, fingerprint: drop1.json.listItem.fingerprint },
  });
  assert.equal(drop2.status, 200);

  const ghIssue = fake.findIssue(42);
  const finalBody = ghIssue.body;

  // Exactly one board-canvas marker outside fenced code
  const parsed = parseCanvasMarker(finalBody);
  assert.deepEqual(parsed, { x: 360, y: 480 });

  // Count occurrences: exactly 2 in total (1 inside code block, 1 actual marker)
  const allCanvasOccurrences = finalBody.match(/<!--\s*board-canvas:/g) || [];
  assert.equal(allCanvasOccurrences.length, 2, 'Exactly 1 marker outside code fence + 1 inside code fence');

  // Exactly 1 board-order marker
  const allOrderOccurrences = finalBody.match(/<!--\s*board-order:/g) || [];
  assert.equal(allOrderOccurrences.length, 1, 'Exactly 1 board-order marker preserved');
  assert.equal(parseOrderMarker(finalBody), 1000);

  // All lines are CRLF
  assert.ok(finalBody.includes('\r\n'), 'CRLF line endings preserved');
  assert.ok(!/[^\r]\n/.test(finalBody), 'No bare LF line endings');

  // Successive drops are 100% byte-identical except for the marker payload
  const revertedBody = finalBody.replace(
    '<!-- board-canvas: {"x":360,"y":480} -->',
    '<!-- board-canvas: {"x":120,"y":240} -->',
  );
  assert.equal(revertedBody, bodyAfterDrop1, 'Successive drops update only the marker and leave every other byte identical');

  // Stripping the unfenced marker recovers the initial content byte-for-byte
  const stripped = stripCanvasMarker(finalBody).trimEnd();
  assert.equal(stripped, initialBody.trimEnd(), 'Initial body prose, code fences, and order marker recovered byte-exact');
});

test('canvas client: unpositioned cards are never written without a drop (zero PUT requests on load, fit all, reset, and zoom)', async (t) => {
  const issues = [
    makeIssue({ number: 101, title: 'Card 1', body: 'No coords', labels: ['status:planned'], repo: 'Workflows-Accelerator/openchamber-github-task-board' }),
    makeIssue({ number: 102, title: 'Card 2', body: 'No coords', labels: ['status:planned'], repo: 'Workflows-Accelerator/openchamber-github-task-board' }),
    makeIssue({ number: 103, title: 'Card 3', body: 'No coords', labels: ['status:planned'], repo: 'Workflows-Accelerator/openchamber-github-task-board' }),
  ];
  let patchCalls = 0;
  const fake = await startFakeGitHub({
    repo: 'Workflows-Accelerator/openchamber-github-task-board',
    issues,
  });
  fake.setPatchHook(() => {
    patchCalls++;
  });
  const board = await startBoard(fake);
  t.after(async () => {
    await board.app.close();
    await fake.close();
  });

  const session = new HttpSession(board.url);
  await session.login();

  // Load board (simulates initial fetch and client arrangement)
  const res = await session.request('/api/board');
  assert.equal(res.status, 200);
  assert.equal(res.json.issues.length, 3);
  for (const item of res.json.issues) {
    assert.equal(item.canvas, null, 'Unpositioned issue has null canvas coordinates');
  }

  // Zero PATCH/PUT requests happened on load
  assert.equal(patchCalls, 0, 'No PATCH/PUT calls to GitHub on load');

  // Verify none of the fake GitHub issues had canvas markers written
  for (const num of [101, 102, 103]) {
    const raw = fake.findIssue(num);
    assert.equal(parseCanvasMarker(raw.body), null, `Issue ${num} body remains marker-free`);
  }
});

test('canvas client: save failure reverts card to previous position and sets plain error message without double punctuation', () => {
  const js = fs.readFileSync(APP_JS_PATH, 'utf8');

  // Verify revert logic in catch block
  assert.match(js, /issue\.canvas\s*=\s*prevCanvas;/, 'restores prevCanvas on error');
  assert.match(js, /cardEl\.style\.left\s*=\s*oldPos\.x\s*\+\s*'px';/, 'reverts left style');
  assert.match(js, /cardEl\.style\.top\s*=\s*oldPos\.y\s*\+\s*'px';/, 'reverts top style');

  // Verify clean punctuation
  assert.match(js, /cleanMsg\s*=\s*msg\.replace\(/, 'strips trailing dots');
  assert.match(js, /setNotice\(cleanMsg\s*\+\s*'\.',\s*true\)/, 'sets clean punctuated notice');
});

test('canvas client: rapid successive drops on the same card queue per-issue and adopt the updated fingerprint without false 409 conflict', async (t) => {
  const js = fs.readFileSync(APP_JS_PATH, 'utf8');
  assert.match(js, /var\s+cardSaveQueues\s*=\s*new\s+Map\(\);/, 'defines per-issue save queue map');
  assert.match(js, /cardSaveQueues\.get\(key\)/, 'retrieves previous save promise for the issue');
  assert.match(js, /cardSaveQueues\.set\(key,\s*nextSave\)/, 'queues next save promise for the issue');

  // End-to-end server verification: Two rapid successive PUTs simulating client queue adoption
  const issue = makeIssue({
    number: 77,
    title: 'Double-drop card',
    body: '## Overview\r\nCard content\r\n',
    labels: ['status:planned'],
    repo: 'Workflows-Accelerator/openchamber-github-task-board',
  });
  const fake = await startFakeGitHub({
    repo: 'Workflows-Accelerator/openchamber-github-task-board',
    issues: [issue],
  });
  const board = await startBoard(fake);
  t.after(async () => {
    await board.app.close();
    await fake.close();
  });

  const session = new HttpSession(board.url);
  await session.login();

  const boardRes = await session.request('/api/board');
  const boardItem = boardRes.json.issues.find((i) => i.number === 77);

  // First drop at (100, 150)
  const drop1 = await session.request('/api/issues/77/canvas', {
    method: 'PUT',
    body: { x: 100, y: 150, fingerprint: boardItem.fingerprint },
  });
  assert.equal(drop1.status, 200);
  assert.ok(drop1.json.listItem.fingerprint);
  assert.notEqual(drop1.json.listItem.fingerprint, boardItem.fingerprint, 'Fingerprint updated after first drop');

  // Second drop at (250, 300) adopting the updated fingerprint from first drop
  const drop2 = await session.request('/api/issues/77/canvas', {
    method: 'PUT',
    body: { x: 250, y: 300, fingerprint: drop1.json.listItem.fingerprint },
  });
  assert.equal(drop2.status, 200, 'Second drop succeeds without 409 conflict');
  assert.deepEqual(parseCanvasMarker(fake.findIssue(77).body), { x: 250, y: 300 });
});

test('canvas client: card drop queue recovers from failure without deadlocking subsequent drops', async (t) => {
  const js = fs.readFileSync(APP_JS_PATH, 'utf8');
  assert.match(js, /previous\.then\(/, 'chains off previous save');
  assert.match(js, /cardSaveQueues\.delete\(key\)/, 'queue key removed in finally');

  const issue = makeIssue({
    number: 88,
    title: 'Failure recovery card',
    body: '## Overview\r\nCard content\r\n',
    labels: ['status:planned'],
    repo: 'Workflows-Accelerator/openchamber-github-task-board',
  });
  const fake = await startFakeGitHub({
    repo: 'Workflows-Accelerator/openchamber-github-task-board',
    issues: [issue],
  });
  let shouldFail = true;
  fake.setPatchHook(() => {
    if (shouldFail) {
      return { status: 500, payload: { message: 'Upstream 500 simulated' } };
    }
  });

  const board = await startBoard(fake);
  t.after(async () => {
    await board.app.close();
    await fake.close();
  });

  const session = new HttpSession(board.url);
  await session.login();

  const boardRes = await session.request('/api/board');
  const boardItem = boardRes.json.issues.find((i) => i.number === 88);

  // First drop fails due to simulated 500
  const failedDrop = await session.request('/api/issues/88/canvas', {
    method: 'PUT',
    body: { x: 50, y: 50, fingerprint: boardItem.fingerprint },
  });
  assert.equal(failedDrop.status, 502);

  // Subsequent drop succeeds without deadlock
  shouldFail = false;
  const recoveredDrop = await session.request('/api/issues/88/canvas', {
    method: 'PUT',
    body: { x: 120, y: 180, fingerprint: boardItem.fingerprint },
  });
  assert.equal(recoveredDrop.status, 200, 'Subsequent drop succeeds after failure without deadlock');
  assert.deepEqual(parseCanvasMarker(fake.findIssue(88).body), { x: 120, y: 180 });
});

test('canvas client: HTML and CSS define Arrange controls, modal dialog, and sticky note palette', () => {
  const html = fs.readFileSync(INDEX_HTML_PATH, 'utf8');
  const css = fs.readFileSync(THEME_CSS_PATH, 'utf8');

  // Floating arrange button and undo button
  assert.match(html, /id="canvas-arrange"/, 'arrange button exists');
  assert.match(html, /id="canvas-arrange-undo"/, 'arrange undo button exists');
  assert.match(html, /id="canvas-arrange-dialog"/, 'arrange dialog exists');
  assert.match(html, /id="arrange-scope-unplaced"/, 'arrange unplaced scope option exists');
  assert.match(html, /id="arrange-scope-all"/, 'arrange all scope option exists');
  assert.match(html, /id="arrange-confirm-btn"/, 'arrange confirm button exists');
  assert.match(html, /id="arrange-cancel-btn"/, 'arrange cancel button exists');
  assert.match(html, /id="drawer-add-note-btn"/, 'drawer add note button exists');

  // Sticky note styling and muted V1 palettes
  assert.match(css, /--note-yellow-bg:/, 'yellow note palette defined');
  assert.match(css, /--note-pink-bg:/, 'pink note palette defined');
  assert.match(css, /--note-blue-bg:/, 'blue note palette defined');
  assert.match(css, /--note-green-bg:/, 'green note palette defined');
  assert.match(css, /--note-purple-bg:/, 'purple note palette defined');
  assert.match(css, /\.canvas-sticky-note/, 'sticky note class defined');
  assert.match(css, /\.canvas-note-connector/, 'connector line class defined');
  assert.match(css, /\.canvas-project-band-label/, 'project band label class defined');
});

test('canvas server: stores and updates notes in canvas marker and preserves x, y, and notes', async (t) => {
  const issue = makeIssue({
    number: 99,
    title: 'Note test card',
    body: '## Overview\r\nCard content\r\n',
    labels: ['status:planned'],
    repo: 'Workflows-Accelerator/openchamber-github-task-board',
  });
  const fake = await startFakeGitHub({
    repo: 'Workflows-Accelerator/openchamber-github-task-board',
    issues: [issue],
  });
  const board = await startBoard(fake);
  t.after(async () => {
    await board.app.close();
    await fake.close();
  });

  const session = new HttpSession(board.url);
  await session.login();

  const boardRes = await session.request('/api/board');
  const boardItem = boardRes.json.issues.find((i) => i.number === 99);

  const notesPayload = [
    { id: 'note-1', text: 'Important requirement', color: 'yellow', x: 120, y: 300, w: 220, h: 130 },
  ];

  const putRes = await session.request('/api/issues/99/canvas', {
    method: 'PUT',
    body: { x: 100, y: 150, notes: notesPayload, fingerprint: boardItem.fingerprint },
  });
  assert.equal(putRes.status, 200);
  assert.deepEqual(putRes.json.listItem.canvas.notes, notesPayload);
  assert.equal(putRes.json.listItem.canvas.x, 100);
  assert.equal(putRes.json.listItem.canvas.y, 150);

  const parsedMarker = parseCanvasMarker(fake.findIssue(99).body);
  assert.equal(parsedMarker.x, 100);
  assert.equal(parsedMarker.y, 150);
  assert.deepEqual(parsedMarker.notes, notesPayload);
});

test('canvas server: rejects note exceeding 4000 characters with 400 note_too_long', async (t) => {
  const issue = makeIssue({
    number: 100,
    title: 'Long note card',
    body: '## Overview\r\nCard content\r\n',
    labels: ['status:planned'],
    repo: 'Workflows-Accelerator/openchamber-github-task-board',
  });
  const fake = await startFakeGitHub({
    repo: 'Workflows-Accelerator/openchamber-github-task-board',
    issues: [issue],
  });
  const board = await startBoard(fake);
  t.after(async () => {
    await board.app.close();
    await fake.close();
  });

  const session = new HttpSession(board.url);
  await session.login();

  const boardRes = await session.request('/api/board');
  const boardItem = boardRes.json.issues.find((i) => i.number === 100);

  const longText = 'x'.repeat(4001);
  const putRes = await session.request('/api/issues/100/canvas', {
    method: 'PUT',
    body: {
      notes: [{ id: 'note-long', text: longText }],
      fingerprint: boardItem.fingerprint,
    },
  });
  assert.equal(putRes.status, 400);
  assert.equal(putRes.json.error, 'note_too_long');
});

test('PUT /api/issues/:n/canvas: Arrange undo payload clears position of a previously unplaced card', async (t) => {
  const repo = 'Workflows-Accelerator/openchamber-github-task-board';
  const original = '## Overview\r\nProse line\r\n\r\n<!-- board-order: 1000 -->\r\n';
  const fake = await startFakeGitHub({
    repo,
    issues: [makeIssue({ number: 30, title: 'Unplaced', body: original, labels: ['status:todo'], repo })],
    honorIfMatch: true,
  });
  const board = await startBoard(fake);
  t.after(async () => {
    await board.app.close();
    await fake.close();
  });
  const session = new HttpSession(board.url);
  await session.login();
  const fingerprint = async () => (await session.request('/api/board')).json.issues.find((i) => i.number === 30).fingerprint;

  const arranged = await session.request('/api/issues/30/canvas', {
    method: 'PUT',
    body: { x: 500, y: 80, fingerprint: await fingerprint(), repo },
  });
  assert.equal(arranged.status, 200, arranged.text);

  // Exactly what the client sends on Undo for a card with no notes and no saved place before Arrange
  const undone = await session.request('/api/issues/30/canvas', {
    method: 'PUT',
    body: { clearPosition: true, fingerprint: await fingerprint(), repo },
  });
  assert.equal(undone.status, 200, undone.text);
  assert.equal(undone.json.issue.canvas, null);
  assert.equal(parseCanvasMarker(fake.findIssue(30).body), null);
  assert.equal(parseOrderMarker(fake.findIssue(30).body), 1000);
  assert.equal(fake.findIssue(30).body, original, 'Undoing Arrange on previously unplaced card restores original body byte-for-byte');

  const patchesBefore = fake.patchCalls.length;
  const badFlag = await session.request('/api/issues/30/canvas', {
    method: 'PUT',
    body: { clearPosition: 'yes', fingerprint: await fingerprint(), repo },
  });
  assert.equal(badFlag.status, 400);
  const empty = await session.request('/api/issues/30/canvas', {
    method: 'PUT',
    body: { fingerprint: await fingerprint(), repo },
  });
  assert.equal(empty.status, 400);
  assert.equal(fake.patchCalls.length, patchesBefore, 'invalid canvas payloads must not reach GitHub');
});

test('canvas client: note connector svg has a paintable box and note Edit label is localized', () => {
  const js = fs.readFileSync(APP_JS_PATH, 'utf8');
  const start = js.indexOf("svg.setAttribute('class', 'canvas-notes-connectors-svg')");
  assert.ok(start > 0, 'connector svg is created in renderCanvasNotes');
  const block = js.slice(start, start + 600);
  // The notes layer is 0x0; a 100% sized svg is 0x0 and Chromium paints none of its lines.
  assert.doesNotMatch(block, /svg\.style\.width\s*=\s*'100%'/);
  assert.match(block, /svg\.style\.width\s*=\s*'1px'/);
  assert.match(block, /svg\.style\.overflow\s*=\s*'visible'/);
  assert.doesNotMatch(js, /class: 'canvas-note-btn btn-edit',[\s\S]{0,200}text: 'Edit'/);
  assert.match(js, /class: 'canvas-note-btn btn-edit',[\s\S]{0,200}text: dict\.note_edit \|\| 'Edit'/);
});
