import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createTestApp } from './test-app-harness.js';
import { normalizeGithubIssues } from '../panel/core.ts';
import { parseOrderMarker, setOrderMarker, stripOrderMarker } from '../panel/viewstate.ts';

const wait = (ms = 40) => new Promise((resolve) => setTimeout(resolve, ms));
const response = (body, status = 200) => ({ status, body: JSON.stringify(body) });
const draft = (number, order = number * 1000, repo = 'acme/task-board') => normalizeGithubIssues([{
  number, title: `Idea ${number}`, repo, body: order === null ? '' : setOrderMarker(`Inspiration ${number}`, order),
  labels: ['status:draft'], state: 'open', created_at: `2026-01-0${number}T00:00:00Z`,
}])[0];
const setup = async (options = {}) => {
  const harness = createTestApp(options);
  harness.app.setState({ currentRepo: 'acme/task-board', isManualRepoOverride: true,
    viewState: { view: 'simple', filters: ['stage:draft'], sort: 'manual' } });
  await wait();
  return harness;
};
const writes = (calls) => calls.filter((call) => call.type === 'request' && call.payload.method === 'PATCH');
const toasts = (calls) => calls.filter((call) => call.type === 'toast').map((call) => call.payload.message);

test('quick capture: optimistic draft, one POST, optional description, no agent session', async () => {
  let release;
  const { app, hostCalls } = await setup({ onRequest: async (request) => {
    if (request.method === 'POST') return await new Promise((resolve) => { release = () => resolve(response({ ...JSON.parse(request.body), number: 9 })); });
    return response({});
  } });
  app.setState({ issues: [], draftCaptureTitle: '  A new idea  ', draftCaptureDescription: 'Just inspiration' });
  const create = app.createQuickCaptureDraft();
  assert.equal(app.getState().draftCaptureBusy, true);
  assert.equal(app.getState().issues.length, 1);
  assert.ok(app.getState().issues[0].number < 0);
  await wait();
  const post = hostCalls.find((call) => call.type === 'request' && call.payload.method === 'POST');
  assert.equal(post.payload.path, '/repos/acme/task-board/issues');
  const payload = JSON.parse(post.payload.body);
  assert.deepEqual(payload.labels, ['status:draft']);
  assert.equal(payload.title, 'A new idea');
  assert.equal(stripOrderMarker(payload.body), 'Just inspiration');
  assert.equal(parseOrderMarker(payload.body), 1000);
  release();
  await create;
  assert.deepEqual(app.getState().issues.map((issue) => issue.number), [9]);
  assert.equal(app.getState().draftCaptureTitle, '');
  assert.equal(app.getState().draftCaptureDescription, '');
  assert.equal(hostCalls.some((call) => /start.session/i.test(call.type)), false);
});

test('quick capture: failed creation rolls back temporary row and keeps input for retry', async () => {
  const { app, hostCalls } = await setup({ onRequest: async () => response({}, 422) });
  app.setState({ issues: [], draftCaptureTitle: 'Keep me', draftCaptureDescription: '' });
  await app.createQuickCaptureDraft();
  assert.equal(app.getState().issues.length, 0);
  assert.equal(app.getState().draftCaptureTitle, 'Keep me');
  assert.equal(app.getState().draftCaptureBusy, false);
  assert.ok(toasts(hostCalls).some((message) => message.includes('Could not create draft')));
});

test('empty draft list keeps bottom add row, title-only body hides marker, Shift+Enter reveals description', async () => {
  const { app, elements } = await setup();
  app.setState({ issues: [] });
  app.renderViews();
  const list = elements.get('simpleListViewContainer');
  assert.ok(list.textContent.includes('No drafts match'));
  assert.equal(list.children.at(-1).className, 'simple-add');
  const title = list.querySelector('#draftCaptureTitle');
  const description = list.querySelector('#draftCaptureDescription');
  title.dispatchEvent({ type: 'keydown', key: 'Enter', shiftKey: true, preventDefault() {} });
  assert.notEqual(description.style.display, 'none');
  app.setState({ issues: [draft(1, null)] });
  app.renderViews();
  assert.equal(list.querySelector('.simple-description').value, '');
  assert.equal(list.innerHTML.includes('board-order'), false);
  assert.equal(list.querySelectorAll('input[type="checkbox"]').length, 0);
});

