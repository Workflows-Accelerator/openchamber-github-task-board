import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import { startFakeGitHub, makeIssue } from '../../../../web/tests/fake-github.mjs';
import { startBoard, BOARD_PASSWORD } from '../../../../web/tests/helpers.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(HERE, '../../../..');
const RUN_DIR = path.resolve(HERE, '..');
const SCREENSHOTS_DIR = path.join(RUN_DIR, 'screenshots');
fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

const CDP_PORT = Number(process.env.OBS_CDP_PORT || 9360);

function findPlaywright() {
  const candidates = [
    process.env.PLAYWRIGHT_PATH,
    '/workspace/.npm/_npx/e41f203b7505f1fb/node_modules/playwright-core/index.mjs',
    '/workspace/.npm/_npx/a1722018f28f9df2/node_modules/playwright-core/index.mjs',
    '/workspace/.npm/_npx/e78b33305587cb7c/node_modules/playwright-core/index.mjs',
  ];
  for (const c of candidates) {
    if (c && fs.existsSync(c)) return c;
  }
  const npxDir = '/workspace/.npm/_npx';
  if (fs.existsSync(npxDir)) {
    for (const d of fs.readdirSync(npxDir)) {
      const p = path.join(npxDir, d, 'node_modules/playwright-core/index.mjs');
      if (fs.existsSync(p)) return p;
    }
  }
  throw new Error('playwright-core not found');
}

async function ensureObscura() {
  const versionUrl = `http://127.0.0.1:${CDP_PORT}/json/version`;
  try {
    const res = await fetch(versionUrl);
    if (res.ok) {
      console.log('Obscura is running on port', CDP_PORT);
      return { child: null };
    }
  } catch {}

  console.log('Starting Obscura CDP server on port', CDP_PORT);
  const child = spawn('obscura', ['serve', '--port', String(CDP_PORT), '--allow-file-access', '--allow-private-network'], {
    stdio: 'ignore',
    detached: true,
  });
  child.unref();

  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 200));
    try {
      const res = await fetch(versionUrl);
      if (res.ok) {
        console.log('Obscura started successfully.');
        return { child };
      }
    } catch {}
  }
  throw new Error('Obscura failed to start on port ' + CDP_PORT);
}

const mockIssues = [
  makeIssue({
    number: 54,
    title: 'Never flash sign-in on reload when already signed in',
    body: '## Overview\nIssue 54 verification task.\n\n## Acceptance Criteria\n- [ ] No flash on reload\n',
    state: 'open',
    labels: [
      { name: 'status:in-progress', color: '3b82f6' },
      { name: 'priority:high', color: 'ef4444' },
      { name: 'theme:web', color: '8b5cf6' },
    ],
    user: 'board-owner',
    repo: 'Workflows-Accelerator/openchamber-github-task-board',
  }),
  makeIssue({
    number: 53,
    title: 'Align online board visual styling with OpenChamber panel',
    body: '## Overview\nIssue 53 visual parity.\n',
    state: 'open',
    labels: [
      { name: 'status:todo', color: '3b82f6' },
      { name: 'priority:medium', color: 'f59e0b' },
    ],
    user: 'board-owner',
    repo: 'Workflows-Accelerator/openchamber-github-task-board',
  }),
];

