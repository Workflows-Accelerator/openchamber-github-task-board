import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(here, '..');
const PANEL_MAIN_JS_PATH = path.join(ROOT_DIR, 'panel', 'main.js');

/**
 * Creates a simulated browser runtime environment that executes the REAL built panel bundle
 * (panel/main.js) and intercepts host postMessage communication.
 * Exercises real host.onReady wiring, real DOM banner elements, and real closures.
 */
function createRealPanelApp(options = {}) {
  const elements = new Map();

  function makeElement(tag, id = '') {
    const el = {
      tagName: tag.toUpperCase(),
      id,
      style: {
        display: 'none',
        setProperty: () => {},
      },
      children: [],
      classList: {
        _classes: new Set(),
        add: (...cls) => cls.forEach((c) => el.classList._classes.add(c)),
        remove: (...cls) => cls.forEach((c) => el.classList._classes.delete(c)),
        contains: (c) => el.classList._classes.has(c),
        toggle: (c, force) => {
          const add = force === undefined ? !el.classList._classes.has(c) : force;
          if (add) el.classList._classes.add(c); else el.classList._classes.delete(c);
          return add;
        },
      },
      textContent: '',
      innerHTML: '',
      appendChild: (c) => el.children.push(c),
      addEventListener: () => {},
      removeEventListener: () => {},
      setAttribute: () => {},
      getAttribute: () => null,
      querySelector: () => null,
      querySelectorAll: () => [],
      focus: () => {},
      blur: () => {},
    };
    return el;
  }

  // Pre-seed banner elements matching panel/index.html
  elements.set('boardBanner', makeElement('div', 'boardBanner'));
  elements.set('boardBannerText', makeElement('span', 'boardBannerText'));
  elements.set('boardBannerActions', makeElement('div', 'boardBannerActions'));
  if (options.initialBannerText) {
    elements.get('boardBannerText').textContent = options.initialBannerText;
    elements.get('boardBanner').style.display = 'flex';
  }

  const logs = { info: [], warn: [], error: [] };
  const formatArg = (a) => (typeof a === 'object' ? JSON.stringify(a) : String(a));
  const mockConsole = {
    info: (...args) => logs.info.push(args.map(formatArg).join(' ')),
    warn: (...args) => logs.warn.push(args.map(formatArg).join(' ')),
    error: (...args) => logs.error.push(args.map(formatArg).join(' ')),
    log: () => {},
  };

  const serviceRequests = [];
  let messageHandler = null;

  const mockWindow = {
    document: {
      getElementById: (id) => elements.get(id) || makeElement('div', id),
      querySelector: (sel) => (sel.startsWith('#') ? elements.get(sel.slice(1)) || null : null),
      querySelectorAll: () => [],
      createElement: (tag) => makeElement(tag),
      documentElement: makeElement('html'),
      body: makeElement('body'),
      addEventListener: () => {},
      removeEventListener: () => {},
    },
    addEventListener: (type, handler) => {
      if (type === 'message') messageHandler = handler;
    },
    removeEventListener: () => {},
    parent: {
      postMessage: (msg) => {
        if (msg?.type === 'hello') {
          setTimeout(() => {
            const evt = new MessageEvent('message', {
              data: {
                channel: 'openchamber.sdk',
                v: 1,
                type: 'ready',
                payload: {
                  surface: 'panel',
                  directory: '/test',
                  features: {},
                  theme: {
                    mode: 'dark',
                    tokens: {
                      font: 'sans',
                      foreground: '#fff',
                      background: '#000',
                      card: '#111',
                      cardForeground: '#eee',
                      muted: '#333',
                      mutedForeground: '#888',
                      border: '#444',
                      primary: '#00f',
                      primaryForeground: '#fff',
                    },
                  },
                },
              },
            });
            Object.defineProperty(evt, 'source', { value: mockWindow.parent });
            messageHandler?.(evt);
          }, 1);
        } else if (msg?.type === 'service-request') {
          serviceRequests.push(msg.payload);
          setTimeout(async () => {
            let res;
            if (options.onServiceRequest) {
              res = await options.onServiceRequest(msg.payload);
            } else {
              res = { ok: true, payload: { status: 200, body: '{"status":"ok","service":"task-coordinator"}' } };
            }
            const evt = new MessageEvent('message', {
              data: {
                channel: 'openchamber.sdk',
                v: 1,
                type: 'result',
                id: msg.id,
                ...res,
              },
            });
            Object.defineProperty(evt, 'source', { value: mockWindow.parent });
            messageHandler?.(evt);
          }, 1);
        } else if (msg?.type === 'storage') {
          setTimeout(() => {
            const isSelectedRepo = Boolean(options.hasSelectedRepo && msg.payload?.key === 'selected_repo');
            const evt = new MessageEvent('message', {
              data: {
                channel: 'openchamber.sdk',
                v: 1,
                type: 'result',
                id: msg.id,
                ok: true,
                payload: {
                  storage: true,
                  op: msg.payload?.op,
                  found: isSelectedRepo,
                  value: isSelectedRepo ? 'test-org/test-repo' : undefined,
                },
              },
            });
            Object.defineProperty(evt, 'source', { value: mockWindow.parent });
            messageHandler?.(evt);
          }, 1);
        } else if (msg?.id) {
          setTimeout(() => {
            const evt = new MessageEvent('message', {
              data: {
                channel: 'openchamber.sdk',
                v: 1,
                type: 'result',
                id: msg.id,
                ok: true,
                payload: {},
              },
            });
            Object.defineProperty(evt, 'source', { value: mockWindow.parent });
            messageHandler?.(evt);
          }, 1);
        }
      },
    },
    console: mockConsole,
    setTimeout,
    clearTimeout,
    setInterval: () => 1,
    clearInterval: () => {},
    Date,
    Math,
    JSON,
    Array,
    Object,
    Promise,
    MessageEvent,
    TextEncoder,
    TextDecoder,
  };

  const context = vm.createContext({
    window: mockWindow,
    document: mockWindow.document,
    console: mockConsole,
    setTimeout,
    clearTimeout,
    setInterval: () => 1,
    clearInterval: () => {},
    Date,
    Math,
    JSON,
    Array,
    Object,
    Promise,
    MessageEvent,
    TextEncoder,
    TextDecoder,
  });

  const bundleJs = fs.readFileSync(PANEL_MAIN_JS_PATH, 'utf8');
  vm.runInContext(bundleJs, context);

  return {
    mockWindow,
    elements,
    logs,
    serviceRequests,
    waitForReady: () => new Promise((resolve) => setTimeout(resolve, 120)),
  };
}

