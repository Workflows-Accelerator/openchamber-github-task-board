// A discovery failure must name its cause: refused credential, rate limit,
// network or anything else. The server keeps the kind; the client turns it into
// four distinct sentences that say what the person should do.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { startFakeGitHub, makeIssue } from './fake-github.mjs';
import { startBoard, browserConfig, HttpSession, SYNTHETIC_TOKEN } from './helpers.mjs';

const RESET_ISO = '2030-01-15T10:30:00.000Z';
const RESET_SECONDS = Math.floor(Date.parse(RESET_ISO) / 1000);

const CASES = [
  { kind: 'auth', mode: 'auth' },
  { kind: 'rate_limited', mode: 'rate_limited' },
  { kind: 'network', mode: 'network' },
  { kind: 'server', mode: true },
];

async function fixture() {
  const fake = await startFakeGitHub({
    token: SYNTHETIC_TOKEN,
    repositories: [
      {
        repo: 'owner/alpha',
        id: 101,
        issues: [makeIssue({ number: 1, title: 'Alpha one', body: '## Overview\n\nAlpha\n', labels: ['status:todo'] })],
      },
    ],
  });
  const board = await startBoard(fake, { repositoryTtlMs: 0, config: browserConfig(fake) });
  const client = new HttpSession(board.url);
  const login = await client.login();
  assert.equal(login.status, 200);
  return {
    fake,
    board,
    client,
    close: async () => {
      await board.app.close();
      await fake.close();
    },
  };
}

for (const { kind, mode } of CASES) {
  test(`discovery and aggregate payloads carry errorKind ${kind} while the retained fields stay unchanged`, async () => {
    const { fake, client, close } = await fixture();
    try {
      const warm = await client.request('/api/repos');
      assert.equal(warm.json.discoveryFailed, false);
      assert.equal(warm.json.errorKind, null);
      assert.equal(warm.json.error, null);
      assert.equal(warm.json.errorReason, null);
      assert.equal(warm.json.errorResetAt, null);

      fake.setDiscoveryFailure(mode);
      if (kind === 'rate_limited') fake.setDiscoveryResetAt(RESET_SECONDS);

      const failed = await client.request('/api/repos');
      assert.equal(failed.status, 200);
      assert.equal(failed.json.discoveryFailed, true);
      assert.equal(failed.json.stale, true);
      assert.equal(failed.json.errorKind, kind);
      // The retained identity and the existing sentence keep their meaning.
      assert.equal(failed.json.repositories.length, 1);
      assert.equal(failed.json.repositories[0].full, 'owner/alpha');
      assert.match(failed.json.error, /discovery failure/i);
      assert.equal(typeof failed.json.errorReason, 'string');
      assert.ok(failed.json.errorReason.length > 0 && failed.json.errorReason.length <= 80, failed.json.errorReason);
      assert.doesNotMatch(failed.json.errorReason, /Bearer|ghp_|token value|Bad credentials/i);
      if (kind === 'rate_limited') {
        assert.equal(failed.json.errorResetAt, new Date(RESET_SECONDS * 1000).toISOString());
      } else {
        assert.equal(failed.json.errorResetAt, null);
      }

      const aggregate = await client.request('/api/combined/board');
      assert.equal(aggregate.status, 200);
      assert.equal(aggregate.json.discoveryFailed, true);
      assert.equal(aggregate.json.errorKind, kind);
      assert.equal(aggregate.json.failures.length, 1);
      assert.equal(aggregate.json.failures[0].errorKind, kind);
      if (kind === 'rate_limited') {
        assert.equal(aggregate.json.failures[0].errorResetAt, new Date(RESET_SECONDS * 1000).toISOString());
      }
    } finally {
      await close();
    }
  });
}

// ---------------------------------------------------------------------------
// Server: status-first classification, honest reset time, 503 cause.
// ---------------------------------------------------------------------------

async function warmDiscovery() {
  const { fake, client, close } = await fixture();
  const warm = await client.request('/api/repos');
  assert.equal(warm.json.discoveryFailed, false);
  return { fake, client, close };
}

test('server: a 403 permission refusal is an auth failure, never server', async () => {
  const { fake, client, close } = await warmDiscovery();
  try {
    fake.setDiscoveryFailure('forbidden');
    const failed = await client.request('/api/repos');
    assert.equal(failed.json.errorKind, 'auth');
    assert.equal(failed.json.errorResetAt, null);
    assert.match(failed.json.errorReason, /token|permission/i);
  } finally {
    await close();
  }
});

