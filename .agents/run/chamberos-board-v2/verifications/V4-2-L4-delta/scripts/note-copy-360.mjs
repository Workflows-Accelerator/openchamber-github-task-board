// Independent check: the two corrected note-refusal messages at 360 px, EN and FR,
// light and dark. Renders both strings in the real drawer, measures overflow and
// saves one screen per combination. Synthetic GitHub only.
//
// Two mechanisms, because the two strings are produced at different layers:
//  - agent_note_not_found: fake GitHub answers 410, the board maps it to 404
//    not_found, the client renders the sentence (the real H5 path).
//  - agent_note_too_long: the board's own 400, intercepted at the client's
//    request so the sentence renders at 360. Note that the textarea carries
//    maxlength="4000" and the server cap is 4000, so this sentence is not
//    reachable by typing; the layout check is still valid for the copy.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { startFakeGitHub, makeIssue } from '../../../../../../web/tests/fake-github.mjs';
import { startBoard, BOARD_PASSWORD } from '../../../../../../web/tests/helpers.mjs';

let pkg;
try { pkg = await import('/workspace/personal/lucas/charme-social/node_modules/playwright/index.js'); } catch { pkg = await import('playwright'); }
const { chromium } = pkg.default || pkg;

const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SHOTS = path.join(OUT, 'screenshots');
fs.mkdirSync(SHOTS, { recursive: true });

const body = [
  '<!-- board-canvas: {"x":80,"y":90} -->',
  '## Overview',
  'Check the refusal copy at the narrowest width.',
  '',
  '## Open Questions',
  '- [ ] Which database should we use for the audit trail?',
  '  - PostgreSQL :: Mature and familiar :: **Operations stay unchanged**.',
].join('\n');

const fake = await startFakeGitHub({ issues: [makeIssue({ number: 1, title: 'Copy width check', body, labels: ['status:needs-human'] })] });
const board = await startBoard(fake);
const browser = await chromium.launch({ executablePath: process.env.H2_CHROME || '/workspace/.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell', headless: true, args: ['--no-sandbox'] });
const report = { syntheticOnly: true, viewport: '360x800', textareaMaxLength: null, cases: [], pageErrors: [], consoleErrors: [], expectedHttpErrors: [] };
const context = await browser.newContext({ viewport: { width: 360, height: 800 }, serviceWorkers: 'block', reducedMotion: 'reduce' });
const page = await context.newPage();
page.on('pageerror', (e) => report.pageErrors.push(e.message));
// The probe injects a 410 and a 400 on purpose; the browser logs each one.
page.on('console', (m) => { if (m.type() !== 'error') return; const t = m.text(); if (/Failed to load resource.*(400|404|410)/.test(t)) report.expectedHttpErrors.push(t); else report.consoleErrors.push(t); });
const wait = (cb) => page.waitForFunction(cb);
const open = async () => { await page.evaluate(() => window.__taskBoard.openIssue(1)); await wait(() => window.__taskBoard.state.detail?.number === 1 && !document.getElementById('detail-view').hidden); };
const close = () => page.evaluate(() => window.__taskBoard.closeAgentNote?.() ?? window.__taskBoard.closeDrawer());

let interceptTooLong = false;
await page.route('**/api/**/notes', async (route) => {
  if (!interceptTooLong) return route.continue();
  return route.fulfill({
    status: 400,
    contentType: 'application/json',
    body: JSON.stringify({ error: 'note_too_long', message: 'A note cannot exceed 4000 characters' }),
  });
});

const measure = async () => page.evaluate(() => {
  const status = document.getElementById('agent-note-status');
  const composer = document.getElementById('agent-note-composer');
  const r = status.getBoundingClientRect();
  const cs = getComputedStyle(status);
  return {
    text: status.innerText.replace(/\s+/g, ' ').trim(),
    statusScrollWidth: status.scrollWidth,
    statusClientWidth: status.clientWidth,
    overflowX: cs.overflowX,
    statusTop: Math.round(r.top), statusBottom: Math.round(r.bottom), statusHeight: Math.round(r.height),
    composerVisible: composer ? !composer.hidden : null,
    docScrollWidth: document.documentElement.scrollWidth,
    innerWidth,
    viewportHeight: innerHeight,
    textInsideViewport: r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight,
    horizontalScrollInsideStatus: status.scrollWidth > status.clientWidth + 1,
  };
});

