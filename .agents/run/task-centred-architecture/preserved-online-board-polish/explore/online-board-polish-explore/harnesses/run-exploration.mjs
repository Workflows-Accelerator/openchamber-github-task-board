import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { startFakeGitHub, makeIssue } from '../../../../web/tests/fake-github.mjs';
import { startBoard, BOARD_PASSWORD } from '../../../../web/tests/helpers.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(HERE, '../../../..');
const OUTPUT_DIR = path.resolve(HERE, '..');
const SCREENSHOTS_DIR = path.join(OUTPUT_DIR, 'screenshots');
fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

const CDP_PORT = 9350;
const PANEL_PORT = 49160;
const PLAYWRIGHT_PATH = '/workspace/.npm/_npx/e41f203b7505f1fb/node_modules/playwright-core/index.mjs';

const mockIssues = [
  makeIssue({
    number: 54,
    title: 'Sign-in screen flash on page reload when already authenticated',
    body: `## Overview
When a user already has an active session cookie on https://board.workflows.ac, reloading the page displays the sign-in form for 1-2 seconds before the task board appears.

## Acceptance Criteria
- [ ] Sign-in form only appears when user is signed out
- [ ] Active session reloads render board or neutral loading shell immediately

## Open Questions
- [ ] Should we use a fast cookie/localStorage hint or SSR shell?`,
    state: 'open',
    labels: [
      { name: 'status:in-progress', color: '3b82f6' },
      { name: 'priority:high', color: 'ef4444' },
      { name: 'kind:bug', color: 'd73a4a' },
      { name: 'theme:web', color: '8b5cf6' }
    ],
    user: 'board-owner',
    repo: 'Workflows-Accelerator/openchamber-github-task-board'
  }),
  makeIssue({
    number: 53,
    title: 'Align online board visual styling with OpenChamber task board panel',
    body: `## Overview
The online board design deviates from the panel design in OpenChamber. Users want visual consistency across colors, typography, density, and controls.

## Acceptance Criteria
- [ ] Design tokens aligned with OpenChamber system
- [ ] Compact toolbar and task card density matched

## Open Questions
- [ ] Can we share token variables or CSS files directly?`,
    state: 'open',
    labels: [
      { name: 'status:in-progress', color: '3b82f6' },
      { name: 'priority:high', color: 'ef4444' },
      { name: 'kind:enhancement', color: 'a2eeef' },
      { name: 'theme:ui', color: '8b5cf6' }
    ],
    user: 'board-owner',
    repo: 'Workflows-Accelerator/openchamber-github-task-board'
  }),
  makeIssue({
    number: 51,
    title: 'Repair toolbar controls styling',
    body: `## Overview
Repair selectSort, btnRepoSelect and btnViewSelect styling in the panel.`,
    state: 'open',
    labels: [
      { name: 'status:done', color: '10b981' },
      { name: 'priority:medium', color: 'f59e0b' },
      { name: 'theme:panel', color: '8b5cf6' }
    ],
    user: 'agent-dev',
    repo: 'Workflows-Accelerator/openchamber-github-task-board'
  }),
  makeIssue({
    number: 50,
    title: 'Reliable task board background connection',
    body: `## Overview
Host connection probe and readiness verification.`,
    state: 'open',
    labels: [
      { name: 'status:done', color: '10b981' },
      { name: 'priority:medium', color: 'f59e0b' },
      { name: 'theme:service', color: '8b5cf6' }
    ],
    user: 'agent-dev',
    repo: 'Workflows-Accelerator/openchamber-github-task-board'
  })
];

function createPanelServer() {
  return http.createServer((req, res) => {
    const url = new URL(req.url, `http://127.0.0.1:${PANEL_PORT}`);
    const pathname = url.pathname;

    if (pathname === '/panel/index.html') {
      const file = path.join(ROOT_DIR, 'panel', 'index.html');
      fs.readFile(file, 'utf8', (err, data) => {
        if (err) {
          res.writeHead(404);
          res.end('Not found');
        } else {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(data);
        }
      });
      return;
    }

    if (pathname === '/panel/main.js') {
      const file = path.join(ROOT_DIR, 'panel', 'main.js');
      fs.readFile(file, 'utf8', (err, data) => {
        if (err) {
          res.writeHead(404);
          res.end('Not found');
        } else {
          res.writeHead(200, { 'Content-Type': 'application/javascript' });
          res.end(data);
        }
      });
      return;
    }

    res.writeHead(404);
    res.end('Not found');
  });
}