test('server: non-JSON 401 and 429 keep their status meaning', async () => {
  const { fake, client, close } = await warmDiscovery();
  try {
    fake.setDiscoveryResponse(401, 'Bad credentials', { 'content-type': 'text/plain; charset=utf-8' });
    const unauthorized = await client.request('/api/repos');
    assert.equal(unauthorized.json.errorKind, 'auth');

    const resetSeconds = Math.floor(Date.now() / 1000) + 600;
    fake.setDiscoveryResponse(429, 'slow down', {
      'content-type': 'text/plain; charset=utf-8',
      'x-ratelimit-remaining': '0',
      'x-ratelimit-reset': String(resetSeconds),
    });
    const limited = await client.request('/api/repos');
    assert.equal(limited.json.errorKind, 'rate_limited');
    assert.equal(limited.json.errorResetAt, new Date(resetSeconds * 1000).toISOString());
  } finally {
    fake.setDiscoveryResponse(null);
    await close();
  }
});

test('server: a headerless secondary rate limit never reuses an old reset', async () => {
  const { fake, client, close } = await warmDiscovery();
  try {
    // The warm response recorded a future core reset in the shared rate limit.
    fake.setDiscoveryFailure('rate_limited_secondary');
    const failed = await client.request('/api/repos');
    assert.equal(failed.json.errorKind, 'rate_limited');
    assert.equal(failed.json.errorResetAt, null);
  } finally {
    await close();
  }
});

test('server: a reset time already in the past is suppressed', async () => {
  const { fake, client, close } = await warmDiscovery();
  try {
    fake.setDiscoveryFailure('rate_limited');
    fake.setDiscoveryResetAt(Math.floor(Date.now() / 1000) - 120);
    const failed = await client.request('/api/repos');
    assert.equal(failed.json.errorKind, 'rate_limited');
    assert.equal(failed.json.errorResetAt, null);
  } finally {
    await close();
  }
});

test('server: a refused single-repo board is a 503 that carries the cause', async () => {
  const { fake, client, close } = await warmDiscovery();
  try {
    fake.setDiscoveryFailure('auth');
    const board = await client.request('/api/repos/owner/alpha/board');
    assert.equal(board.status, 503);
    assert.equal(board.json.error, 'discovery_unavailable');
    assert.equal(board.json.errorKind, 'auth');
    assert.equal(board.json.errorResetAt, null);
    assert.match(board.json.message, /discovery/i);

    const archive = await client.request('/api/combined/archive');
    assert.equal(archive.status, 503);
    assert.equal(archive.json.error, 'discovery_unavailable');
    assert.equal(archive.json.errorKind, 'auth');
  } finally {
    await close();
  }
});

test('server: refresh=1 re-checks GitHub instead of staying on the latch', async () => {
  const fake = await startFakeGitHub({
    token: SYNTHETIC_TOKEN,
    repositories: [
      {
        repo: 'owner/alpha',
        id: 101,
        issues: [makeIssue({ number: 1, title: 'Alpha one', body: '## Overview\n\nAlpha\n', labels: ['status:todo'] })],
      },
    ],
  });
  const board = await startBoard(fake, { repositoryTtlMs: 60_000, config: browserConfig(fake) });
  const client = new HttpSession(board.url);
  try {
    assert.equal((await client.login()).status, 200);
    assert.equal((await client.request('/api/repos?refresh=1')).json.discoveryFailed, false);

    fake.setDiscoveryFailure('auth');
    assert.equal((await client.request('/api/repos?refresh=1')).json.errorKind, 'auth');
    assert.equal((await client.request('/api/repos/owner/alpha/board')).status, 503);

    fake.setDiscoveryFailure(false);
    // Still latched: the failed attempt is inside the 60s window.
    assert.equal((await client.request('/api/repos/owner/alpha/board')).status, 503);
    const refreshed = await client.request('/api/repos/owner/alpha/board?refresh=1');
    assert.equal(refreshed.status, 200);
    assert.equal(refreshed.json.discoveryFailed, undefined);
    assert.ok(Array.isArray(refreshed.json.issues));
  } finally {
    await board.app.close();
    await fake.close();
  }
});

// ---------------------------------------------------------------------------
// Client: four causes, two languages.
// ---------------------------------------------------------------------------

