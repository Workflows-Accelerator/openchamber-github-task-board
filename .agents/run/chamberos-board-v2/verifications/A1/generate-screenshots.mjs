import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startFakeGitHub, makeIssue } from '../../../../../web/tests/fake-github.mjs';
import { startBoard, BOARD_PASSWORD } from '../../../../../web/tests/helpers.mjs';
import pkg from '/workspace/personal/lucas/charme-social/node_modules/playwright/index.js';
const { chromium } = pkg;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const screenshotsDir = __dirname;

const coreIssues = [
  makeIssue({
    number: 101,
    title: 'Audit telemetry and tracing pipelines',
    labels: ['status:in-progress', 'priority:high'],
    repo: 'chamberos/core',
    body: `## Overview
Audit end-to-end tracing across background coordinator and event buses.

### Acceptance Criteria:
- [x] Trace propagation verified across service boundaries
- [ ] Latency overhead benchmarked below 2ms

### Actionable Subtasks Checklist:
- [x] Configure OpenTelemetry export format
- [ ] Connect Jaeger collector endpoint
`,
  }),
  makeIssue({
    number: 102,
    title: 'Implement collapsible sidebar navigation',
    labels: ['status:done', 'priority:medium'],
    repo: 'chamberos/core',
    body: `## Overview
Provide 13 unified navigation entries with collapsible rail and responsive overlay.

### Acceptance Criteria:
- [x] 13 navigation entries declared
- [x] Keyboard toggle via sidebar button
- [x] LocalStorage persistence for rail state
`,
  }),
  makeIssue({
    number: 103,
    title: 'Warm paper light and dark theme palette',
    labels: ['status:in-progress', 'priority:high'],
    repo: 'chamberos/core',
    body: `## Overview
Deliver cream / charcoal warm paper tones conforming to CSP and Linear aesthetics.

### Acceptance Criteria:
- [x] Light surface #fcfbf8 with background #f6f4ee
- [x] Dark surface #1d1b18 with background #151412
- [x] Burgundy accent #7c1d2e and crimson #b83a4f
`,
  }),
];

const studioIssues = [
  makeIssue({
    number: 201,
    title: 'Bilingual English and French localization switch',
    labels: ['status:todo', 'priority:medium'],
    repo: 'workflows/studio',
    body: `## Overview
Instant client-side UI translation for navigation, status banners, and placeholders.
`,
  }),
  makeIssue({
    number: 202,
    title: 'Resolve D66 issue loading stall and render shimmer skeletons',
    labels: ['status:done', 'priority:high'],
    repo: 'workflows/studio',
    body: `## Overview
Replace blank screen during asynchronous board hydration with animated shimmer skeletons and explicit error recovery.
`,
  }),
];

const fake = await startFakeGitHub({
  repositories: [
    {
      repo: 'chamberos/core',
      issues: coreIssues,
    },
    {
      repo: 'workflows/studio',
      issues: studioIssues,
    },
  ],
});

const board = await startBoard(fake);

console.log('Fake GitHub started on', fake.url);
console.log('Board server started on', board.url);

const browser = await chromium.launch({
  executablePath: '/workspace/.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell',
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});

const consoleErrors = [];
const cspViolations = [];

