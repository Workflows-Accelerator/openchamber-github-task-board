import path from 'node:path';
const ROOT = '/tmp/opencode/v37-v35before';
const { startFakeGitHub, makeIssue } = await import(path.join(ROOT, 'web/tests/fake-github.mjs'));
const { startBoard } = await import(path.join(ROOT, 'web/tests/helpers.mjs'));
let pkg;
try { pkg = await import('/workspace/personal/lucas/charme-social/node_modules/playwright/index.js'); } catch { pkg = await import('playwright'); }
const { chromium } = pkg.default || pkg;
const fake = await startFakeGitHub({ repo: 'owner/alpha', issues: [makeIssue({ number: 1, title: 'T', body: 'B', labels: ['status:draft'], repo: 'owner/alpha' })] });
const board = await startBoard(fake);
const browser = await chromium.launch({ executablePath: process.env.H2_CHROME, headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
const out = {};
for (const [w,h] of [[360,800],[1280,900]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, serviceWorkers: 'block' });
  const page = await ctx.newPage();
  await page.goto(board.url);
  await page.waitForSelector('#login-view:not([hidden])');
  out[`${w}x${h}`] = await page.evaluate(() => {
    const d = document.getElementById('compact-nav-dock');
    const c = document.getElementById('login-view').getBoundingClientRect();
    return { dock: getComputedStyle(d).display, dockH: d.getBoundingClientRect().height, card: { w: c.width, h: c.height, x: c.left, y: c.top } };
  });
  await page.screenshot({ path: `/tmp/opencode/v37-v35before-${w}x${h}.png` });
  await ctx.close();
}
console.log(JSON.stringify(out, null, 2));
await browser.close(); await board.app.close(); await fake.close();
