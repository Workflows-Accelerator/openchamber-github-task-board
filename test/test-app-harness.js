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
    const listeners = new Map();
    const attributes = new Map();
    const childCache = new Map();
    let innerHTMLValue = '';

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
      addEventListener: function (type, listener) {
        if (!listeners.has(type)) listeners.set(type, []);
        listeners.get(type).push(listener);
      },
      removeEventListener: function (type, listener) {
        if (!listeners.has(type)) return;
        listeners.set(type, listeners.get(type).filter((l) => l !== listener));
      },
      dispatchEvent: function (event) {
        if (!event.target) event.target = el;
        const list = listeners.get(event.type);
        if (list) {
          for (const l of [...list]) {
            l.call(el, event);
          }
        }
        return true;
      },
      click: function () {
        el.dispatchEvent({ type: 'click', target: el, preventDefault: () => {} });
      },
      setAttribute: function (name, value) {
        attributes.set(name, String(value));
      },
      getAttribute: function (name) {
        return attributes.has(name) ? attributes.get(name) : null;
      },
      removeAttribute: function (name) {
        attributes.delete(name);
      },
      hasAttribute: function (name) {
        return attributes.has(name);
      },
      contains: function (target) {
        if (target === el) return true;
        for (const c of el.children) {
          if (c === target || (c.contains && c.contains(target))) return true;
        }
        return false;
      },
      appendChild: function (child) {
        el.children.push(child);
        return child;
      },
      removeChild: function (child) {
        el.children = el.children.filter((c) => c !== child);
        return child;
      },
      replaceChild: function (newC) { return newC; },
      querySelectorAll: function (sel) {
        const results = [];
        for (const c of el.children) {
          if (sel.startsWith('.') && c.classList.contains(sel.slice(1))) results.push(c);
          if (c.querySelectorAll) results.push(...c.querySelectorAll(sel));
        }
        if (innerHTMLValue && sel === '.popover-item') {
          const regex = /<div[^>]*class="[^"]*popover-item[^"]*"[^>]*data-project-id="([^"]*)"(?:[^>]*data-repo="([^"]*)")?[^>]*>/g;
          let m;
          while ((m = regex.exec(innerHTMLValue)) !== null) {
            const itemEl = createElement('div');
            itemEl.classList.add('popover-item');
            itemEl.setAttribute('data-project-id', m[1]);
            if (m[2]) itemEl.setAttribute('data-repo', m[2]);
            results.push(itemEl);
          }
        }
        return results;
      },
      querySelector: function (sel) {
        for (const c of el.children) {
          if (sel.startsWith('.') && c.classList.contains(sel.slice(1))) return c;
          if (c.querySelector) {
            const match = c.querySelector(sel);
            if (match) return match;
          }
        }
        if (innerHTMLValue) {
          if (childCache.has(sel)) return childCache.get(sel);
          const clean = sel.replace(/^[.#]/, '');
          if (innerHTMLValue.includes(clean)) {
            const matchEl = createElement(sel.startsWith('.') || sel.startsWith('#') ? 'div' : sel);
            if (sel.startsWith('.')) matchEl.classList.add(clean);
            if (sel.startsWith('#')) matchEl.id = clean;
            childCache.set(sel, matchEl);
            return matchEl;
          }
        }
        return null;
      },
      getElementsByClassName: () => [],
      getElementsByTagName: () => [],
      getBoundingClientRect: () => ({ top: 0, left: 0, width: 100, height: 100, bottom: 100, right: 100 }),
      cloneNode: function () { return createElement(tag); },
      get innerHTML() {
        return innerHTMLValue;
      },
      set innerHTML(val) {
        innerHTMLValue = String(val);
        childCache.clear();
      },
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

  // Pre-populate elements from index.html
  const indexHtmlPath = path.resolve(__dirname, '../panel/index.html');
  const indexHtml = fs.readFileSync(indexHtmlPath, 'utf8');
  const idAttrsRegex = /<([a-z0-9-]+)([^>]*\bid="([^"]+)"[^>]*)>/gi;
  let htmlMatch;
  while ((htmlMatch = idAttrsRegex.exec(indexHtml)) !== null) {
    const [, tag, rawAttrs, id] = htmlMatch;
    const el = getEl(id);
    el.tagName = tag.toUpperCase();

    const attrRegex = /([a-z0-9-]+)="([^"]*)"/gi;
    let am;
    while ((am = attrRegex.exec(rawAttrs)) !== null) {
      el.setAttribute(am[1], am[2]);
      if (am[1] === 'class') {
        am[2].split(/\s+/).filter(Boolean).forEach((c) => el.classList.add(c));
      }
      if (am[1] === 'title') {
        el.title = am[2];
      }
    }

    if (!['input', 'img', 'br', 'hr', 'meta', 'link'].includes(tag.toLowerCase())) {
      const closeRegex = new RegExp('<' + tag + '[^>]*\\bid="' + id + '"[^>]*>([\\s\\S]*?)</' + tag + '>', 'i');
      const cm = closeRegex.exec(indexHtml);
      if (cm) {
        el.innerHTML = cm[1].trim();
      }
    }
  }

  const docListeners = new Map();
  const mockDoc = {
    getElementById: getEl,
    querySelector: (sel) => {
      if (sel.startsWith('#')) return getEl(sel.slice(1));
      return mockDoc.body.querySelector(sel) || createElement();
    },
    querySelectorAll: (sel) => mockDoc.body.querySelectorAll(sel),
    createElement,
    createDocumentFragment: () => createElement('fragment'),
    createTextNode: (t) => ({ textContent: t }),
    body: createElement('body'),
    documentElement: createElement('html'),
    addEventListener: function (type, listener) {
      if (!docListeners.has(type)) docListeners.set(type, []);
      docListeners.get(type).push(listener);
    },
    removeEventListener: function (type, listener) {
      if (!docListeners.has(type)) return;
      docListeners.get(type, docListeners.get(type).filter((l) => l !== listener));
    },
    dispatchEvent: function (event) {
      const list = docListeners.get(event.type);
      if (list) {
        for (const l of [...list]) {
          l.call(mockDoc, event);
        }
      }
      return true;
    },
  };

  let messageListener = null;
  const mockStorage = new Map();
  const hostCalls = [];

  const setIntervalCalls = [];
  const trackedSetInterval = (...args) => {
    setIntervalCalls.push(args);
    return setInterval(...args);
  };

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
    setInterval: trackedSetInterval,
    __setIntervalCalls: setIntervalCalls,
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
    initEvents();
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
      renderEmptyState,
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
        isManualRepoOverride,
        activeSessionId,
        currentDirectory,
        allProjects,
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
        if (updates.isManualRepoOverride !== undefined) isManualRepoOverride = updates.isManualRepoOverride;
        if (updates.activeSessionId !== undefined) activeSessionId = updates.activeSessionId;
        if (updates.currentDirectory !== undefined) currentDirectory = updates.currentDirectory;
        if (updates.allProjects !== undefined) allProjects = updates.allProjects;
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

  const emitMessage = (msg) => {
    if (messageListener) {
      const evt = new MessageEvent('message', {
        data: msg,
      });
      Object.defineProperty(evt, 'source', { value: mockWindow.parent });
      messageListener(evt);
    }
  };

  const emitSession = async (session) => {
    emitMessage({
      channel: 'openchamber.sdk',
      v: 1,
      type: 'session',
      payload: { session },
    });
    await new Promise((r) => setTimeout(r, 10));
  };

  const emitDirectory = async (directory) => {
    emitMessage({
      channel: 'openchamber.sdk',
      v: 1,
      type: 'directory',
      payload: { directory },
    });
    await new Promise((r) => setTimeout(r, 10));
  };

  return { app, elements, mockDoc, mockWindow, mockStorage, hostCalls, emitSession, emitDirectory };
}