async function captureViewports() {
  const viewports = [
    { name: '1280', width: 1280, height: 800 },
    { name: '768', width: 768, height: 1024 },
    { name: '360', width: 360, height: 800 },
  ];

  for (const vp of viewports) {
    console.log(`Capturing viewport: ${vp.width}x${vp.height} (${vp.name}px)...`);
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      serviceWorkers: 'block',
    });
    const page = await context.newPage();

    page.on('console', (msg) => {
      const type = msg.type();
      const text = msg.text();
      if (type === 'error') {
        consoleErrors.push(`[${vp.name}px] ${text}`);
      }
      if (text.includes('Content-Security-Policy') || text.includes('CSP')) {
        cspViolations.push(`[${vp.name}px] ${text}`);
      }
    });

    page.on('pageerror', (err) => {
      consoleErrors.push(`[${vp.name}px] ${err.message}`);
    });

    // Sign in
    await page.goto(board.url);
    await page.locator('#password').fill(BOARD_PASSWORD);
    await page.locator('#login-btn').click();
    await page.locator('#board-view').waitFor({ state: 'visible' });
    await page.waitForTimeout(500);

    // Capture standard board view (Light mode, English)
    const boardShotPath = path.join(screenshotsDir, `board-${vp.name}.png`);
    await page.screenshot({ path: boardShotPath, fullPage: false });
    console.log(`Saved: ${boardShotPath}`);

    // If 1280px, also capture French localization screenshot
    if (vp.name === '1280') {
      const langBtn = page.locator('#lang-switch-btn');
      if (await langBtn.isVisible()) {
        await langBtn.click();
        await page.waitForTimeout(400);
        const frShotPath = path.join(screenshotsDir, `board-1280-fr.png`);
        await page.screenshot({ path: frShotPath, fullPage: false });
        console.log(`Saved: ${frShotPath}`);
        // Switch back to English for subsequent dark mode / drawer captures
        await langBtn.click();
        await page.waitForTimeout(300);
      }
    }

    // If compact screen (360px), toggle sidebar open to demonstrate responsiveness
    if (vp.name === '360') {
      const toggleBtn = page.locator('#sidebar-toggle-btn-compact');
      if (await toggleBtn.isVisible()) {
        await toggleBtn.click();
        await page.waitForTimeout(300);
        const sidebarShotPath = path.join(screenshotsDir, `sidebar-${vp.name}.png`);
        await page.screenshot({ path: sidebarShotPath });
        console.log(`Saved: ${sidebarShotPath}`);
        // Close sidebar by clicking on visible area of backdrop outside sidebar
        await page.locator('#sidebar-backdrop').click({ position: { x: 300, y: 100 } });
        await page.waitForTimeout(300);
      }
    }

    // Open task drawer
    const firstRow = page.locator('.task-row, .task-card, [data-issue-number]').first();
    if (await firstRow.isVisible()) {
      await firstRow.click();
      await page.locator('#detail-view').waitFor({ state: 'visible' });
      await page.waitForTimeout(400);

      const drawerShotPath = path.join(screenshotsDir, `drawer-${vp.name}.png`);
      await page.screenshot({ path: drawerShotPath });
      console.log(`Saved: ${drawerShotPath}`);

      // Close drawer
      await page.locator('#back-btn').click();
      await page.waitForTimeout(300);
    }

    // Capture dark theme variant
    await page.evaluate(() => {
      document.documentElement.setAttribute('data-theme', 'dark');
    });
    await page.waitForTimeout(200);
    const darkShotPath = path.join(screenshotsDir, `board-${vp.name}-dark.png`);
    await page.screenshot({ path: darkShotPath });
    console.log(`Saved: ${darkShotPath}`);

    // Test placeholder routing on desktop
    if (vp.name === '1280') {
      await page.evaluate(() => {
        document.documentElement.removeAttribute('data-theme');
      });
      await page.locator('#nav-canvas').click();
      await page.locator('#placeholder-view').waitFor({ state: 'visible' });
      await page.waitForTimeout(300);
      const placeholderShotPath = path.join(screenshotsDir, `placeholder-1280.png`);
      await page.screenshot({ path: placeholderShotPath });
      console.log(`Saved: ${placeholderShotPath}`);

      // Test return to list view
      await page.locator('#placeholder-back-btn').click();
      await page.locator('#board-view').waitFor({ state: 'visible' });
    }

    await context.close();
  }
}

try {
  await captureViewports();
  console.log('All screenshots captured successfully.');
  console.log('Console errors count:', consoleErrors.length);
  if (consoleErrors.length > 0) {
    console.error('Console errors:', consoleErrors);
  }
  console.log('CSP violations count:', cspViolations.length);
  if (cspViolations.length > 0) {
    console.error('CSP violations:', cspViolations);
  }
  if (consoleErrors.length > 0 || cspViolations.length > 0) {
    process.exitCode = 1;
  }
} catch (err) {
  console.error('Error generating screenshots:', err);
  process.exitCode = 1;
} finally {
  await browser.close();
  await board.app.close();
  await fake.close();
}