test('inline title edit: optimistic update and rollback/toast on rejection', async () => {
  let release, started;
  const patchStarted = new Promise((resolve) => { started = resolve; });
  const { app, hostCalls } = await setup({ onRequest: async (request) => request.method === 'PATCH' ? await new Promise((resolve) => {
    release = () => resolve(response({}, 422));
    started();
  }) : response({}) });
  const issue = draft(1);
  app.setState({ issues: [issue] });
  const edit = app.editDraftTitle(issue, 'Renamed');
  assert.equal(issue.title, 'Renamed');
  await patchStarted;
  const refreshed = { ...issue };
  app.setState({ issues: [refreshed] });
  release();
  await edit;
  assert.equal(issue.title, 'Idea 1');
  assert.equal(app.getState().issues[0].title, 'Idea 1', 'rollback reaches replacement from refresh');
  assert.equal(writes(hostCalls).length, 1);
  assert.ok(toasts(hostCalls).some((message) => message.includes('Could not rename draft')));
});

test('description edit reloads first, preserves remote order and refuses changed remote description', async () => {
  let remote = setOrderMarker('Inspiration 1', 9000);
  const { app, hostCalls } = await setup({ onRequest: async (request) => response(request.method === 'GET' ? { body: remote } : {}) });
  const issue = draft(1);
  app.setState({ issues: [issue] });
  await app.editDraftDescription(issue, '', 'Inspiration 1');
  assert.equal(stripOrderMarker(issue.body), '');
  assert.equal(parseOrderMarker(issue.body), 9000);
  assert.equal(writes(hostCalls).length, 1);
  remote = setOrderMarker('Changed on another device', 10000);
  await app.editDraftDescription(issue, 'Do not overwrite', '');
  assert.equal(writes(hostCalls).length, 1, 'conflict must not PATCH');
  assert.equal(stripOrderMarker(issue.body), 'Changed on another device');
  assert.ok(toasts(hostCalls).some((message) => message.includes('changed remotely')));
});

test('drawer description editor hides marker and saving preserves its fresh value', async () => {
  const issue = draft(1);
  const { app, elements, hostCalls } = await setup({ onRequest: async (request) => response(request.method === 'GET' ? { body: setOrderMarker('Inspiration 1', 8000) } : {}) });
  app.setState({ issues: [issue], activeIssue: issue });
  elements.get('btnEditDescription').click();
  assert.equal(elements.get('drawerDescriptionTextarea').value, 'Inspiration 1');
  elements.get('drawerDescriptionTextarea').value = 'Edited in drawer';
  elements.get('btnSaveDescription').click();
  await wait(100);
  assert.equal(writes(hostCalls).length, 1);
  assert.equal(stripOrderMarker(issue.body), 'Edited in drawer');
  assert.equal(parseOrderMarker(issue.body), 8000);
});

test('reorder: locks overlapping gestures, reloads destination, PATCHes only moved issue, preserves remote body', async () => {
  const items = [draft(1), draft(2), draft(3)];
  const { app, hostCalls } = await setup({ onRequest: async (request) => {
    if (request.method === 'GET') {
      const number = Number(request.path.split('/').at(-1));
      return response({ body: setOrderMarker(`Remote inspiration ${number}`, number * 1000) });
    }
    return response({});
  } });
  app.setState({ issues: items });
  const moving = app.reorderDraft(items[2], items, 1);
  await app.reorderDraft(items[0], items, 2);
  await moving;
  assert.equal(writes(hostCalls).length, 1);
  assert.equal(writes(hostCalls)[0].payload.path, '/repos/acme/task-board/issues/3');
  assert.equal(parseOrderMarker(items[2].body), 1500);
  assert.equal(stripOrderMarker(items[2].body), 'Remote inspiration 3');
  assert.equal(parseOrderMarker(items[0].body), 1000);
  assert.equal(parseOrderMarker(items[1].body), 2000);
});

test('reorder: remote marker race aborts, failed PATCH rolls back and toasts', async () => {
  let changed = true;
  const items = [draft(1), draft(2), draft(3)];
  const { app, hostCalls } = await setup({ onRequest: async (request) => {
    if (request.method === 'GET') {
      const number = Number(request.path.split('/').at(-1));
      return response({ body: setOrderMarker(`Inspiration ${number}`, changed && number === 2 ? 2500 : number * 1000) });
    }
    return response({}, 422);
  } });
  app.setState({ issues: items });
  await app.reorderDraft(items[2], items, 1);
  assert.equal(writes(hostCalls).length, 0);
  assert.ok(toasts(hostCalls).some((message) => message.includes('Order changed')));
  changed = false;
  items[1].body = setOrderMarker('Inspiration 2', 2000);
  await app.reorderDraft(items[2], items, 1);
  assert.equal(writes(hostCalls).length, 1);
  assert.equal(parseOrderMarker(items[2].body), 3000);
  assert.ok(toasts(hostCalls).some((message) => message.includes('Failed to update')));
});

