import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createTestApp } from './test-app-harness.js';
import { normalizeGithubIssues } from '../panel/core.ts';
import { getIssueDescriptionPreview, stripFriendlyTitleSection } from '../panel/markdown.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const wait = (ms = 60) => new Promise((resolve) => setTimeout(resolve, ms));
const response = (body, status = 200) => ({ status, body: JSON.stringify(body) });

const issue = (over = {}) => normalizeGithubIssues([{
  number: 1,
  title: 'feat(board): technical title',
  repo: 'acme/a',
  body: '### Overview\nFirst substantive description.',
  labels: [],
  state: 'open',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  ...over,
}])[0];

const setup = async (options = {}) => {
  const harness = createTestApp(options);
  harness.app.setState({ currentRepo: 'acme/a', isManualRepoOverride: true });
  await wait();
  return harness;
};

const patchCalls = (hostCalls) => hostCalls.filter(
  (call) => call.type === 'request' && call.payload.method === 'PATCH'
);

const confirmDialog = (mockDoc) => mockDoc.body.querySelectorAll('.confirm-backdrop')[0] || null;

const hasState = (body) => Object.prototype.hasOwnProperty.call(body, 'state');

// A fake GitHub that keeps its own issue state, independent of the panel cache.
// It records only PATCH bodies that carry `state`, so a label-only write cannot
// move the fake server.
const fakeServer = (initialStates = {}) => {
  const states = { ...initialStates };
  const transitions = [];
  const onRequest = async (payload) => {
    if (payload.method !== 'PATCH') return response({});
    let body = {};
    try { body = JSON.parse(payload.body || '{}'); } catch { body = {}; }
    const match = String(payload.path || '').match(/\/repos\/([^/]+\/[^/]+)\/issues\/(\d+)$/);
    if (match && hasState(body)) {
      const key = `${match[1]}#${match[2]}`;
      const before = states[key];
      transitions.push({ key, before, after: body.state, changed: before !== body.state });
      states[key] = body.state;
    }
    return response({ ok: true });
  };
  return { states, transitions, onRequest };
};

const clickCancel = (mockDoc) => {
  const dialog = confirmDialog(mockDoc);
  assert.ok(dialog, 'the confirmation dialog is present');
  dialog.querySelector('.confirm-cancel').click();
};

const clickConfirm = (mockDoc) => {
  const dialog = confirmDialog(mockDoc);
  assert.ok(dialog, 'the confirmation dialog is present');
  dialog.querySelector('.confirm-confirm').click();
};

const pressEscape = (mockDoc) => {
  mockDoc.dispatchEvent({
    type: 'keydown',
    key: 'Escape',
    preventDefault: () => {},
    stopPropagation: () => {},
  });
};

test('Friendly Title preview never returns the metadata label and keeps the first overview line', () => {
  const inline = '### Friendly Title: Ship the narrow drawer\n\n### Overview\nFirst substantive description.';
  assert.equal(getIssueDescriptionPreview(inline), 'First substantive description.');

  const multiline = '### Friendly Title:\nShip the narrow drawer\n\n### Overview\nFirst substantive description.';
  assert.equal(getIssueDescriptionPreview(multiline), 'First substantive description.');

  const bold = '**Friendly Title:** Ship the narrow drawer\n\n### Overview\nFirst substantive description.';
  assert.equal(getIssueDescriptionPreview(bold), 'First substantive description.');

  const fallback = '### Overview\nFirst substantive description.';
  assert.equal(getIssueDescriptionPreview(fallback), 'First substantive description.');
});

test('an empty Friendly Title keeps the following Overview heading', () => {
  const body = '### Friendly Title:\n\n### Overview\nFirst substantive description.';
  assert.equal(stripFriendlyTitleSection(body), '### Overview\nFirst substantive description.');
  assert.equal(getIssueDescriptionPreview(body), 'First substantive description.');
});

test('simple list hides actually closed issues by default and an explicit control reveals them', async () => {
  const openIssue = issue({ number: 1, title: 'Open task' });
  const closedIssue = issue({ number: 2, title: 'Closed task', state: 'closed', labels: [{ name: 'status:done' }] });
  const { app, elements } = await setup();
  app.setState({ issues: [openIssue, closedIssue], viewState: { view: 'simple', filters: [], sort: 'priority' } });
  app.renderViews();

  const list = elements.get('simpleListViewContainer');
  assert.equal(list.querySelectorAll('.simple-row').length, 1, 'closed issue is hidden in the default simple list');
  assert.ok(list.textContent.includes('Open task'));

  const toggle = elements.get('filterPopover').querySelector('[data-filter="closed"]');
  assert.ok(toggle, 'the closed visibility control is discoverable in the filter popover');
  toggle.click();
  assert.equal(list.querySelectorAll('.simple-row').length, 2, 'the control reveals closed issues');
  assert.ok(list.textContent.includes('Closed task'));
});

test('a scope change invalidates an open drawer and its stale actions', async () => {
  const openIssue = issue({ number: 1, title: 'Original task' });
  const { app, elements, hostCalls, mockDoc } = await setup({
    onRequest: async () => response({}),
  });
  app.setState({ issues: [openIssue] });
  app.openDrawer(openIssue);
  const drawer = elements.get('taskDrawer');
  assert.ok(drawer.classList.contains('active'));

  app.setRepository('acme/b', 'test-switch');
  assert.equal(app.getState().activeIssue, null, 'the old task is no longer active');
  assert.equal(drawer.classList.contains('active'), false, 'the old drawer is dismissed');

  const doneButton = elements.get('btnDrawerToggleClose');
  doneButton.onclick?.();
  await wait();
  assert.equal(confirmDialog(mockDoc), null, 'a stale action does not open a confirmation');
  assert.equal(patchCalls(hostCalls).length, 0, 'a stale drawer action cannot write');
});

