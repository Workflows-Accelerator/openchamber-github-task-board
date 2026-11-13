// V4-3 hostile review: real Chromium attacks on presentation honesty and image
// safety. Synthetic fake GitHub only; no external network.
//
// Run from the V4-3 directory:
//   source ../V4-2/scripts/browser-env.sh && node scripts/attack/browser.mjs

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { startFakeGitHub, makeIssue } from '../../../../../../../web/tests/fake-github.mjs';
import { startBoard, BOARD_PASSWORD } from '../../../../../../../web/tests/helpers.mjs';

let pkg;
try { pkg = await import('/workspace/personal/lucas/charme-social/node_modules/playwright/index.js'); } catch { pkg = await import('playwright'); }
const { chromium } = pkg.default || pkg;

const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SHOTS = path.join(OUT, 'screenshots', 'attack');
fs.mkdirSync(SHOTS, { recursive: true });

const QUESTION_TEXT = 'Which spacing should the list use?';
const QUESTION_BODY = [
  '## Overview', '', 'Pick a row density.', '',
  '### Open Questions:', `- [ ] ${QUESTION_TEXT}`,
  '  - Compact :: Dense rows :: Best for scanning long queues.',
  '  - Comfortable :: Roomier rows :: Easier on a phone.', '',
  '### Human Review:', '- Artifact: question',
].join('\n');

const IMAGE_OK = [
  '## Overview', '', 'Review.', '',
  '### Human Review:', '- Artifact: image',
  '- URL: https://example.com/ok.png', '- Instruction: Compare the empty state with the approved mockup.',
].join('\n');
const IMAGE_404 = IMAGE_OK.replace('https://example.com/ok.png', 'https://example.com/missing.png');
const IMAGE_NOT_IMAGE = IMAGE_OK.replace('https://example.com/ok.png', 'https://example.com/page.html');
const IMAGE_HTTP = IMAGE_OK.replace('https://example.com/ok.png', 'http://example.com/plain.png');

const fake = await startFakeGitHub({
  issues: [
    makeIssue({ number: 1, title: 'Image ok', body: IMAGE_OK, labels: ['status:needs-human'] }),
    makeIssue({ number: 2, title: 'Image 404', body: IMAGE_404, labels: ['status:needs-human'] }),
    makeIssue({ number: 3, title: 'Image not an image', body: IMAGE_NOT_IMAGE, labels: ['status:needs-human'] }),
    makeIssue({ number: 4, title: 'Image http', body: IMAGE_HTTP, labels: ['status:needs-human'] }),
    makeIssue({ number: 5, title: 'Question settled', body: QUESTION_BODY, labels: ['status:needs-human'] }),
    makeIssue({ number: 6, title: 'External settled question', body: QUESTION_BODY.replace('- [ ]', '- [x]'), labels: ['status:needs-human'] }),
    makeIssue({ number: 7, title: 'Legacy waiting without gate', body: '## Overview\n\nNothing to click.\n', labels: ['status:needs-human'] }),
  ],
});
const board = await startBoard(fake);