const EN = {
  auth: 'The board cannot read GitHub because the token was refused. Someone who holds the token must renew it; refreshing this page will not help.',
  rate_limited: 'GitHub is limiting the board temporarily. Refresh after {time}.',
  rate_limited_no_reset: 'GitHub is limiting the board temporarily. Try again shortly.',
  network: 'GitHub is unreachable from the server. Your session is intact; try again shortly.',
  other: 'Discovery failed — tasks are not refreshed. Refresh to try again.',
};
const FR = {
  auth: 'Le tableau ne peut pas lire GitHub : le jeton a été refusé. Une personne qui détient le jeton doit le renouveler ; actualiser cette page n’y changera rien.',
  rate_limited: 'GitHub limite temporairement le tableau. Actualisez après {time}.',
  rate_limited_no_reset: 'GitHub limite temporairement le tableau. Réessayez dans un instant.',
  network: 'GitHub est injoignable depuis le serveur. Votre session est intacte ; réessayez dans un instant.',
  other: 'Échec de la découverte — les tâches ne sont pas actualisées. Actualisez pour réessayer.',
};
const SHORT = {
  en: { auth: 'GitHub token refused', rate_limited: 'GitHub rate limit', network: 'GitHub unreachable', other: 'Discovery failed' },
  fr: { auth: 'Jeton GitHub refusé', rate_limited: 'Limite GitHub atteinte', network: 'GitHub injoignable', other: 'Découverte échouée' },
};
const DICTS = { en: EN, fr: FR };

function resetClock(language, iso) {
  const date = new Date(iso);
  const now = new Date();
  const locale = language === 'fr' ? 'fr-FR' : 'en-GB';
  const time = date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
  const sameDay = date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate();
  if (sameDay) return time;
  return date.toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' }) + ' ' + time;
}

function expectedSentence(language, kind, view = {}) {
  const dict = DICTS[language];
  if (kind === 'rate_limited' && view.errorResetAt) {
    return dict.rate_limited.replace('{time}', resetClock(language, view.errorResetAt));
  }
  if (kind === 'rate_limited') return dict.rate_limited_no_reset;
  if (kind === 'server') return dict.other;
  return dict[kind];
}

function shortLabel(language, kind) {
  return SHORT[language][kind === 'server' ? 'other' : kind];
}

function browser(language, view) {
  const elements = new Map();
  let currentLanguage = language;
  const get = (id) => {
    if (!elements.has(id)) elements.set(id, node());
    return elements.get(id);
  };
  function node() {
    let text = '';
    const attributes = {};
    const classes = new Set();
    return {
      children: [], value: '', hidden: false, disabled: false, className: '', id: '',
      get textContent() { return text; },
      set textContent(value) { text = value; this.children = []; },
      setAttribute(key, value) { attributes[key] = value; if (key === 'id') { this.id = value; elements.set(value, this); } },
      getAttribute(key) { return Object.prototype.hasOwnProperty.call(attributes, key) ? attributes[key] : null; },
      removeAttribute(key) { delete attributes[key]; },
      appendChild(child) { this.children.push(child); },
      addEventListener() {}, removeEventListener() {}, focus() {}, remove() {},
      classList: {
        add(name) { classes.add(name); },
        remove(name) { classes.delete(name); },
        contains(name) { return classes.has(name); },
      },
      querySelector() { return get('empty-p'); },
      querySelectorAll() { return []; },
    };
  }
  const calls = [];
  const context = vm.createContext({
    localStorage: {
      getItem: (key) => (key === 'tb_lang' ? currentLanguage : null),
      setItem: (key, value) => { if (key === 'tb_lang') currentLanguage = value; },
      removeItem() {},
    },
    document: {
      getElementById: get,
      createElement: node,
      documentElement: { setAttribute() {}, removeAttribute() {}, lang: '' },
      body: { classList: { add() {}, remove() {}, contains() { return false; } } },
    },
    window: {
      setTimeout: (fn) => { fn(); return 0; },
      clearTimeout() {},
      setInterval() {},
      addEventListener() {},
      location: { hash: '' },
      matchMedia: () => ({ matches: false, addEventListener() {} }),
    },
    fetch: async (path) => {
      calls.push(path);
      return { ok: true, status: 200, text: async () => JSON.stringify(view) };
    },
  });
  const source = readFileSync('web/public/app.js', 'utf8').replace(
    '  boot();',
    '  window.__app = { state, loadBoard, discoveryFailureMessage, failureRowMessage, I18N, renderPicker, setLanguage };',
  );
  vm.runInContext(source, context);
  return { app: context.window.__app, get, calls };
}

const RETAINED = {
  repositories: [{ owner: 'owner', name: 'alpha', full: 'owner/alpha', id: 101, available: true, archived: false, hasIssues: true }],
  visibleCount: 1,
  freshnessMs: 60000,
};

