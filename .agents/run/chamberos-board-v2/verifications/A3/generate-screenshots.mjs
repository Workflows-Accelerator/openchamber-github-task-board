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
Provide unified navigation entries with collapsible rail and responsive overlay.

### Acceptance Criteria:
- [x] Navigation entries declared
- [x] Keyboard toggle via sidebar button

<!-- board-order: 200 -->
<!-- board-canvas: {"x":450,"y":80} -->
`,
  }),
  makeIssue({
    number: 103,
    title: 'Warm paper light and dark theme palette',
    labels: ['status:needs-human', 'priority:high'],
    repo: 'chamberos/core',
    body: `## Overview
Deliver cream / charcoal warm paper tones conforming to CSP and Linear aesthetics.

<!-- board-order: 300 -->
<!-- board-canvas: {"x":820,"y":80} -->
`,
  }),
  makeIssue({
    number: 106,
    title: 'Performance benchmark and memory profiling',
    labels: ['status:todo', 'priority:medium'],
    repo: 'chamberos/core',
    body: `## Overview
Benchmark canvas render latency and memory allocations.

<!-- board-order: 400 -->
<!-- board-canvas: {"x":1190,"y":80} -->
`,
  }),
  makeIssue({
    number: 104,
    title: 'Cross-repo dependency synchronization',
    labels: ['status:in-progress', 'priority:medium'],
    repo: 'chamberos/core',
    body: `## Overview
Synchronize cross-repo blocking dependencies cleanly.

### Actionable Subtasks Checklist:
- [ ] Blocked by #101

<!-- board-order: 500 -->
<!-- board-canvas: {"x":80,"y":320} -->
`,
  }),
  makeIssue({
    number: 105,
    title: 'Verification pipeline automation',
    labels: ['status:todo', 'priority:low'],
    repo: 'chamberos/core',
    body: `## Overview
Automate verification runs across multi-viewport suites.

<!-- board-order: 600 -->
<!-- board-canvas: {"x":450,"y":320} -->
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
      repo: 'chamberos/satellite',
      issues: [
        makeIssue({
          number: 201,
          title: 'Distributed pub/sub event bus',
          labels: ['status:in-progress', 'priority:high'],
          repo: 'chamberos/satellite',
          body: `## Overview\r\nEvent bus distribution for multi-repo orchestration.\r\n\r\n<!-- board-order: 700 -->\r\n<!-- board-canvas: {"x":80,"y":560} -->\r\n`,
        }),
      ],
    },
  ],
  honorIfMatch: true,
});

// Setup native dependencies:
// 101 blocks 102 (neutral/open wire: blocker 101 is in-progress)
fake.addDependency(102, 101, 'chamberos/core', 'chamberos/core');

// 102 blocks 103 (done wire: blocker 102 is done)
fake.addDependency(103, 102, 'chamberos/core', 'chamberos/core');

// 103 blocks 106 (warning wire: blocker 103 is needs-human)
fake.addDependency(106, 103, 'chamberos/core', 'chamberos/core');

// Cross-repo dependency: 201 in satellite blocks 104 in core
fake.addDependency(104, 201, 'chamberos/core', 'chamberos/satellite');

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

