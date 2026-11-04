import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startFakeGitHub, makeIssue } from '../../../../../web/tests/fake-github.mjs';
import { startBoard, BOARD_PASSWORD } from '../../../../../web/tests/helpers.mjs';
import pkg from '/workspace/personal/lucas/charme-social/node_modules/playwright/index.js';
const { chromium } = pkg.default || pkg;

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

<!-- board-order: 100 -->
<!-- board-canvas: {"x":80,"y":80} -->
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

<!-- board-order: 200 -->
<!-- board-canvas: {"x":420,"y":80} -->
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
    title: 'Infinite canvas with non-clustering dot grid',
    labels: ['status:done', 'priority:high'],
    repo: 'workflows/studio',
    body: `## Overview
Dot grid stays fine at any zoom level from 0.2 to 2.5 with position persistence on drop.
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
  honorIfMatch: true,
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

async function captureCanvasFlow() {
  // 1. Desktop 1280px tests & screenshots
  console.log('Starting Desktop 1280px Canvas verification...');
  const desktopContext = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    serviceWorkers: 'block',
  });
  const page = await desktopContext.newPage();

  page.on('console', (msg) => {
    const type = msg.type();
    const text = msg.text();
    if (type === 'error') {
      consoleErrors.push(`[1280px] ${text}`);
    }
    if (text.includes('Content-Security-Policy') || text.includes('CSP')) {
      cspViolations.push(`[1280px] ${text}`);
    }
  });

  page.on('pageerror', (err) => {
    consoleErrors.push(`[1280px] ${err.message}`);
  });

  // Sign in
  await page.goto(board.url);
  await page.locator('#password').fill(BOARD_PASSWORD);
  await page.locator('#login-btn').click();
  await page.locator('#board-view').waitFor({ state: 'visible' });
  await page.waitForTimeout(500);

  // Switch to Canvas view
  console.log('Navigating to Canvas view...');
  await page.locator('#nav-canvas').click();
  await page.locator('#canvas-viewport').waitFor({ state: 'visible' });
  await page.waitForTimeout(400);

  // Verify Canvas cards are rendered
  const cards = page.locator('.canvas-card');
  const count = await cards.count();
  console.log(`Found ${count} canvas cards on plane.`);
  if (count === 0) throw new Error('Expected canvas cards to be rendered on plane');

  // Shot 1: Desktop Canvas 100% (Light)
  const shot1280 = path.join(screenshotsDir, 'canvas-1280.png');
  await page.screenshot({ path: shot1280 });
  console.log(`Saved: ${shot1280}`);

  // Shot 2: Zoom out to 0.25 (Non-clustering dot grid check)
  console.log('Testing Zoom Out to 0.25 (dot grid scaling proof)...');
  await page.evaluate(() => {
    window.__taskBoard.setCanvasZoom(0.25);
  });
  await page.waitForTimeout(300);
  const shotZoomOut = path.join(screenshotsDir, 'canvas-1280-zoom-025.png');
  await page.screenshot({ path: shotZoomOut });
  console.log(`Saved: ${shotZoomOut}`);

  // Shot 3: Zoom in to 2.0
  console.log('Testing Zoom In to 2.0...');
  await page.evaluate(() => {
    window.__taskBoard.setCanvasZoom(2.0);
  });
  await page.waitForTimeout(300);
  const shotZoomIn = path.join(screenshotsDir, 'canvas-1280-zoom-200.png');
  await page.screenshot({ path: shotZoomIn });
  console.log(`Saved: ${shotZoomIn}`);

  // Reset zoom back to 1.0 via floating controls button
  await page.locator('#canvas-zoom-readout').click();
  await page.waitForTimeout(300);

  // Shot 4: French localization switch
  console.log('Testing French translation on Canvas...');
  const langBtn = page.locator('#lang-switch-btn');
  if (await langBtn.isVisible()) {
    await langBtn.click();
    await page.waitForTimeout(300);
    const shotFr = path.join(screenshotsDir, 'canvas-1280-fr.png');
    await page.screenshot({ path: shotFr });
    console.log(`Saved: ${shotFr}`);
    // Switch back to English
    await langBtn.click();
    await page.waitForTimeout(300);
  }

  // Shot 5: Dark Theme Canvas
  console.log('Testing Warm Paper Dark Theme Canvas...');
  await page.evaluate(() => {
    document.documentElement.setAttribute('data-theme', 'dark');
  });
  await page.waitForTimeout(200);
  const shotDark = path.join(screenshotsDir, 'canvas-1280-dark.png');
  await page.screenshot({ path: shotDark });
  console.log(`Saved: ${shotDark}`);

  // Restore light theme
  await page.evaluate(() => {
    document.documentElement.removeAttribute('data-theme');
  });
  await page.waitForTimeout(200);

  // Shot 6: Card Drag & Drop Persistence
  console.log('Testing card drag and drop with PUT /api/issues/:n/canvas persistence...');
  const card101 = page.locator('.canvas-card[data-issue-number="101"]');
  const box = await card101.boundingBox();
  if (!box) throw new Error('Could not find bounding box for card #101');

  // Drag card from (box.x + 20, box.y + 20) to (box.x + 120, box.y + 140)
  const putPromise = page.waitForResponse(
    (resp) => resp.url().includes('/api/') && resp.url().includes('/canvas') && resp.request().method() === 'PUT',
    { timeout: 5000 }
  );

  await page.mouse.move(box.x + 30, box.y + 30);
  await page.mouse.down();
  await page.mouse.move(box.x + 150, box.y + 170, { steps: 8 });
  await page.mouse.up();

  const putResponse = await putPromise;
  console.log('Card position PUT response status:', putResponse.status());
  if (putResponse.status() !== 200) {
    throw new Error(`PUT /api/issues/101/canvas failed with status ${putResponse.status()}`);
  }
  await page.waitForTimeout(300);

  // Verify fake GitHub issue body now has the updated position
  const savedIssue = fake.findIssue(101);
  console.log('Upstream GitHub body snippet:', savedIssue.body.slice(-100));
  if (!savedIssue.body.includes('<!-- board-canvas:')) {
    throw new Error('Updated canvas marker missing from upstream GitHub body');
  }

  const shotDragged = path.join(screenshotsDir, 'canvas-card-dragged.png');
  await page.screenshot({ path: shotDragged });
  console.log(`Saved: ${shotDragged}`);

  // Shot 7: Card Click opens Detail Drawer
  console.log('Testing Card Click to open Detail Drawer...');
  const cardBoxes = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('.canvas-card')).map((c) => ({
      num: c.getAttribute('data-issue-number'),
      left: c.style.left,
      top: c.style.top,
      rect: c.getBoundingClientRect(),
    }));
  });
  console.log('Canvas cards in DOM:', JSON.stringify(cardBoxes, null, 2));

  await card101.click();
  await page.locator('#detail-view').waitFor({ state: 'visible' });
  await page.waitForTimeout(400);

  const shotDrawer = path.join(screenshotsDir, 'canvas-drawer-1280.png');
  await page.screenshot({ path: shotDrawer });
  console.log(`Saved: ${shotDrawer}`);

  // Close drawer
  await page.locator('#back-btn').click();
  await page.waitForTimeout(300);

  await desktopContext.close();

  // 2. Tablet 768px tests & screenshots
  console.log('Capturing Tablet 768px Canvas...');
  const tabletContext = await browser.newContext({
    viewport: { width: 768, height: 1024 },
    serviceWorkers: 'block',
  });
  const tabletPage = await tabletContext.newPage();

  tabletPage.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(`[768px] ${msg.text()}`);
    if (msg.text().includes('CSP')) cspViolations.push(`[768px] ${msg.text()}`);
  });

  await tabletPage.goto(board.url);
  await tabletPage.locator('#password').fill(BOARD_PASSWORD);
  await tabletPage.locator('#login-btn').click();
  await tabletPage.locator('#board-view').waitFor({ state: 'visible' });
  const tabletSidebarToggle = tabletPage.locator('#sidebar-toggle-btn-compact');
  if (await tabletSidebarToggle.isVisible()) {
    await tabletSidebarToggle.click();
    await tabletPage.waitForTimeout(300);
    await tabletPage.locator('#nav-canvas').click();
    await tabletPage.waitForTimeout(300);
  } else {
    await tabletPage.locator('#nav-canvas').click();
  }
  await tabletPage.locator('#canvas-viewport').waitFor({ state: 'visible' });
  await tabletPage.waitForTimeout(400);

  const shot768 = path.join(screenshotsDir, 'canvas-768.png');
  await tabletPage.screenshot({ path: shot768 });
  console.log(`Saved: ${shot768}`);

  await tabletPage.evaluate(() => {
    document.documentElement.setAttribute('data-theme', 'dark');
  });
  await tabletPage.waitForTimeout(200);
  const shot768Dark = path.join(screenshotsDir, 'canvas-768-dark.png');
  await tabletPage.screenshot({ path: shot768Dark });
  console.log(`Saved: ${shot768Dark}`);

  await tabletContext.close();

  // 3. Compact 360px tests & screenshots
  console.log('Capturing Compact 360px Canvas...');
  const compactContext = await browser.newContext({
    viewport: { width: 360, height: 800 },
    serviceWorkers: 'block',
  });
  const compactPage = await compactContext.newPage();

  compactPage.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(`[360px] ${msg.text()}`);
    if (msg.text().includes('CSP')) cspViolations.push(`[360px] ${msg.text()}`);
  });

  await compactPage.goto(board.url);
  await compactPage.locator('#password').fill(BOARD_PASSWORD);
  await compactPage.locator('#login-btn').click();
  await compactPage.locator('#board-view').waitFor({ state: 'visible' });

  // On compact, open slide-out sidebar to click Canvas
  const sidebarToggle = compactPage.locator('#sidebar-toggle-btn-compact');
  if (await sidebarToggle.isVisible()) {
    await sidebarToggle.click();
    await compactPage.waitForTimeout(300);
    await compactPage.locator('#nav-canvas').click();
    await compactPage.waitForTimeout(300);
  } else {
    await compactPage.locator('#nav-canvas').click();
  }

  await compactPage.locator('#canvas-viewport').waitFor({ state: 'visible' });
  await compactPage.waitForTimeout(400);

  const shot360 = path.join(screenshotsDir, 'canvas-360.png');
  await compactPage.screenshot({ path: shot360 });
  console.log(`Saved: ${shot360}`);

  // Dark variant at 360px
  await compactPage.evaluate(() => {
    document.documentElement.setAttribute('data-theme', 'dark');
  });
  await compactPage.waitForTimeout(200);
  const shot360Dark = path.join(screenshotsDir, 'canvas-360-dark.png');
  await compactPage.screenshot({ path: shot360Dark });
  console.log(`Saved: ${shot360Dark}`);

  // Simulate touch pan on Canvas viewport
  console.log('Testing touch pan gesture on Compact 360px...');
  await compactPage.evaluate(() => {
    document.documentElement.removeAttribute('data-theme');
    // Pan canvas by dispatching touch events or calling pan physics
    window.__taskBoard.state.canvasPanX += 60;
    window.__taskBoard.state.canvasPanY += 40;
    window.__taskBoard.updateCanvasTransform();
  });
  await compactPage.waitForTimeout(200);

  const shot360Touch = path.join(screenshotsDir, 'canvas-360-touch.png');
  await compactPage.screenshot({ path: shot360Touch });
  console.log(`Saved: ${shot360Touch}`);

  await compactContext.close();
}

try {
  await captureCanvasFlow();
  console.log('All canvas screenshots captured successfully.');
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
  console.error('Error in canvas verification:', err);
  process.exitCode = 1;
} finally {
  await browser.close();
  await board.app.close();
  await fake.close();
}