function discoveryView(kind, extra = {}) {
  return {
    ...RETAINED,
    fetchedAt: '2026-11-14T10:00:00.000Z',
    stale: true,
    discoveryFailed: true,
    error: 'Repository discovery failure; refresh later. Last known identities retained.',
    errorKind: kind,
    errorReason: 'GitHub returned an unexpected response',
    errorResetAt: null,
    ...extra,
  };
}

for (const language of ['en', 'fr']) {
  for (const kind of ['auth', 'rate_limited', 'network', 'server']) {
    test(`client ${language}: a ${kind} discovery failure shows its own sentence and action`, async () => {
      const extra = kind === 'rate_limited' ? { errorResetAt: new Date(RESET_SECONDS * 1000).toISOString() } : {};
      const view = discoveryView(kind, extra);
      const { app, get } = browser(language, view);
      await app.loadBoard();
      const expected = expectedSentence(language, kind, view);
      assert.equal(get('empty-p').textContent, expected);
      assert.equal(get('notice').textContent, expected);
      // The toolbar keeps a short cause label so it never overflows the strip.
      assert.equal(get('scope-status').textContent, shortLabel(language, kind));
      assert.notEqual(get('scope-status').textContent, expected);
      // Every cause is honest about what the person should do.
      assert.doesNotMatch(expected, /!|😀|n8n|mobile/i);
    });
  }
}

test('client: the four causes never share a sentence in either language', () => {
  for (const language of ['en', 'fr']) {
    const { app } = browser(language, discoveryView('server'));
    const dict = app.I18N[language];
    const sentences = ['auth', 'rate_limited', 'network', 'server'].map((kind) =>
      app.discoveryFailureMessage(discoveryView(kind, kind === 'rate_limited' ? { errorResetAt: new Date(RESET_SECONDS * 1000).toISOString() } : {}), dict),
    );
    assert.equal(new Set(sentences).size, 4, `${language}: ${sentences.join(' | ')}`);
  }
});

test('client: rate limit without a reset time still names the cause and the action', async () => {
  const view = discoveryView('rate_limited');
  const { app, get } = browser('en', view);
  await app.loadBoard();
  assert.equal(get('empty-p').textContent, EN.rate_limited_no_reset);
  assert.match(get('empty-p').textContent, /try again shortly/i);
});

test('client: the picker status and aggregate failure rows use the same sentence as the board', async () => {
  const view = discoveryView('network');
  const { app, get } = browser('en', view);
  await app.loadBoard();
  assert.equal(get('discovery-status').textContent, EN.network);
  assert.equal(
    app.failureRowMessage({ repository: { full: 'owner/alpha' }, message: 'Discovery failed; not refreshed', errorKind: 'network' }, app.I18N.en),
    EN.network,
  );
  // A repository failure without a cause keeps its own message.
  assert.equal(app.failureRowMessage({ repository: { full: 'owner/alpha' }, message: 'Unavailable' }, app.I18N.en), 'Unavailable');
});

test('client: the generic sentence is unchanged when the payload carries no kind', async () => {
  const view = { ...discoveryView('server'), errorKind: null };
  const { app, get } = browser('en', view);
  await app.loadBoard();
  assert.equal(get('empty-p').textContent, EN.other);
});

test('client: a discovery failure clears Canvas cards and the contradictory create CTA', async () => {
  const { app, get } = browser('en', discoveryView('auth'));
  app.state.board = {
    repo: 'all',
    issues: [{ number: 1, repository: { owner: 'owner', name: 'alpha', full: 'owner/alpha', id: 101 } }],
  };
  app.state.activeViewMode = 'canvas';
  get('canvas-cards').appendChild({ id: 'stale-card' });
  assert.equal(get('canvas-cards').children.length, 1);

  await app.loadBoard();

  assert.equal(get('canvas-cards').children.length, 0);
  assert.equal(get('empty-state').hidden, false);
  assert.equal(get('empty-create').hidden, true);
  assert.equal(get('empty-create').disabled, true);
  assert.equal(get('empty-hint').hidden, true);
  assert.equal(get('board-view').classList.contains('is-discovery-failed'), true);
  assert.equal(get('empty-p').textContent, EN.auth);
});

test('client: switching language re-renders an active discovery failure', async () => {
  const { app, get } = browser('en', discoveryView('auth'));
  await app.loadBoard();
  assert.equal(get('empty-p').textContent, EN.auth);

  app.setLanguage('fr');

  assert.equal(get('empty-p').textContent, FR.auth);
  assert.equal(get('notice').textContent, FR.auth);
  assert.equal(get('scope-status').textContent, SHORT.fr.auth);
  assert.equal(get('discovery-status').textContent, FR.auth);
});
