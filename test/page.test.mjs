// The page, not the renderer.
//
// `npm test` asserts strings produced by the template literals. This file
// asserts the thing the reader clicks: it loads a real page in a real browser
// over `file://`, clicks a container's counts button, opens and closes the
// panel, enters a scope through the hash, and checks that a page whose data
// block is gone says so while keeping the no-JS tree.
//
// Obscura is the CDP server; no package is added to the project.

import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { buildTree } from '../engine-board/model.ts';
import {
  renderBoardPage,
  renderListPage,
} from '../engine-board/board-render.ts';

const ARCHIVED_AT = '2026-11-01T00:00:00Z';

function snapshot() {
  return {
    provenance: {
      source_kind: 'live',
      read_at: '2026-01-01T00:00:00Z',
      engine_commit: 'page-test',
      schema_revision: 7,
      operations: ['task graph --tree --json', 'task status --json'],
      port_only_steps: [],
      unobserved_states: [],
    },
    project: { project_id: 'p', config_revision: 1, max_concurrency: 2 },
    runners: [],
    runners_available: false,
    graph: {
      nodes: [
        // The tree's container row; buildTree removes it, so the top scope is
        // its children, the way a live `--tree` read looks.
        { task_id: 'root', node_key: '$root', rest_state: 'ready', parent_task_id: null },
        { task_id: 'box', node_key: 'box', rest_state: 'ready', parent_task_id: 'root', title: 'Box of work' },
        { task_id: 'a', node_key: 'box/a', rest_state: 'done', parent_task_id: 'box', title: 'Alpha' },
        { task_id: 'b', node_key: 'box/b', rest_state: 'skipped', parent_task_id: 'box', title: 'Beta' },
        { task_id: 'old1', node_key: 'box/old-1', rest_state: 'done', parent_task_id: 'box', title: 'Old one', archived_at: ARCHIVED_AT },
        { task_id: 'old2', node_key: 'box/old-2', rest_state: 'done', parent_task_id: 'box', title: 'Old two', archived_at: ARCHIVED_AT },
        { task_id: 'plain', node_key: 'plain', rest_state: 'ready', parent_task_id: 'root', title: null },
        { task_id: 'empty', node_key: 'empty', rest_state: 'ready', parent_task_id: 'root', title: 'Empty box' },
        { task_id: 'e1', node_key: 'empty/old-1', rest_state: 'done', parent_task_id: 'empty', title: 'Empty old one', archived_at: ARCHIVED_AT },
        { task_id: 'e2', node_key: 'empty/old-2', rest_state: 'done', parent_task_id: 'empty', title: 'Empty old two', archived_at: ARCHIVED_AT },
      ],
      edges: [],
    },
    statuses: [],
    tree_key: 'tree',
    root_task_id: 'root',
  };
}

function freePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

async function waitForJson(url, timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      const response = await fetch(url);
      if (response.ok) return await response.json();
    } catch {
      // Not up yet.
    }
    if (Date.now() > deadline) throw new Error(`timed out waiting for ${url}`);
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

function connect(webSocketUrl) {
  const socket = new WebSocket(webSocketUrl);
  const pending = new Map();
  const listeners = new Map();
  let nextId = 0;

  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      const entry = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) entry.reject(new Error(message.error.message));
      else entry.resolve(message.result);
      return;
    }
    for (const listener of listeners.get(message.method) ?? []) {
      listener(message.params, message.sessionId);
    }
  });

  const send = (method, params = {}, sessionId) =>
    new Promise((resolve, reject) => {
      const id = (nextId += 1);
      pending.set(id, { resolve, reject });
      socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    });

  const on = (method, listener) => {
    const set = listeners.get(method) ?? new Set();
    set.add(listener);
    listeners.set(method, set);
    return () => set.delete(listener);
  };

  const open = new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve);
    socket.addEventListener('error', () => reject(new Error('CDP socket failed')));
  });

  return { open, send, on, close: () => socket.close() };
}

async function openPage(browser, url) {
  const { targetId } = await browser.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await browser.send('Target.attachToTarget', {
    targetId,
    flatten: true,
  });
  const send = (method, params = {}) => browser.send(method, params, sessionId);
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Network.enable');
  await send('Page.addScriptToEvaluateOnNewDocument', {
    source:
      'window.__pageErrors = [];' +
      'window.addEventListener("error", function (event) {' +
      '  window.__pageErrors.push(String(event.message));' +
      '});' +
      'window.addEventListener("unhandledrejection", function (event) {' +
      '  window.__pageErrors.push(String(event.reason));' +
      '});',
  });

  const failedRequests = [];
  browser.on('Network.loadingFailed', (params, eventSession) => {
    if (eventSession === sessionId) failedRequests.push(params.errorText);
  });
  const exceptions = [];
  browser.on('Runtime.exceptionThrown', (params, eventSession) => {
    if (eventSession === sessionId) {
      exceptions.push(params.exceptionDetails.exception?.description ?? params.exceptionDetails.text);
    }
  });

  const evaluate = async (expression) => {
    const result = await send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (result.exceptionDetails) {
      throw new Error(
        result.exceptionDetails.exception?.description ?? result.exceptionDetails.text,
      );
    }
    return result.result.value;
  };

  const navigate = async (target) => {
    const loaded = new Promise((resolve) => {
      const off = browser.on('Page.loadEventFired', (params, eventSession) => {
        if (eventSession !== sessionId) return;
        off();
        resolve();
      });
    });
    await send('Page.navigate', { url: target });
    await loaded;
  };

  return { send, evaluate, navigate, failedRequests, exceptions };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 120));