test('closing the task drawer restores list scroll and returns focus to the opener', async () => {
  const openIssue = issue({ number: 1, title: 'Return target' });
  const { app, elements, mockDoc } = await setup();
  app.setState({ issues: [openIssue], viewState: { view: 'simple', filters: [], sort: 'priority' } });
  app.renderViews();

  const list = elements.get('simpleListViewContainer');
  const row = list.querySelector('.simple-row');
  list.scrollTop = 240;
  row.focus();
  app.openDrawer(openIssue);
  list.scrollTop = 0;

  app.closeDrawer();
  assert.equal(list.scrollTop, 240, 'list position is restored');
  assert.equal(mockDoc.activeElement, row, 'focus returns to the opener when it is still present');
});

test('Done opens an in-panel confirmation, cancel is inert, confirm applies once', async () => {
  const openIssue = issue({ number: 7, title: 'Confirm me' });
  const { app, elements, hostCalls, mockDoc } = await setup({
    onRequest: async () => response({}),
  });
  app.setState({ issues: [openIssue] });
  app.openDrawer(openIssue);

  const doneButton = elements.get('btnDrawerToggleClose');
  assert.equal(doneButton.textContent, 'Mark done and close issue');
  doneButton.focus();
  doneButton.onclick?.();
  await wait();

  const dialog = confirmDialog(mockDoc);
  assert.ok(dialog, 'the in-panel confirmation is shown');
  assert.ok(dialog.textContent.includes('#7'), 'the dialog names the task');
  assert.ok(dialog.textContent.includes('acme/a'), 'the dialog names the repository');
  assert.equal(mockDoc.activeElement, dialog.querySelector('.confirm-cancel'), 'focus defaults to the safe control');
  assert.equal(patchCalls(hostCalls).length, 0, 'opening the dialog writes nothing');

  clickCancel(mockDoc);
  await wait();
  assert.equal(confirmDialog(mockDoc), null, 'cancel dismisses the dialog');
  assert.equal(patchCalls(hostCalls).length, 0, 'cancel writes nothing');
  assert.equal(mockDoc.activeElement, doneButton, 'focus returns to the action that opened the dialog');

  doneButton.onclick?.();
  await wait();
  clickConfirm(mockDoc);
  await wait();
  const patches = patchCalls(hostCalls);
  assert.equal(patches.length, 1, 'confirm performs exactly one write');
  assert.equal(patches[0].payload.path, '/repos/acme/a/issues/7');
  const payload = JSON.parse(patches[0].payload.body);
  assert.equal(payload.state, 'closed');
  assert.ok(payload.labels.includes('status:done'));
});

test('Escape dismisses the confirmation and writes nothing', async () => {
  const openIssue = issue({ number: 7, title: 'Escape me' });
  const { app, elements, hostCalls, mockDoc } = await setup({
    onRequest: async () => response({}),
  });
  app.setState({ issues: [openIssue] });
  app.openDrawer(openIssue);
  elements.get('btnDrawerToggleClose').onclick?.();
  await wait();
  assert.ok(confirmDialog(mockDoc), 'the confirmation is shown');
  pressEscape(mockDoc);
  await wait();
  assert.equal(confirmDialog(mockDoc), null, 'Escape dismisses the dialog');
  assert.equal(patchCalls(hostCalls).length, 0, 'Escape writes nothing');
});

test('a repeated confirm writes at most once', async () => {
  const openIssue = issue({ number: 7, title: 'Double click' });
  const { app, elements, hostCalls, mockDoc } = await setup({
    onRequest: async () => response({}),
  });
  app.setState({ issues: [openIssue] });
  app.openDrawer(openIssue);
  elements.get('btnDrawerToggleClose').onclick?.();
  await wait();
  const confirm = confirmDialog(mockDoc).querySelector('.confirm-confirm');
  confirm.click();
  confirm.click();
  await wait();
  assert.equal(patchCalls(hostCalls).length, 1, 'a repeated confirm writes once');
});

test('Done targets the original repository when two repositories share an issue number', async () => {
  const first = issue({ number: 3, title: 'First repo task', repo: 'acme/a' });
  const second = issue({ number: 3, title: 'Second repo task', repo: 'acme/b' });
  const { app, elements, hostCalls, mockDoc } = await setup({
    onRequest: async () => response({}),
  });
  app.setState({ issues: [first, second], isAllProjectsMode: true });
  app.openDrawer(first);
  elements.get('btnDrawerToggleClose').onclick?.();
  await wait();
  const dialog = confirmDialog(mockDoc);
  assert.ok(dialog, 'the confirmation is shown');
  assert.ok(dialog.textContent.includes('acme/a'), 'the dialog names the original repository');
  clickConfirm(mockDoc);
  await wait();
  const patches = patchCalls(hostCalls);
  assert.equal(patches.length, 1);
  assert.equal(patches[0].payload.path, '/repos/acme/a/issues/3');
});

test('an open issue carrying status:done is not offered as Reopen', async () => {
  const openWithDoneLabel = issue({ number: 8, title: 'Label only', state: 'open', labels: [{ name: 'status:done' }] });
  const { app, elements, hostCalls, mockDoc } = await setup({
    onRequest: async () => response({}),
  });
  app.setState({ issues: [openWithDoneLabel] });
  app.openDrawer(openWithDoneLabel);
  const doneButton = elements.get('btnDrawerToggleClose');
  assert.equal(doneButton.textContent, 'Mark done and close issue', 'real state wins over the label');
  doneButton.onclick?.();
  await wait();
  const dialog = confirmDialog(mockDoc);
  assert.ok(dialog.textContent.toLowerCase().includes('close'), 'the action offers close, not reopen');
  clickConfirm(mockDoc);
  await wait();
  const payload = JSON.parse(patchCalls(hostCalls)[0].payload.body);
  assert.equal(payload.state, 'closed');
});