test('panel-service-connection: real panel bundle executes onReady probe and outcome 1 hides prior coordinator banner', async () => {
  const app = createRealPanelApp({
    hasSelectedRepo: true,
    initialBannerText: 'Background coordinator service failed to connect.',
    onServiceRequest: () => ({ ok: true, payload: { status: 200, body: '{"status":"ok"}' } }),
  });

  await app.waitForReady();

  // Assert host.onReady dispatched real serviceRequest
  assert.equal(app.serviceRequests.length, 1);
  assert.equal(app.serviceRequests[0].method, 'GET');
  assert.equal(app.serviceRequests[0].path, '/health');

  // Real banner element is hidden
  const banner = app.elements.get('boardBanner');
  assert.equal(banner.style.display, 'none');

  // Real console log receives healthy notice
  const infoLogs = app.logs.info.filter((l) => l.includes('Background coordinator'));
  assert.equal(infoLogs.length, 1);
  assert.ok(infoLogs[0].includes('connected (healthy)'));
});

test('panel-service-connection: Outcome 1 200 OK preserves unrelated active banner (Advisory 1)', async () => {
  const unrelatedText = 'No Git remote detected. Enter a repository:';
  const app = createRealPanelApp({
    initialBannerText: unrelatedText,
    onServiceRequest: () => ({ ok: true, payload: { status: 200, body: '{"status":"ok"}' } }),
  });

  await app.waitForReady();

  const banner = app.elements.get('boardBanner');
  const bannerText = app.elements.get('boardBannerText');
  assert.equal(banner.style.display, 'flex', 'Unrelated banner must remain visible');
  assert.equal(bannerText.textContent, unrelatedText, 'Unrelated banner text must not be dismissed');
});

test('panel-service-connection: Outcome 2 NO_SERVICE shows Settings notice without claiming success', async () => {
  const app = createRealPanelApp({
    onServiceRequest: () => ({ ok: false, code: 'NO_SERVICE', error: 'Capability not granted in Settings' }),
  });

  await app.waitForReady();

  const banner = app.elements.get('boardBanner');
  const bannerText = app.elements.get('boardBannerText');
  assert.equal(banner.style.display, 'flex');
  assert.equal(
    bannerText.textContent,
    'Background coordinator service is not enabled in OpenChamber Settings -> Extensions.'
  );

  const infoLogs = app.logs.info.filter((l) => l.includes('Settings -> Extensions'));
  assert.equal(infoLogs.length, 1);
  // Never leak raw objects or tokens
  assert.equal(infoLogs[0].includes('[object Object]'), false);
});

test('panel-service-connection: Outcome 2 DISABLED shows Settings notice without claiming success', async () => {
  const app = createRealPanelApp({
    onServiceRequest: () => ({ ok: false, code: 'DISABLED', error: 'Extension is disabled' }),
  });

  await app.waitForReady();

  const banner = app.elements.get('boardBanner');
  const bannerText = app.elements.get('boardBannerText');
  assert.equal(banner.style.display, 'flex');
  assert.equal(
    bannerText.textContent,
    'Background coordinator service is not enabled in OpenChamber Settings -> Extensions.'
  );
});