test('C1: reorder switches non-manual sort to Manual order on the first gesture and lazily initializes unmarked neighbours', async () => {
  const items = [draft(1, null), draft(2, null), draft(3, null)];
  const remoteBodies = new Map(items.map((item) => [item.number, item.body]));
  let failSecondPatch = false;
  let patchCount = 0;
  const { app, hostCalls } = await setup({ onRequest: async (request) => {
    const number = Number((request.path || '').split('/').at(-1));
    if (request.method === 'GET' && Number.isFinite(number)) {
      return response({ body: remoteBodies.get(number) ?? '' });
    }
    if (request.method === 'PATCH') {
      patchCount++;
      if (failSecondPatch && patchCount === 2) return response({ message: 'Unprocessable' }, 422);
      const nextBody = JSON.parse(request.body).body;
      remoteBodies.set(number, nextBody);
      return response({ body: nextBody });
    }
    return response({});
  } });
  app.setState({ issues: items, viewState: { view: 'simple', filters: ['stage:draft'], sort: 'priority' } });
  await app.reorderDraft(items[0], items, 1);
  assert.equal(app.getState().viewState.sort, 'manual', 'switches sort to manual');
  assert.equal(writes(hostCalls).length, 2, 'lazily initializes #2 and moves #1 on the first gesture');
  assert.equal(parseOrderMarker(items[1].body), 1000);
  assert.equal(parseOrderMarker(items[0].body), 2000);
  assert.equal(parseOrderMarker(items[2].body), null, 'untouched trailing unmarked item stays unmarked');

  // Partial failure in multi-write reorder keeps committed first write and rolls back failed write
  const freshItems = [draft(1, null), draft(2, null), draft(3, null)];
  remoteBodies.set(1, '');
  remoteBodies.set(2, '');
  remoteBodies.set(3, '');
  patchCount = 0;
  failSecondPatch = true;
  app.setState({ issues: freshItems, viewState: { view: 'simple', filters: ['stage:draft'], sort: 'manual' } });
  await app.reorderDraft(freshItems[0], freshItems, 1);
  assert.equal(patchCount, 2, 'attempts second write once without blind retry');
  assert.equal(parseOrderMarker(freshItems[1].body), 1000, 'first committed write remains intact');
  assert.equal(parseOrderMarker(freshItems[0].body), null, 'failed second write is rolled back to remote state');
  assert.ok(toasts(hostCalls).some((message) => message.includes('Failed to update')));
});

