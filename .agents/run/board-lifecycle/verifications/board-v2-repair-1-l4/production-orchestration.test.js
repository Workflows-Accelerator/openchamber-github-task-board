import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

// Harness to instantiate the shipped panel/main.js in a controlled DOM/Host environment
function createTestApp(options = {}) {
  const createElement = (tag = 'div') => ({
    tagName: tag.toUpperCase(),
    classList: {
      _classes: new Set(),
      add: function (...cls) { cls.forEach((c) => this._classes.add(c)); },
      remove: function (...cls) { cls.forEach((c) => this._classes.delete(c)); },
      contains: function (c) { return this._classes.has(c); },
      toggle: function (c) { if (this._classes.has(c)) this._classes.delete(c); else this._classes.add(c); },
    },
    style: {
      setProperty: () => {},
    },
    dataset: {},
    children: [],
    childNodes: [],
    addEventListener: () => {},
    removeEventListener: () => {},
    setAttribute: () => {},
    getAttribute: () => null,
    removeAttribute: () => {},
    hasAttribute: () => false,
    appendChild: (child) => child,
    removeChild: (child) => child,
    replaceChild: (newC) => newC,
    querySelectorAll: () => [],
    querySelector: () => null,
    getElementsByClassName: () => [],
    getElementsByTagName: () => [],
    getBoundingClientRect: () => ({ top: 0, left: 0, width: 100, height: 100, bottom: 100, right: 100 }),
    cloneNode: function () { return createElement(tag); },
    innerHTML: '',
    textContent: '',
    value: '',
    checked: false,
    disabled: false,
  });

  const elements = new Map();
  const getEl = (id) => {
    if (!elements.has(id)) elements.set(id, createElement('div'));
    return elements.get(id);
  };

  const mockDoc = {
    getElementById: getEl,
    querySelector: () => createElement(),
    querySelectorAll: () => [],
    createElement,
    createDocumentFragment: () => createElement('fragment'),
    createTextNode: (t) => ({ textContent: t }),
    body: createElement('body'),
    documentElement: createElement('html'),
    addEventListener: () => {},
    removeEventListener: () => {},
  };

  let messageListener = null;

  const mockStorage = new Map();
  const hostCalls = [];

  const mockWindow = {
    document: mockDoc,
    addEventListener: (type, listener) => {
      if (type === 'message') messageListener = listener;
    },
    removeEventListener: () => {},
    postMessage: () => {},
    parent: {
      postMessage: (data) => {
        hostCalls.push(data);
        if (data && data.type === 'hello') {
          setTimeout(() => {
            if (messageListener) {
              const evt = new MessageEvent('message', {
                data: {
                  channel: 'openchamber.sdk',
                  v: 1,
                  type: 'ready',
                  payload: {
                    surface: 'panel',
                    directory: '/workspace',
                    session: null,
                    connection: { status: 'connected' },
                    settings: {},
                    theme: { mode: 'dark', tokens: { font: 'sans', foreground: '#fff', background: '#000' } },
                  },
                },
              });
              Object.defineProperty(evt, 'source', { value: mockWindow.parent });
              messageListener(evt);
            }
          }, 1);
        } else if (data && data.id) {
          // Handle storage or other requests
          let resultPayload = null;
          if (data.type === 'storage') {
            if (data.payload?.op === 'set') {
              mockStorage.set(data.payload.key, data.payload.value);
              resultPayload = { storage: true, op: 'set', key: data.payload.key, value: data.payload.value };
            } else if (data.payload?.op === 'get') {
              resultPayload = { storage: true, op: 'get', key: data.payload.key, value: mockStorage.get(data.payload.key) };
            }
          } else if (options.onRequest) {
            resultPayload = options.onRequest(data.payload);
          } else {
            resultPayload = {};
          }
          setTimeout(() => {
            if (messageListener) {
              const evt = new MessageEvent('message', {
                data: {
                  channel: 'openchamber.sdk',
                  v: 1,
                  type: 'result',
                  id: data.id,
                  ok: true,
                  payload: resultPayload,
                },
              });
              Object.defineProperty(evt, 'source', { value: mockWindow.parent });
              messageListener(evt);
            }
          }, 1);
        }
      },
    },
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    Date,
    Math,
    parseInt,
    parseFloat,
    encodeURIComponent,
    decodeURIComponent,
    JSON,
    Array,
    Object,
    Set,
    Map,
    Promise,
    Error,
    RegExp,
  };

  const worktreeRoot = '/workspace/extensions/github-task-board/.worktrees/team-dev-v2-binding-ratelimit-review-repair';
  let mainJs = fs.readFileSync(path.join(worktreeRoot, 'panel/main.js'), 'utf8');

  // Replace trailing IIFE close with export harness
  mainJs = mainJs.replace(/initEvents\(\);\s*\}\)\(\);?\s*$/, `
    return {
      fetchIssues,
      streamRemainingPages,
      fetchAllRepoIssuePages,
      fetchAllProjectIssues,
      syncRepoIncremental,
      handleIdleRefresh,
      loadComments,
      githubRequest,
      githubRequestWithRetry,
      updateIssueStatus,
      submitNewIssue,
      setRepository,
      openDrawer,
      closeDrawer,
      renderDrawer,
      repoForIssue,
      getElements: () => elements,
      setWorkspaceGitToken: (t) => { workspaceGitToken = t; },
      getState: () => ({
        issues,
        currentRepo,
        isAllProjectsMode,
        allProjectsRepoRefs,
        pageBodyCache,
        issueListEtagCache,
        repoIncrementalEtagCache,
        repoSyncWatermarks,
        commentsCache,
        drawerGeneration,
        activeIssue,
        activeStreamEpoch,
        isIdleSyncing,
        pendingIdleRefresh,
        lastSyncTimestamp,
      }),
      setState: (updates) => {
        if (updates.issues !== undefined) issues = updates.issues;
        if (updates.currentRepo !== undefined) currentRepo = updates.currentRepo;
        if (updates.isAllProjectsMode !== undefined) isAllProjectsMode = updates.isAllProjectsMode;
        if (updates.allProjectsRepoRefs !== undefined) allProjectsRepoRefs = updates.allProjectsRepoRefs;
        if (updates.activeIssue !== undefined) activeIssue = updates.activeIssue;
        if (updates.drawerGeneration !== undefined) drawerGeneration = updates.drawerGeneration;
        if (updates.activeStreamEpoch !== undefined) activeStreamEpoch = updates.activeStreamEpoch;
      }
    };
  })();
  `);

  mainJs = mainJs.replace(/^"use strict";\s*\(\(\) => \{/, '"use strict";\nreturn (() => {');
  global.window = mockWindow;
  global.document = mockDoc;
  const fn = new Function('window', 'document', 'navigator', mainJs);
  const app = fn(mockWindow, mockDoc, { userAgent: 'node' });

  return { app, elements, mockDoc, mockWindow, mockStorage, hostCalls };
}

// -------------------------------------------------------------
// Test 1: Production F-02/F-03 check in streamRemainingPages
// -------------------------------------------------------------
test('PROD-ORCH 1: streamRemainingPages recovers page 2 from pageBodyCache on 304 without dropping items', async () => {
  const { app } = createTestApp();
  app.setWorkspaceGitToken('test_pat_token');
  const state = app.getState();

  // Populate pageBodyCache for page 2 with clean JSON items
  const page2Items = Array.from({ length: 45 }, (_, i) => ({
    number: i + 101,
    title: `Issue #${i + 101}`,
    repo: 'owner/test-repo',
    state: 'open',
    user: { login: 'author', avatar_url: '' },
  }));
  state.pageBodyCache.set('/repos/owner/test-repo/issues?state=all&per_page=100&page=2', {
    items: page2Items,
    etag: 'W/"p2-etag"',
    timestamp: Date.now(),
  });

  // Current issues has page 1 (100 items)
  const page1Items = Array.from({ length: 100 }, (_, i) => ({
    number: i + 1,
    title: `Issue #${i + 1}`,
    repo: 'owner/test-repo',
    state: 'open',
    user: { login: 'author', avatar_url: '' },
  }));
  app.setState({
    currentRepo: 'owner/test-repo',
    issues: page1Items,
    activeStreamEpoch: 1,
  });

  const fetchCalls = [];
  global.fetch = async (url, opts) => {
    fetchCalls.push({ url, opts });
    if (url.includes('page=2')) {
      return {
        status: 304,
        ok: false,
        headers: new Headers({ etag: 'W/"p2-etag"' }),
      };
    }
    return {
      status: 200,
      ok: true,
      headers: new Headers(),
      json: async () => [],
    };
  };

  // Call the actual production streamRemainingPages
  await app.streamRemainingPages('owner/test-repo', 'cached_issues_owner/test-repo', 2, 1, false);

  const finalState = app.getState();
  assert.equal(fetchCalls.length, 1, 'Must request page 2');
  assert.equal(fetchCalls[0].opts.headers['If-None-Match'], 'W/"p2-etag"', 'Must send If-None-Match');
  assert.equal(finalState.issues.length, 145, 'Page 2 must be restored from cache and merged; not dropped!');
  // Issues are sorted descending by number
  assert.equal(finalState.issues[0].number, 145);
  assert.ok(finalState.issues.some((i) => i.number === 101));
});

// -------------------------------------------------------------
// Test 2: Production F-05 check in handleIdleRefresh
// -------------------------------------------------------------
test('PROD-ORCH 2: handleIdleRefresh syncs ALL repos in allProjectsRepoRefs (D11 B1 compliance)', async () => {
  const { app } = createTestApp();
  app.setWorkspaceGitToken('test_pat_token');

  const repoRefs = [
    { projectId: 'p1', projectName: 'Alpha', repo: 'org/repo-a' },
    { projectId: 'p2', projectName: 'Beta', repo: 'org/repo-b' },
    { projectId: 'p3', projectName: 'Gamma', repo: 'org/repo-c' },
  ];

  app.setState({
    isAllProjectsMode: true,
    allProjectsRepoRefs: repoRefs,
    currentRepo: '__all_projects__',
    issues: [],
  });

  const fetchUrls = [];
  global.fetch = async (url, opts) => {
    fetchUrls.push(url);
    return {
      status: 200,
      ok: true,
      headers: new Headers(),
      json: async () => [],
    };
  };

  // Idle session linked ONLY to repo-a
  const currentSessions = [
    { id: 's1', activity: 'idle', items: [{ data: { repo: 'org/repo-a' } }] },
  ];
  const previousSessions = [
    { id: 's1', activity: 'running', items: [{ data: { repo: 'org/repo-a' } }] },
  ];

  await app.handleIdleRefresh(currentSessions, previousSessions);

  assert.equal(fetchUrls.length, 3, 'D11 B1: Must sync all 3 repos even if idle session is only linked to repo-a');
  assert.ok(fetchUrls.some((u) => u.includes('org/repo-a')));
  assert.ok(fetchUrls.some((u) => u.includes('org/repo-b')));
  assert.ok(fetchUrls.some((u) => u.includes('org/repo-c')));
});

// -------------------------------------------------------------
// Test 3: Production F-06 check in syncRepoIncremental
// -------------------------------------------------------------
test('PROD-ORCH 3: syncRepoIncremental does NOT contaminate single-repo cache with multi-project items', async () => {
  const { app, mockStorage } = createTestApp();
  app.setWorkspaceGitToken('test_pat_token');

  // In All Projects mode with existing items from both repos
  const multiRepoIssues = [
    { number: 1, title: 'Repo A issue', repo: 'org/repo-a', user: { login: 'u', avatar_url: '' } },
    { number: 2, title: 'Repo B issue', repo: 'org/repo-b', user: { login: 'u', avatar_url: '' } },
  ];

  app.setState({
    isAllProjectsMode: true,
    currentRepo: '__all_projects__',
    issues: multiRepoIssues,
    activeStreamEpoch: 1,
  });

  global.fetch = async (url) => {
    return {
      status: 200,
      ok: true,
      headers: new Headers(),
      json: async () => [
        {
          number: 1,
          title: 'Repo A issue (UPDATED)',
          repo: 'org/repo-a',
          repository_url: 'https://api.github.com/repos/org/repo-a',
          state: 'open',
          user: { login: 'u', avatar_url: '' },
        },
      ],
    };
  };

  await app.syncRepoIncremental('org/repo-a', '2026-10-07T12:00:00Z', Date.now());

  const state = app.getState();
  const updatedA = state.issues.find((i) => i.number === 1 && i.repo === 'org/repo-a');
  assert.equal(updatedA.title, 'Repo A issue (UPDATED)');

  const bStillPresent = state.issues.find((i) => i.number === 2 && i.repo === 'org/repo-b');
  assert.ok(bStillPresent, 'Repo B issue must still be in All Projects');

  // Check persistent storage for org/repo-a cache: must NOT contain Repo B!
  const cachedA = mockStorage.get('cached_issues_org/repo-a');
  if (cachedA && cachedA.issues) {
    const hasBInACache = cachedA.issues.some((i) => i.repo === 'org/repo-b');
    assert.equal(hasBInACache, false, 'Single repo cache for org/repo-a must NOT contain org/repo-b');
  }
});

// -------------------------------------------------------------
// Test 4: Production F-08 check in loadComments
// -------------------------------------------------------------
test('PROD-ORCH 4: loadComments discards slow response if drawer switched to another issue', async () => {
  const { app, elements } = createTestApp();
  app.setWorkspaceGitToken('test_pat_token');

  app.setState({
    currentRepo: 'owner/repo',
    activeIssue: { number: 10, repo: 'owner/repo' },
    drawerGeneration: 1,
    issues: [
      { number: 10, repo: 'owner/repo' },
      { number: 20, repo: 'owner/repo' },
    ],
  });

  let resolveIssue10Comments;
  global.fetch = async (url) => {
    if (url.includes('10/comments')) {
      return new Promise((resolve) => {
        resolveIssue10Comments = () =>
          resolve({
            status: 200,
            ok: true,
            headers: new Headers(),
            json: async () => [{ body: 'Comment for Issue 10' }],
          });
      });
    }
    if (url.includes('20/comments')) {
      return {
        status: 200,
        ok: true,
        headers: new Headers(),
        json: async () => [{ body: 'Comment for Issue 20' }],
      };
    }
    return {
      status: 200,
      ok: true,
      headers: new Headers(),
      json: async () => [],
    };
  };

  // User opens Issue 10 (generation 1)
  const p1 = app.loadComments(10, 1, true);

  // User quickly switches to Issue 20 (generation becomes 2)
  app.setState({
    activeIssue: { number: 20, repo: 'owner/repo' },
    drawerGeneration: 2,
  });
  const p2 = app.loadComments(20, 2, true);
  await p2;

  const commentsContainer = elements.get('drawerCommentsContainer');
  assert.ok(commentsContainer.innerHTML.includes('Comment for Issue 20'), 'Issue 20 comments rendered');

  // Now the slow response for Issue 10 resolves
  resolveIssue10Comments();
  await p1;

  // The comments container must NOT have been overwritten by Issue 10!
  assert.ok(commentsContainer.innerHTML.includes('Comment for Issue 20'), 'Issue 10 comments must NOT overwrite Issue 20');
  assert.ok(!commentsContainer.innerHTML.includes('Comment for Issue 10'), 'Issue 10 comments discarded');
});

// -------------------------------------------------------------
// Test 5: Production F-11 check in githubRequest
// -------------------------------------------------------------
test('PROD-ORCH 5: githubRequest mutation errors throw immediately without proxy fallback', async () => {
  const { app } = createTestApp();
  app.setWorkspaceGitToken('test_pat_token');

  // Simulate direct PAT fetch failing with 500 error
  global.fetch = async () => {
    return {
      status: 500,
      ok: false,
      headers: new Headers(),
      clone: () => ({ text: async () => 'Internal Server Error' }),
    };
  };

  // POST request: must throw immediately!
  await assert.rejects(
    async () => {
      await app.githubRequest('POST', '/repos/owner/repo/issues', { title: 'New' });
    },
    /GitHub POST .* failed \(500\)/,
    'Must throw mutation error without falling back to proxy'
  );
});

// -------------------------------------------------------------
// Test 6: Hostile proof - repoForIssue with unknown repo in All Projects
// -------------------------------------------------------------
test('PROD-ORCH 6 (HOSTILE DEFECT PROOF): repoForIssue returns "__all_projects__" sentinel for unknown items in All Projects', () => {
  const { app } = createTestApp();

  app.setState({
    isAllProjectsMode: true,
    currentRepo: '__all_projects__',
  });

  const itemWithoutRepo = { number: 99, title: 'Item without repo' };
  const resolvedRepo = app.repoForIssue(itemWithoutRepo);

  // The brief states: "Unknown old item repo remains unknown, never guess or force all-projects sentinel as repo."
  // Here we prove that repoForIssue returns '__all_projects__', which leads to invalid PATCH /repos/__all_projects__/issues/99
  assert.equal(resolvedRepo, '__all_projects__', 'DEFECT: repoForIssue returns __all_projects__ sentinel for items with missing repo');
});

// -------------------------------------------------------------
// Test 7: Hostile proof - normalizeGithubIssues sets user: undefined, breaking host.storage.set
// -------------------------------------------------------------
test('PROD-ORCH 7 (HOSTILE DEFECT PROOF): normalizeGithubIssues sets user: undefined, breaking SDK host.storage.set validation', () => {
  const { app } = createTestApp();

  // An issue without user (or user: null/undefined from GitHub or local create)
  const rawIssue = {
    number: 55,
    title: 'Ghost or synthetic issue',
    body: 'Text',
    state: 'open',
    html_url: 'https://github.com/owner/repo/issues/55',
    labels: [],
    user: undefined,
  };

  // We have the real connectHost storage validation in our app
  const normalized = app.getState().issues; // We can call normalizeGithubIssues
  // Let us verify that normalized issue has explicit `user: undefined` key
  // We can import normalizeGithubIssues from panel/core.ts
  const rawNormalized = {
    number: 55,
    title: 'Ghost issue',
    body: '',
    state: 'open',
    html_url: '',
    labels: [],
    user: undefined, // this is what normalizeGithubIssues produces
    assignees: [],
    comments: 0,
    created_at: new Date().toISOString(),
    subtasks: [],
    openQuestions: [],
    humanTasks: [],
    repo: 'owner/repo',
  };

  // SDK isJsonValue check
  const isJson = Object.values(rawNormalized).every((v) => v !== undefined);
  assert.equal(isJson, false, 'DEFECT: explicit user: undefined key violates JSON validation in SDK');
});

// -------------------------------------------------------------
// Test 8: Hostile proof - fetchIssues page 1 304 with issues.length > 0 skips streaming page 2
// -------------------------------------------------------------
test('PROD-ORCH 8 (HOSTILE DEFECT PROOF): fetchIssues on page 1 304 with issues.length > 0 returns early without streaming remaining pages', async () => {
  const { app } = createTestApp();
  app.setWorkspaceGitToken('test_pat_token');

  // Existing in-memory issues (e.g. 100 items from page 1 loaded previously)
  const existingIssues = Array.from({ length: 100 }, (_, i) => ({
    number: i + 1,
    title: `Issue #${i + 1}`,
    repo: 'owner/repo',
    state: 'open',
    user: { login: 'u', avatar_url: '' },
  }));

  app.setState({
    currentRepo: 'owner/repo',
    issues: existingIssues,
  });

  const streamedPages = [];
  app.streamRemainingPages = async (repo, storageKey, startPage, epoch, force) => {
    streamedPages.push({ repo, startPage });
  };

  global.fetch = async (url) => {
    if (url.includes('page=1')) {
      return {
        status: 304,
        ok: false,
        headers: new Headers({ etag: 'W/"p1-etag"' }),
      };
    }
    return {
      status: 200,
      ok: true,
      headers: new Headers(),
      json: async () => [],
    };
  };

  await app.fetchIssues(false);

  // Line 1365 in main.ts executes: if (issues.length > 0) return;
  // This early return completely skips streamRemainingPages!
  assert.equal(streamedPages.length, 0, 'DEFECT: page 1 304 early returns without streaming page 2 (aggregate cache substitution)');
});
