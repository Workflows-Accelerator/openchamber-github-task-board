// Independent guard boundary and UI assertions; synthetic GitHub only.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { startBoard, HttpSession, BOARD_PASSWORD } from '../../../../../../../web/tests/helpers.mjs';
import { startFakeGitHub, makeIssue } from '../../../../../../../web/tests/fake-github.mjs';
import pkg from '/workspace/personal/lucas/charme-social/node_modules/playwright/index.js';
const { chromium } = pkg.default || pkg;
const out = path.resolve('.agents/run/chamberos-board-v2/verifications/A-delivery/hostile3');
const results = [];
const browser = await chromium.launch({ executablePath: process.env.H2_CHROME, args: ['--no-sandbox'], headless: true });
const repo = (name, id, accessible = true) => ({ repo: name, id, accessible, issues: [makeIssue({ number: id, repo: name, labels: ['status:in-progress', 'backburner'] }), makeIssue({ number: id + 10, repo: name, state: 'closed', labels: ['status:done'] })] });
try {
  for (const mode of ['empty', 'unavailable', 'partial', 'total', 'cached']) {
    let clock = Date.parse('2026-11-06T00:00:00Z');
    const fake = await startFakeGitHub({ repositories: mode === 'empty' ? [repo('owner/gone', 1, false)] : mode === 'partial' ? [repo('owner/good', 1), repo('owner/bad', 2)] : [repo('owner/one', 1)] });
    const board = await startBoard(fake, { now: () => clock, repositoryTtlMs: 60000, boardCacheTtlMs: 30000, env: { BOARD_REPO: '' } });
    try {
      const session = new HttpSession(board.url); await session.login();
      if (['unavailable', 'cached'].includes(mode)) {
        for (const route of ['operations', 'archive']) assert.equal((await session.request('/api/combined/' + route)).status, 200);
      }
      if (mode === 'unavailable') { fake.setRepoAccessible('owner/one', false); clock += 61000; }
      if (mode === 'partial') fake.setRepoFailing('owner/bad', true);
      if (mode === 'total' || mode === 'cached') { fake.setRepoFailing('owner/one', true); clock += 35000; }
      const operations = await session.request('/api/combined/operations');
      const archive = await session.request('/api/combined/archive');
      const combined = await session.request('/api/combined/board');
      for (const response of [operations, archive]) {
        assert.equal(response.status, mode === 'total' ? 502 : 200);
        if (mode === 'total') assert.equal(response.json.error, 'discovery_unavailable');
        else assert.equal(response.json.partial, mode !== 'empty');
      }
      if (mode === 'empty') {
        assert.equal(operations.json.openClosed.total, 0); assert.equal(archive.json.totalClosed, 0); assert.equal(archive.json.totalBackburner, 0);
      } else if (mode !== 'total' && mode !== 'unavailable') {
        assert.equal(operations.json.openClosed.total, 2); assert.equal(archive.json.totalClosed, 1); assert.equal(archive.json.totalBackburner, 1);
      }
      if (mode === 'unavailable') {
        assert.deepEqual(operations.json.failures, combined.json.failures); assert.deepEqual(archive.json.failures, combined.json.failures);
        assert.equal(operations.json.failures[0].message, 'Unavailable');
      }
      if (mode === 'cached') assert.match(operations.json.failures[0].message, /cached tasks/);
      const ui = {};
      if (mode === 'total' || mode === 'unavailable') {
        const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block' });
        const page = await context.newPage(); await page.goto(board.url);
        await page.locator('#password').fill(BOARD_PASSWORD); await page.locator('#password').press('Enter');
        await page.locator('#board-view').waitFor({ state: 'visible' }); await page.waitForTimeout(300);
        for (const view of ['operations', 'archive']) {
          await page.evaluate(v => document.getElementById('nav-' + v).click(), view);
          await page.waitForTimeout(300);
          ui[view] = await page.evaluate(v => ({ loading: document.getElementById(v + '-loading').innerText, loadingHidden: document.getElementById(v + '-loading').hidden, bodyText: document.body.innerText }), view);
          if (mode === 'total') { assert.match(ui[view].loading, /Could not load/); assert.equal(ui[view].loadingHidden, false); }
          else assert.match(ui[view].bodyText, /partial|unavailable|incomplete/i);
          await page.screenshot({ path: path.join(out, 'screenshots', `${mode}-${view}.png`) });
        }
        await context.close();
      }
      results.push({ mode, operations: operations.json, archive: archive.json, statuses: [operations.status, archive.status, combined.status], ui });
      console.log(mode, operations.status, archive.status, 'assertions passed');
    } finally { await board.app.close(); await fake.close(); }
  }
} finally {
  await browser.close(); fs.writeFileSync(path.join(out, 'guards.json'), JSON.stringify(results, null, 2) + '\n');
}