async function captureDependenciesFlow() {
  // ==========================================
  // 1. Desktop 1280px tests & screenshots
  // ==========================================
  console.log('Starting Desktop 1280px Dependency & Wire verification...');
  const desktopContext = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    serviceWorkers: 'block',
  });
  const page = await desktopContext.newPage();

  page.on('console', (msg) => {
    const type = msg.type();
    const text = msg.text();
    if (type === 'error') consoleErrors.push(`[1280px] ${text}`);
    if (text.includes('Content-Security-Policy') || text.includes('CSP')) cspViolations.push(`[1280px] ${text}`);
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
  await page.waitForTimeout(500);

  // Shot 1: Desktop Canvas Wires (Light Theme)
  // Shows Bézier wires:
  // - 101 -> 102 (wire-open, neutral)
  // - 102 -> 103 (wire-done, green)
  // - 103 -> 106 (wire-warning, warning)
  // - 101 -> 104 (wire-text, dashed neutral)
  const shot1280Wires = path.join(screenshotsDir, 'canvas-wires-1280.png');
  await page.screenshot({ path: shot1280Wires });
  console.log(`Saved: ${shot1280Wires}`);

  // Shot 2: Hover over wire 102 -> 103 (showing hit area, thickened stroke, delete X button)
  console.log('Hovering over wire to inspect hit area and delete button...');
  const wireGroup103 = page.locator('.canvas-wire-group[data-target="103"]');
  const hit103 = wireGroup103.locator('.canvas-wire-hit');
  const delBtn103 = wireGroup103.locator('.canvas-wire-del-btn');
  await hit103.hover({ force: true });
  await page.waitForTimeout(300);

  const shot1280Hover = path.join(screenshotsDir, 'canvas-wire-hover-1280.png');
  await page.screenshot({ path: shot1280Hover });
  console.log(`Saved: ${shot1280Hover}`);

  // Shot 3: Wire delete inline confirmation
  console.log('Clicking delete button once to trigger inline confirmation...');
  await delBtn103.click({ force: true });
  await page.locator('#canvas-wire-confirm').waitFor({ state: 'visible' });
  await page.waitForTimeout(300);

  const shot1280Confirm = path.join(screenshotsDir, 'canvas-wire-del-confirm-1280.png');
  await page.screenshot({ path: shot1280Confirm });
  console.log(`Saved: ${shot1280Confirm}`);

  // Test keyboard Escape dismissal
  await page.keyboard.press('Escape');
  await page.locator('#canvas-wire-confirm').waitFor({ state: 'hidden' });
  await page.waitForTimeout(200);

  // Reset notice
  await page.evaluate(() => {
    const notice = document.getElementById('board-notice');
    if (notice) notice.textContent = '';
  });

  // Shot 4: Interactive Port Drag creation
  // Drag port from card 105 towards card 104
  console.log('Emulating port drag from card #105 towards card #104...');
  const card105 = page.locator('.canvas-card[data-issue-number="105"]');
  const port105 = card105.locator('.canvas-card-port.port-right');
  const port105Box = await port105.boundingBox();
  const card104 = page.locator('.canvas-card[data-issue-number="104"]');
  const card104Box = await card104.boundingBox();

  if (!port105Box || !card104Box) throw new Error('Could not find bounding boxes for cards 105 / 104');

  await page.mouse.move(port105Box.x + port105Box.width / 2, port105Box.y + port105Box.height / 2);
  await page.mouse.down();
  // Move halfway to capture active preview wire & tooltip
  await page.mouse.move(card104Box.x + card104Box.width / 2, card104Box.y + card104Box.height / 2, { steps: 10 });
  await page.waitForTimeout(300);

  const shot1280Drag = path.join(screenshotsDir, 'canvas-port-drag-1280.png');
  await page.screenshot({ path: shot1280Drag });
  console.log(`Saved: ${shot1280Drag}`);

  // Complete drop on card 104 to create the dependency
  console.log('Dropping on card #104 to add native dependency...');
  await page.mouse.up();
  await page.waitForTimeout(600);

  // Shot 5: Wires after drag-and-drop creation
  const shot1280AfterDrag = path.join(screenshotsDir, 'canvas-wires-after-drag-1280.png');
  await page.screenshot({ path: shot1280AfterDrag });
  console.log(`Saved: ${shot1280AfterDrag}`);

  // Shot 6: Dark Theme Canvas Wires
  console.log('Testing Warm Paper Dark Theme Canvas Wires...');
  await page.evaluate(() => {
    document.documentElement.setAttribute('data-theme', 'dark');
  });
  await page.waitForTimeout(300);
  const shot1280Dark = path.join(screenshotsDir, 'canvas-wires-dark-1280.png');
  await page.screenshot({ path: shot1280Dark });
  console.log(`Saved: ${shot1280Dark}`);

  // Restore light theme
  await page.evaluate(() => {
    document.documentElement.removeAttribute('data-theme');
  });
  await page.waitForTimeout(200);

  // Shot 7: Canvas Zoom 0.25 (Min scale)
  console.log('Testing Canvas Zoom 0.25 (Min scale)...');
  await page.evaluate(() => {
    if (window.__app && window.__app.setCanvasZoom) {
      window.__app.setCanvasZoom(0.25);
    }
  });
  await page.waitForTimeout(300);
  const shot1280Zoom025 = path.join(screenshotsDir, 'canvas-wires-zoom-025-1280.png');
  await page.screenshot({ path: shot1280Zoom025 });
  console.log(`Saved: ${shot1280Zoom025}`);

  // Shot 8: Canvas Zoom 2.0 (Max scale)
  console.log('Testing Canvas Zoom 2.0 (Max scale)...');
  await page.evaluate(() => {
    if (window.__app && window.__app.setCanvasZoom) {
      window.__app.setCanvasZoom(2.0);
    }
  });
  await page.waitForTimeout(300);
  const shot1280Zoom20 = path.join(screenshotsDir, 'canvas-wires-zoom-20-1280.png');
  await page.screenshot({ path: shot1280Zoom20 });
  console.log(`Saved: ${shot1280Zoom20}`);

  // Reset zoom to 1.0
  await page.evaluate(() => {
    if (window.__app && window.__app.setCanvasZoom) {
      window.__app.setCanvasZoom(1.0);
    }
  });
  await page.waitForTimeout(200);

  // Shot 9: Detail Drawer Dependencies (Cross-Repo blocker chip)
  console.log('Opening Issue #104 detail drawer to inspect cross-repo dependency...');
  const card104Detail = page.locator('.canvas-card[data-issue-number="104"]');
  await card104Detail.click();
  await page.locator('#detail-view').waitFor({ state: 'visible' });
  await page.waitForTimeout(400);

  // Scroll drawer to dependencies section
  await page.evaluate(() => {
    const sec = document.getElementById('dependencies-title');
    if (sec) sec.scrollIntoView({ behavior: 'instant', block: 'start' });
  });
  await page.waitForTimeout(300);

  const shot1280Drawer = path.join(screenshotsDir, 'canvas-drawer-dependencies-1280.png');
  await page.screenshot({ path: shot1280Drawer });
  console.log(`Saved: ${shot1280Drawer}`);

  // Shot 10: Blocker Type-to-Search Picker
  console.log('Testing Blocker Type-to-Search Picker with filter...');
  const searchInput = page.locator('#add-blocker-search');
  await searchInput.fill('audit');
  await page.locator('#add-blocker-suggestions').waitFor({ state: 'visible' });
  await page.waitForTimeout(300);

  const shot1280Picker = path.join(screenshotsDir, 'canvas-drawer-picker-search-1280.png');
  await page.screenshot({ path: shot1280Picker });
  console.log(`Saved: ${shot1280Picker}`);

  // Shot 11: 403 Forbidden Permission Notice
  console.log('Testing 403 Forbidden permission error handling...');
  fake.setDependencyHook(async () => {
    return { status: 403, payload: { message: 'Must have push access to repository' } };
  });

  const firstOption = page.locator('.add-blocker-option:not(.is-empty)').first();
  await firstOption.click();
  await page.waitForTimeout(400);

  const shot1280403 = path.join(screenshotsDir, 'canvas-dependency-403-notice-1280.png');
  await page.screenshot({ path: shot1280403 });
  console.log(`Saved: ${shot1280403}`);

  fake.setDependencyHook(null);
  await page.evaluate(() => {
    const notice = document.getElementById('board-notice');
    if (notice) notice.textContent = '';
  });

  // Close drawer
  await page.locator('#back-btn').click();
  await page.waitForTimeout(300);

  // Shot 8: List View with "blocked by N" indicator
  console.log('Switching to List view to verify "blocked by N" badge on cards...');
  await page.locator('#nav-list').click();
  await page.locator('#task-list').waitFor({ state: 'visible' });
  await page.waitForTimeout(400);

  const shot1280List = path.join(screenshotsDir, 'list-view-blocked-badge-1280.png');
  await page.screenshot({ path: shot1280List });
  console.log(`Saved: ${shot1280List}`);

  await desktopContext.close();

  // ==========================================
  // 2. Tablet 768px tests & screenshots
  // ==========================================
  console.log('Capturing Tablet 768px Canvas Wires...');
  const tabletContext = await browser.newContext({
    viewport: { width: 768, height: 1024 },
    hasTouch: true,
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

  // Navigate to Canvas view
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

  await tabletPage.evaluate(() => {
    document.body.classList.remove('sidebar-open');
    const backdrop = document.getElementById('sidebar-backdrop');
    if (backdrop) backdrop.hidden = true;
  });
  await tabletPage.waitForTimeout(200);

  // Shot 12: Tablet 768px Light
  const shot768 = path.join(screenshotsDir, 'canvas-wires-768.png');
  await tabletPage.screenshot({ path: shot768 });
  console.log(`Saved: ${shot768}`);

  // Shot 13: Tablet 768px Dark
  await tabletPage.evaluate(() => {
    document.documentElement.setAttribute('data-theme', 'dark');
  });
  await tabletPage.waitForTimeout(200);
  const shot768Dark = path.join(screenshotsDir, 'canvas-wires-768-dark.png');
  await tabletPage.screenshot({ path: shot768Dark });
  console.log(`Saved: ${shot768Dark}`);

  await tabletPage.evaluate(() => {
    document.documentElement.removeAttribute('data-theme');
  });
  await tabletPage.waitForTimeout(200);

  // Shot 14: Tablet Touch port drag preview
  console.log('Testing Touch port drag on Tablet 768px...');
  const card105Tab = tabletPage.locator('.canvas-card[data-issue-number="105"]');
  const port105Tab = card105Tab.locator('.canvas-card-port.port-right');
  const card104Tab = tabletPage.locator('.canvas-card[data-issue-number="104"]');
  const port105BoxTab = await port105Tab.boundingBox();
  const card104BoxTab = await card104Tab.boundingBox();
  if (port105BoxTab && card104BoxTab) {
    await tabletPage.mouse.move(port105BoxTab.x + port105BoxTab.width / 2, port105BoxTab.y + port105BoxTab.height / 2);
    await tabletPage.mouse.down();
    await tabletPage.mouse.move(card104BoxTab.x + card104BoxTab.width / 2, card104BoxTab.y + card104BoxTab.height / 2, { steps: 8 });
    await tabletPage.waitForTimeout(300);
    const shot768TouchDrag = path.join(screenshotsDir, 'canvas-touch-port-drag-768.png');
    await tabletPage.screenshot({ path: shot768TouchDrag });
    console.log(`Saved: ${shot768TouchDrag}`);
    await tabletPage.mouse.up();
    await tabletPage.waitForTimeout(200);
  }

  await tabletContext.close();

  // ==========================================
  // 3. Compact 360px tests & screenshots
  // ==========================================
  console.log('Capturing Compact 360px Canvas Wires & Drawer...');
  const compactContext = await browser.newContext({
    viewport: { width: 360, height: 800 },
    hasTouch: true,
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

  // Open sidebar to navigate to Canvas
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

  await compactPage.evaluate(() => {
    document.body.classList.remove('sidebar-open');
    const backdrop = document.getElementById('sidebar-backdrop');
    if (backdrop) backdrop.hidden = true;
  });
  await compactPage.waitForTimeout(200);

  // Shot 11: Compact 360px Canvas Wires Light
  const shot360 = path.join(screenshotsDir, 'canvas-wires-360.png');
  await compactPage.screenshot({ path: shot360 });
  console.log(`Saved: ${shot360}`);

  // Shot 12: Compact 360px Canvas Wires Dark
  await compactPage.evaluate(() => {
    document.documentElement.setAttribute('data-theme', 'dark');
  });
  await compactPage.waitForTimeout(200);
  const shot360Dark = path.join(screenshotsDir, 'canvas-wires-360-dark.png');
  await compactPage.screenshot({ path: shot360Dark });
  console.log(`Saved: ${shot360Dark}`);

  // Restore light
  await compactPage.evaluate(() => {
    document.documentElement.removeAttribute('data-theme');
  });
  await compactPage.waitForTimeout(200);

  // Shot 13: Compact 360px Detail Drawer Dependencies
  const card102Compact = compactPage.locator('.canvas-card[data-issue-number="102"]');
  await card102Compact.click();
  await compactPage.locator('#detail-view').waitFor({ state: 'visible' });
  await compactPage.waitForTimeout(400);

  await compactPage.evaluate(() => {
    const sec = document.getElementById('dependencies-title');
    if (sec) sec.scrollIntoView({ behavior: 'instant', block: 'start' });
  });
  await compactPage.waitForTimeout(300);

  const shot360Drawer = path.join(screenshotsDir, 'canvas-drawer-dependencies-360.png');
  await compactPage.screenshot({ path: shot360Drawer });
  console.log(`Saved: ${shot360Drawer}`);

  // Close drawer
  await compactPage.locator('#back-btn').click();
  await compactPage.waitForTimeout(300);

  // Shot 14: Compact 360px List View with "blocked by N" badge
  if (await sidebarToggle.isVisible()) {
    await sidebarToggle.click();
    await compactPage.waitForTimeout(300);
    await compactPage.locator('#nav-list').click();
    await compactPage.waitForTimeout(300);
  } else {
    await compactPage.locator('#nav-list').click();
  }
  await compactPage.locator('#task-list').waitFor({ state: 'visible' });
  await compactPage.waitForTimeout(300);

  await compactPage.evaluate(() => {
    document.body.classList.remove('sidebar-open');
    const backdrop = document.getElementById('sidebar-backdrop');
    if (backdrop) backdrop.hidden = true;
  });
  await compactPage.waitForTimeout(200);

  const shot360List = path.join(screenshotsDir, 'list-view-blocked-badge-360.png');
  await compactPage.screenshot({ path: shot360List });
  console.log(`Saved: ${shot360List}`);

  await compactContext.close();
}

try {
  await captureDependenciesFlow();
  console.log('All dependency verification screenshots captured successfully!');
  if (consoleErrors.length > 0) {
    console.error('Console errors logged during test:', consoleErrors);
  }
  if (cspViolations.length > 0) {
    console.error('CSP violations logged during test:', cspViolations);
  }
} finally {
  await browser.close();
  await board.app.close();
  await fake.close();
}