try {
  const response = await page.goto(board.url);
  assert.ok(response.headers()['content-security-policy']);
  await page.locator('#password').fill(BOARD_PASSWORD);
  await page.locator('#login-btn').click();
  await wait(() => window.__taskBoard?.state.board?.issues.length === 1);
  report.textareaMaxLength = await page.locator('#agent-note-text').getAttribute('maxlength');

  for (const theme of ['light', 'dark']) for (const lang of ['en', 'fr']) {
    await page.evaluate(({ theme, lang }) => {
      window.__taskBoard.setThemeMode(theme);
      if (document.documentElement.lang !== lang) document.getElementById('lang-switch-btn').click();
    }, { theme, lang });
    await page.evaluate(() => document.getElementById('nav-list').click());
    await open();

    // 1. GitHub answers 410: the conversation is gone / issues disabled.
    fake.state.commentHook = () => ({ status: 410, payload: { message: 'Gone' } });
    await page.locator('#agent-note-add-btn').click();
    await page.locator('#agent-note-text').fill(lang === 'fr' ? 'Brouillon conservé.' : 'Draft kept.');
    await page.locator('#agent-note-send').click();
    await wait(() => document.getElementById('agent-note-status').textContent.trim().length > 0);
    const notFound = await measure();
    await page.screenshot({ path: path.join(SHOTS, `note-410-360-${theme}-${lang}.png`) });
    fake.state.commentHook = null;

    // 2. The board's own 4,000-character cap, refused by the board.
    interceptTooLong = true;
    await page.locator('#agent-note-text').fill('x'.repeat(3900));
    await page.locator('#agent-note-send').click();
    await wait(() => /4.?000|4 000/.test(document.getElementById('agent-note-status').textContent));
    const tooLong = await measure();
    await page.screenshot({ path: path.join(SHOTS, `note-4000-360-${theme}-${lang}.png`) });
    interceptTooLong = false;

    report.cases.push({ theme, lang, notFound, tooLong });
    await page.locator('#agent-note-text').fill('');
    await page.locator('#agent-note-text').press('Escape');
  }
  report.pass = report.pageErrors.length === 0 && report.consoleErrors.length === 0
    && report.cases.every((c) => c.notFound.docScrollWidth <= 360 && c.tooLong.docScrollWidth <= 360
      && !c.notFound.horizontalScrollInsideStatus && !c.tooLong.horizontalScrollInsideStatus
      && c.notFound.textInsideViewport && c.tooLong.textInsideViewport
      && c.notFound.composerVisible && c.tooLong.composerVisible);
} finally {
  fs.writeFileSync(path.join(OUT, 'note-copy-360.json'), JSON.stringify(report, null, 2) + '\n');
  await browser.close();
  await board.app.close();
  await fake.close();
}
console.log(JSON.stringify({ pass: report.pass, textareaMaxLength: report.textareaMaxLength, cases: report.cases.map((c) => ({ theme: c.theme, lang: c.lang, notFound: c.notFound.text, tooLong: c.tooLong.text, docScrollWidth: [c.notFound.docScrollWidth, c.tooLong.docScrollWidth], inside: [c.notFound.textInsideViewport, c.tooLong.textInsideViewport], hScroll: [c.notFound.horizontalScrollInsideStatus, c.tooLong.horizontalScrollInsideStatus], heights: [c.notFound.statusHeight, c.tooLong.statusHeight] })), pageErrors: report.pageErrors, consoleErrors: report.consoleErrors }));
if (!report.pass) process.exit(1);
