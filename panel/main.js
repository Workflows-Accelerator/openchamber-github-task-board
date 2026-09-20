"use strict";
(() => {
  // ../../../usr/local/lib/node_modules/@openchamber/web/node_modules/@openchamber/sdk/dist/api-version.js
  var OPENCHAMBER_SDK_CHANNEL = "openchamber.sdk";
  var OPENCHAMBER_SDK_API_VERSION = 1;

  // ../../../usr/local/lib/node_modules/@openchamber/web/node_modules/@openchamber/sdk/dist/scrollbar-style.js
  var GUEST_SCROLLBAR_CSS = `
:root {
  --oc-scrollbar-thumb: color-mix(in srgb, var(--oc-muted, currentColor) 40%, transparent);
  --oc-scrollbar-thumb-hover: color-mix(in srgb, var(--oc-muted, currentColor) 65%, transparent);
  scrollbar-gutter: stable;
}
* {
  scrollbar-width: thin;
  scrollbar-color: var(--oc-scrollbar-thumb) transparent;
}
/* Chromium's standard scrollbar properties otherwise override its pseudo-elements. */
@supports selector(::-webkit-scrollbar) {
  * { scrollbar-width: auto; scrollbar-color: auto; }
  ::-webkit-scrollbar { width: 6px; height: 6px; background: transparent; }
  :root::-webkit-scrollbar, body::-webkit-scrollbar { background: var(--oc-bg, inherit); }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb {
    background: var(--oc-scrollbar-thumb);
    border-radius: 999px;
    min-width: 24px;
    min-height: 24px;
  }
  ::-webkit-scrollbar-thumb:hover { background: var(--oc-scrollbar-thumb-hover); }
  ::-webkit-scrollbar-corner { background: transparent; }
  ::-webkit-scrollbar-button { display: none; width: 0; height: 0; }
}
@media (forced-colors: active) {
  * { scrollbar-color: auto; }
  ::-webkit-scrollbar-thumb, ::-webkit-scrollbar-thumb:hover { background: CanvasText; }
}
`;

  // ../../../usr/local/lib/node_modules/@openchamber/web/node_modules/@openchamber/sdk/dist/workspace.js
  var GUEST_STORAGE_KEY_MAX = 128;
  var GUEST_STORAGE_VALUE_BYTES = 65536;

  // ../../../usr/local/lib/node_modules/@openchamber/web/node_modules/@openchamber/sdk/dist/contract.js
  var GUEST_FILE_STAT_KINDS = ["file", "directory", "other", "missing"];
  var isStartSessionResult = (value) => Boolean(value && "sessionId" in value);
  var isPromptResult = (value) => Boolean(value && "sent" in value && !("sessionId" in value));
  var GUEST_TOAST_MAX = 500;
  var GUEST_CLIPBOARD_TEXT_MAX = 32e3;
  var GUEST_COMPOSE_TEXT_MAX = 16e3;
  var GUEST_ATTACH_ID_MAX = 128;
  var GUEST_ATTACH_TITLE_MAX = 200;
  var GUEST_ATTACH_URL_MAX = 2e3;
  var GUEST_ATTACH_TEXT_MAX = 16e3;
  var GUEST_ATTACH_AUTHOR_MAX = 80;
  var GUEST_ATTACH_BRANCH_MAX = 200;
  var GUEST_ATTACH_DATA_MAX = 16e3;
  var GUEST_REQUEST_PATH_MAX = 2e3;
  var GUEST_REQUEST_TIMEOUT_MS = 2e4;
  var GUEST_FILE_PATH_MAX = 1024;
  var GUEST_FILE_CONTENT_MAX = 2e6;
  var GUEST_GENERATE_PROMPT_MAX = 64e3;
  var GUEST_GENERATE_SYSTEM_MAX = 8e3;
  var GUEST_GENERATE_OUTPUT_TOKENS_MAX = 4e3;
  var GUEST_GENERATE_TIMEOUT_MS = 9e4;
  var GUEST_BADGE_MAX = 999;
  var GUEST_RESOLVE_ERROR_MAX = 500;
  var HOST_REQUEST_ERROR_CODES = [
    "HOST_UNAVAILABLE",
    "HOST_TIMEOUT",
    "HOST_REJECTED",
    "DISCONNECTED",
    "DISABLED",
    "BAD_PATH",
    "NO_INTEGRATION",
    "NO_SERVICE",
    "SERVICE_FAILED",
    "NO_SESSION",
    "SESSION_BUSY",
    "NOT_GRANTED",
    "NO_DIRECTORY",
    "NOT_FOUND",
    "FILE_TOO_LARGE",
    "DENIED",
    "NO_MODEL",
    "MODEL_FAILED"
  ];
  var SERVICE_STATUS_VALUES = ["stopped", "starting", "ready", "failed"];
  var hostRequestErrorCodeSet = new Set(HOST_REQUEST_ERROR_CODES);
  var isHostRequestErrorCode = (value) => hostRequestErrorCodeSet.has(value);
  var resolveHostRequestErrorCode = (value) => value && isHostRequestErrorCode(value) ? value : "HOST_REJECTED";
  var isJsonValue = (value) => {
    if (value === void 0)
      return false;
    if (value === null || value === true || value === false)
      return true;
    if (String(value) === value)
      return true;
    if (Number(value) === value)
      return Number.isFinite(value);
    if (Array.isArray(value))
      return value.every(isJsonValue);
    if (Object(value) === value)
      return Object.values(value).every(isJsonValue);
    return false;
  };
  var isAttachData = (value) => isJsonValue(value) && JSON.stringify(value).length <= GUEST_ATTACH_DATA_MAX;
  var clampBranch = (value) => value?.trim().slice(0, GUEST_ATTACH_BRANCH_MAX) ?? "";
  var clampAttachRequest = (request) => {
    const id = request.id.trim().slice(0, GUEST_ATTACH_ID_MAX);
    const title = request.title.trim().slice(0, GUEST_ATTACH_TITLE_MAX);
    const url = request.url.trim().slice(0, GUEST_ATTACH_URL_MAX);
    const text = request.text?.trim().slice(0, GUEST_ATTACH_TEXT_MAX);
    const author = request.author?.trim().slice(0, GUEST_ATTACH_AUTHOR_MAX);
    const kind = request.kind === "pull" ? "pull" : "issue";
    const next = {
      providerId: request.providerId.trim(),
      id,
      title: title || id,
      url,
      kind
    };
    if (text) {
      next.text = text;
    }
    if (author) {
      next.author = author;
    }
    if (kind === "pull") {
      const head = clampBranch(request.branches?.head);
      const base = clampBranch(request.branches?.base);
      if (head && base) {
        next.branches = { head, base };
      }
    }
    if (isAttachData(request.data)) {
      next.data = request.data;
    }
    return next;
  };
  var clampStartSessionRequest = (request) => {
    const next = clampAttachRequest(request);
    if (request.projectId)
      next.projectId = request.projectId;
    if (request.navigation)
      next.navigation = request.navigation;
    if (request.worktree) {
      next.worktree = request.worktree;
    }
    return next;
  };
  var clampPromptRequest = (request) => {
    const next = {
      text: request.text.trim().slice(0, GUEST_COMPOSE_TEXT_MAX)
    };
    if (request.send) {
      next.send = true;
    }
    return next;
  };
  var clampBadgeCount = (count) => {
    if (count === null || !Number.isFinite(count))
      return null;
    return Math.min(GUEST_BADGE_MAX, Math.max(0, Math.round(count)));
  };
  var isGuestFilePath = (value) => value.length > 0 && value.length <= GUEST_FILE_PATH_MAX && !value.includes("\0") && !value.includes("\\");
  var isGuestRequestPath = (value) => {
    if (!value.startsWith("/") || value.includes("\0") || value.includes("\\") || value.includes("://")) {
      return false;
    }
    if (value.length > GUEST_REQUEST_PATH_MAX) {
      return false;
    }
    const segments = value.split("/");
    return !segments.some((segment) => segment === "." || segment === "..");
  };
  var serviceStatusSet = new Set(SERVICE_STATUS_VALUES);
  var isServiceStatusResult = (value) => Boolean(value && "status" in value && serviceStatusSet.has(String(value.status)) && !("body" in value));
  var isGuestRequestResult = (value) => Boolean(value && "status" in value && "body" in value && Number.isInteger(value.status));
  var isFileReadResult = (value) => Boolean(value && "content" in value && String(value.content) === value.content);
  var isFileWriteResult = (value) => Boolean(value && "written" in value && value.written === true);
  var isFileListResult = (value) => Boolean(value && "entries" in value && Array.isArray(value.entries));
  var fileStatKindSet = new Set(GUEST_FILE_STAT_KINDS);
  var isFileStatResult = (value) => Boolean(value && "kind" in value && "size" in value && fileStatKindSet.has(String(value.kind)) && Number.isFinite(value.size));
  var isGenerateResult = (value) => Boolean(value && "text" in value && String(value.text) === value.text && !("status" in value));
  var HOST_PUSH_TYPES = /* @__PURE__ */ new Set([
    "workspace",
    "ready",
    "directory",
    "session",
    "connection",
    "settings",
    "session-lifecycle",
    "item",
    "resolve",
    "action"
  ]);
  var asWireRecord = (data) => Object(data) === data ? data : null;
  var isNonEmptyString = (value) => String(value) === value && value.length > 0;
  var readResultMessage = (wire) => {
    if (!isNonEmptyString(wire.id))
      return null;
    if (wire.ok === true) {
      const message = {
        channel: OPENCHAMBER_SDK_CHANNEL,
        v: OPENCHAMBER_SDK_API_VERSION,
        type: "result",
        id: wire.id,
        ok: true
      };
      if (Object(wire.payload) === wire.payload) {
        message.payload = wire.payload;
      }
      return message;
    }
    if (wire.ok === false && isNonEmptyString(wire.error)) {
      return {
        channel: OPENCHAMBER_SDK_CHANNEL,
        v: OPENCHAMBER_SDK_API_VERSION,
        type: "result",
        id: wire.id,
        ok: false,
        error: wire.error,
        code: resolveHostRequestErrorCode(isNonEmptyString(wire.code) ? wire.code : void 0)
      };
    }
    return null;
  };
  var readHostMessage = (data) => {
    const wire = asWireRecord(data);
    if (!wire || wire.channel !== OPENCHAMBER_SDK_CHANNEL || wire.v !== OPENCHAMBER_SDK_API_VERSION)
      return null;
    if (wire.type === "result")
      return readResultMessage(wire);
    if (!HOST_PUSH_TYPES.has(String(wire.type)) || Object(wire.payload) !== wire.payload)
      return null;
    return wire;
  };

  // ../../../usr/local/lib/node_modules/@openchamber/web/node_modules/@openchamber/sdk/dist/host.js
  var HostRequestError = class extends Error {
    code;
    constructor(code, message) {
      super(message);
      this.name = "HostRequestError";
      this.code = code;
    }
  };
  var rejectBadPath = () => Promise.reject(new HostRequestError("BAD_PATH", 'Request path must start with "/" and stay on the declared origin.'));
  var rejectBadFilePath = () => Promise.reject(new HostRequestError("BAD_PATH", `File path must be 1 to ${GUEST_FILE_PATH_MAX} characters without NUL or backslash.`));
  var nextId = (n) => {
    n.value += 1;
    return `oc-${n.value}`;
  };
  var connectHost = (options = {}) => {
    const target = options.target ?? ("window" in globalThis ? window : null);
    if (!target) {
      throw new HostRequestError("HOST_UNAVAILABLE", "No window. connectHost runs in a browser frame.");
    }
    const acceptSource = options.acceptSource ?? ((source) => source === target.parent);
    const requestTimeoutMs = options.requestTimeoutMs ?? GUEST_REQUEST_TIMEOUT_MS;
    const readyListeners = /* @__PURE__ */ new Set();
    const directoryListeners = /* @__PURE__ */ new Set();
    const sessionListeners = /* @__PURE__ */ new Set();
    const lifecycleListeners = /* @__PURE__ */ new Set();
    const connectionListeners = /* @__PURE__ */ new Set();
    const settingsListeners = /* @__PURE__ */ new Set();
    const itemListeners = /* @__PURE__ */ new Set();
    let resolveHandler = null;
    let actionHandler = null;
    const pending = /* @__PURE__ */ new Map();
    const workspaceListeners = /* @__PURE__ */ new Map();
    let disposed = false;
    const ids = { value: 0 };
    let lastReady = null;
    let lastLifecycle = null;
    const lifecycleFromSession = (session) => {
      if (!session)
        return null;
      return {
        sessionId: session.id,
        phase: session.busy ? "started" : "completed"
      };
    };
    const post = (message) => {
      target.parent.postMessage(message, "*");
    };
    const emit = (listeners, value) => {
      for (const listener of listeners) {
        try {
          listener(value);
        } catch (error) {
          console.error(error);
        }
      }
    };
    const onMessage = (event) => {
      if (!(event instanceof MessageEvent))
        return;
      if (!acceptSource(event.source))
        return;
      const message = readHostMessage(event.data);
      if (!message)
        return;
      if (message.type === "workspace") {
        const listener = workspaceListeners.get(message.payload.subscriptionId);
        if (listener)
          emit([listener], message.payload.snapshot);
        return;
      }
      if (message.type === "ready") {
        lastReady = message.payload;
        lastLifecycle = lifecycleFromSession(message.payload.session);
        emit(readyListeners, message.payload);
        emit(directoryListeners, message.payload.directory);
        emit(sessionListeners, message.payload.session);
        if (lastLifecycle) {
          emit(lifecycleListeners, lastLifecycle);
        }
        emit(connectionListeners, message.payload.connection);
        emit(settingsListeners, message.payload.settings);
        emit(itemListeners, message.payload.item);
        return;
      }
      if (message.type === "directory") {
        if (lastReady) {
          lastReady = { ...lastReady, directory: message.payload.directory };
        }
        emit(directoryListeners, message.payload.directory);
        return;
      }
      if (message.type === "session") {
        if (lastReady) {
          lastReady = { ...lastReady, session: message.payload.session };
        }
        if (!message.payload.session) {
          lastLifecycle = null;
        } else if (lastLifecycle?.sessionId !== message.payload.session.id) {
          lastLifecycle = lifecycleFromSession(message.payload.session);
        }
        emit(sessionListeners, message.payload.session);
        return;
      }
      if (message.type === "session-lifecycle") {
        lastLifecycle = message.payload;
        emit(lifecycleListeners, message.payload);
        return;
      }
      if (message.type === "connection") {
        if (lastReady) {
          lastReady = { ...lastReady, connection: message.payload.connection };
        }
        emit(connectionListeners, message.payload.connection);
        return;
      }
      if (message.type === "settings") {
        if (lastReady) {
          lastReady = { ...lastReady, settings: message.payload.settings };
        }
        emit(settingsListeners, message.payload.settings);
        return;
      }
      if (message.type === "item") {
        if (lastReady) {
          lastReady = { ...lastReady, item: message.payload.item };
        }
        emit(itemListeners, message.payload.item);
        return;
      }
      if (message.type === "action") {
        const answer = (payload) => {
          if (!disposed)
            post({
              channel: OPENCHAMBER_SDK_CHANNEL,
              v: OPENCHAMBER_SDK_API_VERSION,
              type: "action-result",
              id: message.id,
              payload
            });
        };
        const handler = actionHandler;
        if (!handler) {
          answer({ ok: false, error: "This extension does not handle background actions." });
          return;
        }
        Promise.resolve().then(() => handler(message.payload)).then(() => answer({ ok: true }), (error) => {
          const text = (error instanceof Error ? error.message : String(error)).trim();
          answer({ ok: false, error: (text || "Action failed.").slice(0, GUEST_RESOLVE_ERROR_MAX) });
        });
        return;
      }
      if (message.type === "resolve") {
        const answer = (payload) => {
          post({
            channel: OPENCHAMBER_SDK_CHANNEL,
            v: OPENCHAMBER_SDK_API_VERSION,
            type: "resolve-result",
            id: message.id,
            payload
          });
        };
        const handler = resolveHandler;
        if (!handler) {
          answer({ error: "This extension does not resolve commands." });
          return;
        }
        Promise.resolve().then(() => handler(message.payload)).then((item) => answer({ item: item ? clampAttachRequest(item) : null }), (error) => {
          const text = (error instanceof Error ? error.message : String(error)).trim();
          answer({ error: (text || "Command failed.").slice(0, GUEST_RESOLVE_ERROR_MAX) });
        });
        return;
      }
      const waiter = pending.get(message.id);
      if (!waiter)
        return;
      clearTimeout(waiter.timer);
      pending.delete(message.id);
      if (message.ok) {
        waiter.resolve(message.payload);
        return;
      }
      waiter.reject(new HostRequestError(message.code, message.error));
    };
    target.addEventListener("message", onMessage);
    post({
      channel: OPENCHAMBER_SDK_CHANNEL,
      v: OPENCHAMBER_SDK_API_VERSION,
      type: "hello"
    });
    const send = (message, timeoutMs = requestTimeoutMs) => {
      if (disposed || target.parent === target) {
        return Promise.reject(new HostRequestError("HOST_UNAVAILABLE", "No host frame. This page is not in an iframe."));
      }
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          pending.delete(message.id);
          reject(new HostRequestError("HOST_TIMEOUT", "Host did not answer in time."));
        }, timeoutMs);
        pending.set(message.id, { resolve, reject, timer });
        post(message);
      });
    };
    const request = (message) => send(message).then(() => void 0);
    const envelope = { channel: OPENCHAMBER_SDK_CHANNEL, v: OPENCHAMBER_SDK_API_VERSION };
    const requireIdentity = (value, maximum = 1024) => {
      if (!value.trim() || value.length > maximum)
        throw new HostRequestError("HOST_REJECTED", `Identity must contain 1 to ${maximum} characters.`);
    };
    const readWorkspace = async (query) => {
      if (query.kind !== "projects")
        requireIdentity(query.projectId);
      const result = await send({ ...envelope, type: "workspace-read", id: nextId(ids), payload: query });
      if (!result || !("kind" in result) || !("state" in result) || result.kind !== query.kind) {
        throw new HostRequestError("HOST_REJECTED", "Host did not return workspace data.");
      }
      return result;
    };
    const subscribeWorkspace = async (query, listener) => {
      if (query.kind !== "projects")
        requireIdentity(query.projectId);
      const subscriptionId = nextId(ids);
      workspaceListeners.set(subscriptionId, listener);
      try {
        await request({ ...envelope, type: "workspace-subscribe", id: nextId(ids), payload: { subscriptionId, query } });
      } catch (error) {
        workspaceListeners.delete(subscriptionId);
        if (!disposed)
          post({ ...envelope, type: "workspace-unsubscribe", id: nextId(ids), payload: { subscriptionId } });
        throw error;
      }
      return () => {
        if (!workspaceListeners.delete(subscriptionId) || disposed)
          return;
        post({ ...envelope, type: "workspace-unsubscribe", id: nextId(ids), payload: { subscriptionId } });
      };
    };
    const storage = async (payload) => {
      if ("key" in payload && (payload.key.length === 0 || payload.key.length > GUEST_STORAGE_KEY_MAX)) {
        throw new HostRequestError("HOST_REJECTED", "Storage key must contain 1 to 128 characters.");
      }
      if (payload.op === "set" && !isJsonValue(payload.value)) {
        throw new HostRequestError("HOST_REJECTED", "Storage values must be JSON.");
      }
      if (payload.op === "set" && new TextEncoder().encode(JSON.stringify(payload.value)).length > GUEST_STORAGE_VALUE_BYTES) {
        throw new HostRequestError("HOST_REJECTED", "Storage value exceeds 64 KiB.");
      }
      const result = await send({ ...envelope, type: "storage", id: nextId(ids), payload });
      if (!result || !("storage" in result) || result.op !== payload.op)
        throw new HostRequestError("HOST_REJECTED", "Host did not return storage data.");
      return result;
    };
    return {
      onAction: (handler) => {
        actionHandler = handler;
        return () => {
          if (actionHandler === handler)
            actionHandler = null;
        };
      },
      listProjects: async () => {
        const result = await readWorkspace({ kind: "projects" });
        if (result.kind !== "projects")
          throw new HostRequestError("HOST_REJECTED", "Expected projects.");
        return result;
      },
      listWorktrees: async (projectId) => {
        const result = await readWorkspace({ kind: "worktrees", projectId });
        if (result.kind !== "worktrees")
          throw new HostRequestError("HOST_REJECTED", "Expected worktrees.");
        return result;
      },
      listSessions: async (projectId) => {
        const result = await readWorkspace({ kind: "sessions", projectId });
        if (result.kind !== "sessions")
          throw new HostRequestError("HOST_REJECTED", "Expected sessions.");
        return result;
      },
      onProjects: (listener) => subscribeWorkspace({ kind: "projects" }, (snapshot) => {
        if (snapshot.kind === "projects")
          listener(snapshot);
      }),
      onWorktrees: (projectId, listener) => subscribeWorkspace({ kind: "worktrees", projectId }, (snapshot) => {
        if (snapshot.kind === "worktrees")
          listener(snapshot);
      }),
      onSessions: (projectId, listener) => subscribeWorkspace({ kind: "sessions", projectId }, (snapshot) => {
        if (snapshot.kind === "sessions")
          listener(snapshot);
      }),
      openSession: async (sessionId) => {
        requireIdentity(sessionId);
        await request({ ...envelope, type: "open-session", id: nextId(ids), payload: { sessionId } });
      },
      storage: {
        get: async (key) => {
          const result = await storage({ op: "get", key });
          return result.op === "get" && result.found ? result.value : void 0;
        },
        set: async (key, value) => {
          await storage({ op: "set", key, value });
        },
        delete: async (key) => {
          await storage({ op: "delete", key });
        },
        keys: async () => {
          const result = await storage({ op: "keys" });
          if (result.op !== "keys")
            throw new HostRequestError("HOST_REJECTED", "Expected storage keys.");
          return result.keys;
        }
      },
      onReady: (listener) => {
        readyListeners.add(listener);
        if (lastReady)
          listener(lastReady);
        return () => {
          readyListeners.delete(listener);
        };
      },
      onDirectory: (listener) => {
        directoryListeners.add(listener);
        if (lastReady)
          listener(lastReady.directory);
        return () => {
          directoryListeners.delete(listener);
        };
      },
      onSession: (listener) => {
        sessionListeners.add(listener);
        if (lastReady)
          listener(lastReady.session);
        return () => {
          sessionListeners.delete(listener);
        };
      },
      onSessionLifecycle: (listener) => {
        lifecycleListeners.add(listener);
        if (lastLifecycle)
          listener(lastLifecycle);
        return () => {
          lifecycleListeners.delete(listener);
        };
      },
      onConnection: (listener) => {
        connectionListeners.add(listener);
        if (lastReady)
          listener(lastReady.connection);
        return () => {
          connectionListeners.delete(listener);
        };
      },
      onSettings: (listener) => {
        settingsListeners.add(listener);
        if (lastReady)
          listener(lastReady.settings);
        return () => {
          settingsListeners.delete(listener);
        };
      },
      onItem: (listener) => {
        itemListeners.add(listener);
        if (lastReady)
          listener(lastReady.item);
        return () => {
          itemListeners.delete(listener);
        };
      },
      onResolve: (handler) => {
        resolveHandler = handler;
        return () => {
          if (resolveHandler === handler)
            resolveHandler = null;
        };
      },
      toast: (payload) => {
        const message = payload.message.trim();
        if (!message || message.length > GUEST_TOAST_MAX) {
          return Promise.reject(new HostRequestError("HOST_REJECTED", `Toast message must contain 1 to ${GUEST_TOAST_MAX} characters.`));
        }
        if (payload.copy && payload.copy !== true && (!payload.copy.text.length || payload.copy.text.length > GUEST_CLIPBOARD_TEXT_MAX)) {
          return Promise.reject(new HostRequestError("HOST_REJECTED", `Toast copy text must contain 1 to ${GUEST_CLIPBOARD_TEXT_MAX} characters.`));
        }
        return request({
          channel: OPENCHAMBER_SDK_CHANNEL,
          v: OPENCHAMBER_SDK_API_VERSION,
          type: "toast",
          id: nextId(ids),
          payload: { ...payload, message }
        });
      },
      openUrl: (url) => request({
        channel: OPENCHAMBER_SDK_CHANNEL,
        v: OPENCHAMBER_SDK_API_VERSION,
        type: "open-url",
        id: nextId(ids),
        payload: { url }
      }),
      openSurface: (surfaceId) => request({
        channel: OPENCHAMBER_SDK_CHANNEL,
        v: OPENCHAMBER_SDK_API_VERSION,
        type: "open-surface",
        id: nextId(ids),
        payload: { surfaceId }
      }),
      writeClipboard: (text) => request({
        channel: OPENCHAMBER_SDK_CHANNEL,
        v: OPENCHAMBER_SDK_API_VERSION,
        type: "clipboard-write",
        id: nextId(ids),
        payload: { text }
      }),
      compose: (payload) => request({
        channel: OPENCHAMBER_SDK_CHANNEL,
        v: OPENCHAMBER_SDK_API_VERSION,
        type: "compose",
        id: nextId(ids),
        payload
      }),
      attach: (payload) => request({
        channel: OPENCHAMBER_SDK_CHANNEL,
        v: OPENCHAMBER_SDK_API_VERSION,
        type: "attach",
        id: nextId(ids),
        payload: clampAttachRequest(payload)
      }),
      startSession: async (payload) => {
        if (payload.projectId !== void 0)
          requireIdentity(payload.projectId);
        const worktree = payload.worktree;
        if (worktree && worktree !== true) {
          if (worktree.kind === "existing")
            requireIdentity(worktree.directory);
          else {
            if (worktree.name !== void 0)
              requireIdentity(worktree.name, 200);
            if (worktree.baseBranch !== void 0)
              requireIdentity(worktree.baseBranch, 200);
          }
        }
        const result = await send({
          channel: OPENCHAMBER_SDK_CHANNEL,
          v: OPENCHAMBER_SDK_API_VERSION,
          type: "start-session",
          id: nextId(ids),
          payload: clampStartSessionRequest(payload)
        }, options.requestTimeoutMs ?? 18e4);
        if (!isStartSessionResult(result)) {
          throw new HostRequestError("HOST_REJECTED", "Host did not return a session.");
        }
        return result;
      },
      prompt: (payload) => send({
        channel: OPENCHAMBER_SDK_CHANNEL,
        v: OPENCHAMBER_SDK_API_VERSION,
        type: "prompt",
        id: nextId(ids),
        payload: clampPromptRequest(payload)
      }).then((result) => {
        if (!isPromptResult(result)) {
          throw new HostRequestError("HOST_REJECTED", "Host did not return a prompt result.");
        }
        return result;
      }),
      sessionLink: (payload) => request({
        channel: OPENCHAMBER_SDK_CHANNEL,
        v: OPENCHAMBER_SDK_API_VERSION,
        type: "session-link",
        id: nextId(ids),
        payload: clampAttachRequest(payload)
      }),
      close: () => request({
        channel: OPENCHAMBER_SDK_CHANNEL,
        v: OPENCHAMBER_SDK_API_VERSION,
        type: "close",
        id: nextId(ids)
      }),
      oauthStart: () => request({
        channel: OPENCHAMBER_SDK_CHANNEL,
        v: OPENCHAMBER_SDK_API_VERSION,
        type: "oauth-start",
        id: nextId(ids)
      }),
      oauthDisconnect: () => request({
        channel: OPENCHAMBER_SDK_CHANNEL,
        v: OPENCHAMBER_SDK_API_VERSION,
        type: "oauth-disconnect",
        id: nextId(ids)
      }),
      request: (payload) => (isGuestRequestPath(payload.path) ? send({
        channel: OPENCHAMBER_SDK_CHANNEL,
        v: OPENCHAMBER_SDK_API_VERSION,
        type: "request",
        id: nextId(ids),
        payload
      }) : rejectBadPath()).then((result) => {
        if (!isGuestRequestResult(result)) {
          throw new HostRequestError("HOST_REJECTED", "Host request result was empty.");
        }
        return result;
      }),
      serviceRequest: (payload) => (isGuestRequestPath(payload.path) ? send({
        channel: OPENCHAMBER_SDK_CHANNEL,
        v: OPENCHAMBER_SDK_API_VERSION,
        type: "service-request",
        id: nextId(ids),
        payload
      }) : rejectBadPath()).then((result) => {
        if (!isGuestRequestResult(result)) {
          throw new HostRequestError("HOST_REJECTED", "Host service request result was empty.");
        }
        return result;
      }),
      serviceStatus: () => send({
        channel: OPENCHAMBER_SDK_CHANNEL,
        v: OPENCHAMBER_SDK_API_VERSION,
        type: "service-status",
        id: nextId(ids)
      }).then((result) => {
        if (!isServiceStatusResult(result)) {
          throw new HostRequestError("HOST_REJECTED", "Host did not return service status.");
        }
        return result;
      }),
      readFile: (path) => (isGuestFilePath(path) ? send({
        channel: OPENCHAMBER_SDK_CHANNEL,
        v: OPENCHAMBER_SDK_API_VERSION,
        type: "file-read",
        id: nextId(ids),
        payload: { path }
      }) : rejectBadFilePath()).then((result) => {
        if (!isFileReadResult(result)) {
          throw new HostRequestError("HOST_REJECTED", "Host did not return file content.");
        }
        return result;
      }),
      writeFile: (path, content) => {
        if (!isGuestFilePath(path)) {
          return rejectBadFilePath();
        }
        if (content.length > GUEST_FILE_CONTENT_MAX) {
          return Promise.reject(new HostRequestError("FILE_TOO_LARGE", `Content is over ${GUEST_FILE_CONTENT_MAX} characters.`));
        }
        return send({
          channel: OPENCHAMBER_SDK_CHANNEL,
          v: OPENCHAMBER_SDK_API_VERSION,
          type: "file-write",
          id: nextId(ids),
          payload: { path, content }
        }).then((result) => {
          if (!isFileWriteResult(result)) {
            throw new HostRequestError("HOST_REJECTED", "Host did not confirm the write.");
          }
          return result;
        });
      },
      listDir: (path) => (isGuestFilePath(path) ? send({
        channel: OPENCHAMBER_SDK_CHANNEL,
        v: OPENCHAMBER_SDK_API_VERSION,
        type: "file-list",
        id: nextId(ids),
        payload: { path }
      }) : rejectBadFilePath()).then((result) => {
        if (!isFileListResult(result)) {
          throw new HostRequestError("HOST_REJECTED", "Host did not return directory entries.");
        }
        return result;
      }),
      stat: (path) => (isGuestFilePath(path) ? send({
        channel: OPENCHAMBER_SDK_CHANNEL,
        v: OPENCHAMBER_SDK_API_VERSION,
        type: "file-stat",
        id: nextId(ids),
        payload: { path }
      }) : rejectBadFilePath()).then((result) => {
        if (!isFileStatResult(result)) {
          throw new HostRequestError("HOST_REJECTED", "Host did not return file status.");
        }
        return result;
      }),
      generate: (input) => {
        const prompt = input.prompt.trim();
        const system = input.system?.trim();
        if (prompt.length === 0 || prompt.length > GUEST_GENERATE_PROMPT_MAX) {
          return Promise.reject(new HostRequestError("HOST_REJECTED", `Prompt must be 1 to ${GUEST_GENERATE_PROMPT_MAX} characters.`));
        }
        if (system !== void 0 && (system.length === 0 || system.length > GUEST_GENERATE_SYSTEM_MAX)) {
          return Promise.reject(new HostRequestError("HOST_REJECTED", `System prompt must be 1 to ${GUEST_GENERATE_SYSTEM_MAX} characters.`));
        }
        const maxOutputTokens = input.maxOutputTokens === void 0 ? void 0 : Math.min(GUEST_GENERATE_OUTPUT_TOKENS_MAX, Math.max(1, Math.floor(input.maxOutputTokens)));
        if (maxOutputTokens !== void 0 && !Number.isFinite(maxOutputTokens)) {
          return Promise.reject(new HostRequestError("HOST_REJECTED", "maxOutputTokens must be a number."));
        }
        const payload = { prompt };
        if (system !== void 0)
          payload.system = system;
        if (maxOutputTokens !== void 0)
          payload.maxOutputTokens = maxOutputTokens;
        return send({
          channel: OPENCHAMBER_SDK_CHANNEL,
          v: OPENCHAMBER_SDK_API_VERSION,
          type: "generate",
          id: nextId(ids),
          payload
        }, options.requestTimeoutMs ?? GUEST_GENERATE_TIMEOUT_MS).then((result) => {
          if (!isGenerateResult(result)) {
            throw new HostRequestError("HOST_REJECTED", "Host did not return generated text.");
          }
          return result;
        });
      },
      setBadge: (count) => request({
        channel: OPENCHAMBER_SDK_CHANNEL,
        v: OPENCHAMBER_SDK_API_VERSION,
        type: "badge",
        id: nextId(ids),
        payload: { count: clampBadgeCount(count) }
      }),
      dispose: () => {
        for (const subscriptionId of workspaceListeners.keys()) {
          post({ ...envelope, type: "workspace-unsubscribe", id: nextId(ids), payload: { subscriptionId } });
        }
        workspaceListeners.clear();
        disposed = true;
        resolveHandler = null;
        actionHandler = null;
        target.removeEventListener("message", onMessage);
        for (const waiter of pending.values()) {
          clearTimeout(waiter.timer);
          waiter.reject(new HostRequestError("HOST_UNAVAILABLE", "Host client was disposed."));
        }
        pending.clear();
        readyListeners.clear();
        directoryListeners.clear();
        sessionListeners.clear();
        lifecycleListeners.clear();
        connectionListeners.clear();
        settingsListeners.clear();
        itemListeners.clear();
      }
    };
  };

  // ../../../usr/local/lib/node_modules/@openchamber/web/node_modules/@openchamber/sdk/dist/ui/theme.js
  var TOKEN_VARS = [
    ["--oc-bg", "background"],
    ["--oc-elevated", "elevated"],
    ["--oc-fg", "foreground"],
    ["--oc-muted", "muted"],
    ["--oc-subtle", "subtle"],
    ["--oc-border", "border"],
    ["--oc-hover", "hover"],
    ["--oc-selection", "selection"],
    ["--oc-focus", "focus"],
    ["--oc-primary", "primary"],
    ["--oc-muted-surface", "mutedSurface"],
    ["--oc-elevated-fg", "elevatedForeground"],
    ["--oc-active", "active"],
    ["--oc-selection-fg", "selectionForeground"],
    ["--oc-primary-fg", "primaryForeground"],
    ["--oc-primary-text", "primaryText"],
    ["--oc-success-text", "successText"],
    ["--oc-warning-text", "warningText"],
    ["--oc-error-text", "errorText"],
    ["--oc-info-text", "infoText"],
    ["--oc-success", "success"],
    ["--oc-warning", "warning"],
    ["--oc-error", "error"],
    ["--oc-info", "info"],
    ["--oc-font", "font"],
    ["--oc-mono", "mono"],
    ["--oc-radius", "radius"],
    ["--surface-background", "background"],
    ["--surface-elevated", "elevated"],
    ["--surface-foreground", "foreground"],
    ["--surface-muted-foreground", "muted"],
    ["--surface-subtle", "subtle"],
    ["--interactive-border", "border"],
    ["--interactive-hover", "hover"],
    ["--interactive-selection", "selection"],
    ["--interactive-focus-ring", "focus"],
    ["--primary", "primary"],
    ["--surface-muted", "mutedSurface"],
    ["--surface-elevated-foreground", "elevatedForeground"],
    ["--interactive-active", "active"],
    ["--interactive-selection-foreground", "selectionForeground"],
    ["--primary-foreground", "primaryForeground"],
    ["--primary-text", "primaryText"],
    ["--success-text", "successText"],
    ["--warning-text", "warningText"],
    ["--error-text", "errorText"],
    ["--info-text", "infoText"],
    ["--status-success", "success"],
    ["--status-warning", "warning"],
    ["--status-error", "error"],
    ["--status-info", "info"],
    ["--font-sans", "font"],
    ["--font-mono", "mono"],
    ["--radius", "radius"]
  ];
  var applyHostTheme = (theme, root) => {
    root.style.colorScheme = theme.mode;
    for (const [name, key] of TOKEN_VARS) {
      root.style.setProperty(name, theme.tokens[key]);
    }
    root.style.setProperty("font-family", theme.tokens.font);
    root.style.setProperty("font-size", "0.875rem");
    root.style.setProperty("line-height", "1.45");
    root.style.setProperty("color", theme.tokens.foreground);
  };
  var applyHostReady = (ctx, root) => {
    applyHostTheme(ctx.theme, root);
    if (root.dataset) {
      root.dataset.ocSurface = ctx.surface;
      root.dataset.ocTheme = ctx.theme.mode;
    }
  };

  // ../../../usr/local/lib/node_modules/@openchamber/web/node_modules/@openchamber/sdk/dist/ui/style.js
  var OC_ALIAS = {
    "surface-background": "bg",
    "surface-elevated": "elevated",
    "surface-elevated-foreground": "elevated-fg",
    "surface-foreground": "fg",
    "surface-muted-foreground": "muted",
    "surface-muted": "muted-surface",
    "surface-subtle": "subtle",
    "interactive-border": "border",
    "interactive-hover": "hover",
    "interactive-active": "active",
    "interactive-selection": "selection",
    "interactive-selection-foreground": "selection-fg",
    "interactive-focus-ring": "focus",
    "primary": "primary",
    "primary-foreground": "primary-fg",
    "primary-text": "primary-text",
    "success-text": "success-text",
    "warning-text": "warning-text",
    "error-text": "error-text",
    "info-text": "info-text",
    "status-success": "success",
    "status-warning": "warning",
    "status-error": "error",
    "status-info": "info",
    "font-sans": "font",
    "font-mono": "mono",
    "radius": "radius"
  };
  var v = (name, fallback) => `var(--${name}, var(--oc-${OC_ALIAS[name]}, ${fallback}))`;
  var bg = v("surface-background", "transparent");
  var elevated = v("surface-elevated", "transparent");
  var elevatedFg = v("surface-elevated-foreground", "inherit");
  var fg = v("surface-foreground", "inherit");
  var muted = v("surface-muted-foreground", "gray");
  var secondary = v("surface-muted", "transparent");
  var border = v("interactive-border", "currentColor");
  var hover = v("interactive-hover", "transparent");
  var active = v("interactive-active", "transparent");
  var selection = v("interactive-selection", "transparent");
  var selectionFg = v("interactive-selection-foreground", "inherit");
  var focus = v("interactive-focus-ring", "currentColor");
  var primary = v("primary", "currentColor");
  var primaryText = v("primary-text", "inherit");
  var errorText = v("error-text", "inherit");
  var font = v("font-sans", "inherit");
  var mono = v("font-mono", "monospace");
  var radius = v("radius", "9px");
  var mix = (color, pct, base = "transparent") => `color-mix(in srgb, ${color} ${pct}%, ${base})`;
  var focusRing = `box-shadow: 0 0 0 2px ${focus};`;
  var tone = (name) => {
    const color = v(`status-${name}`, "currentColor");
    return `
.oc-sdk[data-tone="${name}"], .oc-sdk [data-tone="${name}"] { --oc-sdk-tone: ${color}; --oc-sdk-tone-text: ${v(`${name}-text`, "inherit")}; }`;
  };
  var UI_CSS = `
${GUEST_SCROLLBAR_CSS}
.oc-sdk { box-sizing: border-box; color: ${fg}; font-family: ${font}; font-size: 0.875rem; line-height: 1.45; }
.oc-sdk *, .oc-sdk *::before, .oc-sdk *::after { box-sizing: border-box; }
/* :where() keeps the reset at zero specificity so every primitive class below overrides it. */
:where(.oc-sdk) :where(button, input, textarea), :where(button.oc-sdk, input.oc-sdk, textarea.oc-sdk) { font: inherit; color: inherit; margin: 0; }
:where(.oc-sdk) :where(button), :where(button.oc-sdk) { cursor: pointer; background: none; border: 0; padding: 0; }
.oc-sdk button:disabled, button.oc-sdk:disabled, .oc-sdk[aria-disabled="true"], .oc-sdk [aria-disabled="true"] { opacity: .5; pointer-events: none; }
.oc-sdk :focus-visible { outline: none; ${focusRing} }
.oc-sdk-mono { font-family: ${mono}; }
.oc-sdk-muted { color: ${muted}; }
${tone("success")}${tone("warning")}${tone("error")}${tone("info")}
.oc-sdk[data-tone="primary"], .oc-sdk [data-tone="primary"] { --oc-sdk-tone: ${primary}; --oc-sdk-tone-text: ${primaryText}; }

.oc-sdk-btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; height: 36px; padding: 0 14px; border: 1px solid transparent; border-radius: ${radius}; font-size: 0.875rem; font-weight: 500; line-height: 1; white-space: nowrap; transition: background 150ms ease-out, color 150ms ease-out; }
.oc-sdk-btn[data-size="sm"] { height: 32px; padding: 0 10px; font-size: 0.8125rem; }
.oc-sdk-btn[data-size="xs"] { height: 24px; padding: 0 8px; font-size: 0.75rem; border-radius: 6px; }
.oc-sdk-btn[data-variant="default"] { color: ${primaryText}; background: ${mix(primary, 10, bg)}; border-color: ${mix(primary, 12)}; }
.oc-sdk-btn[data-variant="default"]:hover { background: ${mix(primary, 16, bg)}; }
.oc-sdk-btn[data-variant="default"]:active { background: ${mix(primary, 22, bg)}; }
.oc-sdk-btn[data-variant="secondary"] { background: ${secondary}; color: var(--oc-fg); }
.oc-sdk-btn[data-variant="secondary"]:hover { background-image: linear-gradient(${hover}, ${hover}); }
.oc-sdk-btn[data-variant="secondary"]:active { background-image: linear-gradient(${active}, ${active}); }
.oc-sdk-btn[data-variant="outline"] { background: ${elevated}; color: ${elevatedFg}; border-color: ${border}; }
.oc-sdk-btn[data-variant="outline"]:hover { background-image: linear-gradient(${hover}, ${hover}); }
.oc-sdk-btn[data-variant="outline"]:active { background-image: linear-gradient(${active}, ${active}); }
.oc-sdk-btn[data-variant="ghost"] { background: transparent; }
.oc-sdk-btn[data-variant="ghost"]:hover { background: ${hover}; }
.oc-sdk-btn[data-variant="ghost"]:active { background: ${active}; }
.oc-sdk-btn[data-variant="destructive"] { --oc-sdk-tone: ${v("status-error", "red")}; color: ${errorText}; background: ${mix("var(--oc-sdk-tone)", 7, bg)}; border-color: ${mix("var(--oc-sdk-tone)", 12)}; }
.oc-sdk-btn[data-variant="destructive"]:hover { background: ${mix("var(--oc-sdk-tone)", 9, bg)}; }
.oc-sdk-btn[data-variant="destructive"]:active { background: ${mix("var(--oc-sdk-tone)", 11, bg)}; }
.oc-sdk-btn[data-loading="true"] { opacity: .5; pointer-events: none; }
.oc-sdk-btn > .oc-sdk-spinner-ring { width: 14px; height: 14px; }

.oc-sdk-field { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.oc-sdk-field-label { font-size: 0.8125rem; font-weight: 500; }
.oc-sdk-field-note { font-size: 0.75rem; color: ${muted}; }
.oc-sdk-field[data-invalid="true"] .oc-sdk-field-note { color: ${errorText}; }
.oc-sdk-input { display: block; width: 100%; min-width: 0; height: 36px; padding: 0 12px; border: 0; border-radius: ${radius}; background: ${elevated}; color: ${elevatedFg}; font-size: 0.875rem; line-height: 1.45; appearance: none; box-shadow: inset 0 0 0 1px ${mix(border, 60)}; transition: background 150ms ease-out, box-shadow 150ms ease-out; }
textarea.oc-sdk-input { height: auto; padding: 8px 12px; resize: vertical; }
.oc-sdk-input::placeholder { color: ${muted}; }
.oc-sdk-input:hover:not(:focus) { background-image: linear-gradient(${hover}, ${hover}); }
.oc-sdk-input:focus, .oc-sdk-input:focus-visible { box-shadow: inset 0 0 0 2px ${focus}; }
.oc-sdk-field[data-invalid="true"] .oc-sdk-input { box-shadow: inset 0 0 0 1px ${v("status-error", "red")}; }
.oc-sdk-field[data-invalid="true"] .oc-sdk-input:focus { box-shadow: inset 0 0 0 2px ${v("status-error", "red")}; }
.oc-sdk-input[data-mono="true"] { font-family: ${mono}; }

.oc-sdk-search { position: relative; min-width: 0; }
.oc-sdk-search .oc-sdk-input { padding-left: 34px; padding-right: 34px; }
.oc-sdk-search-icon { position: absolute; left: 11px; top: 50%; transform: translateY(-50%); color: ${muted}; pointer-events: none; }
.oc-sdk-search[data-active="true"] .oc-sdk-search-icon { color: ${primary}; }
.oc-sdk-search-clear { position: absolute; right: 6px; top: 50%; transform: translateY(-50%); display: none; align-items: center; justify-content: center; width: 24px; height: 24px; border-radius: 6px; color: ${muted}; }
.oc-sdk-search[data-active="true"] .oc-sdk-search-clear { display: inline-flex; }
.oc-sdk-search-clear:hover { background: ${hover}; color: ${fg}; }

.oc-sdk-select { position: relative; display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.oc-sdk-trigger { display: inline-flex; align-items: center; gap: 6px; width: 100%; min-width: 0; height: 32px; padding: 0 8px 0 10px; border: 1px solid ${border}; border-radius: 6px; background: ${elevated}; color: ${elevatedFg}; font-size: 0.8125rem; text-align: left; transition: background 150ms ease-out; }
.oc-sdk-trigger:hover { background-image: linear-gradient(${hover}, ${hover}); }
.oc-sdk-trigger[aria-expanded="true"] { background-image: linear-gradient(${active}, ${active}); }
.oc-sdk-trigger-value { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.oc-sdk-trigger-value[data-empty="true"] { color: ${muted}; }
.oc-sdk-trigger-chevron { flex: 0 0 auto; color: ${muted}; }
.oc-sdk-popup { --surface-foreground: ${elevatedFg}; position: fixed; z-index: 50; display: flex; flex-direction: column; gap: 2px; min-width: 160px; max-width: calc(100vw - 16px); max-height: min(320px, calc(100vh - 16px)); overflow: auto; padding: 4px; border: 1px solid ${mix(border, 60)}; border-radius: 12px; background: ${elevated}; color: ${elevatedFg}; box-shadow: 0 8px 24px ${mix(fg, 12)}; }
.oc-sdk-popup-search { flex: 0 0 auto; padding: 2px 2px 4px; }
.oc-sdk-popup-search .oc-sdk-input { height: 32px; font-size: 0.8125rem; }
.oc-sdk-option { display: flex; align-items: center; gap: 8px; width: 100%; padding: 6px 8px; border-radius: 8px; font-size: 0.8125rem; text-align: left; }
.oc-sdk-option[data-active="true"] { background: ${hover}; }
.oc-sdk-option[aria-selected="true"] { background: ${selection}; color: ${selectionFg}; }
.oc-sdk-option[data-destructive="true"] { color: ${errorText}; }
.oc-sdk-option[data-destructive="true"][data-active="true"] { background: ${mix(v("status-error", "red"), 10)}; }
.oc-sdk-option-label { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.oc-sdk-option-hint { flex: 0 0 auto; font-size: 0.75rem; color: ${muted}; }
.oc-sdk-option-check { flex: 0 0 auto; width: 12px; }
.oc-sdk-popup-empty { padding: 8px; font-size: 0.8125rem; color: ${muted}; }

.oc-sdk-check { display: inline-flex; align-items: flex-start; gap: 8px; width: 100%; text-align: left; }
.oc-sdk-check-box { flex: 0 0 auto; display: inline-flex; align-items: center; justify-content: center; width: 14px; height: 14px; margin-top: 3px; border: 1px solid ${border}; border-radius: 4px; color: ${primary}; transition: border-color 150ms ease-out; }
.oc-sdk-check[aria-checked="true"] .oc-sdk-check-box { border-color: ${mix(primary, 65, border)}; }
.oc-sdk-check-box > svg { display: none; }
.oc-sdk-check[aria-checked="true"] .oc-sdk-check-box > svg { display: block; }
.oc-sdk-check-thumb { flex: 0 0 auto; position: relative; width: 36px; height: 20px; border-radius: 9999px; background: ${border}; transition: background 150ms ease-out; }
.oc-sdk-check-thumb::after { content: ""; position: absolute; top: 2px; left: 2px; width: 16px; height: 16px; border-radius: 9999px; background: ${bg}; transition: transform 150ms ease-out; }
.oc-sdk-check[aria-checked="true"] .oc-sdk-check-thumb { background: ${primary}; }
.oc-sdk-check[aria-checked="true"] .oc-sdk-check-thumb::after { transform: translateX(16px); }
.oc-sdk-check:focus-visible { box-shadow: none; }
.oc-sdk-check:focus-visible .oc-sdk-check-box, .oc-sdk-check:focus-visible .oc-sdk-check-thumb { ${focusRing} }
.oc-sdk-check-text { display: flex; flex-direction: column; min-width: 0; }
.oc-sdk-check-label { font-size: 0.875rem; }
.oc-sdk-check-desc { font-size: 0.75rem; color: ${muted}; }

.oc-sdk-tabs { display: inline-flex; gap: 2px; padding: 2px; border-radius: 10px; max-width: 100%; overflow: auto; }
.oc-sdk-tabs[data-track="true"] { background: ${mix(fg, 4)}; }
.oc-sdk-tab { display: inline-flex; align-items: center; gap: 6px; height: 28px; padding: 0 10px; border: 1px solid transparent; border-radius: 8px; font-size: 0.8125rem; font-weight: 500; color: ${muted}; white-space: nowrap; transition: color 150ms ease-out, background 150ms ease-out; }
.oc-sdk-tab:hover { color: ${fg}; }
.oc-sdk-tab[aria-selected="true"] { color: ${selectionFg}; background: ${selection}; border-color: ${border}; }
.oc-sdk-tab-count { font-size: 0.75rem; font-variant-numeric: tabular-nums; color: ${muted}; }

.oc-sdk-badge { display: inline-flex; align-items: center; padding: 1px 6px; border-radius: 9999px; font-size: 11px; font-weight: 500; line-height: 16px; white-space: nowrap; background: ${hover}; color: ${muted}; }
.oc-sdk-badge[data-tone] { color: var(--oc-sdk-tone-text, var(--oc-sdk-tone)); background: ${mix("var(--oc-sdk-tone)", 15)}; }

.oc-sdk-list { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
.oc-sdk-row { display: flex; align-items: center; gap: 8px; width: 100%; padding: 6px 8px; border-radius: 6px; text-align: left; transition: background 120ms ease-out; }
.oc-sdk-row:hover, .oc-sdk-row[data-active="true"] { background: ${hover}; }
.oc-sdk-row[aria-selected="true"] { background: ${selection}; color: ${selectionFg}; }
.oc-sdk-row-lead { flex: 0 0 auto; width: 64px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-family: ${mono}; font-size: 0.75rem; color: ${muted}; }
.oc-sdk-row-main { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; }
.oc-sdk-row-title { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.oc-sdk-row-sub { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 0.75rem; color: ${muted}; }
.oc-sdk-row-meta { flex: 0 0 auto; font-size: 0.75rem; font-variant-numeric: tabular-nums; color: ${muted}; }
.oc-sdk-row[aria-selected="true"] .oc-sdk-row-lead, .oc-sdk-row[aria-selected="true"] .oc-sdk-row-sub, .oc-sdk-row[aria-selected="true"] .oc-sdk-row-meta { color: inherit; opacity: .75; }
.oc-sdk-list-empty { padding: 16px 8px; text-align: center; font-size: 0.8125rem; color: ${muted}; }

.oc-sdk-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; padding: 40px 16px; text-align: center; }
.oc-sdk-empty-title { margin: 0; font-size: 0.8125rem; font-weight: 600; }
.oc-sdk-empty-body { margin: 0; max-width: 32rem; font-size: 0.8125rem; color: ${muted}; }
.oc-sdk-empty-action { margin-top: 12px; }

@keyframes oc-sdk-spin { to { transform: rotate(360deg); } }
.oc-sdk-spinner { display: inline-flex; align-items: center; gap: 8px; font-size: 0.8125rem; color: ${muted}; }
.oc-sdk-spinner-ring { width: 16px; height: 16px; border: 2px solid ${border}; border-top-color: ${primary}; border-radius: 9999px; animation: oc-sdk-spin .8s linear infinite; }
.oc-sdk-spinner[data-size="sm"] .oc-sdk-spinner-ring { width: 12px; height: 12px; }

.oc-sdk-banner { display: flex; align-items: flex-start; gap: 12px; padding: 8px 12px; border: 1px solid ${mix("var(--oc-sdk-tone)", 40)}; border-radius: 8px; background: ${mix("var(--oc-sdk-tone)", 10)}; }
.oc-sdk-banner-text { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.oc-sdk-banner-title { font-size: 0.8125rem; font-weight: 500; color: var(--oc-sdk-tone-text, var(--oc-sdk-tone)); }
.oc-sdk-banner-body { font-size: 0.8125rem; color: ${muted}; }
.oc-sdk-banner-action { flex: 0 0 auto; }

.oc-sdk-separator { display: flex; align-items: center; gap: 8px; width: 100%; margin: 8px 0; font-size: 0.75rem; color: ${muted}; }
.oc-sdk-separator::before, .oc-sdk-separator::after { content: ""; flex: 1 1 auto; height: 1px; background: ${mix(border, 40)}; }
.oc-sdk-separator[data-labeled="false"]::after { display: none; }
.oc-sdk-popup > .oc-sdk-separator { margin: 4px 0; }

.oc-sdk-progress { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.oc-sdk-progress-label { display: flex; justify-content: space-between; font-size: 0.75rem; color: ${muted}; font-variant-numeric: tabular-nums; }
.oc-sdk-progress-track { height: 6px; border-radius: 9999px; background: ${border}; overflow: hidden; }
.oc-sdk-progress-fill { height: 100%; border-radius: 9999px; background: var(--oc-sdk-tone, ${primary}); transform-origin: left; transition: transform 200ms ease-out; }

.oc-sdk-menu { position: relative; display: inline-flex; }

.oc-sdk-text { white-space: pre-wrap; overflow-wrap: anywhere; }
.oc-sdk-text a { color: ${primaryText}; text-decoration: underline; text-underline-offset: 2px; }
.oc-sdk-text img { display: block; max-width: 100%; margin: 8px 0; border-radius: 8px; border: 1px solid ${mix(border, 60)}; }
`;

  // panel/main.ts
  function extractWorktreeName(wt) {
    if (!wt) return "";
    if (typeof wt === "string") return wt;
    if (typeof wt === "object") {
      return wt.name || wt.branch || wt.directory || "";
    }
    return "";
  }
  var logEntries = [];
  function addLog(msg, level = "info") {
    const d = /* @__PURE__ */ new Date();
    const timeStr = d.toTimeString().split(" ")[0] + "." + String(d.getMilliseconds()).padStart(3, "0");
    logEntries.push({ time: timeStr, msg, level });
    if (logEntries.length > 200) logEntries.shift();
    if (level === "error") console.error(`[TaskBoard] ${msg}`);
    else if (level === "warn") console.warn(`[TaskBoard] ${msg}`);
    else console.log(`[TaskBoard] ${msg}`);
    const streamEl = document.getElementById("logStream");
    if (streamEl) {
      const line = document.createElement("div");
      line.className = "log-line";
      line.innerHTML = `
      <span class="log-time">${timeStr}</span>
      <span class="log-msg-${level}">${escapeHtml(msg)}</span>
    `;
      streamEl.appendChild(line);
      streamEl.scrollTop = streamEl.scrollHeight;
    }
  }
  var host = connectHost();
  var currentProject = null;
  var currentDirectory = "";
  var currentRepo = "";
  var allProjects = [];
  var isDiscoveringRepos = false;
  var issues = [];
  var sessions = [];
  var worktrees = [];
  var activeIssue = null;
  var searchQuery = "";
  var activeTab = "all";
  var userSelectedTab = false;
  var showArchivedOnly = false;
  var currentSort = "newest";
  var filterPriority = "all";
  var filterTag = "all";
  var currentGroupBy = "status";
  var isFilterBarOpen = false;
  var selectedIssueNumbers = /* @__PURE__ */ new Set();
  var userLayoutPreference = "auto";
  var isWideScreen = false;
  var draggedIssueNumber = null;
  var isLoading = false;
  function selectTab(tabId) {
    activeTab = tabId;
    const bar = document.getElementById("statusTabBar");
    if (bar) {
      bar.querySelectorAll(".status-tab").forEach((tab) => {
        if (tab.getAttribute("data-tab") === tabId) {
          tab.classList.add("active");
        } else {
          tab.classList.remove("active");
        }
      });
    }
  }
  var elBtnRepoSelect = document.getElementById("btnRepoSelect");
  var elTxtRepoLabel = document.getElementById("txtRepoLabel");
  var elRepoPopover = document.getElementById("repoPopover");
  var elDetectedReposList = document.getElementById("detectedReposList");
  var elInputCustomRepo = document.getElementById("inputCustomRepo");
  var elBtnSaveCustomRepo = document.getElementById("btnSaveCustomRepo");
  var elSearchInput = document.getElementById("searchInput");
  var elBtnLayoutToggle = document.getElementById("btnLayoutToggle");
  var elBtnRefresh = document.getElementById("btnRefresh");
  var elIconRefresh = document.getElementById("iconRefresh");
  var elBtnNewIssue = document.getElementById("btnNewIssue");
  var elBtnLogsToggle = document.getElementById("btnLogsToggle");
  var elBtnFilterToggle = document.getElementById("btnFilterToggle");
  var elFilterBar = document.getElementById("filterBar");
  var elSelectSort = document.getElementById("selectSort");
  var elSelectGroupBy = document.getElementById("selectGroupBy");
  var elSelectFilterPriority = document.getElementById("selectFilterPriority");
  var elSelectFilterTag = document.getElementById("selectFilterTag");
  var elBtnStartTagIssues = document.getElementById("btnStartTagIssues");
  var elBtnResetFilters = document.getElementById("btnResetFilters");
  var elBatchActionBar = document.getElementById("batchActionBar");
  var elBatchCountBadge = document.getElementById("batchCountBadge");
  var elBtnBatchPackage = document.getElementById("btnBatchPackage");
  var elBtnBatchStart = document.getElementById("btnBatchStart");
  var elBtnBatchAttach = document.getElementById("btnBatchAttach");
  var elBtnBatchDeselect = document.getElementById("btnBatchDeselect");
  var elStatusTabBar = document.getElementById("statusTabBar");
  var elListViewContainer = document.getElementById("listViewContainer");
  var elKanbanViewContainer = document.getElementById("kanbanViewContainer");
  var kanbanCardContainers = {
    "backlog": document.getElementById("kCardsBacklog"),
    "todo": document.getElementById("kCardsTodo"),
    "in-progress": document.getElementById("kCardsProgress"),
    "in-review": document.getElementById("kCardsReview"),
    "done": document.getElementById("kCardsDone")
  };
  var elDrawerScrim = document.getElementById("drawerScrim");
  var elTaskDrawer = document.getElementById("taskDrawer");
  var elBtnDrawerClose = document.getElementById("btnDrawerClose");
  var elDrawerIssueNumber = document.getElementById("drawerIssueNumber");
  var elDrawerIssueAuthor = document.getElementById("drawerIssueAuthor");
  var elDrawerGithubLink = document.getElementById("drawerGithubLink");
  var elBtnDrawerToggleClose = document.getElementById("btnDrawerToggleClose");
  var elDrawerIssueTitle = document.getElementById("drawerIssueTitle");
  var elDrawerPrioritySelect = document.getElementById("drawerPrioritySelect");
  var elDrawerStatusSelect = document.getElementById("drawerStatusSelect");
  var elDrawerComplexitySelect = document.getElementById("drawerComplexitySelect");
  var elDrawerAlignmentWarning = document.getElementById("drawerAlignmentWarning");
  var elDrawerLabelsContainer = document.getElementById("drawerLabelsContainer");
  var elBtnAddLabelToggle = document.getElementById("btnAddLabelToggle");
  var elDrawerAddLabelRow = document.getElementById("drawerAddLabelRow");
  var elInputNewTag = document.getElementById("inputNewTag");
  var elRepoLabelsDatalist = document.getElementById("repoLabelsDatalist");
  var elBtnConfirmAddLabel = document.getElementById("btnConfirmAddLabel");
  var elBtnCancelAddLabel = document.getElementById("btnCancelAddLabel");
  var elDrawerAgentBadge = document.getElementById("drawerAgentBadge");
  var elDrawerWorktreeName = document.getElementById("drawerWorktreeName");
  var elBtnDrawerJumpSession = document.getElementById("btnDrawerJumpSession");
  var elChecklistProgressText = document.getElementById("checklistProgressText");
  var elChecklistProgressFill = document.getElementById("checklistProgressFill");
  var elDrawerChecklistContainer = document.getElementById("drawerChecklistContainer");
  var elInputAddSubtask = document.getElementById("inputAddSubtask");
  var elBtnAddSubtask = document.getElementById("btnAddSubtask");
  var elDrawerDescriptionViewBox = document.getElementById("drawerDescriptionViewBox");
  var elDrawerDescriptionCollapsible = document.getElementById("drawerDescriptionCollapsible");
  var elDrawerDescriptionContent = document.getElementById("drawerDescriptionContent");
  var elDrawerDescriptionToggleRow = document.getElementById("drawerDescriptionToggleRow");
  var elBtnToggleCollapse = document.getElementById("btnToggleCollapse");
  var elDrawerDescriptionEditBox = document.getElementById("drawerDescriptionEditBox");
  var elDrawerDescriptionTextarea = document.getElementById("drawerDescriptionTextarea");
  var elBtnEditDescription = document.getElementById("btnEditDescription");
  var elBtnSaveDescription = document.getElementById("btnSaveDescription");
  var elBtnCancelDescription = document.getElementById("btnCancelDescription");
  var elDrawerCommentsContainer = document.getElementById("drawerCommentsContainer");
  var elCommentCountBadge = document.getElementById("commentCountBadge");
  var elDrawerRelatedIssuesContainer = document.getElementById("drawerRelatedIssuesContainer");
  var elRelatedIssuesCountBadge = document.getElementById("relatedIssuesCountBadge");
  var elBtnDrawerAttachComposer = document.getElementById("btnDrawerAttachComposer");
  var elBtnDrawerArchive = document.getElementById("btnDrawerArchive");
  var elTxtDrawerArchive = document.getElementById("txtDrawerArchive");
  var elBtnDrawerOpenPreflight = document.getElementById("btnDrawerOpenPreflight");
  var elPreflightBackdrop = document.getElementById("preflightModalBackdrop");
  var elModalPreflightTitle = document.getElementById("modalPreflightTitle");
  var elPreflightWorktreeToggle = document.getElementById("preflightWorktreeToggle");
  var elPreflightWorktreeSection = document.getElementById("preflightWorktreeSection");
  var elRadioWorktreeTag = document.getElementById("radioWorktreeTag");
  var elRadioWorktreeIssue = document.getElementById("radioWorktreeIssue");
  var elPreflightTagPreview = document.getElementById("preflightTagPreview");
  var elPreflightIssuePreview = document.getElementById("preflightIssuePreview");
  var elPreflightBranchInput = document.getElementById("preflightBranchInput");
  var elPreflightBaseBranchInput = document.getElementById("preflightBaseBranchInput");
  var elPreflightPromptInput = document.getElementById("preflightPromptInput");
  var elPreflightMoveInProgress = document.getElementById("preflightMoveInProgress");
  var elBtnPreflightCancel = document.getElementById("btnPreflightCancel");
  var elBtnPreflightClose = document.getElementById("btnPreflightClose");
  var elBtnPreflightLaunch = document.getElementById("btnPreflightLaunch");
  var elLogDrawer = document.getElementById("logDrawer");
  var elBtnLogDrawerClose = document.getElementById("btnLogDrawerClose");
  var elBtnCopyLogs = document.getElementById("btnCopyLogs");
  var elBtnClearLogs = document.getElementById("btnClearLogs");
  function showBanner(text, actionLabel, onAction) {
    const elBanner = document.getElementById("boardBanner");
    const elBannerText = document.getElementById("boardBannerText");
    const elBannerActions = document.getElementById("boardBannerActions");
    if (!elBanner || !elBannerText || !elBannerActions) return;
    elBannerText.textContent = text;
    elBannerActions.innerHTML = "";
    if (actionLabel && onAction) {
      const btn = document.createElement("button");
      btn.className = "btn btn-sm btn-primary";
      btn.textContent = actionLabel;
      btn.onclick = onAction;
      elBannerActions.appendChild(btn);
    }
    elBanner.style.display = "flex";
  }
  function hideBanner() {
    const elBanner = document.getElementById("boardBanner");
    if (elBanner) elBanner.style.display = "none";
  }
  var checklistRegex = /^(\s*(?:[-*+]|\d+\.)\s*\[)([ xX])(\]\s+)(.+)$/;
  function parseSubtasks(body) {
    if (!body) return [];
    const lines = body.split("\n");
    const subtasks = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const match = line.match(checklistRegex);
      if (match) {
        subtasks.push({
          id: `task-${i}`,
          lineIndex: i,
          completed: match[2].toLowerCase() === "x",
          text: match[4].trim(),
          rawLine: line
        });
      }
    }
    return subtasks;
  }
  function updateSubtaskInMarkdown(body, lineIndex, completed) {
    const lines = body.split("\n");
    if (lineIndex >= 0 && lineIndex < lines.length) {
      const match = lines[lineIndex].match(checklistRegex);
      if (match) {
        const mark = completed ? "x" : " ";
        lines[lineIndex] = `${match[1]}${mark}${match[3]}${match[4]}`;
      }
    }
    return lines.join("\n");
  }
  function appendSubtaskToMarkdown(body, text) {
    const cleanText = text.trim();
    if (!cleanText) return body;
    const suffix = `
- [ ] ${cleanText}`;
    return body ? `${body.trimEnd()}${suffix}` : `- [ ] ${cleanText}`;
  }
  function slugify(text) {
    return text.toLowerCase().replace(/[^\w\s-]/g, "").trim().replace(/[\s_-]+/g, "-").slice(0, 30);
  }
  function sanitizeHexColor(color) {
    if (!color) return null;
    const clean = color.trim().replace(/^#/, "");
    if (/^[0-9a-fA-F]{3,8}$/.test(clean)) {
      return `#${clean}`;
    }
    return null;
  }
  function escapeHtml(str) {
    return (str || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function parseGitHubRemoteUrl(raw) {
    if (!raw || typeof raw !== "string") return null;
    const val = raw.trim();
    const scpMatch = val.match(/^(?:git@|ssh:\/\/git@)github\.com[:/]([^\s/]+)\/([^\s/.]+?)(\.git)?$/);
    if (scpMatch) return { owner: scpMatch[1], repo: scpMatch[2] };
    try {
      const url = new URL(val);
      if (url.hostname === "github.com") {
        const parts = url.pathname.replace(/^\/+|\.git$/g, "").split("/");
        if (parts.length >= 2 && parts[0] && parts[1]) {
          return { owner: parts[0], repo: parts[1] };
        }
      }
    } catch {
    }
    return null;
  }
  function parseGitRemoteFromConfig(configContent) {
    if (!configContent || typeof configContent !== "string") return null;
    const match = configContent.match(/\[remote\s+["\w-]+\][^\[]*?url\s*=\s*([^\r\n]+)/);
    if (match) {
      return parseGitHubRemoteUrl(match[1]);
    }
    return null;
  }
  var dirGitCache = /* @__PURE__ */ new Map();
  var issueCache = /* @__PURE__ */ new Map();
  var ISSUE_CACHE_TTL_MS = 6e4;
  var unsubSessions = null;
  var unsubWorktrees = null;
  var activeWatchedProjectId = null;
  async function watchActiveProject(projectId) {
    if (activeWatchedProjectId === projectId) return;
    activeWatchedProjectId = projectId;
    if (unsubSessions) {
      unsubSessions();
      unsubSessions = null;
    }
    if (unsubWorktrees) {
      unsubWorktrees();
      unsubWorktrees = null;
    }
    try {
      unsubSessions = await host.onSessions(projectId, (sessSnap) => {
        const prevSessions = sessions;
        sessions = sessSnap.sessions || [];
        renderViews();
        if (activeIssue) renderDrawer(activeIssue);
        const becameIdle = sessions.some((s) => {
          const prev = prevSessions.find((p) => p.id === s.id);
          return s.activity === "idle" && (!prev || prev.activity !== "idle");
        });
        if (becameIdle && currentRepo) {
          issueCache.delete(currentRepo);
          void fetchIssues(true);
        }
      });
      unsubWorktrees = await host.onWorktrees(projectId, (wtSnap) => {
        worktrees = wtSnap.worktrees || [];
      });
    } catch (err) {
      addLog(`Project watcher error on ${projectId}: ${err.message}`, "warn");
    }
  }
  async function inspectGitConfigInDir(dir) {
    const cleanDir = dir.replace(/\/+$/, "");
    if (dirGitCache.has(cleanDir)) {
      return dirGitCache.get(cleanDir);
    }
    let found = null;
    try {
      const res = await host.readFile(`${cleanDir}/.git/config`);
      if (res && res.content) {
        found = parseGitRemoteFromConfig(res.content);
      }
    } catch {
    }
    if (!found) {
      try {
        const gitFileRes = await host.readFile(`${cleanDir}/.git`);
        if (gitFileRes && gitFileRes.content) {
          const match = gitFileRes.content.match(/^gitdir:\s*(.+)$/m);
          if (match) {
            const gitdir = match[1].trim();
            const targetPath = gitdir.startsWith("/") ? gitdir : `${cleanDir}/${gitdir}`;
            try {
              const wtConfig = await host.readFile(`${targetPath}/config`);
              if (wtConfig?.content) {
                found = parseGitRemoteFromConfig(wtConfig.content);
              }
            } catch {
            }
            if (!found) {
              try {
                const parentConfig = await host.readFile(`${targetPath}/../../config`);
                if (parentConfig?.content) {
                  found = parseGitRemoteFromConfig(parentConfig.content);
                }
              } catch {
              }
            }
          }
        }
      } catch {
      }
    }
    dirGitCache.set(cleanDir, found);
    return found;
  }
  async function discoverWorkspaceRepositories() {
    if (isDiscoveringRepos) return;
    isDiscoveringRepos = true;
    addLog("Scanning OpenChamber projects for Git repositories...");
    try {
      const snap = await host.listProjects();
      const rawProjects = snap.projects || [];
      const uniqueProjects = Array.from(new Map(rawProjects.map((p) => [p.id, p])).values());
      const inspected = await Promise.all(
        uniqueProjects.map(async (p) => {
          if (!p.directory) return null;
          const detected = await inspectGitConfigInDir(p.directory);
          const storedLink = await host.storage.get(`repo_${p.id}`);
          const linkedRepo = typeof storedLink === "string" && storedLink.includes("/") ? storedLink.trim() : null;
          return {
            id: p.id,
            name: p.name || p.directory.split("/").pop() || p.id,
            directory: p.directory,
            gitRepo: detected,
            linkedRepo: linkedRepo || (detected ? `${detected.owner}/${detected.repo}` : null)
          };
        })
      );
      allProjects = inspected.filter(Boolean);
      allProjects.forEach((p) => {
        if (p.gitRepo) {
          addLog(`Project "${p.name}" has Git repo: ${p.gitRepo.owner}/${p.gitRepo.repo}`, "succ");
        } else {
          addLog(`Project "${p.name}" (${p.directory}) has no Git remote`, "info");
        }
      });
      renderRepoPopoverList();
      await autoResolveRepoForActiveContext();
    } catch (err) {
      addLog(`Project scan error: ${err.message}`, "warn");
    } finally {
      isDiscoveringRepos = false;
    }
  }
  async function autoResolveRepoForActiveContext() {
    const sorted = [...allProjects].sort((a, b) => (b.directory?.length || 0) - (a.directory?.length || 0));
    let targetProject = sorted.find((p) => {
      if (!p.directory) return false;
      const cleanP = p.directory.replace(/\/+$/, "");
      const cleanT = currentDirectory.replace(/\/+$/, "");
      return cleanP === cleanT || cleanT.startsWith(cleanP + "/");
    }) || (allProjects.length > 0 ? allProjects[0] : null);
    currentProject = targetProject || null;
    if (!targetProject) {
      elTxtRepoLabel.textContent = "Select Repo";
      return;
    }
    void watchActiveProject(targetProject.id);
    addLog(`Active conversation project: "${targetProject.name}" (${targetProject.directory})`);
    if (currentDirectory) {
      const dirRemote = await inspectGitConfigInDir(currentDirectory);
      if (dirRemote) {
        const full = `${dirRemote.owner}/${dirRemote.repo}`;
        targetProject.gitRepo = dirRemote;
        targetProject.linkedRepo = full;
        setRepository(full, `directory: ${targetProject.name}`);
        return;
      }
    }
    if (targetProject.gitRepo) {
      const full = `${targetProject.gitRepo.owner}/${targetProject.gitRepo.repo}`;
      setRepository(full, `project-git: ${targetProject.name}`);
      return;
    }
    const storedLink = await host.storage.get(`repo_${targetProject.id}`);
    if (typeof storedLink === "string" && storedLink.includes("/")) {
      setRepository(storedLink.trim(), `stored-project-link: ${targetProject.name}`);
      return;
    }
    if (sessions && sessions.length > 0) {
      for (const sess of sessions) {
        if (sess.items) {
          for (const it of sess.items) {
            if (it.url && it.url.includes("github.com/")) {
              const m = it.url.match(/github\.com\/([^\/]+)\/([^\/]+)/);
              if (m) {
                setRepository(`${m[1]}/${m[2]}`, `session-item: ${sess.title}`);
                return;
              }
            }
          }
        }
      }
    }
    elTxtRepoLabel.textContent = `${targetProject.name} (No Repo)`;
    elTxtRepoLabel.title = `Project "${targetProject.name}" has no GitHub repository linked. Click to link.`;
    const otherRepos = allProjects.filter((p) => p.linkedRepo || p.gitRepo);
    const actionText = otherRepos.length > 0 ? `Project "${targetProject.name}" has no Git remote. Click to choose or link:` : `Project "${targetProject.name}" has no Git remote. Enter a repository:`;
    showBanner(actionText, "Select Repo", () => {
      openRepoPopover();
    });
    renderEmptyState(`No GitHub repository linked to project "${targetProject.name}". Click "Select Repo" above to link a repository.`);
  }
  function setRepository(repo, source, force = false) {
    if (!force && currentRepo === repo) {
      return;
    }
    userSelectedTab = false;
    currentRepo = repo;
    elTxtRepoLabel.textContent = repo.split("/")[1] || repo;
    elTxtRepoLabel.title = `Project: ${currentProject?.name || "Workspace"} \u2022 Repo: ${repo} (via ${source})`;
    addLog(`Switched repository to ${repo} [${source}]`, "succ");
    hideBanner();
    void host.storage.set("selected_repo", repo);
    if (currentProject) {
      void host.storage.set(`repo_${currentProject.id}`, repo);
      currentProject.linkedRepo = repo;
    }
    if (!elRepoPopover.classList.contains("active")) {
      renderRepoPopoverList();
    }
    void fetchIssues();
  }
  function renderRepoPopoverList() {
    if (allProjects.length === 0) {
      elDetectedReposList.innerHTML = `
      <div style="padding: 10px; color: var(--fg-faint); font-size: 11px;">
        No workspace projects found. Enter custom repo below.
      </div>
    `;
      return;
    }
    elDetectedReposList.innerHTML = allProjects.map((p) => {
      const isCurrentProject = p.id === currentProject?.id;
      const repoName = p.linkedRepo || (p.gitRepo ? `${p.gitRepo.owner}/${p.gitRepo.repo}` : null);
      const isSelectedRepo = repoName && repoName === currentRepo;
      return `
        <div class="popover-item" data-project-id="${escapeHtml(p.id)}" data-repo="${escapeHtml(repoName || "")}">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div style="display: flex; align-items: center; gap: 5px;">
              <span class="popover-item-title">${escapeHtml(p.name)}</span>
              ${isCurrentProject ? '<span class="status-pill" style="font-size: 9px; padding: 0 4px;">active</span>' : ""}
            </div>
            ${isSelectedRepo ? '<span style="color: var(--succ); font-size: 11px; font-weight: 500;">[active]</span>' : ""}
          </div>
          <span class="popover-item-sub">${repoName ? escapeHtml(repoName) : '<span style="color: var(--warn); font-style: italic;">No repo linked \u2022 click to link</span>'}</span>
        </div>
      `;
    }).join("");
    elDetectedReposList.querySelectorAll(".popover-item").forEach((item) => {
      item.addEventListener("click", async () => {
        const projId = item.getAttribute("data-project-id");
        const repo = item.getAttribute("data-repo");
        const proj = allProjects.find((p) => p.id === projId);
        if (repo) {
          if (currentProject) {
            await host.storage.set(`repo_${currentProject.id}`, repo);
            currentProject.linkedRepo = repo;
          }
          setRepository(repo, `selected from ${proj?.name || "project"}`);
          closeRepoPopover();
        } else {
          const entered = window.prompt(`Enter GitHub repository (owner/repo) to link to project "${proj?.name || "project"}":`);
          if (entered && entered.includes("/")) {
            const clean = entered.trim();
            if (proj) {
              proj.linkedRepo = clean;
              await host.storage.set(`repo_${proj.id}`, clean);
            }
            if (currentProject && currentProject.id === proj?.id) {
              setRepository(clean, `linked-to-${proj?.name}`);
            } else {
              renderRepoPopoverList();
            }
            closeRepoPopover();
          }
        }
      });
    });
  }
  function openRepoPopover() {
    elRepoPopover.classList.add("active");
  }
  function closeRepoPopover() {
    elRepoPopover.classList.remove("active");
  }
  var workspaceGitToken = null;
  async function getWorkspaceGitToken() {
    if (workspaceGitToken) return workspaceGitToken;
    try {
      const creds = await host.readFile("/workspace/.git-credentials");
      if (creds && creds.content) {
        const match = creds.content.match(/https:\/\/(?:[^:]+?:)?(gh[pousr]_[A-Za-z0-9_]+)@github\.com/) || creds.content.match(/gh[pousr]_[A-Za-z0-9_]+/);
        if (match) {
          workspaceGitToken = match[1] || match[0];
          addLog("Loaded authenticated GitHub PAT from workspace credentials", "succ");
          return workspaceGitToken;
        }
      }
    } catch {
    }
    try {
      const cfg = await host.readFile("/workspace/.gitconfig");
      if (cfg && cfg.content) {
        const match = cfg.content.match(/gh[pousr]_[A-Za-z0-9_]+/);
        if (match) {
          workspaceGitToken = match[0];
          return workspaceGitToken;
        }
      }
    } catch {
    }
    return null;
  }
  async function githubRequest(method, path, body, query) {
    addLog(`API ${method} ${path}`);
    const pat = await getWorkspaceGitToken() || await host.storage.get("custom_github_token");
    if (pat && typeof pat === "string") {
      try {
        const url = new URL(path, "https://api.github.com/");
        if (query) {
          Object.entries(query).forEach(([k, v2]) => url.searchParams.set(k, v2));
        }
        const directRes = await fetch(url.toString(), {
          method,
          headers: {
            "Accept": "application/vnd.github.v3+json",
            "Authorization": `Bearer ${pat.trim()}`,
            ...body ? { "Content-Type": "application/json" } : {}
          },
          body: body ? JSON.stringify(body) : void 0
        });
        if (directRes.ok) {
          addLog(`API ${method} ${path} -> ${directRes.status} OK (via workspace PAT)`, "succ");
          hideBanner();
          return directRes.json();
        }
        addLog(`PAT request returned HTTP ${directRes.status}, attempting host proxy...`, "warn");
      } catch (err) {
        addLog(`Direct PAT fetch failed (${err.message}), falling back to host proxy...`, "warn");
      }
    }
    try {
      const res = await host.request({
        method,
        path,
        query,
        body: body ? JSON.stringify(body) : void 0
      });
      if (res.status >= 200 && res.status < 300) {
        addLog(`API ${method} ${path} -> ${res.status}`, "succ");
        hideBanner();
        return typeof res.body === "string" ? JSON.parse(res.body) : res.body;
      }
      if (res.status === 401 || res.status === 403) {
        addLog(`API auth error HTTP ${res.status}: OAuth access restricted or missing`, "error");
        showBanner(
          "GitHub authentication required. Please connect in Settings \u2192 Integrations or enter a Personal Access Token.",
          "Enter Token",
          promptCustomToken
        );
        throw new Error(`GitHub auth failed (${res.status})`);
      }
      throw new Error(`GitHub API error: ${res.status}`);
    } catch (err) {
      addLog(`GitHub request failed: ${err.message}`, "error");
      if (err.message && (err.message.includes("NO_INTEGRATION") || err.message.includes("DISCONNECTED"))) {
        showBanner(
          "GitHub integration is not connected. Open Settings \u2192 Integrations or enter a token directly.",
          "Enter Token",
          promptCustomToken
        );
      }
      throw err;
    }
  }
  async function promptCustomToken() {
    const token = window.prompt("Enter GitHub Personal Access Token (with repo access):");
    if (token && token.trim()) {
      await host.storage.set("custom_github_token", token.trim());
      await host.toast({ kind: "success", message: "Saved token! Refreshing..." });
      void fetchIssues();
    }
  }
  async function fetchIssues(force = false) {
    if (!currentRepo) return;
    if (!force && issueCache.has(currentRepo)) {
      const cached = issueCache.get(currentRepo);
      if (Date.now() - cached.timestamp < ISSUE_CACHE_TTL_MS) {
        issues = cached.issues;
        if (!userSelectedTab) {
          selectTab(resolveDefaultTab(issues));
        }
        renderViews();
        addLog(`Rendered ${issues.length} issues from cache for ${currentRepo}`);
        return;
      }
    }
    isLoading = true;
    if (elIconRefresh) elIconRefresh.style.animation = "spin 1s linear infinite";
    try {
      addLog(`Fetching issues for ${currentRepo}...`);
      const res = await githubRequest(
        "GET",
        `/search/issues?q=repo:${currentRepo}+is:issue&sort=updated&per_page=100`
      );
      const rawIssues = res.items || (Array.isArray(res) ? res : []);
      issues = rawIssues.filter((item) => !item.pull_request).map((item) => ({
        number: item.number,
        title: item.title,
        body: item.body || "",
        state: item.state,
        html_url: item.html_url,
        labels: item.labels || [],
        user: item.user,
        assignees: item.assignees || [],
        comments: item.comments || 0,
        created_at: item.created_at,
        subtasks: parseSubtasks(item.body || "")
      }));
      issueCache.set(currentRepo, {
        timestamp: Date.now(),
        issues
      });
      addLog(`Loaded ${issues.length} issues successfully for ${currentRepo}`, "succ");
      if (!userSelectedTab) {
        selectTab(resolveDefaultTab(issues));
      }
      renderViews();
    } catch (err) {
      addLog(`Failed to fetch issues: ${err.message}`, "error");
      renderEmptyState(`Failed to load issues for ${currentRepo}: ${err.message || "Check GitHub integration tokens"}`);
    } finally {
      isLoading = false;
      if (elIconRefresh) elIconRefresh.style.animation = "";
    }
  }
  async function updateIssueBody(issue, newBody) {
    issue.body = newBody;
    issue.subtasks = parseSubtasks(newBody);
    renderViews();
    if (activeIssue && activeIssue.number === issue.number) {
      renderDrawer(issue);
    }
    try {
      await githubRequest("PATCH", `/repos/${currentRepo}/issues/${issue.number}`, {
        body: newBody
      });
      await host.toast({ kind: "info", message: `Updated subtasks on #${issue.number}` });
    } catch (err) {
      addLog(`Failed to sync body: ${err.message}`, "error");
      await host.toast({ kind: "error", message: `Failed to update #${issue.number} on GitHub` });
    }
  }
  async function updateIssueStatus(issue, targetColumn) {
    const prevLabels = [...issue.labels];
    const prevState = issue.state;
    const currentLabels = issue.labels.map((l) => l.name);
    const filteredLabels = currentLabels.filter((name) => !name.startsWith("status:"));
    let newState = "open";
    if (targetColumn === "done") {
      newState = "closed";
      filteredLabels.push("status:done");
    } else {
      filteredLabels.push(`status:${targetColumn}`);
    }
    issue.state = newState;
    issue.labels = filteredLabels.map((name) => ({ name }));
    if (currentRepo) {
      issueCache.delete(currentRepo);
    }
    renderViews();
    if (activeIssue && activeIssue.number === issue.number) {
      renderDrawer(issue);
    }
    try {
      await githubRequest("PATCH", `/repos/${currentRepo}/issues/${issue.number}`, {
        state: newState,
        labels: filteredLabels
      });
      await host.toast({ kind: "success", message: `Moved #${issue.number} to ${targetColumn}` });
      addLog(`Moved #${issue.number} to ${targetColumn}`, "succ");
    } catch (err) {
      issue.state = prevState;
      issue.labels = prevLabels;
      renderViews();
      if (activeIssue && activeIssue.number === issue.number) {
        renderDrawer(issue);
      }
      addLog(`Failed to move #${issue.number}: ${err.message}`, "error");
      await host.toast({ kind: "error", message: `Failed to move #${issue.number}` });
    }
  }
  function buildIssueAttachPayload(issue) {
    const numStr = String(issue.number);
    const title = `#${issue.number} ${issue.title || ""}`.slice(0, 150);
    const url = (issue.html_url || "").slice(0, 1e3);
    const text = `Context from GitHub Issue #${issue.number}: ${issue.title || ""}

${issue.body || ""}`.slice(0, 15e3);
    return {
      providerId: "github-task-board",
      id: numStr,
      title,
      url,
      text,
      ...issue.user?.login ? { author: String(issue.user.login) } : {},
      data: {
        issueNumber: issue.number
      }
    };
  }
  function isIssueClosed(issue) {
    if (!issue) return false;
    if (typeof issue.state === "string" && issue.state.toLowerCase() === "closed") {
      return true;
    }
    if (issue.state_reason === "completed") {
      return true;
    }
    const labelNames = (issue.labels || []).map((l) => (typeof l === "string" ? l : l.name || "").toLowerCase());
    if (labelNames.includes("status:done") || labelNames.includes("status:closed") || labelNames.includes("closed") || labelNames.includes("done")) {
      return true;
    }
    return false;
  }
  function isIssueArchived(issue) {
    if (!issue || !issue.labels) return false;
    return issue.labels.some((l) => {
      const name = (typeof l === "string" ? l : l.name || "").toLowerCase();
      return name === "archived" || name === "archive" || name === "status:archived";
    });
  }
  function getNextColumn(current) {
    switch (current) {
      case "backlog":
        return "todo";
      case "todo":
        return "in-progress";
      case "in-progress":
        return "in-review";
      case "in-review":
        return "done";
      case "done":
        return "todo";
      default:
        return "todo";
    }
  }
  function getNextColumnAction(current) {
    switch (current) {
      case "backlog":
        return { label: "To Do", target: "todo", icon: "\u2192" };
      case "todo":
        return { label: "In Progress", target: "in-progress", icon: "\u25B6" };
      case "in-progress":
        return { label: "In Review", target: "in-review", icon: "\u2192" };
      case "in-review":
        return { label: "Done", target: "done", icon: "\u2713" };
      case "done":
        return { label: "Reopen", target: "todo", icon: "\u21BA" };
      default:
        return { label: "Next", target: "todo", icon: "\u2192" };
    }
  }
  async function toggleArchiveIssue(issue) {
    const isArch = isIssueArchived(issue);
    const prevLabels = [...issue.labels];
    const prevState = issue.state;
    const currentNames = issue.labels.map((l) => typeof l === "string" ? l : l.name || "");
    const clean = currentNames.filter((n) => !["archived", "archive", "status:archived"].includes(n.toLowerCase()));
    let newState = issue.state;
    let targetCategory = "todo";
    if (!isArch) {
      const currentCategory = resolveIssueColumn(issue) || "todo";
      if (!clean.some((n) => n.startsWith("status:"))) {
        clean.push(`status:${currentCategory}`);
      }
      clean.push("archived");
      newState = "closed";
      targetCategory = currentCategory;
    } else {
      const statusLabel = clean.find((n) => n.startsWith("status:"));
      if (statusLabel) {
        targetCategory = statusLabel.replace("status:", "").trim() || "todo";
      } else {
        targetCategory = "todo";
        clean.push("status:todo");
      }
      newState = targetCategory === "done" ? "closed" : "open";
    }
    issue.state = newState;
    issue.labels = clean.map((name) => ({ name }));
    if (currentRepo) {
      issueCache.delete(currentRepo);
    }
    renderViews();
    if (activeIssue && activeIssue.number === issue.number) {
      renderDrawer(issue);
    }
    try {
      await githubRequest("PATCH", `/repos/${currentRepo}/issues/${issue.number}`, {
        state: newState,
        labels: clean
      });
      await host.toast({
        kind: isArch ? "info" : "success",
        message: isArch ? `Unarchived #${issue.number} back to ${targetCategory}` : `Archived #${issue.number}`
      });
      addLog(isArch ? `Unarchived #${issue.number} back to ${targetCategory}` : `Archived #${issue.number}`, "succ");
    } catch (err) {
      issue.state = prevState;
      issue.labels = prevLabels;
      renderViews();
      if (activeIssue && activeIssue.number === issue.number) {
        renderDrawer(issue);
      }
      addLog(`Failed to update archive state: ${err.message}`, "error");
      await host.toast({ kind: "error", message: `Failed to archive #${issue.number}: ${err.message}` });
    }
  }

  function getIssuePriority(issue) {
    if (!issue || !issue.labels) return null;
    for (const l of issue.labels) {
      const name = (typeof l === "string" ? l : l.name || "").toLowerCase();
      if (name === "priority:critical") return "critical";
      if (name === "priority:important") return "important";
      if (name === "priority:useful") return "useful";
      if (name === "priority:optional") return "optional";
    }
    return null;
  }
  function updatePriorityLabels(currentLabels, newPriority) {
    const cleanExisting = currentLabels.map((l) => typeof l === "string" ? l : l.name || "").filter((name) => !name.toLowerCase().startsWith("priority:"));
    if (newPriority && typeof newPriority === "string" && newPriority.trim().toLowerCase() !== "none") {
      cleanExisting.push(`priority:${newPriority.trim().toLowerCase()}`);
    }
    return cleanExisting;
  }
  function groupIssuesBy(issuesList, groupBy) {
    if (groupBy === "priority") {
      const groups = [
        { id: "critical", title: "Critical", issues: [] },
        { id: "important", title: "Important", issues: [] },
        { id: "useful", title: "Useful", issues: [] },
        { id: "optional", title: "Optional", issues: [] },
        { id: "none", title: "No Priority", issues: [] }
      ];
      const map = new Map(groups.map((g) => [g.id, g]));
      for (const issue of issuesList) {
        const p = getIssuePriority(issue) || "none";
        map.get(p)?.issues.push(issue);
      }
      return groups;
    }
    if (groupBy === "tag") {
      const tagMap = /* @__PURE__ */ new Map();
      for (const issue of issuesList) {
        const tag = getIssuePrimaryTag(issue);
        if (!tagMap.has(tag)) {
          tagMap.set(tag, { id: tag, title: tag, issues: [] });
        }
        tagMap.get(tag).issues.push(issue);
      }
      if (tagMap.size === 0) {
        tagMap.set("general", { id: "general", title: "General Tasks", issues: issuesList });
      }
      return Array.from(tagMap.values());
    }
    const groups2 = [
      { id: "backlog", title: "Backlog", issues: [] },
      { id: "todo", title: "To Do", issues: [] },
      { id: "in-progress", title: "In Progress", issues: [] },
      { id: "in-review", title: "In Review", issues: [] },
      { id: "done", title: "Done", issues: [] }
    ];
    const map2 = new Map(groups2.map((g) => [g.id, g]));
    for (const issue of issuesList) {
      const col = resolveIssueColumn(issue);
      if (col && map2.has(col)) {
        map2.get(col).issues.push(issue);
      }
    }
    return groups2;
  }

  function getIssueComplexity(issue) {
    if (!issue || !issue.labels) return null;
    for (const l of issue.labels) {
      const name = (typeof l === "string" ? l : l.name || "").toLowerCase();
      if (name === "complexity:xl") return "XL";
      if (name === "complexity:l") return "L";
      if (name === "complexity:m") return "M";
      if (name === "complexity:s") return "S";
      if (name === "complexity:xs") return "XS";
    }
    return null;
  }

  var PRIORITY_WEIGHTS = { critical: 4, important: 3, useful: 2, optional: 1 };
  var COMPLEXITY_WEIGHTS = { XL: 5, L: 4, M: 3, S: 2, XS: 1 };

  function sortIssuesList(list, sortKey) {
    const copy = [...list];
    switch (sortKey) {
      case "newest":
        return copy.sort((a, b) => b.number - a.number);
      case "oldest":
        return copy.sort((a, b) => a.number - b.number);
      case "priority":
        return copy.sort((a, b) => {
          const pA = PRIORITY_WEIGHTS[getIssuePriority(a) || ""] || 0;
          const pB = PRIORITY_WEIGHTS[getIssuePriority(b) || ""] || 0;
          return pB !== pA ? pB - pA : b.number - a.number;
        });
      case "complexity":
        return copy.sort((a, b) => {
          const cA = COMPLEXITY_WEIGHTS[getIssueComplexity(a) || ""] || 0;
          const cB = COMPLEXITY_WEIGHTS[getIssueComplexity(b) || ""] || 0;
          return cB !== cA ? cB - cA : b.number - a.number;
        });
      case "subtasks":
        return copy.sort((a, b) => {
          const remA = (a.subtasks || []).filter((s) => !s.completed).length;
          const remB = (b.subtasks || []).filter((s) => !s.completed).length;
          return remB !== remA ? remB - remA : b.number - a.number;
        });
      case "title":
        return copy.sort((a, b) => (a.title || "").localeCompare(b.title || ""));
      default:
        return copy;
    }
  }

  function getIssueSession(issue) {
    const issueNumStr = String(issue.number);
    const match = sessions.find((s) => {
      if (s.items && s.items.some((it) => it.id === issueNumStr || it.data?.issueNumber === issue.number)) {
        return true;
      }
      if (s.title && s.title.includes(`#${issue.number}`)) {
        return true;
      }
      const wtName = extractWorktreeName(s.worktree);
      if (wtName && wtName.includes(`issue-${issue.number}`)) {
        return true;
      }
      return false;
    });
    return match || null;
  }
  function resolveIssueColumn(issue) {
    if (isIssueClosed(issue)) {
      return "done";
    }
    const labelNames = (issue.labels || []).map((l) => (typeof l === "string" ? l : l.name || "").toLowerCase());
    if (labelNames.includes("status:done")) return "done";
    if (labelNames.includes("status:in-review")) return "in-review";
    const session = getIssueSession(issue);
    if (labelNames.includes("status:in-progress")) {
      if (session && session.activity === "idle") {
        return "in-review";
      }
      return "in-progress";
    }
    if (labelNames.includes("status:todo")) {
      if (session && (session.activity === "running" || session.activity.startsWith("waiting"))) {
        return "in-progress";
      }
      return "todo";
    }
    if (labelNames.includes("status:backlog")) {
      if (session && (session.activity === "running" || session.activity.startsWith("waiting"))) {
        return "in-progress";
      }
      return "backlog";
    }
    if (session) {
      if (session.activity === "running" || session.activity.startsWith("waiting")) {
        return "in-progress";
      }
      if (session.activity === "idle") {
        return "in-review";
      }
    }
    return null;
  }
  function resolveDefaultTab(issues2) {
    if (!issues2 || issues2.length === 0) return "all";
    const hasReview = issues2.some((i) => resolveIssueColumn(i) === "in-review");
    if (hasReview) return "in-review";
    const hasProgress = issues2.some((i) => resolveIssueColumn(i) === "in-progress");
    if (hasProgress) return "in-progress";
    const hasTodo = issues2.some((i) => resolveIssueColumn(i) === "todo");
    if (hasTodo) return "todo";
    const hasBacklog = issues2.some((i) => resolveIssueColumn(i) === "backlog");
    if (hasBacklog) return "backlog";
    return "all";
  }
  function updateBadgeCounts() {
    const counts = {
      "backlog": 0,
      "todo": 0,
      "in-progress": 0,
      "in-review": 0,
      "done": 0
    };
    const visibleIssues = issues.filter((issue) => showArchivedOnly ? isIssueArchived(issue) : !isIssueArchived(issue));
    visibleIssues.forEach((issue) => {
      const col = resolveIssueColumn(issue);
      if (col && counts[col] !== void 0) {
        counts[col]++;
      }
    });
    const total = visibleIssues.length;
    const setTxt = (id, val) => {
      const el2 = document.getElementById(id);
      if (el2) el2.textContent = String(val);
    };
    setTxt("tabCountAll", total);
    setTxt("tabCountBacklog", counts["backlog"]);
    setTxt("tabCountTodo", counts["todo"]);
    setTxt("tabCountProgress", counts["in-progress"]);
    setTxt("tabCountReview", counts["in-review"]);
    setTxt("tabCountDone", counts["done"]);
    setTxt("kCountBacklog", counts["backlog"]);
    setTxt("kCountTodo", counts["todo"]);
    setTxt("kCountProgress", counts["in-progress"]);
    setTxt("kCountReview", counts["in-review"]);
    setTxt("kCountDone", counts["done"]);
    const blockedCount = sessions.filter(
      (s) => s.activity === "waiting-permission" || s.activity === "waiting-question"
    ).length;
    void host.setBadge(blockedCount > 0 ? blockedCount : null);
  }
  function renderEmptyState(message) {
    elListViewContainer.innerHTML = `<div class="empty-box">${escapeHtml(message)}</div>`;
    Object.keys(kanbanCardContainers).forEach((col) => {
      kanbanCardContainers[col].innerHTML = `<div class="empty-box">${escapeHtml(message)}</div>`;
    });
  }
  function renderArchiveView(archivedIssues) {
    elListViewContainer.innerHTML = "";
    const banner = document.createElement("div");
    banner.className = "archive-header-banner";
    banner.innerHTML = `
      <div class="archive-title-wrap">
        <svg class="icon icon-sm" viewBox="0 0 24 24"><path d="M3 3h18a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zm1 5h16v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V8zm5 3v2h6v-2H9z"/></svg>
        <span>Archived Issues (${archivedIssues.length})</span>
      </div>
      <button class="btn btn-sm btn-secondary" id="btnExitArchive">Exit Archive</button>
    `;
    const btnExit = banner.querySelector("#btnExitArchive");
    if (btnExit) {
      btnExit.addEventListener("click", () => {
        showArchivedOnly = false;
        const btn = document.getElementById("btnArchiveToggle");
        if (btn) btn.classList.remove("active");
        renderViews();
      });
    }
    elListViewContainer.appendChild(banner);
    if (archivedIssues.length === 0) {
      const empty = document.createElement("div");
      empty.className = "empty-box";
      empty.innerHTML = `
        <svg class="icon icon-lg" viewBox="0 0 24 24"><path d="M3 3h18a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zm1 5h16v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V8zm5 3v2h6v-2H9z"/></svg>
        <span>No archived issues in this repository.</span>
      `;
      elListViewContainer.appendChild(empty);
      return;
    }
    archivedIssues.forEach((issue) => {
      const card = buildCardElement(issue, false);
      elListViewContainer.appendChild(card);
    });
  }
  function renderViews() {
    updateBadgeCounts();
    if (elSelectFilterTag) {
      const existingTags = /* @__PURE__ */ new Set();
      issues.forEach((i) => {
        (i.labels || []).forEach((l) => {
          const name = typeof l === "string" ? l : l.name || "";
          if (
            name &&
            !name.startsWith("status:") &&
            !name.startsWith("priority:") &&
            !name.startsWith("complexity:") &&
            name.toLowerCase() !== "archived" &&
            name.toLowerCase() !== "archive"
          ) {
            existingTags.add(name);
          }
        });
      });
      const currentVal = elSelectFilterTag.value;
      const sortedTags = Array.from(existingTags).sort();
      let optionsHtml = `<option value="all"${filterTag === "all" ? " selected" : ""}>All Tags</option>`;
      sortedTags.forEach((t) => {
        optionsHtml += `<option value="${escapeHtml(t)}"${filterTag === t ? " selected" : ""}>${escapeHtml(t)}</option>`;
      });
      elSelectFilterTag.innerHTML = optionsHtml;
      if (sortedTags.includes(currentVal)) {
        elSelectFilterTag.value = currentVal;
      }
    }
    const hasActiveFilters = filterPriority !== "all" || filterTag !== "all" || currentSort !== "newest";
    if (elBtnResetFilters) {
      elBtnResetFilters.style.display = hasActiveFilters ? "inline-flex" : "none";
    }
    if (elBtnFilterToggle) {
      elBtnFilterToggle.classList.toggle("active", hasActiveFilters || isFilterBarOpen);
    }
    if (elBtnStartTagIssues) {
      if (filterTag !== "all") {
        elBtnStartTagIssues.style.display = "inline-flex";
        elBtnStartTagIssues.textContent = `Select All with "${filterTag}"`;
      } else {
        elBtnStartTagIssues.style.display = "none";
      }
    }
    const q = searchQuery.toLowerCase().trim();
    const filtered = issues.filter((issue) => {
      const isArch = isIssueArchived(issue);
      if (showArchivedOnly ? !isArch : isArch) return false;
      if (filterPriority !== "all") {
        const p = getIssuePriority(issue);
        if (p !== filterPriority) return false;
      }
      if (filterTag !== "all") {
        const hasTag = (issue.labels || []).some((l) => {
          const name = typeof l === "string" ? l : l.name || "";
          return name === filterTag;
        });
        if (!hasTag) return false;
      }
      if (!q) return true;
      return issue.title.toLowerCase().includes(q) || String(issue.number).includes(q) || issue.labels.some((l) => (typeof l === "string" ? l : l.name || "").toLowerCase().includes(q));
    });
    const sorted = sortIssuesList(filtered, currentSort);
    if (showArchivedOnly) {
      document.body.removeAttribute("data-layout");
      if (elStatusTabBar) elStatusTabBar.style.display = "none";
      if (elKanbanViewContainer) elKanbanViewContainer.style.display = "none";
      if (elListViewContainer) {
        elListViewContainer.style.display = "flex";
        renderArchiveView(sorted);
      }
      return;
    }
    if (elStatusTabBar) elStatusTabBar.style.display = "";
    if (elKanbanViewContainer) elKanbanViewContainer.style.display = "";
    if (elListViewContainer) elListViewContainer.style.display = "";
    renderListView(sorted);
    renderKanbanView(sorted);
    updateBatchBar();
    applyLayoutMode();
  }
  function buildCardElement(issue, inKanban) {
    const session = getIssueSession(issue);
    const card = document.createElement("div");
    const isSelected = selectedIssueNumbers.has(issue.number);
    card.className = `card ${isSelected ? "is-selected" : ""}`;
    card.draggable = inKanban;
    card.dataset.issueNumber = String(issue.number);
    const totalSubtasks = issue.subtasks.length;
    const completedSubtasks = issue.subtasks.filter((s) => s.completed).length;
    const pct = totalSubtasks > 0 ? Math.round(completedSubtasks / totalSubtasks * 100) : 0;
    let agentBadgeHtml = "";
    if (session) {
      let dotClass = "dot-idle";
      let actLabel = "Agent Idle";
      if (session.activity === "running") {
        dotClass = "dot-running";
        actLabel = "Running";
      } else if (session.activity === "waiting-permission") {
        dotClass = "dot-waiting";
        actLabel = "Needs Permission";
      } else if (session.activity === "waiting-question") {
        dotClass = "dot-waiting";
        actLabel = "Needs Input";
      }
      agentBadgeHtml = `
      <div class="agent-pill">
        <span class="dot ${dotClass}"></span>
        <span>${actLabel}</span>
      </div>
    `;
    }
    const wtTag = extractWorktreeName(session?.worktree);
    const worktreeHtml = wtTag ? `
      <div class="worktree-tag">
        <svg class="icon icon-sm" viewBox="0 0 24 24"><path d="M7.05 13.05C6.46 12.4 5.54 12 4.5 12 2.57 12 1 13.57 1 15.5S2.57 19 4.5 19c1.04 0 1.96-.4 2.55-1.05l7.9 4.05V24h2v-4.5l-7.9-4.05c.59-.65 1.45-1.05 2.45-1.05 1.04 0 1.96.4 2.55 1.05L19.5 11.4V14h2V8h-6v2h2.6l-5.65 3.95c-.59-.65-1.45-1.05-2.45-1.05-1.04 0-1.96.4-2.55 1.05L7.05 13.05z"/></svg>
        <span>${escapeHtml(wtTag)}</span>
      </div>
    ` : "";
    const labelsHtml = issue.labels.filter((l) => !l.name.startsWith("status:")).map((l) => {
      const hex = sanitizeHexColor(l.color);
      const bg2 = hex ? `${hex}18` : "var(--surf-muted)";
      const fg2 = hex || "var(--fg-muted)";
      return `<span class="badge" style="background: ${bg2}; color: ${fg2}; border: 1px solid ${fg2}33;">${escapeHtml(l.name)}</span>`;
    }).join("");
    const subtaskHtml = totalSubtasks > 0 ? `
      <div class="subtask-prog" title="${completedSubtasks} of ${totalSubtasks} subtasks completed">
        <span>${completedSubtasks}/${totalSubtasks}</span>
        <div class="micro-bar"><div class="micro-fill" style="width: ${pct}%;"></div></div>
      </div>
    ` : "<span></span>";
    const col = resolveIssueColumn(issue);
    const nextAction = col ? getNextColumnAction(col) : { label: "To Do", target: "todo", icon: "\u2192" };
    const isArch = isIssueArchived(issue);
    let archiveCategoryBadge = "";
    if (isArch) {
      const statusLabel = (issue.labels || []).find((l) => (typeof l === "string" ? l : l.name || "").startsWith("status:"));
      const rawCat = statusLabel ? (typeof statusLabel === "string" ? statusLabel : statusLabel.name || "").replace("status:", "") : "";
      const catLabel = rawCat === "in-progress" ? "In Progress" : rawCat === "in-review" ? "In Review" : rawCat === "done" ? "Done" : rawCat === "backlog" ? "Backlog" : "To Do";
      archiveCategoryBadge = `<span class="archive-from-badge">From: ${escapeHtml(catLabel)}</span>`;
    }
    const priority = getIssuePriority(issue);
    const priorityHtml = priority ? `<span class="badge badge-priority badge-priority-${priority}">${priority}</span>` : "";
    const complexity = getIssueComplexity(issue);
    const complexityHtml = complexity ? `<span class="badge badge-complexity badge-complexity-${complexity.toLowerCase()}">${complexity}</span>` : "";
    const vague = isVagueIdea(issue);
    const vagueBadgeHtml = vague ? `<span class="badge badge-vague" title="Sparse task needing alignment">Needs Alignment</span>` : "";
    const nextStageButtonHtml = !inKanban && !showArchivedOnly ? `
      <button class="card-btn-next" data-issue="${issue.number}" data-target="${nextAction.target}" title="Move to ${nextAction.label}">
        <span>${nextAction.icon}</span>
        <span>${nextAction.label}</span>
      </button>
    ` : "";
    const archiveButtonHtml = showArchivedOnly ? `
      <button class="btn btn-sm card-btn-archive is-archived" data-issue="${issue.number}" title="Unarchive issue (Restore to original category)">
        <svg class="icon icon-sm" viewBox="0 0 24 24"><path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46A7.93 7.93 0 0 0 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74A7.93 7.93 0 0 0 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/></svg>
        <span>Unarchive</span>
      </button>
    ` : (!inKanban ? `
      <button class="card-btn-archive ${isArch ? "is-archived" : ""}" data-issue="${issue.number}" title="${isArch ? "Unarchive issue" : "Archive issue"}">
        <svg class="icon icon-sm" viewBox="0 0 24 24"><path d="M3 3h18a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zm1 5h16v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V8zm5 3v2h6v-2H9z"/></svg>
      </button>
    ` : "");
    const attachButtonHtml = `
    <button class="card-btn-attach" data-issue="${issue.number}" title="Attach issue chip to active prompt">
      <svg class="icon icon-sm icon-paperclip" viewBox="0 0 24 24"><path d="M16.5 6v11.5c0 2.21-1.79 4-4 4s-4-1.79-4-4V5a2.5 2.5 0 0 1 5 0v10.5c0 .83-.67 1.5-1.5 1.5s-1.5-.67-1.5-1.5V6h-2v9.5a3.5 3.5 0 0 0 7 0V5a4.5 4.5 0 0 0-9 0v12.5c0 3.31 2.69 6 6 6s6-2.69 6-6V6h-2z"/></svg>
      <svg class="icon icon-sm icon-check" style="display: none;" viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
    </button>
  `;
    card.innerHTML = `
    <div class="card-meta">
      <div class="card-id-wrap">
        <input type="checkbox" class="card-checkbox" data-issue="${issue.number}" ${isSelected ? "checked" : ""} title="Select issue for batch actions" />
        <span class="card-id">#${issue.number}</span>
        ${priorityHtml}
        ${complexityHtml}
        ${vagueBadgeHtml}
        ${issue.user ? `<span style="color: var(--fg-muted); font-size: 11px;">@${escapeHtml(issue.user.login)}</span>` : ""}
        ${archiveCategoryBadge}
      </div>
      <div style="display: flex; align-items: center; gap: 5px;">
        ${nextStageButtonHtml}
        ${archiveButtonHtml}
        ${agentBadgeHtml}
      </div>
    </div>
    <div class="card-title">${escapeHtml(issue.title)}</div>
    ${labelsHtml ? `<div class="card-labels">${labelsHtml}</div>` : ""}
    <div class="card-footer">
      ${subtaskHtml}
      <div style="display: flex; align-items: center; gap: 6px;">
        ${worktreeHtml}
        ${attachButtonHtml}
      </div>
    </div>
  `;
    const cbSelect = card.querySelector(".card-checkbox");
    if (cbSelect) {
      cbSelect.addEventListener("click", (e) => {
        e.stopPropagation();
        toggleIssueSelection(issue.number);
      });
    }
    const btnAttach = card.querySelector(".card-btn-attach");
    if (btnAttach) {
      btnAttach.addEventListener("click", async (e) => {
        e.stopPropagation();
        e.preventDefault();
        try {
          const payload = buildIssueAttachPayload(issue);
          await host.attach(payload);
          btnAttach.classList.add("attached");
          await host.toast({ kind: "success", message: `Attached #${issue.number} to composer chip` });
          setTimeout(() => {
            btnAttach.classList.remove("attached");
          }, 1500);
        } catch (err) {
          addLog(`Failed to attach issue #${issue.number}: ${err.message}`, "error");
          await host.toast({ kind: "error", message: `Failed to attach: ${err.message || "Unknown error"}` });
        }
      });
    }
    const btnNext = card.querySelector(".card-btn-next");
    if (btnNext) {
      btnNext.addEventListener("click", async (e) => {
        e.stopPropagation();
        e.preventDefault();
        const target = btnNext.getAttribute("data-target");
        if (target) {
          await updateIssueStatus(issue, target);
        }
      });
    }
    const btnArchive = card.querySelector(".card-btn-archive");
    if (btnArchive) {
      btnArchive.addEventListener("click", async (e) => {
        e.stopPropagation();
        e.preventDefault();
        await toggleArchiveIssue(issue);
      });
    }
    card.addEventListener("click", (e) => {
      if (e.target.closest("button, a, select")) return;
      openDrawer(issue);
    });
    if (inKanban) {
      card.addEventListener("dragstart", (e) => {
        draggedIssueNumber = issue.number;
        card.classList.add("dragging");
        if (e.dataTransfer) {
          e.dataTransfer.setData("text/plain", String(issue.number));
          e.dataTransfer.effectAllowed = "move";
        }
      });
      card.addEventListener("dragend", () => {
        draggedIssueNumber = null;
        card.classList.remove("dragging");
      });
    }
    return card;
  }
  function renderListView(filteredIssues) {
    elListViewContainer.innerHTML = "";
    const listItems = activeTab === "all" ? filteredIssues : filteredIssues.filter((i) => resolveIssueColumn(i) === activeTab);
    if (listItems.length === 0) {
      elListViewContainer.innerHTML = `
      <div class="empty-box">
        <svg class="icon icon-lg" viewBox="0 0 24 24"><path d="M18.031 16.617l4.283 4.282-1.415 1.415-4.282-4.283A8.96 8.96 0 0 1 11 20c-4.968 0-9-4.032-9-9s4.032-9 9-9 9 4.032 9 9a8.96 8.96 0 0 1-1.969 5.617zm-2.006-.742A6.977 6.977 0 0 0 18 11c0-3.868-3.133-7-7-7-3.868 0-7 3.132-7 7 0 3.867 3.132 7 7 7a6.977 6.977 0 0 0 4.875-1.975l.15-.15z"/></svg>
        <span>No issues match this view</span>
      </div>
    `;
      return;
    }
    listItems.forEach((issue) => {
      const card = buildCardElement(issue, false);
      elListViewContainer.appendChild(card);
    });
  }
  function renderKanbanView(filteredIssues) {
    elKanbanViewContainer.innerHTML = "";
    const groups = groupIssuesBy(filteredIssues, currentGroupBy);
    groups.forEach((grp) => {
      const colEl = document.createElement("div");
      colEl.className = "kanban-col";
      colEl.dataset.column = grp.id;
      colEl.innerHTML = `
        <div class="kanban-col-header">
          <span>${escapeHtml(grp.title)}</span>
          <span class="status-pill">${grp.issues.length}</span>
        </div>
        <div class="kanban-cards" data-column="${escapeHtml(grp.id)}"></div>
      `;
      const cardsContainer = colEl.querySelector(".kanban-cards");
      cardsContainer.addEventListener("dragover", (e) => {
        e.preventDefault();
        if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
        cardsContainer.classList.add("drag-over");
      });
      cardsContainer.addEventListener("dragleave", () => {
        cardsContainer.classList.remove("drag-over");
      });
      cardsContainer.addEventListener("drop", async (e) => {
        e.preventDefault();
        cardsContainer.classList.remove("drag-over");
        const issueNum = draggedIssueNumber || Number(e.dataTransfer?.getData("text/plain"));
        if (!issueNum) return;
        const issue = issues.find((i) => i.number === issueNum);
        if (!issue) return;
        if (currentGroupBy === "status") {
          await updateIssueStatus(issue, grp.id);
        } else if (currentGroupBy === "priority") {
          const updatedLabels = updatePriorityLabels(issue.labels, grp.id);
          issue.labels = updatedLabels.map((name) => ({ name }));
          if (currentRepo) issueCache.delete(currentRepo);
          renderViews();
          try {
            await githubRequest("PATCH", `/repos/${currentRepo}/issues/${issue.number}`, {
              labels: updatedLabels
            });
            await host.toast({ kind: "info", message: `Moved #${issue.number} to priority ${grp.title}` });
          } catch {
          }
        }
      });
      grp.issues.forEach((issue) => {
        const card = buildCardElement(issue, true);
        cardsContainer.appendChild(card);
      });
      elKanbanViewContainer.appendChild(colEl);
    });
  }
  function applyLayoutMode() {
    isWideScreen = window.innerWidth >= 680;
    let useKanban = false;
    if (userLayoutPreference === "kanban") useKanban = true;
    else if (userLayoutPreference === "list") useKanban = false;
    else useKanban = isWideScreen;
    if (useKanban) {
      document.body.setAttribute("data-layout", "kanban");
      elBtnLayoutToggle.title = "Switch to List View";
    } else {
      document.body.removeAttribute("data-layout");
      elBtnLayoutToggle.title = "Switch to Kanban View";
    }
  }
  function openDrawer(issue) {
    activeIssue = issue;
    renderDrawer(issue);
    elDrawerScrim.classList.add("active");
    elTaskDrawer.classList.add("active");
  }
  function closeDrawer() {
    activeIssue = null;
    elDrawerScrim.classList.remove("active");
    elTaskDrawer.classList.remove("active");
  }
  function renderMarkdown(raw) {
    if (!raw || typeof raw !== "string") return '<p style="color: var(--fg-muted); font-style: italic;">No description provided.</p>';
    let html = raw.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    html = html.replace(/```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g, (_, lang, code) => {
      return `<pre class="md-code-block"><code class="language-${lang}">${code.trim()}</code></pre>`;
    });
    html = html.replace(/`([^`]+)`/g, '<code class="md-inline-code">$1</code>');
    html = html.replace(/^#### (.*$)/gim, '<h4 class="md-h4">$1</h4>');
    html = html.replace(/^### (.*$)/gim, '<h3 class="md-h3">$1</h3>');
    html = html.replace(/^## (.*$)/gim, '<h2 class="md-h2">$1</h2>');
    html = html.replace(/^# (.*$)/gim, '<h1 class="md-h1">$1</h1>');
    html = html.replace(/^\> (.*$)/gim, '<blockquote class="md-quote">$1</blockquote>');
    html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    html = html.replace(/\*([^*]+)\*/g, "<em>$1</em>");
    html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="md-link">$1 \u2197</a>');
    const paragraphs = html.split(/\n\n+/);
    html = paragraphs.map((p) => {
      const trimmed = p.trim();
      if (!trimmed) return "";
      if (trimmed.startsWith("<h") || trimmed.startsWith("<pre") || trimmed.startsWith("<blockquote")) {
        return trimmed;
      }
      return `<p class="md-p">${trimmed.replace(/\n/g, "<br/>")}</p>`;
    }).filter(Boolean).join("\n");
    return html;
  }
  var repoLabelsCache = /* @__PURE__ */ new Map();
  async function loadRepoLabels() {
    if (!currentRepo) return;
    if (repoLabelsCache.has(currentRepo)) {
      populateLabelsDatalist(repoLabelsCache.get(currentRepo));
      return;
    }
    try {
      const list = await githubRequest("GET", `/repos/${currentRepo}/labels?per_page=100`);
      if (Array.isArray(list)) {
        repoLabelsCache.set(currentRepo, list);
        populateLabelsDatalist(list);
      }
    } catch {
    }
  }
  function populateLabelsDatalist(labels) {
    elRepoLabelsDatalist.innerHTML = labels.map((l) => `<option value="${escapeHtml(l.name)}"></option>`).join("");
  }
  function renderDrawerLabels(issue) {
    elDrawerLabelsContainer.innerHTML = "";
    const nonStatusLabels = issue.labels.filter((l) => !l.name.startsWith("status:"));
    if (nonStatusLabels.length === 0) {
      elDrawerLabelsContainer.innerHTML = `<span style="font-size: 11px; color: var(--fg-faint); font-style: italic;">No labels</span>`;
    } else {
      nonStatusLabels.forEach((l) => {
        const hex = sanitizeHexColor(l.color);
        const bg2 = hex ? `${hex}18` : "var(--surf-muted)";
        const fg2 = hex || "var(--fg-muted)";
        const pill = document.createElement("span");
        pill.className = "label-pill";
        pill.style.background = bg2;
        pill.style.color = fg2;
        pill.style.border = `1px solid ${fg2}33`;
        pill.innerHTML = `
        <span>${escapeHtml(l.name)}</span>
        <span class="label-pill-remove" title="Remove label">\xD7</span>
      `;
        pill.querySelector(".label-pill-remove")?.addEventListener("click", async (e) => {
          e.stopPropagation();
          await removeTagFromIssue(issue, l.name);
        });
        elDrawerLabelsContainer.appendChild(pill);
      });
    }
  }
  async function addTagToIssue(issue, tagName) {
    const clean = tagName.trim();
    if (!clean) return;
    const currentNames = issue.labels.map((l) => l.name);
    if (currentNames.some((n) => n.toLowerCase() === clean.toLowerCase())) return;
    const newNames = [...currentNames, clean];
    issue.labels.push({ name: clean });
    renderDrawerLabels(issue);
    renderViews();
    try {
      addLog(`Adding label "${clean}" to #${issue.number}...`);
      await githubRequest("PATCH", `/repos/${currentRepo}/issues/${issue.number}`, {
        labels: newNames
      });
      await host.toast({ kind: "success", message: `Added label "${clean}" to #${issue.number}` });
    } catch (err) {
      addLog(`Failed to add label: ${err.message}`, "error");
      await host.toast({ kind: "error", message: `Failed to add label: ${err.message}` });
    }
  }
  async function removeTagFromIssue(issue, tagName) {
    const target = tagName.trim().toLowerCase();
    const newLabels = issue.labels.filter((l) => l.name.toLowerCase() !== target);
    issue.labels = newLabels;
    renderDrawerLabels(issue);
    renderViews();
    try {
      addLog(`Removing label "${tagName}" from #${issue.number}...`);
      await githubRequest("PATCH", `/repos/${currentRepo}/issues/${issue.number}`, {
        labels: newLabels.map((l) => l.name)
      });
      await host.toast({ kind: "info", message: `Removed label "${tagName}" from #${issue.number}` });
    } catch (err) {
      addLog(`Failed to remove label: ${err.message}`, "error");
      await host.toast({ kind: "error", message: `Failed to remove label: ${err.message}` });
    }
  }
  function renderDrawer(issue) {
    elDrawerIssueNumber.textContent = `#${issue.number}`;
    elDrawerIssueAuthor.textContent = issue.user ? `by @${issue.user.login}` : "";
    elDrawerGithubLink.href = issue.html_url;
    elDrawerIssueTitle.textContent = issue.title;
    const col = resolveIssueColumn(issue);
    elDrawerStatusSelect.value = col || "none";
    if (elDrawerPrioritySelect) {
      elDrawerPrioritySelect.value = getIssuePriority(issue) || "none";
    }
    if (elDrawerComplexitySelect) {
      elDrawerComplexitySelect.value = getIssueComplexity(issue) || "none";
    }
    if (elDrawerAlignmentWarning) {
      elDrawerAlignmentWarning.style.display = isVagueIdea(issue) ? "flex" : "none";
    }
    if (elBtnDrawerArchive && elTxtDrawerArchive) {
      const isArch = isIssueArchived(issue);
      elTxtDrawerArchive.textContent = isArch ? "Unarchive" : "Archive";
      elBtnDrawerArchive.classList.toggle("active", isArch);
      elBtnDrawerArchive.title = isArch ? "Unarchive issue" : "Archive issue";
      elBtnDrawerArchive.onclick = () => {
        void toggleArchiveIssue(issue);
      };
    }
    if (elBtnDrawerToggleClose) {
      const isClosed = isIssueClosed(issue);
      elBtnDrawerToggleClose.textContent = isClosed ? "Reopen Issue" : "Close Issue";
      elBtnDrawerToggleClose.onclick = () => {
        void updateIssueStatus(issue, isClosed ? "todo" : "done");
      };
    }
    renderDrawerLabels(issue);
    void loadRepoLabels();
    const session = getIssueSession(issue);
    if (session) {
      let dotClass = "dot-idle";
      let label = "Agent Idle";
      if (session.activity === "running") {
        dotClass = "dot-running";
        label = "Agent Working...";
      } else if (session.activity === "waiting-permission") {
        dotClass = "dot-waiting";
        label = "Waiting for Permission";
      } else if (session.activity === "waiting-question") {
        dotClass = "dot-waiting";
        label = "Waiting for User Input";
      }
      elDrawerAgentBadge.innerHTML = `
      <span class="dot ${dotClass}"></span>
      <span>${label}</span>
    `;
      const wtName = extractWorktreeName(session.worktree);
      elDrawerWorktreeName.textContent = wtName || "Project Root";
      elBtnDrawerJumpSession.style.display = "inline-flex";
      elBtnDrawerJumpSession.onclick = () => {
        void host.openSession(session.id);
      };
    } else {
      elDrawerAgentBadge.innerHTML = `
      <span class="dot dot-idle"></span>
      <span>No session active</span>
    `;
      elDrawerWorktreeName.textContent = "None";
      elBtnDrawerJumpSession.style.display = "none";
    }
    renderChecklist(issue);
    elDrawerDescriptionContent.innerHTML = renderMarkdown(issue.body);
    elDrawerDescriptionViewBox.style.display = "block";
    elDrawerDescriptionEditBox.style.display = "none";
    requestAnimationFrame(() => {
      if (elDrawerDescriptionContent.scrollHeight > 220) {
        elDrawerDescriptionCollapsible.classList.remove("expanded");
        elDrawerDescriptionToggleRow.style.display = "block";
        elBtnToggleCollapse.textContent = "Show more";
      } else {
        elDrawerDescriptionCollapsible.classList.add("expanded");
        elDrawerDescriptionToggleRow.style.display = "none";
      }
    });
    void loadComments(issue.number);
    renderRelatedIssues(issue);
  }
  function renderChecklist(issue) {
    const total = issue.subtasks.length;
    const completed = issue.subtasks.filter((s) => s.completed).length;
    const pct = total > 0 ? Math.round(completed / total * 100) : 0;
    elChecklistProgressText.textContent = `${completed} / ${total} (${pct}%)`;
    elChecklistProgressFill.style.width = `${pct}%`;
    elDrawerChecklistContainer.innerHTML = "";
    if (total === 0) {
      elDrawerChecklistContainer.innerHTML = `
      <div style="color: var(--fg-faint); font-size: 12px; padding: 4px 0;">
        No markdown subtasks found. Use "- [ ] task" in description or add one below.
      </div>
    `;
      return;
    }
    issue.subtasks.forEach((subtask) => {
      const itemEl = document.createElement("div");
      itemEl.className = `check-item ${subtask.completed ? "done" : ""}`;
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = subtask.completed;
      const span = document.createElement("span");
      span.textContent = subtask.text;
      cb.addEventListener("change", () => {
        const updatedBody = updateSubtaskInMarkdown(issue.body, subtask.lineIndex, cb.checked);
        void updateIssueBody(issue, updatedBody);
      });
      itemEl.appendChild(cb);
      itemEl.appendChild(span);
      elDrawerChecklistContainer.appendChild(itemEl);
    });
  }
  async function loadComments(issueNumber) {
    elDrawerCommentsContainer.innerHTML = '<div style="color: var(--fg-muted); font-size: 11.5px;">Loading comments...</div>';
    try {
      const comments = await githubRequest("GET", `/repos/${currentRepo}/issues/${issueNumber}/comments`);
      elCommentCountBadge.textContent = String(comments.length);
      if (!comments || comments.length === 0) {
        elDrawerCommentsContainer.innerHTML = '<div style="color: var(--fg-faint); font-size: 12px;">No comments yet.</div>';
        return;
      }
      elDrawerCommentsContainer.innerHTML = comments.map((c) => {
        const author = c.user ? c.user.login : "user";
        const date = new Date(c.created_at).toLocaleDateString();
        return `
          <div class="check-item" style="flex-direction: column; gap: 4px;">
            <div style="display: flex; justify-content: space-between; width: 100%; font-size: 11px; color: var(--fg-muted);">
              <strong>@${escapeHtml(author)}</strong>
              <span>${date}</span>
            </div>
            <div style="font-size: 12px; white-space: pre-wrap;">${escapeHtml(c.body)}</div>
          </div>
        `;
      }).join("");
    } catch {
      elDrawerCommentsContainer.innerHTML = '<div style="color: var(--fg-faint); font-size: 12px;">Comments unavailable.</div>';
    }
  }
  function findRelatedIssues(targetIssue, allIssues, limit = 4) {
    if (!targetIssue || !allIssues) return [];
    const targetNum = targetIssue.number;
    const targetLabels = new Set(
      (targetIssue.labels || []).map((l) => (typeof l === "string" ? l : l.name || "").toLowerCase()).filter((n) => !n.startsWith("status:") && n !== "archived")
    );
    const targetWords = new Set(
      (targetIssue.title || "").toLowerCase().split(/[^a-z0-9_-]+/).filter((w) => w.length > 3)
    );
    const scored = [];
    for (const other of allIssues) {
      if (other.number === targetNum) continue;
      let score = 0;
      const otherLabels = (other.labels || []).map((l) => (typeof l === "string" ? l : l.name || "").toLowerCase());
      for (const l of otherLabels) {
        if (targetLabels.has(l)) score += 3;
      }
      const otherText = `${other.title || ""} ${other.body || ""}`;
      if (otherText.includes(`#${targetNum}`)) score += 5;
      const targetText = `${targetIssue.title || ""} ${targetIssue.body || ""}`;
      if (targetText.includes(`#${other.number}`)) score += 5;
      const otherWords = (other.title || "").toLowerCase().split(/[^a-z0-9_-]+/);
      for (const w of otherWords) {
        if (w.length > 3 && targetWords.has(w)) score += 1;
      }
      if (score > 0) {
        scored.push({ issue: other, score });
      }
    }
    scored.sort((a, b) => b.score - a.score || b.issue.number - a.issue.number);
    return scored.slice(0, limit).map((s) => s.issue);
  }
  function renderRelatedIssues(issue) {
    if (!elDrawerRelatedIssuesContainer || !elRelatedIssuesCountBadge) return;
    const related = findRelatedIssues(issue, issues, 4);
    elRelatedIssuesCountBadge.textContent = String(related.length);
    elDrawerRelatedIssuesContainer.innerHTML = "";
    if (related.length === 0) {
      elDrawerRelatedIssuesContainer.innerHTML = '<div style="color: var(--fg-faint); font-size: 11.5px; padding: 2px 0;">No related issues found.</div>';
      return;
    }
    related.forEach((other) => {
      const item = document.createElement("div");
      item.className = "related-issue-card";
      const otherComp = getIssueComplexity(other);
      const compHtml = otherComp ? `<span class="badge badge-complexity badge-complexity-${otherComp.toLowerCase()}">${otherComp}</span>` : "";
      item.innerHTML = `
        <div class="related-issue-title" title="${escapeHtml(other.title)}">#${other.number} ${escapeHtml(other.title)}</div>
        <div style="display: flex; align-items: center; gap: 5px; flex-shrink: 0;">
          ${compHtml}
          <span class="status-pill" style="font-size: 10px;">${resolveIssueColumn(other) || "all"}</span>
        </div>
      `;
      item.addEventListener("click", () => {
        openDrawer(other);
      });
      elDrawerRelatedIssuesContainer.appendChild(item);
    });
  }
  function getIssuePrimaryTag(issue) {
    if (!issue || !issue.labels) return "task";
    for (const l of issue.labels) {
      const name = (typeof l === "string" ? l : l.name || "").trim();
      if (
        name &&
        !name.startsWith("status:") &&
        !name.startsWith("priority:") &&
        !name.startsWith("complexity:") &&
        !name.startsWith("theme:") &&
        !["archived", "archive"].includes(name.toLowerCase())
      ) {
        return name;
      }
    }
    for (const l of issue.labels) {
      const name = (typeof l === "string" ? l : l.name || "").trim();
      if (name.startsWith("theme:")) {
        return name.replace("theme:", "");
      }
    }
    return "task";
  }
  function buildWorktreeBranchName(options) {
    if (options.mode === "tag") {
      const tag = options.customTag || getIssuePrimaryTag(options.issue);
      return `worktree-tag-${slugify(tag || "task")}`.slice(0, 80);
    }
    const branchSlug = slugify(options.issue.title || "task");
    return `issue-${options.issue.number}-${branchSlug}`.slice(0, 80);
  }
  function updatePreflightBrief() {
    if (!activeIssue) return;
    const useWt = elPreflightWorktreeToggle.checked;
    let brief = `You are assigned to work on GitHub Issue #${activeIssue.number}: ${activeIssue.title}\n\n`;
    if (activeIssue.body) {
      brief += `### Description:\n${activeIssue.body}\n\n`;
    }
    if (activeIssue.subtasks.length > 0) {
      brief += `### Subtasks Checklist:\n`;
      activeIssue.subtasks.forEach((s) => {
        brief += `- [${s.completed ? "x" : " "}] ${s.text}\n`;
      });
      brief += "\n";
    }
    if (useWt) {
      brief += `Please inspect the codebase in this worktree, implement the solution, verify with tests, and report back.`;
    } else {
      brief += `Please inspect the codebase in this workspace, implement the solution, verify with tests, and report back.`;
    }
    elPreflightPromptInput.value = brief;
  }
  function syncPreflightBranchInput() {
    if (!activeIssue) return;
    const isTagMode = elRadioWorktreeTag.checked;
    const branchName = buildWorktreeBranchName({
      issue: activeIssue,
      mode: isTagMode ? "tag" : "issue"
    });
    elPreflightBranchInput.value = branchName;
  }
  function openPreflightModal(issue) {
    activeIssue = issue;
    elModalPreflightTitle.textContent = `Start Agent Task on #${issue.number}`;
    elPreflightWorktreeToggle.checked = false;
    elPreflightWorktreeSection.style.display = "none";
    elRadioWorktreeIssue.checked = true;
    const tagBranch = buildWorktreeBranchName({ issue, mode: "tag" });
    const issueBranch = buildWorktreeBranchName({ issue, mode: "issue" });
    elPreflightTagPreview.textContent = tagBranch;
    elPreflightIssuePreview.textContent = issueBranch;
    elPreflightBranchInput.value = issueBranch;
    elPreflightBaseBranchInput.value = "main";
    elBtnPreflightLaunch.textContent = "Start Agent Session (Current Workspace)";
    updatePreflightBrief();
    elPreflightBackdrop.classList.add("active");
  }
  function closePreflightModal() {
    elPreflightBackdrop.classList.remove("active");
  }
  async function launchAgentSession() {
    if (!activeIssue || !currentProject) return;
    const useWorktree = elPreflightWorktreeToggle.checked;
    const rawBranch = elPreflightBranchInput.value.trim();
    const cleanBranch = useWorktree ? rawBranch.replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 80) : void 0;
    const baseBranch = useWorktree ? elPreflightBaseBranchInput.value.trim() || void 0 : void 0;
    const promptText = elPreflightPromptInput.value.trim().slice(0, 15e3);
    const autoMove = elPreflightMoveInProgress.checked;
    elBtnPreflightLaunch.disabled = true;
    elBtnPreflightLaunch.textContent = "Provisioning...";
    try {
      const targetDesc = useWorktree && cleanBranch ? `worktree "${cleanBranch}"` : "workspace";
      addLog(`Starting session in ${targetDesc} on project ${currentProject.id}...`);
      const res = await host.startSession({
        projectId: currentProject.id,
        worktree: useWorktree && cleanBranch ? { kind: "new", name: cleanBranch, baseBranch } : false,
        providerId: "github-task-board",
        id: String(activeIssue.number),
        title: `#${activeIssue.number} ${activeIssue.title}`.slice(0, 150),
        url: activeIssue.html_url.slice(0, 1e3),
        text: promptText,
        data: {
          issueNumber: activeIssue.number,
          ...useWorktree && cleanBranch ? { branch: cleanBranch } : {}
        }
      });
      closePreflightModal();
      if (autoMove) {
        void updateIssueStatus(activeIssue, "in-progress");
      }
      await host.toast({
        kind: "success",
        message: `Launched agent session in ${targetDesc}!`
      });
      if (res.sessionId) {
        void host.openSession(res.sessionId);
      }
    } catch (err) {
      addLog(`Failed to start session: ${err.message}`, "error");
      await host.toast({ kind: "error", message: `Failed to launch agent: ${err.message || "Unknown error"}` });
    } finally {
      elBtnPreflightLaunch.disabled = false;
      elBtnPreflightLaunch.textContent = elPreflightWorktreeToggle.checked ? "Launch Worktree & Agent" : "Start Agent Session (Current Workspace)";
    }
  }
  function buildConsolidatedIssuePrompt(selectedIssues) {
    if (!selectedIssues || selectedIssues.length === 0) return "";
    const issueNumbers = selectedIssues.map((i) => `#${i.number}`).join(", ");
    let prompt = `You are assigned to work on multiple packaged GitHub Issues: ${issueNumbers}\n\n`;
    prompt += `### Packaged Tasks Summary (${selectedIssues.length} items):\n`;
    selectedIssues.forEach((issue) => {
      prompt += `- Issue #${issue.number}: ${issue.title}\n`;
    });
    prompt += "\n---\n\n";
    selectedIssues.forEach((issue, idx) => {
      prompt += `## Task ${idx + 1} of ${selectedIssues.length}: #${issue.number} ${issue.title}\n\n`;
      if (issue.body) {
        prompt += `### Overview & Context:\n${issue.body.trim()}\n\n`;
      }
      if (issue.subtasks && issue.subtasks.length > 0) {
        prompt += `### Actionable Subtasks Checklist:\n`;
        issue.subtasks.forEach((s) => {
          prompt += `- [${s.completed ? "x" : " "}] ${s.text}\n`;
        });
        prompt += "\n";
      }
      prompt += "---\n\n";
    });
    prompt += `Please inspect the codebase, address all packaged issues sequentially or in coordination, verify each with tests, and report back.`;
    return prompt;
  }
  function updateBatchBar() {
    const count = selectedIssueNumbers.size;
    if (count > 0) {
      document.body.classList.add("selection-active");
      if (elBatchActionBar) elBatchActionBar.style.display = "flex";
      if (elBatchCountBadge) elBatchCountBadge.textContent = `${count} selected`;
    } else {
      document.body.classList.remove("selection-active");
      if (elBatchActionBar) elBatchActionBar.style.display = "none";
    }
    document.querySelectorAll(".card").forEach((cardEl) => {
      const num = Number(cardEl.dataset.issueNumber);
      const isSelected = selectedIssueNumbers.has(num);
      cardEl.classList.toggle("is-selected", isSelected);
      const cb = cardEl.querySelector(".card-checkbox");
      if (cb) cb.checked = isSelected;
    });
  }
  function clearSelection() {
    selectedIssueNumbers.clear();
    updateBatchBar();
  }
  function toggleIssueSelection(issueNumber) {
    if (selectedIssueNumbers.has(issueNumber)) {
      selectedIssueNumbers.delete(issueNumber);
    } else {
      selectedIssueNumbers.add(issueNumber);
    }
    updateBatchBar();
  }
  async function launchPackagedSession() {
    const selected = issues.filter((i) => selectedIssueNumbers.has(i.number));
    if (selected.length === 0 || !currentProject) return;
    const promptText = buildConsolidatedIssuePrompt(selected);
    const title = `Packaged Tasks (${selected.length}): ${selected.map((i) => `#${i.number}`).join(", ")}`.slice(0, 150);
    try {
      addLog(`Launching packaged session for ${selected.length} issues...`);
      const res = await host.startSession({
        projectId: currentProject.id,
        worktree: false,
        providerId: "github-task-board",
        id: `package-${Date.now()}`,
        title,
        text: promptText,
        data: {
          packaged: true,
          issueNumbers: selected.map((i) => i.number)
        }
      });
      clearSelection();
      await host.toast({
        kind: "success",
        message: `Launched packaged session with ${selected.length} issues!`
      });
      if (res.sessionId) {
        void host.openSession(res.sessionId);
      }
    } catch (err) {
      addLog(`Failed to start packaged session: ${err.message}`, "error");
      await host.toast({ kind: "error", message: `Failed to package issues: ${err.message || "Unknown error"}` });
    }
  }
  async function launchBatchSeparateSessions() {
    const selected = issues.filter((i) => selectedIssueNumbers.has(i.number));
    if (selected.length === 0 || !currentProject) return;
    clearSelection();
    await host.toast({ kind: "info", message: `Launching ${selected.length} agent sessions...` });
    let successCount = 0;
    for (const issue of selected) {
      try {
        const payload = {
          projectId: currentProject.id,
          worktree: false,
          providerId: "github-task-board",
          id: String(issue.number),
          title: `#${issue.number} ${issue.title || ""}`.slice(0, 150),
          url: (issue.html_url || "").slice(0, 1e3),
          text: `You are assigned to work on GitHub Issue #${issue.number}: ${issue.title}\n\n${issue.body ? `### Description:\n${issue.body}\n\n` : ""}Please inspect the codebase in this workspace, implement the solution, verify with tests, and report back.`,
          data: {
            issueNumber: issue.number
          }
        };
        await host.startSession(payload);
        void updateIssueStatus(issue, "in-progress");
        successCount++;
      } catch (err) {
        addLog(`Failed to start session for #${issue.number}: ${err.message}`, "error");
      }
    }
    await host.toast({ kind: "success", message: `Successfully launched ${successCount} of ${selected.length} sessions.` });
  }
  async function attachSelectedIssues() {
    const selected = issues.filter((i) => selectedIssueNumbers.has(i.number));
    if (selected.length === 0) return;
    for (const issue of selected) {
      try {
        const payload = buildIssueAttachPayload(issue);
        await host.attach(payload);
      } catch {}
    }
    clearSelection();
    await host.toast({ kind: "success", message: `Attached ${selected.length} issue chips to composer` });
  }
  var DEFAULT_AI_ISSUE_PROMPT = `You are an expert software engineer creating GitHub issues for repository "{repo}".

Input Objective / User Mind-Dump:
{userInput}

Instructions for the Agent:
1. Analyze the user's input. If the user described multiple independent tasks, bugs, or features, decompose them into distinct, well-scoped GitHub issues. If it describes a single topic, create one focused issue.
2. Ground all details in the actual codebase by inspecting relevant project files, function names, and architecture.
3. Every generated issue must follow this exact structure tailored for the OpenChamber Task Board:
   - Title: Conventional commit format (e.g. "feat(auth): add remember-me token refresh" or "fix(ui): prevent horizontal overflow in mobile table").
   - Overview: Clear description of the problem, motivation, or user value.
   - Files Impacted: List candidate file paths grounded in the codebase.
   - Actionable Subtasks Checklist: Mandatory interactive Markdown checkboxes (- [ ]) for each discrete implementation and verification step:
     - [ ] Reproduce with test / define contract
     - [ ] Implement core changes
     - [ ] Run test suite and verify green
   - Recommended Worktree Branch: Suggest an isolated git branch name following "issue-<number>-<slug>".
   - Labels: Recommend labels (e.g. "bug", "enhancement", "documentation").
4. If a GitHub token or gh CLI is available in the environment, you can create the issues directly using the GitHub API. Otherwise, present the complete, ready-to-copy issue titles and bodies for user review.`;
  function resolveAiIssuePrompt({
    repo,
    userInput,
    storedRepoPrompt,
    storedGlobalPrompt
  }) {
    const template = storedRepoPrompt?.trim() || storedGlobalPrompt?.trim() || DEFAULT_AI_ISSUE_PROMPT;
    return template.replace(/\{repo\}/g, repo).replace(/\{userInput\}/g, userInput.trim());
  }
  var elNewIssueModalBackdrop = document.getElementById("newIssueModalBackdrop");
  var elNewIssueRepoTarget = document.getElementById("newIssueRepoTarget");
  var elBtnSwitchAI = document.getElementById("btnSwitchAI");
  var elBtnSwitchManual = document.getElementById("btnSwitchManual");
  var elPaneNewIssueAI = document.getElementById("paneNewIssueAI");
  var elPaneNewIssueManual = document.getElementById("paneNewIssueManual");
  var elFootNewIssueAI = document.getElementById("footNewIssueAI");
  var elFootNewIssueManual = document.getElementById("footNewIssueManual");
  var elAiIssueInput = document.getElementById("aiIssueInput");
  var elBtnTogglePromptConfig = document.getElementById("btnTogglePromptConfig");
  var elAiActiveModelBadge = document.getElementById("aiActiveModelBadge");
  var elSelectAiModel = document.getElementById("selectAiModel");
  var elInputCustomAiModel = document.getElementById("inputCustomAiModel");
  var elAiPromptConfigPanel = document.getElementById("aiPromptConfigPanel");
  var elRadioScopeRepo = document.getElementById("radioScopeRepo");
  var elRadioScopeGlobal = document.getElementById("radioScopeGlobal");
  var elAiPromptTemplateTextarea = document.getElementById("aiPromptTemplateTextarea");
  var elBtnResetPromptToDefault = document.getElementById("btnResetPromptToDefault");
  var elBtnSavePromptConfig = document.getElementById("btnSavePromptConfig");
  var elBtnNewIssueAICancel = document.getElementById("btnNewIssueAICancel");
  var elBtnLaunchAISession = document.getElementById("btnLaunchAISession");
  var elNewIssueTitleInput = document.getElementById("newIssueTitleInput");
  var elNewIssueComplexitySelect = document.getElementById("newIssueComplexitySelect");
  var elNewIssueBodyInput = document.getElementById("newIssueBodyInput");
  var elNewIssueSubtasksList = document.getElementById("newIssueSubtasksList");
  var elInputNewIssueDraftSubtask = document.getElementById("inputNewIssueDraftSubtask");
  var elBtnAddNewIssueDraftSubtask = document.getElementById("btnAddNewIssueDraftSubtask");
  var elDraftSubtasksCountBadge = document.getElementById("draftSubtasksCountBadge");
  var elBtnNewIssueSubmit = document.getElementById("btnNewIssueSubmit");
  var elBtnNewIssueCancel = document.getElementById("btnNewIssueCancel");
  var elBtnNewIssueClose = document.getElementById("btnNewIssueClose");
  var draftSubtasks = [];
  var currentNewIssueMode = "ai";
  function setNewIssueMode(mode) {
    currentNewIssueMode = mode;
    elBtnSwitchAI.classList.toggle("active", mode === "ai");
    elBtnSwitchManual.classList.toggle("active", mode === "manual");
    elPaneNewIssueAI.style.display = mode === "ai" ? "flex" : "none";
    elPaneNewIssueManual.style.display = mode === "manual" ? "flex" : "none";
    elFootNewIssueAI.style.display = mode === "ai" ? "flex" : "none";
    elFootNewIssueManual.style.display = mode === "manual" ? "flex" : "none";
    if (mode === "ai") {
      setTimeout(() => elAiIssueInput.focus(), 50);
    } else {
      setTimeout(() => elNewIssueTitleInput.focus(), 50);
    }
  }
  function resolveAiDraftingModel({ storedRepoModel, storedGlobalModel, defaultModel = "default" }) {
    if (storedRepoModel && typeof storedRepoModel === "string" && storedRepoModel.trim() && storedRepoModel.trim() !== "default") {
      return storedRepoModel.trim();
    }
    if (storedGlobalModel && typeof storedGlobalModel === "string" && storedGlobalModel.trim() && storedGlobalModel.trim() !== "default") {
      return storedGlobalModel.trim();
    }
    return defaultModel;
  }
  function setModelEditorValue(modelValue) {
    if (!elSelectAiModel) return;
    const standardOptions = ["default", "gemini-2.5-flash", "gemini-2.5-pro", "claude-3-7-sonnet", "gpt-4.1"];
    if (standardOptions.includes(modelValue)) {
      elSelectAiModel.value = modelValue;
      if (elInputCustomAiModel) elInputCustomAiModel.style.display = "none";
    } else {
      elSelectAiModel.value = "custom";
      if (elInputCustomAiModel) {
        elInputCustomAiModel.value = modelValue;
        elInputCustomAiModel.style.display = "block";
      }
    }
  }
  function getSelectedModelFromEditor() {
    if (!elSelectAiModel) return "default";
    if (elSelectAiModel.value === "custom") {
      return elInputCustomAiModel?.value.trim() || "default";
    }
    return elSelectAiModel.value;
  }
  async function updateActiveModelBadge() {
    if (!elAiActiveModelBadge) return;
    const storedRepoModel = currentRepo ? await host.storage.get(`ai_issue_model_${currentRepo}`) : null;
    const storedGlobalModel = await host.storage.get("ai_issue_model_global");
    const activeModel = resolveAiDraftingModel({
      storedRepoModel: typeof storedRepoModel === "string" ? storedRepoModel : null,
      storedGlobalModel: typeof storedGlobalModel === "string" ? storedGlobalModel : null
    });
    elAiActiveModelBadge.textContent = activeModel === "default" ? "Auto" : activeModel;
  }
  async function loadPromptConfigForEditor() {
    const isRepoScope = elRadioScopeRepo.checked;
    if (isRepoScope) {
      const storedPrompt = await host.storage.get(`ai_issue_prompt_${currentRepo}`);
      elAiPromptTemplateTextarea.value = typeof storedPrompt === "string" ? storedPrompt : DEFAULT_AI_ISSUE_PROMPT;
      const storedModel = await host.storage.get(`ai_issue_model_${currentRepo}`);
      setModelEditorValue(typeof storedModel === "string" ? storedModel : "default");
    } else {
      const storedPrompt = await host.storage.get("ai_issue_prompt_global");
      elAiPromptTemplateTextarea.value = typeof storedPrompt === "string" ? storedPrompt : DEFAULT_AI_ISSUE_PROMPT;
      const storedModel = await host.storage.get("ai_issue_model_global");
      setModelEditorValue(typeof storedModel === "string" ? storedModel : "default");
    }
  }
  async function savePromptConfig() {
    const isRepoScope = elRadioScopeRepo.checked;
    const text = elAiPromptTemplateTextarea.value.trim();
    const chosenModel = getSelectedModelFromEditor();
    if (!text) return;
    try {
      if (isRepoScope) {
        await host.storage.set(`ai_issue_prompt_${currentRepo}`, text);
        if (chosenModel && chosenModel !== "default") {
          await host.storage.set(`ai_issue_model_${currentRepo}`, chosenModel);
        } else {
          await host.storage.delete(`ai_issue_model_${currentRepo}`);
        }
        addLog(`Saved prompt & model settings for repo ${currentRepo}`, "succ");
        await host.toast({ kind: "success", message: "Saved settings for this repository" });
      } else {
        await host.storage.set("ai_issue_prompt_global", text);
        if (chosenModel && chosenModel !== "default") {
          await host.storage.set("ai_issue_model_global", chosenModel);
        } else {
          await host.storage.delete("ai_issue_model_global");
        }
        addLog("Saved global prompt & model settings", "succ");
        await host.toast({ kind: "success", message: "Saved global settings" });
      }
      await updateActiveModelBadge();
      elAiPromptConfigPanel.style.display = "none";
    } catch (err) {
      addLog(`Failed to save prompt config: ${err.message}`, "error");
      await host.toast({ kind: "error", message: "Failed to save settings" });
    }
  }
  async function resetPromptConfigToDefault() {
    elAiPromptTemplateTextarea.value = DEFAULT_AI_ISSUE_PROMPT;
    setModelEditorValue("default");
    const isRepoScope = elRadioScopeRepo.checked;
    try {
      if (isRepoScope) {
        await host.storage.delete(`ai_issue_prompt_${currentRepo}`);
        await host.storage.delete(`ai_issue_model_${currentRepo}`);
      } else {
        await host.storage.delete("ai_issue_prompt_global");
        await host.storage.delete("ai_issue_model_global");
      }
      await updateActiveModelBadge();
      await host.toast({ kind: "info", message: "Reset settings to default" });
    } catch {
    }
  }
  function serializeDraftSubtasks(body, subtaskTexts) {
    const cleanBody = (body || "").trim();
    const cleanTasks = (subtaskTexts || []).map((t) => typeof t === "string" ? t.trim() : "").filter(Boolean);
    if (cleanTasks.length === 0) {
      return cleanBody;
    }
    const checklistBlock = cleanTasks.map((t) => `- [ ] ${t}`).join("\n");
    if (!cleanBody) {
      return `### Actionable Subtasks Checklist:\n\n${checklistBlock}`;
    }
    if (cleanBody.includes("### Actionable Subtasks Checklist:")) {
      return `${cleanBody}\n${checklistBlock}`;
    }
    return `${cleanBody}\n\n### Actionable Subtasks Checklist:\n\n${checklistBlock}`;
  }
  function isVagueIdea(issue) {
    if (!issue) return true;
    const labels = (issue.labels || []).map((l) => (typeof l === "string" ? l : l.name || "").toLowerCase());
    if (labels.includes("status:needs-alignment")) {
      return true;
    }
    const subtaskCount = (issue.subtasks || []).length;
    const bodyText = (issue.body || "").trim();
    const wordCount = bodyText ? bodyText.split(/\s+/).length : 0;
    return subtaskCount === 0 && wordCount < 20;
  }
  function updateComplexityLabel(currentLabels, newComplexity) {
    const cleanExisting = currentLabels.map((l) => typeof l === "string" ? l : l.name || "").filter((name) => !name.toLowerCase().startsWith("complexity:"));
    if (newComplexity && typeof newComplexity === "string" && newComplexity.trim().toLowerCase() !== "none") {
      cleanExisting.push(`complexity:${newComplexity.trim().toUpperCase()}`);
    }
    return cleanExisting;
  }
  function renderDraftSubtasks() {
    if (!elNewIssueSubtasksList) return;
    elNewIssueSubtasksList.innerHTML = "";
    if (elDraftSubtasksCountBadge) {
      elDraftSubtasksCountBadge.textContent = `${draftSubtasks.length} ${draftSubtasks.length === 1 ? "step" : "steps"}`;
    }
    if (draftSubtasks.length === 0) {
      elNewIssueSubtasksList.innerHTML = `<div style="color: var(--fg-faint); font-size: 11px; padding: 2px 0;">No subtasks added yet.</div>`;
      return;
    }
    draftSubtasks.forEach((task, idx) => {
      const row = document.createElement("div");
      row.style.display = "flex";
      row.style.alignItems = "center";
      row.style.justifyContent = "space-between";
      row.style.padding = "3px 6px";
      row.style.background = "var(--surf-subtle)";
      row.style.borderRadius = "var(--rad-sm)";
      row.style.fontSize = "11.5px";
      row.innerHTML = `
        <div style="display: flex; align-items: center; gap: 6px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
          <span style="color: var(--fg-muted); font-size: 10px; font-family: var(--font-mono);">${idx + 1}.</span>
          <span style="color: var(--fg);">${escapeHtml(task)}</span>
        </div>
        <button class="btn btn-icon btn-sm btn-del-draft-task" type="button" style="width: 18px; height: 18px; font-size: 11px; padding: 0;" title="Remove step">\u2715</button>
      `;
      const btnDel = row.querySelector(".btn-del-draft-task");
      if (btnDel) {
        btnDel.addEventListener("click", () => {
          draftSubtasks.splice(idx, 1);
          renderDraftSubtasks();
        });
      }
      elNewIssueSubtasksList.appendChild(row);
    });
  }
  function openNewIssueModal() {
    if (!currentRepo) {
      openRepoPopover();
      return;
    }
    elNewIssueRepoTarget.textContent = currentRepo;
    elNewIssueTitleInput.value = "";
    elNewIssueBodyInput.value = "";
    if (elNewIssueComplexitySelect) elNewIssueComplexitySelect.value = "M";
    draftSubtasks = [];
    renderDraftSubtasks();
    if (elInputNewIssueDraftSubtask) elInputNewIssueDraftSubtask.value = "";
    elAiIssueInput.value = "";
    elAiPromptConfigPanel.style.display = "none";
    setNewIssueMode("ai");
    void updateActiveModelBadge();
    elNewIssueModalBackdrop.classList.add("active");
    setTimeout(() => elAiIssueInput.focus(), 50);
  }
  function closeNewIssueModal() {
    elNewIssueModalBackdrop.classList.remove("active");
  }
  async function submitNewIssue() {
    const title = elNewIssueTitleInput.value.trim();
    const rawBody = elNewIssueBodyInput.value.trim();
    if (!title) {
      elNewIssueTitleInput.focus();
      return;
    }
    const body = serializeDraftSubtasks(rawBody, draftSubtasks);
    const initialLabels = ["status:todo"];
    const complexity = elNewIssueComplexitySelect ? elNewIssueComplexitySelect.value : "none";
    if (complexity && complexity !== "none") {
      initialLabels.push(`complexity:${complexity.toUpperCase()}`);
    }
    if (isVagueIdea({ title, body, subtasks: draftSubtasks.map((t) => ({ text: t })), labels: [] })) {
      initialLabels.push("status:needs-alignment");
    }
    elBtnNewIssueSubmit.disabled = true;
    elBtnNewIssueSubmit.textContent = "Creating...";
    try {
      addLog(`Creating issue in ${currentRepo}: "${title}"...`);
      const created = await githubRequest("POST", `/repos/${currentRepo}/issues`, {
        title,
        body,
        labels: initialLabels
      });
      addLog(`Created issue #${created.number}: ${created.title}`, "succ");
      await host.toast({ kind: "success", message: `Created #${created.number} on GitHub` });
      closeNewIssueModal();
      issueCache.delete(currentRepo);
      void fetchIssues(true);
    } catch (err) {
      addLog(`Failed to create issue: ${err.message}`, "error");
      await host.toast({ kind: "error", message: `Failed to create issue: ${err.message || "Unknown error"}` });
    } finally {
      elBtnNewIssueSubmit.disabled = false;
      elBtnNewIssueSubmit.textContent = "Create Issue";
    }
  }
  async function launchAiIssueSession() {
    const userInput = elAiIssueInput.value.trim();
    if (!userInput) {
      elAiIssueInput.focus();
      return;
    }
    const storedRepoPrompt = await host.storage.get(`ai_issue_prompt_${currentRepo}`);
    const storedGlobalPrompt = await host.storage.get("ai_issue_prompt_global");
    const promptText = resolveAiIssuePrompt({
      repo: currentRepo,
      userInput,
      storedRepoPrompt: typeof storedRepoPrompt === "string" ? storedRepoPrompt : null,
      storedGlobalPrompt: typeof storedGlobalPrompt === "string" ? storedGlobalPrompt : null
    });
    const storedRepoModel = await host.storage.get(`ai_issue_model_${currentRepo}`);
    const storedGlobalModel = await host.storage.get("ai_issue_model_global");
    const activeModel = resolveAiDraftingModel({
      storedRepoModel: typeof storedRepoModel === "string" ? storedRepoModel : null,
      storedGlobalModel: typeof storedGlobalModel === "string" ? storedGlobalModel : null
    });
    const firstLine = userInput.split("\n")[0].replace(/[^a-zA-Z0-9\s-_]/g, "").trim().slice(0, 50);
    elBtnLaunchAISession.disabled = true;
    elBtnLaunchAISession.textContent = "Starting AI Session...";
    try {
      const modelDesc = activeModel === "default" ? "auto" : activeModel;
      addLog(`Launching AI issue drafting session (model: ${modelDesc})...`);
      const res = await host.startSession({
        projectId: currentProject?.id,
        worktree: false,
        model: activeModel !== "default" ? activeModel : void 0,
        navigation: "open",
        providerId: "github-task-board",
        id: `draft-${Date.now()}`,
        title: `Draft: ${firstLine || "GitHub Issues"}`,
        url: `https://github.com/${currentRepo}/issues`,
        text: promptText,
        data: {
          drafting: true,
          repo: currentRepo,
          ...activeModel !== "default" ? { model: activeModel } : {}
        }
      });
      closeNewIssueModal();
      await host.toast({
        kind: "success",
        message: "Launched AI drafting session"
      });
      if (res.sessionId) {
        void host.openSession(res.sessionId);
      }
    } catch (err) {
      addLog(`Failed to start AI session: ${err.message}`, "error");
      await host.toast({ kind: "error", message: `Failed to start session: ${err.message}` });
    } finally {
      elBtnLaunchAISession.disabled = false;
      elBtnLaunchAISession.textContent = "Launch AI Drafting Session";
    }
  }
  function setupDragAndDrop() {
    Object.keys(kanbanCardContainers).forEach((colId) => {
      const container = kanbanCardContainers[colId];
      container.addEventListener("dragover", (e) => {
        e.preventDefault();
        if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
        container.classList.add("drag-over");
      });
      container.addEventListener("dragleave", () => {
        container.classList.remove("drag-over");
      });
      container.addEventListener("drop", (e) => {
        e.preventDefault();
        container.classList.remove("drag-over");
        const issueNum = draggedIssueNumber || Number(e.dataTransfer?.getData("text/plain"));
        if (!issueNum) return;
        const issue = issues.find((i) => i.number === issueNum);
        if (issue) {
          void updateIssueStatus(issue, colId);
        }
      });
    });
  }
  function initEvents() {
    elBtnRepoSelect.addEventListener("click", (e) => {
      e.stopPropagation();
      if (elRepoPopover.classList.contains("active")) {
        closeRepoPopover();
      } else {
        openRepoPopover();
      }
    });
    document.addEventListener("click", (e) => {
      if (!elRepoPopover.contains(e.target) && !elBtnRepoSelect.contains(e.target)) {
        closeRepoPopover();
      }
    });
    elBtnSaveCustomRepo.addEventListener("click", () => {
      const custom = elInputCustomRepo.value.trim();
      if (custom && custom.includes("/")) {
        setRepository(custom, "custom-input");
        closeRepoPopover();
      }
    });
    elSearchInput.addEventListener("input", (e) => {
      searchQuery = e.target.value;
      renderViews();
    });
    elBtnLayoutToggle.addEventListener("click", () => {
      if (document.body.getAttribute("data-layout") === "kanban") {
        userLayoutPreference = "list";
      } else {
        userLayoutPreference = "kanban";
      }
      applyLayoutMode();
    });
    window.addEventListener("resize", () => {
      if (userLayoutPreference === "auto") {
        applyLayoutMode();
      }
    });
    elBtnRefresh.addEventListener("click", () => {
      void fetchIssues();
      void discoverWorkspaceRepositories();
    });
    const elBtnArchiveToggle = document.getElementById("btnArchiveToggle");
    if (elBtnArchiveToggle) {
      elBtnArchiveToggle.addEventListener("click", () => {
        showArchivedOnly = !showArchivedOnly;
        elBtnArchiveToggle.classList.toggle("active", showArchivedOnly);
        elBtnArchiveToggle.title = showArchivedOnly ? "Viewing Archived (Click to show active issues)" : "Toggle Archived Issues View";
        renderViews();
        void host.toast({
          kind: "info",
          message: showArchivedOnly ? "Viewing archived issues" : "Viewing active issues"
        });
      });
    }
    if (elBtnFilterToggle && elFilterBar) {
      elBtnFilterToggle.addEventListener("click", () => {
        isFilterBarOpen = !isFilterBarOpen;
        elFilterBar.style.display = isFilterBarOpen ? "flex" : "none";
        elBtnFilterToggle.classList.toggle("active", isFilterBarOpen || filterPriority !== "all" || filterTag !== "all" || currentSort !== "newest");
      });
    }
    if (elSelectSort) {
      elSelectSort.addEventListener("change", () => {
        currentSort = elSelectSort.value;
        renderViews();
      });
    }
    if (elSelectGroupBy) {
      elSelectGroupBy.addEventListener("change", () => {
        currentGroupBy = elSelectGroupBy.value;
        renderViews();
      });
    }
    if (elSelectFilterPriority) {
      elSelectFilterPriority.addEventListener("change", () => {
        filterPriority = elSelectFilterPriority.value;
        renderViews();
      });
    }
    if (elSelectFilterTag) {
      elSelectFilterTag.addEventListener("change", () => {
        filterTag = elSelectFilterTag.value;
        renderViews();
      });
    }
    if (elBtnResetFilters) {
      elBtnResetFilters.addEventListener("click", () => {
        currentSort = "newest";
        filterPriority = "all";
        filterTag = "all";
        if (elSelectSort) elSelectSort.value = "newest";
        if (elSelectFilterPriority) elSelectFilterPriority.value = "all";
        if (elSelectFilterTag) elSelectFilterTag.value = "all";
        renderViews();
      });
    }
    elBtnNewIssue.addEventListener("click", () => {
      openNewIssueModal();
    });
    elBtnNewIssueClose.addEventListener("click", closeNewIssueModal);
    elBtnNewIssueCancel.addEventListener("click", closeNewIssueModal);
    elBtnNewIssueSubmit.addEventListener("click", () => {
      void submitNewIssue();
    });
    elBtnSwitchAI.addEventListener("click", () => setNewIssueMode("ai"));
    elBtnSwitchManual.addEventListener("click", () => setNewIssueMode("manual"));
    elBtnNewIssueAICancel.addEventListener("click", closeNewIssueModal);
    elBtnLaunchAISession.addEventListener("click", () => {
      void launchAiIssueSession();
    });
    elBtnTogglePromptConfig.addEventListener("click", () => {
      const isHidden = elAiPromptConfigPanel.style.display === "none";
      if (isHidden) {
        elAiPromptConfigPanel.style.display = "flex";
        void loadPromptConfigForEditor();
      } else {
        elAiPromptConfigPanel.style.display = "none";
      }
    });
    elRadioScopeRepo.addEventListener("change", () => {
      void loadPromptConfigForEditor();
    });
    elRadioScopeGlobal.addEventListener("change", () => {
      void loadPromptConfigForEditor();
    });
    elBtnSavePromptConfig.addEventListener("click", () => {
      void savePromptConfig();
    });
    elBtnResetPromptToDefault.addEventListener("click", () => {
      void resetPromptConfigToDefault();
    });
    if (elSelectAiModel && elInputCustomAiModel) {
      elSelectAiModel.addEventListener("change", () => {
        elInputCustomAiModel.style.display = elSelectAiModel.value === "custom" ? "block" : "none";
        if (elSelectAiModel.value === "custom") {
          elInputCustomAiModel.focus();
        }
      });
    }
    elBtnLogsToggle.addEventListener("click", () => {
      elLogDrawer.classList.toggle("active");
    });
    elBtnLogDrawerClose.addEventListener("click", () => {
      elLogDrawer.classList.remove("active");
    });
    elBtnClearLogs.addEventListener("click", () => {
      logEntries.length = 0;
      const streamEl = document.getElementById("logStream");
      if (streamEl) streamEl.innerHTML = "";
    });
    elBtnCopyLogs.addEventListener("click", () => {
      const text = logEntries.map((e) => `[${e.time}] [${e.level.toUpperCase()}] ${e.msg}`).join("\n");
      void host.writeClipboard(text);
      void host.toast({ kind: "info", message: "Copied logs to clipboard" });
    });
    elStatusTabBar.querySelectorAll(".status-tab").forEach((tab) => {
      tab.addEventListener("click", () => {
        userSelectedTab = true;
        const targetTab = tab.getAttribute("data-tab") || "all";
        selectTab(targetTab);
        renderListView(issues);
      });
    });
    elBtnDrawerClose.addEventListener("click", closeDrawer);
    elDrawerScrim.addEventListener("click", closeDrawer);
    if (elDrawerPrioritySelect) {
      elDrawerPrioritySelect.addEventListener("change", async () => {
        if (!activeIssue || !currentRepo) return;
        const val = elDrawerPrioritySelect.value;
        const updatedLabels = updatePriorityLabels(activeIssue.labels, val);
        activeIssue.labels = updatedLabels.map((name) => ({ name }));
        if (currentRepo) issueCache.delete(currentRepo);
        renderDrawer(activeIssue);
        renderViews();
        try {
          await githubRequest("PATCH", `/repos/${currentRepo}/issues/${activeIssue.number}`, {
            labels: updatedLabels
          });
          await host.toast({ kind: "info", message: `Updated priority on #${activeIssue.number} to ${val}` });
        } catch (err) {
          addLog(`Failed to update priority: ${err.message}`, "error");
        }
      });
    }
    elDrawerStatusSelect.addEventListener("change", () => {
      if (activeIssue) {
        const val = elDrawerStatusSelect.value;
        if (val === "none") {
          const filteredLabels = activeIssue.labels
            .map((l) => typeof l === "string" ? l : l.name || "")
            .filter((name) => !name.startsWith("status:"));
          activeIssue.labels = filteredLabels.map((name) => ({ name }));
          if (currentRepo) issueCache.delete(currentRepo);
          renderViews();
          renderDrawer(activeIssue);
          void githubRequest("PATCH", `/repos/${currentRepo}/issues/${activeIssue.number}`, {
            labels: filteredLabels
          });
        } else {
          const targetCol = val;
          void updateIssueStatus(activeIssue, targetCol);
        }
      }
    });
    if (elDrawerComplexitySelect) {
      elDrawerComplexitySelect.addEventListener("change", async () => {
        if (!activeIssue || !currentRepo) return;
        const val = elDrawerComplexitySelect.value;
        const updatedLabels = updateComplexityLabel(activeIssue.labels, val);
        activeIssue.labels = updatedLabels.map((name) => ({ name }));
        if (currentRepo) issueCache.delete(currentRepo);
        renderDrawer(activeIssue);
        renderViews();
        try {
          await githubRequest("PATCH", `/repos/${currentRepo}/issues/${activeIssue.number}`, {
            labels: updatedLabels
          });
          await host.toast({ kind: "info", message: `Updated complexity on #${activeIssue.number} to ${val}` });
        } catch (err) {
          addLog(`Failed to update complexity: ${err.message}`, "error");
        }
      });
    }
    if (elBtnAddNewIssueDraftSubtask && elInputNewIssueDraftSubtask) {
      const addDraftStep = () => {
        const text = elInputNewIssueDraftSubtask.value.trim();
        if (!text) return;
        draftSubtasks.push(text);
        elInputNewIssueDraftSubtask.value = "";
        renderDraftSubtasks();
      };
      elBtnAddNewIssueDraftSubtask.addEventListener("click", addDraftStep);
      elInputNewIssueDraftSubtask.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          addDraftStep();
        }
      });
    }
    elBtnEditDescription.addEventListener("click", () => {
      if (!activeIssue) return;
      elDrawerDescriptionTextarea.value = activeIssue.body || "";
      elDrawerDescriptionViewBox.style.display = "none";
      elDrawerDescriptionEditBox.style.display = "flex";
      elDrawerDescriptionTextarea.focus();
    });
    elBtnCancelDescription.addEventListener("click", () => {
      elDrawerDescriptionEditBox.style.display = "none";
      elDrawerDescriptionViewBox.style.display = "block";
    });
    elBtnSaveDescription.addEventListener("click", async () => {
      if (!activeIssue) return;
      const newBody = elDrawerDescriptionTextarea.value;
      elDrawerDescriptionEditBox.style.display = "none";
      elDrawerDescriptionViewBox.style.display = "block";
      await updateIssueBody(activeIssue, newBody);
    });
    elBtnToggleCollapse.addEventListener("click", () => {
      const isExpanded = elDrawerDescriptionCollapsible.classList.toggle("expanded");
      elBtnToggleCollapse.textContent = isExpanded ? "Show less" : "Show more";
    });
    elBtnAddLabelToggle.addEventListener("click", () => {
      elDrawerAddLabelRow.style.display = "flex";
      elInputNewTag.value = "";
      elInputNewTag.focus();
      void loadRepoLabels();
    });
    elBtnCancelAddLabel.addEventListener("click", () => {
      elDrawerAddLabelRow.style.display = "none";
    });
    elBtnConfirmAddLabel.addEventListener("click", async () => {
      if (activeIssue && elInputNewTag.value.trim()) {
        const val = elInputNewTag.value.trim();
        elDrawerAddLabelRow.style.display = "none";
        await addTagToIssue(activeIssue, val);
      }
    });
    elInputNewTag.addEventListener("keydown", (e) => {
      if (e.key === "Enter") elBtnConfirmAddLabel.click();
      if (e.key === "Escape") elBtnCancelAddLabel.click();
    });
    elBtnAddSubtask.addEventListener("click", () => {
      if (activeIssue && elInputAddSubtask.value.trim()) {
        const newBody = appendSubtaskToMarkdown(activeIssue.body, elInputAddSubtask.value);
        elInputAddSubtask.value = "";
        void updateIssueBody(activeIssue, newBody);
      }
    });
    elInputAddSubtask.addEventListener("keydown", (e) => {
      if (e.key === "Enter") elBtnAddSubtask.click();
    });
    elBtnDrawerAttachComposer.addEventListener("click", async () => {
      if (!activeIssue) return;
      try {
        const payload = buildIssueAttachPayload(activeIssue);
        await host.attach(payload);
        await host.toast({ kind: "success", message: `Attached #${activeIssue.number} to composer chip` });
      } catch (err) {
        await host.toast({ kind: "error", message: `Failed to attach: ${err.message || "Unknown error"}` });
      }
    });
    elBtnDrawerOpenPreflight.addEventListener("click", () => {
      if (activeIssue) openPreflightModal(activeIssue);
    });
    elBtnPreflightCancel.addEventListener("click", closePreflightModal);
    elBtnPreflightClose.addEventListener("click", closePreflightModal);
    elBtnPreflightLaunch.addEventListener("click", () => {
      void launchAgentSession();
    });
    if (elPreflightWorktreeToggle) {
      elPreflightWorktreeToggle.addEventListener("change", () => {
        const isChecked = elPreflightWorktreeToggle.checked;
        elPreflightWorktreeSection.style.display = isChecked ? "flex" : "none";
        elBtnPreflightLaunch.textContent = isChecked ? "Launch Worktree & Agent" : "Start Agent Session (Current Workspace)";
        updatePreflightBrief();
      });
    }
    if (elRadioWorktreeTag) {
      elRadioWorktreeTag.addEventListener("change", () => {
        syncPreflightBranchInput();
      });
    }
    if (elRadioWorktreeIssue) {
      elRadioWorktreeIssue.addEventListener("change", () => {
        syncPreflightBranchInput();
      });
    }
    if (elBtnBatchPackage) {
      elBtnBatchPackage.addEventListener("click", () => {
        void launchPackagedSession();
      });
    }
    if (elBtnBatchStart) {
      elBtnBatchStart.addEventListener("click", () => {
        void launchBatchSeparateSessions();
      });
    }
    if (elBtnBatchAttach) {
      elBtnBatchAttach.addEventListener("click", () => {
        void attachSelectedIssues();
      });
    }
    if (elBtnBatchDeselect) {
      elBtnBatchDeselect.addEventListener("click", () => {
        clearSelection();
      });
    }
    if (elBtnStartTagIssues) {
      elBtnStartTagIssues.addEventListener("click", () => {
        if (filterTag === "all") return;
        const taggedIssues = issues.filter((i) =>
          (i.labels || []).some((l) => (typeof l === "string" ? l : l.name || "") === filterTag)
        );
        taggedIssues.forEach((i) => selectedIssueNumbers.add(i.number));
        updateBatchBar();
        void host.toast({ kind: "info", message: `Selected ${taggedIssues.length} issues with tag "${filterTag}"` });
      });
    }
    setupDragAndDrop();
  }
  host.onReady(async (ctx) => {
    addLog(`Host ready. Surface: ${ctx.surface}, Directory: ${ctx.directory || "none"}`);
    applyHostReady(ctx, document.documentElement);
    currentDirectory = ctx.directory || "";
    if (ctx.settings && ctx.settings.repo) {
      currentRepo = ctx.settings.repo.trim();
      elTxtRepoLabel.textContent = currentRepo.split("/")[1] || currentRepo;
      addLog(`Repo set from extension settings: ${currentRepo}`, "info");
    }
    await discoverWorkspaceRepositories();
  });
  host.onDirectory(async (dir) => {
    addLog(`Directory changed: ${dir}`);
    currentDirectory = dir || "";
    if (dir) {
      await autoResolveRepoForActiveContext();
    }
  });
  host.onSession(async (sess) => {
    if (sess) {
      addLog(`Active session: "${sess.title}" (${sess.id})`);
      const matched = sessions.find((s) => s.id === sess.id);
      if (matched && matched.directory && matched.directory !== currentDirectory) {
        currentDirectory = matched.directory;
        await autoResolveRepoForActiveContext();
      }
    }
  });
  initEvents();
})();
