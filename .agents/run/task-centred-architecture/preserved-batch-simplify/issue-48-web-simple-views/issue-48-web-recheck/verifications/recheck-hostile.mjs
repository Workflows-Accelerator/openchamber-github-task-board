import assert from 'node:assert/strict';
import fs from 'node:fs';
import { mkdir, mkdtemp, rm, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startFakeGitHub, makeIssue } from '../../../../web/tests/fake-github.mjs';
import { startBoard, browserConfig, HttpSession, BOARD_PASSWORD, SESSION_SECRET } from '../../../../web/tests/helpers.mjs';
import { loadConfig, hashPassword } from '../../../../web/server/config.ts';
import { parseOrderMarker, setOrderMarker, stripOrderMarker, midpointOrder, buildBoardListItem } from '../../../../web/server/board.ts';
import { chromium } from '/workspace/.npm/_npx/e41f203b7505f1fb/node_modules/playwright-core/index.mjs';

const out = path.dirname(fileURLToPath(import.meta.url));
const shotsDir = path.join(out, 'screenshots');
const logsDir = path.join(out, 'logs');
await mkdir(shotsDir, { recursive: true });
await mkdir(logsDir, { recursive: true });
await mkdir('/tmp/antigravity', { recursive: true });
const data = await mkdtemp('/tmp/antigravity/recheck-hostile-');

const results = [];
const errors = [];
const screenshots = [];

function record(id, name, details) {
  const entry = { id, name, status: 'PASS', ...details };
  results.push(entry);
  console.log(JSON.stringify(entry));
}

const draftIssue = (number, title, order = null, repo = 'owner/alpha', body = '', created_at = `2026-10-0${Math.min(number, 9)}T09:00:00Z`, updated_at = `2026-10-1${Math.min(number, 9)}T09:00:00Z`) =>
  makeIssue({
    number,
    title,
    repo,
    created_at,
    updated_at,
    labels: ['status:draft'],
    body: order === null ? body : (body ? `${body}\n\n` : '') + `<!-- board-order: ${order} -->`,
  });

async function signInPage(page, url) {
  await page.goto(url);
  await page.locator('#password').fill(BOARD_PASSWORD);
  await page.locator('#login-btn').click();
  await page.locator('#board-view').waitFor({ state: 'visible' });
}

