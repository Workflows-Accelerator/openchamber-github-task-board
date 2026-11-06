import pkg from '/workspace/personal/lucas/charme-social/node_modules/playwright/index.js';
const { chromium } = pkg.default || pkg;
const browser = await chromium.launch({ executablePath: process.env.H2_CHROME, headless: true, args: ['--no-sandbox'] });
console.log('browser version', browser.version());
const page = await browser.newPage();
await page.setContent('<p>hi</p>');
console.log(await page.evaluate(() => navigator.userAgent));
await browser.close();
