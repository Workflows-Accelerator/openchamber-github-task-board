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
<!-- board-canvas: {"x":80,"y":80,"notes":[{"id":"note-1","text":"### Acceptance Plan\\n- [x] Trace propagation\\n- [ ] Benchmark < 2ms\\n\\n\`\`\`ts\\nconst tracer = trace.getTracer('board');\\n\`\`\`","color":"yellow","x":80,"y":270,"w":240,"h":175}]} -->
`,
  }),
  makeIssue({
    number: 102,
    title: 'Implement collapsible sidebar navigation',
    labels: ['status:done', 'priority:medium'],
    repo: 'chamberos/core',
    body: `## Overview
Provide unified navigation entries with collapsible rail and responsive overlay.

<!-- board-order: 200 -->
<!-- board-canvas: {"x":460,"y":80,"notes":[{"id":"note-2","text":"**Design System**\\nSidebar rail with *warm paper* aesthetic and collapse toggle.","color":"blue","x":460,"y":270,"w":230,"h":130}]} -->
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
<!-- board-canvas: {"x":840,"y":80,"notes":[{"id":"note-3","text":"Requires review on contrast tokens and muted sticky colors.","color":"pink","x":840,"y":270,"w":230,"h":130}]} -->
`,
  }),
  makeIssue({
    number: 104,
    title: 'Cross-repo dependency synchronization',
    labels: ['status:in-progress', 'priority:medium'],
    repo: 'chamberos/core',
    body: `## Overview
Synchronize cross-repo blocking dependencies cleanly.

<!-- board-order: 400 -->
<!-- board-canvas: {"x":80,"y":520} -->
`,
  }),
  makeIssue({
    number: 105,
    title: 'Verification pipeline automation',
    labels: ['status:todo', 'priority:low'],
    repo: 'chamberos/core',
    body: `## Overview
Automate verification runs across multi-viewport suites.

<!-- board-order: 500 -->
<!-- board-canvas: {"x":460,"y":520} -->
`,
  }),
  makeIssue({
    number: 106,
    title: 'Performance benchmark and memory profiling',
    labels: ['status:todo', 'priority:medium'],
    repo: 'chamberos/core',
    body: `## Overview
Benchmark canvas render latency and memory allocations.

<!-- board-order: 600 -->
<!-- board-canvas: {"x":840,"y":520} -->
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
          body: `## Overview\r\nEvent bus distribution for multi-repo orchestration.\r\n\r\n<!-- board-order: 700 -->\r\n<!-- board-canvas: {"x":80,"y":800,"notes":[{"id":"note-4","text":"Cross-repo broker service configured on Redis pubsub.","color":"green","x":80,"y":990,"w":240,"h":120}]} -->\r\n`,
        }),
      ],
    },
  ],
  honorIfMatch: true,
});

// Setup dependencies:
fake.addDependency(102, 101, 'chamberos/core', 'chamberos/core');
fake.addDependency(103, 102, 'chamberos/core', 'chamberos/core');
fake.addDependency(106, 103, 'chamberos/core', 'chamberos/core');
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

