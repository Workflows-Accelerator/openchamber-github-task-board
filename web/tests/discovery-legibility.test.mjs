// A discovery failure must name its cause: refused credential, rate limit,
// network or anything else. The server keeps the kind; the client turns it into
// four distinct sentences that say what the person should do.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { startFakeGitHub, makeIssue } from './fake-github.mjs';
import { startBoard, browserConfig, HttpSession, SYNTHETIC_TOKEN } from './helpers.mjs';

const RESET_SECONDS = Math.floor(Date.parse('2026-11-14T14:32:00Z') / 1000);

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
// Client: four causes, two languages.
// ---------------------------------------------------------------------------

const EN = {
  auth: 'The board cannot read GitHub because the token was refused. Someone who holds the token must renew it; refreshing this page will not help.',
  rate_limited: 'GitHub is limiting the board temporarily. Nothing is required of you; the board will refresh after {time}.',
  rate_limited_no_reset: 'GitHub is limiting the board temporarily. Nothing is required of you; try again shortly.',
  network: 'GitHub is unreachable from the server. Your session is intact; try again shortly.',
  other: 'Discovery failed — tasks are not refreshed. Refresh to try again.',
};
const FR = {
  auth: 'Le tableau ne peut pas lire GitHub : le jeton a été refusé. Une personne qui détient le jeton doit le renouveler ; actualiser cette page n’y changera rien.',
  rate_limited: 'GitHub limite temporairement le tableau. Rien ne vous est demandé ; le tableau s’actualisera après {time}.',
  rate_limited_no_reset: 'GitHub limite temporairement le tableau. Rien ne vous est demandé ; réessayez dans un instant.',
  network: 'GitHub est injoignable depuis le serveur. Votre session est intacte ; réessayez dans un instant.',
  other: 'Échec de la découverte — les tâches ne sont pas actualisées. Actualisez pour réessayer.',
};
const DICTS = { en: EN, fr: FR };

function resetClock(language, iso) {
  const date = new Date(iso);
  return date.toLocaleTimeString(language === 'fr' ? 'fr-FR' : 'en-GB', { hour: '2-digit', minute: '2-digit' });
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

function browser(language, view) {
  const elements = new Map();
  const get = (id) => {
    if (!elements.has(id)) elements.set(id, node());
    return elements.get(id);
  };
  function node() {
    let text = '';
    const attributes = {};
    return {
      children: [], value: '', hidden: false, disabled: false, className: '', id: '',
      get textContent() { return text; },
      set textContent(value) { text = value; this.children = []; },
      setAttribute(key, value) { attributes[key] = value; if (key === 'id') { this.id = value; elements.set(value, this); } },
      getAttribute(key) { return Object.prototype.hasOwnProperty.call(attributes, key) ? attributes[key] : null; },
      removeAttribute(key) { delete attributes[key]; },
      appendChild(child) { this.children.push(child); },
      addEventListener() {}, removeEventListener() {}, focus() {}, remove() {},
      classList: { add() {}, remove() {}, contains() { return false; } },
      querySelector() { return get('empty-p'); },
    };
  }
  const calls = [];
  const context = vm.createContext({
    localStorage: { getItem: (key) => (key === 'tb_lang' ? language : null), setItem() {}, removeItem() {} },
    document: {
      getElementById: get,
      createElement: node,
      documentElement: { setAttribute() {}, removeAttribute() {}, lang: '' },
      body: { classList: { add() {}, remove() {} } },
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
    '  window.__app = { state, loadBoard, discoveryFailureMessage, failureRowMessage, I18N, renderPicker };',
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
  assert.match(get('empty-p').textContent, /try again shortly/);
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