async function ensureObscura() {
  const versionUrl = `http://127.0.0.1:${CDP_PORT}/json/version`;
  try {
    const res = await fetch(versionUrl);
    if (res.ok) {
      console.log('Obscura is already running on port', CDP_PORT);
      return { child: null };
    }
  } catch {}

  console.log('Starting Obscura CDP server on port', CDP_PORT);
  const child = spawn('obscura', ['serve', '--port', String(CDP_PORT), '--allow-file-access', '--allow-private-network'], {
    stdio: 'ignore',
    detached: true,
  });
  child.unref();

  const deadline = Date.now() + 10_000;
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

async function main() {
  const metrics = {
    timestamp: new Date().toISOString(),
    liveMeasurements: {},
    localTimeline: null,
    screenshots: []
  };

  // 1. Measure live public endpoints (as required by brief: GET /health and unauthenticated GET /api/session only)
  console.log('Measuring live public endpoints against https://board.workflows.ac...');
  async function measureLiveUrl(url) {
    const t0 = performance.now();
    const res = await fetch(url, { headers: { 'User-Agent': 'board-polish-explore/1.0' } });
    const t1 = performance.now();
    return {
      status: res.status,
      durationMs: Number((t1 - t0).toFixed(2)),
      contentLength: Number(res.headers.get('content-length') || 0)
    };
  }

  try {
    metrics.liveMeasurements.health = await measureLiveUrl('https://board.workflows.ac/health');
    metrics.liveMeasurements.session = await measureLiveUrl('https://board.workflows.ac/api/session');
    metrics.liveMeasurements.rootHtml = await measureLiveUrl('https://board.workflows.ac/');
    metrics.liveMeasurements.themeCss = await measureLiveUrl('https://board.workflows.ac/theme.css');
    metrics.liveMeasurements.appJs = await measureLiveUrl('https://board.workflows.ac/app.js');
    console.log('Live measurements:', metrics.liveMeasurements);
  } catch (err) {
    console.warn('Failed measuring live endpoints:', err.message);
  }

  // 2. Start servers
  console.log('Starting fake GitHub and local web board server...');
  const fakeGitHub = await startFakeGitHub({
    repo: 'Workflows-Accelerator/openchamber-github-task-board',
    issues: mockIssues
  });

  const webBoard = await startBoard(fakeGitHub, {
    env: {
      BOARD_GITHUB_LOGIN: 'board-owner',
      BOARD_REPO: 'Workflows-Accelerator/openchamber-github-task-board'
    }
  });
  console.log('Web Board running at:', webBoard.url);

  const panelServer = createPanelServer();
  await new Promise((resolve) => panelServer.listen(PANEL_PORT, '127.0.0.1', resolve));
  console.log('Panel server listening at: http://127.0.0.1:' + PANEL_PORT);

  const obscura = await ensureObscura();
  const { chromium } = await import(PLAYWRIGHT_PATH);
  const browser = await chromium.connectOverCDP(`http://127.0.0.1:${CDP_PORT}`);

  try {
    // ----------------------------------------------------
    // Step A: #54 Flash reproduction & timeline measurement
    // ----------------------------------------------------
    console.log('\n--- Step A: Reproducing #54 sign-in flash & recording reload timeline ---');
    const authContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const authPage = await authContext.newPage();

    // Sign in on local web board
    await authPage.goto(webBoard.url, { waitUntil: 'load' });
    await authPage.locator('#password').fill(BOARD_PASSWORD);
    await authPage.locator('#login-btn').click();
    await authPage.locator('#board-view:not([hidden])').waitFor({ state: 'visible', timeout: 5000 });
    console.log('Signed in successfully on web board.');

    // Now set up reload instrumentation page in the same context (preserves cookies)
    const measurePage = await authContext.newPage();
    await measurePage.addInitScript(() => {
      window.__timeline = [];
      const log = (event, detail = {}) => {
        window.__timeline.push({
          event,
          time: performance.now(),
          loginHidden: document.getElementById('login-view')?.hidden ?? null,
          boardHidden: document.getElementById('board-view')?.hidden ?? null,
          ...detail
        });
      };

      log('init_script_start');

      document.addEventListener('DOMContentLoaded', () => {
        log('DOMContentLoaded');
      });

      window.addEventListener('load', () => {
        log('window_load');
      });

      // Hook fetch to observe API request timings
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

      // Observe view element visibility changes
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

    console.log('Navigating to web board with active session to record reload timeline...');
    const navPromise = measurePage.goto(webBoard.url, { waitUntil: 'load' });

    // Capture early flash screenshot while session checks are executing
    await measurePage.waitForTimeout(40);
    const flashShotPath = path.join(SCREENSHOTS_DIR, 'flash-login-visible.png');
    await measurePage.screenshot({ path: flashShotPath });
    metrics.screenshots.push('screenshots/flash-login-visible.png');
    console.log('Captured early flash screenshot to:', flashShotPath);

    await navPromise;
    await measurePage.locator('#board-view:not([hidden])').waitFor({ state: 'visible', timeout: 5000 });

    const postLoadShotPath = path.join(SCREENSHOTS_DIR, 'flash-board-visible.png');
    await measurePage.screenshot({ path: postLoadShotPath });
    metrics.screenshots.push('screenshots/flash-board-visible.png');

    const timelineData = await measurePage.evaluate(() => window.__timeline);
    metrics.localTimeline = timelineData;
    console.log('Timeline recorded with', timelineData.length, 'events.');
    await authContext.close();

    // ----------------------------------------------------
    // Step B: #53 Side-by-side screenshots (Panel vs Web)
    // ----------------------------------------------------
    console.log('\n--- Step B: Capturing side-by-side screenshots (Panel vs Web) ---');

    const viewports = [
      { name: '1280-dark', width: 1280, height: 800, theme: 'dark', colorScheme: 'dark' },
      { name: '1280-light', width: 1280, height: 800, theme: 'light', colorScheme: 'light' },
      { name: '360-dark', width: 360, height: 640, theme: 'dark', colorScheme: 'dark' },
      { name: '360-light', width: 360, height: 640, theme: 'light', colorScheme: 'light' },
    ];

    for (const vp of viewports) {
      console.log(`\nRendering viewport: ${vp.name} (${vp.width}x${vp.height}, theme=${vp.theme})`);
      const isLight = vp.theme === 'light';

      // 1. Render Panel
      const panelContext = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        colorScheme: vp.colorScheme
      });
      const panelPage = await panelContext.newPage();

      await panelPage.addInitScript(({ isLight, mockIssues }) => {
        const theme = isLight ? {
          mode: 'light',
          tokens: {
            font: 'sans',
            foreground: '#1c1e21',
            background: '#ffffff',
            elevated: '#f4f5f7',
            card: '#f4f5f7',
            cardForeground: '#1c1e21',
            muted: '#606770',
            mutedSurface: '#eaedf0',
            mutedForeground: '#606770',
            subtle: '#e4e6eb',
            hover: '#e2e5e9',
            border: '#d0d5dd',
            primary: '#1877f2',
            primaryForeground: '#ffffff'
          }
        } : {
          mode: 'dark',
          tokens: {
            font: 'sans',
            foreground: '#f0f2f5',
            background: '#0f1012',
            elevated: '#16181b',
            card: '#16181b',
            cardForeground: '#f0f2f5',
            muted: '#8c929d',
            mutedSurface: '#1c1f24',
            mutedForeground: '#8c929d',
            subtle: '#23272e',
            hover: '#2a2f38',
            border: 'rgba(255, 255, 255, 0.08)',
            primary: '#3b82f6',
            primaryForeground: '#ffffff'
          }
        };

        const repoName = 'Workflows-Accelerator/openchamber-github-task-board';
        const mockParent = {
          postMessage: (msg) => {
            if (!msg || msg.channel !== 'openchamber.sdk') return;
            function reply(id, payload, ok = true) {
              setTimeout(() => {
                window.dispatchEvent(new MessageEvent('message', {
                  data: { channel: 'openchamber.sdk', v: 1, type: 'result', id, ok, payload },
                  source: mockParent
                }));
              }, 0);
            }

            if (msg.type === 'hello') {
              setTimeout(() => {
                window.dispatchEvent(new MessageEvent('message', {
                  data: {
                    channel: 'openchamber.sdk',
                    v: 1,
                    type: 'ready',
                    id: msg.id,
                    payload: {
                      surface: 'panel',
                      directory: '/workspace/project',
                      features: { deviceStorage: true },
                      theme,
                      settings: { repo: repoName }
                    }
                  },
                  source: mockParent
                }));
              }, 0);
            } else if (msg.type === 'service-request') {
              reply(msg.id, { status: 200, body: JSON.stringify({ status: 'ok' }) });
            } else if (msg.type === 'workspace-read') {
              const kind = msg.payload?.kind;
              if (kind === 'projects') {
                reply(msg.id, { kind: 'projects', state: 'ready', projects: [{ id: 'p1', name: repoName, path: '/workspace/project' }] });
              } else if (kind === 'sessions') {
                reply(msg.id, { kind: 'sessions', state: 'ready', sessions: [] });
              } else if (kind === 'worktrees') {
                reply(msg.id, { kind: 'worktrees', state: 'ready', worktrees: [] });
              } else {
                reply(msg.id, { kind, state: 'ready' });
              }
            } else if (msg.type === 'file-read') {
              reply(msg.id, { content: '[remote "origin"]\\n\\turl = git@github.com:' + repoName + '.git\\n' });
            } else if (msg.type === 'storage') {
              reply(msg.id, { storage: true, op: 'get', key: msg.payload?.key, found: false });
            } else if (msg.type === 'request') {
              reply(msg.id, {
                status: 200,
                body: JSON.stringify(mockIssues),
                headers: { 'x-ratelimit-remaining': '4999', etag: '"mock-etag"' }
              });
            } else if (msg.id) {
              reply(msg.id, {});
            }
          }
        };

        Object.defineProperty(window, 'parent', { value: mockParent, configurable: true });
      }, { isLight, mockIssues });

      await panelPage.goto(`http://127.0.0.1:${PANEL_PORT}/panel/index.html`, { waitUntil: 'load' });
      await panelPage.locator('#selectSort').waitFor({ state: 'visible', timeout: 5000 });
      try {
        await panelPage.locator('.simple-row, .task-card, .task-item').first().waitFor({ state: 'visible', timeout: 3000 });
      } catch {}
      await panelPage.waitForTimeout(200);

      const panelShotPath = path.join(SCREENSHOTS_DIR, `panel-${vp.name}.png`);
      await panelPage.screenshot({ path: panelShotPath });
      metrics.screenshots.push(`screenshots/panel-${vp.name}.png`);
      console.log(`Saved panel screenshot: ${panelShotPath}`);

      // If 1280-dark, also click a task card to open the drawer and capture it!
      if (vp.name === '1280-dark') {
        const firstCard = panelPage.locator('.task-card, .simple-row, .task-item').first();
        if (await firstCard.count() > 0) {
          await firstCard.click();
          await panelPage.waitForTimeout(300);
          const panelDrawerShot = path.join(SCREENSHOTS_DIR, 'panel-drawer-1280-dark.png');
          await panelPage.screenshot({ path: panelDrawerShot });
          metrics.screenshots.push('screenshots/panel-drawer-1280-dark.png');
          console.log(`Saved panel drawer screenshot: ${panelDrawerShot}`);
        }
      }

      await panelContext.close();

      // 2. Render Web Board
      const webContext = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        colorScheme: vp.colorScheme
      });
      const webPage = await webContext.newPage();

      // Sign in on web board first
      await webPage.goto(webBoard.url, { waitUntil: 'load' });
      await webPage.locator('#password').fill(BOARD_PASSWORD);
      await webPage.locator('#login-btn').click();
      await webPage.locator('#board-view:not([hidden])').waitFor({ state: 'visible', timeout: 5000 });
      await webPage.waitForTimeout(300);

      const webShotPath = path.join(SCREENSHOTS_DIR, `web-${vp.name}.png`);
      await webPage.screenshot({ path: webShotPath });
      metrics.screenshots.push(`screenshots/web-${vp.name}.png`);
      console.log(`Saved web board screenshot: ${webShotPath}`);

      // If 1280-dark, also click a task row to open the web drawer!
      if (vp.name === '1280-dark') {
        const firstRow = webPage.locator('.task-row, [data-issue-key]').first();
        if (await firstRow.count() > 0) {
          await firstRow.click();
          await webPage.waitForTimeout(300);
          const webDrawerShot = path.join(SCREENSHOTS_DIR, 'web-drawer-1280-dark.png');
          await webPage.screenshot({ path: webDrawerShot });
          metrics.screenshots.push('screenshots/web-drawer-1280-dark.png');
          console.log(`Saved web board drawer screenshot: ${webDrawerShot}`);
        }
      }

      await webContext.close();
    }

    // Save metrics JSON
    const metricsPath = path.join(OUTPUT_DIR, 'metrics.json');
    fs.writeFileSync(metricsPath, JSON.stringify(metrics, null, 2), 'utf8');
    console.log('\nMetrics saved to:', metricsPath);

  } finally {
    await browser.close();
    if (obscura.child) {
      obscura.child.kill('SIGTERM');
    }
    await webBoard.app.close();
    await fakeGitHub.close();
    await new Promise((resolve) => panelServer.close(resolve));
    console.log('All servers shut down.');
  }
}

main().catch((err) => {
  console.error('Fatal exploration error:', err);
  process.exit(1);
});
