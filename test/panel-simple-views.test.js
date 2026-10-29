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

test('reorder: nonmanual sort switches first without a write; impossible unmarked slot never rewrites neighbour', async () => {
  const { app, hostCalls } = await setup();
  const items = [draft(1), draft(2, null)];
  app.setState({ issues: items, viewState: { view: 'simple', filters: ['stage:draft'], sort: 'priority' } });
  await app.reorderDraft(items[0], items, 1);
  assert.equal(app.getState().viewState.sort, 'manual');
  assert.equal(writes(hostCalls).length, 0);
  await app.reorderDraft(items[0], items, 1);
  assert.equal(writes(hostCalls).length, 0);
  assert.equal(parseOrderMarker(items[1].body), null);
  assert.ok(toasts(hostCalls).some((message) => message.includes('more than one marker')));
});

test('All Projects transfer uses repo-aware IDs and real transfer, never copy/delete; failure keeps identity', async () => {
  let reject = false;
  const { app, hostCalls } = await setup({ onRequest: async (request) => {
    if (request.path === '/graphql') return response(reject ? { errors: [{ message: 'Transfer denied' }] } : { data: { transferIssue: { issue: { number: 19, url: 'https://github.com/acme/other/issues/19', repository: { nameWithOwner: 'acme/other' } } } } });
    return response({ node_id: request.path?.endsWith('/issues/1') ? 'ISSUE_A' : 'REPO_B' });
  } });
  const one = draft(1), unrelated = draft(1, 1000, 'other/same-number');
  app.setState({ issues: [one, unrelated], isAllProjectsMode: true });
  await app.transferDraftProject(one, 'acme/other');
  assert.equal(one.repo, 'acme/other');
  assert.equal(one.number, 19);
  assert.equal(unrelated.repo, 'other/same-number');
  assert.equal(app.getState().activeStreamEpoch, 2, 'transfer invalidates refreshes with pre-transfer identity');
  const mutation = hostCalls.find((call) => call.type === 'request' && call.payload.path === '/graphql');
  assert.deepEqual(JSON.parse(mutation.payload.body).variables, { issue: 'ISSUE_A', repository: 'REPO_B' });
  assert.equal(hostCalls.some((call) => call.type === 'request' && call.payload.method === 'DELETE'), false);
  reject = true;
  await app.transferDraftProject(unrelated, 'acme/other');
  assert.equal(unrelated.repo, 'other/same-number');
  assert.equal(unrelated.number, 1);
  assert.ok(toasts(hostCalls).some((message) => message.includes('Transfer denied')));
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
