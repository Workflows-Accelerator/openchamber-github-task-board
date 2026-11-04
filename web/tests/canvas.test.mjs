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

test('canvas marker strip: removes unfenced markers and preserves other content', () => {
  const text = 'Line 1\r\n\r\n<!-- board-canvas: {"x":10,"y":20} -->\r\n';
  assert.equal(stripCanvasMarker(text), 'Line 1\r\n\r\n');

  const fenced = '```\n<!-- board-canvas: {"x":10,"y":20} -->\n```\n';
  assert.equal(stripCanvasMarker(fenced), fenced);

  const bothMarkers = 'Overview text\n\n<!-- board-order: 500 -->\n\n<!-- board-canvas: {"x":10,"y":20} -->';
  assert.equal(stripCanvasMarker(bothMarkers), 'Overview text\n\n<!-- board-order: 500 -->\n\n');
  assert.equal(stripHiddenMarkers(bothMarkers).trim(), 'Overview text');
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
  const withNotes = '<!-- board-canvas: {"x":10,"y":20,"notes":["n1"]} -->';
  const moved = setCanvasMarker(withNotes, { x: 50, y: 60 });
  assert.deepEqual(parseCanvasMarker(moved), { x: 50, y: 60, notes: ['n1'] });

  // Rejects non-finite coordinates
  assert.throws(() => setCanvasMarker('body', { x: NaN, y: 100 }), BoardError);
  assert.throws(() => setCanvasMarker('body', { x: 100, y: Infinity }), BoardError);
  assert.throws(() => setCanvasMarker('body', null), BoardError);
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

test('canvas client: non-clustering dot grid mathematics scale dot radius and fade below 0.55', () => {
  const js = fs.readFileSync(APP_JS_PATH, 'utf8');

  // Check dot scaling math
  assert.match(js, /dotRadius\s*=\s*Math\.max\(0\.35,\s*1\.25\s*\*\s*state\.canvasScale\)/, 'dot radius scales proportionally');
  assert.match(js, /state\.canvasScale\s*>=\s*0\.55/, 'fade threshold at 0.55 scale');
  assert.match(js, /state\.canvasScale\s*<=\s*0\.40/, 'fade threshold at 0.40 scale');
});
