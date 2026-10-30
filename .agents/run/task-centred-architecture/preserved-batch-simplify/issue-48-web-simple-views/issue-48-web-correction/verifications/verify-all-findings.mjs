import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startFakeGitHub, makeIssue } from '../../../../web/tests/fake-github.mjs';
import { startBoard, HttpSession, BOARD_PASSWORD } from '../../../../web/tests/helpers.mjs';
import { parseOrderMarker, setOrderMarker, stripOrderMarker, midpointOrder, buildBoardListItem } from '../../../../web/server/board.ts';
import { chromium } from '/workspace/.npm/_npx/e41f203b7505f1fb/node_modules/playwright-core/index.mjs';

const out = path.dirname(fileURLToPath(import.meta.url));
const shotsDir = path.join(out, 'screenshots');
await mkdir(shotsDir, { recursive: true });
await mkdir('/tmp/antigravity', { recursive: true });
const data = await mkdtemp('/tmp/antigravity/verify-all-');
const results = [], errors = [], screenshots = [];
function record(name, value) {
  results.push({ name, ...value });
  console.log(JSON.stringify({ name, ...value }));
}

const draft = (number, title, order = null, body = 'Idea', repo = 'owner/alpha') =>
  makeIssue({
    number,
    title,
    body: order === null ? body : body + '\n\n<!-- board-order: ' + order + ' -->',
    labels: ['status:draft'],
    repo,
  });

const fake = await startFakeGitHub({
  honorIfMatch: true,
  repositories: [
    { repo: 'owner/alpha', issues: [draft(1, 'A'), draft(2, 'B'), draft(3, 'C')] },
    {
      repo: 'owner/beta',
      issues: [
        makeIssue({
          number: 1,
          title: 'Beta human',
          labels: ['status:todo'],
          body: '## Overview\nOriginal beta\n\n## Human Tasks\n- [ ] Approve beta\n\n## Open Questions\n- [ ] Decide [a] Yes or [b] No?\n',
          repo: 'owner/beta',
        }),
      ],
    },
  ],
});

