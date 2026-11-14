// Independent L4 hostile verification probe (synthetic fixtures only; zero source edits).
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startFakeGitHub, makeIssue } from '../../../../../web/tests/fake-github.mjs';
import { startBoard, BOARD_PASSWORD, browserConfig, HttpSession, SYNTHETIC_TOKEN } from '../../../../../web/tests/helpers.mjs';

const { chromium } = (await import('/workspace/personal/lucas/charme-social/node_modules/playwright/index.js')).default;

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SHOTS = path.join(HERE, 'screenshots');
fs.mkdirSync(SHOTS, { recursive: true });

const results = {};

// --- Probe 1: API classification, reset honesty, ETag, and route parity ---
{
  const fake = await startFakeGitHub({
    token: SYNTHETIC_TOKEN,
    repositories: [
      {
        repo: 'owner/alpha',
        id: 101,
        issues: [makeIssue({ number: 1, title: 'Alpha one', body: '## Overview\n\nAlpha\n', labels: ['status:todo'] })],
      },
    ],
  });
  const board = await startBoard(fake, { repositoryTtlMs: 60_000, config: browserConfig(fake) });
  const client = new HttpSession(board.url);
  await client.login();

  try {
    const warm = await client.request('/api/repos');
    const warmEtag = warm.headers.get('etag');

    // 1a. 403 forbidden (PAT scope / SSO refusal without rate-limit headers)
    fake.setDiscoveryResponse(403, { message: 'Resource not accessible by personal access token' });
    const forbidden = await client.request('/api/repos?refresh=1');
    const forbiddenEtag = forbidden.headers.get('etag');
    const forbidden304Check = await client.request('/api/repos', {
      headers: { 'if-none-match': warmEtag },
    });
    results.forbidden403 = {
      status: forbidden.status,
      discoveryFailed: forbidden.json.discoveryFailed,
      errorKind: forbidden.json.errorKind,
      errorReason: forbidden.json.errorReason,
      warmEtag,
      forbiddenEtag,
      warmEtagStale304Prevented: forbidden304Check.status === 200 && forbidden304Check.json.errorKind === 'server',
    };

    // 1b. Single-repo /api/repos/owner/alpha/board?refresh=1 after GitHub recovers while 60s latch is active
    fake.setDiscoveryResponse(null);
    const singleBoardRefreshWhileLatched = await client.request('/api/repos/owner/alpha/board?refresh=1');
    const issueDetailWhileLatched = await client.request('/api/repos/owner/alpha/issues/1');
    const combinedOpsWhileLatched = await client.request('/api/combined/operations');
    const combinedArchiveWhileLatched = await client.request('/api/combined/archive');
    results.latchedRoutes = {
      singleBoardRefreshWhileLatched: {
        status: singleBoardRefreshWhileLatched.status,
        body: singleBoardRefreshWhileLatched.json,
      },
      issueDetailWhileLatched: {
        status: issueDetailWhileLatched.status,
        body: issueDetailWhileLatched.json,
      },
      combinedOpsWhileLatched: {
        status: combinedOpsWhileLatched.status,
        body: combinedOpsWhileLatched.json,
      },
      combinedArchiveWhileLatched: {
        status: combinedArchiveWhileLatched.status,
        body: combinedArchiveWhileLatched.json,
      },
    };

    // Clear latch via /api/repos?refresh=1 and verify ETag changes back
    const recovered = await client.request('/api/repos?refresh=1');
    const recoveredWithForbiddenEtag = await client.request('/api/repos', {
      headers: { 'if-none-match': forbiddenEtag },
    });
    results.etagRecovery = {
      recoveredDiscoveryFailed: recovered.json.discoveryFailed,
      recoveredErrorKind: recovered.json.errorKind,
      staleErrorEtagPrevented: recoveredWithForbiddenEtag.status === 200 && recoveredWithForbiddenEtag.json.errorKind === null,
    };

    // 1d. reset = 1 (1970-01-01T00:00:01.000Z) and reset = +30h (other day)
    fake.setDiscoveryFailure('rate_limited');
    fake.setDiscoveryResetAt(1);
    const epoch1 = await client.request('/api/repos?refresh=1');
    const plus30h = Math.floor(Date.now() / 1000) + 30 * 3600;
    fake.setDiscoveryResetAt(plus30h);
    const nextDay = await client.request('/api/repos?refresh=1');
    results.resetEdgeCases = {
      epoch1ResetAt: epoch1.json.errorResetAt,
      plus30hResetAt: nextDay.json.errorResetAt,
    };
  } finally {
    await board.app.close();
    await fake.close();
  }
}