test('a genuinely closed issue offers Reopen and reopens only after confirmation', async () => {
  const closed = issue({ number: 9, title: 'Closed task', state: 'closed', labels: [{ name: 'status:done' }] });
  const { app, elements, hostCalls, mockDoc } = await setup({
    onRequest: async () => response({}),
  });
  app.setState({ issues: [closed] });
  app.openDrawer(closed);
  const doneButton = elements.get('btnDrawerToggleClose');
  assert.equal(doneButton.textContent, 'Reopen issue');
  doneButton.onclick?.();
  await wait();
  assert.ok(confirmDialog(mockDoc), 'the reopen confirmation is shown');
  clickConfirm(mockDoc);
  await wait();
  const payload = JSON.parse(patchCalls(hostCalls)[0].payload.body);
  assert.equal(payload.state, 'open');
  assert.ok(payload.labels.includes('status:todo'));
});

test('the drawer status dropdown routes Done through the same confirmation', async () => {
  const openIssue = issue({ number: 12, title: 'Dropdown task' });
  const { app, elements, hostCalls, mockDoc } = await setup({
    onRequest: async () => response({}),
  });
  app.setState({ issues: [openIssue] });
  app.openDrawer(openIssue);

  const select = elements.get('drawerStatusSelect');
  select.value = 'done';
  select.dispatchEvent({ type: 'change' });
  await wait();
  assert.ok(confirmDialog(mockDoc), 'selecting Done opens the confirmation');
  assert.equal(patchCalls(hostCalls).length, 0, 'selecting Done writes nothing before confirmation');
  clickCancel(mockDoc);
  await wait();
  assert.equal(patchCalls(hostCalls).length, 0, 'cancelling the dropdown confirmation writes nothing');

  select.value = 'done';
  select.dispatchEvent({ type: 'change' });
  await wait();
  clickConfirm(mockDoc);
  await wait();
  const patches = patchCalls(hostCalls);
  assert.equal(patches.length, 1, 'confirming the dropdown performs exactly one write');
  assert.equal(JSON.parse(patches[0].payload.body).state, 'closed');
});

test('a non-state status change writes directly without a confirmation', async () => {
  const openIssue = issue({ number: 13, title: 'Move me' });
  const { app, hostCalls, mockDoc } = await setup({
    onRequest: async () => response({}),
  });
  app.setState({ issues: [openIssue] });
  await app.updateIssueStatus(openIssue, 'in-progress');
  await wait();
  assert.equal(confirmDialog(mockDoc), null, 'a non-state change does not prompt');
  const patches = patchCalls(hostCalls);
  assert.equal(patches.length, 1);
  const payload = JSON.parse(patches[0].payload.body);
  assert.equal(Object.prototype.hasOwnProperty.call(payload, 'state'), false, 'a label-only move omits state');
  assert.ok(payload.labels.includes('status:in-progress'));
});

test('background reconciliation cannot close an issue', async () => {
  const openIssue = issue({ number: 14, title: 'No background close' });
  const { app, hostCalls } = await setup({
    onRequest: async () => response({}),
  });
  app.setState({ issues: [openIssue] });
  await app.updateIssueStatus(openIssue, 'done');
  await wait();
  assert.equal(patchCalls(hostCalls).length, 0, 'automatic closure is still blocked');
});

test('a background status move cannot reopen a closed issue', async () => {
  const closedIssue = issue({ number: 30, title: 'No background reopen', state: 'closed', labels: [{ name: 'status:done' }] });
  const { app, hostCalls } = await setup({
    onRequest: async () => response({}),
  });
  app.setState({ issues: [closedIssue] });
  await app.updateIssueStatus(closedIssue, 'in-progress');
  await wait();
  assert.equal(patchCalls(hostCalls).length, 0, 'automatic reopening is blocked');
});

test('the drawer status dropdown cannot reopen a closed issue without the explicit action', async () => {
  const closedIssue = issue({ number: 31, title: 'Dropdown closed', state: 'closed', labels: [{ name: 'status:done' }] });
  const { app, elements, hostCalls, mockDoc } = await setup({
    onRequest: async () => response({}),
  });
  app.setState({ issues: [closedIssue] });
  app.openDrawer(closedIssue);

  const select = elements.get('drawerStatusSelect');
  select.value = 'in-progress';
  select.dispatchEvent({ type: 'change' });
  await wait();
  assert.equal(confirmDialog(mockDoc), null, 'the dropdown does not open a close/reopen dialog');
  assert.equal(patchCalls(hostCalls).length, 0, 'the dropdown cannot reopen a closed issue');
});

test('the card next-stage button routes Done through the same confirmation', async () => {
  const inReview = issue({ number: 40, title: 'Card close', labels: [{ name: 'status:in-review' }] });
  const { app, elements, hostCalls, mockDoc } = await setup({
    onRequest: async () => response({}),
  });
  app.setState({ issues: [inReview], viewState: { view: 'cards', filters: [], sort: 'priority' } });
  app.renderViews();

  const card = elements.get('listViewContainer').querySelectorAll('.card')[0];
  assert.ok(card, 'the card view rendered the issue');
  const next = card.querySelector('.card-btn-next');
  assert.ok(next, 'the card has a next-stage control');
  assert.equal(next.getAttribute('data-target'), 'done');
  next.click();
  await wait();
  assert.ok(confirmDialog(mockDoc), 'the next-stage close opens the confirmation');
  assert.equal(patchCalls(hostCalls).length, 0, 'the next-stage control writes nothing before confirmation');

  clickConfirm(mockDoc);
  await wait();
  const patches = patchCalls(hostCalls);
  assert.equal(patches.length, 1, 'confirming the next-stage performs exactly one write');
  assert.equal(JSON.parse(patches[0].payload.body).state, 'closed');
});