test('C2 (D55): All Projects transfer requires confirmation before network, Cancel does 0 writes, validates allowlist, and locks unconfirmed on ambiguous GraphQL error', async () => {
  let reject = false;
  let graphqlError = null;
  let confirmResult = true;
  let requestsAtConfirm = -1;
  const { app, elements, hostCalls } = await setup({
    onConfirm: () => {
      requestsAtConfirm = hostCalls.filter((call) => call.type === 'request').length;
      return confirmResult;
    },
    onRequest: async (request) => {
      if (request.path === '/graphql') {
        if (graphqlError) throw new Error(graphqlError);
        return response(
          reject
            ? { errors: [{ message: 'Transfer denied' }] }
            : { data: { transferIssue: { issue: { number: 19, url: 'https://github.com/acme/other/issues/19', repository: { nameWithOwner: 'acme/other' } } } } }
        );
      }
      return response({ node_id: request.path?.endsWith('/issues/1') ? 'ISSUE_A' : 'REPO_B' });
    },
  });
  const one = draft(1), unrelated = draft(1, 1000, 'other/same-number');
  const refs = [
    { projectId: 'p1', projectName: 'Task Board', repo: 'acme/task-board' },
    { projectId: 'p2', projectName: 'Other', repo: 'acme/other' },
    { projectId: 'p3', projectName: 'Same Number', repo: 'other/same-number' },
  ];
  app.setState({ issues: [one, unrelated], isAllProjectsMode: true, allProjectsRepoRefs: refs });
  app.renderViews();

  // 1. Cancel confirmation -> 0 network requests, select resets to source repo
  const callsBeforeCancel = hostCalls.filter((call) => call.type === 'request').length;
  confirmResult = false;
  const select = elements.get('simpleListViewContainer').querySelector('.simple-project');
  assert.ok(select);
  select.value = 'acme/other';
  select.dispatchEvent({ type: 'change', target: select, stopPropagation: () => {} });
  await wait();
  assert.equal(hostCalls.filter((call) => call.type === 'request').length, callsBeforeCancel, 'Cancel must make 0 network requests');
  assert.equal(select.value, 'acme/task-board');
  assert.equal(select.title, 'acme/task-board');
  const confirmCall = hostCalls.findLast((call) => call.type === 'confirm');
  assert.ok(confirmCall, 'must invoke confirm dialog');
  assert.match(confirmCall.payload.message, /Other|acme\/other/);
  assert.match(confirmCall.payload.message, /number|URL|link/i);

  // 2. Unlisted target repo -> refused with 0 network requests
  confirmResult = true;
  await app.transferDraftProject(one, 'unlisted/repo');
  assert.equal(hostCalls.filter((call) => call.type === 'request').length, callsBeforeCancel, 'unlisted target repo must make 0 network calls');
  assert.equal(one.repo, 'acme/task-board');

  // 3. Confirmed transfer -> confirm runs before any network request, then transfers
  await app.transferDraftProject(one, 'acme/other');
  assert.equal(requestsAtConfirm, callsBeforeCancel, 'confirmation must happen before any GET/POST request');
  assert.equal(one.repo, 'acme/other');
  assert.equal(one.number, 19);
  assert.equal(unrelated.repo, 'other/same-number');
  assert.equal(app.getState().activeStreamEpoch, 2, 'transfer invalidates refreshes with pre-transfer identity');
  const mutation = hostCalls.find((call) => call.type === 'request' && call.payload.path === '/graphql');
  assert.deepEqual(JSON.parse(mutation.payload.body).variables, { issue: 'ISSUE_A', repository: 'REPO_B' });
  assert.equal(hostCalls.some((call) => call.type === 'request' && call.payload.method === 'DELETE'), false);

  // 4. Explicit GraphQL errors array -> keeps source identity, not unconfirmed
  reject = true;
  await app.transferDraftProject(unrelated, 'acme/other');
  assert.equal(unrelated.repo, 'other/same-number');
  assert.equal(unrelated.number, 1);
  assert.equal(Boolean(unrelated.unconfirmed), false);
  assert.ok(toasts(hostCalls).some((message) => message.includes('Transfer denied')));

  // 5. Ambiguous POST /graphql failure (timeout / fetch failed) -> marks unconfirmed, no auto-retry, blocks mutations
  reject = false;
  graphqlError = 'fetch failed: network timeout';
  const graphqlBefore = hostCalls.filter((call) => call.type === 'request' && call.payload.path === '/graphql').length;
  await app.transferDraftProject(unrelated, 'acme/other');
  const graphqlAfter = hostCalls.filter((call) => call.type === 'request' && call.payload.path === '/graphql').length;
  assert.equal(graphqlAfter - graphqlBefore, 1, 'never auto-retries transferIssue');
  assert.equal(unrelated.unconfirmed, true, 'marks issue unconfirmed on ambiguous GraphQL failure');
  const requestsBeforeBlocked = hostCalls.filter((call) => call.type === 'request').length;
  await app.editDraftTitle(unrelated, 'Blocked while unconfirmed');
  await app.transferDraftProject(unrelated, 'acme/other');
  assert.equal(hostCalls.filter((call) => call.type === 'request').length, requestsBeforeBlocked, 'unconfirmed issue blocks further mutations');
});

test('H1: filter popover clamps within a 360px viewport when opened', async () => {
  const { elements, mockWindow } = await setup({ innerWidth: 360 });
  mockWindow.innerWidth = 360;
  const popover = elements.get('filterPopover');
  popover.getBoundingClientRect = () => ({ left: -147, right: 189, top: 32, bottom: 200, width: 336, height: 168 });
  elements.get('btnFilterToggle').click();
  assert.equal(popover.style.display, 'flex');
  assert.ok(popover.style.left && !popover.style.left.startsWith('-'), 'filterPopover clamps negative left offset into viewport');
});