// --- Probe 1e: Non-JSON 401/429 upstream gateway responses + headerless secondary 403 leaking stale past reset ---
{
  let mode = 'user_ok';
  const pastEpochSeconds = Math.floor(Date.parse('2026-11-14T01:05:00Z') / 1000);
  const rawServer = http.createServer((req, res) => {
    if (req.url?.startsWith('/user') && !req.url.startsWith('/user/repos')) {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ login: 'board-owner' }));
      return;
    }
    if (mode === 'seed_past_reset') {
      res.writeHead(200, {
        'content-type': 'application/json',
        'x-ratelimit-limit': '5000',
        'x-ratelimit-remaining': '4999',
        'x-ratelimit-reset': String(pastEpochSeconds),
        'x-ratelimit-resource': 'graphql',
      });
      res.end('[]');
      return;
    }
    if (mode === 'headerless_secondary_403') {
      res.writeHead(403, { 'content-type': 'application/json', 'retry-after': '60' });
      res.end(JSON.stringify({ message: 'You have exceeded a secondary rate limit. Please wait a few minutes before you try again.' }));
      return;
    }
    if (mode === 'html_401') {
      res.writeHead(401, { 'content-type': 'text/html' });
      res.end('<html><body>401 Unauthorized</body></html>');
      return;
    }
    if (mode === 'text_429') {
      res.writeHead(429, { 'content-type': 'text/plain', 'x-ratelimit-remaining': '0' });
      res.end('Too Many Requests');
      return;
    }
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end('[]');
  });
  await new Promise((r) => rawServer.listen(0, '127.0.0.1', r));
  const addr = rawServer.address();
  const fakeLike = { url: `http://127.0.0.1:${addr.port}`, token: SYNTHETIC_TOKEN, repo: 'owner/alpha', login: 'board-owner' };
  const board = await startBoard(fakeLike, { repositoryTtlMs: 0, config: browserConfig(fakeLike) });
  const client = new HttpSession(board.url);
  await client.login();
  try {
    mode = 'seed_past_reset';
    await client.request('/api/repos?refresh=1');
    mode = 'headerless_secondary_403';
    const sec403 = await client.request('/api/repos?refresh=1');
    results.secondaryRateLimitStaleReset = {
      errorKind: sec403.json.errorKind,
      errorResetAt: sec403.json.errorResetAt,
      leakedPastGraphqlResetIso: new Date(pastEpochSeconds * 1000).toISOString(),
    };
    mode = 'html_401';
    const r401 = await client.request('/api/repos?refresh=1');
    mode = 'text_429';
    const r429 = await client.request('/api/repos?refresh=1');
    results.nonJsonUpstream = {
      html401ErrorKind: r401.json.errorKind,
      text429ErrorKind: r429.json.errorKind,
    };
  } finally {
    await board.app.close();
    await new Promise((r) => rawServer.close(r));
  }
}