test('a scope change while the confirmation is open dismisses it and writes nothing', async () => {
  const openIssue = issue({ number: 15, title: 'Scope change' });
  const { app, elements, hostCalls, mockDoc } = await setup({
    onRequest: async () => response({}),
  });
  app.setState({ issues: [openIssue] });
  app.openDrawer(openIssue);
  elements.get('btnDrawerToggleClose').onclick?.();
  await wait();
  assert.ok(confirmDialog(mockDoc), 'the confirmation is shown');
  app.setRepository('acme/b', 'switch');
  await wait();
  assert.equal(confirmDialog(mockDoc), null, 'the scope change dismisses the confirmation');
  assert.equal(patchCalls(hostCalls).length, 0, 'the scope change writes nothing');
});

test('opening another task while the confirmation is open dismisses it and writes nothing', async () => {
  const first = issue({ number: 16, title: 'First' });
  const second = issue({ number: 17, title: 'Second' });
  const { app, elements, hostCalls, mockDoc } = await setup({
    onRequest: async () => response({}),
  });
  app.setState({ issues: [first, second] });
  app.openDrawer(first);
  elements.get('btnDrawerToggleClose').onclick?.();
  await wait();
  assert.ok(confirmDialog(mockDoc), 'the confirmation is shown');
  app.openDrawer(second);
  await wait();
  assert.equal(confirmDialog(mockDoc), null, 'the competing drawer dismisses the confirmation');
  assert.equal(patchCalls(hostCalls).length, 0, 'the competing drawer writes nothing');
});

test('a late drawer callback cannot render over a drawer that was already replaced', async () => {
  const openIssue = issue({ number: 1, title: 'Late callback target' });
  const { app, elements } = await setup();
  app.setState({ issues: [openIssue] });
  app.openDrawer(openIssue);
  const staleGeneration = app.getState().drawerGeneration;

  app.closeDrawer();
  const title = elements.get('drawerIssueTitle');
  title.textContent = 'untouched';

  app.renderDrawer(openIssue, true, staleGeneration);
  assert.equal(title.textContent, 'untouched', 'a stale generation must not repaint the drawer');
});

test('inspecting a dependency is read-only and cancelling removal writes nothing', async () => {
  const blocker = issue({ number: 302, title: 'Blocker task', body: '### Overview\nBlocks another task.' });
  const target = issue({
    number: 301,
    title: 'Blocked task',
    body: '### Overview\nBlocked task.\n\nBlocked by #302',
  });
  const { app, hostCalls, mockDoc } = await setup({
    onRequest: async () => response({}),
  });
  app.setState({ issues: [blocker, target] });

  app.openDependencyInspector({ from: 302, to: 301, fromKey: 'acme/a#302', toKey: 'acme/a#301' });
  await wait();
  assert.equal(patchCalls(hostCalls).length, 0, 'opening the inspector writes nothing');

  const cancel = mockDoc.body.querySelectorAll('.dep-inspect-cancel')[0];
  assert.ok(cancel, 'the inspector offers a cancel control');
  cancel.click();
  await wait();
  assert.equal(patchCalls(hostCalls).length, 0, 'cancelling writes nothing');
  assert.equal(mockDoc.body.querySelectorAll('.dep-inspect-popover').length, 0, 'cancel dismisses the inspector');
});

test('confirmed dependency removal names both tasks and writes only the target repository', async () => {
  const blocker = issue({ number: 302, title: 'Blocker task', body: '### Overview\nBlocks another task.' });
  const target = issue({
    number: 301,
    title: 'Blocked task',
    body: '### Overview\nBlocked task.\n\nBlocked by #302',
  });
  const { app, hostCalls, mockDoc } = await setup({
    onRequest: async () => response({}),
  });
  app.setState({ issues: [blocker, target] });

  app.requestDependencyRemoval('acme/a#301', 'acme/a#302');
  await wait();
  const dialog = confirmDialog(mockDoc);
  assert.ok(dialog, 'removal opens the in-panel confirmation');
  assert.ok(dialog.textContent.includes('#302'), 'the confirmation names the blocker');
  assert.ok(dialog.textContent.includes('#301'), 'the confirmation names the target');
  assert.ok(dialog.textContent.includes('acme/a'), 'the confirmation names the repository');
  clickCancel(mockDoc);
  await wait();
  assert.equal(patchCalls(hostCalls).length, 0, 'cancel writes nothing');

  app.requestDependencyRemoval('acme/a#301', 'acme/a#302');
  await wait();
  clickConfirm(mockDoc);
  await wait();
  const patches = patchCalls(hostCalls);
  assert.equal(patches.length, 1);
  assert.equal(patches[0].payload.path, '/repos/acme/a/issues/301');
  assert.ok(!JSON.parse(patches[0].payload.body).body.includes('#302'), 'the removed blocker is gone from the body');
});

