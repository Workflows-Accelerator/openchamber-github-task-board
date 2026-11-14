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

// Far enough in the future to stay a real refresh time, and on another day so
// the sentence must carry date context.
const RESET_SECONDS = Math.floor(Date.parse('2030-01-15T10:30:00Z') / 1000);
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
const SHORT = {
  en: { auth: 'GitHub token refused', rate_limited: 'GitHub rate limit', network: 'GitHub unreachable', server: 'Discovery failed' },
  fr: { auth: 'Jeton GitHub refusé', rate_limited: 'Limite GitHub atteinte', network: 'GitHub injoignable', server: 'Découverte échouée' },
};
const AUTH = {
  en: 'The board cannot read GitHub because the token was refused. Someone who holds the token must renew it; refreshing this page will not help.',
  fr: 'Le tableau ne peut pas lire GitHub : le jeton a été refusé. Une personne qui détient le jeton doit le renouveler ; actualiser cette page n’y changera rien.',
};

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
  layoutRows: [],
  languageSwitch: [],
  canvasFailure: null,
  sentencesByLang: { en: {}, fr: {} },
  pageErrors: [],
  consoleErrors: [],
  cspViolations: [],
  captures: [],
};

async function openContext(vp, theme, lang) {
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
  return { context, page };
}

async function triggerFailure(page, mode) {
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
  return mode;
}

