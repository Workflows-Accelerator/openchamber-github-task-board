// The page, not the renderer.
//
// `npm test` asserts strings produced by the template literals. This file
// asserts the thing the reader clicks: it loads a real page in a real browser
// over `file://`, clicks a container's counts button, opens and closes the
// panel, enters a scope through the hash, and checks that a page whose data
// block is gone says so while keeping the no-JS tree. A second test loads a
// hash URL as the first document, the way a pasted deep link does.
//
// Obscura is the CDP server; no package is added to the project. The test
// fails, rather than skips, when it is not on PATH.

import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { buildTree } from '../engine-board/model.ts';
import { laneOf } from '../engine-board/rollup.ts';
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

// The page test fails, loudly, when the browser it needs is not installed. A
// skip here would be green on every machine without Obscura and would prove
// nothing.
function requireObscura() {
  const probe = spawnSync('obscura', ['--version'], { encoding: 'utf8' });
  if (probe.error || probe.status !== 0) {
    throw new Error(
      'npm run test:page needs obscura on PATH; this test fails rather than skips. ' +
        (probe.error
          ? probe.error.message
          : `obscura --version exited ${probe.status}`),
    );
  }
}

// Every wait is a condition, not a pause: the page ends it by becoming what
// the next assertion reads, and the timeout names the claim that never held.
async function until(page, expression, message, timeoutMs = 5000) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    if (await page.evaluate(expression)) return;
    if (Date.now() > deadline) {
      throw new Error(`timed out waiting: ${message}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}

test(
  'the Board works from file://: counts open the panel, Escape closes it, a scope restores Here',
  { timeout: 60000 },
  async (t) => {
    requireObscura();
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

    // Slice 6: the reading surface is human, the machine record is folded.
    // Slice 7: the lanes and the header speak the reader's vocabulary.
    await page.send('Emulation.setDeviceMetricsOverride', {
      width: 1280,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    });
    const skin = await page.evaluate(`(function () {
      var provenance = document.querySelector('details.provenance');
      var focus = document.querySelector('#board-root .focus-line');
      var laneCount = function (lane) {
        var node = document.querySelector('#board-root .lane[data-lane="' + lane + '"]');
        return node ? node.querySelectorAll('.card').length : 0;
      };
      var cards = Array.prototype.slice.call(
        document.querySelectorAll('#board-root .card'),
      );
      return {
        provenanceOpen: provenance ? provenance.open : null,
        provenanceSummary: provenance
          ? provenance.querySelector('summary').textContent
          : null,
        text: document.body.innerText,
        focus: focus ? focus.textContent : null,
        counts: focus
          ? {
              canStart: Number(focus.getAttribute('data-can-start')),
              waiting: Number(focus.getAttribute('data-waiting')),
              inProgress: Number(focus.getAttribute('data-in-progress')),
            }
          : null,
        lanes: {
          canStart: laneCount('can-start'),
          inProgress: laneCount('in-progress'),
          waiting:
            laneCount('waiting-for-someone') + laneCount('waiting-for-other-work'),
          total: cards.length,
        },
        cards: cards.map(function (card) {
          return {
            state: card.getAttribute('data-state'),
            phase: card.getAttribute('data-phase') || null,
            lane: card.getAttribute('data-lane'),
          };
        }),
        cardStatesHidden: cards.every(function (card) {
          var line = card.querySelector('.card-state');
          return !line || getComputedStyle(line).display === 'none';
        }),
      };
    })()`);
    assert.equal(skin.provenanceOpen, false, 'provenance is closed by default');
    assert.equal(skin.provenanceSummary, 'Where this page came from');
    assert.equal(/\d{4}-\d\d-\d\dT/.test(skin.text), false, 'no ISO on the surface');
    assert.ok(skin.focus.includes('can start'), skin.focus);
    // Every card sits in the lane its own state maps to, and the map is not
    // re-implemented in the page.
    for (const card of skin.cards) {
      assert.equal(
        card.lane,
        laneOf(card.state, card.phase),
        `${card.state}/${card.phase} maps to ${card.lane}`,
      );
    }
    // At 1280 the lane head names the lane; no card repeats it.
    assert.equal(
      skin.cardStatesHidden,
      true,
      'no card prints its lane word at 1280',
    );
    assert.equal(skin.counts.canStart, skin.lanes.canStart, 'can-start matches its lane');
    assert.equal(
      skin.counts.inProgress,
      skin.lanes.inProgress,
      'in-progress matches its lane',
    );
    assert.equal(skin.counts.waiting, skin.lanes.waiting, 'waiting matches both wait lanes');
    assert.equal(
      skin.counts.canStart + skin.counts.inProgress + skin.counts.waiting,
      skin.lanes.total,
      'the header counts sum to the live total in this fixture',
    );

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
    await until(
      page,
      "document.querySelector('dialog.sheet[open]') !== null",
      'the counts button opens the panel',
    );
    const opened = await page.evaluate(`(function () {
      var sheet = document.querySelector('dialog.sheet[open]');
      if (!sheet) return null;
      var primary = {};
      sheet.querySelectorAll('.facts-primary dt').forEach(function (dt) {
        var dd = dt.nextElementSibling;
        primary[dt.textContent] = dd ? dd.textContent : null;
      });
      var more = sheet.querySelector('details.sheet-more');
      return {
        labels: Object.keys(primary),
        facts: primary,
        firstText: sheet.querySelector('.sheet-inner').innerText,
        moreOpen: more ? more.open : null,
        moreSummary: more ? more.querySelector('summary').textContent : null,
      };
    })()`);
    assert.ok(opened, 'the counts button opens a dialog');
    // Slice 6: the first screen is plain, the machine record is one fold down.
    assert.deepEqual(opened.labels, ['Inside']);
    assert.equal(opened.facts.Inside, '2 inside · 1 done · 2 archived');
    assert.equal(/tsk_|rest_state|\bslot \d/.test(opened.firstText), false);
    assert.equal(/\d{4}-\d\d-\d\dT/.test(opened.firstText), false);
    assert.equal(opened.moreOpen, false, 'More is closed on open');
    assert.equal(opened.moreSummary, 'More');
    assert.ok(opened.firstText.includes('No status row came back for this task.'));

    await page.evaluate(`document.querySelector('dialog.sheet[open] details.sheet-more summary').click()`);
    await until(
      page,
      "document.querySelector('dialog.sheet[open] details.sheet-more').open === true",
      'More opens',
    );
    const more = await page.evaluate(`(function () {
      var sheet = document.querySelector('dialog.sheet[open]');
      var facts = {};
      Array.prototype.forEach.call(sheet.querySelectorAll('details.sheet-more dt'), function (dt) {
        var dd = dt.nextElementSibling;
        facts[dt.textContent] = dd ? dd.textContent : null;
      });
      return { labels: Object.keys(facts), facts: facts };
    })()`);
    for (const label of ['Task id', 'Node key', 'Engine state']) {
      assert.ok(more.labels.includes(label), `More carries ${label}`);
    }
    assert.equal(more.facts['Task id'], 'box');
    assert.equal(more.facts['Node key'], 'box');
    assert.equal(more.facts['Engine state'], 'ready');

    await page.evaluate(`(function () {
      var sheet = document.querySelector('dialog.sheet[open]');
      sheet.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
      );
    })()`);
    await until(
      page,
      "document.querySelector('dialog.sheet[open]') === null",
      'Escape closes the panel',
    );

    // ---- entering a scope -------------------------------------------------
    await page.evaluate(`location.hash = '#board/box'`);
    await until(
      page,
      "document.getElementById('board-root').getAttribute('data-scope') === 'box'",
      'the #board/box scope renders',
    );
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
    await until(
      page,
      "document.querySelector('dialog.sheet[open]') !== null",
      'the scope Details button opens the panel',
    );
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
    await until(
      page,
      "document.querySelector('dialog.sheet[open]') === null",
      'the panel closes',
    );

    // ---- back to All work -------------------------------------------------
    await page.evaluate(`location.hash = '#board'`);
    await until(
      page,
      "document.getElementById('board-root').getAttribute('data-scope') === '' && document.querySelectorAll('#board-root .card').length === 3",
      'All work renders',
    );
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
    await until(
      page,
      "document.querySelector('.here-tag:not([hidden])') !== null",
      'the List restores Here',
    );
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
      await until(
        page,
        "document.getElementById('board-failure') && document.getElementById('board-failure').hidden === false",
        `${file} shows the failure line`,
      );
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

test(
  'a typed deep link renders on a cold load, before any click',
  { timeout: 60000 },
  async (t) => {
    requireObscura();
    const model = buildTree(snapshot());
    const dir = mkdtempSync(join(tmpdir(), 'engine-board-deep-'));
    const boardFile = join(dir, 'index.html');
    writeFileSync(boardFile, renderBoardPage(model));

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
    const page = await openPage(browser, 'about:blank');

    // The first document the page ever loads already carries the scope. No
    // prior board render, no click, no hashchange: this is the address bar.
    const url = pathToFileURL(boardFile).href + '#board/box';
    await page.navigate(url);
    const cold = await page.evaluate(`(function () {
      var tag = document.querySelector('.here-tag:not([hidden])');
      return {
        hash: location.hash,
        scope: document.getElementById('board-root').getAttribute('data-scope'),
        cards: document.querySelectorAll('#board-root .card').length,
        level: document.querySelector('#board-root .level').textContent,
        progress: document.querySelector('.progress-line').textContent,
        here: tag ? tag.closest('li').getAttribute('data-key') : null,
      };
    })()`);
    assert.equal(cold.hash, '#board/box');
    assert.equal(cold.scope, 'box');
    assert.equal(cold.cards, 4);
    assert.equal(cold.level, '2 live · 2 archived in this level · 6 lanes empty');
    assert.equal(cold.progress, '1 of 5 done · 1 skipped · 4 archived');
    assert.equal(cold.here, 'box');
    const coldSkin = await page.evaluate(`(function () {
      var provenance = document.querySelector('details.provenance');
      var focus = document.querySelector('#board-root .focus-line');
      return {
        provenanceOpen: provenance ? provenance.open : null,
        isoText: /\d{4}-\d\d-\d\dT/.test(document.body.innerText),
        focus: focus ? focus.textContent : null,
      };
    })()`);
    assert.equal(coldSkin.provenanceOpen, false);
    assert.equal(coldSkin.isoText, false);
    // The box's children are done, skipped and archived; no lane the header
    // counts holds one, so the header is empty rather than a row of zeroes.
    assert.equal(coldSkin.focus, '');
    assert.deepEqual(await page.evaluate('window.__pageErrors'), []);
    assert.deepEqual(page.exceptions, []);
    assert.deepEqual(page.failedRequests, []);
  },
);


test(
  'the committed demo page carries the volume tree, not the seven-task line',
  { timeout: 60000 },
  async (t) => {
    requireObscura();
    const demoFile = join(
      process.cwd(),
      'engine-board',
      'index.html',
    );
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
    });
    const version = await waitForJson(`http://127.0.0.1:${port}/json/version`);
    browser = connect(version.webSocketDebuggerUrl);
    await browser.open;
    const page = await openPage(browser, pathToFileURL(demoFile).href);
    await page.navigate(pathToFileURL(demoFile).href);

    await page.send('Emulation.setDeviceMetricsOverride', {
      width: 1280,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    });
    const board = await page.evaluate(`(function () {
      var laneCount = function (id) {
        var lane = document.querySelector('#board-root .lane[data-lane="' + id + '"]');
        return lane ? lane.querySelectorAll('.card').length : 0;
      };
      var focus = document.querySelector('#board-root .focus-line');
      var cards = Array.prototype.slice.call(
        document.querySelectorAll('#board-root .card'),
      );
      return {
        cards: cards.length,
        containers: cards.filter(function (card) {
          return card.querySelector('.row-count') !== null;
        }).length,
        focus: focus ? focus.textContent : null,
        counts: focus
          ? {
              canStart: Number(focus.getAttribute('data-can-start')),
              waiting: Number(focus.getAttribute('data-waiting')),
              inProgress: Number(focus.getAttribute('data-in-progress')),
            }
          : null,
        lanes: {
          canStart: laneCount('can-start'),
          inProgress: laneCount('in-progress'),
          waiting:
            laneCount('waiting-for-someone') + laneCount('waiting-for-other-work'),
        },
        provenanceOpen: document.querySelector('details.provenance').open,
        isoText: /\d{4}-\d\d-\d\dT/.test(document.body.innerText),
        cardStatesHidden: cards.every(function (card) {
          var line = card.querySelector('.card-state');
          return !line || getComputedStyle(line).display === 'none';
        }),
        cardLanes: cards.map(function (card) {
          return {
            state: card.getAttribute('data-state'),
            phase: card.getAttribute('data-phase') || null,
            lane: card.getAttribute('data-lane'),
          };
        }),
      };
    })()`);
    // R5: the top level is the portfolio, not a field of loose tasks.
    assert.equal(board.cards, 5, 'five processes at the top');
    assert.equal(board.containers, 5, 'each process carries its own counts');
    assert.equal(board.counts.canStart, 1, 'Build can start now');
    assert.equal(board.counts.inProgress, 0, 'nothing runs at the process level');
    assert.equal(board.counts.waiting, 2, 'Release and Operations wait');
    assert.equal(board.focus, '1 can start · 2 waiting');
    assert.equal(board.lanes.canStart, board.counts.canStart);
    assert.equal(board.lanes.inProgress, board.counts.inProgress);
    assert.equal(board.lanes.waiting, board.counts.waiting);
    assert.equal(board.provenanceOpen, false);
    assert.equal(board.isoText, false);
    assert.equal(board.cardStatesHidden, true, 'no card repeats its lane at 1280');
    for (const card of board.cardLanes) {
      assert.equal(card.lane, laneOf(card.state, card.phase));
    }

    // Enter Build: the crowded workstream, twelve startable cards in one lane
    // and the two running rows in their own lane instead of in Can start now.
    await page.evaluate(`location.hash = '#board/build'`);
    await until(
      page,
      "document.getElementById('board-root').getAttribute('data-scope') === 'build'",
      'the Build workstream renders',
    );
    const crowded = await page.evaluate(`(function () {
      var laneCount = function (id) {
        var lane = document.querySelector('#board-root .lane[data-lane="' + id + '"]');
        return lane ? lane.querySelectorAll('.card').length : 0;
      };
      var focus = document.querySelector('#board-root .focus-line');
      var cards = Array.prototype.slice.call(
        document.querySelectorAll('#board-root .card'),
      );
      return {
        cards: cards.length,
        focus: focus ? focus.textContent : null,
        lanes: {
          canStart: laneCount('can-start'),
          inProgress: laneCount('in-progress'),
          waitingOther: laneCount('waiting-for-other-work'),
          done: laneCount('done'),
        },
        runningInCanStart: document.querySelectorAll(
          '#board-root .lane[data-lane="can-start"] .card[data-phase="live"]',
        ).length,
        cardLanes: cards.map(function (card) {
          return {
            state: card.getAttribute('data-state'),
            phase: card.getAttribute('data-phase') || null,
            lane: card.getAttribute('data-lane'),
          };
        }),
        cardStatesHidden: Array.prototype.every.call(
          document.querySelectorAll('#board-root .card .card-state'),
          function (line) { return getComputedStyle(line).display === 'none'; },
        ),
      };
    })()`);
    assert.equal(crowded.cards, 16, 'Build holds sixteen cards at this level');
    assert.equal(crowded.lanes.canStart, 12, 'the crowded lane has twelve cards');
    assert.equal(crowded.lanes.inProgress, 2, 'the two running rows have their own lane');
    assert.equal(crowded.lanes.waitingOther, 1);
    assert.equal(crowded.lanes.done, 1);
    assert.equal(crowded.runningInCanStart, 0, 'a running row is never in Can start now');
    assert.equal(crowded.focus, '12 can start · 2 in progress · 1 waiting');
    assert.equal(crowded.cardStatesHidden, true);
    for (const card of crowded.cardLanes) {
      assert.equal(card.lane, laneOf(card.state, card.phase));
    }

    // Release: open the blocked chain's panel. The first screen names the lane
    // and the blocker; the raw engine state is one fold down.
    await page.evaluate(`location.hash = '#board/release'`);
    await until(
      page,
      "document.getElementById('board-root').getAttribute('data-scope') === 'release'",
      'the Release workstream renders',
    );
    await page.evaluate(`(function () {
      var cards = Array.prototype.slice.call(
        document.querySelectorAll('#board-root .card'),
      );
      var chain = cards.filter(function (card) {
        return card.textContent.indexOf('Ship the pricing page') !== -1;
      })[0];
      chain.querySelector('.card-title .enter').click();
    })()`);
    await until(
      page,
      "document.querySelector('dialog.sheet[open]') !== null",
      'the blocked card opens its panel',
    );
    const blocked = await page.evaluate(`(function () {
      var sheet = document.querySelector('dialog.sheet[open]');
      var facts = {};
      sheet.querySelectorAll('.facts-primary dt').forEach(function (dt) {
        facts[dt.textContent] = dt.nextElementSibling
          ? dt.nextElementSibling.textContent
          : null;
      });
      return {
        title: sheet.querySelector('h2').textContent,
        lane: sheet.querySelector('.sheet-state').textContent.trim(),
        facts: facts,
        firstText: sheet.querySelector('.facts-primary').innerText,
        moreOpen: sheet.querySelector('details.sheet-more').open,
      };
    })()`);
    assert.equal(blocked.title, 'Ship the pricing page');
    assert.equal(blocked.lane, 'Waiting for other work', 'the panel speaks the lane word');
    assert.equal(blocked.facts['Waiting for'], 'Approve the pricing copy');
    assert.equal(/tsk_|rest_state/.test(blocked.firstText), false);
    assert.equal(blocked.moreOpen, false);

    await page.evaluate(
      `document.querySelector('dialog.sheet[open] details.sheet-more summary').click()`,
    );
    await until(
      page,
      "document.querySelector('dialog.sheet[open] details.sheet-more').open === true",
      'More opens',
    );
    const raw = await page.evaluate(`(function () {
      var sheet = document.querySelector('dialog.sheet[open]');
      var facts = {};
      Array.prototype.forEach.call(
        sheet.querySelectorAll('details.sheet-more dt'),
        function (dt) {
          facts[dt.textContent] = dt.nextElementSibling
            ? dt.nextElementSibling.textContent
            : null;
        },
      );
      return facts;
    })()`);
    assert.equal(raw['Engine state'], 'blocked', 'the machine word is still honest');

    assert.deepEqual(await page.evaluate('window.__pageErrors'), []);
    assert.deepEqual(page.exceptions, []);
    assert.deepEqual(page.failedRequests, []);
  },
);