test('the drawer dependency chip removes only through the confirmation', async () => {
  const blocker = issue({ number: 302, title: 'Blocker task', body: '### Overview\nBlocks another task.' });
  const target = issue({
    number: 301,
    title: 'Blocked task',
    body: '### Overview\nBlocked task.\n\nBlocked by #302',
  });
  const { app, elements, hostCalls, mockDoc } = await setup({
    onRequest: async () => response({}),
  });
  app.setState({ issues: [blocker, target] });
  app.openDrawer(target);

  const list = elements.get('drawerBlockedByList');
  const pill = list.querySelectorAll('.badge')[0];
  assert.ok(pill, 'the drawer shows the blocker chip');
  const remove = pill.querySelector('.badge-remove-btn');
  assert.ok(remove, 'the blocker chip has a remove control');
  pill.dispatchEvent({ type: 'click', target: remove, stopPropagation: () => {} });
  await wait();
  const dialog = confirmDialog(mockDoc);
  assert.ok(dialog, 'the chip opens the in-panel confirmation');
  assert.ok(dialog.textContent.includes('#302') && dialog.textContent.includes('#301'));
  assert.ok(dialog.textContent.includes('acme/a'));
  clickCancel(mockDoc);
  await wait();
  assert.equal(patchCalls(hostCalls).length, 0, 'cancelling the chip confirmation writes nothing');

  pill.dispatchEvent({ type: 'click', target: remove, stopPropagation: () => {} });
  await wait();
  clickConfirm(mockDoc);
  await wait();
  const patches = patchCalls(hostCalls);
  assert.equal(patches.length, 1);
  assert.equal(patches[0].payload.path, '/repos/acme/a/issues/301');
  assert.ok(!JSON.parse(patches[0].payload.body).body.includes('#302'));
});

test('archiving an open issue asks for confirmation and closes once', async () => {
  const openIssue = issue({ number: 21, title: 'Archive me', labels: [{ name: 'status:todo' }] });
  const { app, elements, hostCalls, mockDoc } = await setup({
    onRequest: async () => response({}),
  });
  app.setState({ issues: [openIssue] });
  app.openDrawer(openIssue);

  const archive = elements.get('btnDrawerArchive');
  archive.onclick?.();
  await wait();
  const dialog = confirmDialog(mockDoc);
  assert.ok(dialog, 'archiving an open issue asks for confirmation');
  assert.ok(dialog.textContent.includes('Archive'), 'the dialog names the action');
  assert.ok(dialog.textContent.includes('#21'), 'the dialog names the issue');
  assert.ok(dialog.textContent.includes('acme/a'), 'the dialog names the repository');
  assert.ok(dialog.textContent.toLowerCase().includes('closes'), 'the dialog states the actual effect');
  assert.equal(patchCalls(hostCalls).length, 0, 'opening the dialog writes nothing');

  clickCancel(mockDoc);
  await wait();
  assert.equal(patchCalls(hostCalls).length, 0, 'cancel writes nothing');

  archive.onclick?.();
  await wait();
  clickConfirm(mockDoc);
  await wait();
  const patches = patchCalls(hostCalls);
  assert.equal(patches.length, 1, 'confirm archives exactly once');
  assert.equal(patches[0].payload.path, '/repos/acme/a/issues/21');
  const payload = JSON.parse(patches[0].payload.body);
  assert.equal(payload.state, 'closed');
  assert.ok(payload.labels.includes('archived'));
  assert.ok(payload.labels.includes('status:todo'), 'the original column is preserved for restore');
});

test('unarchiving an issue that reopens asks for confirmation and reopens once', async () => {
  const archived = issue({
    number: 25,
    title: 'Restore me',
    state: 'closed',
    labels: [{ name: 'status:todo' }, { name: 'archived' }],
  });
  const { app, elements, hostCalls, mockDoc } = await setup({
    onRequest: async () => response({}),
  });
  app.setState({ issues: [archived] });
  app.openDrawer(archived);

  const archive = elements.get('btnDrawerArchive');
  archive.onclick?.();
  await wait();
  const dialog = confirmDialog(mockDoc);
  assert.ok(dialog, 'unarchiving an issue that reopens asks for confirmation');
  assert.ok(dialog.textContent.includes('Unarchive'), 'the dialog names the action');
  assert.ok(dialog.textContent.includes('#25'), 'the dialog names the issue');
  assert.ok(dialog.textContent.includes('acme/a'), 'the dialog names the repository');
  assert.ok(dialog.textContent.toLowerCase().includes('reopens'), 'the dialog states the actual effect');
  assert.equal(patchCalls(hostCalls).length, 0, 'opening the dialog writes nothing');

  clickCancel(mockDoc);
  await wait();
  assert.equal(patchCalls(hostCalls).length, 0, 'cancel writes nothing');

  archive.onclick?.();
  await wait();
  clickConfirm(mockDoc);
  await wait();
  const patches = patchCalls(hostCalls);
  assert.equal(patches.length, 1, 'confirm unarchives exactly once');
  assert.equal(patches[0].payload.path, '/repos/acme/a/issues/25');
  const payload = JSON.parse(patches[0].payload.body);
  assert.equal(payload.state, 'open');
  assert.ok(!payload.labels.includes('archived'));
  assert.ok(payload.labels.includes('status:todo'));
});

test('archiving an already closed issue keeps it closed without a state confirmation', async () => {
  const closedIssue = issue({ number: 26, title: 'Closed archive', state: 'closed', labels: [{ name: 'status:todo' }] });
  const { app, elements, hostCalls, mockDoc } = await setup({
    onRequest: async () => response({}),
  });
  app.setState({ issues: [closedIssue] });
  app.openDrawer(closedIssue);

  elements.get('btnDrawerArchive').onclick?.();
  await wait();
  assert.equal(confirmDialog(mockDoc), null, 'no state transition means no confirmation');
  const patches = patchCalls(hostCalls);
  assert.equal(patches.length, 1, 'the archive metadata write still happens directly');
  const payload = JSON.parse(patches[0].payload.body);
  assert.equal(Object.prototype.hasOwnProperty.call(payload, 'state'), false, 'a no-transition archive omits state');
  assert.ok(payload.labels.includes('archived'));
});

