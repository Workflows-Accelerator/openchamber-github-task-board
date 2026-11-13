// Signed-out, read-only Chromium smoke against the live production origin.
// No sign-in, no session creation, no GitHub request that mutates state.
// Only GET / and GET /api/board are exercised.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

let pkg;
try { pkg = await import('/workspace/personal/lucas/charme-social/node_modules/playwright/index.js'); }
catch { pkg = await import('playwright'); }
const { chromium } = pkg.default || pkg;

const OUT = path.dirname(fileURLToPath(import.meta.url));
const ORIGIN = 'https://board.workflows.ac';
fs.mkdirSync(path.join(OUT, 'screenshots'), { recursive: true });

const report = { origin: ORIGIN, signedOut: true, viewports: [] };
const browser = await chromium.launch({
  executablePath: '/workspace/.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell',
  headless: true,
  args: ['--no-sandbox'],
});

for (const [width, height] of [[390, 844], [1280, 900]]) {
  const label = `${width}x${height}`;
  const context = await browser.newContext({
    viewport: { width, height }, serviceWorkers: 'block', reducedMotion: 'reduce',
  });
  await context.addInitScript(() => {
    window.__csp = [];
    window.addEventListener('securitypolicyviolation', (e) =>
      window.__csp.push(e.violatedDirective + ' ' + (e.blockedURI || '')));
  });
  const page = await context.newPage();
  const row = { viewport: label, responseStatus: null, pageErrors: [], consoleErrors: [], csp: [], apiBoardStatus: null, requests: [], screenshot: null, login: {} };
  page.on('pageerror', (e) => row.pageErrors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') row.consoleErrors.push(m.text()); });
  page.on('request', (r) => { if (r.url().startsWith(ORIGIN)) row.requests.push(r.method() + ' ' + new URL(r.url()).pathname); });

  const response = await page.goto(ORIGIN + '/', { waitUntil: 'networkidle' });
  row.responseStatus = response.status();
  await page.waitForFunction(() => !document.getElementById('login-view').hidden);
  row.apiBoardStatus = (await page.evaluate(async () => (await fetch('/api/board')).status));
  row.login = {
    loginViewVisible: await page.locator('#login-view').isVisible(),
    boardViewHidden: await page.locator('#board-view').isHidden(),
    passwordFields: await page.locator('#password').count(),
    passwordType: await page.locator('#password').getAttribute('type'),
    submitBox: await page.locator('#login-btn').boundingBox(),
    loginBox: await page.locator('#login-form').boundingBox(),
    navListVisible: await page.locator('#nav-list').isVisible().catch(() => false),
    navCanvasVisible: await page.locator('#nav-canvas').isVisible().catch(() => false),
  };
  row.csp = await page.evaluate(() => window.__csp);
  row.screenshot = `screenshots/live-signed-out-${label}.png`;
  await page.screenshot({ path: path.join(OUT, row.screenshot), fullPage: false });
  report.viewports.push(row);
  await context.close();
}

await browser.close();
fs.writeFileSync(path.join(OUT, 'browser.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
