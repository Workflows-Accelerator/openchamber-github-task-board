import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { getVersionStamp } from '../server/app.ts';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const SW_SOURCE = fs.readFileSync(path.join(ROOT, 'web/public/sw.js'), 'utf8');
const APP_SOURCE = fs.readFileSync(path.join(ROOT, 'web/public/app.js'), 'utf8');

test('getVersionStamp produces package-version prefixed build stamp from assets', () => {
  const stamp = getVersionStamp();
  assert.match(stamp, /^1\.2\.1-[a-f0-9]{10}$/);
});

test('app.js registers service worker with updateViaCache: none, update triggers, and loop guard', () => {
  // updateViaCache: 'none'
  assert.match(
    APP_SOURCE,
    /navigator\.serviceWorker\s*\.register\(['"]\/sw\.js['"],\s*\{\s*updateViaCache:\s*['"]none['"]\s*\}\)/,
  );

  // Calls registration.update() on initial register and visibilitychange
  assert.match(APP_SOURCE, /registration\.update\(\)/);
  assert.match(APP_SOURCE, /visibilitychange/);
  assert.match(APP_SOURCE, /document\.visibilityState === ['"]visible['"]/);

  // Reload loop guard on controllerchange
  assert.match(APP_SOURCE, /navigator\.serviceWorker\.addEventListener\(['"]controllerchange['"]/);
  assert.match(APP_SOURCE, /sw_reloaded/);
  assert.match(APP_SOURCE, /window\.location\.reload\(\)/);
  assert.match(APP_SOURCE, /setNotice\(['"]Updated - reload['"]\)/);
});

test('sw.js defines versioned cache name, network-first shell, cache-first icons, and api bypass', () => {
  assert.match(SW_SOURCE, /var CACHE_NAME = 'workflows-board-' \+ CACHE_VERSION/);
  assert.match(SW_SOURCE, /isShellRequest/);
  assert.match(SW_SOURCE, /isIconRequest/);

  // Shell assets array
  assert.ok(SW_SOURCE.includes("'/index.html'"));
  assert.ok(SW_SOURCE.includes("'/app.js'"));
  assert.ok(SW_SOURCE.includes("'/theme.css'"));
  assert.ok(SW_SOURCE.includes("'/manifest.json'"));
});

class MockResponse {
  constructor(body, options = {}) {
    this.body = body;
    this.status = options.status || 200;
    this.headers = new Map(Object.entries(options.headers || {}));
    this.type = options.type || 'basic';
  }

  clone() {
    return new MockResponse(this.body, {
      status: this.status,
      headers: Object.fromEntries(this.headers),
      type: this.type,
    });
  }

  text() {
    return Promise.resolve(String(this.body));
  }
}

class MockCache {
  constructor(name) {
    this.name = name;
    this.store = new Map();
  }

  async addAll(urls) {
    for (const u of urls) {
      this.store.set(u, new MockResponse(`content-of-${u}`));
    }
  }

  async put(request, response) {
    const url = typeof request === 'string' ? request : (request.url || '/');
    const pathKey = new URL(url, 'https://board.workflows.ac').pathname;
    this.store.set(pathKey, response.clone());
  }

  async match(request) {
    const url = typeof request === 'string' ? request : (request.url || '/');
    const pathKey = new URL(url, 'https://board.workflows.ac').pathname;
    const found = this.store.get(pathKey);
    return found ? found.clone() : undefined;
  }
}

class MockCacheStorage {
  constructor() {
    this.caches = new Map();
  }

  async open(name) {
    if (!this.caches.has(name)) {
      this.caches.set(name, new MockCache(name));
    }
    return this.caches.get(name);
  }

  async keys() {
    return Array.from(this.caches.keys());
  }

  async delete(name) {
    return this.caches.delete(name);
  }

  async match(request) {
    for (const cache of this.caches.values()) {
      const match = await cache.match(request);
      if (match) return match;
    }
    return undefined;
  }
}

function createSwContext(injectedVersion = '1.2.1-teststamp01') {
  const listeners = new Map();
  const cacheStorage = new MockCacheStorage();
  let skipWaitingCalled = false;
  let claimCalled = false;

  const code = SW_SOURCE.replace(
    /var CACHE_VERSION = ['"][^'"]*['"]/,
    `var CACHE_VERSION = ${JSON.stringify(injectedVersion)}`,
  );

  const sandbox = {
    self: {
      addEventListener: (type, fn) => {
        if (!listeners.has(type)) listeners.set(type, []);
        listeners.get(type).push(fn);
      },
      skipWaiting: () => {
        skipWaitingCalled = true;
        return Promise.resolve();
      },
      clients: {
        claim: () => {
          claimCalled = true;
          return Promise.resolve();
        },
      },
    },
    caches: cacheStorage,
    URL: URL,
    Promise: Promise,
    Error: Error,
    Response: MockResponse,
    fetch: async () => new MockResponse('default-fetch'),
  };

  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);

  return {
    sandbox,
    cacheStorage,
    listeners,
    getSkipWaiting: () => skipWaitingCalled,
    getClaimCalled: () => claimCalled,
    targetCacheName: `workflows-board-${injectedVersion}`,
  };
}

test('Service Worker install caches shell assets and calls skipWaiting', async () => {
  const sw = createSwContext('1.2.1-install-test');
  const installListeners = sw.listeners.get('install') || [];
  assert.ok(installListeners.length >= 1, 'install listener registered');

  let waitPromise = null;
  const event = {
    waitUntil: (p) => {
      waitPromise = p;
    },
  };

  installListeners[0](event);
  await waitPromise;

  assert.equal(sw.getSkipWaiting(), true, 'skipWaiting was called');
  const targetCache = await sw.cacheStorage.open(sw.targetCacheName);
  const matched = await targetCache.match('/app.js');
  assert.ok(matched, '/app.js was cached in targetCacheName');
});

test('Service Worker activate purges old caches including workflows-board-v1 and claims clients', async () => {
  const sw = createSwContext('1.2.1-newrelease');

  // Pre-populate old caches, specifically including the legacy workflows-board-v1
  await sw.cacheStorage.open('workflows-board-v1');
  await sw.cacheStorage.open('workflows-board-0.9.0');
  await sw.cacheStorage.open('some-other-old-cache');
  await sw.cacheStorage.open(sw.targetCacheName);

  const keysBefore = await sw.cacheStorage.keys();
  assert.ok(keysBefore.includes('workflows-board-v1'));
  assert.ok(keysBefore.includes('workflows-board-0.9.0'));
  assert.ok(keysBefore.includes(sw.targetCacheName));

  const activateListeners = sw.listeners.get('activate') || [];
  assert.ok(activateListeners.length >= 1, 'activate listener registered');

  let waitPromise = null;
  const event = {
    waitUntil: (p) => {
      waitPromise = p;
    },
  };

  activateListeners[0](event);
  await waitPromise;

  assert.equal(sw.getClaimCalled(), true, 'clients.claim was called');

  const keysAfter = await sw.cacheStorage.keys();
  // Old v1 and other legacy caches MUST be deleted
  assert.equal(keysAfter.includes('workflows-board-v1'), false, 'workflows-board-v1 was purged');
  assert.equal(keysAfter.includes('workflows-board-0.9.0'), false, 'workflows-board-0.9.0 was purged');
  assert.equal(keysAfter.includes('some-other-old-cache'), false, 'old cache was purged');
  // Current cache must be retained
  assert.ok(keysAfter.includes(sw.targetCacheName), 'target release cache was kept');
});

test('App shell requests are network-first with cache fallback only when offline', async () => {
  const sw = createSwContext('1.2.1-network-first');
  const targetCache = await sw.cacheStorage.open(sw.targetCacheName);

  // Pre-seed cache with an older cached version of app.js
  await targetCache.put(
    'https://board.workflows.ac/app.js',
    new MockResponse('console.log("cached old app.js");'),
  );

  const fetchListeners = sw.listeners.get('fetch') || [];
  assert.ok(fetchListeners.length >= 1, 'fetch listener registered');

  // 1. ONLINE test: network returns 200 with new code.
  // The fetch handler MUST return the network response, not the cached old one!
  let onlineRespondPromise = null;
  sw.sandbox.fetch = async (req) => {
    return new MockResponse('console.log("fresh network app.js");', { status: 200, type: 'basic' });
  };

  fetchListeners[0]({
    request: {
      url: 'https://board.workflows.ac/app.js',
      method: 'GET',
      mode: 'cors',
    },
    respondWith: (p) => {
      onlineRespondPromise = p;
    },
  });

  const onlineResponse = await onlineRespondPromise;
  const onlineText = await onlineResponse.text();
  assert.equal(onlineText, 'console.log("fresh network app.js");', 'fresh network version was served');

  // Cache is also updated with fresh version
  const updatedInCache = await targetCache.match('/app.js');
  assert.equal(await updatedInCache.text(), 'console.log("fresh network app.js");');

  // 2. OFFLINE test: network fails.
  // The fetch handler MUST fall back to the cache.
  let offlineRespondPromise = null;
  sw.sandbox.fetch = async () => {
    throw new Error('Failed to fetch: offline network connection');
  };

  fetchListeners[0]({
    request: {
      url: 'https://board.workflows.ac/app.js',
      method: 'GET',
      mode: 'cors',
    },
    respondWith: (p) => {
      offlineRespondPromise = p;
    },
  });

  const offlineResponse = await offlineRespondPromise;
  const offlineText = await offlineResponse.text();
  assert.equal(offlineText, 'console.log("fresh network app.js");', 'cached fallback was served offline');
});

test('Icon requests are cache-first with network fallback', async () => {
  const sw = createSwContext('1.2.1-cache-first-icons');
  const targetCache = await sw.cacheStorage.open(sw.targetCacheName);

  // Pre-seed cache with cached icon
  await targetCache.put(
    'https://board.workflows.ac/icon.svg',
    new MockResponse('<svg id="cached-icon"></svg>'),
  );

  const fetchListeners = sw.listeners.get('fetch') || [];
  let networkFetched = false;
  sw.sandbox.fetch = async () => {
    networkFetched = true;
    return new MockResponse('<svg id="network-icon"></svg>');
  };

  let iconRespondPromise = null;
  fetchListeners[0]({
    request: {
      url: 'https://board.workflows.ac/icon.svg',
      method: 'GET',
      mode: 'cors',
    },
    respondWith: (p) => {
      iconRespondPromise = p;
    },
  });

  const iconResponse = await iconRespondPromise;
  const iconText = await iconResponse.text();
  assert.equal(iconText, '<svg id="cached-icon"></svg>');
  assert.equal(networkFetched, false, 'network was not consulted when icon was cached');
});

test('API and non-GET requests bypass the service worker cache entirely', async () => {
  const sw = createSwContext('1.2.1-bypass-api');
  const targetCache = await sw.cacheStorage.open(sw.targetCacheName);
  await targetCache.put(
    'https://board.workflows.ac/api/session',
    new MockResponse('{"cached":true}'),
  );

  const fetchListeners = sw.listeners.get('fetch') || [];
  let networkCalled = false;
  sw.sandbox.fetch = async () => {
    networkCalled = true;
    return new MockResponse('{"authenticated":true,"fromNetwork":true}');
  };

  let apiRespondPromise = null;
  fetchListeners[0]({
    request: {
      url: 'https://board.workflows.ac/api/session',
      method: 'GET',
      mode: 'cors',
    },
    respondWith: (p) => {
      apiRespondPromise = p;
    },
  });

  const apiResponse = await apiRespondPromise;
  const apiText = await apiResponse.text();
  assert.equal(networkCalled, true);
  assert.equal(apiText, '{"authenticated":true,"fromNetwork":true}');
});