test('unarchiving a closed done issue stays closed without a state confirmation', async () => {
  const archivedDone = issue({
    number: 27,
    title: 'Done archive',
    state: 'closed',
    labels: [{ name: 'status:done' }, { name: 'archived' }],
  });
  const { app, elements, hostCalls, mockDoc } = await setup({
    onRequest: async () => response({}),
  });
  app.setState({ issues: [archivedDone] });
  app.openDrawer(archivedDone);

  elements.get('btnDrawerArchive').onclick?.();
  await wait();
  assert.equal(confirmDialog(mockDoc), null, 'no state transition means no confirmation');
  const patches = patchCalls(hostCalls);
  assert.equal(patches.length, 1);
  const payload = JSON.parse(patches[0].payload.body);
  assert.equal(Object.prototype.hasOwnProperty.call(payload, 'state'), false, 'a no-transition unarchive omits state');
  assert.ok(!payload.labels.includes('archived'));
  assert.ok(payload.labels.includes('status:done'));
});

test('a repeated archive gesture cannot close then reopen', async () => {
  const openIssue = issue({ number: 21, title: 'Double archive', labels: [{ name: 'status:todo' }] });
  const { app, elements, hostCalls, mockDoc } = await setup({
    onRequest: async () => response({}),
  });
  app.setState({ issues: [openIssue] });
  app.openDrawer(openIssue);

  const archive = elements.get('btnDrawerArchive');
  archive.onclick?.();
  archive.onclick?.();
  await wait();
  assert.equal(mockDoc.body.querySelectorAll('.confirm-backdrop').length, 1, 'the repeated gesture leaves one confirmation');
  assert.equal(patchCalls(hostCalls).length, 0, 'the repeated gesture writes nothing before confirmation');

  clickConfirm(mockDoc);
  await wait();
  const patches = patchCalls(hostCalls);
  assert.equal(patches.length, 1, 'one confirm produces one state change');
  assert.equal(JSON.parse(patches[0].payload.body).state, 'closed');
});

test('an open issue carrying status:done has no card Reopen shortcut', async () => {
  const openDone = issue({ number: 22, title: 'Label only done', state: 'open', labels: [{ name: 'status:done' }] });
  const { app, elements, hostCalls } = await setup({
    onRequest: async () => response({}),
  });
  app.setState({ issues: [openDone], viewState: { view: 'cards', filters: [], sort: 'priority' } });
  app.renderViews();

  const card = elements.get('listViewContainer').querySelectorAll('.card')[0];
  assert.ok(card, 'the card view rendered the issue');
  assert.equal(card.querySelector('.card-btn-next'), null, 'no shortcut presents a label edit as Reopen');
  assert.equal(card.textContent.includes('Reopen'), false, 'the card does not say Reopen');
  assert.equal(patchCalls(hostCalls).length, 0, 'rendering and the absent shortcut write nothing');
});

test('the shared state writer refuses an unconfirmed transition', async () => {
  const closedIssue = issue({ number: 33, title: 'Boundary', state: 'closed', labels: [{ name: 'status:done' }] });
  const { app, hostCalls } = await setup({
    onRequest: async () => response({}),
  });
  app.setState({ issues: [closedIssue] });

  await app.updateIssueStatus(closedIssue, 'in-progress', { isHumanGesture: true });
  await wait();
  assert.equal(patchCalls(hostCalls).length, 0, 'a transition without the confirmed signal writes nothing');
  assert.equal(closedIssue.state, 'closed', 'the optimistic state is reverted');
});

test('archiving an issue with an unknown repository leaves it unchanged', async () => {
  const noRepo = issue({ number: 44, title: 'No repository', repo: '' });
  const { app, elements, hostCalls } = await setup({
    onRequest: async () => response({}),
  });
  app.setState({ issues: [noRepo], currentRepo: '', isManualRepoOverride: true });
  const beforeLabels = noRepo.labels.map((label) => label.name);
  app.openDrawer(noRepo);

  elements.get('btnDrawerArchive').onclick?.();
  await wait();
  assert.equal(patchCalls(hostCalls).length, 0, 'no repository means no write');
  assert.equal(noRepo.state, 'open', 'the state is not mutated before the repository check');
  assert.deepEqual(noRepo.labels.map((label) => label.name), beforeLabels, 'the labels are not mutated');
});

test('a failed archive reverts the published record as well as the clicked issue', async () => {
  const published = issue({ number: 45, title: 'Published record', labels: [{ name: 'status:todo' }] });
  const clicked = issue({ number: 45, title: 'Published record', labels: [{ name: 'status:todo' }] });
  const { app, elements, hostCalls, mockDoc } = await setup({
    onRequest: async (payload) => (payload.method === 'PATCH' ? response({}, 500) : response({})),
  });
  app.setState({ issues: [published] });
  app.openDrawer(clicked);

  elements.get('btnDrawerArchive').onclick?.();
  await wait();
  clickConfirm(mockDoc);
  await wait(150);
  assert.equal(patchCalls(hostCalls).length, 1, 'the failed write was attempted once');
  assert.equal(published.state, 'open', 'the published record returns to its prior state');
  assert.ok(!published.labels.some((label) => label.name === 'archived'), 'the published record drops the optimistic archive label');
  assert.equal(clicked.state, 'open', 'the clicked issue returns to its prior state');
});

