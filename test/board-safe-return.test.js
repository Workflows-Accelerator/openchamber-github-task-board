import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createTestApp } from './test-app-harness.js';
import { normalizeGithubIssues } from '../panel/core.ts';
import { getIssueDescriptionPreview, stripFriendlyTitleSection } from '../panel/markdown.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const wait = (ms = 40) => new Promise((resolve) => setTimeout(resolve, ms));
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
  const { app, elements, hostCalls, mockWindow } = await setup({
    onRequest: async () => response({}),
  });
  app.setState({ issues: [openIssue] });
  app.openDrawer(openIssue);
  const drawer = elements.get('taskDrawer');
  assert.ok(drawer.classList.contains('active'));

  mockWindow.confirm = () => true;
  app.setRepository('acme/b', 'test-switch');
  assert.equal(app.getState().activeIssue, null, 'the old task is no longer active');
  assert.equal(drawer.classList.contains('active'), false, 'the old drawer is dismissed');

  const doneButton = elements.get('btnDrawerToggleClose');
  doneButton.onclick?.();
  await wait();
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

test('Done keeps its human effect but needs confirmation, applies once, and cancel is inert', async () => {
  const openIssue = issue({ number: 7, title: 'Confirm me' });
  const { app, elements, hostCalls, mockWindow } = await setup({
    onRequest: async () => response({}),
  });
  app.setState({ issues: [openIssue] });
  app.openDrawer(openIssue);

  const doneButton = elements.get('btnDrawerToggleClose');
  assert.equal(doneButton.textContent, 'Mark done and close issue');
  mockWindow.confirm = () => false;
  doneButton.onclick?.();
  await wait();
  assert.equal(patchCalls(hostCalls).length, 0, 'cancel writes nothing');

  mockWindow.confirm = () => true;
  doneButton.onclick?.();
  await wait();
  const patches = patchCalls(hostCalls);
  assert.equal(patches.length, 1, 'confirm performs exactly one write');
  assert.equal(patches[0].payload.path, '/repos/acme/a/issues/7');
  const payload = JSON.parse(patches[0].payload.body);
  assert.equal(payload.state, 'closed');
  assert.ok(payload.labels.includes('status:done'));
});

test('Done targets the original repository when two repositories share an issue number', async () => {
  const first = issue({ number: 3, title: 'First repo task', repo: 'acme/a' });
  const second = issue({ number: 3, title: 'Second repo task', repo: 'acme/b' });
  const { app, elements, hostCalls, mockWindow } = await setup({
    onRequest: async () => response({}),
  });
  app.setState({ issues: [first, second], isAllProjectsMode: true });
  app.openDrawer(first);
  mockWindow.confirm = () => true;
  elements.get('btnDrawerToggleClose').onclick?.();
  await wait();
  const patches = patchCalls(hostCalls);
  assert.equal(patches.length, 1);
  assert.equal(patches[0].payload.path, '/repos/acme/a/issues/3');
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
  const { app, hostCalls, mockWindow } = await setup({
    onRequest: async () => response({}),
  });
  app.setState({ issues: [blocker, target] });

  mockWindow.confirm = (message) => {
    assert.ok(message.includes('#302'), 'the confirmation names the blocker');
    assert.ok(message.includes('#301'), 'the confirmation names the target');
    return false;
  };
  app.requestDependencyRemoval('acme/a#301', 'acme/a#302');
  await wait();
  assert.equal(patchCalls(hostCalls).length, 0, 'cancel writes nothing');

  mockWindow.confirm = () => true;
  app.requestDependencyRemoval('acme/a#301', 'acme/a#302');
  await wait();
  const patches = patchCalls(hostCalls);
  assert.equal(patches.length, 1);
  assert.equal(patches[0].payload.path, '/repos/acme/a/issues/301');
  assert.ok(!JSON.parse(patches[0].payload.body).body.includes('#302'), 'the removed blocker is gone from the body');
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
    'removeDependency', 'cancel', 'confirmRemoveDependency',
  ]) {
    const occurrences = decisions.split(`${key}:`).length - 1;
    assert.ok(occurrences >= 2, `${key} must be defined for both English and French`);
  }
});