test('panel-service-connection: Outcome 3 SERVICE_FAILED shows failure banner and sanitized warning', async () => {
  const app = createRealPanelApp({
    onServiceRequest: () => ({ ok: false, code: 'SERVICE_FAILED', error: 'Process exited with code 1' }),
  });

  await app.waitForReady();

  const banner = app.elements.get('boardBanner');
  const bannerText = app.elements.get('boardBannerText');
  assert.equal(banner.style.display, 'flex');
  assert.equal(bannerText.textContent, 'Background coordinator service failed to connect.');

  const warnLogs = app.logs.warn.filter((l) => l.includes('Background coordinator'));
  assert.equal(warnLogs.length, 1);
  assert.ok(warnLogs[0].includes('SERVICE_FAILED'));
  // Sanitized logging: never leak raw Error object or private stack
  assert.equal(warnLogs[0].includes('Process exited'), false);
});

test('panel-service-connection: Outcome 3 REQUEST_FAILED, HOST_TIMEOUT, and HOST_UNAVAILABLE show failure banner', async () => {
  for (const code of ['REQUEST_FAILED', 'HOST_TIMEOUT', 'HOST_UNAVAILABLE']) {
    const app = createRealPanelApp({
      onServiceRequest: () => ({ ok: false, code, error: 'Connection transport failure' }),
    });

    await app.waitForReady();

    const banner = app.elements.get('boardBanner');
    const bannerText = app.elements.get('boardBannerText');
    assert.equal(banner.style.display, 'flex');
    assert.equal(bannerText.textContent, 'Background coordinator service failed to connect.');

    const warnLogs = app.logs.warn.filter((l) => l.includes(code));
    assert.equal(warnLogs.length, 1);
  }
});

test('panel-service-connection: Outcome 3 Non-200 HTTP status shows unexpected status notice', async () => {
  const app = createRealPanelApp({
    onServiceRequest: () => ({ ok: true, payload: { status: 500, body: 'Internal Server Error' } }),
  });

  await app.waitForReady();

  const banner = app.elements.get('boardBanner');
  const bannerText = app.elements.get('boardBannerText');
  assert.equal(banner.style.display, 'flex');
  assert.equal(bannerText.textContent, 'Background coordinator service returned an unexpected status.');

  const warnLogs = app.logs.warn.filter((l) => l.includes('500'));
  assert.equal(warnLogs.length, 1);
});

test('panel-service-connection: Outcome 3 Generic error without code logs HOST_REJECTED safely', async () => {
  const app = createRealPanelApp({
    onServiceRequest: () => ({ ok: false, error: 'Network failure with secret /workspace/token' }),
  });

  await app.waitForReady();

  const banner = app.elements.get('boardBanner');
  assert.equal(banner.style.display, 'flex');

  const warnLogs = app.logs.warn.filter((l) => l.includes('Background coordinator service connection failed'));
  assert.equal(warnLogs.length, 1);
  assert.ok(warnLogs[0].includes('HOST_REJECTED') || warnLogs[0].includes('UNKNOWN'));
  assert.equal(warnLogs[0].includes('/workspace/token'), false, 'Must never leak error detail');
});

test('panel-service-connection: real window hook __taskBoardBackgroundService is exported and callable', async () => {
  const app = createRealPanelApp({
    onServiceRequest: () => ({ ok: true, payload: { status: 200, body: '{"status":"ok"}' } }),
  });

  await app.waitForReady();

  assert.ok(app.mockWindow.__taskBoardBackgroundService, 'Window hook must be defined');
  assert.equal(typeof app.mockWindow.__taskBoardBackgroundService.checkBackgroundServiceConnection, 'function');

  // Trigger manual invocation via exported window hook
  await app.mockWindow.__taskBoardBackgroundService.checkBackgroundServiceConnection();
  assert.equal(app.serviceRequests.length, 2);
});

test('panel-service-connection: Invariant: zero emojis in UI banner copy or log output', async () => {
  const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;

  for (const code of ['NO_SERVICE', 'DISABLED', 'SERVICE_FAILED', 'REQUEST_FAILED']) {
    const app = createRealPanelApp({
      onServiceRequest: () => ({ ok: false, code, error: 'err' }),
    });

    await app.waitForReady();

    const bannerText = app.elements.get('boardBannerText').textContent;
    assert.equal(emojiRegex.test(bannerText), false, `Banner text for ${code} must have zero emojis`);

    for (const log of [...app.logs.info, ...app.logs.warn]) {
      assert.equal(emojiRegex.test(log), false, `Log for ${code} must have zero emojis`);
    }
  }
});
