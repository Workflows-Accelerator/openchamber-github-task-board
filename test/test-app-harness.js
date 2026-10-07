import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function isJsonValue(value) {
  if (value === void 0) return false;
  if (value === null || typeof value === 'boolean' || typeof value === 'number' || typeof value === 'string') return true;
  if (Array.isArray(value)) return value.every(isJsonValue);
  if (Object(value) === value) return Object.values(value).every(isJsonValue);
  return false;
}

export function createTestApp(options = {}) {
  const createElement = (tag = 'div') => {
    const el = {
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
        animation: '',
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
      querySelector: () => createElement(),
      getElementsByClassName: () => [],
      getElementsByTagName: () => [],
      getBoundingClientRect: () => ({ top: 0, left: 0, width: 100, height: 100, bottom: 100, right: 100 }),
      cloneNode: function () { return createElement(tag); },
      innerHTML: '',
      textContent: '',
      value: '',
      checked: false,
      disabled: false,
    };
    return el;
  };

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
          let resultPayload = null;
          let ok = true;
          let error = null;

          if (data.type === 'storage') {
            if (data.payload?.op === 'set') {
              if (!isJsonValue(data.payload.value)) {
                ok = false;
                error = { code: 'HOST_REJECTED', message: 'Storage values must be JSON.' };
              } else {
                mockStorage.set(data.payload.key, data.payload.value);
                resultPayload = { storage: true, op: 'set', key: data.payload.key, value: data.payload.value };
              }
            } else if (data.payload?.op === 'get') {
              resultPayload = { storage: true, op: 'get', key: data.payload.key, value: mockStorage.get(data.payload.key) };
            }
          } else if (options.onRequest) {
            try {
              resultPayload = options.onRequest(data.payload);
            } catch (e) {
              ok = false;
              error = { code: 'CALL_FAILED', message: e.message };
            }
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
                  ok,
                  payload: resultPayload,
                  error,
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

  const mainJsPath = path.resolve(__dirname, '../panel/main.js');
  let mainJs = fs.readFileSync(mainJsPath, 'utf8');

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
      updateIssueBody,
      submitNewIssue,
      setRepository,
      openDrawer,
      closeDrawer,
      renderDrawer,
      repoForIssue,
      addLog,
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
