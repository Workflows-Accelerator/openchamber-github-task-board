// hostile4 (independent rerun, copied from fix4/scripts/undo-visible.mjs and extended): Undo-arrange-visible HUD recheck against the frozen staged 59e5d05 bundle.
// Launches a throwaway copy of the staged server (unmodified bundle, cwd = staged release dir) on
// port 4051 with a synthetic fake GitHub, so the running :4041 preview state is not mutated.
// Verdicts are computed from measured DOM rects; no literal verdicts.
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { startFakeGitHub, makeIssue } from '../../../../../../../web/tests/fake-github.mjs';
import { BOARD_PASSWORD, SESSION_SECRET } from '../../../../../../../web/tests/helpers.mjs';

let pkg;
try {
  pkg = await import('/workspace/personal/lucas/charme-social/node_modules/playwright/index.js');
} catch {
  pkg = await import('playwright');
}
const { chromium } = pkg.default || pkg;

const OUT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const SHOTS = path.join(OUT, 'screenshots');
fs.mkdirSync(SHOTS, { recursive: true });
const releaseDir = '/tmp/opencode/board-v2-staging/59e5d05-foundation';
const stateDir = fs.mkdtempSync('/tmp/opencode/hostile4-undo-');
const port = Number(process.env.UNDO_PORT || 4061);
const url = `http://127.0.0.1:${port}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const noteMarker = '<!-- board-canvas: {"x":140,"y":120,"notes":[{"id":"note-1","x":160,"y":290,"w":230,"h":130,"text":"**Architecture Note**","color":"yellow"}]} -->';
const fake = await startFakeGitHub({
  repositories: [
    { repo: 'owner/repo', id: 1, issues: [
      makeIssue({ number: 1, repo: 'owner/repo', title: 'Deploy edge authentication middleware', body: '## Overview\nx\n\n' + noteMarker, labels: ['status:needs-human', 'priority:high'] }),
      makeIssue({ number: 2, repo: 'owner/repo', title: 'Audit canvas layout and dependency wires', body: '<!-- board-canvas: {"x":540,"y":120} -->\n## Overview\nx', labels: ['status:in-progress'] }),
      makeIssue({ number: 3, repo: 'owner/repo', title: 'Draft internal telemetry spike', body: '## Overview\nx', labels: ['status:draft'] }),
      makeIssue({ number: 5, repo: 'owner/repo', title: 'Cut over edge routing table', body: '## Overview\nx', labels: ['status:todo'] }),
    ] },
    { repo: 'owner/other-repo', id: 2, issues: [
      makeIssue({ number: 10, repo: 'owner/other-repo', title: 'Publish upstream identity schema v2', body: '<!-- board-canvas: {"x":140,"y":480} -->\n## Overview\nx', labels: ['status:in-progress'] }),
      makeIssue({ number: 11, repo: 'owner/other-repo', title: 'Consumer SDK migration guide', body: '## Overview\nx', labels: ['status:todo'] }),
    ] },
  ],
});
fake.addDependency(2, 1, 'owner/repo', 'owner/repo');
fake.addDependency(5, 1, 'owner/repo', 'owner/repo');
fake.addDependency(11, 10, 'owner/other-repo', 'owner/other-repo');

const preloadFile = path.join(stateDir, 'preload.mjs');
fs.writeFileSync(preloadFile, [
  `const targetBase = ${JSON.stringify(fake.url)};`,
  `const origFetch = globalThis.fetch;`,
  `globalThis.fetch = function (input, init) {`,
  `  if (typeof input === 'string' && input.startsWith('https://api.github.com')) input = targetBase + input.slice('https://api.github.com'.length);`,
  `  else if (input && typeof input === 'object' && typeof input.url === 'string' && input.url.startsWith('https://api.github.com')) input = new Request(targetBase + input.url.slice('https://api.github.com'.length), input);`,
  `  return origFetch.call(this, input, init);`,
  `};`,
].join('\n'));

const serverLog = fs.createWriteStream(path.join(stateDir, 'server.log'));
const child = spawn(process.execPath, ['--import', preloadFile, 'web/dist/server.mjs'], {
  cwd: releaseDir,
  env: {
    PATH: process.env.PATH, HOME: stateDir,
    BOARD_GITHUB_TOKEN: fake.token, BOARD_GITHUB_LOGIN: fake.login, BOARD_REPO: 'owner/repo',
    BOARD_PASSWORD, BOARD_SESSION_SECRET: SESSION_SECRET,
    BOARD_SESSION_FILE: path.join(stateDir, 'sessions.json'),
    BOARD_PORT: String(port), BOARD_HOST: '127.0.0.1', BOARD_BASE_URL: url,
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});
child.stdout.pipe(serverLog);
child.stderr.pipe(serverLog);

let exitCode = 1;
let browser;
try {
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(`${url}/health`)).ok) break; } catch {}
    await sleep(100);
  }
  const health = await (await fetch(`${url}/health`)).json();

  browser = await chromium.launch({ executablePath: process.env.H2_CHROME, headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block' });
  const page = await context.newPage();
  const exceptions = [];
  const consoleErrors = [];
  page.on('pageerror', (e) => exceptions.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  const waitFor = async (expr, label, timeout = 15000) => {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      try { if (await page.evaluate(`Boolean(${expr})`)) return; } catch {}
      await sleep(100);
    }
    throw new Error(`Timeout waiting for ${label}`);
  };

  await page.goto(url);
  await waitFor('document.getElementById("login-form")', 'login form');
  await page.fill('#password', BOARD_PASSWORD);
  await page.evaluate(() => document.getElementById('login-form').requestSubmit());
  await waitFor('!document.getElementById("board-view")?.hidden', 'board view');
  await waitFor('window.__taskBoard?.state?.board?.issues?.length >= 6', 'board loaded');
  await page.evaluate(() => document.getElementById('nav-canvas').click());
  await waitFor('document.querySelectorAll(".canvas-card").length >= 6', 'canvas cards');

  // Trigger Arrange through the real UI controls.
  await page.click('#canvas-arrange');
  await waitFor('!document.getElementById("canvas-arrange-dialog").hidden', 'arrange dialog');
  await page.check('#arrange-scope-all');
  await page.click('#arrange-confirm-btn');
  await waitFor('!document.getElementById("canvas-arrange-undo").hidden', 'Undo arrange visible');
  await waitFor('document.getElementById("canvas-arrange-dialog").hidden', 'arrange dialog closed', 8000);
  const arrangeSummary = await page.evaluate(() => document.getElementById('arrange-summary')?.textContent || '');

  const matrix = [
    { width: 360, height: 800, theme: 'light', lang: 'fr' },
    { width: 360, height: 800, theme: 'dark', lang: 'fr' },
    { width: 1280, height: 900, theme: 'light', lang: 'fr' },
    { width: 1280, height: 900, theme: 'dark', lang: 'fr' },
  ];
  const cases = [];
  for (const c of matrix) {
    await page.setViewportSize({ width: c.width, height: c.height });
    await sleep(150);
    await page.evaluate((t) => window.__taskBoard.setThemeMode(t), c.theme);
    await page.evaluate((l) => {
      if ((localStorage.getItem('tb_lang') || 'en') !== l) document.getElementById('lang-switch-btn').click();
    }, c.lang);
    await sleep(200);
    await page.evaluate(() => { const b = document.getElementById('sidebar-backdrop'); if (b && !b.hidden) b.click(); });
    await sleep(250);
    const m = await page.evaluate(() => {
      const r1 = (n) => Math.round(n * 10) / 10;
      const vp = document.getElementById('canvas-viewport').getBoundingClientRect();
      const buttons = Array.from(document.querySelectorAll('#canvas-controls .canvas-control-btn')).filter((b) => !b.hidden).map((b) => {
        const r = b.getBoundingClientRect();
        return { id: b.id, text: b.textContent.trim(), left: r1(r.left), right: r1(r.right), top: r1(r.top), bottom: r1(r.bottom), width: r1(r.width), height: r1(r.height) };
      });
      return {
        lang: document.documentElement.lang, theme: document.documentElement.getAttribute('data-theme'),
        viewport: { left: r1(vp.left), right: r1(vp.right), top: r1(vp.top), bottom: r1(vp.bottom) },
        window: { width: window.innerWidth, height: window.innerHeight },
        documentOverflow: document.documentElement.scrollWidth > window.innerWidth,
        buttons,
      };
    });
    const vp = m.viewport;
    const undo = m.buttons.find((b) => b.id === 'canvas-arrange-undo');
    const outside = m.buttons.filter((b) => b.width > 0 && (b.left < vp.left - 0.5 || b.right > vp.right + 0.5 || b.top < vp.top - 0.5 || b.bottom > vp.bottom + 0.5)).map((b) => b.id);
    const overlaps = [];
    for (let i = 0; i < m.buttons.length; i++) {
      for (let j = i + 1; j < m.buttons.length; j++) {
        const a = m.buttons[i];
        const b = m.buttons[j];
        if (a.width > 0 && b.width > 0 && a.left < b.right - 0.5 && a.right > b.left + 0.5 && a.top < b.bottom - 0.5 && a.bottom > b.top + 0.5) overlaps.push(`${a.id} & ${b.id}`);
      }
    }
    const undoVisible = Boolean(undo && undo.width > 0 && undo.height > 0);
    const arrange = m.buttons.find((b) => b.id === 'canvas-arrange');
    const sameRow = Boolean(arrange && undo && Math.abs(arrange.top - undo.top) < 1);
    const arrangeUndoGap = sameRow ? Math.round((undo.left - arrange.right) * 10) / 10 : null;
    const hudBox = await page.evaluate(() => { const r = document.getElementById('canvas-controls').getBoundingClientRect(); return { x: r.left, y: r.top, width: r.width, height: r.height }; });
    const crop = `hud-crop-${c.width}-${c.theme}-${c.lang}.png`;
    await page.screenshot({ path: path.join(SHOTS, crop), clip: { x: Math.max(0, hudBox.x - 8), y: Math.max(0, hudBox.y - 8), width: Math.min(c.width - Math.max(0, hudBox.x - 8), hudBox.width + 16), height: hudBox.height + 16 }, scale: 'device' });
    const shot = `undo-visible-${c.width}-${c.theme}-${c.lang}.png`;
    await page.screenshot({ path: path.join(SHOTS, shot) });
    const pass = undoVisible && outside.length === 0 && overlaps.length === 0 && !m.documentOverflow;
    cases.push({ testCase: c, undoVisible, undoText: undo?.text, outsideViewport: outside, overlaps, sameRow, arrangeUndoGap, pass, screenshot: `hostile4/screenshots/${shot}`, crop: `hostile4/screenshots/${crop}`, metrics: m });
    console.log(`${c.width} ${c.theme} ${c.lang}: undoVisible=${undoVisible} outside=${JSON.stringify(outside)} overlaps=${JSON.stringify(overlaps)} gap=${arrangeUndoGap} pass=${pass}`);
  }
  const diagnosticsClean = exceptions.length === 0 && consoleErrors.length === 0;
  const allPass = cases.every((x) => x.pass) && diagnosticsClean;
  fs.writeFileSync(path.join(OUT, 'undo-visible.json'), JSON.stringify({
    timestamp: new Date().toISOString(), server: { url, releaseDir, health, stateDir }, arrangeSummary,
    exceptions, consoleErrors, diagnosticsClean, allPass, cases,
  }, null, 2) + '\n');
  console.log(`arrangeSummary="${arrangeSummary}" diagnosticsClean=${diagnosticsClean} allPass=${allPass}`);
  exitCode = allPass ? 0 : 1;
} finally {
  if (browser) await browser.close();
  child.kill('SIGTERM');
  await fake.close().catch(() => {});
}
process.exit(exitCode);
