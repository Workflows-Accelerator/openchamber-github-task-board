import path from 'node:path';
const ROOT = process.env.V37_ROOT;
const { startFakeGitHub, makeIssue } = await import(path.join(ROOT, 'web/tests/fake-github.mjs'));
const { startBoard, BOARD_PASSWORD } = await import(path.join(ROOT, 'web/tests/helpers.mjs'));
let pkg;
try { pkg = await import('/workspace/personal/lucas/charme-social/node_modules/playwright/index.js'); }
catch { pkg = await import('playwright'); }
const { chromium } = pkg.default || pkg;

const REPO = 'owner/alpha';
const fake = await startFakeGitHub({ repo: REPO, issues: [makeIssue({ number: 1, title: 'T', body: 'B', labels: ['status:draft'], repo: REPO })] });
const board = await startBoard(fake);
const browser = await chromium.launch({ executablePath: process.env.H2_CHROME, headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
const context = await browser.newContext({ viewport: { width: 360, height: 800 }, serviceWorkers: 'block' });
const page = await context.newPage();
await page.goto(board.url);
await page.waitForSelector('#login-view:not([hidden])');
await page.fill('#password', BOARD_PASSWORD);
await page.click('#login-btn');
await page.waitForFunction(() => !document.getElementById('board-view')?.hidden, null, { timeout: 15000 });
await page.evaluate(() => { localStorage.clear(); document.cookie.split(';').forEach((c) => { document.cookie = c.replace(/^ +/, '').replace(/=.*/, '=;expires=' + new Date().toUTCString() + ';path=/'); }); });
const out = {};
await page.route('**/api/board', (route) => route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"github_unavailable","message":"boom"}' }));
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2000);
out.after500 = await page.evaluate(() => ({
  loginVisible: !document.getElementById('login-view').hidden,
  boardVisible: !document.getElementById('board-view').hidden,
  dock: getComputedStyle(document.getElementById('compact-nav-dock')).display,
  sidebar: getComputedStyle(document.getElementById('app-sidebar')).display,
  notice: document.getElementById('notice').hidden ? '' : document.getElementById('notice').textContent,
  loginError: document.getElementById('login-error').hidden ? '' : document.getElementById('login-error').textContent,
}));
// slow load from a cold start: login view must not hide the dock after auth resolves
await page.unroute('**/api/board');
let release;
const gate = new Promise((r) => { release = r; });
await page.route('**/api/board*', async (route) => { await gate; await route.continue(); });
const nav = page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForTimeout(600);
out.slowEarly = await page.evaluate(() => ({
  loginVisible: !document.getElementById('login-view').hidden,
  dock: getComputedStyle(document.getElementById('compact-nav-dock')).display,
}));
release();
await nav;
await page.waitForFunction(() => !document.getElementById('board-view')?.hidden, null, { timeout: 15000 }).catch(() => {});
out.slowLate = await page.evaluate(() => ({
  loginVisible: !document.getElementById('login-view').hidden,
  boardVisible: !document.getElementById('board-view').hidden,
  dock: getComputedStyle(document.getElementById('compact-nav-dock')).display,
}));
console.log(JSON.stringify(out, null, 2));
await browser.close();
await board.app.close();
await fake.close();
