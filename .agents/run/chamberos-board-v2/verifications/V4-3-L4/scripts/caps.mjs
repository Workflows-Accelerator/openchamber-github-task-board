// V4-3-L4 extra presentation probe: the caps at their limit on a phone.
// A 200-character instruction, an unbroken 200-character token, and a
// 2048-character link URL, at 360x800 in EN and FR. Measures overflow and
// hit-testability of the one action.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startFakeGitHub, makeIssue } from '../../../../../../web/tests/fake-github.mjs';
import { startBoard, BOARD_PASSWORD } from '../../../../../../web/tests/helpers.mjs';

let pkg;
try { pkg = await import('/workspace/personal/lucas/charme-social/node_modules/playwright/index.js'); } catch { pkg = await import('playwright'); }
const { chromium } = pkg.default || pkg;
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const LONG_INSTRUCTION = ('Compare the empty state with the approved mockup, then confirm the primary button stays above the fold and the helper text wraps without clipping at 360 pixels wide. '.repeat(3)).slice(0, 200);
const LONG_TOKEN = 'Compare ' + 'x'.repeat(190);
const LONG_URL = 'https://example.com/' + 'a'.repeat(2048 - 'https://example.com/'.length);

const body = (lines) => lines.join('\n');
const fake = await startFakeGitHub({
  honorIfNoneMatch: true,
  issues: [
    makeIssue({ number: 1, title: 'Long instruction', body: body(['### Human Review:', '- Artifact: image', '- URL: https://example.com/a.png', `- Instruction: ${LONG_INSTRUCTION}`]), labels: ['status:needs-human'] }),
    makeIssue({ number: 2, title: 'Unbroken token', body: body(['### Human Review:', '- Artifact: link', '- URL: https://example.com/x', `- Instruction: ${LONG_TOKEN}`]), labels: ['status:needs-human'] }),
    makeIssue({ number: 3, title: 'Long URL', body: body(['### Human Review:', '- Artifact: link', `- URL: ${LONG_URL}`, '- Instruction: Open the long link.']), labels: ['status:needs-human'] }),
  ],
});
const board = await startBoard(fake);
const report = { cases: [], failures: [] };
const browser = await chromium.launch({
  executablePath: process.env.H2_CHROME || '/workspace/.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell',
  headless: true, args: ['--no-sandbox'],
});
try {
  const context = await browser.newContext({ viewport: { width: 360, height: 800 }, serviceWorkers: 'block', reducedMotion: 'reduce' });
  const page = await context.newPage();
  await page.goto(board.url);
  await page.locator('#password').fill(BOARD_PASSWORD);
  await page.locator('#login-btn').click();
  await page.waitForFunction(() => window.__taskBoard?.state.board?.issues.length === 3);
  for (const lang of ['en', 'fr']) {
    if (await page.evaluate(() => document.documentElement.lang) !== lang) {
      await page.evaluate(() => document.getElementById('lang-switch-btn').click());
      await page.waitForFunction((v) => document.documentElement.lang === v, lang);
    }
    for (const number of [1, 2, 3]) {
      await page.evaluate((n) => window.__taskBoard.openIssue(n), number);
      await page.waitForFunction((n) => window.__taskBoard.state.detail?.number === n && !document.getElementById('detail-view').hidden, number);
      await page.evaluate(() => document.getElementById('human-review').scrollIntoView({ block: 'center' }));
      await new Promise((resolve) => setTimeout(resolve, 150));
      const measured = await page.evaluate(() => {
        const panel = document.getElementById('human-review');
        const action = panel.querySelector('a.human-review-action, button.primary');
        const instruction = panel.querySelector('.human-review-instruction');
        if (!action) return { title: document.getElementById('human-review-title').textContent.trim(), panelHidden: panel.hidden, reviewState: panel.getAttribute('data-review-state'), bodyText: document.getElementById('human-review-body').innerText, noAction: true, scrollWidth: document.documentElement.scrollWidth, innerWidth: window.innerWidth };
        const rect = action.getBoundingClientRect();
        const top = document.elementFromPoint(Math.min(rect.left + rect.width / 2, window.innerWidth - 1), Math.min(rect.top + rect.height / 2, window.innerHeight - 1));
        return {
          title: document.getElementById('human-review-title').textContent.trim(),
          scrollWidth: document.documentElement.scrollWidth,
          innerWidth: window.innerWidth,
          panelOverflow: { scrollWidth: panel.scrollWidth, clientWidth: panel.clientWidth },
          instructionRect: instruction ? { left: Math.round(instruction.getBoundingClientRect().left), right: Math.round(instruction.getBoundingClientRect().right), height: Math.round(instruction.getBoundingClientRect().height) } : null,
          action: {
            label: action.textContent.trim(),
            rect: { left: Math.round(rect.left), right: Math.round(rect.right), top: Math.round(rect.top), bottom: Math.round(rect.bottom) },
            hitSelf: Boolean(top && (top === action || action.contains(top))),
            insideViewport: rect.left >= -1 && rect.right <= window.innerWidth + 1,
          },
        };
      });
      const shot = path.join(OUT, 'screenshots', `l4-caps-${number}-360-${lang}.png`);
      await page.screenshot({ path: shot });
      const ok = measured.noAction ? false : (measured.scrollWidth <= measured.innerWidth + 1
        && measured.panelOverflow.scrollWidth <= measured.panelOverflow.clientWidth + 1
        && measured.action.hitSelf === true
        && measured.action.insideViewport === true
        && (!measured.instructionRect || (measured.instructionRect.left >= -1 && measured.instructionRect.right <= measured.innerWidth + 1)));
      const entry = { issue: number, lang, ok, ...measured };
      report.cases.push(entry);
      if (!ok) report.failures.push(entry);
    }
  }
} finally {
  await browser.close();
  await board.app.close();
  await fake.close();
}
report.pass = report.failures.length === 0;
fs.writeFileSync(path.join(OUT, 'l4-caps.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ pass: report.pass, failures: report.failures, cases: report.cases.map((c) => ({ issue: c.issue, lang: c.lang, ok: c.ok, title: c.title, action: c.action, instructionRect: c.instructionRect, panelOverflow: c.panelOverflow, pageWidth: [c.scrollWidth, c.innerWidth] })) }, null, 2));