test('H2: editDraftDescription preserves CRLF, fenced board-order examples, and skips CRLF-normalized no-op', async () => {
  const fencedCrlfBody = 'Example:\r\n```html\r\n<!-- board-order: 777 -->\r\n```\r\n\r\nLine two  \r\n\r\n<!-- board-order: 1000 -->';
  let remoteBody = fencedCrlfBody;
  const { app, hostCalls } = await setup({
    onRequest: async (request) => {
      if (request.method === 'GET') return response({ body: remoteBody });
      if (request.method === 'PATCH') {
        remoteBody = JSON.parse(request.body).body;
        return response({ body: remoteBody });
      }
      return response({});
    },
  });
  const issue = draft(1);
  issue.body = fencedCrlfBody;
  app.setState({ issues: [issue] });
  const strippedCrlf = stripOrderMarker(fencedCrlfBody);
  const browserNormalizedLf = strippedCrlf.replace(/\r\n/g, '\n');

  await app.editDraftDescription(issue, browserNormalizedLf, strippedCrlf);
  assert.equal(writes(hostCalls).length, 0, 'textarea CRLF->LF normalization alone must not trigger a PATCH');

  const editedLf = browserNormalizedLf.replace('Line two  ', 'Line two updated  ');
  await app.editDraftDescription(issue, editedLf, strippedCrlf);
  assert.equal(writes(hostCalls).length, 1);
  assert.ok(remoteBody.includes('<!-- board-order: 777 -->'), 'fenced marker example is preserved');
  assert.ok(remoteBody.includes('\r\n'), 'CRLF line endings are preserved');
  assert.equal(parseOrderMarker(remoteBody), 1000);
});

test('M1 & M2: draft rows provide Move Up/Down buttons and preserve unsaved edits, selection, and focus across renderViews and failed PATCH', async () => {
  let failPatch = false;
  const items = [draft(1, 1000), draft(2, 2000)];
  const { app, elements, mockDoc, hostCalls } = await setup({
    onRequest: async (request) => {
      if (request.method === 'GET') {
        const number = Number((request.path || '').split('/').at(-1));
        const found = items.find((i) => i.number === number);
        return response({ body: found ? found.body : '' });
      }
      if (request.method === 'PATCH') {
        if (failPatch) return response({ message: 'Validation Failed' }, 422);
        return response({});
      }
      return response({});
    },
  });
  app.setState({ issues: items, viewState: { view: 'simple', filters: ['stage:draft'], sort: 'manual' } });
  app.renderViews();

  const container = elements.get('simpleListViewContainer');
  const rows = container.querySelectorAll('.simple-row');
  assert.equal(rows.length, 2);
  const moveUp0 = rows[0].querySelector('.simple-move-up');
  const moveDown0 = rows[0].querySelector('.simple-move-down');
  assert.ok(moveUp0 && moveDown0, 'editable draft rows render Move Up and Move Down buttons');
  assert.equal(moveUp0.disabled, true, 'first row Move Up is disabled');
  assert.equal(moveDown0.disabled, false, 'first row Move Down is enabled');

  // M2: unsaved title edit + selection survives renderViews()
  const titleInput = rows[0].querySelector('.simple-title');
  titleInput.focus();
  titleInput.value = 'In-progress title';
  titleInput.setSelectionRange(3, 11);
  titleInput.dispatchEvent({ type: 'input', target: titleInput });
  app.renderViews();

  const rerenderedRow = container.querySelectorAll('.simple-row')[0];
  const rerenderedTitle = rerenderedRow.querySelector('.simple-title');
  assert.equal(rerenderedTitle.value, 'In-progress title', 'unsaved title text survives renderViews');
  assert.equal(mockDoc.activeElement, rerenderedTitle, 'active input focus survives renderViews');
  assert.equal(rerenderedTitle.selectionStart, 3);
  assert.equal(rerenderedTitle.selectionEnd, 11);

  // M2: failed description PATCH keeps unsaved description text in textarea
  const descInput = rerenderedRow.querySelector('.simple-description');
  descInput.focus();
  descInput.value = 'Unsaved inspiration that failed to save';
  descInput.dispatchEvent({ type: 'input', target: descInput });
  failPatch = true;
  await app.editDraftDescription(items[0], descInput.value, 'Inspiration 1');
  const rowAfterFail = container.querySelectorAll('.simple-row')[0];
  const descAfterFail = rowAfterFail.querySelector('.simple-description');
  assert.equal(descAfterFail.value, 'Unsaved inspiration that failed to save', 'failed PATCH must not wipe unsaved textarea value');

  // M1: clicking Move Down reorders draft #1 after #2
  failPatch = false;
  const moveDownBtn = rowAfterFail.querySelector('.simple-move-down');
  moveDownBtn.click();
  await wait(80);
  assert.equal(parseOrderMarker(items[0].body), 3000);
});

