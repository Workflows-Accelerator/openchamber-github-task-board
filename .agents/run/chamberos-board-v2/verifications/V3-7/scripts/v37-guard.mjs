// V3-7 hostile review: V3-5 signed-out dock/header guard, measured in real Chromium.
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
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];

const browser = await chromium.launch({ executablePath: process.env.H2_CHROME, headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });

async function measure(page) {
  return page.evaluate(() => {
    const box = (sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return { display: cs.display, visibility: cs.visibility, hidden: el.hidden, w: +r.width.toFixed(1), h: +r.height.toFixed(1), x: +r.left.toFixed(1), y: +r.top.toFixed(1) };
    };
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const card = document.querySelector('#login-view');
    const cr = card ? card.getBoundingClientRect() : null;
    return {
      viewport: `${vw}x${vh}`,
      theme: document.documentElement.getAttribute('data-theme') || 'auto',
      loginVisible: card ? !card.hidden : false,
      dock: box('#compact-nav-dock'),
      header: box('.compact-header'),
      sidebar: box('#app-sidebar'),
      card: box('#login-view'),
      password: box('#password'),
      submit: box('#login-btn'),
      centering: cr ? { hDiff: +Math.abs((cr.left + cr.width / 2) - vw / 2).toFixed(2), vDiff: +Math.abs((cr.top + cr.height / 2) - vh / 2).toFixed(2), overflowX: cr.left < 0 || cr.right > vw, overflowY: cr.top < 0 || cr.bottom > vh } : null,
    };
  });
}

for (const [w, h] of [[360, 800], [1280, 900]]) {
  for (const theme of ['dark', 'light']) {
    const context = await browser.newContext({ viewport: { width: w, height: h }, serviceWorkers: 'block' });
    await context.addInitScript((t) => { try { localStorage.setItem('tb_theme_mode', t); } catch {} }, theme);
    const page = await context.newPage();
    const consoleErrors = [];
    page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
    await page.goto(board.url);
    await page.waitForSelector('#login-view:not([hidden])', { timeout: 10000 }).catch(() => {});
    const signedOut = await measure(page);
    await page.screenshot({ path: path.join(outDir, 'screenshots', `guard-signed-out-${w}x${h}-${theme}.png`) });

    // Sign in through the UI, then re-measure the same viewport.
    await page.fill('#password', BOARD_PASSWORD);
    await page.click('#login-btn');
    await page.waitForFunction(() => !document.getElementById('board-view')?.hidden, null, { timeout: 15000 });
    await page.waitForTimeout(400);
    const signedIn = await measure(page);

    // Show the login view after the board was rendered, then restore it.
    const afterLateLogin = await page.evaluate(() => {
      window.__taskBoard.showLogin();
      const el = document.getElementById('login-view');
      const dock = document.getElementById('compact-nav-dock');
      const out = { loginVisible: !el.hidden, dockDisplay: getComputedStyle(dock).display, dockHeight: dock.getBoundingClientRect().height };
      window.__taskBoard.showBoard();
      out.restoredDockDisplay = getComputedStyle(dock).display;
      out.restoredDockHeight = dock.getBoundingClientRect().height;
      return out;
    });

    results.push({ case: `signed-out ${w}x${h} ${theme}`, signedOut, signedIn, afterLateLogin, consoleErrors });
    await context.close();
  }
}

// Slow /api/board for a signed-in session: the guard must not hide the dock on a slow load.
{
  const context = await browser.newContext({ viewport: { width: 360, height: 800 }, serviceWorkers: 'block' });
  const page = await context.newPage();
  await page.goto(board.url);
  await page.waitForSelector('#login-view:not([hidden])');
  await page.fill('#password', BOARD_PASSWORD);
  await page.click('#login-btn');
  await page.waitForFunction(() => !document.getElementById('board-view')?.hidden, null, { timeout: 15000 });
  let release;
  const gate = new Promise((r) => { release = r; });
  await page.route('**/api/board*', async (route) => { await gate; await route.continue(); });
  const reload = page.reload({ waitUntil: 'domcontentloaded' });
  await sleep(700);
  const during = await measure(page);
  release();
  await reload;
  await page.waitForFunction(() => !document.getElementById('board-view')?.hidden, null, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(300);
  const after = await measure(page);
  results.push({ case: 'slow /api/board while signed in', during, after });
  await context.close();
}

// Failed /api/board with no cached board: record what the user actually sees.
{
  const context = await browser.newContext({ viewport: { width: 360, height: 800 }, serviceWorkers: 'block' });
  const page = await context.newPage();
  await page.goto(board.url);
  await page.waitForSelector('#login-view:not([hidden])');
  await page.fill('#password', BOARD_PASSWORD);
  await page.click('#login-btn');
  await page.waitForFunction(() => !document.getElementById('board-view')?.hidden, null, { timeout: 15000 });
  await page.evaluate(() => { localStorage.removeItem('tb_cached_board'); localStorage.removeItem('tb_auth_hint'); });
  await page.route('**/api/board*', (route) => route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"github_unavailable","message":"boom"}' }));
  await page.reload({ waitUntil: 'domcontentloaded' });
  await sleep(1500);
  const failed = await measure(page);
  const notice = await page.evaluate(() => document.getElementById('login-error')?.textContent || '');
  results.push({ case: 'failed /api/board, no cache', failed, notice });
  await context.close();
}

await browser.close();
console.log(JSON.stringify(results, null, 2));
await board.app.close();
await fake.close();