function makePng(width, height) {
  const raw = Buffer.alloc((width * 3 + 1) * height);
  let o = 0;
  for (let y = 0; y < height; y += 1) {
    raw[o] = 0; o += 1;
    for (let x = 0; x < width; x += 1) { raw[o] = 40; o += 1; raw[o] = 120; o += 1; raw[o] = 200; o += 1; }
  }
  const table = [];
  for (let n = 0; n < 256; n += 1) { let c = n; for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; table[n] = c >>> 0; }
  const crc = (buf) => { let c = 0xffffffff; for (const byte of buf) c = table[(c ^ byte) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => { const length = Buffer.alloc(4); length.writeUInt32BE(data.length); const body = Buffer.concat([Buffer.from(type, 'ascii'), data]); const sum = Buffer.alloc(4); sum.writeUInt32BE(crc(body)); return Buffer.concat([length, body, sum]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
const PNG = makePng(320, 200);

const report = { generatedAt: new Date().toISOString(), states: {}, routeHits: [], pageErrors: [], consoleErrors: [], csp: [], pass: true };
const browser = await chromium.launch({ executablePath: process.env.H2_CHROME, headless: true, args: ['--no-sandbox'] });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block', reducedMotion: 'reduce' });
await context.addInitScript(() => {
  window.__csp = [];
  window.addEventListener('securitypolicyviolation', (event) => window.__csp.push({ directive: event.violatedDirective, blockedURI: event.blockedURI }));
});
const page = await context.newPage();
page.on('pageerror', (error) => report.pageErrors.push(error.message));
page.on('console', (message) => { if (message.type() === 'error') report.consoleErrors.push(message.text()); });
await page.route('https://example.com/**', async (route) => {
  const url = route.request().url();
  report.routeHits.push(url);
  if (url.endsWith('/ok.png')) return route.fulfill({ status: 200, contentType: 'image/png', body: PNG });
  if (url.endsWith('/missing.png')) return route.fulfill({ status: 404, contentType: 'text/plain', body: 'not found' });
  return route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>not an image</title>' });
});
await page.route('http://example.com/**', async (route) => {
  report.routeHits.push(route.request().url());
  return route.fulfill({ status: 200, contentType: 'image/png', body: PNG });
});

const wait = (fn, arg) => page.waitForFunction(fn, arg, { timeout: 15000 });

const measurePanel = () => page.evaluate(() => {
  const panel = document.getElementById('human-review');
  const body = document.getElementById('human-review-body');
  const describe = (node) => {
    const style = getComputedStyle(node);
    const rect = node.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const atPoint = (centerX >= 0 && centerY >= 0 && centerX < innerWidth && centerY < innerHeight)
      ? document.elementFromPoint(centerX, centerY) : null;
    return {
      tag: node.tagName,
      cls: String(node.className || ''),
      text: (node.textContent || '').trim().slice(0, 120),
      display: style.display,
      visibility: style.visibility,
      opacity: style.opacity,
      color: style.color,
      rect: { x: Math.round(rect.left), y: Math.round(rect.top), w: Math.round(rect.width), h: Math.round(rect.height) },
      inViewport: rect.top >= 0 && rect.bottom <= innerHeight && rect.left >= 0 && rect.right <= innerWidth,
      hitTestSelf: Boolean(atPoint && (atPoint === node || node.contains(atPoint))),
    };
  };
  const interactiveSelector = 'a, button, input, select, textarea, summary, [role="button"], [onclick], [tabindex]';
  const interactive = Array.from(panel.querySelectorAll(interactiveSelector)).map(describe);
  const instruction = body.querySelector('.human-review-instruction');
  const images = Array.from(body.querySelectorAll('img')).map((img) => ({
    ...describe(img),
    hidden: img.hidden,
    src: img.getAttribute('src'),
    currentSrc: img.currentSrc,
    alt: img.getAttribute('alt'),
    complete: img.complete,
    naturalWidth: img.naturalWidth,
    naturalHeight: img.naturalHeight,
  }));
  const imageErrors = Array.from(body.querySelectorAll('.human-review-image-error')).map((node) => ({
    hidden: node.hidden,
    text: (node.textContent || '').trim(),
  }));
  return {
    hidden: panel.hidden,
    reviewState: panel.getAttribute('data-review-state'),
    title: document.getElementById('human-review-title').textContent.trim(),
    text: body.innerText.replace(/\s+/g, ' ').trim(),
    interactive,
    instruction: instruction ? describe(instruction) : null,
    images,
    imageErrors,
    csp: window.__csp.slice(),
  };
});

async function openIssue(number) {
  await page.evaluate((n) => window.__taskBoard.openIssue(n), number);
  await wait((n) => window.__taskBoard.state.detail?.number === n && !document.getElementById('detail-view').hidden, number);
}

try {
  await page.goto(board.url);
  await page.locator('#password').fill(BOARD_PASSWORD);
  await page.locator('#login-btn').click();
  await wait(() => window.__taskBoard?.state.board?.issues.length === 7);

  for (const [key, number] of [['image-ok', 1], ['image-404', 2], ['image-not-image', 3], ['image-http', 4]]) {
    await openIssue(number);
    await page.waitForTimeout(600);
    report.states[key] = await measurePanel();
    await page.screenshot({ path: path.join(SHOTS, key + '.png') });
  }

  // Settled question: answer through the real form, then read the card the
  // reader is left with, the list row and the canvas card.
  await openIssue(5);
  await page.locator('#human-review-body .question-option-select').first().click();
  await page.locator('#human-review-body button.primary').first().click();
  try {
    await wait(() => window.__taskBoard.state.detail?.humanReview?.state === 'settled', null);
  } catch (error) {
    report.settledDebug = await page.evaluate(() => ({
      humanReview: window.__taskBoard.state.detail?.humanReview,
      panelText: document.getElementById('human-review-body')?.innerText,
      notice: document.getElementById('notice')?.textContent,
      statusLabel: window.__taskBoard.state.detail?.statusLabel,
    }));
    throw error;
  }
  report.states['question-answer-path'] = await measurePanel();
  report.states['question-answer-path'].status = await page.evaluate(() => ({
    statusLabel: window.__taskBoard.state.detail?.statusLabel,
    column: window.__taskBoard.state.detail?.column,
    humanReviewState: window.__taskBoard.state.detail?.humanReview?.state,
  }));
  await page.screenshot({ path: path.join(SHOTS, 'question-answer-path.png') });

  // A settled gate that still carries status:needs-human (for example an issue
  // answered on GitHub outside the board) must not read as a waiting artifact.
  await openIssue(6);
  await page.waitForTimeout(300);
  report.states['question-settled-external'] = await measurePanel();
  report.states['question-settled-external'].row = await page.evaluate(() => {
    const issue = window.__taskBoard.state.detail;
    const row = window.__taskBoard.simpleTaskRow(issue);
    document.body.appendChild(row);
    const text = row.innerText.replace(/\s+/g, ' ').trim();
    const badge = row.querySelector('.human-review-badge');
    const result = { text, badge: badge ? { text: badge.textContent.trim(), title: badge.getAttribute('title') } : null, statusLabel: issue.statusLabel, column: issue.column, humanReviewState: issue.humanReview?.state };
    row.remove();
    return result;
  });
  report.states['question-settled-external'].canvas = await page.evaluate(() => {
    const issue = window.__taskBoard.state.detail;
    const card = window.__taskBoard.createIssueCanvasCard(issue, { x: 0, y: 0 });
    document.body.appendChild(card);
    const text = card.innerText.replace(/\s+/g, ' ').trim();
    card.remove();
    return { text, humanReviewState: issue.humanReview?.state };
  });
  report.states['question-settled-external'].board = await page.evaluate(() => {
    const issue = window.__taskBoard.state.board?.issues?.find((item) => item.number === 6);
    return issue ? { statusLabel: issue.statusLabel, column: issue.column, humanReviewState: issue.humanReview?.state } : null;
  });
  await page.screenshot({ path: path.join(SHOTS, 'question-settled-external.png') });

  // Legacy waiting card: no artifact, but the reader must still have a truthful
  // way forward. The drawer status control is that way forward.
  await openIssue(7);
  await page.waitForTimeout(300);
  report.states['legacy-no-gate'] = await measurePanel();
  report.states['legacy-no-gate'].statusControl = await page.evaluate(() => {
    const select = document.getElementById('status-select');
    return select ? {
      present: true,
      hidden: select.hidden,
      options: Array.from(select.options).map((option) => option.value),
      value: select.value,
    } : { present: false };
  });
  await page.screenshot({ path: path.join(SHOTS, 'legacy-no-gate.png') });

  // ---- Assertions the existing probe does not make -------------------------
  // Each check is written against what a reader can actually see and click, so
  // a hidden instruction or a second concealed action fails the run.
  report.assertions = [];
  report.failures = [];
  const check = (name, ok, detail) => {
    report.assertions.push({ name, ok: Boolean(ok) });
    if (!ok) report.failures.push({ name, detail });
  };
  const visible = (node) => Boolean(node && node.inViewport && node.hitTestSelf &&
    node.display !== 'none' && node.visibility !== 'hidden' && Number(node.opacity) !== 0);
  const actionLinks = (state) => state.interactive.filter((node) => node.tag === 'A' && node.cls.includes('human-review-action'));

  const ok = report.states['image-ok'];
  check('image-ok: title', ok.title === 'Waiting for you', ok.title);
  check('image-ok: exactly one action link', actionLinks(ok).length === 1 && ok.interactive.length === 1, ok.interactive);
  check('image-ok: action visible and hit-testable', visible(actionLinks(ok)[0]), actionLinks(ok)[0]);
  check('image-ok: instruction visible and hit-testable', visible(ok.instruction), ok.instruction);
  check('image-ok: image rendered', ok.images.length === 1 && ok.images[0].naturalWidth > 0 && !ok.images[0].hidden, ok.images);

  for (const key of ['image-404', 'image-not-image']) {
    const state = report.states[key];
    check(key + ': broken image hidden', state.images.length === 1 && state.images[0].hidden === true, state.images);
    check(key + ': fallback visible', state.imageErrors.length === 1 && state.imageErrors[0].hidden === false, state.imageErrors);
    check(key + ': fallback text', /could not be loaded/.test(state.imageErrors[0]?.text || ''), state.imageErrors);
    check(key + ': one way forward remains', actionLinks(state).length === 1 && visible(actionLinks(state)[0]), state.interactive);
  }

  const insecure = report.states['image-http'];
  check('image-http: refused as malformed', insecure.reviewState === 'malformed', insecure.reviewState);
  check('image-http: precise reason', /https:\/\//.test(insecure.text), insecure.text);
  check('image-http: no image attempted', insecure.images.length === 0, insecure.images);
  check('image-http: no dead action', insecure.interactive.length === 0, insecure.interactive);

  const answered = report.states['question-answer-path'];
  check('answered: no waiting prompt remains', answered.hidden === true || answered.title === 'Answer received', { hidden: answered.hidden, title: answered.title });
  check('answered: task returns to the agent', answered.status.statusLabel === 'status:in-progress' && answered.status.column !== 'needs-human', answered.status);
  check('answered: nothing left to click', answered.interactive.length === 0, answered.interactive);

  const external = report.states['question-settled-external'];
  check('external settled: title is not a waiting prompt', external.title === 'Answer received', external.title);
  check('external settled: nothing left to click', external.interactive.length === 0, external.interactive);
  check('external settled: row does not claim a wait', /Answer received/.test(external.row.text) && !/Waiting for an artifact/.test(external.row.text), external.row);
  check('external settled: canvas does not claim a wait', /Answer received/.test(external.canvas.text) && !/Waiting for an artifact/.test(external.canvas.text), external.canvas);
  check('external settled: board item is settled', external.board?.humanReviewState === 'settled', external.board);

  const legacy = report.states['legacy-no-gate'];
  check('legacy: not shown as a ready artifact', legacy.reviewState === 'missing' && legacy.title === 'Waiting for an artifact', { state: legacy.reviewState, title: legacy.title });
  check('legacy: says nothing is clickable', /nothing you can click|nothing to click|no artifact/i.test(legacy.text), legacy.text);
  check('legacy: no invented action', legacy.interactive.length === 0, legacy.interactive);
  check('legacy: drawer offers a real status change', legacy.statusControl.present && legacy.statusControl.hidden === false && legacy.statusControl.options.includes('status:in-progress'), legacy.statusControl);

  check('no concealed interactive element in any measured state',
    Object.values(report.states).every((state) => state.interactive.every((node) => node.display !== 'none' && node.visibility !== 'hidden' && Number(node.opacity) !== 0)),
    Object.fromEntries(Object.entries(report.states).map(([key, state]) => [key, state.interactive])));
  if (report.failures.length) report.pass = false;
} catch (error) {
  report.error = error.stack;
  report.pass = false;
} finally {
  report.csp = await page.evaluate(() => window.__csp).catch(() => []);
  const expectedConsoleErrors = report.consoleErrors.filter((text) => /404/.test(text));
  const unexpectedConsoleErrors = report.consoleErrors.filter((text) => !/404/.test(text));
  report.counts = {
    states: Object.keys(report.states).length,
    assertions: (report.assertions || []).length,
    failedAssertions: (report.failures || []).length,
    pageErrors: report.pageErrors.length,
    consoleErrors: report.consoleErrors.length,
    expectedConsoleErrors: expectedConsoleErrors.length,
    unexpectedConsoleErrors: unexpectedConsoleErrors.length,
    cspViolations: report.csp.length,
  };
  report.pass = report.pass && !report.error && report.pageErrors.length === 0 && unexpectedConsoleErrors.length === 0 && report.csp.length === 0 && (report.failures || []).length === 0;
  fs.writeFileSync(path.join(OUT, 'logs', 'attack-browser.json'), JSON.stringify(report, null, 2) + '\n');
  await browser.close();
  await board.app.close();
  await fake.close();
}
console.log(JSON.stringify({ pass: report.pass, counts: report.counts, failures: report.failures, error: report.error, csp: report.csp, consoleErrors: report.consoleErrors, pageErrors: report.pageErrors, routeHits: report.routeHits }, null, 2));
if (!report.pass) process.exitCode = 1;
