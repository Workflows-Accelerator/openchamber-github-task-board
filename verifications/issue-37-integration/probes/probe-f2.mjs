import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { buildIssueDetail, buildBoardList } from '/workspace/extensions/github-task-board/web/server/board.ts';
import { makeIssue } from '/workspace/extensions/github-task-board/web/tests/fake-github.mjs';

const repository = (name, id) => ({
  owner: 'owner',
  name,
  full: 'owner/' + name,
  id,
  archived: false,
  hasIssues: true,
  available: true,
});

const alpha = repository('alpha', 101);
const beta = repository('beta', 102);
const gamma = repository('gamma', 103);

const raw = (repoName, title = 'Task') =>
  makeIssue({
    number: 1,
    title: `${repoName}: ${title}`,
    body: '## Overview\nOriginal\n\n## Open Questions\n- [ ] Decide?\n',
    labels: ['status:todo'],
  });

const detail = (repo) => buildIssueDetail(raw(repo.name), repo);
const options = [
  { value: 'status:todo', label: 'Todo' },
  { value: 'status:done', label: 'Done' },
];

function browser(handler) {
  const elements = new Map();
  const get = (id) => {
    if (!elements.has(id)) elements.set(id, node());
    return elements.get(id);
  };
  function node() {
    let text = '';
    return {
      children: [],
      value: '',
      hidden: false,
      disabled: false,
      get textContent() {
        return text;
      },
      set textContent(v) {
        text = v;
        this.children = [];
      },
      setAttribute(k, v) {
        this[k] = v;
        if (k === 'id') elements.set(v, this);
      },
      removeAttribute(k) {
        delete this[k];
      },
      appendChild(c) {
        this.children.push(c);
      },
      addEventListener() {},
      focus() {},
      querySelector() {
        return get('empty-p');
      },
    };
  }
  const calls = [];
  const context = vm.createContext({
    document: { getElementById: get, createElement: node },
    window: {
      setTimeout: (f) => f(),
      setInterval() {},
      addEventListener() {},
      location: { hash: '' },
    },
    fetch: async (path, request) => {
      calls.push({ path, request });
      const payload = await handler(path, request);
      if (payload && payload.__httpStatus !== undefined) {
        return {
          ok: payload.__httpStatus < 400,
          status: payload.__httpStatus,
          text: async () => JSON.stringify(payload.body),
        };
      }
      return { ok: true, status: 200, text: async () => JSON.stringify(payload) };
    },
  });
  const source = readFileSync('/workspace/extensions/github-task-board/web/public/app.js', 'utf8').replace(
    '  boot();',
    '  window.__app = { state, renderDetail, renderBoard, openIssue, saveOverview, saveAnswer, saveStatus, rememberDraft, loadBoard };'
  );
  vm.runInContext(source, context);
  const app = context.window.__app;
  app.state.detail = detail(alpha);
  app.state.statusOptions = options;
  app.renderDetail(false);
  get('overview-text').value = 'Alpha draft';
  get('answer-0').value = 'Alpha answer';
  get('status-select').value = 'status:done';
  return { app, get, calls };
}

const boardFor = (repo) => ({
  scope: 'repo',
  repo: repo.full,
  repository: repo,
  login: 'owner',
  fetchedAt: '2026-10-26T10:00:00.000Z',
  truncated: false,
  complete: true,
  partial: false,
  excludedPullRequests: 0,
  issues: buildBoardList([raw(repo.name)], repo).issues,
});