let board, browser;
try {
  // F9: Two default-helper boards have completely isolated session + project-name stores.
  const boardA = await startBoard(fake);
  const boardB = await startBoard(fake);
  try {
    const clientA = new HttpSession(boardA.url);
    const clientB = new HttpSession(boardB.url);
    assert.equal((await clientA.login()).status, 200);
    assert.equal((await clientB.login()).status, 200);
    assert.equal(
      (await clientA.request('/api/project-names', { method: 'PUT', body: { repository: 'owner/alpha', name: 'Board A Only' } })).status,
      200,
    );
    const namesA = await clientA.request('/api/project-names');
    const namesB = await clientB.request('/api/project-names');
    assert.equal(namesA.json.projectNames['owner/alpha'], 'Board A Only');
    assert.equal(namesB.json.projectNames['owner/alpha'], undefined);
    assert.notEqual(path.dirname(boardA.sessionFile), path.dirname(boardB.sessionFile));
    record('F9 isolated per-fixture stores', { boardADir: path.dirname(boardA.sessionFile), boardBDir: path.dirname(boardB.sessionFile), leakedToB: Boolean(namesB.json.projectNames['owner/alpha']) });
  } finally {
    await boardA.app.close();
    await boardB.app.close();
  }

  board = await startBoard(fake, { sessionFilePath: path.join(data, 'sessions.json') });
  const client = new HttpSession(board.url);
  assert.equal((await client.login()).status, 200);
  const ep = '/api/repos/owner/alpha/issues/1';
  const get = async (url = ep) => (await client.request(url)).json.issue;

  // F10: batch-align is removed from the standalone web server.
  const batchAlignRes = await client.request('/api/repos/owner/alpha/issues/batch-align', { method: 'POST', body: {} });
  const batchAlignLegacy = await client.request('/api/issues/batch-align', { method: 'POST', body: {} });
  assert.equal(batchAlignRes.status, 404);
  assert.equal(batchAlignLegacy.status, 404);
  record('F10 web batch-align removed', { repoScopedStatus: batchAlignRes.status, legacyStatus: batchAlignLegacy.status });

  // F1: Move requires explicit confirmation (400 without confirmed:true) and uses native GraphQL transferIssue without closing source or commenting.
  const unconfirmedMove = await client.request(ep + '/move', {
    method: 'PUT',
    body: { fingerprint: (await get()).fingerprint, target: 'owner/beta' },
  });
  assert.equal(unconfirmedMove.status, 400);
  assert.equal(unconfirmedMove.json.error, 'confirmation_required');
  assert.equal(fake.state.graphqlCalls.length, 0);

  const confirmedMove = await client.request(ep + '/move', {
    method: 'PUT',
    body: { fingerprint: (await get()).fingerprint, target: 'owner/beta', confirmed: true },
  });
  assert.equal(confirmedMove.status, 200);
  assert.equal(fake.state.graphqlCalls.length, 1);
  assert.equal(fake.findIssue(1, 'owner/alpha'), null);
  assert.equal(fake.findIssue(2, 'owner/beta').state, 'open');
  assert.equal(fake.findIssue(2, 'owner/beta').title, 'A');
  record('F1 confirmed native GraphQL transferIssue', {
    unconfirmedStatus: unconfirmedMove.status,
    confirmedStatus: confirmedMove.status,
    graphqlCalls: fake.state.graphqlCalls.length,
    transferredIssueNumber: confirmedMove.json.issue.number,
    transferredRepo: confirmedMove.json.issue.repository.full,
  });

  // Restore alpha issues for subsequent probes.
  fake.repositories[1].issues = fake.repositories[1].issues.filter((i) => i.number === 1);

  // F3 & F7: Byte-preserving unfenced terminal marker & fence-aware dependency parser.
  const raw =
    '## Overview\r\nOriginal\r\n\r\n## Notes\r\n```md\r\n<!-- board-order: 42 -->\r\n```\r\n\r\n## Overview\r\nKeep second heading  \r\n<!-- board-ordering: 7 -->\r\n\r\n<!-- board-order: 1000 -->';
  fake.repositories[0].issues = [draft(1, 'Fenced sample', null, raw)];
  const rewritten = await client.request(ep + '/order', {
    method: 'PUT',
    body: { fingerprint: (await get()).fingerprint, previous: 1000, next: 2000 },
  });
  const persisted = fake.findIssue(1).body;
  assert.equal(rewritten.status, 200);
  assert.equal(persisted.includes('<!-- board-order: 42 -->'), true);
  assert.equal(persisted.includes('Keep second heading  \r\n<!-- board-ordering: 7 -->'), true);
  const whitespace = 'Keep this hard break  \r\n\r\n';
  assert.equal(stripOrderMarker(setOrderMarker(whitespace, 1000)), whitespace);
  const depChecklist = buildBoardListItem(draft(1, 'dep', null, '- [ ] Blocked by #2')).dependencies;
  const depFenced = buildBoardListItem(draft(1, 'dep', null, '```md\nDepends on #2\n```')).dependencies;
  assert.deepEqual(depChecklist, [2]);
  assert.deepEqual(depFenced, []);
  record('F3 & F7 byte-safe marker and fence-aware dependency parser', {
    fencedMarkerPreserved: persisted.includes('<!-- board-order: 42 -->'),
    trailingWhitespaceRestored: stripOrderMarker(setOrderMarker(whitespace, 1000)) === whitespace,
    depChecklist,
    depFenced,
  });

  // F5 server: Midpoint exhaustion rebalances automatically instead of returning 409, and stale neighbour fingerprints are rejected.
  let lo = 1000, hi = 2000, n = 0;
  while (n < 2000) {
    const mid = midpointOrder(lo, hi);
    if (!(mid > lo && mid < hi)) break;
    hi = mid;
    n++;
  }
  fake.repositories[0].issues = [draft(1, 'Precision', 1500), draft(2, 'Lo', lo), draft(3, 'Hi', hi)];
  const precision = await client.request(ep + '/order', {
    method: 'PUT',
    body: { fingerprint: (await get()).fingerprint, previous: lo, next: hi },
  });
  assert.equal(precision.status, 200);
  assert.ok(parseOrderMarker(fake.findIssue(1).body) > parseOrderMarker(fake.findIssue(2).body));
  assert.ok(parseOrderMarker(fake.findIssue(3).body) > parseOrderMarker(fake.findIssue(1).body));

  fake.repositories[0].issues = [draft(1, 'A', 1000), draft(2, 'B', 2000), draft(3, 'C', 3000)];
  const bInitialFp = (await get('/api/repos/owner/alpha/issues/2')).fingerprint;
  const cfp = (await get('/api/repos/owner/alpha/issues/3')).fingerprint;
  const moveB = await client.request('/api/repos/owner/alpha/issues/2/order', {
    method: 'PUT',
    body: { fingerprint: bInitialFp, previous: 3000, next: null },
  });
  assert.equal(moveB.status, 200);
  const staleNeighbour = await client.request('/api/repos/owner/alpha/issues/3/order', {
    method: 'PUT',
    body: {
      fingerprint: cfp,
      previous: 1000,
      next: 2000,
      neighbours: [{ repo: 'owner/alpha', number: 2, fingerprint: bInitialFp, order: 2000 }],
    },
  });
  assert.equal(staleNeighbour.status, 409);
  record('F5 server rebalance and neighbour conflict detection', {
    precisionStatus: precision.status,
    staleNeighbourStatus: staleNeighbour.status,
  });

  // Browser verification of F2, F4, F5, F6, F8, and #47 stay-signed-in.
  browser = await chromium.launch({
    executablePath: '/workspace/.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell',
    headless: true,
    args: ['--no-sandbox'],
  });
  const context = await browser.newContext({ viewport: { width: 360, height: 800 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(board.url);
  await page.locator('#password').fill(BOARD_PASSWORD);
  await page.locator('#login-btn').click();
  await page.locator('#board-view').waitFor({ state: 'visible' });

  async function reset(rows, view = { view: 'simple', filters: ['stage:draft'], sort: 'manual' }) {
    fake.repositories[0].issues = rows;
    await page.evaluate((v) => {
      window.__taskBoard.state.viewState = v;
      window.__taskBoard.state.draftEdits.clear();
    }, view);
    await page.locator('#refresh-btn').click();
    await page.waitForFunction(() => !window.__taskBoard.state.boardLoads);
  }
  const titles = () => page.locator('.draft-title').evaluateAll((nodes) => nodes.map((n) => n.value));
  async function shot(name) {
    const file = path.join(shotsDir, name + '.png');
    await page.screenshot({ path: file, fullPage: false });
    screenshots.push(file);
    return file;
  }

  // F5 browser: Downward move across all unmarked, marked into unmarked, and equal markers succeeds.
  for (const [name, rows, title, expectedAfter] of [
    ['all unmarked', [draft(1, 'A'), draft(2, 'B'), draft(3, 'C')], 'A', ['B', 'A', 'C', 'Explore']],
    ['marked into unmarked', [draft(1, 'A', 1000), draft(2, 'B'), draft(3, 'C')], 'A', ['B', 'A', 'C']],
    ['equal markers', [draft(1, 'A', 1000), draft(2, 'B', 1000), draft(3, 'C', 1000)], 'A', ['B', 'A', 'C']],
  ]) {
    await reset(rows);
    await page.getByRole('button', { name: 'Move down: ' + title, exact: true }).click();
    await page.waitForFunction(() => !window.__taskBoard.state.draftBusy);
    const after = await titles();
    assert.deepEqual(after.slice(0, 3), expectedAfter.slice(0, 3));
    record('F5 downward reorder succeeds: ' + name, { after, screenshot: await shot('corrected-reorder-' + name.replaceAll(' ', '-')) });
  }

  // F4 browser: Reorder preserves unsaved inline title and updates its observed fingerprint; external refresh does NOT rebase inline edit onto remote change.
  await reset([draft(1, 'A', 1000), draft(2, 'B', 2000), draft(3, 'C', 3000)]);
  await page.getByRole('textbox', { name: 'Title: B', exact: true }).fill('UNSAVED B');
  await page.getByRole('button', { name: 'Move up: B', exact: true }).click();
  await page.waitForFunction(() => !window.__taskBoard.state.draftBusy);
  assert.equal((await titles())[0], 'UNSAVED B');
  record('F4 reorder preserves unsaved inline title', { visibleTitles: await titles() });

  await reset([draft(1, 'Original', 1000, 'Old description')]);
  await page.getByRole('textbox', { name: 'Description: Original', exact: true }).fill('My unsaved description');
  fake.mutateIssue(1, (i) => {
    i.body = 'Other device description\n\n<!-- board-order: 1000 -->';
  });
  await page.locator('#refresh-btn').click();
  await page.waitForFunction(() => !window.__taskBoard.state.boardLoads);
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.waitForFunction(() => !window.__taskBoard.state.draftBusy);
  assert.equal(fake.findIssue(1).body.includes('Other device description'), true);
  assert.match(await page.locator('#notice').innerText(), /changed on GitHub/i);
  record('F4 refresh does not rebase stale inline edit', { persistedBody: fake.findIssue(1).body, notice: await page.locator('#notice').innerText() });

  // F2 browser: Response loss marks item uncertain and does NOT duplicate on reload; partial reconnection syncs remaining queued without resending uncertain; in-flight edit preserved; duplicate titles preserved.
  await reset([draft(1, 'Existing', 1000)]);
  await page.evaluate(() => window.__taskBoard.saveToOfflineQueue('Lost response', 'owner/alpha', 'Keep description', 2000));
  await page.route('**/api/repos/owner/alpha/issues', async (route) => {
    if (route.request().method() !== 'POST') return route.continue();
    await route.fetch();
    await route.abort('connectionfailed');
  });
  await page.evaluate(() => window.__taskBoard.syncOfflineDrafts());
  const queuedAfterLoss = await page.evaluate(() => window.__taskBoard.getOfflineDrafts());
  assert.equal(queuedAfterLoss.length, 1);
  assert.equal(Boolean(queuedAfterLoss[0].uncertain), true);
  await page.unroute('**/api/repos/owner/alpha/issues');
  await page.reload();
  await page.locator('#board-view').waitFor({ state: 'visible' });
  await page.waitForTimeout(150);
  assert.equal(fake.repositories[0].issues.filter((i) => i.title === 'Lost response').length, 1);
  await page.evaluate(() => window.__taskBoard.saveOfflineDrafts([]));
  record('F2 uncertain create held without duplicate resend', { copiesOnServer: fake.repositories[0].issues.filter((i) => i.title === 'Lost response').length });

  // F2 in-flight edit during sync is retained.
  await reset([draft(1, 'Existing', 1000)]);
  await page.evaluate(() => window.__taskBoard.saveToOfflineQueue('In flight', 'owner/alpha', 'Old queued description', 2000));
  let releaseSync, startedSync;
  const waitingSync = new Promise((r) => (startedSync = r));
  const gateSync = new Promise((r) => (releaseSync = r));
  await page.route('**/api/repos/owner/alpha/issues', async (route) => {
    if (route.request().method() !== 'POST') return route.continue();
    startedSync();
    await gateSync;
    await route.continue();
  });
  const syncing = page.evaluate(() => window.__taskBoard.syncOfflineDrafts());
  await waitingSync;
  const offlineRow = page.locator('.draft-row-offline');
  await offlineRow.locator('.draft-description').fill('New during sync');
  await offlineRow.getByRole('button', { name: 'Save', exact: true }).click();
  releaseSync();
  await syncing;
  await page.unroute('**/api/repos/owner/alpha/issues');
  const retainedAfterInFlightEdit = await page.evaluate(() => window.__taskBoard.getOfflineDrafts());
  assert.equal(retainedAfterInFlightEdit.length, 1);
  assert.equal(retainedAfterInFlightEdit[0].description, 'New during sync');
  await page.evaluate(() => window.__taskBoard.saveOfflineDrafts([]));
  record('F2 in-flight offline edit retained in queue', { retainedCount: retainedAfterInFlightEdit.length, description: retainedAfterInFlightEdit[0].description });

  // F2 duplicate offline titles preserved.
  await context.setOffline(true);
  await page.locator('#quick-add-input').fill('Same title');
  await page.locator('#quick-add-description').fill('First description');
  await page.locator('#quick-add-input').press('Enter');
  await page.locator('#quick-add-input').fill('Same title');
  await page.locator('#quick-add-description').fill('Second description');
  await page.locator('#quick-add-input').press('Enter');
  const dupQueue = await page.evaluate(() => window.__taskBoard.getOfflineDrafts().map((d) => ({ title: d.title, description: d.description })));
  assert.equal(dupQueue.length, 2);
  await page.evaluate(() => window.__taskBoard.saveOfflineDrafts([]));
  await context.setOffline(false);
  record('F2 duplicate offline titles preserved', { queue: dupQueue });

  // F6 & F8: Pending items human task completion checkbox + GitHub link + >=44px question option buttons + drawer focus restore.
  await reset([], { view: 'pending', filters: [], sort: 'priority' });
  const pendingButton = page.locator('#task-list .task-row').first();
  await pendingButton.click();
  await page.locator('#detail-view').waitFor({ state: 'visible' });
  const humanCheckboxes = await page.locator('#human-list input[type="checkbox"]').count();
  const githubLinks = await page.locator('#detail-meta a.github-link').count();
  const smallDrawerButtons = await page
    .locator('#detail-view button:visible')
    .evaluateAll((nodes) => nodes.map((n) => ({ label: n.textContent, width: n.getBoundingClientRect().width, height: n.getBoundingClientRect().height })).filter((n) => n.height < 44 || n.width < 44));
  assert.equal(humanCheckboxes, 1);
  assert.equal(githubLinks, 1);
  assert.deepEqual(smallDrawerButtons, []);
  await page.locator('#human-list input[type="checkbox"]').first().check();
  await page.waitForFunction(() => window.__taskBoard.state.detail.humanTasks[0].completed === true);
  assert.match(fake.findIssue(1, 'owner/beta').body, /- \[x\] Approve beta/);
  const drawerShot = await shot('corrected-pending-and-drawer-360');
  await page.locator('#back-btn').click();
  const restoredKey = await page.evaluate(() => document.activeElement && document.activeElement.getAttribute('data-issue-key'));
  assert.equal(restoredKey, 'owner/beta#1');
  record('F6 & F8 human task checkbox, GitHub link, 44px drawer buttons, and focus restoration', {
    humanCheckboxes,
    githubLinks,
    smallDrawerButtons,
    restoredKey,
    screenshot: drawerShot,
  });

  // F4 browser: Same-number Mark Done updates only the target repository, and unchecked checklist items render unchecked while preserving unsaved overview.
  fake.repositories[1].issues[0].body = '## Overview\nOriginal beta\n\n## Acceptance Criteria\n- [ ] Unchecked item\n';
  await reset(
    [
      makeIssue({
        number: 1,
        title: 'Alpha same number',
        labels: ['status:todo'],
        body: '## Overview\nAlpha\n\n## Acceptance Criteria\n- [ ] Alpha unchecked\n',
        repo: 'owner/alpha',
      }),
    ],
    { view: 'simple', filters: [], sort: 'priority' },
  );
  await page.getByRole('button').filter({ hasText: 'Beta human' }).click();
  await page.locator('#detail-view').waitFor({ state: 'visible' });
  assert.equal(await page.locator('#ac-list input[type="checkbox"]').first().isChecked(), false);
  await page.locator('#overview-text').fill('Unsaved overview');
  await page.locator('#ac-list input[type="checkbox"]').first().check();
  await page.waitForFunction(() => window.__taskBoard.state.detail.acceptanceCriteria[0].completed === true);
  assert.equal(await page.locator('#overview-text').inputValue(), 'Unsaved overview');
  await page.locator('#mark-done-btn').click();
  await page.waitForFunction(() => window.__taskBoard.state.detail?.state === 'closed');
  const stateRows = await page.evaluate(() =>
    window.__taskBoard.state.board.issues.filter((i) => i.number === 1).map((i) => ({ repository: i.repository.full, state: i.state })),
  );
  assert.equal(stateRows.find((i) => i.repository === 'owner/alpha').state, 'open');
  assert.equal(stateRows.find((i) => i.repository === 'owner/beta').state, 'closed');
  await page.locator('#back-btn').click();
  record('F4 qualified Mark Done, unchecked checkbox property, and preserved overview draft', { stateRows });

  // F8 browser: Multi-line draft description auto-sizes so scrollHeight <= clientHeight without clipping.
  await reset([draft(1, 'Long description', 1000, 'Line one\nLine two\nLine three'), draft(2, 'Second draft', 2000, 'Short note'), draft(3, 'Third draft', 3000, 'Another note')]);
  const dimensions = await page
    .getByRole('textbox', { name: 'Description: Long description', exact: true })
    .evaluate((n) => ({ clientHeight: n.clientHeight, scrollHeight: n.scrollHeight, value: n.value }));
  assert.ok(dimensions.clientHeight >= dimensions.scrollHeight, `Expected clientHeight (${dimensions.clientHeight}) >= scrollHeight (${dimensions.scrollHeight})`);
  const layoutMetrics = await page.locator('.draft-row').evaluateAll((rows) =>
    rows.map((r) => {
      const rect = r.getBoundingClientRect();
      return { top: Math.round(rect.top), bottom: Math.round(rect.bottom), height: Math.round(rect.height) };
    }),
  );
  record('F8 multi-line draft description auto-sizes without clipping', {
    dimensions,
    layoutMetrics,
    screenshot: await shot('corrected-multiline-description-360'),
  });

  await context.close();

  // F2 cold offline reload with serviceWorker enabled + #47 fresh-app stay-signed-in across server restart.
  const swContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'allow' });
  const swPage = await swContext.newPage();
  swPage.on('pageerror', (e) => errors.push(e.message));
  await swPage.goto(board.url);
  await swPage.locator('#password').fill(BOARD_PASSWORD);
  await swPage.locator('#login-btn').click();
  await swPage.locator('#board-view').waitFor({ state: 'visible' });
  await swPage.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await new Promise((resolve) => navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true }));
    }
  });
  await swPage.evaluate(() => {
    window.__taskBoard.saveToOfflineQueue('Cold offline idea', 'owner/alpha', 'Saved before reload', 1000);
  });
  await swContext.setOffline(true);
  await swPage.reload();
  await swPage.locator('#board-view').waitFor({ state: 'visible' });
  assert.equal(await swPage.locator('#login-view').isHidden(), true);
  assert.equal(await swPage.locator('.draft-row-offline').count(), 1);
  const coldShot = path.join(shotsDir, 'corrected-cold-offline-reload-390.png');
  await swPage.screenshot({ path: coldShot });
  screenshots.push(coldShot);
  record('F2 cold offline reload displays local draft shell instead of login screen', {
    offlineRows: await swPage.locator('.draft-row-offline').count(),
    screenshot: coldShot,
  });
  await swContext.setOffline(false);

  // #47 integration: restart the server process from the same environment (deterministic hash) on the same port and session file; fresh app launch stays signed in.
  const previousPort = Number(new URL(board.url).port);
  await board.app.close();
  board = await startBoard(fake, { sessionFilePath: path.join(data, 'sessions.json'), port: previousPort });
  const freshPage = await swContext.newPage();
  await freshPage.goto(board.url);
  await freshPage.locator('#board-view').waitFor({ state: 'visible' });
  assert.equal(await freshPage.locator('#login-view').isHidden(), true);
  record('Issue #47 fresh-app stay-signed-in preserved after server restart', {
    authenticatedOnFreshTab: await freshPage.locator('#board-view').isVisible(),
  });
  await swContext.close();

  assert.deepEqual(errors, []);
  await writeFile(path.join(out, 'verify-all-findings.json'), JSON.stringify({ results, pageErrors: errors, screenshots }, null, 2));
} finally {
  if (browser) await browser.close();
  if (board) await board.app.close();
  await fake.close();
  await rm(data, { recursive: true, force: true });
}