try {
  for (const vp of VIEWPORTS) {
    for (const theme of THEMES) {
      for (const lang of LANGS) {
        const { context, page } = await openContext(vp, theme, lang);

        for (const { kind, mode } of KINDS) {
          if (kind === 'rate_limited') fake.setDiscoveryResetAt(RESET_SECONDS);
          fake.setDiscoveryFailure(mode);
          await triggerFailure(page, mode);

          const text = await page.evaluate(() => ({
            empty: document.getElementById('empty-state')?.querySelector('p')?.textContent?.trim() || '',
            notice: document.getElementById('notice')?.textContent?.trim() || '',
            scope: document.getElementById('scope-status')?.textContent?.trim() || '',
            discoveryStatus: document.getElementById('discovery-status')?.textContent?.trim() || '',
            cta: (() => {
              const button = document.getElementById('empty-create');
              return button ? { hidden: button.hidden, disabled: button.disabled } : null;
            })(),
            themeAttr: document.documentElement.getAttribute('data-theme'),
            langAttr: document.documentElement.lang,
            csp: window.__cspViolations || [],
          }));

          assert.equal(text.themeAttr, theme);
          assert.equal(text.langAttr, lang);
          assert.ok(text.empty.length > 0, `empty sentence missing for ${kind}`);
          assert.equal(text.notice, text.empty, `notice differs from empty-state for ${kind}`);
          // The toolbar keeps only the short cause label; the full sentence is
          // never repeated inside .status-strip.
          assert.equal(text.scope, SHORT[lang][kind], `scope is not the short ${kind} label`);
          assert.notEqual(text.scope, text.empty, `scope repeats the full sentence for ${kind}`);
          assert.ok(text.scope.length <= 40, `scope label too long for ${kind}: ${text.scope.length}`);
          assert.equal(text.discoveryStatus, text.empty, `discovery-status differs from empty-state for ${kind}`);
          assert.deepEqual(text.cta, { hidden: true, disabled: true }, `create CTA is still offered for ${kind}`);
          if (kind === 'rate_limited') {
            assert.doesNotMatch(text.empty, /\{time\}/);
            assert.match(text.empty, lang === 'fr' ? /Actualisez après/ : /Refresh after/);
            assert.doesNotMatch(text.empty, /will refresh|s’actualisera/);
          }
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
            scopeLabel: text.scope,
            screenshot: `screenshots/${filename}`,
          });

          if (vp.width === 1280) {
            const layout = await page.evaluate(() => {
              const strip = document.getElementById('status-strip');
              const ids = ['list-group-toggle', 'new-task-btn', 'freshness'];
              const boxes = {};
              for (const id of ids) {
                const rect = document.getElementById(id).getBoundingClientRect();
                boxes[id] = { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
              }
              return {
                clientWidth: strip.clientWidth,
                scrollWidth: strip.scrollWidth,
                viewport: { width: window.innerWidth, height: window.innerHeight },
                boxes,
              };
            });
            assert.ok(layout.scrollWidth <= layout.clientWidth,
              `status-strip overflows at 1280 ${theme}-${lang} ${kind}: ${layout.scrollWidth} > ${layout.clientWidth}`);
            for (const [id, box] of Object.entries(layout.boxes)) {
              assert.ok(box.left >= 0 && box.right <= layout.viewport.width,
                `${id} leaves the 1280 viewport horizontally (${kind}): ${JSON.stringify(box)}`);
              assert.ok(box.top >= 0 && box.bottom <= layout.viewport.height,
                `${id} leaves the 1280 viewport vertically (${kind}): ${JSON.stringify(box)}`);
            }
            report.layoutRows.push({ width: vp.width, theme, lang, kind, ...layout });
          }
        }

        // Verify the 4 sentences for this (width, theme, lang) are distinct.
        const four = KINDS.map((k) => report.rows.find((r) => r.kind === k.kind && r.width === vp.width && r.theme === theme && r.lang === lang)?.sentence);
        assert.equal(new Set(four).size, 4, `expected 4 distinct sentences for ${vp.width}-${theme}-${lang}, got ${JSON.stringify(four)}`);

        // A language switch while the board is null must re-render every surface.
        const other = lang === 'en' ? 'fr' : 'en';
        fake.setDiscoveryFailure('auth');
        await triggerFailure(page, 'auth');
        await page.evaluate((next) => window.__taskBoard.setLanguage(next), other);
        const switched = await page.evaluate(() => ({
          empty: document.getElementById('empty-state')?.querySelector('p')?.textContent?.trim() || '',
          notice: document.getElementById('notice')?.textContent?.trim() || '',
          scope: document.getElementById('scope-status')?.textContent?.trim() || '',
          discoveryStatus: document.getElementById('discovery-status')?.textContent?.trim() || '',
          lang: document.documentElement.lang,
        }));
        assert.equal(switched.lang, other, `document language did not switch to ${other}`);
        assert.equal(switched.empty, AUTH[other], `empty-state did not switch to ${other}`);
        assert.equal(switched.notice, AUTH[other], `notice did not switch to ${other}`);
        assert.equal(switched.scope, SHORT[other].auth, `scope did not switch to ${other}`);
        assert.equal(switched.discoveryStatus, AUTH[other], `discovery-status did not switch to ${other}`);
        report.languageSwitch.push({ width: vp.width, theme, from: lang, to: other, ...switched });

        await context.close();
      }
    }
  }

  // Canvas: a discovery failure must clear the stale cards and show the failure
  // state instead of an empty canvas with clickable leftovers.
  {
    const vp = { width: 1280, height: 900 };
    const { context, page } = await openContext(vp, 'light', 'en');
    await page.evaluate(() => window.__taskBoard.switchView('canvas'));
    await page.waitForFunction(() => document.querySelectorAll('#canvas-cards .canvas-card').length === 1);
    fake.setDiscoveryFailure('auth');
    await triggerFailure(page, 'auth');
    const canvas = await page.evaluate(() => {
      const empty = document.getElementById('empty-state');
      const viewport = document.getElementById('canvas-viewport');
      const cta = document.getElementById('empty-create');
      return {
        cardCount: document.querySelectorAll('#canvas-cards .canvas-card').length,
        wireCount: document.querySelectorAll('#canvas-wires .canvas-wire-group').length,
        emptyHidden: empty ? empty.hidden : null,
        emptyDisplay: empty ? getComputedStyle(empty).display : null,
        viewportDisplay: viewport ? getComputedStyle(viewport).display : null,
        ctaHidden: cta ? cta.hidden : null,
        ctaDisabled: cta ? cta.disabled : null,
      };
    });
    assert.equal(canvas.cardCount, 0, `stale Canvas cards remain: ${canvas.cardCount}`);
    assert.equal(canvas.wireCount, 0, `stale Canvas wires remain: ${canvas.wireCount}`);
    assert.equal(canvas.emptyHidden, false, 'empty-state is hidden in Canvas failure');
    assert.notEqual(canvas.emptyDisplay, 'none', 'empty-state is not displayed in Canvas failure');
    assert.equal(canvas.viewportDisplay, 'none', 'Canvas viewport is still displayed on discovery failure');
    assert.equal(canvas.ctaHidden, true, 'create CTA is still visible in Canvas failure');
    assert.equal(canvas.ctaDisabled, true, 'create CTA is still enabled in Canvas failure');
    await page.screenshot({ path: path.join(SHOTS, 'canvas-discovery-failure-1280.png') });
    report.captures.push('canvas-discovery-failure-1280.png');
    report.canvasFailure = canvas;
    await context.close();
  }
} finally {
  await browser.close();
  await board.app.close();
  await fake.close();
}

assert.equal(report.pageErrors.length, 0, `pageErrors: ${report.pageErrors.join('; ')}`);
assert.equal(report.consoleErrors.length, 0, `consoleErrors: ${report.consoleErrors.join('; ')}`);
assert.equal(report.cspViolations.length, 0, `cspViolations: ${report.cspViolations.join('; ')}`);
assert.equal(report.captures.length, 33);

fs.writeFileSync(path.join(HERE, 'report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify({
  rows: report.rows.length,
  layoutRows: report.layoutRows.length,
  languageSwitch: report.languageSwitch.length,
  canvasFailure: report.canvasFailure,
  captures: report.captures.length,
  pageErrors: report.pageErrors.length,
  consoleErrors: report.consoleErrors.length,
  cspViolations: report.cspViolations.length,
  sentencesByLang: report.sentencesByLang,
}, null, 2));
