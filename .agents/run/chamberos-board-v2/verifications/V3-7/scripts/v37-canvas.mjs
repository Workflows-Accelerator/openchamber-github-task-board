// V3-7 hostile review: real Chromium canvas drag + failed-write messaging in EN and FR.
import fs from 'node:fs';
import path from 'node:path';
const ROOT = process.env.V37_ROOT;
const { startFakeGitHub, makeIssue } = await import(path.join(ROOT, 'web/tests/fake-github.mjs'));
const { startBoard, BOARD_PASSWORD } = await import(path.join(ROOT, 'web/tests/helpers.mjs'));

let pkg;
try { pkg = await import('/workspace/personal/lucas/charme-social/node_modules/playwright/index.js'); }
catch { pkg = await import('playwright'); }
const { chromium } = pkg.default || pkg;

const outDir = path.join(ROOT, '.agents/run/chamberos-board-v2/verifications/V3-7');
fs.mkdirSync(path.join(outDir, 'screenshots'), { recursive: true });

const REPO = 'owner/alpha';
const issues = Array.from({ length: 4 }, (_, i) => makeIssue({
  number: i + 1,
  title: `Task ${i + 1}`,
  body: `Body ${i + 1}\n\n<!-- board-order: ${(i + 1) * 1000} -->`,
  labels: [['status:draft'], ['status:in-progress'], ['status:review'], ['status:done']][i],
  repo: REPO,
}));
const fake = await startFakeGitHub({ repo: REPO, issues });
const board = await startBoard(fake);
const browser = await chromium.launch({ executablePath: process.env.H2_CHROME, headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });

const result = { realDrag: null, messages: {}, consoleErrors: [] };

async function signInAndCanvas(context) {
  const page = await context.newPage();
  page.on('console', (m) => { if (m.type() === 'error') result.consoleErrors.push(m.text()); });
  await page.goto(board.url);
  await page.waitForSelector('#login-view:not([hidden])');
  await page.fill('#password', BOARD_PASSWORD);
  await page.click('#login-btn');
  await page.waitForFunction(() => !document.getElementById('board-view')?.hidden, null, { timeout: 15000 });
  await page.evaluate(() => { window.__taskBoard.switchView('canvas'); window.__taskBoard.renderBoard(); });
  await page.waitForSelector('.canvas-card', { timeout: 10000 });
  await page.waitForTimeout(300);
  return page;
}

// 1. A real mouse drag at 390x844, then a full reload must show the dropped position.
{
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  const page = await signInAndCanvas(context);
  const card = page.locator('.canvas-card').first();
  const box = await card.boundingBox();
  const before = await page.evaluate(() => {
    const el = document.querySelector('.canvas-card');
    return { left: el.style.left, top: el.style.top, key: el.getAttribute('data-issue-key') };
  });
  await page.mouse.move(box.x + box.width / 2, box.y + 20);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 90, box.y + 70, { steps: 12 });
  await page.mouse.up();
  await page.waitForTimeout(1200);
  const afterDrop = await page.evaluate(() => {
    const el = document.querySelector('.canvas-card');
    const notice = document.getElementById('notice');
    return { left: el.style.left, top: el.style.top, notice: notice.hidden ? '' : notice.textContent };
  });
  const persisted = await page.evaluate(() => window.__taskBoard.state.board.issues.map((i) => ({ n: i.number, canvas: i.canvas })));
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => !document.getElementById('board-view')?.hidden, null, { timeout: 15000 });
  await page.evaluate(() => { window.__taskBoard.switchView('canvas'); window.__taskBoard.renderBoard(); });
  await page.waitForSelector('.canvas-card', { timeout: 10000 });
  await page.waitForTimeout(500);
  const afterReload = await page.evaluate(() => {
    const el = document.querySelector('.canvas-card');
    const notice = document.getElementById('notice');
    return { left: el.style.left, top: el.style.top, notice: notice.hidden ? '' : notice.textContent };
  });
  const fakeBody = fake.findIssue(Number(before.key.split('#')[1])).body;
  result.realDrag = { viewport: '390x844', before, afterDrop, afterReload, persisted, persistedMarker: /board-canvas: [^\n]*/.exec(fakeBody)?.[0] || null, matches: afterDrop.left === afterReload.left && afterDrop.top === afterReload.top };
  await page.screenshot({ path: path.join(outDir, 'screenshots', `canvas-after-reload-390x844.png`) });
  await context.close();
}

// 2. Failure messages for each upstream status, EN and FR.
const cases = [
  { name: '400 write_rejected', status: 400, payload: { message: 'Bad Request', errors: ['Invalid label name'] } },
  { name: '403 forbidden', status: 403, payload: { message: 'Resource not accessible by integration' } },
  { name: '401 token', status: 401, payload: { message: 'Bad credentials' } },
  { name: '404 vanished', status: 404, payload: { message: 'Not Found' } },
  { name: '409 conflict', status: 409, payload: { message: 'Conflict' } },
  { name: '412 precondition', status: 412, payload: { message: 'Precondition Failed' } },
  { name: '422 validation', status: 422, payload: { message: 'Validation Failed', errors: [{ resource: 'Issue', field: 'body', code: 'invalid' }] } },
  { name: '429 rate limit', status: 429, payload: { message: 'Too Many Requests' }, headers: { 'x-ratelimit-remaining': '0' } },
  { name: '500 server', status: 500, payload: { message: 'Internal Server Error' } },
];

for (const lang of ['en', 'fr']) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  await context.addInitScript((l) => { try { localStorage.setItem('tb_lang', l); } catch {} }, lang);
  const page = await signInAndCanvas(context);
  const rows = [];
  for (const c of cases) {
    fake.setPatchHook(() => ({ status: c.status, payload: c.payload, headers: c.headers }));
    const row = await page.evaluate(async () => {
      const tb = window.__taskBoard;
      const issue = tb.state.board.issues[0];
      const el = document.querySelector(`.canvas-card[data-issue-key="${issue.key}"]`);
      const oldPos = { x: parseFloat(el.style.left) || 0, y: parseFloat(el.style.top) || 0 };
      const domBefore = { left: el.style.left, top: el.style.top };
      let thrown = null;
      try {
        await tb.saveCardPosition(issue, oldPos.x + 60, oldPos.y + 60, oldPos, el);
      } catch (err) {
        thrown = { code: err && err.code, status: err && err.status, message: err && err.message };
      }
      await new Promise((r) => setTimeout(r, 250));
      const notice = document.getElementById('notice');
      const el2 = document.querySelector(`.canvas-card[data-issue-key="${issue.key}"]`);
      return {
        thrown,
        notice: notice.hidden ? '' : notice.textContent,
        cardSnappedBack: el2.style.left === domBefore.left && el2.style.top === domBefore.top,
        issueCanvas: issue.canvas ? { x: issue.canvas.x, y: issue.canvas.y } : null,
      };
    });
    rows.push({ upstream: c.name, ...row });
    // restore a clean issue + fingerprint for the next case
    fake.setPatchHook(null);
    const detail = await page.evaluate(async () => {
      const res = await fetch('/api/issues/1');
      return res.status;
    });
    if (detail !== 200) rows.push({ upstream: `${c.name} (refresh)`, notice: `detail ${detail}` });
    await page.evaluate(async () => { await fetch('/api/board?refresh=1'); });
  }
  result.messages[lang] = rows;
  await context.close();
}

await browser.close();
console.log(JSON.stringify(result, null, 2));
await board.app.close();
await fake.close();