test(
  'the Board works from file://: counts open the panel, Escape closes it, a scope restores Here',
  { timeout: 60000 },
  async (t) => {
    const model = buildTree(snapshot());
    const dir = mkdtempSync(join(tmpdir(), 'engine-board-page-'));
    const boardFile = join(dir, 'index.html');
    const listFile = join(dir, 'list.html');
    writeFileSync(boardFile, renderBoardPage(model));
    writeFileSync(listFile, renderListPage(model));

    const rendered = renderBoardPage(model);
    const dataBlock = /<script type="application\/json" id="board-data">[\s\S]*?<\/script>/;
    assert.match(rendered, dataBlock, 'the Board page carries a data block');
    writeFileSync(
      join(dir, 'broken.html'),
      rendered.replace(
        dataBlock,
        '<script type="application/json" id="board-data">{not json</script>',
      ),
    );
    writeFileSync(join(dir, 'missing.html'), rendered.replace(dataBlock, ''));

    const port = await freePort();
    const server = spawn(
      'obscura',
      ['serve', '--port', String(port), '--allow-file-access'],
      { stdio: 'ignore' },
    );
    let browser;
    t.after(() => {
      browser?.close();
      server.kill('SIGTERM');
      rmSync(dir, { recursive: true, force: true });
    });

    const version = await waitForJson(`http://127.0.0.1:${port}/json/version`);
    browser = connect(version.webSocketDebuggerUrl);
    await browser.open;
    const page = await openPage(browser, pathToFileURL(boardFile).href);

    // ---- the default Board view -------------------------------------------
    await page.navigate(pathToFileURL(boardFile).href);
    const loaded = await page.evaluate(`(function () {
      return {
        cards: document.querySelectorAll('#board-root .card').length,
        rootChips: document.querySelectorAll('#board-root .scope-head .chip').length,
        level: document.querySelector('#board-root .level').textContent,
        progress: document.querySelector('.progress-line').textContent,
      };
    })()`);
    assert.equal(loaded.cards, 3, 'one card per top-level child');
    // 1a: the root chip is gone; the level line names both classes.
    assert.equal(loaded.rootChips, 0, 'no root task count chip');
    assert.equal(loaded.level, '3 live in this level · 7 lanes empty');
    assert.equal(loaded.progress, '1 of 5 done · 1 skipped · 4 archived');

    const facts = await page.evaluate(`(function () {
      var cards = Array.prototype.slice.call(
        document.querySelectorAll('#board-root .card'),
      );
      function card(title) {
        return cards.filter(function (item) {
          return item.querySelector('.card-title').textContent.indexOf(title) !== -1;
        })[0];
      }
      var box = card('Box of work');
      var empty = card('Empty box');
      var plain = card('plain');
      var counts = box.querySelector('.row-count');
      return {
        boxCounts: counts.textContent,
        boxLabel: counts.getAttribute('aria-label'),
        boxTag: counts.tagName,
        nestedInLink: counts.closest('a') !== null,
        emptyCounts: empty.querySelector('.row-count').textContent,
        titleMissing: plain.querySelector('.title-missing')
          ? plain.querySelector('.title-missing').textContent
          : null,
      };
    })()`);
    // 1c + 6: the counts line is the container's facts button.
    assert.equal(facts.boxTag, 'BUTTON');
    assert.equal(facts.nestedInLink, false, 'the button is not inside the title link');
    assert.equal(facts.boxCounts, '2 inside · 1 done · 2 archived');
    assert.equal(
      facts.boxLabel,
      'Facts for Box of work, 2 inside · 1 done · 2 archived',
    );
    assert.equal(facts.emptyCounts, '2 archived inside · no live work');
    // 7: the title-missing branch runs in the page, from the data block.
    assert.equal(facts.titleMissing, 'title not read');

    await page.evaluate(`(function () {
      var cards = Array.prototype.slice.call(
        document.querySelectorAll('#board-root .card'),
      );
      var box = cards.filter(function (item) {
        return item.textContent.indexOf('Box of work') !== -1;
      })[0];
      box.querySelector('.row-count').click();
    })()`);
    await settle();
    const opened = await page.evaluate(`(function () {
      var sheet = document.querySelector('dialog.sheet[open]');
      if (!sheet) return null;
      var facts = {};
      Array.prototype.forEach.call(sheet.querySelectorAll('dt'), function (dt) {
        var dd = dt.nextElementSibling;
        facts[dt.textContent] = dd ? dd.textContent : null;
      });
      return { labels: Object.keys(facts), facts: facts };
    })()`);
    assert.ok(opened, 'the counts button opens a dialog');
    for (const label of ['Task id', 'Node key', 'State', 'Inside']) {
      assert.ok(opened.labels.includes(label), `the panel carries ${label}`);
    }
    assert.equal(opened.facts['Task id'], 'box');
    assert.equal(opened.facts['Inside'], '2 inside · 1 done · 2 archived');

    await page.evaluate(`(function () {
      var sheet = document.querySelector('dialog.sheet[open]');
      sheet.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
      );
    })()`);
    await settle();
    assert.equal(
      await page.evaluate(`document.querySelector('dialog.sheet[open]') === null`),
      true,
      'Escape closes the panel',
    );

    // ---- entering a scope -------------------------------------------------
    await page.evaluate(`location.hash = '#board/box'`);
    await settle();
    const scope = await page.evaluate(`(function () {
      return {
        cards: document.querySelectorAll('#board-root .card').length,
        level: document.querySelector('#board-root .level').textContent,
        chip: (document.querySelector('#board-root .scope-head .chip') || {}).textContent,
        details: !!document.querySelector('#board-root .details'),
        here: (function () {
          var tag = document.querySelector('.here-tag:not([hidden])');
          return tag ? tag.closest('li').getAttribute('data-key') : null;
        })(),
      };
    })()`);
    assert.equal(scope.cards, 4, 'the container scope shows its four children');
    // 1a: both classes named, in one line with the empty-lane count.
    assert.equal(scope.level, '2 live · 2 archived in this level · 6 lanes empty');
    assert.equal(scope.chip, '2 inside · 1 done · 2 archived');
    assert.equal(scope.details, true, 'the scope header still has Details');
    // On the Board the Here marker lives in the hidden list tree; it is set
    // there for the row the List view will show when it is opened.
    assert.equal(scope.here, 'box');

    await page.evaluate(`document.querySelector('#board-root .details').click()`);
    await settle();
    const detailsPanel = await page.evaluate(`(function () {
      var sheet = document.querySelector('dialog.sheet[open]');
      if (!sheet) return null;
      var title = sheet.querySelector('h2');
      var task = null;
      Array.prototype.forEach.call(sheet.querySelectorAll('dt'), function (dt) {
        if (dt.textContent === 'Task id') task = dt.nextElementSibling.textContent;
      });
      return { title: title ? title.textContent : null, task: task };
    })()`);
    assert.ok(detailsPanel, 'the scope header Details button opens the panel');
    assert.equal(detailsPanel.task, 'box');
    await page.evaluate(`document.querySelector('dialog.sheet[open]').close()`);
    await settle();

    // ---- back to All work -------------------------------------------------
    await page.evaluate(`location.hash = '#board'`);
    await settle();
    assert.equal(
      await page.evaluate(`document.querySelectorAll('#board-root .card').length`),
      3,
    );
    assert.equal(
      await page.evaluate(`document.querySelector('.here-tag:not([hidden])') === null`),
      true,
      'leaving the scope clears Here',
    );

    // ---- the List keeps its own Here marker --------------------------------
    await page.navigate(pathToFileURL(listFile).href + '#list/box');
    const list = await page.evaluate(`(function () {
      var tag = document.querySelector('.here-tag:not([hidden])');
      return {
        page: document.body.getAttribute('data-page'),
        here: tag ? tag.closest('li').getAttribute('data-key') : null,
        bar: document.querySelector('.list-bar').textContent,
      };
    })()`);
    assert.equal(list.page, 'list');
    assert.equal(list.here, 'box');
    assert.ok(list.bar.includes('1 of 5 done · 1 skipped · 4 archived'));

    // ---- no errors on a page that works ------------------------------------
    assert.deepEqual(await page.evaluate('window.__pageErrors'), []);
    assert.deepEqual(page.exceptions, []);
    assert.deepEqual(page.failedRequests, []);

    // ---- R4: a page that cannot read its data says so ----------------------
    for (const [file, reason] of [
      ['broken.html', 'the data block could not be read'],
      ['missing.html', 'the data block is missing'],
    ]) {
      await page.navigate(pathToFileURL(join(dir, file)).href);
      const degraded = await page.evaluate(`(function () {
        var line = document.getElementById('board-failure');
        var tree = document.querySelector('.nojs-tree');
        var board = document.getElementById('board-root');
        return {
          hidden: line.hidden,
          text: line.textContent,
          js: document.documentElement.classList.contains('js'),
          treeDisplay: tree ? getComputedStyle(tree).display : null,
          boardDisplay: board ? getComputedStyle(board).display : null,
        };
      })()`);
      assert.equal(degraded.hidden, false, `${file} shows the failure line`);
      assert.equal(
        degraded.text,
        `The interactive board could not start: ${reason}. The full list is shown instead.`,
      );
      assert.equal(degraded.js, false, `${file} leaves the no-JS tree on`);
      assert.notEqual(degraded.treeDisplay, 'none', `${file} keeps the tree visible`);
      assert.equal(degraded.boardDisplay, 'none', `${file} does not draw an empty board`);
    }
  },
);