async function captureNotesAndArrangeFlow() {
  // ==========================================
  // 1. Desktop 1280px tests & screenshots
  // ==========================================
  console.log('Starting Desktop 1280px Notes & Arrange verification...');
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
  await page.waitForTimeout(600);

  // Shot 1: Desktop Canvas Notes (Light Theme)
  // Shows notes attached to cards (#101, #102, #103) with connector lines
  const shot1280Notes = path.join(screenshotsDir, 'canvas-notes-1280.png');
  await page.screenshot({ path: shot1280Notes });
  console.log(`Saved: ${shot1280Notes}`);

  // Shot 2: Note edit mode on #101
  console.log('Entering edit mode on Note 1...');
  const note1 = page.locator('.canvas-sticky-note[data-note-id="note-1"]');
  const editBtn = note1.locator('.btn-edit');
  await editBtn.click();
  await note1.locator('.canvas-note-textarea').waitFor({ state: 'visible' });
  await page.waitForTimeout(300);

  const shot1280Edit = path.join(screenshotsDir, 'canvas-note-editing-1280.png');
  await page.screenshot({ path: shot1280Edit });
  console.log(`Saved: ${shot1280Edit}`);

  // Save the edit via Escape or button
  const saveBtn = note1.locator('.canvas-note-editor-actions button.primary');
  await saveBtn.click();
  await page.waitForTimeout(300);

  // Shot 3: Note delete inline confirmation
  console.log('Triggering delete confirmation on Note 2...');
  const note2 = page.locator('.canvas-sticky-note[data-note-id="note-2"]');
  const delBtn = note2.locator('.btn-delete');
  await delBtn.click();
  await note2.locator('.canvas-note-del-confirm').waitFor({ state: 'visible' });
  await page.waitForTimeout(300);

  const shot1280DelConfirm = path.join(screenshotsDir, 'canvas-note-delete-confirm-1280.png');
  await page.screenshot({ path: shot1280DelConfirm });
  console.log(`Saved: ${shot1280DelConfirm}`);

  // Cancel deletion
  const cancelDelBtn = note2.locator('.canvas-note-del-confirm .confirm-no');
  await cancelDelBtn.click();
  await page.waitForTimeout(200);

  // Shot 4: Dark Theme Canvas Notes
  console.log('Switching to Dark Theme...');
  await page.evaluate(() => {
    document.documentElement.setAttribute('data-theme', 'dark');
  });
  await page.waitForTimeout(400);

  const shot1280Dark = path.join(screenshotsDir, 'canvas-notes-dark-1280.png');
  await page.screenshot({ path: shot1280Dark });
  console.log(`Saved: ${shot1280Dark}`);

  // Switch back to light theme
  await page.evaluate(() => {
    document.documentElement.setAttribute('data-theme', 'light');
  });
  await page.waitForTimeout(300);

  // Shot 5: Arrange Confirmation Dialog
  console.log('Opening Arrange dialog...');
  const arrangeBtn = page.locator('#canvas-arrange');
  await arrangeBtn.click();
  await page.locator('#canvas-arrange-dialog').waitFor({ state: 'visible' });
  await page.waitForTimeout(300);

  const shot1280ArrangeDialog = path.join(screenshotsDir, 'canvas-arrange-dialog-1280.png');
  await page.screenshot({ path: shot1280ArrangeDialog });
  console.log(`Saved: ${shot1280ArrangeDialog}`);

  // Select "All cards" option and execute arrange
  console.log('Executing Arrange for all cards...');
  await page.evaluate(() => document.getElementById('arrange-scope-all').click());
  await page.waitForTimeout(200);
  await page.locator('#arrange-confirm-btn').click();
  // Wait for batch save progress and dialog auto-close
  await page.waitForTimeout(3000);

  // Shot 6: Canvas Arranged with project bands, topological ranks, and undo button
  const shot1280Arranged = path.join(screenshotsDir, 'canvas-arranged-1280.png');
  await page.screenshot({ path: shot1280Arranged });
  console.log(`Saved: ${shot1280Arranged}`);

  // Shot 7: Undo Arrange
  console.log('Testing Undo Arrange...');
  const undoBtn = page.locator('#canvas-arrange-undo');
  await undoBtn.waitFor({ state: 'visible' });
  await undoBtn.click();
  await page.waitForTimeout(1000);

  const shot1280Undo = path.join(screenshotsDir, 'canvas-arrange-undo-1280.png');
  await page.screenshot({ path: shot1280Undo });
  console.log(`Saved: ${shot1280Undo}`);

  // Shot 8: Detail Drawer "+ Note" button
  console.log('Inspecting Detail Drawer + Note button...');
  const card101 = page.locator('.canvas-card[data-issue-number="101"]');
  await card101.click();
  await page.locator('#detail-view').waitFor({ state: 'visible' });
  await page.waitForTimeout(400);

  const shot1280DrawerNote = path.join(screenshotsDir, 'canvas-drawer-add-note-1280.png');
  await page.screenshot({ path: shot1280DrawerNote });
  console.log(`Saved: ${shot1280DrawerNote}`);

  await page.locator('#back-btn').click();
  await page.waitForTimeout(300);
  await desktopContext.close();

  // ==========================================
  // 2. Tablet 768px tests & screenshots
  // ==========================================
  console.log('Starting Tablet 768px verification...');
  const tabletContext = await browser.newContext({
    viewport: { width: 768, height: 1024 },
    serviceWorkers: 'block',
  });
  const tabletPage = await tabletContext.newPage();

  await tabletPage.goto(board.url);
  await tabletPage.locator('#password').fill(BOARD_PASSWORD);
  await tabletPage.locator('#login-btn').click();
  await tabletPage.locator('#board-view').waitFor({ state: 'visible' });
  await tabletPage.waitForTimeout(400);

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
  await tabletPage.waitForTimeout(500);

  await tabletPage.evaluate(() => {
    document.body.classList.remove('sidebar-open');
    const backdrop = document.getElementById('sidebar-backdrop');
    if (backdrop) backdrop.hidden = true;
  });
  await tabletPage.waitForTimeout(200);

  const shot768Notes = path.join(screenshotsDir, 'canvas-notes-768.png');
  await tabletPage.screenshot({ path: shot768Notes });
  console.log(`Saved: ${shot768Notes}`);

  await tabletPage.evaluate(() => {
    document.documentElement.setAttribute('data-theme', 'dark');
  });
  await tabletPage.waitForTimeout(400);

  const shot768NotesDark = path.join(screenshotsDir, 'canvas-notes-768-dark.png');
  await tabletPage.screenshot({ path: shot768NotesDark });
  console.log(`Saved: ${shot768NotesDark}`);

  await tabletContext.close();

  // ==========================================
  // 3. Mobile 360px tests & screenshots
  // ==========================================
  console.log('Starting Mobile 360px verification...');
  const mobileContext = await browser.newContext({
    viewport: { width: 360, height: 740 },
    serviceWorkers: 'block',
  });
  const mobilePage = await mobileContext.newPage();

  await mobilePage.goto(board.url);
  await mobilePage.locator('#password').fill(BOARD_PASSWORD);
  await mobilePage.locator('#login-btn').click();
  await mobilePage.locator('#board-view').waitFor({ state: 'visible' });
  await mobilePage.waitForTimeout(400);

  const mobileSidebarToggle = mobilePage.locator('#sidebar-toggle-btn-compact');
  if (await mobileSidebarToggle.isVisible()) {
    await mobileSidebarToggle.click();
    await mobilePage.waitForTimeout(300);
    await mobilePage.locator('#nav-canvas').click();
    await mobilePage.waitForTimeout(300);
  } else {
    await mobilePage.locator('#nav-canvas').click();
  }
  await mobilePage.locator('#canvas-viewport').waitFor({ state: 'visible' });
  await mobilePage.waitForTimeout(500);

  await mobilePage.evaluate(() => {
    document.body.classList.remove('sidebar-open');
    const backdrop = document.getElementById('sidebar-backdrop');
    if (backdrop) backdrop.hidden = true;
  });
  await mobilePage.waitForTimeout(200);

  const shot360Notes = path.join(screenshotsDir, 'canvas-notes-360.png');
  await mobilePage.screenshot({ path: shot360Notes });
  console.log(`Saved: ${shot360Notes}`);

  // Mobile arrange dialog
  await mobilePage.locator('#canvas-arrange').click();
  await mobilePage.locator('#canvas-arrange-dialog').waitFor({ state: 'visible' });
  await mobilePage.waitForTimeout(300);

  const shot360ArrangeDialog = path.join(screenshotsDir, 'canvas-arrange-dialog-360.png');
  await mobilePage.screenshot({ path: shot360ArrangeDialog });
  console.log(`Saved: ${shot360ArrangeDialog}`);

  await mobilePage.locator('#arrange-cancel-btn').click();
  await mobilePage.waitForTimeout(200);

  await mobilePage.evaluate(() => {
    document.documentElement.setAttribute('data-theme', 'dark');
  });
  await mobilePage.waitForTimeout(400);

  const shot360NotesDark = path.join(screenshotsDir, 'canvas-notes-360-dark.png');
  await mobilePage.screenshot({ path: shot360NotesDark });
  console.log(`Saved: ${shot360NotesDark}`);

  await mobileContext.close();

  // Close browser and servers
  await browser.close();
  await board.app.close();
  await fake.close();

  console.log('--- Verification Run Finished ---');
  console.log('Console Errors:', consoleErrors);
  console.log('CSP Violations:', cspViolations);
}

await captureNotesAndArrangeFlow();
