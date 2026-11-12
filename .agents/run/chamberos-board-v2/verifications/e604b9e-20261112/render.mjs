// Renders the LIVE production client assets with a synthetic, local fixture API.
//
// Why: production is private. The brief forbids signing in against production,
// so the authenticated views cannot be opened on real data. This script loads
// https://board.workflows.ac/ (the deployed index.html/app.js/theme.css), and
// intercepts only /api/** in the browser, answering reads from a throwaway local
// board backed by the synthetic GitHub fake. No session is created against
// production, no production or GitHub write is issued, and non-GET API calls are
// refused locally so the render cannot mutate anything.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startFakeGitHub, makeIssue } from '../../../../../web/tests/fake-github.mjs';
import { startBoard, BOARD_PASSWORD } from '../../../../../web/tests/helpers.mjs';
import { buildNoteCommentBody } from '../../../../../web/server/board.ts';

let pkg;
try { pkg = await import('/workspace/personal/lucas/charme-social/node_modules/playwright/index.js'); }
catch { pkg = await import('playwright'); }
const { chromium } = pkg.default || pkg;

const OUT = path.dirname(fileURLToPath(import.meta.url));
const ORIGIN = 'https://board.workflows.ac';
const SHOTS = path.join(OUT, 'screenshots');
fs.mkdirSync(SHOTS, { recursive: true });

const body = [
  '<!-- board-canvas: {"x":80,"y":90,"notes":[{"id":"sticky","x":80,"y":350,"w":240,"h":120,"text":"Canvas planning only","color":"yellow"}]} -->',
  '## Overview', 'Choose durable storage for the audit trail.', '', '## Open Questions',
  '- [ ] ### Choose **storage** with `history` and [retention](https://example.com/retention)?',
  '  - PostgreSQL :: Mature and familiar :: **Operations stay unchanged** with `pg_dump`.',
  '  - SQLite :: Zero operations :: Read the [limits](https://example.com/limits) before choosing.',
  '- [ ] - Review **retention** before answering?',
  '- [ ] Which **owner** approves rollout? (Anne | Lucas)',
  '- [ ] Choose a **rollout** approach?',
  '  - Staged :: Review first :: **Verify** before rollout.',
  '  - Immediate :: Start now :: Review `risk` first.',
].join('\n');

const fake = await startFakeGitHub({ honorIfNoneMatch: true, issues: [
  makeIssue({ number: 1, title: 'Choose durable audit storage', body, labels: ['status:needs-human', 'priority:high'] }),
  makeIssue({ number: 2, title: 'Review operations', body: '<!-- board-canvas: {"x":520,"y":90} -->\n## Overview\nVerify the audit trail.', labels: ['status:todo'] }),
  makeIssue({ number: 3, title: 'Capacity boundary', body: '<!-- board-canvas: {"x":2400,"y":1200} -->\n## Overview\nTest readable framing.', labels: ['status:in-progress'] }),
], comments: { 1: [{ body: buildNoteCommentBody('Keep the **audit trail** unchanged.\n\n- Preserve `history`\n- Review [retention](https://example.com/retention)'), user: 'reviewer' }], 2: [{ body: 'A human comment that is not an agent note.' }] } });
fake.addDependency(2, 1);
fake.addDependency(3, 2);
const board = await startBoard(fake);

// Local session only: this cookie never leaves the process and is never sent to production.
const login = await fetch(board.url + '/api/session', {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ password: BOARD_PASSWORD }),
});
if (login.status !== 200) throw new Error('local login failed ' + login.status);
const cookie = (login.headers.getSetCookie?.() ?? [login.headers.get('set-cookie')]).map((c) => c.split(';')[0]).join('; ');
const sessionBody = await (await fetch(board.url + '/api/session', { headers: { cookie } })).json();

const report = { origin: ORIGIN, clientAssets: 'live production origin', apiData: 'synthetic local fixture (no production sign-in, no writes)', viewports: [] };
const browser = await chromium.launch({
  executablePath: '/workspace/.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell',
  headless: true, args: ['--no-sandbox'],
});

