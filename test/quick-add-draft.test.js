import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripTypeScriptTypes } from 'node:module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MAIN_TS = fs.readFileSync(path.join(__dirname, '../panel/main.ts'), 'utf8');

function loadFunctionFromMain(name, dependencies) {
  const declaration = MAIN_TS.match(new RegExp(`^(?:async )?function ${name}\\([^]*?^\\}`, 'm'))?.[0];
  if (!declaration) throw new Error(`Missing function in main.ts: ${name}`);
  const javascript = stripTypeScriptTypes(declaration);
  return new Function(...Object.keys(dependencies), `return (${javascript});`)(...Object.values(dependencies));
}

test('quickAddDraft triggers zero host.startSession calls and dispatches POST /repos/:targetRepo/issues with status:draft', async () => {
  let sessionDispatched = false;
  const githubCalls = [];
  const toasts = [];
  const logs = [];

  const hostMock = {
    toast: async (msg) => { toasts.push(msg); },
    startSession: async () => {
      sessionDispatched = true;
      throw new Error('host.startSession must never be called on quick-add draft');
    },
    storage: {
      set: async () => {},
    },
  };

  const fakeCreatedIssue = {
    id: 101,
    number: 42,
    title: 'Zero session quick-add draft test',
    body: '',
    labels: [{ name: 'status:draft' }],
    state: 'open',
  };

  const fakeInput = {
    value: 'Zero session quick-add draft test',
    disabled: false,
    focused: false,
    focus() {
      this.focused = true;
    },
  };

  const quickAddDraft = loadFunctionFromMain('quickAddDraft', {
    isAllProjectsMode: false,
    currentRepo: 'openchamber/task-board',
    openRepoPopover: () => {},
    addLog: (msg, kind) => logs.push({ msg, kind }),
    githubRequestWithRetry: async (method, path, body) => {
      githubCalls.push({ method, path, body });
      return fakeCreatedIssue;
    },
    normalizeGithubIssues: (raw) => raw,
    mergeIssuePages: (existing, incoming) => [...existing, ...incoming],
    renderViews: () => {},
    statusReconciler: { schedule: () => {} },
    issueCache: new Map(),
    ALL_PROJECTS_CACHE_KEY: '__all_projects__',
    issues: [],
    host: hostMock,
  });

  await quickAddDraft(fakeInput);

  // Assertions
  assert.equal(sessionDispatched, false, 'No session may be launched on quick-add');
  assert.equal(fakeInput.value, '', 'Input must be cleared after successful quick-add');
  assert.equal(fakeInput.disabled, false, 'Input must be re-enabled');
  assert.equal(fakeInput.focused, true, 'Input must be re-focused');
  assert.equal(githubCalls.length, 1);
  assert.equal(githubCalls[0].method, 'POST');
  assert.equal(githubCalls[0].path, '/repos/openchamber/task-board/issues');
  assert.deepEqual(githubCalls[0].body, {
    title: 'Zero session quick-add draft test',
    labels: ['status:draft'],
  });
});

test('quickAddDraft does not create issues or launch sessions when input is empty or whitespace', async () => {
  let sessionDispatched = false;
  let githubCalled = false;

  const quickAddDraft = loadFunctionFromMain('quickAddDraft', {
    isAllProjectsMode: false,
    currentRepo: 'openchamber/task-board',
    openRepoPopover: () => {},
    addLog: () => {},
    githubRequestWithRetry: async () => {
      githubCalled = true;
    },
    normalizeGithubIssues: (raw) => raw,
    mergeIssuePages: () => [],
    renderViews: () => {},
    statusReconciler: { schedule: () => {} },
    issueCache: new Map(),
    ALL_PROJECTS_CACHE_KEY: '__all_projects__',
    issues: [],
    host: {
      toast: async () => {},
      startSession: async () => { sessionDispatched = true; },
    },
  });

  const fakeInput = {
    value: '   \n  \t  ',
    disabled: false,
    focus() {},
  };

  await quickAddDraft(fakeInput);

  assert.equal(sessionDispatched, false);
  assert.equal(githubCalled, false);
});
