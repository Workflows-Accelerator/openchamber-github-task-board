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
      edges: [
        { from: 'a', to: 'b', kind: 'blocked_by' },
        // A boundary edge: `box` owns the level, it is not drawn in it.
        { from: 'box', to: 'a', kind: 'blocked_by' },
      ],
    },
    statuses: [
      {
        task_id: 'a',
        rest_state: 'done',
        phase: 'ended',
        slot: 0,
        title: 'Alpha',
        body:
          'Alpha opens with a sentence someone wrote.\n\nAlpha closes with a second paragraph.\n\nA <b>bold</b> claim, a </script> tag, and one long word: ' +
          'x'.repeat(160) +
          '.',
        conditions: [
          { kind: 'check', name: 'alpha-check' },
          { kind: 'verdict' },
          { kind: 'answer', field: 'ok', equals: true },
          { kind: 'child', settle: 'all_done' },
        ],
        mirror: 'issue #7',
        attempts: [
          {
            attempt_id: 'att_a1',
            ordinal: 1,
            phase: 'ended',
            end_reason: 'ok',
            outcome: 'ok',
            attested_by: 'person:local',
          },
        ],
        handoff_revision: 1,
      },
      {
        task_id: 'b',
        rest_state: 'skipped',
        phase: null,
        slot: null,
        title: 'Beta',
        body: '',
        conditions: [],
        handoff_revision: 1,
      },
    ],
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
        edges: document.querySelectorAll('#board-root .edge-layer path').length,
        home: (function () {
          var link = document.querySelector('a.brand');
          return link
            ? {
                text: link.textContent,
                href: link.getAttribute('href'),
                underline: getComputedStyle(link).borderBottomWidth,
              }
            : null;
        })(),
        title: document.title,
      };
    })()`);
    assert.equal(loaded.cards, 3, 'one card per top-level child');
    // 1a: the root chip is gone; the level line names both classes.
    assert.equal(loaded.rootChips, 0, 'no root task count chip');
    assert.equal(loaded.level, '3 live in this level · 7 lanes empty');
    assert.equal(loaded.progress, '1 of 5 done · 1 skipped · 4 archived');
    // Slice 8: the top level draws no line, and the word at top left is home.
    assert.equal(loaded.edges, 0, 'no in-level edge at the top');
    assert.deepEqual(loaded.home, { text: 'Engine board', href: 'index.html#board', underline: '1px' });
    assert.equal(loaded.title, 'All work · Engine board');

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
        sections: {
          description: !!sheet.querySelector('.sheet-description'),
          conditions: !!sheet.querySelector('.sheet-conditions'),
          history: !!sheet.querySelector('.sheet-history'),
          conversation: !!sheet.querySelector('.sheet-conversation'),
          primary: !!sheet.querySelector('.facts-primary'),
        },
      };
    })()`);
    assert.ok(opened, 'the counts button opens a dialog');
    // Slice 6: the first screen is plain, the machine record is one fold down.
    // Ruling 1: the boundary edge that is not drawn also means the container
    // holds Alpha up, so that fact leads beside its own counts.
    assert.deepEqual(opened.labels, ['Holds up', 'Inside']);
    assert.equal(opened.facts['Holds up'], '1 task: Alpha.');
    assert.equal(opened.facts.Inside, '2 inside · 1 done · 2 archived');
    // Ruling 2: the container's status was not read, so its description,
    // contract, history and conversation are not four empty sections.
    assert.deepEqual(opened.sections, {
      description: false,
      conditions: false,
      history: false,
      conversation: false,
      primary: true,
    });
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

    // Ruling 1: the breadcrumb is a named navigation directly above the level
    // title, with a keyboard-reachable link for the ancestor and the current
    // level as text.
    const crumb = await page.evaluate(`(function () {
      var nav = document.querySelector('#board-root nav.crumbs');
      if (!nav) return null;
      var heading = document.querySelector('#board-root .scope-head h1');
      var current = nav.querySelector('[aria-current="page"]');
      var links = Array.prototype.slice.call(nav.querySelectorAll('a'));
      var first = links[0];
      var reachable = false;
      if (first) {
        first.focus();
        reachable = document.activeElement === first;
      }
      return {
        name: nav.getAttribute('aria-label'),
        before: !!(heading && (nav.compareDocumentPosition(heading) & 4)),
        current: current ? current.textContent : null,
        currentWeight: current ? getComputedStyle(current).fontWeight : null,
        size: nav ? parseFloat(getComputedStyle(nav).fontSize) : null,
        links: links.map(function (link) { return link.textContent; }),
        href: first ? first.getAttribute('href') : null,
        reachable: reachable,
      };
    })()`);
    assert.ok(crumb, 'the breadcrumb is rendered');
    assert.equal(crumb.name, 'Breadcrumb');
    assert.equal(crumb.before, true, 'the trail precedes the level title');
    assert.equal(crumb.current, 'Box of work');
    assert.equal(crumb.currentWeight, '400', 'the current level is normal weight');
    assert.ok(crumb.size >= 14, `the trail is reading size (${crumb.size}px)`);
    assert.deepEqual(crumb.links, ['All work']);
    assert.equal(crumb.href, '#board');
    assert.equal(crumb.reachable, true, 'the ancestor link takes focus');
    assert.equal(
      await page.evaluate('document.title'),
      'Box of work · Engine board',
      'the browser title follows the scope',
    );

    // Ruling 3: one in-level edge is drawn; the boundary edge is not.
    const lines = await page.evaluate(`(function () {
      var layer = document.querySelector('#board-root .edge-layer');
      var paths = layer ? Array.prototype.slice.call(layer.querySelectorAll('path')) : [];
      return {
        count: paths.length,
        from: paths[0] ? paths[0].getAttribute('data-from') : null,
        to: paths[0] ? paths[0].getAttribute('data-to') : null,
      };
    })()`);
    assert.equal(lines.count, 1, 'only the edge whose ends are both in the level');
    assert.equal(lines.from, 'a');
    assert.equal(lines.to, 'b');

    // Ruling 4-7: a real task's panel leads with its body and conditions, then
    // its history and where the conversation lives.
    await page.evaluate(`(function () {
      var cards = Array.prototype.slice.call(
        document.querySelectorAll('#board-root .card'),
      );
      var alpha = cards.filter(function (card) {
        return card.textContent.indexOf('Alpha') !== -1;
      })[0];
      alpha.querySelector('.card-title .enter').click();
    })()`);
    await until(
      page,
      "document.querySelector('dialog.sheet[open]') !== null",
      'the Alpha panel opens',
    );
    const reading = await page.evaluate(`(function () {
      var sheet = document.querySelector('dialog.sheet[open]');
      function texts(selector) {
        return Array.prototype.map.call(
          sheet.querySelectorAll(selector),
          function (node) { return node.textContent; },
        );
      }
      return {
        paragraphs: texts('.sheet-description .sheet-paragraph'),
        conditions: texts('.sheet-conditions .sheet-list li'),
        history: texts('.sheet-history .sheet-history-line'),
        conversation: (sheet.querySelector('.sheet-conversation') || {}).textContent || '',
        hasCommentBox: !!sheet.querySelector('textarea, input[type="text"]'),
        tags: sheet.querySelectorAll('.sheet-description b, .sheet-description script').length,
        listStyle: (function () {
          var list = sheet.querySelector('.sheet-conditions .sheet-list');
          return list ? getComputedStyle(list).listStyleType : null;
        })(),
        marker: (function () {
          var item = sheet.querySelector('.sheet-conditions .sheet-list li');
          if (!item) return null;
          var style = getComputedStyle(item, '::before');
          return { content: style.content, width: style.width };
        })(),
      };
    })()`);
    assert.deepEqual(reading.paragraphs, [
      'Alpha opens with a sentence someone wrote.',
      'Alpha closes with a second paragraph.',
      'A <b>bold</b> claim, a </script> tag, and one long word: ' +
        'x'.repeat(160) +
        '.',
    ]);
    assert.equal(reading.tags, 0, 'a body is text, never markup');
    // A list marker is drawn, not a font glyph: the default disc at 12 px
    // antialiases into a stray asterisk and reads as markdown on the page.
    assert.equal(reading.listStyle, 'none', 'no font-glyph list marker');
    assert.notEqual(reading.marker.content, 'none', 'the condition has a drawn dot');
    assert.ok(parseFloat(reading.marker.width) > 0, reading.marker.width);
    assert.deepEqual(reading.conditions, [
      'A check passes: alpha-check',
      'A person approves it',
      'An answer is recorded for ok (true)',
      'All of its child tasks are done',
    ]);
    assert.equal(reading.history[0], 'Attempted once.');
    assert.ok(reading.history.includes('The last attempt ended well.'));
    assert.ok(reading.history.includes('The last attempt was attested by person:local.'));
    assert.ok(reading.conversation.includes('issue #7'), reading.conversation);
    assert.equal(reading.hasCommentBox, false, 'no comment box is invented');

    // R4: a single unbroken paragraph wraps at phone width rather than
    // pushing the panel sideways.
    await page.send('Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 844,
      deviceScaleFactor: 1,
      mobile: true,
    });
    await until(page, 'window.innerWidth === 390', 'the phone viewport applies');
    const narrow = await page.evaluate(`(function () {
      var sheet = document.querySelector('dialog.sheet[open]');
      var desc = sheet.querySelector('.sheet-description');
      var rect = sheet.getBoundingClientRect();
      return {
        view: window.innerWidth,
        doc: document.documentElement.scrollWidth,
        descScroll: desc.scrollWidth,
        descClient: desc.clientWidth,
        sheetScroll: sheet.scrollWidth,
        sheetClient: sheet.clientWidth,
        sheetRight: rect.right,
      };
    })()`);
    assert.ok(
      narrow.descScroll <= narrow.descClient + 1,
      `the long word wraps (${narrow.descScroll} vs ${narrow.descClient})`,
    );
    assert.ok(narrow.sheetScroll <= narrow.sheetClient + 1, 'the panel does not scroll sideways');
    assert.ok(narrow.sheetRight <= narrow.view + 1, 'the panel stays inside the viewport');
    assert.ok(narrow.doc <= narrow.view + 1, 'the page does not scroll sideways');
    await page.send('Emulation.setDeviceMetricsOverride', {
      width: 1280,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await until(page, 'window.innerWidth === 1280', 'the desktop viewport returns');

    await page.evaluate(`document.querySelector('dialog.sheet[open]').close()`);
    await until(
      page,
      "document.querySelector('dialog.sheet[open]') === null",
      'the Alpha panel closes',
    );

    // The empty body is a sentence, not an empty space.
    await page.evaluate(`(function () {
      var cards = Array.prototype.slice.call(
        document.querySelectorAll('#board-root .card'),
      );
      var beta = cards.filter(function (card) {
        return card.textContent.indexOf('Beta') !== -1;
      })[0];
      beta.querySelector('.card-title .enter').click();
    })()`);
    await until(
      page,
      "document.querySelector('dialog.sheet[open]') !== null",
      'the Beta panel opens',
    );
    const beta = await page.evaluate(`(function () {
      var sheet = document.querySelector('dialog.sheet[open]');
      var facts = {};
      Array.prototype.forEach.call(
        sheet.querySelectorAll('dt'),
        function (dt) {
          facts[dt.textContent] = dt.nextElementSibling
            ? dt.nextElementSibling.textContent
            : null;
        },
      );
      return {
        firstText: sheet.querySelector('.sheet-inner').innerText,
        sections: {
          description: !!sheet.querySelector('.sheet-description'),
          conditions: !!sheet.querySelector('.sheet-conditions'),
          history: !!sheet.querySelector('.sheet-history'),
          conversation: !!sheet.querySelector('.sheet-conversation'),
          primary: !!sheet.querySelector('.facts-primary'),
        },
        facts: facts,
      };
    })()`);
    // Ruling 2: Beta's body is empty, its contract pins no conditions, it has
    // no attempt and no mirror. None of those four is drawn, and no `not
    // reported` row replaces them. Ruling 1: Beta waits for Alpha, and the
    // edge carries no `satisfied_by`, so that is not claimed as satisfied.
    assert.deepEqual(beta.sections, {
      description: false,
      conditions: false,
      history: false,
      conversation: false,
      primary: true,
    });
    assert.equal(beta.facts['Waits for'], 'Alpha.');
    assert.equal(beta.facts.Contract, "This task's contract pins no conditions.");
    assert.equal(beta.facts.Attempts, '0 runs');
    assert.equal('Description' in beta.facts, false);
    assert.equal(
      /Done when|No description yet|Not attempted yet|No conversation/.test(
        beta.firstText,
      ),
      false,
      'no empty heading or empty-state sentence on the first screen',
    );
    await page.evaluate(`document.querySelector('dialog.sheet[open]').close()`);
    await until(
      page,
      "document.querySelector('dialog.sheet[open]') === null",
      'the Beta panel closes',
    );

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
        title: document.title,
      };
    })()`);
    assert.equal(cold.hash, '#board/box');
    assert.equal(cold.scope, 'box');
    assert.equal(cold.cards, 4);
    assert.equal(cold.level, '2 live · 2 archived in this level · 6 lanes empty');
    assert.equal(cold.progress, '1 of 5 done · 1 skipped · 4 archived');
    assert.equal(cold.here, 'box');
    assert.equal(cold.title, 'Box of work · Engine board');
    const coldSkin = await page.evaluate(`(function () {
      var provenance = document.querySelector('details.provenance');
      var focus = document.querySelector('#board-root .focus-line');
      return {
        provenanceOpen: provenance ? provenance.open : null,
        isoText: /\d{4}-\d\d-\d\dT/.test(document.body.innerText),
        focus: focus ? focus.textContent : null,
        focusSum: focus
          ? focus.textContent.split(' · ').reduce(function (sum, part) {
              return sum + Number(part.split(' ')[0]);
            }, 0)
          : 0,
      };
    })()`);
    assert.equal(coldSkin.provenanceOpen, false);
    assert.equal(coldSkin.isoText, false);
    // The box's children are done and skipped; the header names the two lanes
    // that hold them so it adds up to the level's live total.
    assert.equal(coldSkin.focus, '1 done · 1 set aside');
    assert.equal(coldSkin.focusSum, 2, 'the focus line adds up to the two live rows');
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
        focusSum: focus
          ? focus.textContent.split(' · ').reduce(function (sum, part) {
              return sum + Number(part.split(' ')[0]);
            }, 0)
          : 0,
        live: Number(document.querySelector('#board-root .level strong').textContent),
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
    assert.equal(board.focus, '1 can start · 2 waiting · 2 not started');
    assert.equal(board.focusSum, board.live, 'the focus line adds up to the level total');
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
        focusSum: focus
          ? focus.textContent.split(' · ').reduce(function (sum, part) {
              return sum + Number(part.split(' ')[0]);
            }, 0)
          : 0,
        live: Number(document.querySelector('#board-root .level strong').textContent),
        lanes: {
          canStart: laneCount('can-start'),
          inProgress: laneCount('in-progress'),
          waitingOther: laneCount('waiting-for-other-work'),
          done: laneCount('done'),
        },
        runningInCanStart: document.querySelectorAll(
          '#board-root .lane[data-lane="can-start"] .card[data-phase="live"]',
        ).length,
        edge: (function () {
          var layer = document.querySelector('#board-root .edge-layer');
          var paths = layer ? layer.querySelectorAll('path') : [];
          var path = paths[0];
          function cardTitle(id) {
            var card = id
              ? document.querySelector('#board-root .card[data-task="' + id + '"]')
              : null;
            var title = card ? card.querySelector('.card-title') : null;
            return title ? title.textContent : null;
          }
          var geometry = null;
          if (path) {
            var wrap = document.querySelector('#board-root .lanes');
            var box = wrap.getBoundingClientRect();
            var fromCard = document.querySelector(
              '#board-root .card[data-task="' + path.getAttribute('data-from') + '"]',
            );
            var toCard = document.querySelector(
              '#board-root .card[data-task="' + path.getAttribute('data-to') + '"]',
            );
            var f = fromCard.getBoundingClientRect();
            var t = toCard.getBoundingClientRect();
            var dText = path.getAttribute('d');
            var m = dText.match(/^M ([-\\d.]+) ([-\\d.]+)/);
            // A routed line ends with a Q then H; a curve ends with C x2 y2.
            var bus = dText.match(/Q ([-\\d.]+) ([-\\d.]+) ([-\\d.]+) ([-\\d.]+) H ([-\\d.]+)$/);
            var curve = dText.match(/([-\\d.]+) ([-\\d.]+)$/);
            geometry = {
              startX: Number(m[1]),
              startY: Number(m[2]),
              endX: bus ? Number(bus[5]) : Number(curve[1]),
              endY: bus ? Number(bus[4]) : Number(curve[2]),
              fromRight: f.right - box.left,
              fromBottom: f.bottom - box.top,
              toLeft: t.left - box.left,
              toTop: t.top - box.top,
              toBottom: t.bottom - box.top,
            };
          }
          return {
            count: paths.length,
            from: path ? path.getAttribute('data-from') : null,
            to: path ? path.getAttribute('data-to') : null,
            fromTitle: path ? cardTitle(path.getAttribute('data-from')) : null,
            toTitle: path ? cardTitle(path.getAttribute('data-to')) : null,
            d: path ? path.getAttribute('d') : '',
            geometry: geometry,
            height: layer ? Number(layer.getAttribute('height')) : 0,
            laneHeight: (function () {
              var lane = document.querySelector(
                '#board-root .lane[data-lane="can-start"]',
              );
              return lane ? lane.offsetHeight : 0;
            })(),
          };
        })(),
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
    assert.equal(crowded.focus, '12 can start · 2 in progress · 1 waiting · 1 done');
    assert.equal(crowded.focusSum, crowded.live, 'the focus line adds up to the level total');
    // R3: the line survives the twelve-card lane: it is drawn from the card in
    // that lane to the waiting card, over the lane's full height, with no NaN
    // coordinate from a zero-size measurement.
    assert.equal(crowded.edge.count, 1);
    assert.equal(crowded.edge.fromTitle, 'Render the tree from the read');
    assert.equal(crowded.edge.toTitle, 'Prove it in a real browser');
    assert.equal(/NaN/.test(crowded.edge.d), false);
    // The line leaves the blocker's own edge and arrives on the blocked
    // card's own edge, at a point inside its height.
    assert.ok(
      Math.abs(crowded.edge.geometry.startX - crowded.edge.geometry.fromRight) <= 1,
      `starts on the blocker (${crowded.edge.geometry.startX} vs ${crowded.edge.geometry.fromRight})`,
    );
    assert.ok(
      Math.abs(crowded.edge.geometry.endX - crowded.edge.geometry.toLeft) <= 1,
      `ends on the blocked card (${crowded.edge.geometry.endX} vs ${crowded.edge.geometry.toLeft})`,
    );
    assert.ok(
      crowded.edge.geometry.endY >= crowded.edge.geometry.toTop - 1 &&
        crowded.edge.geometry.endY <= crowded.edge.geometry.toBottom + 1,
      'the end point is inside the blocked card',
    );
    assert.ok(
      crowded.edge.height >= crowded.edge.laneHeight - 2,
      `the layer spans the twelve-card lane (height ${crowded.edge.height}, lane ${crowded.edge.laneHeight})`,
    );
    assert.ok(crowded.edge.laneHeight > 800, 'the crowded lane really is twelve deep');
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
    // The six-way fan: one blocker, six dependents, in adjacent lanes. A
    // curve between ports 18 px apart reads as a stripe on the lane edge, so
    // the fan must leave one port, run one trunk, and branch into each card.
    const fan = await page.evaluate(`(function () {
      var wrap = document.querySelector('#board-root .lanes');
      var box = wrap.getBoundingClientRect();
      var layer = document.querySelector('#board-root .edge-layer');
      var paths = Array.prototype.slice.call(
        layer ? layer.querySelectorAll('path') : [],
      );
      var groups = {};
      paths.forEach(function (path) {
        var from = path.getAttribute('data-from');
        (groups[from] = groups[from] || []).push(path);
      });
      var group = null;
      Object.keys(groups).forEach(function (key) {
        if (groups[key].length === 6) group = groups[key];
      });
      if (!group) return null;
      return {
        count: group.length,
        starts: group.map(function (path) {
          return path.getAttribute('d').match(/^M [^ ]+ [^ ]+/)[0];
        }),
        routes: group.map(function (path) {
          var d = path.getAttribute('d');
          var card = document.querySelector(
            '#board-root .card[data-task="' + path.getAttribute('data-to') + '"]',
          );
          var rect = card.getBoundingClientRect();
          var end = d.match(/H ([\\d.]+)$/);
          return {
            hasH: d.indexOf(' H ') !== -1,
            hasV: d.indexOf(' V ') !== -1,
            endX: end ? Number(end[1]) : null,
            cardLeft: rect.left - box.left,
          };
        }),
      };
    })()`);
    assert.ok(fan, 'the six-way fan is drawn');
    assert.equal(fan.count, 6);
    assert.equal(new Set(fan.starts).size, 1, 'one blocker leaves from one port');
    for (const route of fan.routes) {
      assert.equal(route.hasH && route.hasV, true, 'the narrow gutter is routed');
      assert.ok(
        Math.abs(route.endX - route.cardLeft) <= 1,
        `the branch ends on the card edge (${route.endX} vs ${route.cardLeft})`,
      );
    }

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
    // Ruling 1: the first screen says what the task waits for; the edge is on
    // a blocked task, so it is not claimed satisfied.
    assert.equal(
      blocked.facts['Waits for'],
      'Approve the pricing copy.',
    );
    assert.equal('Waiting for' in blocked.facts, false, 'the old field is gone');
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

    await page.evaluate(`document.querySelector('dialog.sheet[open]').close()`);
    await until(
      page,
      "document.querySelector('dialog.sheet[open]') === null",
      'the Release panel closes',
    );

    // The one `after` edge in the demo: dashed above 640 px, dropped below it
    // with the card carrying the same fact.
    await page.evaluate(`location.hash = '#board/research'`);
    await until(
      page,
      "document.getElementById('board-root').getAttribute('data-scope') === 'research'",
      'the Research workstream renders',
    );
    const readResearch = `(function () {
      var layer = document.querySelector('#board-root .edge-layer');
      var paths = Array.prototype.slice.call(
        layer ? layer.querySelectorAll('path') : [],
      );
      var plan = JSON.parse(
        document.getElementById('board-data').textContent,
      ).scopes.research;
      function sentence(id) {
        var card = document.querySelector(
          '#board-root .card[data-task="' + id + '"]',
        );
        if (!card) return null;
        var wait = card.querySelector('.card-wait');
        var after = card.querySelector('.card-after');
        return wait ? wait.textContent : after ? after.textContent : null;
      }
      return {
        paths: paths.length,
        kinds: paths.map(function (path) {
          return path.getAttribute('data-kind');
        }),
        dashed: paths[0] ? getComputedStyle(paths[0]).strokeDasharray : null,
        sentences: plan.edges.map(function (edge) {
          return sentence(edge.to);
        }),
        focus: document.querySelector('#board-root .focus-line').textContent,
      };
    })()`;
    const research = await page.evaluate(readResearch);
    assert.equal(research.paths, 1, 'the after edge is drawn at 1280');
    assert.deepEqual(research.kinds, ['after']);
    assert.notEqual(research.dashed, 'none', 'an after line is dashed');
    assert.equal(research.sentences.length, 1);
    assert.ok(
      research.sentences[0] && research.sentences[0].includes('Starts after'),
      research.sentences[0],
    );
    assert.equal(research.focus, '1 can start · 1 not started · 1 set aside');

    await page.send('Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 844,
      deviceScaleFactor: 1,
      mobile: true,
    });
    await until(page, 'window.innerWidth === 390', 'the phone viewport applies');
    // A phone loads the board at this width, so re-render the scope rather
    // than wait for a resize handler: the layer must never be built here.
    await page.evaluate(`location.hash = '#board/build'`);
    await until(
      page,
      "document.getElementById('board-root').getAttribute('data-scope') === 'build'",
      'Build renders at phone width',
    );
    await page.evaluate(`location.hash = '#board/research'`);
    await until(
      page,
      "document.getElementById('board-root').getAttribute('data-scope') === 'research'",
      'Research renders at phone width',
    );
    await until(
      page,
      "document.querySelectorAll('#board-root .edge-layer path').length === 0",
      'the line is dropped at phone width',
    );
    const phone = await page.evaluate(readResearch);
    assert.equal(phone.paths, 0, 'no line at phone width');
    assert.equal(phone.sentences.length, 1);
    assert.ok(
      phone.sentences[0] && phone.sentences[0].includes('Starts after'),
      'the card carries the dependency the layer dropped',
    );
    await page.send('Emulation.setDeviceMetricsOverride', {
      width: 1280,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    });

    assert.deepEqual(await page.evaluate('window.__pageErrors'), []);
    assert.deepEqual(page.exceptions, []);
    assert.deepEqual(page.failedRequests, []);
  },
);

test(
  'a List row collapses in place, keeps its counts, and the title still enters the scope',
  { timeout: 60000 },
  async (t) => {
    requireObscura();
    // A three-deep tree: work > alpha > alpha-one, plus a leaf sibling.
    const model = buildTree({
      provenance: {
        source_kind: 'live',
        read_at: '2026-01-01T00:00:00Z',
        engine_commit: 'page-test',
        schema_revision: 7,
        operations: [],
        port_only_steps: [],
        unobserved_states: [],
      },
      project: { project_id: 'p', config_revision: 1, max_concurrency: 2 },
      runners: [],
      runners_available: false,
      graph: {
        nodes: [
          { task_id: 'root', node_key: '$root', rest_state: 'ready', parent_task_id: null },
          { task_id: 'work', node_key: 'work', rest_state: 'ready', parent_task_id: 'root', title: 'The work' },
          { task_id: 'alpha', node_key: 'work/alpha', rest_state: 'ready', parent_task_id: 'work', title: 'Alpha' },
          { task_id: 'alpha-one', node_key: 'work/alpha/one', rest_state: 'done', parent_task_id: 'alpha', title: 'Alpha one' },
          { task_id: 'beta', node_key: 'work/beta', rest_state: 'blocked', parent_task_id: 'work', title: 'Beta' },
          { task_id: 'solo', node_key: 'solo', rest_state: 'ready', parent_task_id: 'root', title: 'Solo' },
        ],
        edges: [],
      },
      statuses: [
        { task_id: 'work', rest_state: 'ready', title: 'The work', handoff_revision: 1 },
        { task_id: 'alpha', rest_state: 'ready', title: 'Alpha', handoff_revision: 1 },
        { task_id: 'alpha-one', rest_state: 'done', title: 'Alpha one', handoff_revision: 1 },
        { task_id: 'beta', rest_state: 'blocked', title: 'Beta', handoff_revision: 1 },
        { task_id: 'solo', rest_state: 'ready', title: 'Solo', handoff_revision: 1 },
      ],
      tree_key: 'tree',
      root_task_id: 'root',
    });
    const dir = mkdtempSync(join(tmpdir(), 'engine-board-list-'));
    const listFile = join(dir, 'list.html');
    writeFileSync(listFile, renderListPage(model));
    const url = pathToFileURL(listFile).href;

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
    const page = await openPage(browser, url);
    await page.navigate(url);
    await until(
      page,
      "document.querySelector('li[data-key=\"work\"] button.disclosure') !== null",
      'the disclosure is rendered',
    );

    const read = `(function () {
      var row = document.querySelector('li[data-key="work"]');
      var button = row.firstElementChild.querySelector('button.disclosure');
      var list = document.getElementById(button.getAttribute('aria-controls'));
      var counts = row.firstElementChild.querySelector('.row-count');
      var solo = document.querySelector('li[data-key="solo"]');
      return {
        tag: button.tagName,
        expanded: button.getAttribute('aria-expanded'),
        controls: button.getAttribute('aria-controls'),
        ownsList: list !== null,
        hidden: list ? list.hidden : null,
        listDisplay: list ? getComputedStyle(list).display : null,
        label: button.getAttribute('aria-label'),
        hash: location.hash,
        title: document.title,
        counts: counts ? counts.textContent : null,
        countsVisible: counts ? counts.offsetParent !== null : false,
        leafDisclosure: solo.firstElementChild.querySelector('button.disclosure'),
        leafSpacer: solo.firstElementChild.querySelector('.disclosure-spacer') !== null,
        dialogOpen: document.querySelector('dialog.sheet[open]') !== null,
      };
    })()`;

    const open = await page.evaluate(read);
    assert.equal(open.tag, 'BUTTON');
    assert.equal(open.expanded, 'true');
    assert.equal(open.ownsList, true, 'aria-controls names a real list');
    assert.equal(open.hidden, false);
    assert.equal(open.counts, '3 inside · 1 done');
    assert.equal(open.countsVisible, true);
    assert.equal(open.leafDisclosure, null, 'a leaf has no disclosure');
    assert.equal(open.leafSpacer, true, 'a leaf keeps the column');
    assert.equal(open.dialogOpen, false);

    // ---- collapse in place -------------------------------------------------
    await page.evaluate(`(function () {
      document
        .querySelector('li[data-key="work"] button.disclosure')
        .click();
    })()`);
    const collapsed = await page.evaluate(read);
    assert.equal(collapsed.expanded, 'false');
    assert.equal(collapsed.hidden, true, 'the children list is hidden');
    assert.equal(collapsed.listDisplay, 'none');
    assert.equal(
      collapsed.label,
      'Expand the subtasks of The work',
      'assistive technology hears the action',
    );
    assert.equal(collapsed.hash, open.hash, 'collapsing does not navigate');
    assert.equal(collapsed.title, open.title, 'collapsing does not change scope');
    assert.equal(collapsed.counts, open.counts, 'the counts survive the collapse');
    assert.equal(collapsed.countsVisible, true);
    assert.equal(collapsed.dialogOpen, false, 'collapsing does not open the panel');

    await page.evaluate(`(function () {
      document
        .querySelector('li[data-key="work"] button.disclosure')
        .click();
    })()`);
    assert.equal(
      (await page.evaluate(read)).expanded,
      'true',
      'the second click restores the children',
    );

    // ---- a nested branch keeps its own state -------------------------------
    await page.evaluate(`(function () {
      document
        .querySelector('li[data-key="work/alpha"] button.disclosure')
        .click();
    })()`);
    await page.evaluate(`(function () {
      document
        .querySelector('li[data-key="work"] button.disclosure')
        .click();
    })()`);
    await page.evaluate(`(function () {
      document
        .querySelector('li[data-key="work"] button.disclosure')
        .click();
    })()`);
    const nested = await page.evaluate(`(function () {
      var alpha = document.querySelector('li[data-key="work/alpha"]');
      var button = alpha.firstElementChild.querySelector('button.disclosure');
      var list = document.getElementById(button.getAttribute('aria-controls'));
      return { expanded: button.getAttribute('aria-expanded'), hidden: list.hidden };
    })()`);
    assert.equal(nested.expanded, 'false', 'the nested branch stayed collapsed');
    assert.equal(nested.hidden, true);

    // ---- keyboard and assistive technology ---------------------------------
    // A real button, not a clickable div: this is what makes Enter and Space
    // activation the platform's job, and the accessibility tree is where that
    // contract is measured.
    const axState = async () => {
      const tree = await page.send('Accessibility.getFullAXTree');
      const node = tree.nodes.find((candidate) =>
        String(candidate.name ? candidate.name.value : '').includes(
          'the subtasks of The work',
        ),
      );
      if (!node) return null;
      const property = (name) => {
        const found = (node.properties || []).find((entry) => entry.name === name);
        return found ? found.value.value : null;
      };
      return {
        role: node.role.value,
        name: node.name.value,
        focusable: property('focusable'),
        expanded: property('expanded'),
      };
    };
    const openAx = await axState();
    assert.deepEqual(openAx, {
      role: 'button',
      name: 'Collapse the subtasks of The work',
      focusable: true,
      expanded: true,
    });

    const press = async (key, code, keyCode, text) => {
      await page.send('Input.dispatchKeyEvent', {
        type: 'keyDown',
        key,
        code,
        text,
        unmodifiedText: text,
        windowsVirtualKeyCode: keyCode,
        nativeVirtualKeyCode: keyCode,
      });
      await page.send('Input.dispatchKeyEvent', {
        type: 'keyUp',
        key,
        code,
        windowsVirtualKeyCode: keyCode,
        nativeVirtualKeyCode: keyCode,
      });
      await new Promise((resolve) => setTimeout(resolve, 60));
    };
    const keys = await page.evaluate(`(function () {
      window.__keys = [];
      var button = document.querySelector('li[data-key="work"] button.disclosure');
      button.addEventListener('keydown', function (event) {
        window.__keys.push('down:' + event.key);
      });
      button.addEventListener('keyup', function (event) {
        window.__keys.push('up:' + event.key);
      });
      button.focus();
      return {
        focused: document.activeElement === button,
        tag: button.tagName,
        type: button.type,
        disabled: button.disabled,
        tabIndex: button.tabIndex,
      };
    })()`);
    assert.equal(keys.focused, true, 'the disclosure takes focus');
    assert.equal(keys.tag, 'BUTTON', 'a native button owns the keyboard');
    assert.equal(keys.type, 'button');
    assert.equal(keys.disabled, false);
    assert.equal(keys.tabIndex, 0, 'the control is in the tab order');
    // Obscura delivers the key events but does not synthesise a button's
    // native activation, so this asserts the control receives Enter and Space
    // while focused; the activation path itself is the click asserted above,
    // which is the same event a native button fires for those keys.
    await press('Enter', 'Enter', 13, '\r');
    await press(' ', 'Space', 32, ' ');
    assert.deepEqual(
      await page.evaluate('window.__keys'),
      ['down:Enter', 'up:Enter', 'down: ', 'up: '],
      'Enter and Space reach the focused disclosure',
    );
    assert.equal(
      await page.evaluate(
        "document.querySelector('li[data-key=\"work\"] button.disclosure').getAttribute('aria-expanded')",
      ),
      'true',
      'the keys did not change scope or state',
    );

    // The accessibility tree carries the state after a real activation.
    await page.evaluate(`document
      .querySelector('li[data-key="work"] button.disclosure')
      .click()`);
    const collapsedAx = await axState();
    assert.equal(collapsedAx.role, 'button');
    assert.equal(collapsedAx.name, 'Expand the subtasks of The work');
    assert.equal(collapsedAx.expanded, false, 'collapsed is reported to AT');
    // Restore the branch for the title test below.
    await page.evaluate(`document
      .querySelector('li[data-key="work"] button.disclosure')
      .click()`);

    // ---- the row itself is the third gesture -------------------------------
    // A click on the row's own space still opens the panel; only the
    // disclosure and the scope link are exempt.
    await page.evaluate(`document.querySelector('li[data-key="solo"]').click()`);
    await until(
      page,
      "document.querySelector('dialog.sheet[open]') !== null",
      'the row space opens the panel',
    );
    assert.equal(
      await page.evaluate(
        "document.querySelector('dialog.sheet[open] h2').textContent",
      ),
      'Solo',
      'the row opened its own panel',
    );
    await page.evaluate(`document.querySelector('dialog.sheet[open]').close()`);

    // ---- the title enters the scope, a different gesture -------------------
    await page.evaluate(`(function () {
      document
        .querySelector('li[data-key="work"] button.disclosure')
        .click();
    })()`);
    await page.evaluate(`document.querySelector('li[data-key="work"] .enter').click()`);
    await until(
      page,
      "location.hash === '#list/work'",
      'the title enters the work scope',
    );
    await until(
      page,
      "document.querySelector('.here-tag:not([hidden])') !== null",
      'the here tag follows the scope',
    );
    const entered = await page.evaluate(`(function () {
      var tag = document.querySelector('.here-tag:not([hidden])');
      var button = document.querySelector('li[data-key="work"] button.disclosure');
      return {
        hash: location.hash,
        here: tag ? tag.closest('li').getAttribute('data-key') : null,
        expanded: button.getAttribute('aria-expanded'),
        dialogOpen: document.querySelector('dialog.sheet[open]') !== null,
      };
    })()`);
    assert.equal(entered.here, 'work');
    assert.equal(entered.expanded, 'false', 'the title did not toggle the disclosure');
    assert.equal(entered.dialogOpen, false, 'the title did not open the panel');
    assert.equal(
      await page.evaluate('document.title'),
      'The work · Engine board — everything',
      'the List title follows the scope',
    );

    // ---- state is per page load -------------------------------------------
    await page.navigate(url);
    await until(
      page,
      "document.querySelector('li[data-key=\"work\"] button.disclosure') !== null",
      'the reloaded List renders',
    );
    assert.equal(
      (await page.evaluate(read)).expanded,
      'true',
      'a fresh page load starts expanded',
    );

    assert.deepEqual(await page.evaluate('window.__pageErrors'), []);
    assert.deepEqual(page.exceptions, []);
    assert.deepEqual(page.failedRequests, []);
  },
);