test('View/Filter/Sort persists with device scope per workspace; stale loads do not undo user choices', async () => {
  const { app, hostCalls, mockStorage, emitDirectory } = await setup({ features: { deviceStorage: true } });
  app.setState({ currentDirectory: '/workspace/a', viewState: { view: 'cards', filters: ['questions'], sort: 'updated' } });
  app.rememberViewState();
  await wait();
  const saved = hostCalls.findLast((call) => call.type === 'storage' && call.payload.op === 'set' && call.payload.key.startsWith('view_state_'));
  assert.equal(saved.payload.scope, 'device');
  assert.equal(saved.payload.key, 'view_state_/workspace/a');
  mockStorage.set('view_state_/workspace/b', { view: 'pending', filters: ['human'], sort: 'created' });
  await emitDirectory('/workspace/b');
  await wait();
  assert.deepEqual(app.getState().viewState, { view: 'pending', filters: ['human'], sort: 'created' });
  const load = app.loadViewState();
  app.setState({ viewState: { view: 'graph', filters: [], sort: 'manual' } });
  app.rememberViewState();
  await load;
  assert.equal(app.getState().viewState.view, 'graph');
  app.setState({ viewState: { view: 'cards', filters: [], sort: 'updated' } });
  app.rememberViewState();
  app.setState({ viewState: { view: 'pending', filters: ['human'], sort: 'created' } });
  app.rememberViewState();
  await app.loadViewState();
  assert.deepEqual(mockStorage.get('view_state_/workspace/b'), { view: 'pending', filters: ['human'], sort: 'created' });
  assert.equal(app.getState().viewState.view, 'pending');
  await emitDirectory('/workspace/unseen');
  await wait();
  assert.deepEqual(app.getState().viewState, { view: 'simple', filters: [], sort: 'priority' });
});

test('Project names settings saves override, keeps full repository tooltip, and rolls back storage rejection', async () => {
  let reject = false;
  const { app, elements, hostCalls, mockStorage } = await setup({ onPostMessage: async (call) => {
    if (reject && call.type === 'storage' && call.payload.op === 'set' && call.payload.key === 'project_name_overrides') return { error: 'Storage unavailable' };
  } });
  elements.get('menuItemSettings').click();
  let input = elements.get('projectNamesList').querySelector('[data-repo-name]');
  assert.ok(input);
  input.value = 'My board';
  elements.get('btnSaveProjectNames').click();
  await wait();
  assert.deepEqual(mockStorage.get('project_name_overrides'), { 'acme/task-board': 'My board' });
  assert.equal(elements.get('txtRepoLabel').textContent, 'My board');
  elements.get('menuItemSettings').click();
  input = elements.get('projectNamesList').querySelector('[data-repo-name]');
  input.value = 'Must not persist';
  reject = true;
  elements.get('btnSaveProjectNames').click();
  await wait();
  assert.equal(app.getState().projectNameOverrides['acme/task-board'], 'My board');
  assert.ok(toasts(hostCalls).some((message) => message.includes('Could not save project names')));
});

test('panel CSS has balanced blocks; base pill/banner styles and visible Pending layout survive simplification', () => {
  const html = fs.readFileSync(new URL('../panel/index.html', import.meta.url), 'utf8');
  const css = html.match(/<style>([\s\S]*?)<\/style>/)[1].replace(/\/\*[\s\S]*?\*\//g, '').replace(/"[^"]*"|'[^']*'/g, '');
  let depth = 0;
  for (const char of css) {
    if (char === '{') depth++;
    if (char === '}') depth--;
    assert.ok(depth >= 0, 'no unmatched closing block');
  }
  assert.equal(depth, 0, 'no missing closing media block');
  for (const selector of ['.status-pill {', '.banner {', '.banner-text {']) assert.ok(css.includes(selector));
  assert.match(html, /id="humanViewContainer" aria-label="Pending items"><\/main>/);
  assert.equal(html.includes('id="chkGraphShowDone"'), false);
  assert.equal(html.includes('id="graphThemePills"'), false);
});
