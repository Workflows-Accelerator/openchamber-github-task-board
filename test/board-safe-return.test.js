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
  assert.equal(JSON.parse(patches[0].payload.body).state, 'open');
  assert.ok(JSON.parse(patches[0].payload.body).labels.includes('status:in-progress'));
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
    'dependencyUnavailable', 'taskOutcome', 'visibility',
  ]) {
    const occurrences = decisions.split(`${key}:`).length - 1;
    assert.ok(occurrences >= 2, `${key} must be defined for both English and French`);
  }
});
