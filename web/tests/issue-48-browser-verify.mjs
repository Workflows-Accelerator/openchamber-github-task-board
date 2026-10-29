// Synthetic GitHub + throwaway local board only. No production credentials or data.
// PLAYWRIGHT_CORE can point to an existing playwright-core installation; no dependency added.
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { startFakeGitHub, makeIssue } from './fake-github.mjs';
import { startBoard, BOARD_PASSWORD } from './helpers.mjs';

const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_CORE || '/workspace/.npm/_npx/e41f203b7505f1fb/node_modules/playwright-core/index.mjs'));
const output = process.env.SCREENSHOT_DIR || path.resolve('.agents/run/issue-48-web-correction/verifications/screenshots');
await mkdir(output, { recursive: true });
await mkdir('/tmp/antigravity', { recursive: true });
const directory = await mkdtemp('/tmp/antigravity/issue48-browser-');
const primary = 'Workflows-Accelerator/openchamber-github-task-board';
const second = 'owner/a-very-long-project-name-that-will-not-fit-in-one-line-on-a-small-phone';
const synthetic = (number, title, stage, body = '', priority = 'useful') => makeIssue({ number, title, labels: ['status:' + stage, 'priority:' + priority], body, repo: primary });
const fake = await startFakeGitHub({ honorIfMatch: true, repositories: [
  { repo: primary, issues: [
    synthetic(1, 'Capture ideas without starting an agent', 'draft', 'A plain list of inspiration for later.\n\n<!-- board-order: 1000 -->'),
    synthetic(2, 'Make project switching effortless', 'draft', 'Keep context visible on small screens.\n\n<!-- board-order: 2000 -->'),
    synthetic(3, 'Approve the phone layout', 'needs-human', '## Overview\nReview the latest layout on your phone.\n\n## Human Tasks\n- [ ] Approve the spacing and touch targets\n\n## Open Questions\n- [ ] Prefer compact or comfortable rows?', 'important'),
    synthetic(4, 'Ship the accessible filter sheet', 'in-progress', '## Overview\nOne filter control, removable chips.\n\nDepends on #3\n\n## Actionable Subtasks\n- [x] Add filter chips\n- [ ] Check keyboard focus', 'critical'),
    synthetic(5, 'Document project naming', 'in-review', 'Depends on #4\n\n## Human Tasks\n- [x] Confirm short-name examples'),
    synthetic(6, 'Keep the default view simple', 'done', 'A completed design decision.', 'optional'),
  ] },
  { repo: second, issues: [makeIssue({ number: 1, title: 'Explore a second project', labels: ['status:draft'], body: 'Optional context\n\n<!-- board-order: 3000 -->', repo: second })] },
] });
let board, browser;
const errors = [], screenshots = [], checks = [];
try {
  board = await startBoard(fake, { sessionFilePath: path.join(directory, 'sessions.json') });
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/workspace/.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell', headless: true, args: ['--no-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  const page = await context.newPage();
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(board.url);
  await page.locator('#password').fill(BOARD_PASSWORD);
  await page.locator('#login-btn').click();
  await page.locator('#board-view').waitFor({ state: 'visible' });
  assert.equal(await page.locator('#view-btn').innerText(), 'View: Simple list');
  assert.equal(await page.locator('#sort-btn').innerText(), 'Sort: Priority');
  assert.equal(await page.evaluate(() => localStorage.length + sessionStorage.length), 0);
  checks.push('Default simple list, no filters, priority sort, zero initial storage');
  async function chooseView(label) {
    await page.locator('#view-btn').click();
    await page.getByRole('button', { name: label, exact: true }).click();
  }
  async function chooseSort(label) {
    await page.locator('#sort-btn').click();
    await page.getByRole('button', { name: label, exact: true }).click();
  }
  async function capture(name) {
    await page.evaluate(() => window.scrollTo(0, 0));
    const filename = path.join(output, 'issue-48-web-' + name + '.png');
    await page.screenshot({ path: filename }); screenshots.push(filename);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'No horizontal page overflow: ' + name);
  }
  for (const [width, height] of [[390, 844], [1280, 800]]) {
    await page.setViewportSize({ width, height });
    for (const [id, label] of Object.entries({ simple: 'Simple list', cards: 'Cards', kanban: 'Kanban board', graph: 'Graph', pending: 'Pending items' })) {
      await chooseView(label); await capture(width + '-' + height + '-' + id);
    }
    await chooseView('Simple list');
    await page.locator('#filter-btn').click();
    await page.getByRole('button', { name: 'draft', exact: true }).click();
    await page.locator('#sheet-close').click();
    await chooseSort('Manual order');
    await capture(width + '-' + height + '-drafts');
    await page.getByRole('button', { name: 'Clear', exact: true }).click();
  }
  checks.push('All five views and draft list at both requested sizes; no horizontal page overflow');
  await page.setViewportSize({ width: 360, height: 800 });
  await page.locator('#filter-btn').click();
  await page.getByRole('button', { name: 'draft', exact: true }).click();
  await page.locator('#sheet-close').click();
  await chooseSort('Manual order');
  await capture('360-800-long-project-drafts');
  await page.locator('#quick-add-form').scrollIntoViewIfNeeded();
  const addRowShot = path.join(output, 'issue-48-web-360-800-add-row-bottom.png');
  await page.screenshot({ path: addRowShot }); screenshots.push(addRowShot);
  await page.locator('#view-btn').click();
  const sheetShot = path.join(output, 'issue-48-web-360-800-view-sheet.png');
  await page.screenshot({ path: sheetShot }); screenshots.push(sheetShot);
  await page.locator('#sheet-close').click();
  const targets = await page.locator('#board-view button:visible, #board-view select:visible, #board-view input:visible, #board-view textarea:visible').evaluateAll((nodes) => nodes.map((node) => ({ name: node.getAttribute('aria-label') || node.textContent, height: node.getBoundingClientRect().height })).filter((node) => node.height < 44));
  assert.deepEqual(targets, [], 'Every visible board target is at least 44px tall');
  checks.push('360px long project names do not overflow; all visible board targets at least 44px');
  await page.locator('#quick-add-input').fill('Browser captured draft');
  await page.locator('#quick-add-description').fill('Optional browser inspiration');
  await page.locator('#quick-add-input').press('Enter');
  await page.getByRole('textbox', { name: 'Title: Browser captured draft', exact: true }).waitFor();
  const captured = fake.repositories[0].issues.find((issue) => issue.title === 'Browser captured draft');
  assert.ok(captured); assert.equal(captured.labels.some((label) => label.name === 'status:draft'), true);
  assert.match(captured.body, /Optional browser inspiration/);
  const draft = page.locator('.draft-row').filter({ has: page.getByRole('textbox', { name: 'Title: Browser captured draft', exact: true }) });
  await draft.locator('.draft-title').fill('Edited browser draft');
  await draft.locator('.draft-description').fill('Edited description');
  await draft.getByRole('button', { name: 'Save', exact: true }).click();
  await page.getByRole('textbox', { name: 'Title: Edited browser draft', exact: true }).waitFor();
  assert.equal(captured.title, 'Edited browser draft');
  checks.push('Enter creates status:draft issue with description; inline title and description save');
  const orderedBefore = await page.locator('.draft-title').evaluateAll((nodes) => nodes.map((node) => node.value));
  const writesBefore = fake.patchCalls.length;
  await page.getByRole('button', { name: 'Move up: Edited browser draft', exact: true }).click();
  await page.waitForFunction((before) => document.querySelectorAll('.draft-title')[2].value !== before, orderedBefore[2]);
  assert.equal(fake.patchCalls.length, writesBefore + 1);
  assert.deepEqual(Object.keys(fake.patchCalls.at(-1).payload), ['body']);
  checks.push('Accessible reorder writes only moved item body marker');
  // Real pointer events through the touch-capable browser context.
  const firstHandle = page.locator('.drag-handle').first(), secondHandle = page.locator('.drag-handle').nth(1);
  await firstHandle.scrollIntoViewIfNeeded();
  const a = await firstHandle.boundingBox(), b = await secondHandle.boundingBox();
  const pointerWrites = fake.patchCalls.length;
  await page.mouse.move(a.x + 20, a.y + 20); await page.mouse.down();
  await page.mouse.move(b.x + 20, b.y + 20, { steps: 8 }); await page.mouse.up();
  await page.waitForFunction(() => !window.__taskBoard.state.draftBusy);
  await page.waitForTimeout(100);
  assert.equal(fake.patchCalls.length, pointerWrites + 1);
  checks.push('Pointer drag reorder in touch-capable browser');
  await context.setOffline(true);
  await page.locator('#quick-add-input').fill('Offline browser idea');
  await page.locator('#quick-add-description').fill('Offline description');
  await page.locator('#quick-add-input').press('Enter');
  await page.getByRole('textbox', { name: 'Title: Offline browser idea', exact: true }).waitFor();
  assert.ok(await page.locator('.badge-offline').count());
  const offline = page.locator('.draft-row').filter({ has: page.getByRole('textbox', { name: 'Title: Offline browser idea', exact: true }) });
  await offline.getByRole('button', { name: 'Move up: Offline browser idea', exact: true }).click();
  assert.ok(await page.evaluate(() => JSON.parse(localStorage.openchamber_offline_drafts)[0].order));
  await context.setOffline(false);
  await page.waitForFunction(() => !localStorage.getItem('openchamber_offline_drafts'));
  assert.ok(fake.repositories[0].issues.some((issue) => issue.title === 'Offline browser idea' && /Offline description/.test(issue.body)));
  checks.push('Offline quick capture + local reorder + automatic sync preserve description');
  await page.locator('#settings-btn').click();
  const rename = page.locator('.rename-project').filter({ has: page.getByRole('textbox', { name: 'Project name for ' + primary, exact: true }) });
  await rename.getByRole('textbox').fill('Renamed Board');
  await rename.getByRole('button', { name: 'Save name' }).click();
  await rename.getByRole('status').filter({ hasText: 'Saved.' }).waitFor();
  await page.locator('#sheet-close').click();
  assert.ok((await page.locator('.draft-project').first().innerText()).includes('Renamed Board'));
  checks.push('Settings rename persists and updates short project labels');
  await page.reload(); await page.locator('#board-view').waitFor({ state: 'visible' });
  assert.equal(await page.locator('#view-btn').innerText(), 'View: Simple list');
  assert.equal(await page.locator('#sort-btn').innerText(), 'Sort: Manual order');
  assert.equal(await page.locator('.filter-chip').innerText(), 'draft ×');
  checks.push('View/filter/sort remembered across page reload; sign-in session retained');
  await page.locator('#view-btn').focus(); await page.keyboard.press('Enter');
  assert.equal(await page.locator('#board-sheet').evaluate((node) => node.open), true);
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#view-btn').evaluate((node) => node === document.activeElement), true);
  checks.push('Keyboard opens sheet; Escape returns focus to opener');
  // Native touch pointer path, not only mouse emulation.
  await page.locator('.drag-handle').first().scrollIntoViewIfNeeded();
  const touchFrom = await page.locator('.drag-handle').first().boundingBox();
  const touchTo = await page.locator('.drag-handle').nth(1).boundingBox();
  const touchWrites = fake.patchCalls.length;
  const cdp = await context.newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: touchFrom.x + 20, y: touchFrom.y + 20 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: touchTo.x + 20, y: touchTo.y + 20 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForFunction(() => !window.__taskBoard.state.draftBusy);
  assert.equal(fake.patchCalls.length, touchWrites + 1);
  checks.push('Native CDP touch drag sends exactly one marker write');
  // Target project selection requires confirmation (zero writes on cancel) and transfers via native GraphQL transferIssue.
  const moveTitle = 'Edited browser draft';
  const movingRow = page.locator('.draft-row').filter({ has: page.getByRole('textbox', { name: 'Title: ' + moveTitle, exact: true }) });
  page.once('dialog', (dialog) => dialog.dismiss());
  await movingRow.locator('.draft-project').selectOption(second);
  assert.equal(fake.state.graphqlCalls.length, 0);
  assert.equal(await movingRow.locator('.draft-project').inputValue(), primary);
  page.once('dialog', (dialog) => dialog.accept());
  await movingRow.locator('.draft-project').selectOption(second);
  await page.waitForFunction((full) => window.__taskBoard.state.board.issues.some((issue) => issue.title === 'Edited browser draft' && issue.repository.full === full), second);
  assert.equal(fake.state.graphqlCalls.length, 1);
  assert.equal(fake.repositories[0].issues.find((issue) => issue.title === moveTitle), undefined);
  assert.equal(fake.repositories[1].issues.find((issue) => issue.title === moveTitle).state, 'open');
  checks.push('Browser project picker confirms transfer, sends zero writes on cancel, and transfers via native GraphQL without copy/close');
  // Marker absent from drawer text fields and rendered text; closing restores focus to opener.
  const drawerRow = page.locator('.draft-row').filter({ has: page.getByRole('textbox', { name: 'Title: Capture ideas without starting an agent', exact: true }) });
  await drawerRow.getByRole('button', { name: 'Open task 1', exact: true }).click();
  await page.locator('#detail-view').waitFor({ state: 'visible' });
  assert.doesNotMatch(await page.locator('#detail-view').innerText(), /board-order/);
  assert.doesNotMatch(await page.locator('#overview-text').inputValue(), /board-order/);
  assert.ok(await page.locator('#detail-meta a.github-link').count());
  await page.locator('#back-btn').click();
  assert.equal(await page.evaluate(() => document.activeElement && document.activeElement.getAttribute('aria-label')), 'Open task 1');
  checks.push('Drawer body and overview never display order marker; GitHub link shown; close restores focus to opener');
  // Empty matching results retain Clear and add row, not a blank broken board.
  await page.locator('#filter-btn').click();
  await page.getByRole('button', { name: 'Questions', exact: true }).click();
  await page.locator('#sheet-close').click();
  await page.locator('#empty-state').waitFor({ state: 'visible' });
  assert.match(await page.locator('#empty-state').innerText(), /No tasks match/);
  assert.equal(await page.getByRole('button', { name: 'Clear', exact: true }).isVisible(), true);
  await capture('360-800-empty-filter');
  checks.push('Empty filter state remains actionable with Clear and draft add row');
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ checks, screenshots, pageErrors: errors }, null, 2));
  await writeFile(path.join(directory, 'report.json'), JSON.stringify({ checks, screenshots, pageErrors: errors }, null, 2));
} finally {
  if (browser) await browser.close(); if (board) await board.app.close(); await fake.close();
  await rm(directory, { recursive: true, force: true });
}
