import { pathToFileURL } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';

const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_CORE || '/workspace/.npm/_npx/e41f203b7505f1fb/node_modules/playwright-core/index.mjs'));

const outDir = '.agents/run/batch-simplify-staging/verifications/screenshots';
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/workspace/.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell',
  headless: true,
  args: ['--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

const pageErrors = [];
page.on('pageerror', (err) => pageErrors.push(err.message));

console.log('Navigating to preview login...');
await page.goto('http://127.0.0.1:4040');

await page.waitForSelector('form#login-form');
await page.screenshot({ path: path.join(outDir, 'preview-login.png') });

console.log('Signing in...');
await page.fill('input#password', 'correct horse battery staple');
await page.click('button[type="submit"]');

await page.waitForSelector('#task-board-container, #board-main, .task-row, .empty-state, #simple-list-view', { timeout: 10000 });
await page.waitForTimeout(1000);

await page.screenshot({ path: path.join(outDir, 'preview-board.png') });

console.log('Switching to mobile viewport...');
await page.setViewportSize({ width: 390, height: 844 });
await page.waitForTimeout(500);
await page.screenshot({ path: path.join(outDir, 'preview-mobile.png') });

await browser.close();

console.log('Browser check complete. Page errors:', pageErrors.length);
if (pageErrors.length > 0) {
  console.error('Page errors encountered:', pageErrors);
  process.exit(1);
}