test('the explicit Archive view keeps archived closed issues reachable in the simple layout', async () => {
  const archived = issue({
    number: 25,
    title: 'Archived closed',
    state: 'closed',
    labels: [{ name: 'status:todo' }, { name: 'archived' }],
  });
  const { app, elements } = await setup();
  app.setState({ issues: [archived], viewState: { view: 'simple', filters: [], sort: 'priority' } });
  app.renderViews();
  assert.equal(elements.get('simpleListViewContainer').querySelectorAll('.simple-row').length, 0, 'the default simple list hides closed issues');

  elements.get('btnArchiveToggle').click();
  await wait();
  const cards = elements.get('listViewContainer').querySelectorAll('.card');
  assert.equal(cards.length, 1, 'the explicit Archive view still shows the archived closed issue');
  assert.ok(cards[0].textContent.includes('#25'));
});

test('stripFriendlyTitleSection drops the metadata block from the view only', () => {
  const inline = '### Friendly Title: Ship the narrow drawer\n\n### Overview\nFirst substantive description.';
  assert.equal(stripFriendlyTitleSection(inline), '### Overview\nFirst substantive description.');

  const multiline = '### Friendly Title:\nShip the narrow drawer\n\n### Overview\nFirst substantive description.';
  assert.equal(stripFriendlyTitleSection(multiline), '### Overview\nFirst substantive description.');

  const bold = '**Friendly Title:** Ship the narrow drawer\n\n### Overview\nFirst substantive description.';
  assert.equal(stripFriendlyTitleSection(bold), '### Overview\nFirst substantive description.');

  const fallback = '### Overview\nFirst substantive description.';
  assert.equal(stripFriendlyTitleSection(fallback), fallback, 'a body without metadata is unchanged');
});

test('Done is separated from dismissing the drawer and every new copy exists in both languages', () => {
  const indexHtml = fs.readFileSync(path.resolve(__dirname, '../panel/index.html'), 'utf8');
  const drawerMarkup = indexHtml.slice(indexHtml.indexOf('id="taskDrawer"'));
  assert.ok(drawerMarkup.includes('id="btnDrawerBack"'), 'the drawer has a Back to board control');
  assert.ok(drawerMarkup.includes('class="drawer-done-action"'), 'Done lives in its own action block');
  const doneIndex = indexHtml.indexOf('id="btnDrawerToggleClose"');
  const scrollIndex = indexHtml.indexOf('class="drawer-scroll"');
  assert.ok(doneIndex > scrollIndex, 'the Done control sits in the scroll body, not the drawer header');

  const decisions = fs.readFileSync(path.resolve(__dirname, '../panel/decisions.ts'), 'utf8');
  for (const key of [
    'backToBoard', 'showClosedIssues', 'hideClosedIssues', 'markDoneClose', 'reopenIssue',
    'confirmMarkDone', 'confirmReopen', 'inspectDependency', 'dependencyBlocks', 'openTask',
    'removeDependency', 'cancel', 'confirmRemoveDependency', 'reopenBeforeMoving', 'ambiguousTask',
    'dependencyUnavailable', 'taskOutcome', 'visibility', 'archiveIssue', 'unarchiveIssue',
    'confirmArchiveTransition', 'archiveClosesIssue', 'archiveReopensIssue',
  ]) {
    const occurrences = decisions.split(`${key}:`).length - 1;
    assert.ok(occurrences >= 2, `${key} must be defined for both English and French`);
  }
});

// The transport boundary: a workflow label update must not be able to close or
// reopen a GitHub issue, even when the board cache disagrees with the server.
// These tests use a fake server whose state is independent of the cache.

test('a label-only status move omits state and cannot reopen a server-closed issue', async () => {
  const server = fakeServer({ 'acme/a#70': 'closed' });
  const cacheIssue = issue({ number: 70, title: 'Cache open', state: 'open', labels: [{ name: 'status:todo' }] });
  const { app, hostCalls, mockDoc } = await setup({ onRequest: server.onRequest });
  app.setState({ issues: [cacheIssue] });

  await app.updateIssueStatus(cacheIssue, 'in-progress');
  await wait();

  assert.equal(confirmDialog(mockDoc), null, 'a label move does not prompt');
  const patches = patchCalls(hostCalls);
  assert.equal(patches.length, 1, 'the label move writes once');
  const body = JSON.parse(patches[0].payload.body);
  assert.equal(hasState(body), false, 'the label-only PATCH omits state entirely');
  assert.ok(body.labels.includes('status:in-progress'), 'the intended label is sent');
  assert.equal(server.states['acme/a#70'], 'closed', 'the server issue stays closed');
  assert.equal(server.transitions.length, 0, 'no server state transition occurred');
});

test('background reconciliation omits state and cannot reopen a server-closed issue', async () => {
  const server = fakeServer({ 'acme/a#71': 'closed' });
  const cacheIssue = issue({ number: 71, title: 'Reconcile me', state: 'open', labels: [{ name: 'status:todo' }] });
  const { app, hostCalls } = await setup({ onRequest: server.onRequest });
  app.setState({ issues: [cacheIssue] });
  app.statusReconciler.getSession = () => ({ activity: 'running', id: 'session-71' });

  const reconciled = await app.statusReconciler.reconcile([cacheIssue]);
  await wait();

  assert.equal(reconciled.length, 1, 'the reconciler still requests the label move');
  const patches = patchCalls(hostCalls);
  assert.equal(patches.length, 1, 'the reconciler writes once');
  const body = JSON.parse(patches[0].payload.body);
  assert.equal(hasState(body), false, 'the background write omits state entirely');
  assert.ok(body.labels.includes('status:in-progress'));
  assert.equal(server.states['acme/a#71'], 'closed', 'the server issue stays closed');
  assert.equal(server.transitions.length, 0, 'background reconciliation cannot reopen');
});

