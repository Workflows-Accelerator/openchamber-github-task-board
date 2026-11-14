import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { startFakeGitHub, makeIssue } from '../../../../../web/tests/fake-github.mjs';
import { startBoard, BOARD_PASSWORD, browserConfig, SYNTHETIC_TOKEN } from '../../../../../web/tests/helpers.mjs';

const { chromium } = (await import('/workspace/personal/lucas/charme-social/node_modules/playwright/index.js')).default;

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SHOTS = path.join(HERE, 'screenshots');
fs.mkdirSync(SHOTS, { recursive: true });

const RESET_SECONDS = Math.floor(Date.parse('2026-11-14T14:32:00Z') / 1000);
const KINDS = [
  { kind: 'auth', mode: 'auth' },
  { kind: 'rate_limited', mode: 'rate_limited' },
  { kind: 'network', mode: 'network' },
  { kind: 'server', mode: true },
];
const VIEWPORTS = [
  { width: 390, height: 844 },
  { width: 1280, height: 900 },
];
const THEMES = ['light', 'dark'];
const LANGS = ['en', 'fr'];

const fake = await startFakeGitHub({
  token: SYNTHETIC_TOKEN,
  repositories: [
    {
      repo: 'owner/alpha',
      id: 101,
      issues: [
        makeIssue({ number: 1, title: 'Alpha task', body: '## Overview\n\nTask body\n', labels: ['status:todo'] }),
      ],
    },
  ],
});

const board = await startBoard(fake, {
  repositoryTtlMs: 0,
  config: browserConfig(fake),
});

const chromePath = process.env.H2_CHROME || '/workspace/.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell';
const browser = await chromium.launch({ executablePath: chromePath, headless: true, args: ['--no-sandbox'] });

const report = {
  syntheticOnly: true,
  startedAt: new Date().toISOString(),
  rows: [],
  sentencesByLang: { en: {}, fr: {} },
  pageErrors: [],
  consoleErrors: [],
  cspViolations: [],
  captures: [],
};

try {
  for (const vp of VIEWPORTS) {
    for (const theme of THEMES) {
      for (const lang of LANGS) {
        const context = await browser.newContext({
          viewport: vp,
          serviceWorkers: 'block',
          reducedMotion: 'reduce',
        });
        await context.addInitScript(({ theme, lang }) => {
          localStorage.setItem('tb_theme_mode', theme);
          localStorage.setItem('tb_lang', lang);
          window.__cspViolations = [];
          window.addEventListener('securitypolicyviolation', (e) => {
            window.__cspViolations.push(e.violatedDirective || e.blockedURI || 'violation');
          });
        }, { theme, lang });

        const page = await context.newPage();
        page.on('pageerror', (err) => report.pageErrors.push(`${vp.width}-${theme}-${lang}: ${err.message}`));
        page.on('console', (msg) => {
          if (msg.type() === 'error') {
            report.consoleErrors.push(`${vp.width}-${theme}-${lang}: ${msg.text()}`);
          }
        });

        fake.setDiscoveryFailure(false);
        await page.goto(board.url, { waitUntil: 'networkidle' });
        await page.locator('#password').fill(BOARD_PASSWORD);
        await page.locator('#login-btn').click();
        await page.waitForFunction(() => window.__taskBoard?.state?.board?.issues?.length === 1);

        for (const { kind, mode } of KINDS) {
          if (kind === 'rate_limited') fake.setDiscoveryResetAt(RESET_SECONDS);
          fake.setDiscoveryFailure(mode);

          const prevGen = await page.evaluate(() => window.__taskBoard.state.boardGeneration);
          await page.evaluate(() => document.getElementById('refresh-btn').click());
          await page.waitForFunction(
            (prev) => window.__taskBoard?.state?.boardGeneration > prev && window.__taskBoard?.state?.boardLoads === 0 && !document.getElementById('refresh-btn').disabled,
            prevGen,
          );
          await page.waitForFunction(() => {
            const empty = document.getElementById('empty-state');
            return empty && !empty.hidden && Boolean(empty.querySelector('p')?.textContent);
          });

          const text = await page.evaluate(() => ({
            empty: document.getElementById('empty-state')?.querySelector('p')?.textContent?.trim() || '',
            notice: document.getElementById('notice')?.textContent?.trim() || '',
            scope: document.getElementById('scope-status')?.textContent?.trim() || '',
            discoveryStatus: document.getElementById('discovery-status')?.textContent?.trim() || '',
            themeAttr: document.documentElement.getAttribute('data-theme'),
            langAttr: document.documentElement.lang,
            csp: window.__cspViolations || [],
          }));

          assert.equal(text.themeAttr, theme);
          assert.equal(text.langAttr, lang);
          assert.ok(text.empty.length > 0, `empty sentence missing for ${kind}`);
          assert.equal(text.notice, text.empty, `notice differs from empty-state for ${kind}`);
          assert.equal(text.scope, text.empty, `scope differs from empty-state for ${kind}`);
          assert.equal(text.discoveryStatus, text.empty, `discovery-status differs from empty-state for ${kind}`);
          if (text.csp.length > 0) report.cspViolations.push(...text.csp);

          const filename = `discovery-${kind}-${vp.width}-${theme}-${lang}.png`;
          await page.screenshot({ path: path.join(SHOTS, filename) });
          report.captures.push(filename);
          report.sentencesByLang[lang][kind] = text.empty;
          report.rows.push({
            kind,
            width: vp.width,
            theme,
            lang,
            sentence: text.empty,
            screenshot: `screenshots/${filename}`,
          });
        }

        // Verify the 4 sentences for this (width, theme, lang) are distinct.
        const four = KINDS.map((k) => report.rows.find((r) => r.kind === k.kind && r.width === vp.width && r.theme === theme && r.lang === lang)?.sentence);
        assert.equal(new Set(four).size, 4, `expected 4 distinct sentences for ${vp.width}-${theme}-${lang}, got ${JSON.stringify(four)}`);

        await context.close();
      }
    }
  }
} finally {
  await browser.close();
  await board.app.close();
  await fake.close();
}

assert.equal(report.pageErrors.length, 0, `pageErrors: ${report.pageErrors.join('; ')}`);
assert.equal(report.consoleErrors.length, 0, `consoleErrors: ${report.consoleErrors.join('; ')}`);
assert.equal(report.cspViolations.length, 0, `cspViolations: ${report.cspViolations.join('; ')}`);
assert.equal(report.captures.length, 32);

fs.writeFileSync(path.join(HERE, 'report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify({
  rows: report.rows.length,
  captures: report.captures.length,
  pageErrors: report.pageErrors.length,
  consoleErrors: report.consoleErrors.length,
  cspViolations: report.cspViolations.length,
  sentencesByLang: report.sentencesByLang,
}, null, 2));
