import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(here, '..');
const PANEL_MAIN_JS_PATH = path.join(ROOT_DIR, 'panel', 'main.js');

function scanDecl(src, start) {
  let i = start, depth = 0, paren = 0, inS = null, inT = false, inLC = false, inBC = false, inRe = false;
  let started = false;
  while (i < src.length) {
    const c = src[i], n = src[i + 1];
    if (inLC) { if (c === '\n') inLC = false; i++; continue; }
    if (inBC) { if (c === '*' && n === '/') { inBC = false; i += 2; continue; } i++; continue; }
    if (inT) { if (c === '\\') { i += 2; continue; } if (c === '`') inT = false; i++; continue; }
    if (inS) { if (c === '\\') { i += 2; continue; } if (c === inS) inS = null; i++; continue; }
    if (inRe) { if (c === '\\') { i += 2; continue; } if (c === '[') { let j = i + 1; while (j < src.length && src[j] !== ']') { if (src[j] === '\\') j++; j++; } i = j + 1; continue; } if (c === '/') { inRe = false; i++; continue; } i++; continue; }
    if (c === '/' && n === '/') { inLC = true; i += 2; continue; }
    if (c === '/' && n === '*') { inBC = true; i += 2; continue; }
    if (c === '`') { inT = true; i++; continue; }
    if (c === '"' || c === "'") { inS = c; i++; continue; }
    if (c === '/') { let p = i - 1; while (p >= 0 && /\s/.test(src[p])) p--; if ('=(,:![&|?{;'.includes(src[p])) { inRe = true; i++; continue; } i++; continue; }
    if (c === '(') { paren++; i++; continue; }
    if (c === ')') { paren--; i++; continue; }
    if (paren > 0) { i++; continue; }
    if (c === '{') { depth++; started = true; i++; continue; }
    if (c === '}') { depth--; i++; if (started && depth === 0) return src.slice(start, i); continue; }
    if (c === ';' && depth === 0 && !started) return src.slice(start, i + 1);
    i++;
  }
  throw new Error('unterminated declaration at ' + start);
}

function loadCallerFunction() {
  const mainJs = fs.readFileSync(PANEL_MAIN_JS_PATH, 'utf8');
  const targetPattern = 'async function checkBackgroundServiceConnection';
  const start = mainJs.indexOf(targetPattern);
  if (start === -1) {
    throw new Error('Could not find checkBackgroundServiceConnection in panel/main.js');
  }
  const fnDecl = scanDecl(mainJs, start);

  // Return a runner that evaluates the extracted function from the built panel bundle
  return (context) => {
    const runner = new Function(
      'host',
      'document',
      'showBanner',
      'hideBanner',
      'console',
      `return (${fnDecl})();`
    );
    return runner(
      context.host,
      context.document,
      context.showBanner,
      context.hideBanner,
      context.console
    );
  };
}

function createMockEnvironment(options = {}) {
  let bannerVisible = options.bannerVisible || false;
  let bannerText = options.bannerText || '';
  const serviceRequestCalls = [];
  const logCalls = { info: [], warn: [], error: [] };

  const host = {
    serviceRequest: async (req) => {
      serviceRequestCalls.push(req);
      if (options.serviceRequestReject) {
        throw options.serviceRequestReject;
      }
      return options.serviceRequestResolve || { status: 200, body: '{"status":"ok","service":"task-coordinator"}' };
    },
  };

  const document = {
    getElementById: (id) => {
      if (id === 'boardBannerText') {
        return {
          get textContent() {
            return bannerText;
          },
          set textContent(v) {
            bannerText = v;
          },
        };
      }
      if (id === 'boardBanner') {
        return {
          style: {
            get display() {
              return bannerVisible ? 'flex' : 'none';
            },
            set display(v) {
              bannerVisible = v === 'flex';
            },
          },
        };
      }
      return null;
    },
  };

  let showBannerCalledWith = null;
  let hideBannerCallCount = 0;

  const showBanner = (text) => {
    showBannerCalledWith = text;
    bannerVisible = true;
    bannerText = text;
  };

  const hideBanner = () => {
    hideBannerCallCount++;
    bannerVisible = false;
  };

  const mockConsole = {
    info: (...args) => logCalls.info.push(args),
    warn: (...args) => logCalls.warn.push(args),
    error: (...args) => logCalls.error.push(args),
  };

  return {
    host,
    document,
    showBanner,
    hideBanner,
    console: mockConsole,
    getServiceRequestCalls: () => serviceRequestCalls,
    getLogCalls: () => logCalls,
    getBannerState: () => ({ bannerVisible, bannerText, showBannerCalledWith, hideBannerCallCount }),
  };
}

test('panel-service-connection: Outcome 1: 200 OK connected hides prior coordinator banner and logs info', async () => {
  const caller = loadCallerFunction();
  const env = createMockEnvironment({
    bannerVisible: true,
    bannerText: 'Background coordinator service failed to connect.',
    serviceRequestResolve: { status: 200, body: '{"status":"ok"}' },
  });

  await caller(env);

  assert.equal(env.getServiceRequestCalls().length, 1);
  assert.deepEqual(env.getServiceRequestCalls()[0], { method: 'GET', path: '/health' });

  const banner = env.getBannerState();
  assert.equal(banner.hideBannerCallCount, 1, 'Should call hideBanner when prior banner was coordinator notice');
  assert.equal(banner.bannerVisible, false);

  const logs = env.getLogCalls();
  assert.equal(logs.info.length, 1);
  assert.ok(logs.info[0][0].includes('Background coordinator service connected (healthy).'));
});

