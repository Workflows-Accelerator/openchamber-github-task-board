import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(here, '../../../..');
const SCREENSHOTS_DIR = path.join(here, 'screenshots');
fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

const CDP_PORT = 9333;
const HTTP_PORT = 49152;
const PLAYWRIGHT_PATH = '/workspace/.npm/_npx/e41f203b7505f1fb/node_modules/playwright-core/index.mjs';

const mockIssues = [
  {
    id: 101,
    number: 51,
    title: 'Repair toolbar controls styling',
    body: '## Overview\nRepair #selectSort, #btnRepoSelect and #btnViewSelect styling.',
    state: 'open',
    labels: [
      { name: 'status:in-progress', color: '3b82f6' },
      { name: 'priority:high', color: 'ef4444' }
    ],
    user: { login: 'agent-dev' },
    created_at: '2026-10-30T10:00:00Z',
    updated_at: '2026-10-30T12:00:00Z'
  },
  {
    id: 102,
    number: 50,
    title: 'Reliable task board background connection',
    body: '## Overview\nHost connection probe and readiness verification.',
    state: 'open',
    labels: [
      { name: 'status:done', color: '10b981' },
      { name: 'priority:medium', color: 'f59e0b' }
    ],
    user: { login: 'agent-dev' },
    created_at: '2026-10-29T10:00:00Z',
    updated_at: '2026-10-29T12:00:00Z'
  }
];

function createServer() {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, `http://127.0.0.1:${HTTP_PORT}`);
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

  return server;
}

async function ensureObscura() {
  const versionUrl = `http://127.0.0.1:${CDP_PORT}/json/version`;
  try {
    const res = await fetch(versionUrl);
    if (res.ok) {
      console.log('Obscura is already running on port', CDP_PORT);
      return { started: false };
    }
  } catch {}

  console.log('Launching obscura serve on port', CDP_PORT);
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
        return { started: true, child };
      }
    } catch {}
  }
  throw new Error('Obscura failed to start listening on port ' + CDP_PORT);
}

async function testChromiumHeadlessLaunch() {
  console.log('Testing Standard Chromium Headless Shell 156.0 launch...');
  const { chromium } = await import(PLAYWRIGHT_PATH);
  try {
    const browser = await chromium.launch({
      executablePath: '/workspace/.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell',
      headless: true,
      args: ['--no-sandbox']
    });
    await browser.close();
    return { success: true, message: 'Standard Chromium launched successfully' };
  } catch (err) {
    return {
      success: false,
      message: err.message,
      missingLib: err.message.includes('libglib-2.0.so.0') ? 'libglib-2.0.so.0' : 'unknown'
    };
  }
}

