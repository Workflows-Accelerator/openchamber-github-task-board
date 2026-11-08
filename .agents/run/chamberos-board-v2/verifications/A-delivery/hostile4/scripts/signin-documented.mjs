// hostile4: sign in to the :4041 preview with exactly the password string documented in human-review.md.
// Read-only: login + board load only. No Arrange, no edits. Computed verdict.
import fs from 'node:fs';
import path from 'node:path';

let pkg;
try {
  pkg = await import('/workspace/personal/lucas/charme-social/node_modules/playwright/index.js');
} catch {
  pkg = await import('playwright');
}
const { chromium } = pkg.default || pkg;

const root = process.cwd();
const out = path.join(root, '.agents/run/chamberos-board-v2/verifications/A-delivery/hostile4');
const doc = fs.readFileSync(path.join(root, '.agents/run/chamberos-board-v2/verifications/A-delivery/human-review.md'), 'utf8');
const line = doc.split('\n').find((l) => l.includes('Synthetic Preview Password'));
const documented = line.match(/`([^`]+)`/)[1];
const url = 'http://127.0.0.1:4041';

const browser = await chromium.launch({ executablePath: process.env.H2_CHROME, headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const result = { url, documentedLine: line.trim(), documented, documentedLength: documented.length };
try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block' });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  await page.goto(url);
  await page.waitForSelector('#login-form');
  // Type the documented string key by key, as a human would.
  await page.click('#password');
  await page.keyboard.type(documented);
  result.typedValue = await page.inputValue('#password');
  await page.keyboard.press('Enter');
  let boardVisible = false;
  for (let i = 0; i < 100 && !boardVisible; i++) {
    boardVisible = await page.evaluate(() => !document.getElementById('board-view')?.hidden).catch(() => false);
    if (!boardVisible) await sleep(100);
  }
  for (let i = 0; i < 100; i++) {
    if (await page.evaluate(() => (window.__taskBoard?.state?.board?.issues?.length || 0) >= 8).catch(() => false)) break;
    await sleep(100);
  }
  result.boardVisible = boardVisible;
  result.issues = await page.evaluate(() => window.__taskBoard?.state?.board?.issues?.length || 0);
  result.consoleErrors = consoleErrors;
  await page.screenshot({ path: path.join(out, 'screenshots', 'signin-documented-1280.png') });
  result.pass = boardVisible && result.issues >= 8 && result.typedValue === documented && documented === 'correct horse battery staple';
} finally {
  await browser.close();
}
fs.writeFileSync(path.join(out, 'signin-documented.json'), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result));
process.exit(result.pass ? 0 : 1);