async function run() {
  console.log('Running F2 probe...');

  // Scenario 1: alpha save completes after beta is selected and beta board is in-flight
  {
    let releaseWrite, releaseBeta, betaStartedResolve;
    const write = new Promise((resolve) => { releaseWrite = resolve; });
    const betaBoard = new Promise((resolve) => { releaseBeta = resolve; });
    const betaStarted = new Promise((resolve) => { betaStartedResolve = resolve; });

    const view = {
      fetchedAt: '2026-10-26T10:00:00.000Z', freshnessMs: 60000, stale: false,
      discoveryFailed: false, error: null, visibleCount: 2,
      repositories: [alpha, beta].map((r) => ({ ...r, available: true, lastSeenAt: '2026-10-26T10:00:00.000Z' })),
    };

    const { app, get, calls } = browser((path, request) => {
      if (path === '/api/repos') return view;
      if (path === '/api/repos/owner/beta/board') {
        betaStartedResolve();
        return betaBoard;
      }
      if (request?.method === 'PUT') return write;
      return { issue: detail(alpha), statusOptions: options };
    });

    app.state.selected = 'owner/alpha';
    app.state.board = boardFor(alpha);
    app.renderBoard();
    assert.match(get('repo-label').textContent, /owner\/alpha/);

    // Alpha write begins
    const saving = app.saveOverview();
    // User switches to beta
    app.state.selected = 'owner/beta';
    const loading = app.loadBoard();
    await betaStarted;

    // Alpha write settles
    releaseWrite({ issue: buildIssueDetail(raw('alpha', 'Alpha updated'), alpha), statusOptions: options });
    await saving;

    // Beta board load settles
    releaseBeta(boardFor(beta));
    await loading;

    assert.equal(app.state.selected, 'owner/beta');
    assert.equal(app.state.board.repository.full, 'owner/beta');
    assert.match(get('repo-label').textContent, /owner\/beta/);
    assert.equal(get('refresh-btn').disabled, false, 'Refresh enabled');
  }

  // Scenario 2: Overlapping loads: alpha resolves after beta
  {
    let releaseAlpha, releaseBeta;
    const alphaBoardPromise = new Promise((resolve) => { releaseAlpha = resolve; });
    const betaBoardPromise = new Promise((resolve) => { releaseBeta = resolve; });

    const view = {
      fetchedAt: '2026-10-26T10:00:00.000Z', freshnessMs: 60000, stale: false,
      discoveryFailed: false, error: null, visibleCount: 2,
      repositories: [alpha, beta],
    };

    const { app, get } = browser((path) => {
      if (path === '/api/repos') return view;
      if (path === '/api/repos/owner/alpha/board') return alphaBoardPromise;
      if (path === '/api/repos/owner/beta/board') return betaBoardPromise;
      return view;
    });

    app.state.selected = 'owner/alpha';
    const loadAlpha = app.loadBoard();
    app.state.selected = 'owner/beta';
    const loadBeta = app.loadBoard();

    // Beta resolves first
    releaseBeta(boardFor(beta));
    await loadBeta;

    // Alpha resolves after
    releaseAlpha(boardFor(alpha));
    await loadAlpha;

    assert.equal(app.state.selected, 'owner/beta');
    assert.equal(app.state.board.repository.full, 'owner/beta');
    assert.match(get('repo-label').textContent, /owner\/beta/);
    assert.equal(get('refresh-btn').disabled, false, 'Refresh enabled');
  }

  // Scenario 3: Beta load rejects -> board cleared, label beta, Refresh enabled
  {
    const view = {
      fetchedAt: '2026-10-26T10:00:00.000Z', freshnessMs: 60000, stale: false,
      discoveryFailed: false, error: null, visibleCount: 2,
      repositories: [alpha, beta],
    };
    const { app, get } = browser((path) => {
      if (path === '/api/repos') return view;
      if (path === '/api/repos/owner/beta/board') {
        return { __httpStatus: 500, body: { error: 'server_error', message: 'Fail' } };
      }
      return view;
    });

    app.state.selected = 'owner/alpha';
    app.state.board = boardFor(alpha);
    app.renderBoard();

    app.state.selected = 'owner/beta';
    await app.loadBoard();

    assert.equal(app.state.selected, 'owner/beta');
    assert.equal(app.state.board, null);
    assert.match(get('repo-label').textContent, /owner\/beta/);
    assert.equal(get('refresh-btn').disabled, false, 'Refresh enabled');
  }

  console.log('F2 probe: PASS');
}

run().catch((err) => {
  console.error('F2 probe: FAIL', err);
  process.exit(1);
});