async function run() {
  const chromiumResult = await testChromiumHeadlessLaunch();
  console.log('Chromium launch result missingLib:', chromiumResult.missingLib);

  const obscura = await ensureObscura();
  const server = createServer();
  await new Promise((resolve) => server.listen(HTTP_PORT, '127.0.0.1', resolve));
  console.log('Harness HTTP server listening on port', HTTP_PORT);

  const { chromium } = await import(PLAYWRIGHT_PATH);
  const browser = await chromium.connectOverCDP(`http://127.0.0.1:${CDP_PORT}`);
  console.log('Connected to Obscura CDP');

  const matrix = [
    { width: 1280, height: 800, theme: 'dark', repoMode: 'default', name: '1280-dark-default' },
    { width: 1280, height: 800, theme: 'dark', repoMode: 'long', name: '1280-dark-long' },
    { width: 1280, height: 800, theme: 'light', repoMode: 'default', name: '1280-light-default' },
    { width: 1280, height: 800, theme: 'light', repoMode: 'long', name: '1280-light-long' },
    { width: 980, height: 800, theme: 'dark', repoMode: 'default', name: '980-dark-default' },
    { width: 980, height: 800, theme: 'dark', repoMode: 'long', name: '980-dark-long' },
    { width: 980, height: 800, theme: 'light', repoMode: 'default', name: '980-light-default' },
    { width: 980, height: 800, theme: 'light', repoMode: 'long', name: '980-light-long' },
    { width: 360, height: 640, theme: 'dark', repoMode: 'default', name: '360-dark-default' },
    { width: 360, height: 640, theme: 'dark', repoMode: 'long', name: '360-dark-long' },
    { width: 360, height: 640, theme: 'light', repoMode: 'default', name: '360-light-default' },
    { width: 360, height: 640, theme: 'light', repoMode: 'long', name: '360-light-long' },
  ];

  const results = [];
  const pageErrors = [];

  for (const config of matrix) {
    const context = await browser.newContext({
      viewport: { width: config.width, height: config.height }
    });
    const page = await context.newPage();

    page.on('pageerror', (err) => {
      pageErrors.push({ config: config.name, error: err.message });
      console.error('Page error in', config.name, ':', err.message);
    });

    const isLight = config.theme === 'light';
    const repoName = config.repoMode === 'long'
      ? 'Workflows-Accelerator/openchamber-github-task-board-extended-name-with-very-long-project-title'
      : (config.repoMode === 'short-default' ? 'Selecting repo...' : 'Workflows-Accelerator/openchamber-github-task-board');

    await page.addInitScript(({ isLight, repoName, mockIssues }) => {
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

      const mockParent = {
        postMessage: (msg) => {
          if (!msg || msg.channel !== 'openchamber.sdk') return;
          function reply(id, payload, ok = true) {
            setTimeout(() => {
              window.dispatchEvent(new MessageEvent('message', {
                data: { channel: 'openchamber.sdk', v: 1, type: 'result', id, ok, payload },
                source: mockParent
              }));
            }, 10);
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
            }, 10);
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
    }, { isLight, repoName, mockIssues });

    await page.goto(`http://127.0.0.1:${HTTP_PORT}/panel/index.html`, { waitUntil: 'load' });
    await page.locator('#selectSort').waitFor({ state: 'visible' });
    await page.waitForTimeout(800);

    // If long repo, also ensure tooltip is set and test custom long label if needed
    if (config.repoMode === 'long') {
      await page.evaluate((longName) => {
        const lbl = document.getElementById('txtRepoLabel');
        const btn = document.getElementById('btnRepoSelect');
        lbl.textContent = longName;
        btn.setAttribute('title', longName);
      }, 'Workflows-Accelerator/openchamber-github-task-board-extended-name');
      await page.waitForTimeout(200);
    }

    // Measure metrics
    const measurements = await page.evaluate(() => {
      const doc = document.documentElement;
      const selectSort = document.getElementById('selectSort');
      const btnRepoSelect = document.getElementById('btnRepoSelect');
      const txtRepoLabel = document.getElementById('txtRepoLabel');
      const btnViewSelect = document.getElementById('btnViewSelect');
      const selectSortStyle = window.getComputedStyle(selectSort);
      const btnRepoStyle = window.getComputedStyle(btnRepoSelect);
      const txtRepoStyle = window.getComputedStyle(txtRepoLabel);
      const btnViewStyle = window.getComputedStyle(btnViewSelect);

      return {
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        docScrollWidth: doc.scrollWidth,
        docClientWidth: doc.clientWidth,
        hasHorizontalOverflow: doc.scrollWidth > window.innerWidth,
        selectSort: {
          bg: selectSortStyle.backgroundColor,
          color: selectSortStyle.color,
          height: selectSortStyle.height,
          fontSize: selectSortStyle.fontSize,
          fontWeight: selectSortStyle.fontWeight,
          borderRadius: selectSortStyle.borderRadius,
          border: selectSortStyle.border,
          colorScheme: selectSortStyle.colorScheme,
        },
        repoBtn: {
          justifyContent: btnRepoStyle.justifyContent,
          textAlign: btnRepoStyle.textAlign,
          title: btnRepoSelect.getAttribute('title') || '',
          labelMinZero: txtRepoStyle.minWidth === '0px',
          labelTextAlign: txtRepoStyle.textAlign,
          labelTextOverflow: txtRepoStyle.textOverflow,
          labelScrollWidth: txtRepoLabel.scrollWidth,
          labelClientWidth: txtRepoLabel.clientWidth,
          isTruncated: txtRepoLabel.scrollWidth > txtRepoLabel.clientWidth,
          labelText: txtRepoLabel.textContent,
        },
        viewBtn: {
          flexShrink: btnViewStyle.flexShrink,
          whiteSpace: btnViewStyle.whiteSpace,
          scrollWidth: btnViewSelect.scrollWidth,
          clientWidth: btnViewSelect.clientWidth,
          isClipped: btnViewSelect.scrollWidth > btnViewSelect.clientWidth,
        }
      };
    });

    const shotPath = path.join(SCREENSHOTS_DIR, `${config.name}.png`);
    await page.screenshot({ path: shotPath });
    console.log(`Captured ${config.name}.png (overflow=${measurements.hasHorizontalOverflow}, sortBg=${measurements.selectSort.bg}, sortFg=${measurements.selectSort.color})`);

    results.push({ config, measurements, shotPath });
    await context.close();
  }

  // Interaction and keyboard focus tests
  console.log('Running interactive keyboard focus and popover checks...');
  const focusContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const focusPage = await focusContext.newPage();

  await focusPage.addInitScript(({ mockIssues }) => {
    const mockParent = {
      postMessage: (msg) => {
        if (!msg || msg.channel !== 'openchamber.sdk') return;
        function reply(id, payload, ok = true) {
          setTimeout(() => {
            window.dispatchEvent(new MessageEvent('message', {
              data: { channel: 'openchamber.sdk', v: 1, type: 'result', id, ok, payload },
              source: mockParent
            }));
          }, 10);
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
                  theme: {
                    mode: 'dark',
                    tokens: {
                      font: 'sans', foreground: '#f0f2f5', background: '#0f1012',
                      elevated: '#16181b', card: '#16181b', cardForeground: '#f0f2f5', muted: '#8c929d',
                      mutedSurface: '#1c1f24', mutedForeground: '#8c929d', border: 'rgba(255, 255, 255, 0.08)',
                      subtle: '#23272e', hover: '#2a2f38',
                      primary: '#3b82f6', primaryForeground: '#ffffff'
                    }
                  },
                  settings: { repo: 'Workflows-Accelerator/openchamber-github-task-board' }
                }
              },
              source: mockParent
            }));
          }, 10);
        } else if (msg.type === 'service-request') {
          reply(msg.id, { status: 200, body: JSON.stringify({ status: 'ok' }) });
        } else if (msg.type === 'workspace-read') {
          reply(msg.id, { kind: msg.payload?.kind, state: 'ready', projects: [{ id: 'p1', name: 'Workflows-Accelerator/openchamber-github-task-board', path: '/workspace/project' }] });
        } else if (msg.type === 'file-read') {
          reply(msg.id, { content: '[remote "origin"]\\n\\turl = git@github.com:Workflows-Accelerator/openchamber-github-task-board.git\\n' });
        } else if (msg.type === 'storage') {
          reply(msg.id, { storage: true, op: 'get', key: msg.payload?.key, found: false });
        } else if (msg.type === 'request') {
          reply(msg.id, { status: 200, body: JSON.stringify(mockIssues), headers: { 'x-ratelimit-remaining': '4999', etag: '"mock-etag"' } });
        } else if (msg.id) {
          reply(msg.id, {});
        }
      }
    };
    Object.defineProperty(window, 'parent', { value: mockParent, configurable: true });
  }, { mockIssues });

  await focusPage.goto(`http://127.0.0.1:${HTTP_PORT}/panel/index.html`, { waitUntil: 'load' });
  await focusPage.locator('#selectSort').waitFor({ state: 'visible' });
  await focusPage.waitForTimeout(600);

  // Focus #selectSort
  await focusPage.locator('#selectSort').focus();
  const sortFocused = await focusPage.locator('#selectSort').evaluate((el) => {
    const s = window.getComputedStyle(el);
    return {
      outline: s.outline,
      outlineColor: s.outlineColor,
      isFocused: document.activeElement === el
    };
  });
  await focusPage.screenshot({ path: path.join(SCREENSHOTS_DIR, 'focus-sort-select.png') });

  // Focus #btnViewSelect
  await focusPage.locator('#btnViewSelect').focus();
  await focusPage.screenshot({ path: path.join(SCREENSHOTS_DIR, 'focus-view-btn.png') });

  // Focus #btnRepoSelect
  await focusPage.locator('#btnRepoSelect').focus();
  await focusPage.screenshot({ path: path.join(SCREENSHOTS_DIR, 'focus-repo-btn.png') });

  // Click #btnViewSelect to open view popover
  await focusPage.locator('#btnViewSelect').click();
  await focusPage.waitForTimeout(200);
  const viewPopoverVisible = await focusPage.locator('#viewSelectPopover').isVisible();
  await focusPage.screenshot({ path: path.join(SCREENSHOTS_DIR, 'popover-view-opened.png') });

  // Click #btnRepoSelect to open repo popover
  await focusPage.locator('#btnRepoSelect').click();
  await focusPage.waitForTimeout(200);
  const repoPopoverVisible = await focusPage.locator('#repoPopover').isVisible();
  await focusPage.screenshot({ path: path.join(SCREENSHOTS_DIR, 'popover-repo-opened.png') });

  await focusContext.close();
  await browser.close();
  server.close();

  const report = {
    chromiumResult,
    pageErrorsCount: pageErrors.length,
    pageErrors,
    sortFocused,
    viewPopoverVisible,
    repoPopoverVisible,
    results
  };

  fs.writeFileSync(path.join(here, 'verification-data.json'), JSON.stringify(report, null, 2));
  console.log('Verification completed successfully! Wrote verification-data.json');
}

run().catch((err) => {
  console.error('Fatal verify runner error:', err);
  process.exit(1);
});