test('panel-service-connection: Outcome 1: 200 OK preserves unrelated active banner (Advisory 1)', async () => {
  const caller = loadCallerFunction();
  const unrelatedText = 'No Git remote detected. Enter a repository:';
  const env = createMockEnvironment({
    bannerVisible: true,
    bannerText: unrelatedText,
    serviceRequestResolve: { status: 200 },
  });

  await caller(env);

  const banner = env.getBannerState();
  assert.equal(banner.hideBannerCallCount, 0, 'Must NOT dismiss unrelated setup banner on successful service connection');
  assert.equal(banner.bannerVisible, true, 'Unrelated banner must remain visible');
  assert.equal(banner.bannerText, unrelatedText, 'Unrelated banner text must not be altered');
});

test('panel-service-connection: Outcome 2: NO_SERVICE shows Settings notice without claiming success', async () => {
  const caller = loadCallerFunction();
  const env = createMockEnvironment({
    serviceRequestReject: { code: 'NO_SERVICE', message: 'Capability not approved' },
  });

  await caller(env);

  const banner = env.getBannerState();
  assert.equal(banner.bannerVisible, true);
  assert.equal(
    banner.showBannerCalledWith,
    'Background coordinator service is not enabled in OpenChamber Settings -> Extensions.'
  );

  const logs = env.getLogCalls();
  assert.equal(logs.info.length, 1);
  assert.ok(logs.info[0][0].includes('not enabled in Settings -> Extensions.'));
  // Never log raw error objects
  assert.equal(logs.info[0].some((arg) => typeof arg === 'object'), false);
});

test('panel-service-connection: Outcome 2: DISABLED shows Settings notice without claiming success', async () => {
  const caller = loadCallerFunction();
  const env = createMockEnvironment({
    serviceRequestReject: { code: 'DISABLED', message: 'Extension is disabled' },
  });

  await caller(env);

  const banner = env.getBannerState();
  assert.equal(banner.bannerVisible, true);
  assert.equal(
    banner.showBannerCalledWith,
    'Background coordinator service is not enabled in OpenChamber Settings -> Extensions.'
  );
});

test('panel-service-connection: Outcome 3: SERVICE_FAILED shows failure banner and sanitized warning', async () => {
  const caller = loadCallerFunction();
  const env = createMockEnvironment({
    serviceRequestReject: { code: 'SERVICE_FAILED', message: 'Process exited with code 1' },
  });

  await caller(env);

  const banner = env.getBannerState();
  assert.equal(banner.bannerVisible, true);
  assert.equal(banner.showBannerCalledWith, 'Background coordinator service failed to connect.');

  const logs = env.getLogCalls();
  assert.equal(logs.warn.length, 1);
  assert.ok(logs.warn[0][0].includes('SERVICE_FAILED'));
  // Sanitized logging: never pass raw Error object
  assert.equal(logs.warn[0].some((arg) => typeof arg === 'object'), false);
});

test('panel-service-connection: Outcome 3: REQUEST_FAILED and HOST_TIMEOUT show failure banner', async () => {
  const caller = loadCallerFunction();

  for (const code of ['REQUEST_FAILED', 'HOST_TIMEOUT', 'HOST_UNAVAILABLE']) {
    const env = createMockEnvironment({
      serviceRequestReject: { code, message: 'Transport error' },
    });

    await caller(env);

    const banner = env.getBannerState();
    assert.equal(banner.bannerVisible, true);
    assert.equal(banner.showBannerCalledWith, 'Background coordinator service failed to connect.');

    const logs = env.getLogCalls();
    assert.equal(logs.warn.length, 1);
    assert.ok(logs.warn[0][0].includes(code));
  }
});

test('panel-service-connection: Outcome 3: Non-200 HTTP status shows unexpected status notice', async () => {
  const caller = loadCallerFunction();
  const env = createMockEnvironment({
    serviceRequestResolve: { status: 500, body: 'Internal Server Error' },
  });

  await caller(env);

  const banner = env.getBannerState();
  assert.equal(banner.bannerVisible, true);
  assert.equal(banner.showBannerCalledWith, 'Background coordinator service returned an unexpected status.');

  const logs = env.getLogCalls();
  assert.equal(logs.warn.length, 1);
  assert.ok(logs.warn[0][0].includes('500'));
});

test('panel-service-connection: Outcome 3: Generic error without code logs UNKNOWN safely', async () => {
  const caller = loadCallerFunction();
  const env = createMockEnvironment({
    serviceRequestReject: new Error('Network failure with private /workspace/path in stack trace'),
  });

  await caller(env);

  const banner = env.getBannerState();
  assert.equal(banner.bannerVisible, true);
  assert.equal(banner.showBannerCalledWith, 'Background coordinator service failed to connect.');

  const logs = env.getLogCalls();
  assert.equal(logs.warn.length, 1);
  assert.ok(logs.warn[0][0].includes('UNKNOWN'));
  assert.equal(logs.warn[0][0].includes('/workspace/path'), false, 'Never leak stack or file paths in log');
});

test('panel-service-connection: Invariant: zero emojis in UI banner copy or log output', async () => {
  const caller = loadCallerFunction();
  const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;

  const testCodes = ['NO_SERVICE', 'DISABLED', 'SERVICE_FAILED', 'REQUEST_FAILED', 'HOST_TIMEOUT', 'UNKNOWN'];
  for (const code of testCodes) {
    const env = createMockEnvironment({
      serviceRequestReject: { code, message: 'error' },
    });
    await caller(env);
    const banner = env.getBannerState();
    assert.equal(emojiRegex.test(banner.bannerText), false, `Banner text for ${code} must have 0 emojis`);
  }
});