async function main() {
  console.log('Starting Fake GitHub server with 300ms list delay...');
  const fakeGitHub = await startFakeGitHub({
    repo: 'Workflows-Accelerator/openchamber-github-task-board',
    issues: mockIssues,
    listDelayMs: 300,
  });

  console.log('Starting local Task Board server with isolated temp session store...');
  const webBoard = await startBoard(fakeGitHub, {
    env: {
      BOARD_GITHUB_LOGIN: 'board-owner',
      BOARD_REPO: 'Workflows-Accelerator/openchamber-github-task-board',
    },
  });
  console.log('Task Board URL:', webBoard.url);

  const obscura = await ensureObscura();
  const playwrightPath = findPlaywright();
  const { chromium } = await import(playwrightPath);
  const browser = await chromium.connectOverCDP(`http://127.0.0.1:${CDP_PORT}`);

  const verificationResults = {
    startedAt: new Date().toISOString(),
    checks: [],
    timeline: [],
    flashDurationMs: 0,
    screenshots: [],
  };

  function recordCheck(name, pass, detail = '') {
    verificationResults.checks.push({ name, pass: Boolean(pass), detail });
    console.log(`[CHECK] ${pass ? 'PASS' : 'FAIL'}: ${name} ${detail ? `(${detail})` : ''}`);
    if (!pass) throw new Error(`Check failed: ${name} ${detail}`);
  }

  try {
    // --------------------------------------------------------------------------
    // Test 1: Fresh Unauthenticated Visit
    // --------------------------------------------------------------------------
    console.log('\n--- 1. Testing unauthenticated visit ---');
    const freshContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const freshPage = await freshContext.newPage();

    await freshPage.goto(webBoard.url, { waitUntil: 'load' });
    await freshPage.locator('#login-view:not([hidden])').waitFor({ state: 'visible', timeout: 5000 });

    const shot1 = path.join(SCREENSHOTS_DIR, '01-unauthenticated-login-view.png');
    await freshPage.screenshot({ path: shot1 });
    verificationResults.screenshots.push('screenshots/01-unauthenticated-login-view.png');

    const isLoginVisible = await freshPage.evaluate(() => !document.getElementById('login-view').hidden);
    const isBoardHidden = await freshPage.evaluate(() => document.getElementById('board-view').hidden);
    const authHintFresh = await freshPage.evaluate(() => localStorage.getItem('tb_auth_hint'));

    recordCheck('Unauthenticated: login-view is visible after session check', isLoginVisible);
    recordCheck('Unauthenticated: board-view is hidden', isBoardHidden);
    recordCheck('Unauthenticated: tb_auth_hint is not set', authHintFresh === null);

    // --------------------------------------------------------------------------
    // Test 2: Sign-in Flow
    // --------------------------------------------------------------------------
    console.log('\n--- 2. Testing sign-in flow ---');
    await freshPage.locator('#password').fill(BOARD_PASSWORD);
    await freshPage.locator('#login-btn').click();

    await freshPage.locator('#board-view:not([hidden])').waitFor({ state: 'visible', timeout: 5000 });
    await freshPage.locator('.task-row').first().waitFor({ state: 'visible', timeout: 5000 });

    const shot2 = path.join(SCREENSHOTS_DIR, '02-signed-in-board-view.png');
    await freshPage.screenshot({ path: shot2 });
    verificationResults.screenshots.push('screenshots/02-signed-in-board-view.png');

    const authHintAfterLogin = await freshPage.evaluate(() => localStorage.getItem('tb_auth_hint'));
    const cachedBoardAfterLogin = await freshPage.evaluate(() => localStorage.getItem('tb_cached_board'));
    const rowsCount = await freshPage.locator('.task-row').count();

    recordCheck('Sign-in: tb_auth_hint is set to 1', authHintAfterLogin === '1');
    recordCheck('Sign-in: tb_cached_board is saved in localStorage', cachedBoardAfterLogin !== null);
    recordCheck('Sign-in: task rows rendered', rowsCount >= 2, `count=${rowsCount}`);

    // --------------------------------------------------------------------------
    // Test 3: Reload Lifecycle with DOM Mutation & Timeline Instrumentation
    // --------------------------------------------------------------------------
    console.log('\n--- 3. Testing reload lifecycle with 300ms simulated WAN delay ---');
    const measurePage = await freshContext.newPage();

    await measurePage.addInitScript(() => {
      window.__timeline = [];
      const log = (event, detail = {}) => {
        const loginEl = document.getElementById('login-view');
        const boardEl = document.getElementById('board-view');
        window.__timeline.push({
          event,
          time: performance.now(),
          loginHidden: loginEl ? loginEl.hidden : null,
          boardHidden: boardEl ? boardEl.hidden : null,
          ...detail,
        });
      };

      log('init_script_start');

      document.addEventListener('DOMContentLoaded', () => {
        log('DOMContentLoaded');
      });

      window.addEventListener('load', () => {
        log('window_load');
      });

      const originalFetch = window.fetch;
      window.fetch = async function (...args) {
        const url = String(args[0]);
        const start = performance.now();
        log('fetch_start', { url });
        try {
          const res = await originalFetch.apply(this, args);
          const end = performance.now();
          log('fetch_end', { url, duration: Number((end - start).toFixed(2)), status: res.status });
          return res;
        } catch (err) {
          log('fetch_error', { url, error: err.message });
          throw err;
        }
      };

      const observer = new MutationObserver((mutations) => {
        for (const m of mutations) {
          if (m.type === 'attributes' && m.attributeName === 'hidden') {
            log('hidden_attribute_changed', { id: m.target.id, hidden: m.target.hidden });
          }
        }
      });

      const observeWhenReady = () => {
        const loginView = document.getElementById('login-view');
        const boardView = document.getElementById('board-view');
        if (loginView) observer.observe(loginView, { attributes: true });
        if (boardView) observer.observe(boardView, { attributes: true });
      };

      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', observeWhenReady);
      } else {
        observeWhenReady();
      }
    });

    console.log('Navigating authenticated page to record reload timeline...');
    const navPromise = measurePage.goto(webBoard.url, { waitUntil: 'load' });

    // Capture screenshot during early network cascade (~40ms in)
    await measurePage.waitForTimeout(40);
    const shot3 = path.join(SCREENSHOTS_DIR, '03-reload-early-shell.png');
    await measurePage.screenshot({ path: shot3 });
    verificationResults.screenshots.push('screenshots/03-reload-early-shell.png');

    await navPromise;
    // Wait for the simulated WAN delay on /api/combined/board to resolve and tasks to populate
    await measurePage.locator('.task-row').first().waitFor({ state: 'visible', timeout: 5000 });

    const shot4 = path.join(SCREENSHOTS_DIR, '04-reload-complete-board.png');
    await measurePage.screenshot({ path: shot4 });
    verificationResults.screenshots.push('screenshots/04-reload-complete-board.png');

    const timeline = await measurePage.evaluate(() => window.__timeline);
    verificationResults.timeline = timeline;

    console.log(`\nReload timeline recorded with ${timeline.length} events:`);
    for (const item of timeline) {
      console.log(
        `  [t=${item.time.toFixed(1)}ms] event=${item.event} loginHidden=${item.loginHidden} boardHidden=${item.boardHidden} ${
          item.url ? `url=${item.url}` : ''
        } ${item.duration ? `duration=${item.duration}ms` : ''}`,
      );
    }

    // Inspect timeline for ANY sign-in flash
    let flashDetected = false;
    let anyLoginNotHidden = false;
    let boardWasHidden = false;

    for (const item of timeline) {
      if (item.loginHidden === false) {
        anyLoginNotHidden = true;
        flashDetected = true;
      }
      if (item.boardHidden === true) {
        boardWasHidden = true;
      }
    }

    recordCheck('No flash: #login-view.hidden was ALWAYS true throughout reload lifecycle', !anyLoginNotHidden);
    recordCheck('Continuity: #board-view.hidden was NEVER true during reload lifecycle', !boardWasHidden);
    recordCheck('Flash duration is 0ms', !flashDetected);

    // --------------------------------------------------------------------------
    // Test 4: Sign-out Flow
    // --------------------------------------------------------------------------
    console.log('\n--- 4. Testing sign-out flow ---');
    await measurePage.locator('#signout-btn').click();
    await measurePage.locator('#login-view:not([hidden])').waitFor({ state: 'visible', timeout: 5000 });

    const shot5 = path.join(SCREENSHOTS_DIR, '05-signed-out-login-view.png');
    await measurePage.screenshot({ path: shot5 });
    verificationResults.screenshots.push('screenshots/05-signed-out-login-view.png');

    const authHintAfterSignOut = await measurePage.evaluate(() => localStorage.getItem('tb_auth_hint'));
    const cachedBoardAfterSignOut = await measurePage.evaluate(() => localStorage.getItem('tb_cached_board'));
    const isLoginVisibleAfterSignOut = await measurePage.evaluate(() => !document.getElementById('login-view').hidden);
    const isBoardHiddenAfterSignOut = await measurePage.evaluate(() => document.getElementById('board-view').hidden);

    recordCheck('Sign-out: #login-view is visible after sign out', isLoginVisibleAfterSignOut);
    recordCheck('Sign-out: #board-view is hidden after sign out', isBoardHiddenAfterSignOut);
    recordCheck('Sign-out: tb_auth_hint is cleared', authHintAfterSignOut === null);
    recordCheck('Sign-out: tb_cached_board is cleared', cachedBoardAfterSignOut === null);

    await freshContext.close();
    console.log('\nAll browser verification checks passed successfully!');
  } finally {
    await browser.close().catch(() => {});
    await webBoard.app.close().catch(() => {});
    await fakeGitHub.close().catch(() => {});
    if (obscura.child) {
      try {
        process.kill(-obscura.child.pid);
      } catch {
        try {
          obscura.child.kill();
        } catch {}
      }
    }
  }

  const resultsPath = path.join(RUN_DIR, 'verifications', 'browser-results.json');
  fs.writeFileSync(resultsPath, JSON.stringify(verificationResults, null, 2));
  console.log('Results written to', resultsPath);
}

main().catch((err) => {
  console.error('Verification failed:', err);
  process.exit(1);
});