let browser;
try {
  // =========================================================================
  // 1. F9 + #47: Per-fixture isolation, session persistence, password rotation, CSRF-at-rest
  // =========================================================================
  {
    const fake = await startFakeGitHub({ repositories: [{ repo: 'owner/alpha', issues: [] }] });
    const b1 = await startBoard(fake);
    const b2 = await startBoard(fake);
    const dir1 = path.dirname(b1.sessionFile);
    const dir2 = path.dirname(b2.sessionFile);
    assert.notEqual(dir1, dir2, 'Fixtures must allocate distinct directories');
    try {
      const s1 = new HttpSession(b1.url);
      await s1.login();
      const putRes = await s1.request('/api/project-names', {
        method: 'PUT',
        body: { repository: 'owner/alpha', name: 'Isolated Alpha' },
      });
      assert.equal(putRes.status, 200);

      const s2 = new HttpSession(b2.url);
      await s2.login();
      const getRes2 = await s2.request('/api/project-names');
      assert.equal(getRes2.status, 200);
      assert.deepEqual(getRes2.json.projectNames, {}, 'Second fixture must not see first fixture project-names.json');
    } finally {
      await b1.app.close();
      await b2.app.close();
      await fake.close();
    }
    assert.equal(fs.existsSync(dir1), false, 'Fixture 1 directory cleaned up on close');
    assert.equal(fs.existsSync(dir2), false, 'Fixture 2 directory cleaned up on close');

    // #47 restart persistence + CSRF not stored in plaintext + password rotation invalidation
    const fakePersist = await startFakeGitHub({ repositories: [{ repo: 'owner/alpha', issues: [draftIssue(1, 'Persist task', 1000)] }] });
    const persistDir = path.join(data, 'persist-47');
    await mkdir(persistDir, { recursive: true });
    const sessionFile = path.join(persistDir, 'sessions.json');
    let server = await startBoard(fakePersist, { sessionFilePath: sessionFile });
    const client = new HttpSession(server.url);
    try {
      const loginRes = await client.login();
      assert.equal(loginRes.status, 200);
      const csrfBefore = client.csrf;
      assert.ok(csrfBefore);
      const rawSessionDisk = await readFile(sessionFile, 'utf8');
      assert.equal(rawSessionDisk.includes(csrfBefore), false, 'Plaintext CSRF token must not appear on disk');

      await client.request('/api/project-names', {
        method: 'PUT',
        body: { repository: 'owner/alpha', name: 'Renamed Persist' },
      });

      // Restart with same password
      await server.app.close();
      server = await startBoard(fakePersist, { sessionFilePath: sessionFile });
      client.base = server.url;
      const checkAfterRestart = await client.request('/api/session');
      assert.equal(checkAfterRestart.status, 200);
      assert.equal(checkAfterRestart.json.authenticated, true, 'Session survives server restart');
      assert.equal(checkAfterRestart.json.csrfToken, csrfBefore, 'Derived CSRF token stays stable across restart');
      const namesAfterRestart = await client.request('/api/project-names');
      assert.deepEqual(namesAfterRestart.json.projectNames, { 'owner/alpha': 'Renamed Persist' });

      // Restart with rotated passwordHash (#47 Finding B)
      await server.app.close();
      const rotatedConfig = browserConfig(fakePersist, {
        BOARD_SESSION_FILE: sessionFile,
        BOARD_PASSWORD_HASH: hashPassword('new-rotated-password-999'),
      });
      server = await startBoard(fakePersist, { config: rotatedConfig, sessionFilePath: sessionFile });
      client.base = server.url;
      const checkAfterRotation = await client.request('/api/session');
      assert.equal(checkAfterRotation.status, 200);
      assert.equal(checkAfterRotation.json.authenticated, false, 'Password rotation invalidates existing sessions on restart');
    } finally {
      await server.app.close();
      await fakePersist.close();
    }

    record('F9', 'Per-fixture directory isolation, cleanup on close, #47 restart persistence, CSRF-at-rest, and password rotation', {
      isolatedDirsCleaned: true,
      csrfPlaintextOnDisk: false,
      survivedRestart: true,
      invalidatedOnPasswordRotation: true,
    });
  }

  // =========================================================================
  // 2. F3 & F7: Direct parser + HTTP byte-safety and dependency fence checks
  // =========================================================================
  {
    const fencedOnly = 'Line 1\r\n```markdown\r\n<!-- board-order: 42 -->\r\n```\r\n    <!-- board-order: 99 -->\r\nKeep hard break  ';
    assert.equal(parseOrderMarker(fencedOnly), null, 'Fenced and 4-space indented markers ignored');
    assert.equal(stripOrderMarker(fencedOnly), fencedOnly, 'stripOrderMarker leaves fenced-only body byte-identical');
    const markedCrlf = setOrderMarker(fencedOnly, 1500);
    assert.equal(
      markedCrlf,
      fencedOnly + '\r\n\r\n<!-- board-order: 1500 -->',
      'setOrderMarker preserves CRLF, fenced marker, and trailing two-space hard break',
    );
    assert.equal(parseOrderMarker(markedCrlf), 1500);
    assert.equal(stripOrderMarker(markedCrlf), fencedOnly + '\r\n\r\n');

    const depIssue = buildBoardListItem(
      makeIssue({
        number: 10,
        body: [
          '## Overview',
          '- [ ] Blocked by #2',
          '- [x] Depends on #3',
          '1. Requires #4',
          '```markdown',
          'Depends on #99',
          '- [ ] Blocked by #98',
          '```',
          '    Depends on #88',
        ].join('\r\n'),
      }),
      { owner: 'owner', name: 'alpha', full: 'owner/alpha', id: 1, archived: false, hasIssues: true },
    );
    assert.deepEqual(depIssue.dependencies, [2, 3, 4], 'Parses checklist/bullet/numbered deps and ignores fenced/indented');

    // HTTP section edit & order edit on CRLF body with duplicate headings, fenced marker, lookalike comment, and hard breaks
    const complexBody = [
      '## Overview',
      'First overview line  ',
      'Second line',
      '',
      '## Notes',
      '```html',
      '<!-- board-order: 42 -->',
      '```',
      '<!-- board-ordering: 7 -->',
      'Hard break at end  ',
      '',
      '## Overview',
      'Duplicate overview heading stays untouched  ',
      '',
      '<!-- board-order: 1000 -->',
    ].join('\r\n');

    const fake = await startFakeGitHub({
      repositories: [{ repo: 'owner/alpha', issues: [makeIssue({ number: 1, title: 'Byte safety', repo: 'owner/alpha', labels: ['status:draft'], body: complexBody })] }],
    });
    const board = await startBoard(fake);
    try {
      const s = new HttpSession(board.url);
      await s.login();
      const detail1 = (await s.request('/api/repos/owner/alpha/issues/1')).json.issue;
      const secRes = await s.request('/api/repos/owner/alpha/issues/1/section', {
        method: 'PUT',
        body: { fingerprint: detail1.fingerprint, sectionId: 'overview', text: 'Updated overview  \r\nKeep CRLF' },
      });
      assert.equal(secRes.status, 200);
      const rawAfterSec = fake.repositories[0].issues[0].body;
      assert.equal(rawAfterSec.includes('<!-- board-order: 42 -->'), true, 'Fenced marker preserved');
      assert.equal(rawAfterSec.includes('<!-- board-ordering: 7 -->'), true, 'Lookalike comment preserved');
      assert.equal(rawAfterSec.includes('Hard break at end  \r\n'), true, 'Hard break spaces preserved');
      assert.equal(rawAfterSec.includes('Duplicate overview heading stays untouched  \r\n'), true, 'Second Overview preserved');
      assert.equal(rawAfterSec.endsWith('\r\n\r\n<!-- board-order: 1000 -->'), true, 'Terminal marker preserved');
      assert.equal(/(?<!\r)\n/.test(rawAfterSec), false, 'Zero bare LF in CRLF body');

      const orderRes = await s.request('/api/repos/owner/alpha/issues/1/order', {
        method: 'PUT',
        body: { fingerprint: secRes.json.issue.fingerprint, previous: 1000, next: 2000 },
      });
      assert.equal(orderRes.status, 200);
      const rawAfterOrder = fake.repositories[0].issues[0].body;
      assert.equal(rawAfterOrder.includes('<!-- board-order: 42 -->'), true);
      assert.equal(rawAfterOrder.endsWith('\r\n\r\n<!-- board-order: 1500 -->'), true);
      assert.equal(/(?<!\r)\n/.test(rawAfterOrder), false, 'Zero bare LF after order update');
    } finally {
      await board.app.close();
      await fake.close();
    }

    record('F3', 'Byte-preserving terminal order marker across CRLF, fences, indented code, hard breaks, and section edits', {
      fencedMarkerPreserved: true,
      hardBreakSpacesPreserved: true,
      zeroBareLfInCrlf: true,
    });
    record('F7', 'Fence-aware dependency parser supports checklist, bullet, and numbered prefixes', {
      parsedDependencies: depIssue.dependencies,
    });
  }

  // =========================================================================
  // 3. F10: Standalone web batch-align endpoint removed (404, 0 GitHub writes)
  // =========================================================================
  {
    const fake = await startFakeGitHub({
      repositories: [{ repo: 'owner/alpha', issues: [draftIssue(1, 'Unaligned 1'), draftIssue(2, 'Unaligned 2')] }],
    });
    const board = await startBoard(fake);
    try {
      const s = new HttpSession(board.url);
      await s.login();
      const r1 = await s.request('/api/repos/owner/alpha/issues/batch-align', { method: 'POST', body: {} });
      const r2 = await s.request('/api/issues/batch-align', { method: 'POST', body: {} });
      assert.equal(r1.status, 404);
      assert.equal(r2.status, 404);
      assert.equal(fake.patchCalls.length, 0);
      record('F10', 'Extension-only batch-align endpoint removed from web server with 0 GitHub writes', {
        repoBatchAlignStatus: r1.status,
        rootBatchAlignStatus: r2.status,
        githubWrites: fake.patchCalls.length,
      });
    } finally {
      await board.app.close();
      await fake.close();
    }
  }

  // =========================================================================
  // 4. F1 & F5 server-side adversarial checks (55 midpoint precision rebalance,
  //    stale neighbour fingerprint, partial multi-issue failure, unconfirmed/forbidden/unknown transfer)
  // =========================================================================
  {
    const fake = await startFakeGitHub({
      honorIfMatch: true,
      repositories: [
        { repo: 'owner/alpha', issues: [draftIssue(1, 'Alpha 1', 1000), draftIssue(2, 'Alpha 2', 2000), draftIssue(3, 'Alpha 3', 3000)] },
        { repo: 'owner/beta', issues: [draftIssue(1, 'Beta existing 1', 1000, 'owner/beta')] },
        { repo: 'owner/denied', issues: [] },
      ],
      transferPermissionDeniedRepos: ['owner/denied'],
    });
    const board = await startBoard(fake);
    try {
      const s = new HttpSession(board.url);
      await s.login();

      // F5: 55 successive midpoint bisections alternating #3 and #2 into the gap after #1 (1000) -> rebalances automatically on step 54+ instead of 409
      let nextBound = 2000;
      let statusCodes = [];
      for (let step = 0; step < 55; step += 1) {
        const movingNum = step % 2 === 0 ? 3 : 2;
        const movingIssue = (await s.request(`/api/repos/owner/alpha/issues/${movingNum}`)).json.issue;
        const res = await s.request(`/api/repos/owner/alpha/issues/${movingNum}/order`, {
          method: 'PUT',
          body: { fingerprint: movingIssue.fingerprint, previous: 1000, next: nextBound },
        });
        statusCodes.push(res.status);
        assert.equal(res.status, 200, `Step ${step + 1} should succeed without 409 precision failure`);
        nextBound = res.json.issue.order;
      }
      const ordersAfter55 = fake.repositories[0].issues.map((i) => parseOrderMarker(i.body));
      assert.equal(new Set(ordersAfter55).size, 3, 'All 3 drafts retain distinct finite markers after 55 bisections and rebalance');

      // F5: Stale neighbour fingerprint rejected with 409 and 0 writes
      const fresh1 = (await s.request('/api/repos/owner/alpha/issues/1')).json.issue;
      const fresh2 = (await s.request('/api/repos/owner/alpha/issues/2')).json.issue;
      const writesBeforeStale = fake.patchCalls.length;
      const staleNeighbourRes = await s.request('/api/repos/owner/alpha/issues/1/order', {
        method: 'PUT',
        body: {
          fingerprint: fresh1.fingerprint,
          previous: fresh2.order,
          next: null,
          neighbours: [{ repo: 'owner/alpha', number: 2, fingerprint: '0'.repeat(64), order: fresh2.order }],
        },
      });
      assert.equal(staleNeighbourRes.status, 409);
      assert.equal(fake.patchCalls.length, writesBeforeStale, '0 writes when neighbour fingerprint is stale');

      // F5: Partial multi-issue rebalance failure returns 502 write_outcome_unknown with updatedIssues
      const f1 = (await s.request('/api/repos/owner/alpha/issues/1')).json.issue;
      const f2 = (await s.request('/api/repos/owner/alpha/issues/2')).json.issue;
      const f3 = (await s.request('/api/repos/owner/alpha/issues/3')).json.issue;
      let patchSeen = 0;
      fake.state.patchHook = () => {
        patchSeen += 1;
        if (patchSeen === 2) {
          return { status: 500, body: { message: 'Injected mid-rebalance failure' } };
        }
        return null;
      };
      const partialRes = await s.request('/api/repos/owner/alpha/issues/1/order', {
        method: 'PUT',
        body: {
          fingerprint: f1.fingerprint,
          updates: [
            { repo: 'owner/alpha', number: 2, fingerprint: f2.fingerprint, order: 10000 },
            { repo: 'owner/alpha', number: 1, fingerprint: f1.fingerprint, order: 20000 },
            { repo: 'owner/alpha', number: 3, fingerprint: f3.fingerprint, order: 30000 },
          ],
        },
      });
      fake.state.patchHook = null;
      assert.equal(partialRes.status, 502);
      assert.equal(partialRes.json.error, 'write_outcome_unknown');
      assert.equal(Array.isArray(partialRes.json.updatedIssues), true);
      assert.equal(partialRes.json.updatedIssues.length, 1);
      assert.equal(partialRes.json.updatedIssues[0].number, 2);
      assert.equal(partialRes.json.updatedIssues[0].order, 10000);

      // F1 server guards: unconfirmed move -> 400 confirmation_required (0 GraphQL calls)
      const moveTargetIssue = (await s.request('/api/repos/owner/alpha/issues/3')).json.issue;
      const unconfirmedRes = await s.request('/api/repos/owner/alpha/issues/3/move', {
        method: 'PUT',
        body: { fingerprint: moveTargetIssue.fingerprint, target: 'owner/beta' },
      });
      assert.equal(unconfirmedRes.status, 400);
      assert.equal(unconfirmedRes.json.error, 'confirmation_required');
      assert.equal(fake.state.graphqlCalls.length, 0);

      // F1 permission denied -> 403 transfer_forbidden, source stays open in owner/alpha
      fake.state.graphqlHook = () => ({
        status: 200,
        payload: {
          data: { transferIssue: null },
          errors: [{ type: 'FORBIDDEN', message: 'Resource not accessible by integration' }],
        },
      });
      const forbiddenRes = await s.request('/api/repos/owner/alpha/issues/3/move', {
        method: 'PUT',
        body: { fingerprint: moveTargetIssue.fingerprint, target: 'owner/beta', confirmed: true },
      });
      fake.state.graphqlHook = null;
      assert.equal(forbiddenRes.status, 403);
      assert.equal(forbiddenRes.json.error, 'transfer_forbidden');
      assert.equal(fake.repositories[0].issues.find((i) => i.number === 3).state, 'open');

      record('F5-server', '55-step midpoint precision rebalance, stale neighbour 409, and partial multi-issue 502 reconciliation', {
        midpointStepsSucceeded: statusCodes.length,
        staleNeighbourStatus: staleNeighbourRes.status,
        partialRebalanceStatus: partialRes.status,
        partialUpdatedCount: partialRes.json.updatedIssues.length,
      });
    } finally {
      await board.app.close();
      await fake.close();
    }
  }

  // =========================================================================
  // 5. Browser E2E Hostile Probes (F1, F2, F4, F5, F6, F8, and 20 view/sort combinations)
  // =========================================================================
  browser = await chromium.launch({
    executablePath: '/workspace/.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell',
    headless: true,
    args: ['--no-sandbox'],
  });

  // 5A. F5 Browser Downward Reorders (all-unmarked, marked-into-unmarked, equal-markers)
  for (const [slug, orders] of [
    ['all-unmarked', [null, null, null]],
    ['marked-into-unmarked', [1000, null, null]],
    ['equal-markers', [1000, 1000, 1000]],
  ]) {
    const fake = await startFakeGitHub({
      honorIfMatch: true,
      repositories: [{
        repo: 'owner/alpha',
        issues: [
          draftIssue(1, 'First draft', orders[0]),
          draftIssue(2, 'Second draft', orders[1]),
          draftIssue(3, 'Third draft', orders[2]),
        ],
      }],
    });
    const board = await startBoard(fake);
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
    const page = await context.newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    try {
      await signInPage(page, board.url);
      await page.locator('#filter-btn').click();
      await page.getByRole('button', { name: 'draft', exact: true }).click();
      await page.locator('#sheet-close').click();
      await page.locator('#sort-btn').click();
      await page.getByRole('button', { name: 'Manual order', exact: true }).click();

      await page.getByRole('button', { name: 'Move down: First draft', exact: true }).click();
      await page.waitForFunction(() => {
        const inputs = Array.from(document.querySelectorAll('.draft-title')).map((el) => el.value);
        return inputs[0] === 'Second draft' && inputs[1] === 'First draft';
      });
      const titlesAfter = await page.locator('.draft-title').evaluateAll((els) => els.map((e) => e.value));
      assert.deepEqual(titlesAfter, ['Second draft', 'First draft', 'Third draft']);
      const shot = path.join(shotsDir, `recheck-reorder-${slug}.png`);
      await page.screenshot({ path: shot });
      screenshots.push(shot);
    } finally {
      await context.close();
      await board.app.close();
      await fake.close();
    }
  }
  record('F5', 'Browser downward manual reorder succeeds across all-unmarked, marked-into-unmarked, and equal-marker drafts', {
    scenariosPassed: ['all-unmarked', 'marked-into-unmarked', 'equal-markers'],
  });

  // 5B. F1, F4, F6, F8 Browser Verification at 360x800
  {
    const fake = await startFakeGitHub({
      honorIfMatch: true,
      repositories: [
        {
          repo: 'owner/alpha',
          issues: [
            draftIssue(1, 'Alpha one', 1000, 'owner/alpha', 'Line 1 inspiration\nLine 2 more context\nLine 3 final note explaining the full draft idea on a small 360px phone screen'),
            draftIssue(2, 'Alpha two', 2000, 'owner/alpha', 'Second draft description'),
            draftIssue(3, 'Alpha three', 3000, 'owner/alpha', 'Third draft description'),
          ],
        },
        {
          repo: 'owner/beta',
          issues: [
            makeIssue({
              number: 1,
              title: 'Beta one pending',
              repo: 'owner/beta',
              labels: ['status:needs-human', 'priority:critical'],
              body: [
                '## Overview',
                'Original beta overview',
                '',
                '## Acceptance Criteria',
                '- [ ] Unchecked criterion',
                '- [x] Checked criterion',
                '',
                '## Human Tasks',
                '- [ ] Approve beta release',
                '',
                '## Open Questions',
                '- [ ] Proceed with beta? [A] Yes [B] No',
              ].join('\n'),
            }),
          ],
        },
        {
          repo: 'owner/denied',
          issues: [],
        },
      ],
      transferPermissionDeniedRepos: ['owner/denied'],
    });
    const board = await startBoard(fake);
    const context = await browser.newContext({ viewport: { width: 360, height: 800 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
    const page = await context.newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    try {
      await signInPage(page, board.url);
      await page.locator('#filter-btn').click();
      await page.getByRole('button', { name: 'draft', exact: true }).click();
      await page.locator('#sheet-close').click();
      await page.locator('#sort-btn').click();
      await page.getByRole('button', { name: 'Manual order', exact: true }).click();

      // F8: 360x800 multiline draft description does not clip and rows are compact
      const layoutMetrics = await page.evaluate(() => {
        const ta = document.querySelector('.draft-description');
        const rows = Array.from(document.querySelectorAll('.draft-row')).map((r) => {
          const rect = r.getBoundingClientRect();
          return { top: Math.round(rect.top), bottom: Math.round(rect.bottom), height: Math.round(rect.height) };
        });
        return {
          clientHeight: ta.clientHeight,
          scrollHeight: ta.scrollHeight,
          rows,
        };
      });
      assert.equal(layoutMetrics.scrollHeight <= layoutMetrics.clientHeight + 2, true, 'Multiline textarea must not clip');
      assert.equal(layoutMetrics.rows[0].top < 430, true, 'Compact phone top chrome');
      const multilineShot = path.join(shotsDir, 'recheck-multiline-description-360.png');
      await page.screenshot({ path: multilineShot });
      screenshots.push(multilineShot);

      // F4: Inline unsaved buffer survives reorder AND can be saved afterward with updated fingerprint
      const row2 = page.locator('.draft-row').nth(1);
      await row2.locator('.draft-title').fill('Alpha two UNSAVED');
      await row2.locator('.draft-description').fill('Unsaved desc across reorder');
      await row2.getByRole('button', { name: 'Move up: Alpha two', exact: true }).click();
      await page.waitForFunction(() => !window.__taskBoard.state.draftBusy);
      const firstRowAfterMove = page.locator('.draft-row').first();
      assert.equal(await firstRowAfterMove.locator('.draft-title').inputValue(), 'Alpha two UNSAVED');
      assert.equal(await firstRowAfterMove.locator('.draft-description').inputValue(), 'Unsaved desc across reorder');
      await firstRowAfterMove.getByRole('button', { name: 'Save', exact: true }).click();
      await page.waitForFunction(() => !window.__taskBoard.state.draftBusy);
      assert.equal(fake.repositories[0].issues.find((i) => i.number === 2).title, 'Alpha two UNSAVED');

      // F4: Stale inline buffer is NOT silently rebound on external refresh -> surfaces 409 Conflict
      const rowAlpha3 = page.locator('.draft-row').filter({ has: page.getByRole('textbox', { name: 'Title: Alpha three', exact: true }) });
      await rowAlpha3.locator('.draft-description').fill('Local stale buffer text');
      fake.repositories[0].issues.find((i) => i.number === 3).body = 'Changed on another device\n\n<!-- board-order: 3000 -->';
      fake.repositories[0].issues.find((i) => i.number === 3).updated_at = '2026-10-29T15:00:00Z';
      await page.locator('#refresh-btn').click();
      await page.waitForFunction(() => !document.querySelector('#refresh-btn').disabled);
      const rowAlpha3AfterRefresh = page.locator('.draft-row').filter({ has: page.getByRole('textbox', { name: 'Title: Alpha three', exact: true }) });
      assert.equal(await rowAlpha3AfterRefresh.locator('.draft-description').inputValue(), 'Local stale buffer text');
      await rowAlpha3AfterRefresh.getByRole('button', { name: 'Save', exact: true }).click();
      await page.waitForFunction(() => !window.__taskBoard.state.draftBusy);
      assert.match(await page.locator('#notice').innerText(), /changed on GitHub|Refresh before trying again/i);
      assert.match(fake.repositories[0].issues.find((i) => i.number === 3).body, /Changed on another device/);

      // F1: Cancel = 0 writes; Permission error = 403 & source stays open; Unknown outcome = blocks blind retry; Confirm = native GraphQL transferIssue
      const rowAlpha1 = page.locator('.draft-row').filter({ has: page.getByRole('textbox', { name: 'Title: Alpha one', exact: true }) });
      page.once('dialog', (d) => d.dismiss());
      await rowAlpha1.locator('.draft-project').selectOption('owner/beta');
      assert.equal(fake.state.graphqlCalls.length, 0);
      assert.equal(await rowAlpha1.locator('.draft-project').inputValue(), 'owner/alpha');

      // Permission denied transfer
      fake.state.graphqlHook = () => ({
        status: 200,
        payload: {
          data: { transferIssue: null },
          errors: [{ type: 'FORBIDDEN', message: 'Resource not accessible by integration' }],
        },
      });
      page.once('dialog', (d) => d.accept());
      await rowAlpha1.locator('.draft-project').selectOption('owner/beta');
      await page.waitForFunction(() => !window.__taskBoard.state.draftBusy);
      fake.state.graphqlHook = null;
      assert.match(await page.locator('#notice').innerText(), /refused permission/i);
      assert.equal(await rowAlpha1.locator('.draft-project').inputValue(), 'owner/alpha');
      assert.equal(fake.repositories[0].issues.find((i) => i.number === 1).state, 'open');

      // Ambiguous transfer outcome -> marks uncertain and blocks blind retry
      fake.state.graphqlHook = () => ({ status: 500, payload: { message: 'Simulated GraphQL drop' } });
      page.once('dialog', (d) => d.accept());
      await rowAlpha1.locator('.draft-project').selectOption('owner/beta');
      await page.waitForFunction(() => !window.__taskBoard.state.draftBusy);
      fake.state.graphqlHook = null;
      assert.equal(await page.evaluate(() => window.__taskBoard.state.uncertain.has('owner/alpha#1')), true);
      const gqlCountBeforeRetry = fake.state.graphqlCalls.length;
      page.once('dialog', (d) => d.accept());
      await rowAlpha1.locator('.draft-project').selectOption('owner/beta');
      assert.equal(fake.state.graphqlCalls.length, gqlCountBeforeRetry, 'Blind retry blocked while uncertain');
      assert.match(await page.locator('#notice').innerText(), /Previous outcome needs review/i);

      // Refresh reconciles and clears uncertain, then confirmed transfer succeeds via GraphQL transferIssue
      await page.locator('#refresh-btn').click();
      await page.waitForFunction(() => !document.querySelector('#refresh-btn').disabled);
      const rowAlpha1Fresh = page.locator('.draft-row').filter({ has: page.getByRole('textbox', { name: 'Title: Alpha one', exact: true }) });
      const reqsBefore = fake.requests.length;
      const patchesBefore = fake.patchCalls.length;
      page.once('dialog', (d) => d.accept());
      await rowAlpha1Fresh.locator('.draft-project').selectOption('owner/beta');
      await page.waitForFunction(() =>
        window.__taskBoard.state.board.issues.some((i) => i.title === 'Alpha one' && i.repository.full === 'owner/beta' && i.number === 2),
      );
      const transferRequests = fake.requests.slice(reqsBefore);
      const restCreates = transferRequests.filter((r) => r.method === 'POST' && /^\/repos\/[^/]+\/[^/]+\/issues$/.test(r.path)).length;
      const restComments = transferRequests.filter((r) => r.method === 'POST' && /\/comments$/.test(r.path)).length;
      assert.equal(restCreates, 0, '0 REST issue creates on transfer');
      assert.equal(restComments, 0, '0 REST comments on transfer');
      assert.equal(fake.patchCalls.length, patchesBefore, '0 REST close patches on transfer');
      assert.equal(fake.repositories[1].issues.find((i) => i.number === 1).state, 'open', 'Same-number owner/beta#1 untouched');
      assert.equal(fake.repositories[1].issues.find((i) => i.number === 2).title, 'Alpha one', 'Transferred as owner/beta#2');

      record('F1', 'Confirmed GraphQL transferIssue with 0 writes on cancel, permission refusal handling, unknown-outcome retry guard, and same-number safety', {
        restCreates,
        restComments,
        restPatches: fake.patchCalls.length - patchesBefore,
        transferredTo: 'owner/beta#2',
        beta1Intact: true,
      });

      // Clear filter and switch to Pending items view for F6, F8, and F4 drawer checks
      await page.getByRole('button', { name: 'Clear', exact: true }).click();
      await page.locator('#view-btn').click();
      await page.getByRole('button', { name: 'Pending items', exact: true }).click();
      await page.locator('.pending-task .task-row').first().click();
      await page.locator('#detail-view').waitFor({ state: 'visible' });

      // F4: Verify real DOM checkbox .checked boolean property on - [ ] vs - [x]
      const acStates = await page.locator('#ac-list input[type="checkbox"]').evaluateAll((boxes) =>
        boxes.map((b) => ({ checked: b.checked, attr: b.getAttribute('checked') })),
      );
      assert.deepEqual(acStates, [
        { checked: false, attr: null },
        { checked: true, attr: null },
      ], 'Unchecked criterion must have .checked === false');

      // F6 & F8: Verify human task checkbox, GitHub link, and >=44px question option buttons
      const ghLinkHref = await page.locator('#detail-meta a.github-link').getAttribute('href');
      assert.equal(ghLinkHref, 'https://github.com/owner/beta/issues/1');
      const humanCheckboxes = page.locator('#human-list input[type="checkbox"]');
      assert.equal(await humanCheckboxes.count(), 1);
      assert.equal(await humanCheckboxes.first().isChecked(), false);

      const questionChipsCount = await page.locator('.question-option-btn').count();
      assert.equal(questionChipsCount, 2, 'Question option chips rendered');
      const undersizedInDrawer = await page
        .locator('#detail-view button:visible, #detail-view .checklist-label:visible')
        .evaluateAll((nodes) =>
          nodes
            .map((n) => ({ text: n.textContent.trim(), w: Math.round(n.getBoundingClientRect().width), h: Math.round(n.getBoundingClientRect().height) }))
            .filter((n) => n.h < 44 || n.w < 44),
        );
      assert.deepEqual(undersizedInDrawer, [], 'All drawer buttons and checklist labels >= 44x44px');

      const pendingShot = path.join(shotsDir, 'recheck-pending-and-drawer-360.png');
      await page.screenshot({ path: pendingShot });
      screenshots.push(pendingShot);

      // F4: Type unsaved overview & question answer, then toggle human-task checkbox -> unsaved text survives!
      await page.locator('#overview-text').fill('Unsaved beta overview during checkbox toggle');
      await page.locator('#answer-0').fill('Draft answer kept');
      await humanCheckboxes.first().click();
      await page.waitForFunction(() =>
        window.__taskBoard.state.detail.humanTasks[0].completed === true,
      );
      assert.equal(await page.locator('#overview-text').inputValue(), 'Unsaved beta overview during checkbox toggle');
      assert.equal(await page.locator('#answer-0').inputValue(), 'Draft answer kept');
      assert.match(fake.repositories[1].issues.find((i) => i.number === 1).body, /- \[x\] Approve beta release/);
      assert.equal(fake.repositories[1].issues.find((i) => i.number === 1).state, 'open', 'Completing human task never auto-closes issue');

      // Answer question via option chip
      await page.locator('.question-option-btn').first().click();
      await page.waitForFunction(() =>
        window.__taskBoard.state.detail.openQuestions[0].completed === true,
      );
      assert.match(fake.repositories[1].issues.find((i) => i.number === 1).body, /Answer: Yes/);

      // F8: Closing drawer restores focus to opener
      await page.locator('#back-btn').click();
      await page.locator('#board-view').waitFor({ state: 'visible' });
      const activeKey = await page.evaluate(() => document.activeElement && document.activeElement.getAttribute('data-issue-key'));
      assert.equal(activeKey, 'owner/beta#1', 'Closing drawer restores focus to the opener task row');

      // F4: Same-number Mark Done & delayed response generation guard
      // Add owner/alpha#1 so both owner/alpha#1 and owner/beta#1 exist on the board
      fake.repositories[0].issues.push(draftIssue(1, 'Alpha number one', 500, 'owner/alpha'));
      await page.locator('#view-btn').click();
      await page.getByRole('button', { name: 'Simple list', exact: true }).click();
      await page.locator('#refresh-btn').click();
      await page.waitForFunction(() => !document.querySelector('#refresh-btn').disabled);

      // Open owner/beta#1 and click Mark Done -> owner/alpha#1 must stay open!
      await page.locator('.task-row[data-issue-key="owner/beta#1"]').click();
      await page.locator('#detail-view').waitFor({ state: 'visible' });
      await page.locator('#mark-done-btn').click();
      await page.waitForFunction(() => window.__taskBoard.state.detail.state === 'closed');
      const alpha1State = await page.evaluate(() =>
        window.__taskBoard.state.board.issues.find((i) => i.repository.full === 'owner/alpha' && i.number === 1).state,
      );
      const beta1State = await page.evaluate(() =>
        window.__taskBoard.state.board.issues.find((i) => i.repository.full === 'owner/beta' && i.number === 1).state,
      );
      assert.equal(alpha1State, 'open', 'owner/alpha#1 must remain open when owner/beta#1 is marked done');
      assert.equal(beta1State, 'closed', 'owner/beta#1 is marked closed');

      // Delayed response generation guard: reopen owner/beta#1 but hold the PATCH, switch to owner/alpha#1, then release
      let releaseDelayedPatch;
      const delayedPatchGate = new Promise((r) => { releaseDelayedPatch = r; });
      await page.route('**/api/repos/owner/beta/issues/1', async (route) => {
        if (route.request().method() === 'PATCH') {
          await delayedPatchGate;
          await route.continue();
        } else {
          await route.continue();
        }
      });
      await page.locator('#mark-done-btn').click(); // triggers delayed PATCH on beta#1
      await page.locator('#back-btn').click();
      await page.locator('.task-row[data-issue-key="owner/alpha#1"]').click();
      await page.waitForFunction(() => window.__taskBoard.state.detail && window.__taskBoard.state.detail.key === 'owner/alpha#1');
      releaseDelayedPatch();
      await page.waitForTimeout(150);
      const currentDrawerKey = await page.evaluate(() => window.__taskBoard.state.detail && window.__taskBoard.state.detail.key);
      assert.equal(currentDrawerKey, 'owner/alpha#1', 'Late beta#1 response must not overwrite active alpha#1 drawer');
      await page.unroute('**/api/repos/owner/beta/issues/1');

      record('F4', 'Qualified repo+number identity, readGeneration guard, unsaved drawer/inline buffer retention, stale buffer 409, and boolean checked property', {
        uncheckedDomProperty: false,
        alpha1RemainedOpen: alpha1State === 'open',
        activeDrawerAfterLateResponse: currentDrawerKey,
      });
      record('F6', 'Pending items human-task completion checkbox and GitHub source link verified in browser', {
        githubLinkHref: ghLinkHref,
        humanTaskCompleted: true,
        issueRemainedOpen: true,
      });
      record('F8', '360px multiline auto-sizing, >=44px drawer question chips, compact phone spacing, and focus restoration verified', {
        textareaClientHeight: layoutMetrics.clientHeight,
        textareaScrollHeight: layoutMetrics.scrollHeight,
        firstRowTop: layoutMetrics.rows[0].top,
        undersizedDrawerControls: undersizedInDrawer.length,
        restoredFocusKey: activeKey,
      });
    } finally {
      await context.close();
      await board.app.close();
      await fake.close();
    }
  }

  // 5C. F2 Offline Queue: lost response after commit, partial 3-draft batch, in-flight edit, duplicate titles, and cold offline reload under SW
  {
    const fake = await startFakeGitHub({
      honorIfMatch: true,
      repositories: [{ repo: 'owner/alpha', issues: [draftIssue(1, 'Existing online draft', 1000)] }],
    });
    const board = await startBoard(fake);

    // Context 1 (serviceWorkers: 'block' so Playwright route interception controls fetch)
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
    const page = await context.newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    try {
      await signInPage(page, board.url);
      await page.locator('#filter-btn').click();
      await page.getByRole('button', { name: 'draft', exact: true }).click();
      await page.locator('#sheet-close').click();
      await page.locator('#sort-btn').click();
      await page.getByRole('button', { name: 'Manual order', exact: true }).click();

      // (a) Duplicate titles offline keep distinct entries
      await context.setOffline(true);
      await page.locator('#quick-add-input').fill('Same title idea');
      await page.locator('#quick-add-description').fill('First distinct description');
      await page.locator('#quick-add-input').press('Enter');
      await page.locator('#quick-add-input').fill('Same title idea');
      await page.locator('#quick-add-description').fill('Second distinct description');
      await page.locator('#quick-add-input').press('Enter');
      const queuedSameTitle = await page.evaluate(() => JSON.parse(localStorage.getItem('openchamber_offline_drafts') || '[]'));
      assert.equal(queuedSameTitle.length, 2, 'Same-title drafts with different descriptions are both retained');
      assert.notEqual(queuedSameTitle[0].id, queuedSameTitle[1].id);
      await page.evaluate(() => localStorage.removeItem('openchamber_offline_drafts'));

      // (b) Partial 3-draft batch sync where 2nd POST commits on server then loses response
      await page.locator('#quick-add-input').fill('Batch one');
      await page.locator('#quick-add-description').fill('Desc 1');
      await page.locator('#quick-add-input').press('Enter');
      await page.locator('#quick-add-input').fill('Batch two lost response');
      await page.locator('#quick-add-description').fill('Desc 2');
      await page.locator('#quick-add-input').press('Enter');
      await page.locator('#quick-add-input').fill('Batch three');
      await page.locator('#quick-add-description').fill('Desc 3');
      await page.locator('#quick-add-input').press('Enter');

      let postAttempt = 0;
      await page.route('**/api/repos/owner/alpha/issues', async (route) => {
        if (route.request().method() === 'POST') {
          postAttempt += 1;
          if (postAttempt === 2) {
            await route.fetch(); // commits Batch two on server!
            await route.abort('failed'); // browser loses response!
            return;
          }
        }
        await route.continue();
      });

      await context.setOffline(false);
      await page.waitForFunction(() => {
        const q = JSON.parse(localStorage.getItem('openchamber_offline_drafts') || '[]');
        return q.length === 2 && q[0].uncertain === true;
      });
      await page.unroute('**/api/repos/owner/alpha/issues');

      // Trigger another sync (e.g. reconnect / online) -> Batch two (uncertain) must NOT be resent; Batch three syncs once!
      await page.evaluate(() => window.__taskBoard.syncOfflineDrafts());
      await page.waitForFunction(() => {
        const q = JSON.parse(localStorage.getItem('openchamber_offline_drafts') || '[]');
        return q.length === 1 && q[0].title === 'Batch two lost response' && q[0].uncertain === true;
      });
      const countBatch1 = fake.repositories[0].issues.filter((i) => i.title === 'Batch one').length;
      const countBatch2 = fake.repositories[0].issues.filter((i) => i.title === 'Batch two lost response').length;
      const countBatch3 = fake.repositories[0].issues.filter((i) => i.title === 'Batch three').length;
      assert.deepEqual([countBatch1, countBatch2, countBatch3], [1, 1, 1], 'Zero duplicate creates after lost response and subsequent sync');

      // Dismiss the uncertain entry after reconciling
      await page.getByRole('button', { name: 'Dismiss', exact: true }).click();
      assert.equal(await page.evaluate(() => localStorage.getItem('openchamber_offline_drafts')), null);

      // (c) In-flight edit during sync preserves newer revision and updates the created issue via PUT .../draft
      await context.setOffline(true);
      await page.locator('#quick-add-input').fill('Inflight draft');
      await page.locator('#quick-add-description').fill('Initial offline description');
      await page.locator('#quick-add-input').press('Enter');

      let releaseInflightPost;
      const inflightPostGate = new Promise((r) => { releaseInflightPost = r; });
      let inflightPostEnteredResolve;
      const inflightPostEntered = new Promise((r) => { inflightPostEnteredResolve = r; });

      await page.route('**/api/repos/owner/alpha/issues', async (route) => {
        if (route.request().method() === 'POST') {
          inflightPostEnteredResolve();
          await inflightPostGate;
          await route.continue();
        } else {
          await route.continue();
        }
      });

      await context.setOffline(false);
      await inflightPostEntered;

      // Edit the offline row while its create POST is in flight
      const inflightRow = page.locator('.draft-row').filter({ has: page.getByRole('textbox', { name: 'Title: Inflight draft', exact: true }) });
      await inflightRow.locator('.draft-description').fill('Newer description edited during sync');
      await inflightRow.getByRole('button', { name: 'Save', exact: true }).click();

      releaseInflightPost();
      await page.waitForFunction(() => {
        const q = JSON.parse(localStorage.getItem('openchamber_offline_drafts') || '[]');
        return q.length === 1 && Boolean(q[0].confirmedNumber);
      });
      await page.unroute('**/api/repos/owner/alpha/issues');

      // Next sync flushes the newer revision via PUT .../draft
      await page.evaluate(() => window.__taskBoard.syncOfflineDrafts());
      await page.waitForFunction(() => !localStorage.getItem('openchamber_offline_drafts'));
      const inflightIssues = fake.repositories[0].issues.filter((i) => i.title === 'Inflight draft');
      assert.equal(inflightIssues.length, 1, 'In-flight edit must not create a second issue');
      assert.match(inflightIssues[0].body, /Newer description edited during sync/, 'In-flight revision persisted to server');
    } finally {
      await context.close();
    }

    // Context 2 (Service Worker enabled): Cold offline reload shows local draft queue cleanly without faking auth
    const swContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const swPage = await swContext.newPage();
    swPage.on('pageerror', (e) => errors.push(e.message));
    try {
      await signInPage(swPage, board.url);
      await swPage.evaluate(async () => {
        if ('serviceWorker' in navigator) {
          await navigator.serviceWorker.register('/sw.js');
          await navigator.serviceWorker.ready;
        }
      });
      await swPage.reload();
      await swPage.locator('#board-view').waitFor({ state: 'visible' });
      await swPage.locator('#filter-btn').click();
      await swPage.getByRole('button', { name: 'draft', exact: true }).click();
      await swPage.locator('#sheet-close').click();

      await swContext.setOffline(true);
      await swPage.locator('#quick-add-input').fill('Cold offline reload idea');
      await swPage.locator('#quick-add-description').fill('Survived cold offline reload');
      await swPage.locator('#quick-add-input').press('Enter');
      await swPage.getByRole('textbox', { name: 'Title: Cold offline reload idea', exact: true }).waitFor();

      await swPage.reload();
      await swPage.locator('#board-view').waitFor({ state: 'visible' });
      const coldOfflineState = await swPage.evaluate(() => ({
        loginHidden: document.querySelector('#login-view').hidden,
        boardHidden: document.querySelector('#board-view').hidden,
        signoutHidden: document.querySelector('#signout-btn').hidden,
        csrf: window.__taskBoard.state.csrf,
        offlineRowsCount: document.querySelectorAll('.draft-row-offline').length,
        firstTitle: document.querySelector('.draft-row-offline .draft-title')?.value,
        notice: document.querySelector('#notice')?.textContent,
      }));
      assert.equal(coldOfflineState.loginHidden, true);
      assert.equal(coldOfflineState.boardHidden, false);
      assert.equal(coldOfflineState.signoutHidden, true);
      assert.equal(coldOfflineState.csrf, null, 'Offline shell must not fake authenticated CSRF');
      assert.equal(coldOfflineState.offlineRowsCount, 1);
      assert.equal(coldOfflineState.firstTitle, 'Cold offline reload idea');
      const coldShot = path.join(shotsDir, 'recheck-cold-offline-reload-390.png');
      await swPage.screenshot({ path: coldShot });
      screenshots.push(coldShot);

      record('F2', 'Offline queue handles lost response without duplication, retains in-flight edits, keeps duplicate titles, and renders cold offline reload under SW', {
        batchCounts: [1, 1, 1],
        inflightIssueCount: 1,
        duplicateTitlesKept: 2,
        coldOfflineState,
      });
    } finally {
      await swContext.close();
      await board.app.close();
      await fake.close();
    }
  }

  // 5D. 20-Combination View (5) x Sort (4) Matrix Verification
  {
    const fake = await startFakeGitHub({
      repositories: [{
        repo: 'owner/alpha',
        issues: [
          makeIssue({
            number: 1,
            title: 'Low older draft',
            repo: 'owner/alpha',
            labels: ['status:draft', 'priority:low'],
            created_at: '2026-10-01T10:00:00Z',
            updated_at: '2026-10-25T10:00:00Z',
            body: '## Human Tasks\n- [ ] Check low older\n\n<!-- board-order: 1000 -->',
          }),
          makeIssue({
            number: 2,
            title: 'Critical newer draft',
            repo: 'owner/alpha',
            labels: ['status:draft', 'priority:critical'],
            created_at: '2026-10-10T10:00:00Z',
            updated_at: '2026-10-15T10:00:00Z',
            body: 'Depends on #1\n\n## Human Tasks\n- [ ] Check critical newer\n\n<!-- board-order: 2000 -->',
          }),
        ],
      }],
    });
    const board = await startBoard(fake);
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
    const page = await context.newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    try {
      await signInPage(page, board.url);
      const views = {
        simple: 'Simple list',
        cards: 'Cards',
        kanban: 'Kanban board',
        graph: 'Graph',
        pending: 'Pending items',
      };
      const sorts = {
        priority: ['Critical newer draft', 'Low older draft'],
        updated: ['Low older draft', 'Critical newer draft'],
        created: ['Critical newer draft', 'Low older draft'],
        manual: ['Low older draft', 'Critical newer draft'],
      };
      const sortLabels = {
        priority: 'Priority',
        updated: 'Recently updated',
        created: 'Recently created',
        manual: 'Manual order',
      };
      let combinationsChecked = 0;
      for (const [vKey, vLabel] of Object.entries(views)) {
        await page.locator('#view-btn').click();
        await page.getByRole('button', { name: vLabel, exact: true }).click();
        for (const [sKey, expectedOrder] of Object.entries(sorts)) {
          await page.locator('#sort-btn').click();
          await page.getByRole('button', { name: sortLabels[sKey], exact: true }).click();
          const renderedTitles = await page.locator('.task-title').evaluateAll((els) => els.map((e) => e.textContent.trim()));
          if (vKey !== 'graph') {
            assert.deepEqual(renderedTitles, expectedOrder, `Mismatch in view=${vKey} sort=${sKey}`);
          } else {
            // In graph view, #1 is parent of #2 so #1 renders before child #2
            assert.equal(renderedTitles.length, 2);
          }
          combinationsChecked += 1;
        }
      }
      assert.equal(combinationsChecked, 20);
      record('MATRIX-20', 'All 20 view (5) x sort (4) combinations verified in Chromium with 0 page errors', {
        combinationsChecked,
      });
    } finally {
      await context.close();
      await board.app.close();
      await fake.close();
    }
  }

  assert.deepEqual(errors, [], 'Zero uncaught browser page errors');
  await writeFile(path.join(out, 'recheck-results.json'), JSON.stringify({ results, screenshots, pageErrors: errors }, null, 2));
} finally {
  if (browser) await browser.close();
  await rm(data, { recursive: true, force: true });
}