// --- Probe 2: Real Chromium layout, Canvas stale cards, drawer/mutation/i18n ---
{
  const fake = await startFakeGitHub({
    token: SYNTHETIC_TOKEN,
    repositories: [
      {
        repo: 'owner/alpha',
        id: 101,
        issues: [
          makeIssue({
            number: 1,
            title: 'Alpha card still visible on canvas',
            body: '## Overview\n\nAlpha body\n\n## Open Questions\n\n- [ ] Keep stale card?\n',
            labels: ['status:todo'],
          }),
        ],
      },
    ],
  });
  const board = await startBoard(fake, { repositoryTtlMs: 60_000, config: browserConfig(fake) });
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.H2_CHROME,
    args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
  });

  try {
    // 2a. 1280x900 status-strip overflow + triple repetition + empty-state contradiction + language toggle stale text
    const ctx1 = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await ctx1.addInitScript(() => {
      localStorage.setItem('tb_theme', 'light');
      localStorage.setItem('tb_lang', 'en');
      localStorage.setItem('tb_active_view', 'list');
    });
    const page1 = await ctx1.newPage();
    await page1.goto(board.url, { waitUntil: 'networkidle' });
    await page1.fill('#password', BOARD_PASSWORD);
    await page1.click('#login-form button[type="submit"]');
    await page1.waitForFunction(() => Boolean(window.__taskBoard?.state?.csrf && window.__taskBoard?.state?.board));

    // Before refreshing the board, latch auth failure on the server via ?refresh=1 in a side session so we can also test opening the drawer on an existing card!
    const side = new HttpSession(board.url);
    await side.login();
    fake.setDiscoveryFailure('auth');
    await side.request('/api/repos?refresh=1');

    // Click existing task row #1 while discovery is latched as 'auth' -> triggers openIssue()
    await page1.click('.task-row');
    await page1.waitForTimeout(300);
    const drawerFailureNotice = await page1.evaluate(() => ({
      notice: document.getElementById('notice')?.textContent?.trim() || '',
      detailOpen: !document.getElementById('detail-dialog')?.hidden,
    }));

    // Try creating a task via composer while discovery is latched as 'auth' in FR
    await page1.evaluate(() => {
      localStorage.setItem('tb_lang', 'fr');
      document.documentElement.lang = 'fr';
    });
    const mutationErrorInFr = await page1.evaluate(async () => {
      try {
        await fetch('/api/repos/owner/alpha/issues', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-csrf-token': window.__taskBoard.state.csrf,
          },
          body: JSON.stringify({ title: 'Probe task' }),
        });
      } catch {}
      // Use the board's own quick-add form to trigger app.js api() mutation path
      const input = document.getElementById('quick-add-input');
      const form = document.getElementById('quick-add-form');
      if (!input || !form) return null;
      window.__taskBoard.state.selected = 'owner/alpha';
      input.value = 'Probe task';
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await new Promise((r) => setTimeout(r, 300));
      return document.getElementById('notice')?.textContent?.trim() || '';
    });

    // Reset to EN and trigger loadBoard(true) on auth failure at 1280x900
    await page1.evaluate(() => {
      window.__taskBoard.state.selected = 'all';
      localStorage.setItem('tb_lang', 'en');
    });
    await page1.click('#refresh-btn');
    await page1.waitForFunction(() => !document.getElementById('empty-state')?.hidden);

    const layout1280 = await page1.evaluate(() => {
      const strip = document.querySelector('.status-strip');
      const rectOf = (id) => {
        const el = document.getElementById(id);
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { left: Math.round(r.left), right: Math.round(r.right), width: Math.round(r.width), hidden: el.hidden };
      };
      return {
        viewportWidth: window.innerWidth,
        stripClientWidth: strip?.clientWidth,
        stripScrollWidth: strip?.scrollWidth,
        overflowPx: (strip?.scrollWidth || 0) - (strip?.clientWidth || 0),
        notice: document.getElementById('notice')?.textContent?.trim(),
        scopeStatus: document.getElementById('scope-status')?.textContent?.trim(),
        emptyP: document.getElementById('empty-state')?.querySelector('p')?.textContent?.trim(),
        emptyHint: document.getElementById('empty-state')?.querySelector('.empty-hint')?.textContent?.trim(),
        emptyCreateDisabled: document.getElementById('empty-create')?.disabled,
        emptyCreateHidden: document.getElementById('empty-create')?.hidden,
        rects: {
          scopeStatus: rectOf('scope-status'),
          listGroupToggle: rectOf('list-group-toggle'),
          newTaskBtn: rectOf('new-task-btn'),
          freshness: rectOf('freshness'),
        },
      };
    });

    // Now switch language EN -> FR via Settings sheet while on the failed discovery screen!
    await page1.click('#settings-btn');
    await page1.waitForTimeout(150);
    await page1.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const frBtn = btns.find((b) => b.textContent?.trim() === 'Français');
      if (frBtn) frBtn.click();
    });
    await page1.waitForTimeout(200);
    await page1.keyboard.press('Escape');
    await page1.waitForTimeout(100);
    const afterLangSwitchToFr = await page1.evaluate(() => ({
      docLang: document.documentElement.lang,
      emptyCreateBtnText: document.getElementById('empty-create')?.textContent?.trim(),
      noticeText: document.getElementById('notice')?.textContent?.trim(),
      scopeStatusText: document.getElementById('scope-status')?.textContent?.trim(),
      emptyPText: document.getElementById('empty-state')?.querySelector('p')?.textContent?.trim(),
      discoveryStatusText: document.getElementById('discovery-status')?.textContent?.trim(),
    }));
    await page1.screenshot({ path: path.join(SHOTS, 'lang-switch-stale-en-in-fr-1280.png') });
    await ctx1.close();

    // 2b. Canvas mode: load healthy board in Canvas mode, then fail discovery and click refresh
    fake.setDiscoveryFailure(false);
    await side.request('/api/repos?refresh=1');

    const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await ctx2.addInitScript(() => {
      localStorage.setItem('tb_theme', 'dark');
      localStorage.setItem('tb_lang', 'en');
      localStorage.setItem('tb_active_view', 'canvas');
    });
    const page2 = await ctx2.newPage();
    await page2.goto(board.url, { waitUntil: 'networkidle' });
    await page2.fill('#password', BOARD_PASSWORD);
    await page2.click('#login-form button[type="submit"]');
    await page2.waitForFunction(() => document.querySelectorAll('#canvas-cards .canvas-card').length === 1);

    fake.setDiscoveryFailure('auth');
    await page2.click('#refresh-btn');
    await page2.waitForFunction(() => window.__taskBoard?.state?.board === null && !document.getElementById('refresh-btn').disabled);
    await page2.waitForTimeout(150);

    const canvasOnFailure = await page2.evaluate(() => {
      const empty = document.getElementById('empty-state');
      const cards = Array.from(document.querySelectorAll('#canvas-cards .canvas-card'));
      return {
        boardStateIsNull: window.__taskBoard.state.board === null,
        boardViewClass: document.getElementById('board-view')?.className,
        emptyHiddenAttr: empty?.hidden,
        emptyComputedDisplay: empty ? getComputedStyle(empty).display : null,
        staleCanvasCardCount: cards.length,
        staleCanvasCardTitles: cards.map((c) => c.textContent?.trim().slice(0, 80)),
      };
    });
    await page2.screenshot({ path: path.join(SHOTS, 'canvas-stale-cards-on-auth-failure-1280.png') });
    await ctx2.close();

    results.browser = {
      drawerFailureNotice,
      mutationErrorInFr,
      layout1280,
      afterLangSwitchToFr,
      canvasOnFailure,
    };
  } finally {
    await browser.close();
    await board.app.close();
    await fake.close();
  }
}

fs.writeFileSync(path.join(HERE, 'probe-results.json'), JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