for (const [width, height] of [[390, 844], [1280, 900]]) {
  const label = `${width}x${height}`;
  const row = { viewport: label, consoleErrors: [], pageErrors: [], csp: [], shots: [], apiCalls: [], mutationsRefused: 0 };
  const context = await browser.newContext({ viewport: { width, height }, serviceWorkers: 'block', reducedMotion: 'reduce' });
  await context.addInitScript(() => {
    window.__csp = [];
    window.addEventListener('securitypolicyviolation', (e) => window.__csp.push(e.violatedDirective + ' ' + (e.blockedURI || '')));
  });
  const page = await context.newPage();
  page.on('pageerror', (e) => row.pageErrors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') row.consoleErrors.push(m.text()); });

  await page.route(ORIGIN + '/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() === 'GET' && url.pathname === '/api/session') {
      row.apiCalls.push('GET /api/session (fixture)');
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(sessionBody) });
    }
    if (request.method() !== 'GET') {
      row.mutationsRefused += 1;
      return route.fulfill({ status: 405, contentType: 'application/json', body: JSON.stringify({ error: 'smoke_read_only', message: 'Smoke refuses writes' }) });
    }
    row.apiCalls.push('GET ' + url.pathname + url.search);
    const upstream = await fetch(board.url + url.pathname + url.search, { headers: { cookie } });
    const buffer = Buffer.from(await upstream.arrayBuffer());
    return route.fulfill({ status: upstream.status, contentType: upstream.headers.get('content-type') || 'application/json', body: buffer });
  });

  const pageResponse = await page.goto(ORIGIN + '/', { waitUntil: 'networkidle' });
  row.pageStatus = pageResponse.status();
  row.servedAppHeader = pageResponse.headers()['content-security-policy'] ? 'csp-present' : 'csp-missing';
  await page.waitForFunction(() => window.__taskBoard?.state?.board?.issues?.length === 3, null, { timeout: 20000 });
  const shot = async (name) => {
    const file = `screenshots/rendered-synthetic-${name}-${label}.png`;
    await page.screenshot({ path: path.join(OUT, file) });
    row.shots.push(file);
  };

  // list
  await page.evaluate(() => document.getElementById('nav-list').click());
  await page.waitForSelector('#board-view:not([hidden])');
  await page.waitForTimeout(400);
  row.list = await page.evaluate(() => ({
    viewVisible: !document.getElementById('board-view').hidden,
    canvasHidden: document.getElementById('canvas-viewport').hidden,
    cards: document.querySelectorAll('#board-list .card, #board-list [data-issue]').length,
  }));
  await shot('list');
  // canvas + measure the framing surface
  await page.evaluate(() => document.getElementById('nav-canvas').click());
  await page.waitForSelector('#canvas-viewport:not([hidden])');
  await page.waitForTimeout(500);
  row.canvas = await page.evaluate(() => {
    const el = document.getElementById('canvas-viewport');
    const board = document.querySelector('.canvas-board, #canvas-board, .canvas-surface, #canvas-surface');
    return { viewVisible: !el.hidden, boardBox: board ? board.getBoundingClientRect().toJSON() : null };
  });
  await shot('canvas');
  // drawer
  await page.evaluate(() => window.__taskBoard.openIssue(1));
  await page.waitForFunction(() => window.__taskBoard.state.detail?.number === 1 && !document.getElementById('detail-view').hidden);
  await page.waitForTimeout(300);
  row.drawer = await page.evaluate(() => ({
    title: document.getElementById('detail-title')?.textContent?.trim() || null,
    noteComposer: !!document.getElementById('agent-note-composer'),
    optionCards: document.querySelectorAll('.question-option-card').length,
    decisions: document.querySelectorAll('[data-question-option], .question-option-card').length,
  }));
  await shot('drawer');
  // decisions
  await page.evaluate(() => document.getElementById('nav-decisions').click());
  await page.waitForSelector('#decisions-view:not([hidden])');
  await page.waitForTimeout(500);
  row.decisions = await page.evaluate(() => ({
    viewVisible: !document.getElementById('decisions-view').hidden,
    count: document.querySelectorAll('#decisions-list .decision-row, #decisions-list article, #decisions-list li').length,
    text: (document.getElementById('decisions-list')?.innerText || '').slice(0, 200),
  }));
  await shot('decisions');

  row.csp = await page.evaluate(() => window.__csp);
  report.viewports.push(row);
  await context.close();
}

await browser.close();
await board.app.close();
await fake.close?.();
fs.writeFileSync(path.join(OUT, 'browser-render.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