test('archiving a cached-closed issue omits state and cannot close it on the server', async () => {
  const server = fakeServer({ 'acme/a#72': 'open' });
  const cacheIssue = issue({ number: 72, title: 'Cache closed', state: 'closed', labels: [{ name: 'status:todo' }] });
  const { app, elements, hostCalls, mockDoc } = await setup({ onRequest: server.onRequest });
  app.setState({ issues: [cacheIssue] });
  app.openDrawer(cacheIssue);

  elements.get('btnDrawerArchive').onclick?.();
  await wait();

  assert.equal(confirmDialog(mockDoc), null, 'the panel sees no transition, so it does not prompt');
  const patches = patchCalls(hostCalls);
  assert.equal(patches.length, 1, 'the archive metadata write happens');
  const body = JSON.parse(patches[0].payload.body);
  assert.equal(hasState(body), false, 'the no-transition archive omits state entirely');
  assert.ok(body.labels.includes('archived'));
  assert.equal(server.states['acme/a#72'], 'open', 'the server issue stays open');
  assert.equal(server.transitions.length, 0, 'archiving cannot close a server-open issue');
});

test('unarchiving a cached-open issue omits state and cannot reopen it on the server', async () => {
  const server = fakeServer({ 'acme/a#73': 'closed' });
  const cacheIssue = issue({
    number: 73,
    title: 'Cache archived open',
    state: 'open',
    labels: [{ name: 'status:todo' }, { name: 'archived' }],
  });
  const { app, elements, hostCalls, mockDoc } = await setup({ onRequest: server.onRequest });
  app.setState({ issues: [cacheIssue] });
  app.openDrawer(cacheIssue);

  elements.get('btnDrawerArchive').onclick?.();
  await wait();

  assert.equal(confirmDialog(mockDoc), null, 'the panel sees no transition, so it does not prompt');
  const patches = patchCalls(hostCalls);
  assert.equal(patches.length, 1);
  const body = JSON.parse(patches[0].payload.body);
  assert.equal(hasState(body), false, 'the no-transition unarchive omits state entirely');
  assert.ok(!body.labels.includes('archived'));
  assert.equal(server.states['acme/a#73'], 'closed', 'the server issue stays closed');
  assert.equal(server.transitions.length, 0, 'unarchiving cannot reopen a server-closed issue');
});

test('unarchiving a cached-closed done issue omits state and cannot close it on the server', async () => {
  const server = fakeServer({ 'acme/a#74': 'open' });
  const cacheIssue = issue({
    number: 74,
    title: 'Cache archived done',
    state: 'closed',
    labels: [{ name: 'status:done' }, { name: 'archived' }],
  });
  const { app, elements, hostCalls, mockDoc } = await setup({ onRequest: server.onRequest });
  app.setState({ issues: [cacheIssue] });
  app.openDrawer(cacheIssue);

  elements.get('btnDrawerArchive').onclick?.();
  await wait();

  assert.equal(confirmDialog(mockDoc), null, 'the panel sees no transition, so it does not prompt');
  const patches = patchCalls(hostCalls);
  assert.equal(patches.length, 1);
  const body = JSON.parse(patches[0].payload.body);
  assert.equal(hasState(body), false, 'the no-transition unarchive omits state entirely');
  assert.ok(body.labels.includes('status:done'));
  assert.equal(server.states['acme/a#74'], 'open', 'the server issue stays open');
  assert.equal(server.transitions.length, 0, 'unarchiving cannot close a server-open issue');
});

test('a confirmed close sends the intended state exactly once and the server closes', async () => {
  const server = fakeServer({ 'acme/a#75': 'open' });
  const cacheIssue = issue({ number: 75, title: 'Confirm close', state: 'open', labels: [{ name: 'status:todo' }] });
  const { app, elements, hostCalls, mockDoc } = await setup({ onRequest: server.onRequest });
  app.setState({ issues: [cacheIssue] });
  app.openDrawer(cacheIssue);

  elements.get('btnDrawerToggleClose').onclick?.();
  await wait();
  assert.ok(confirmDialog(mockDoc), 'the confirmation is shown');
  clickConfirm(mockDoc);
  await wait();

  const patches = patchCalls(hostCalls);
  assert.equal(patches.length, 1, 'confirm writes exactly once');
  const body = JSON.parse(patches[0].payload.body);
  assert.equal(body.state, 'closed', 'the confirmed payload carries the intended state');
  assert.ok(body.labels.includes('status:done'));
  assert.equal(server.states['acme/a#75'], 'closed', 'the server issue closes');
  assert.equal(server.transitions.length, 1);
  assert.equal(server.transitions[0].changed, true);
});

test('an ordinary priority label edit still sends the intended labels and no state', async () => {
  const server = fakeServer({ 'acme/a#76': 'open' });
  const cacheIssue = issue({ number: 76, title: 'Priority edit', state: 'open', labels: [{ name: 'status:todo' }] });
  const { app, elements, hostCalls } = await setup({ onRequest: server.onRequest });
  app.setState({ issues: [cacheIssue] });
  app.openDrawer(cacheIssue);

  const select = elements.get('drawerPrioritySelect');
  select.value = 'important';
  select.dispatchEvent({ type: 'change' });
  await wait();

  const patches = patchCalls(hostCalls);
  assert.equal(patches.length, 1, 'the priority edit writes once');
  const body = JSON.parse(patches[0].payload.body);
  assert.equal(hasState(body), false, 'an ordinary label edit never carries state');
  assert.ok(body.labels.includes('priority:important'), 'the intended label is sent');
  assert.equal(server.states['acme/a#76'], 'open');
  assert.equal(server.transitions.length, 0);
});
