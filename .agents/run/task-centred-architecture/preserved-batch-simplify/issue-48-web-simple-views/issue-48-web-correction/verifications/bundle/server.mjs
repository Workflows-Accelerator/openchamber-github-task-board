#!/usr/bin/env node

// web/server/config.ts
import { randomBytes, scrypt, scryptSync, timingSafeEqual } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { isIP } from "node:net";
var SCRYPT_PARAMS = { N: 16384, r: 8, p: 1, keylen: 32 };
var MIN_PASSWORD_LENGTH = 8;
var MIN_SESSION_SECRET_LENGTH = 32;
var DEFAULT_PORT = 8787;
var DEFAULT_HOST = "127.0.0.1";
var DEFAULT_GITHUB_API_BASE = "https://api.github.com";
var DEFAULT_SESSION_FILE = ".openchamber-data/board/sessions.json";
var ConfigError = class extends Error {
  variable;
  constructor(variable, message) {
    super(message);
    this.name = "ConfigError";
    this.variable = variable;
  }
};
var loginPattern = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/;
var repoPattern = /^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/;
function read(env, variable) {
  const value = env[variable];
  if (typeof value !== "string") return void 0;
  return value;
}
function requireValue(env, variable, invalidMessage, validate) {
  const raw = read(env, variable);
  if (raw === void 0 || raw.trim() === "") {
    throw new ConfigError(variable, `${variable} is required`);
  }
  if (!validate(raw)) {
    throw new ConfigError(variable, invalidMessage);
  }
  return raw;
}
function parseRepo(value) {
  const match = repoPattern.exec(value);
  if (!match) {
    throw new ConfigError("BOARD_REPO", "BOARD_REPO must look like owner/name");
  }
  const owner = match[1];
  const name = match[2];
  if (owner === "." || owner === ".." || name === "." || name === "..") {
    throw new ConfigError("BOARD_REPO", "BOARD_REPO must look like owner/name");
  }
  return { owner, name, full: `${owner}/${name}` };
}
function parsePort(value) {
  if (value === void 0 || value.trim() === "") return DEFAULT_PORT;
  if (!/^\d{1,5}$/.test(value.trim())) {
    throw new ConfigError("BOARD_PORT", "BOARD_PORT must be an integer between 1 and 65535");
  }
  const port = Number(value.trim());
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new ConfigError("BOARD_PORT", "BOARD_PORT must be an integer between 1 and 65535");
  }
  return port;
}
function parseHost(value) {
  if (value === void 0 || value.trim() === "") return DEFAULT_HOST;
  const host = value.trim();
  if (isIP(host)) {
    return host;
  }
  if (/^[\d.]+$/.test(host) || host.includes(":")) {
    throw new ConfigError("BOARD_HOST", "BOARD_HOST must be a valid host or IP address");
  }
  const hostnamePattern = /^(?=.{1,253}$)(?:(?!-)[A-Za-z0-9-]{1,63}(?<!-)\.)*(?!-)[A-Za-z0-9-]{1,63}(?<!-)$/;
  if (!hostnamePattern.test(host)) {
    throw new ConfigError("BOARD_HOST", "BOARD_HOST must be a valid host or IP address");
  }
  return host;
}
function parseBaseUrl(value) {
  if (value === void 0 || value.trim() === "") return null;
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new ConfigError("BOARD_BASE_URL", "BOARD_BASE_URL must be an absolute http(s) URL");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new ConfigError("BOARD_BASE_URL", "BOARD_BASE_URL must be an absolute http(s) URL");
  }
  if (url.search || url.hash) {
    throw new ConfigError("BOARD_BASE_URL", "BOARD_BASE_URL must not contain a query or fragment");
  }
  return url.origin + url.pathname.replace(/\/+$/, "");
}
var HASH_PREFIX = "scrypt";
function isPowerOfTwo(value) {
  return value > 0 && (value & value - 1) === 0;
}
function parsePasswordHash(stored) {
  if (typeof stored !== "string") return null;
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== HASH_PREFIX) return null;
  const N = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  if (!Number.isInteger(N) || !isPowerOfTwo(N) || N < 1 << 14 || N > 1 << 20) return null;
  if (!Number.isInteger(r) || r < 1 || r > 16) return null;
  if (!Number.isInteger(p) || p < 1 || p > 16) return null;
  let salt;
  let key;
  try {
    salt = Buffer.from(parts[4], "base64");
    key = Buffer.from(parts[5], "base64");
  } catch {
    return null;
  }
  if (salt.length < 16 || key.length < 32) return null;
  return { N, r, p, salt, key };
}
function hashPassword(password, salt = randomBytes(16)) {
  const { N, r, p, keylen } = SCRYPT_PARAMS;
  const key = scryptSync(password, salt, keylen, { N, r, p });
  return [HASH_PREFIX, N, r, p, salt.toString("base64"), key.toString("base64")].join("$");
}
async function verifyPasswordAsync(password, stored) {
  if (typeof password !== "string" || password.length === 0) return false;
  const parsed = parsePasswordHash(stored);
  if (!parsed) return false;
  return new Promise((resolve) => {
    scrypt(
      password,
      parsed.salt,
      parsed.key.length,
      { N: parsed.N, r: parsed.r, p: parsed.p },
      (err, derived) => {
        if (err || !derived || derived.length !== parsed.key.length) {
          resolve(false);
          return;
        }
        resolve(timingSafeEqual(derived, parsed.key));
      }
    );
  });
}
function resolveSessionFilePath(env = process.env) {
  const envFile = read(env, "BOARD_SESSION_FILE");
  if (envFile !== void 0 && envFile.trim() !== "") {
    const trimmed = envFile.trim();
    if (path.isAbsolute(trimmed)) return trimmed;
    if (fs.existsSync("/workspace") && fs.statSync("/workspace").isDirectory()) {
      return path.resolve("/workspace", trimmed);
    }
    return path.resolve(process.cwd(), trimmed);
  }
  const dataDir = read(env, "OPENCHAMBER_DATA_DIR");
  if (dataDir !== void 0 && dataDir.trim() !== "") {
    return path.resolve(dataDir.trim(), "board", "sessions.json");
  }
  if (fs.existsSync("/workspace/.openchamber-data/board")) {
    return "/workspace/.openchamber-data/board/sessions.json";
  }
  if (fs.existsSync("/workspace") && fs.statSync("/workspace").isDirectory()) {
    return path.resolve("/workspace", DEFAULT_SESSION_FILE);
  }
  const home = read(env, "HOME") || (typeof os !== "undefined" && os.homedir ? os.homedir() : "");
  if (home) {
    return path.resolve(home, ".openchamber-data", "board", "sessions.json");
  }
  return path.resolve(process.cwd(), DEFAULT_SESSION_FILE);
}
function loadConfig(env) {
  const githubToken = requireValue(
    env,
    "BOARD_GITHUB_TOKEN",
    "BOARD_GITHUB_TOKEN must be a single token with no whitespace",
    (value) => value.trim().length >= 10 && !/\s/.test(value.trim())
  );
  const githubLogin = requireValue(
    env,
    "BOARD_GITHUB_LOGIN",
    "BOARD_GITHUB_LOGIN must be a GitHub account name",
    (value) => loginPattern.test(value.trim())
  );
  const repoRaw = read(env, "BOARD_REPO");
  const sessionSecret = requireValue(
    env,
    "BOARD_SESSION_SECRET",
    `BOARD_SESSION_SECRET must be at least ${MIN_SESSION_SECRET_LENGTH} characters`,
    (value) => value.length >= MIN_SESSION_SECRET_LENGTH
  );
  const passwordHashRaw = read(env, "BOARD_PASSWORD_HASH");
  const passwordRaw = read(env, "BOARD_PASSWORD");
  let passwordHash;
  let passwordWasGenerated = false;
  if (passwordHashRaw !== void 0 && passwordHashRaw.trim() !== "") {
    if (!parsePasswordHash(passwordHashRaw.trim())) {
      throw new ConfigError(
        "BOARD_PASSWORD_HASH",
        "BOARD_PASSWORD_HASH must be a scrypt hash produced by web/tools/hash-password.mjs"
      );
    }
    passwordHash = passwordHashRaw.trim();
  } else if (passwordRaw !== void 0 && passwordRaw !== "") {
    if (passwordRaw.length < MIN_PASSWORD_LENGTH) {
      throw new ConfigError(
        "BOARD_PASSWORD",
        `BOARD_PASSWORD must be at least ${MIN_PASSWORD_LENGTH} characters`
      );
    }
    passwordHash = hashPassword(passwordRaw, scryptSync(sessionSecret, "board_password_salt", 16));
    passwordWasGenerated = true;
  } else {
    throw new ConfigError(
      "BOARD_PASSWORD_HASH",
      "BOARD_PASSWORD_HASH or BOARD_PASSWORD is required"
    );
  }
  const port = parsePort(read(env, "BOARD_PORT"));
  const host = parseHost(read(env, "BOARD_HOST"));
  const baseUrl = parseBaseUrl(read(env, "BOARD_BASE_URL"));
  const sessionFilePath = resolveSessionFilePath(env);
  return {
    githubToken: githubToken.trim(),
    githubLogin: githubLogin.trim(),
    repo: repoRaw === void 0 || repoRaw.trim() === "" ? null : parseRepo(repoRaw.trim()),
    passwordHash,
    passwordWasGenerated,
    sessionSecret,
    sessionFilePath,
    port,
    host,
    baseUrl,
    githubApiBase: DEFAULT_GITHUB_API_BASE
  };
}
function describeConfig(config) {
  return {
    repo: config.repo?.full ?? null,
    login: config.githubLogin,
    host: config.host,
    port: config.port,
    baseUrl: config.baseUrl,
    sessionFile: config.sessionFilePath,
    passwordSource: config.passwordWasGenerated ? "BOARD_PASSWORD (hashed at startup)" : "BOARD_PASSWORD_HASH"
  };
}

// web/server/app.ts
import http from "node:http";
import { readFileSync, mkdirSync, writeFileSync, renameSync } from "node:fs";
import path3 from "node:path";
import { createHash as createHash3 } from "node:crypto";

// web/server/auth.ts
import { createHash, createHmac, randomBytes as randomBytes2, timingSafeEqual as timingSafeEqual2 } from "node:crypto";
import fs2 from "node:fs";
import path2 from "node:path";
var SESSION_COOKIE = "board_session";
var THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1e3;
var DEFAULT_ABSOLUTE_TTL_MS = THIRTY_DAYS_MS;
var DEFAULT_IDLE_TTL_MS = THIRTY_DAYS_MS;
var DEFAULT_MAX_SESSIONS = 50;
var DEFAULT_LAST_SEEN_THROTTLE_MS = 6e4;
function deriveCsrfToken(secret, id) {
  return createHmac("sha256", secret).update(`csrf:${id}`).digest("hex");
}
function computePasswordFingerprint(secret, passwordOrHash) {
  return createHmac("sha256", secret).update(`board_pwd_fp:${passwordOrHash}`).digest("hex");
}
function sign(secret, id) {
  return createHmac("sha256", secret).update(`session:${id}`).digest("base64url");
}
function safeEqualStrings(a, b) {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  if (left.length !== right.length || left.length === 0) return false;
  return timingSafeEqual2(left, right);
}
var SessionStore = class {
  secret;
  passwordFingerprint;
  filePath;
  absoluteTtlMs;
  idleTtlMs;
  maxSessions;
  lastSeenThrottleMs;
  now;
  sessions = /* @__PURE__ */ new Map();
  constructor(options) {
    this.secret = options.secret;
    this.passwordFingerprint = options.passwordFingerprint ?? (options.passwordHash ? computePasswordFingerprint(this.secret, options.passwordHash) : computePasswordFingerprint(this.secret, "none"));
    this.filePath = options.filePath;
    this.absoluteTtlMs = options.absoluteTtlMs ?? DEFAULT_ABSOLUTE_TTL_MS;
    this.idleTtlMs = options.idleTtlMs ?? DEFAULT_IDLE_TTL_MS;
    this.maxSessions = options.maxSessions ?? DEFAULT_MAX_SESSIONS;
    this.lastSeenThrottleMs = options.lastSeenThrottleMs ?? DEFAULT_LAST_SEEN_THROTTLE_MS;
    this.now = options.now ?? Date.now;
    this.load();
  }
  get maxAgeSeconds() {
    return Math.max(1, Math.floor(this.absoluteTtlMs / 1e3));
  }
  get size() {
    this.sweep();
    return this.sessions.size;
  }
  hashId(id) {
    return createHash("sha256").update(id).digest("hex");
  }
  load() {
    if (!this.filePath) return;
    try {
      if (!fs2.existsSync(this.filePath)) return;
      const raw = fs2.readFileSync(this.filePath, "utf8");
      const data = JSON.parse(raw);
      if (!data || data.version !== 1 || typeof data.sessions !== "object" || Array.isArray(data.sessions)) {
        return;
      }
      const now = this.now();
      let pruned = false;
      for (const [idHash, rawEntry] of Object.entries(data.sessions)) {
        if (!rawEntry || typeof rawEntry !== "object" || Array.isArray(rawEntry)) {
          pruned = true;
          continue;
        }
        const entry = rawEntry;
        if (typeof entry.createdAt !== "number" || typeof entry.expiresAt !== "number" || typeof entry.lastSeenAt !== "number") {
          pruned = true;
          continue;
        }
        if (!/^[a-f0-9]{64}$/.test(idHash)) {
          pruned = true;
          continue;
        }
        if (typeof entry.passwordFingerprint !== "string" || !safeEqualStrings(entry.passwordFingerprint, this.passwordFingerprint)) {
          pruned = true;
          continue;
        }
        if (now >= entry.expiresAt || now - entry.lastSeenAt >= this.idleTtlMs) {
          pruned = true;
          continue;
        }
        this.sessions.set(idHash, {
          passwordFingerprint: entry.passwordFingerprint,
          ip: typeof entry.ip === "string" ? entry.ip : null,
          createdAt: entry.createdAt,
          lastSeenAt: entry.lastSeenAt,
          expiresAt: entry.expiresAt,
          lastSavedAt: entry.lastSeenAt
        });
      }
      if (pruned) {
        this.persist();
      }
    } catch {
      this.sessions.clear();
    }
  }
  persist() {
    if (!this.filePath) return;
    try {
      const data = {
        version: 1,
        sessions: {}
      };
      for (const [idHash, record] of this.sessions) {
        data.sessions[idHash] = {
          passwordFingerprint: record.passwordFingerprint,
          ip: record.ip,
          createdAt: record.createdAt,
          lastSeenAt: record.lastSeenAt,
          expiresAt: record.expiresAt
        };
      }
      const dir = path2.dirname(this.filePath);
      if (!fs2.existsSync(dir)) {
        fs2.mkdirSync(dir, { recursive: true, mode: 448 });
      }
      const json = JSON.stringify(data, null, 2);
      const tmpPath = `${this.filePath}.${process.pid}.${Date.now()}.${randomBytes2(6).toString("hex")}.tmp`;
      fs2.writeFileSync(tmpPath, json, { mode: 384 });
      try {
        fs2.chmodSync(tmpPath, 384);
      } catch {
      }
      fs2.renameSync(tmpPath, this.filePath);
    } catch {
    }
  }
  create(ip = null) {
    this.sweep();
    while (this.sessions.size >= this.maxSessions) {
      const oldestKey = this.sessions.keys().next().value;
      if (!oldestKey) break;
      this.sessions.delete(oldestKey);
    }
    const now = this.now();
    const id = randomBytes2(24).toString("base64url");
    const csrfToken = deriveCsrfToken(this.secret, id);
    const idHash = this.hashId(id);
    this.sessions.set(idHash, {
      passwordFingerprint: this.passwordFingerprint,
      ip,
      createdAt: now,
      lastSeenAt: now,
      expiresAt: now + this.absoluteTtlMs,
      lastSavedAt: now
    });
    this.persist();
    return {
      id,
      cookieValue: `${id}.${sign(this.secret, id)}`,
      csrfToken,
      maxAgeSeconds: this.maxAgeSeconds
    };
  }
  get(cookieValue) {
    if (!cookieValue || typeof cookieValue !== "string") return null;
    const dot = cookieValue.lastIndexOf(".");
    if (dot <= 0) return null;
    const id = cookieValue.slice(0, dot);
    const signature = cookieValue.slice(dot + 1);
    if (!safeEqualStrings(signature, sign(this.secret, id))) return null;
    const idHash = this.hashId(id);
    const record = this.sessions.get(idHash);
    if (!record) return null;
    if (!record.passwordFingerprint || !safeEqualStrings(record.passwordFingerprint, this.passwordFingerprint)) {
      this.sessions.delete(idHash);
      this.persist();
      return null;
    }
    const now = this.now();
    if (now >= record.expiresAt || now - record.lastSeenAt >= this.idleTtlMs) {
      this.sessions.delete(idHash);
      this.persist();
      return null;
    }
    record.lastSeenAt = now;
    this.sessions.delete(idHash);
    this.sessions.set(idHash, record);
    if (!record.lastSavedAt || now - record.lastSavedAt >= this.lastSeenThrottleMs) {
      record.lastSavedAt = now;
      this.persist();
    }
    return {
      id,
      csrfToken: deriveCsrfToken(this.secret, id),
      ip: record.ip,
      createdAt: record.createdAt,
      lastSeenAt: record.lastSeenAt,
      expiresAt: record.expiresAt
    };
  }
  destroy(cookieValue) {
    if (!cookieValue) return;
    const dot = cookieValue.lastIndexOf(".");
    if (dot <= 0) return;
    const id = cookieValue.slice(0, dot);
    const signature = cookieValue.slice(dot + 1);
    if (!safeEqualStrings(signature, sign(this.secret, id))) return;
    const idHash = this.hashId(id);
    if (this.sessions.has(idHash)) {
      this.sessions.delete(idHash);
      this.persist();
    }
  }
  sweep() {
    const now = this.now();
    let removed = false;
    for (const [idHash, record] of this.sessions) {
      if (now >= record.expiresAt || now - record.lastSeenAt >= this.idleTtlMs || !record.passwordFingerprint || !safeEqualStrings(record.passwordFingerprint, this.passwordFingerprint)) {
        this.sessions.delete(idHash);
        removed = true;
      }
    }
    if (removed) {
      this.persist();
    }
  }
};
function buildSessionCookie(value, maxAgeSeconds) {
  return [
    `${SESSION_COOKIE}=${encodeURIComponent(value)}`,
    "Path=/",
    "HttpOnly",
    "Secure",
    "SameSite=Strict",
    `Max-Age=${Math.max(0, Math.floor(maxAgeSeconds))}`
  ].join("; ");
}
function buildClearCookie() {
  return [
    `${SESSION_COOKIE}=`,
    "Path=/",
    "HttpOnly",
    "Secure",
    "SameSite=Strict",
    "Max-Age=0"
  ].join("; ");
}
function parseCookieHeader(header) {
  const out = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const index = part.indexOf("=");
    if (index <= 0) continue;
    const name = part.slice(0, index).trim();
    if (!name) continue;
    const raw = part.slice(index + 1).trim();
    let value = raw;
    try {
      value = decodeURIComponent(raw);
    } catch {
      value = raw;
    }
    if (!(name in out)) out[name] = value;
  }
  return out;
}
function csrfMatches(expected, provided) {
  if (!expected || !provided) return false;
  return safeEqualStrings(provided, expected);
}
var DEFAULT_MAX_LIMITER_ENTRIES = 1e3;
var LoginRateLimiter = class {
  maxFailures;
  windowMs;
  maxEntries;
  now;
  failures = /* @__PURE__ */ new Map();
  constructor(options = {}) {
    this.maxFailures = options.maxFailures ?? 5;
    this.windowMs = Math.min(options.windowMs ?? 6e4, 6e4);
    this.maxEntries = options.maxEntries ?? DEFAULT_MAX_LIMITER_ENTRIES;
    this.now = options.now ?? Date.now;
  }
  get size() {
    return this.failures.size;
  }
  prune(key) {
    const list = this.failures.get(key);
    if (!list) return [];
    const now = this.now();
    const cutoff = now - this.windowMs;
    let firstValid = 0;
    while (firstValid < list.length && list[firstValid] <= cutoff) {
      firstValid += 1;
    }
    if (firstValid === list.length) {
      this.failures.delete(key);
      return [];
    }
    const recent = firstValid === 0 ? list : list.slice(firstValid);
    this.failures.set(key, recent);
    return recent;
  }
  check(key) {
    const recent = this.prune(key);
    if (recent.length < this.maxFailures) return { allowed: true, retryAfterSeconds: 0 };
    const oldest = recent[0];
    const waitMs = Math.max(0, oldest + this.windowMs - this.now());
    return { allowed: false, retryAfterSeconds: Math.max(1, Math.min(60, Math.ceil(waitMs / 1e3))) };
  }
  recordFailure(key) {
    const recent = this.prune(key);
    if (!this.failures.has(key) && this.failures.size >= this.maxEntries) {
      const oldestKey = this.failures.keys().next().value;
      if (oldestKey) this.failures.delete(oldestKey);
    }
    recent.push(this.now());
    this.failures.delete(key);
    this.failures.set(key, recent);
  }
  recordSuccess(key) {
    this.failures.delete(key);
  }
  reset() {
    this.failures.clear();
  }
};

// web/server/github.ts
var GitHubError = class extends Error {
  status;
  kind;
  jsonParsed;
  data;
  constructor(kind, status, message, options = {}) {
    super(message);
    this.name = "GitHubError";
    this.kind = kind;
    this.status = status;
    this.jsonParsed = options.jsonParsed ?? false;
    this.data = options.data ?? null;
  }
};
var TRANSFER_ISSUE_MUTATION = `
  mutation TransferIssue($issueId: ID!, $repositoryId: ID!) {
    transferIssue(input: { issueId: $issueId, repositoryId: $repositoryId }) {
      issue {
        id
        number
        url
        repository {
          nameWithOwner
        }
      }
    }
  }
`;
var MAX_BODY_BYTES = 2 * 1024 * 1024;
function kindForStatus(status, headers, data, jsonParsed = false, method = "GET") {
  if (!jsonParsed || !data || typeof data !== "object") {
    return "server";
  }
  if (status === 401) return "unauthorized";
  if (status === 403) {
    const remaining = headers?.get("x-ratelimit-remaining");
    const msg = typeof data?.message === "string" ? data.message.toLowerCase() : "";
    if (remaining === "0" || msg.includes("rate limit")) {
      return "rate_limited";
    }
    return "forbidden";
  }
  if (status === 404) return "not_found";
  if (status === 422) {
    if (method === "GET" && typeof data.message === "string" && data.message.toLowerCase() === "validation failed") {
      return "invalid";
    }
    if (data.message === "Validation Failed" && Array.isArray(data.errors) && data.errors.length > 0 && data.errors.every(
      (error) => error && typeof error === "object" && !Array.isArray(error) && typeof error.resource === "string" && error.resource.length > 0 && typeof error.field === "string" && error.field.length > 0 && ["missing", "missing_field", "invalid", "already_exists", "unprocessable", "custom"].includes(error.code)
    )) {
      return "invalid";
    }
    return "server";
  }
  if (status === 429) return "rate_limited";
  return "server";
}
var GitHubClient = class {
  apiBase;
  token;
  repo;
  fetchImpl;
  timeoutMs;
  maxPages;
  perPage;
  constructor(options) {
    this.apiBase = options.apiBase.replace(/\/+$/, "");
    this.token = options.token;
    this.repo = options.repo ?? null;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.timeoutMs = options.timeoutMs ?? 15e3;
    this.maxPages = options.maxPages ?? 10;
    this.perPage = options.perPage ?? 100;
  }
  get repository() {
    return this.repo;
  }
  issuesBase() {
    if (!this.repo) throw new GitHubError("invalid", 0, "Repository has not been resolved");
    return `${this.apiBase}/repos/${encodeURIComponent(this.repo.owner)}/${encodeURIComponent(this.repo.name)}`;
  }
  graphqlUrl() {
    if (this.apiBase.endsWith("/api/v3")) {
      return `${this.apiBase.slice(0, -3)}graphql`;
    }
    return `${this.apiBase}/graphql`;
  }
  async request(url, options = {}) {
    const headers = {
      authorization: `Bearer ${this.token}`,
      accept: options.accept ?? "application/vnd.github+json",
      "x-github-api-version": "2022-11-28",
      "user-agent": "openchamber-task-board-web"
    };
    if (options.body !== void 0) {
      headers["content-type"] = "application/json";
    }
    if (options.etag) {
      headers["if-match"] = options.etag;
    }
    let response;
    let text = "";
    try {
      response = await this.fetchImpl(url, {
        method: options.method ?? "GET",
        headers,
        body: options.body === void 0 ? void 0 : JSON.stringify(options.body),
        signal: AbortSignal.timeout(this.timeoutMs),
        redirect: "manual"
      });
      text = await response.text();
    } catch (error) {
      if (error instanceof GitHubError) throw error;
      throw new GitHubError("network", 0, "GitHub request failed before completion");
    }
    if (response.status >= 300 && response.status < 400) {
      throw new GitHubError(
        "server",
        response.status,
        `GitHub redirected with status ${response.status}; redirects are not permitted`
      );
    }
    let data = null;
    let jsonParsed = false;
    if (text) {
      try {
        data = JSON.parse(text);
        jsonParsed = true;
      } catch {
        data = null;
        jsonParsed = false;
      }
    }
    if (!response.ok) {
      const kind = kindForStatus(response.status, response.headers, data, jsonParsed, options.method);
      const message = kind === "unauthorized" ? "GitHub rejected the stored token" : kind === "forbidden" ? "GitHub refused access to the requested resource" : kind === "not_found" ? "GitHub resource not found" : kind === "rate_limited" ? "GitHub rate limit reached" : kind === "invalid" ? typeof data?.message === "string" ? data.message : "GitHub rejected the request as invalid" : `GitHub responded with status ${response.status}`;
      throw new GitHubError(kind, response.status, message, { jsonParsed, data });
    }
    if (Buffer.byteLength(text, "utf8") > MAX_BODY_BYTES) {
      throw new GitHubError("server", response.status, "GitHub response exceeded the safe size");
    }
    return { status: response.status, headers: response.headers, data };
  }
  async getAuthenticatedUser() {
    const { data } = await this.request(`${this.apiBase}/user`);
    const login = data && typeof data.login === "string" ? data.login : "";
    if (!login) {
      throw new GitHubError("server", 200, "GitHub /user returned no account login");
    }
    return { login };
  }
  async getRepository() {
    const { data } = await this.request(this.issuesBase());
    if (!data || typeof data.full_name !== "string") {
      throw new GitHubError("server", 200, "GitHub repository response was malformed");
    }
    return data;
  }
  repositoriesUrl(page) {
    const query = new URLSearchParams({
      per_page: String(this.perPage),
      page: String(page),
      affiliation: "owner,collaborator,organization_member",
      sort: "full_name",
      direction: "asc"
    });
    return `${this.apiBase}/user/repos?${query.toString()}`;
  }
  async listRepositories() {
    const repositories = [];
    const seen = /* @__PURE__ */ new Map();
    let pages = 0;
    let nextUrl = this.repositoriesUrl(1);
    const apiOrigin = new URL(this.apiBase).origin;
    const expectedPath = new URL(`${this.apiBase}/user/repos`).pathname;
    while (nextUrl) {
      if (pages >= this.maxPages) {
        throw new GitHubError("server", 200, "GitHub repository discovery exceeded the page bound");
      }
      const { data, headers } = await this.request(nextUrl);
      if (!Array.isArray(data)) {
        throw new GitHubError("server", 200, "GitHub repository list response was not a list");
      }
      for (const item of data) {
        const summary = parseRepositorySummary(item);
        if (seen.has(summary.full)) {
          throw new GitHubError("server", 200, "GitHub repository discovery repeated an identity");
        }
        seen.set(summary.full, summary.id);
        repositories.push(summary);
      }
      pages += 1;
      const link = headers.get("link") ?? "";
      const nextMatch = /<([^>]+)>\s*;\s*rel="next"/i.exec(link);
      if (nextMatch) {
        let parsedNext;
        try {
          parsedNext = new URL(nextMatch[1], this.apiBase);
        } catch {
          throw new GitHubError("server", 200, "GitHub repository pagination Link header URL was malformed");
        }
        if (parsedNext.origin !== apiOrigin) {
          throw new GitHubError("server", 200, "GitHub repository pagination left the configured API origin");
        }
        if (parsedNext.pathname !== expectedPath) {
          throw new GitHubError("server", 200, "GitHub repository pagination left the repository list path");
        }
        nextUrl = parsedNext.toString();
      } else if (data.length >= this.perPage) {
        nextUrl = this.repositoriesUrl(pages + 1);
      } else {
        nextUrl = null;
      }
    }
    return { repositories, pages, truncated: false };
  }
  async listIssues() {
    const items = [];
    const seenNumbers = /* @__PURE__ */ new Set();
    let pages = 0;
    let truncated = false;
    let nextUrl = `${this.issuesBase()}/issues?state=all&per_page=${this.perPage}&page=1`;
    const apiOrigin = new URL(this.apiBase).origin;
    while (nextUrl) {
      if (pages >= this.maxPages) {
        truncated = true;
        break;
      }
      const { data, headers } = await this.request(nextUrl);
      if (!Array.isArray(data)) {
        throw new GitHubError("server", 200, "GitHub issues response was not a list");
      }
      let newCount = 0;
      for (const item of data) {
        const num = item?.number;
        if (typeof num === "number") {
          if (!seenNumbers.has(num)) {
            seenNumbers.add(num);
            items.push(item);
            newCount += 1;
          }
        } else {
          items.push(item);
          newCount += 1;
        }
      }
      pages += 1;
      if (data.length > 0 && newCount === 0) {
        truncated = true;
        break;
      }
      const link = headers.get("link") ?? "";
      const nextMatch = /<([^>]+)>\s*;\s*rel="next"/i.exec(link);
      if (nextMatch) {
        let parsedNext;
        try {
          parsedNext = new URL(nextMatch[1], this.apiBase);
        } catch {
          throw new GitHubError("server", 200, "GitHub pagination Link header URL was malformed");
        }
        if (parsedNext.origin !== apiOrigin) {
          throw new GitHubError("server", 200, "GitHub pagination left the configured API origin");
        }
        const expectedPath = `${new URL(this.issuesBase()).pathname}/issues`;
        if (parsedNext.pathname !== expectedPath) {
          throw new GitHubError("server", 200, "GitHub pagination left the configured repository path");
        }
        nextUrl = parsedNext.toString();
      } else if (data.length >= this.perPage) {
        nextUrl = `${this.issuesBase()}/issues?state=all&per_page=${this.perPage}&page=${pages + 1}`;
      } else {
        nextUrl = null;
      }
    }
    return { items, pages, truncated };
  }
  async getIssue(number) {
    const safeNumber = parseIssueNumber(number);
    const { data, headers } = await this.request(`${this.issuesBase()}/issues/${safeNumber}`);
    if (!data || typeof data.number !== "number") {
      throw new GitHubError("server", 200, "GitHub issue response was malformed");
    }
    return { item: data, etag: headers.get("etag") };
  }
  async updateIssue(number, patch, options = {}) {
    const safeNumber = parseIssueNumber(number);
    const allowed = /* @__PURE__ */ new Set(["title", "body", "labels", "state"]);
    for (const key of Object.keys(patch)) {
      if (!allowed.has(key)) {
        throw new GitHubError("invalid", 0, `Refusing to write unsupported field ${key}`);
      }
    }
    const { data, headers } = await this.request(`${this.issuesBase()}/issues/${safeNumber}`, {
      method: "PATCH",
      body: patch,
      etag: options.etag
    });
    if (!data || typeof data.number !== "number") {
      throw new GitHubError("server", 200, "GitHub issue response was malformed");
    }
    return { item: data, etag: headers.get("etag") };
  }
  async transferIssue(input) {
    if (!input.issueId || !input.repositoryId) {
      throw new GitHubError("invalid", 0, "Both issueId and repositoryId are required for transferIssue");
    }
    const { data } = await this.request(this.graphqlUrl(), {
      method: "POST",
      body: {
        query: TRANSFER_ISSUE_MUTATION,
        variables: {
          issueId: input.issueId,
          repositoryId: input.repositoryId
        }
      }
    });
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      throw new GitHubError("server", 200, "GitHub GraphQL response was malformed");
    }
    const transferred = data?.data?.transferIssue?.issue;
    if (!transferred) {
      const errors = Array.isArray(data.errors) ? data.errors : [];
      if (errors.length > 0 && errors.every((entry) => entry && typeof entry === "object" && typeof entry.type === "string")) {
        const types = errors.map((entry) => String(entry.type).toUpperCase());
        if (types.every((t) => ["FORBIDDEN", "INSUFFICIENT_SCOPES", "NOT_FOUND", "UNPROCESSABLE", "BAD_USER_INPUT"].includes(t))) {
          const message = typeof errors[0].message === "string" && errors[0].message.trim() ? errors[0].message : "GitHub refused to transfer this issue";
          if (types.some((t) => t === "FORBIDDEN" || t === "INSUFFICIENT_SCOPES")) {
            throw new GitHubError("forbidden", 403, message, { jsonParsed: true, data });
          }
          throw new GitHubError("invalid", 422, message, { jsonParsed: true, data });
        }
      }
      throw new GitHubError("server", 200, "GitHub GraphQL transfer outcome was ambiguous", { jsonParsed: true, data });
    }
    if (typeof transferred.id !== "string" || !transferred.id || !Number.isSafeInteger(transferred.number) || transferred.number <= 0 || typeof transferred.url !== "string" || !/^https?:\/\//i.test(transferred.url) || typeof transferred.repository?.nameWithOwner !== "string" || !transferred.repository.nameWithOwner.includes("/")) {
      throw new GitHubError("server", 200, "GitHub GraphQL transfer response was incomplete", { jsonParsed: true, data });
    }
    return {
      id: transferred.id,
      number: transferred.number,
      url: transferred.url,
      repositoryFullName: transferred.repository.nameWithOwner
    };
  }
  async createIssue(payload) {
    const allowed = /* @__PURE__ */ new Set(["title", "body", "labels"]);
    for (const key of Object.keys(payload)) {
      if (!allowed.has(key)) {
        throw new GitHubError("invalid", 0, `Refusing to write unsupported field ${key}`);
      }
    }
    const { data, headers } = await this.request(this.issuesBase() + "/issues", {
      method: "POST",
      body: payload
    });
    if (!data || typeof data.number !== "number") {
      throw new GitHubError("server", 200, "GitHub issue response was malformed");
    }
    return { item: data, etag: headers.get("etag") };
  }
};
function parseRepositorySummary(item) {
  if (!item || typeof item !== "object" || Array.isArray(item)) {
    throw new GitHubError("server", 200, "GitHub repository response was malformed");
  }
  const full = typeof item.full_name === "string" ? item.full_name : "";
  const parts = full.split("/");
  if (parts.length !== 2 || !parts.every((part) => /^[A-Za-z0-9_.-]+$/.test(part) && part !== "." && part !== "..") || item.name !== parts[1] || item.owner?.login !== parts[0] || typeof item.archived !== "boolean" || typeof item.has_issues !== "boolean" || item.id !== void 0 && (!Number.isSafeInteger(item.id) || item.id <= 0)) {
    throw new GitHubError("server", 200, "GitHub repository response was malformed");
  }
  const id = typeof item.id === "number" && Number.isInteger(item.id) && item.id > 0 ? item.id : null;
  return {
    id,
    owner: parts[0],
    name: parts[1],
    full,
    archived: item.archived === true,
    hasIssues: item.has_issues !== false,
    disabled: item.disabled === true,
    private: item.private === true
  };
}
function parseIssueNumber(value) {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) return value;
  if (typeof value === "string" && /^\d{1,10}$/.test(value)) {
    const parsed = Number(value);
    if (parsed > 0) return parsed;
  }
  throw new GitHubError("invalid", 0, "Issue number must be a positive integer");
}

// web/server/repositories.ts
var RepositoryNotAllowedError = class extends Error {
  constructor() {
    super("That repository is not available to this board token");
  }
};
var DiscoveryUnavailableError = class extends Error {
};
var RepositoryRegistry = class {
  client;
  now;
  ttlMs;
  known = /* @__PURE__ */ new Map();
  fetchedAt = null;
  attemptedAt = null;
  failed = false;
  inFlight = null;
  constructor(options) {
    this.client = options.client;
    this.now = options.now ?? Date.now;
    this.ttlMs = Math.max(0, options.ttlMs ?? 6e4);
  }
  async view() {
    if (this.inFlight) return this.inFlight;
    if (this.attemptedAt !== null && this.now() - this.attemptedAt < this.ttlMs) return this.snapshot();
    this.inFlight = this.refresh().finally(() => {
      this.inFlight = null;
    });
    return this.inFlight;
  }
  async resolve(owner, name) {
    const full = `${owner}/${name}`;
    if (!this.known.has(full)) throw new RepositoryNotAllowedError();
    const view = await this.view();
    const found = view.repositories.find((repository) => repository.full === full && repository.available);
    if (!found) throw new RepositoryNotAllowedError();
    if (view.discoveryFailed) throw new DiscoveryUnavailableError();
    return found;
  }
  async refresh() {
    this.attemptedAt = this.now();
    try {
      const listed = await this.client.listRepositories();
      const at = this.now();
      const next = /* @__PURE__ */ new Map();
      for (const repository of listed.repositories) {
        next.set(repository.full, { ...repository, available: !repository.disabled, lastSeenAt: new Date(at).toISOString() });
      }
      for (const [full, entry] of this.known) {
        if (!next.has(full)) next.set(full, { ...entry, available: false });
      }
      if (next.size > 1e4) throw new Error("Repository history bound reached");
      this.known = next;
      this.fetchedAt = at;
      this.failed = false;
    } catch {
      this.failed = true;
    }
    return this.snapshot();
  }
  snapshot() {
    const repositories = Array.from(this.known.values());
    return {
      fetchedAt: this.fetchedAt === null ? null : new Date(this.fetchedAt).toISOString(),
      freshnessMs: this.ttlMs,
      stale: this.failed,
      discoveryFailed: this.failed,
      error: this.failed ? "Repository discovery failure; refresh later. Last known identities retained." : null,
      visibleCount: repositories.filter((repository) => repository.available).length,
      repositories
    };
  }
};

// panel/labels.ts
var STATUS_DRAFT = "status:draft";
var STATUS_BACKLOG = "status:backlog";
var STATUS_TODO = "status:todo";
var STATUS_PLANNED = "status:planned";
var STATUS_IN_PROGRESS = "status:in-progress";
var STATUS_NEEDS_HUMAN = "status:needs-human";
var STATUS_IN_REVIEW = "status:in-review";
var STATUS_DONE = "status:done";
var STATUS_LABELS = [
  STATUS_DRAFT,
  STATUS_BACKLOG,
  STATUS_TODO,
  STATUS_PLANNED,
  STATUS_IN_PROGRESS,
  STATUS_NEEDS_HUMAN,
  STATUS_IN_REVIEW,
  STATUS_DONE
];
var STATUS_METADATA = {
  "draft": {
    id: "draft",
    label: STATUS_DRAFT,
    name: "Draft",
    displayName: "Draft",
    color: "#6e7681",
    description: "Passive ideas or notes; unblocked ideas awaiting drafting or alignment"
  },
  "backlog": {
    id: "backlog",
    label: STATUS_BACKLOG,
    name: "Backlog",
    displayName: "Backlog",
    color: "#8b949e",
    description: "Prioritized ideas and incoming work not yet scheduled"
  },
  "todo": {
    id: "todo",
    label: STATUS_TODO,
    name: "To Do",
    displayName: "To Do",
    color: "#d29922",
    description: "Well-formed work ready to be picked up"
  },
  "planned": {
    id: "planned",
    label: STATUS_PLANNED,
    name: "Planned",
    displayName: "Planned",
    color: "#58a6ff",
    description: "Scheduled or queued for execution"
  },
  "in-progress": {
    id: "in-progress",
    label: STATUS_IN_PROGRESS,
    name: "In Progress",
    displayName: "In Progress",
    color: "#bc8cff",
    description: "Actively being worked on by an agent or human"
  },
  "needs-human": {
    id: "needs-human",
    label: STATUS_NEEDS_HUMAN,
    name: "Needs Human",
    displayName: "Needs Human",
    color: "#f85149",
    description: "Awaiting a human: permission, answers, alignment, or validation"
  },
  "in-review": {
    id: "in-review",
    label: STATUS_IN_REVIEW,
    name: "In Review",
    displayName: "In Review",
    color: "#3fb950",
    description: "AI step: agent reviewing its own finished work (hostile review gate)"
  },
  "done": {
    id: "done",
    label: STATUS_DONE,
    name: "Done",
    displayName: "Done",
    color: "#238636",
    description: "Completed and validated by a human (no agent self-close)"
  }
};

// web/server/sections.ts
var SectionError = class extends Error {
  constructor(message) {
    super(message);
    this.name = "SectionError";
  }
};
var statusSet = new Set(STATUS_LABELS);
var headingPattern = /^ {0,3}(#{1,6})[ \t]+(.*?)[ \t]*$/;
var fencePattern = /^ {0,3}(`{3,}|~{3,})/;
var closeFencePattern = /^ {0,3}(`{3,}|~{3,})[ \t]*$/;
var overviewTitlePattern = /^(?:overview|summary|description|context|background|goals?)$/i;
function slugifyHeading(title) {
  return title.toLowerCase().replace(/[`*_~]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "section";
}
function trimRange(lines, start, end) {
  let from = start;
  let to = end;
  while (from < to && lines[from].trim() === "") from += 1;
  while (to > from && lines[to - 1].trim() === "") to -= 1;
  return lines.slice(from, to);
}
function findSections(body) {
  if (typeof body !== "string") return [];
  const cleanBody = body.startsWith("\uFEFF") ? body.slice(1) : body;
  const lines = cleanBody.split(/\r?\n/);
  const headings = [];
  let inFence = false;
  let fenceChar = "";
  let fenceLen = 0;
  for (let index = 0; index < lines.length; index += 1) {
    const cleanLine = lines[index].replace(/\r$/, "");
    if (!inFence) {
      const fenceMatch = fencePattern.exec(cleanLine);
      if (fenceMatch) {
        inFence = true;
        fenceChar = fenceMatch[1][0];
        fenceLen = fenceMatch[1].length;
        continue;
      }
      const match = headingPattern.exec(cleanLine);
      if (match) {
        headings.push({ line: index, level: match[1].length, title: match[2] });
      }
    } else {
      const fenceMatch = closeFencePattern.exec(cleanLine);
      if (fenceMatch && fenceMatch[1][0] === fenceChar && fenceMatch[1].length >= fenceLen) {
        inFence = false;
      }
    }
  }
  const sections = [];
  const usedIds = /* @__PURE__ */ new Set();
  const firstHeadingLine = headings.length > 0 ? headings[0].line : lines.length;
  const preambleLines = lines.slice(0, firstHeadingLine);
  const preambleText = trimRange(lines, 0, firstHeadingLine).join("\n");
  const hasPreamble = preambleText.trim() !== "";
  const isPreambleAmbiguous = preambleLines.some((l) => /^ {0,3}(?:`{3,}|~{3,}|#{1,6})/.test(l.replace(/\r$/, "")));
  if (hasPreamble) {
    usedIds.add("overview");
    sections.push({
      id: "overview",
      title: "(overview)",
      level: 0,
      headingLine: -1,
      startLine: 0,
      endLine: firstHeadingLine,
      text: preambleText,
      editable: !isPreambleAmbiguous
    });
  }
  headings.forEach((heading, index) => {
    const end = index + 1 < headings.length ? headings[index + 1].line : lines.length;
    const text = trimRange(lines, heading.line + 1, end).join("\n");
    const isOverviewHeading = !hasPreamble && index === 0 && overviewTitlePattern.test(heading.title.trim());
    let id = isOverviewHeading ? "overview" : slugifyHeading(heading.title);
    if (usedIds.has(id)) {
      let suffix = 2;
      while (usedIds.has(`${id}-${suffix}`)) suffix += 1;
      id = `${id}-${suffix}`;
    }
    usedIds.add(id);
    sections.push({
      id,
      title: heading.title,
      level: heading.level,
      headingLine: heading.line,
      startLine: heading.line + 1,
      endLine: end,
      text,
      editable: isOverviewHeading
    });
  });
  return sections;
}
function editableSections(body) {
  return findSections(body).filter((section) => section.editable).map((section) => ({ id: section.id, title: section.title, text: section.text }));
}
function withEol(lines, eol) {
  if (eol !== "\r\n") return lines;
  return lines.map((line) => line.endsWith("\r") ? line : `${line}\r`);
}
function replaceRange(lines, start, end, textLines, eol) {
  const range = lines.slice(start, end);
  let trailingBlanks = 0;
  for (let index = range.length - 1; index >= 0; index -= 1) {
    if (range[index].trim() !== "") break;
    trailingBlanks += 1;
  }
  const blankLines = new Array(Math.max(trailingBlanks, 1)).fill("");
  const replacement = [...withEol(textLines, eol), ...withEol(blankLines, eol)];
  lines.splice(start, end - start, ...replacement);
  return lines;
}
function replaceSectionText(body, sectionId, text) {
  if (typeof text !== "string") {
    throw new SectionError("section text must be a string");
  }
  if (typeof body !== "string") {
    throw new SectionError("issue body must be a string");
  }
  if (body.startsWith("\uFEFF")) {
    return "\uFEFF" + replaceSectionText(body.slice(1), sectionId, text);
  }
  const eol = body.includes("\r\n") ? "\r\n" : "\n";
  const textLines = text.replace(/\r\n?/g, "\n").split("\n");
  const lines = body.split("\n");
  const section = findSections(body).find((candidate) => candidate.id === sectionId);
  if (section) {
    if (!section.editable) {
      throw new SectionError(`section ${sectionId} is not editable`);
    }
    const from = section.headingLine === -1 ? 0 : section.headingLine + 1;
    return replaceRange(lines, from, section.endLine, textLines, eol).join("\n");
  }
  if (sectionId !== "overview") {
    throw new SectionError(`section ${sectionId} is not editable`);
  }
  const block = withEol([...textLines, ""], eol);
  if (body === "") return withEol([...textLines, ""], eol).join("\n");
  return [...block, ...lines].join("\n");
}
function isStatusLabel(name) {
  return statusSet.has(name.trim().toLowerCase());
}
function setStatusLabel(labels, status) {
  if (!Array.isArray(labels)) {
    throw new SectionError("labels must be an array");
  }
  if (status !== null) {
    if (typeof status !== "string" || !statusSet.has(status)) {
      throw new SectionError("status is not part of the agreed status label set");
    }
  }
  const kept = labels.filter((label) => typeof label === "string").filter((label) => !isStatusLabel(label));
  if (status !== null) kept.push(status);
  return kept;
}

// web/server/board.ts
import { createHash as createHash2 } from "node:crypto";

// panel/core.ts
var checklistRegex = /^(\s*(?:[-*+]|\d+\.)\s*\[)([ xX])(\]\s+)(.+)$/;
var questionsSectionRegex = /^[ \t]*#{1,6}\s*(?:open\s+)?questions(?:\s*:)?/i;
var humanTasksSectionRegex = /^[ \t]*#{1,6}\s*human\s+tasks?(?:\s*:)?/i;
var testPlanIssueHeadingRegex = /^[ \t]*#{1,6}\s*test\s+plan\s*\(\s*issue\s*\)(?:\s*:)?/i;
var testPlanBatchHeadingRegex = /^[ \t]*#{1,6}\s*test\s+plan\s*\(\s*batch\s*\)(?:\s*:)?/i;
var testPlanHeadingRegex = /^[ \t]*#{1,6}\s*test\s+plan(?:\s*\(.*?\))?(?:\s*:)?/i;
var acceptanceCriteriaSectionRegex = /^[ \t]*#{1,6}\s*acceptance\s+criteria(?:\s*:)?/i;
var subtasksSectionRegex = /^[ \t]*#{1,6}\s*(?:actionable\s+subtasks(?:\s+checklist)?|subtasks?|tasks?)(?:\s*:)?/im;
var headingRegex = /^[ ]{0,3}#{1,6}\s+/;
function parseFriendlyTitle(body, defaultTitle) {
  if (!body || typeof body !== "string") {
    return { title: defaultTitle || "", subtitle: null };
  }
  const cleanBody = body.startsWith("\uFEFF") ? body.slice(1) : body;
  const match = cleanBody.match(/(?:^|\r?\n)[ \t]*(?:#{1,6}[ \t]*Friendly Title:|\*\*Friendly Title:?\*\*:?)[ \t]*([^\r\n]*)/i);
  if (match) {
    let extracted = match[1].trim();
    if (!extracted) {
      const matchIndex = match.index ?? 0;
      const remainder = cleanBody.slice(matchIndex + match[0].length);
      const lines = remainder.split(/\r?\n/);
      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line) continue;
        if (line.startsWith("#") || /^\*\*(?:overview|description|details|context|background|about|tasks?|subtasks?|questions?):?\*\*/i.test(line) || /^[-*+]\s+/.test(line) || /^\d+\.\s+/.test(line)) {
          break;
        }
        extracted = line;
        break;
      }
    }
    if (extracted) {
      extracted = extracted.replace(/^<([^>]+)>$/, "$1").replace(/^["'](.*)["']$/, "$1").trim();
      if (extracted.toLowerCase() === "3-6 words plain english title" || extracted.toLowerCase() === "<3-6 words plain english title>") {
        return {
          title: defaultTitle || "",
          subtitle: null
        };
      }
      return {
        title: extracted,
        subtitle: defaultTitle || null
      };
    }
  }
  return {
    title: defaultTitle || "",
    subtitle: null
  };
}
function parseOpenQuestions(body) {
  if (!body || typeof body !== "string" || !body.includes("[")) return [];
  const cleanBody = body.startsWith("\uFEFF") ? body.slice(1) : body;
  if (!/question/i.test(cleanBody)) return [];
  const hasCodeFence = cleanBody.includes("```") || cleanBody.includes("~~~");
  const hasCR = cleanBody.includes("\r");
  const lines = cleanBody.split("\n");
  const questions = [];
  let inQuestionsSection = false;
  let inHumanTasksSection = false;
  let inCodeFence = false;
  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = hasCR && rawLine.includes("\r") ? rawLine.replace(/\r/g, "") : rawLine;
    const firstChar = line.charCodeAt(0);
    if (firstChar !== 45 && firstChar !== 42) {
      if (hasCodeFence) {
        if (/^[ \t]*(?:```|~~~)/.test(line)) {
          inCodeFence = !inCodeFence;
          continue;
        }
        if (inCodeFence) continue;
      }
      if (line.includes("#")) {
        const isQuestions = questionsSectionRegex.test(line);
        const isHuman = humanTasksSectionRegex.test(line);
        if (isQuestions || isHuman || headingRegex.test(line)) {
          inQuestionsSection = isQuestions;
          inHumanTasksSection = isHuman;
          continue;
        }
      }
    } else if (inCodeFence) {
      continue;
    }
    if (inQuestionsSection) {
      let completed = false;
      let text = "";
      if (line.charCodeAt(0) === 45 && line.charCodeAt(1) === 32 && line.charCodeAt(2) === 91 && (line.charCodeAt(3) === 32 || line.charCodeAt(3) === 120 || line.charCodeAt(3) === 88) && line.charCodeAt(4) === 93 && line.charCodeAt(5) === 32) {
        completed = line.charCodeAt(3) === 120 || line.charCodeAt(3) === 88;
        text = line.slice(6).trim();
      } else {
        const match = line.match(checklistRegex);
        if (match) {
          completed = match[2].toLowerCase() === "x";
          text = match[4].trim();
        }
      }
      if (text) {
        questions.push({
          id: `question-${i}`,
          lineIndex: i,
          completed,
          text,
          rawLine
        });
      }
    } else if (!inHumanTasksSection) {
      if (line.includes("?") || line.includes("Q:") || line.includes("q:") || /question/i.test(line)) {
        let completed = false;
        let text = "";
        if (line.charCodeAt(0) === 45 && line.charCodeAt(1) === 32 && line.charCodeAt(2) === 91 && (line.charCodeAt(3) === 32 || line.charCodeAt(3) === 120 || line.charCodeAt(3) === 88) && line.charCodeAt(4) === 93 && line.charCodeAt(5) === 32) {
          completed = line.charCodeAt(3) === 120 || line.charCodeAt(3) === 88;
          text = line.slice(6).trim();
        } else {
          const match = line.match(checklistRegex);
          if (match) {
            completed = match[2].toLowerCase() === "x";
            text = match[4].trim();
          }
        }
        if (text && /^(?:\?|Q:|Question:)/i.test(text)) {
          const qText = text.replace(/^(?:\?|Q:|Question:)\s*/i, "").trim();
          if (qText) {
            questions.push({
              id: `question-${i}`,
              lineIndex: i,
              completed,
              text: qText,
              rawLine
            });
          }
        }
      }
    }
  }
  return questions;
}
function parseHumanTasks(body) {
  if (!body || typeof body !== "string" || !body.includes("[")) return [];
  const cleanBody = body.startsWith("\uFEFF") ? body.slice(1) : body;
  if (!/human/i.test(cleanBody)) return [];
  const hasCodeFence = cleanBody.includes("```") || cleanBody.includes("~~~");
  const hasCR = cleanBody.includes("\r");
  const lines = cleanBody.split("\n");
  const tasks = [];
  let inHumanTasksSection = false;
  let inCodeFence = false;
  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = hasCR && rawLine.includes("\r") ? rawLine.replace(/\r/g, "") : rawLine;
    const firstChar = line.charCodeAt(0);
    if (firstChar !== 45 && firstChar !== 42) {
      if (hasCodeFence) {
        if (/^[ \t]*(?:```|~~~)/.test(line)) {
          inCodeFence = !inCodeFence;
          continue;
        }
        if (inCodeFence) continue;
      }
      if (line.includes("#")) {
        const isHuman = humanTasksSectionRegex.test(line);
        if (isHuman || questionsSectionRegex.test(line) || headingRegex.test(line)) {
          inHumanTasksSection = isHuman;
          continue;
        }
      }
    } else if (inCodeFence) {
      continue;
    }
    if (inHumanTasksSection) {
      let completed = false;
      let text = "";
      if (line.charCodeAt(0) === 45 && line.charCodeAt(1) === 32 && line.charCodeAt(2) === 91 && (line.charCodeAt(3) === 32 || line.charCodeAt(3) === 120 || line.charCodeAt(3) === 88) && line.charCodeAt(4) === 93 && line.charCodeAt(5) === 32) {
        completed = line.charCodeAt(3) === 120 || line.charCodeAt(3) === 88;
        text = line.slice(6).trim();
      } else {
        const match = line.match(checklistRegex);
        if (match) {
          completed = match[2].toLowerCase() === "x";
          text = match[4].trim();
        }
      }
      if (text) {
        tasks.push({
          id: `human-task-${i}`,
          lineIndex: i,
          completed,
          text,
          rawLine
        });
      }
    }
  }
  return tasks;
}
function parseAcceptanceCriteria(body) {
  if (!body || typeof body !== "string" || !body.includes("[")) return [];
  const cleanBody = body.startsWith("\uFEFF") ? body.slice(1) : body;
  if (!/acceptance/i.test(cleanBody)) return [];
  const hasCodeFence = cleanBody.includes("```") || cleanBody.includes("~~~");
  const hasCR = cleanBody.includes("\r");
  const lines = cleanBody.split("\n");
  const items = [];
  let inAcSection = false;
  let inCodeFence = false;
  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = hasCR && rawLine.includes("\r") ? rawLine.replace(/\r/g, "") : rawLine;
    const firstChar = line.charCodeAt(0);
    if (firstChar !== 45 && firstChar !== 42) {
      if (hasCodeFence) {
        if (/^[ \t]*(?:```|~~~)/.test(line)) {
          inCodeFence = !inCodeFence;
          continue;
        }
        if (inCodeFence) continue;
      }
      if (line.includes("#")) {
        const isAc = acceptanceCriteriaSectionRegex.test(line);
        if (isAc || headingRegex.test(line)) {
          inAcSection = isAc;
          continue;
        }
      }
    } else if (inCodeFence) {
      continue;
    }
    if (inAcSection) {
      let completed = false;
      let text = "";
      if (line.charCodeAt(0) === 45 && line.charCodeAt(1) === 32 && line.charCodeAt(2) === 91 && (line.charCodeAt(3) === 32 || line.charCodeAt(3) === 120 || line.charCodeAt(3) === 88) && line.charCodeAt(4) === 93 && line.charCodeAt(5) === 32) {
        completed = line.charCodeAt(3) === 120 || line.charCodeAt(3) === 88;
        text = line.slice(6).trim();
      } else {
        const match = line.match(checklistRegex);
        if (match) {
          completed = match[2].toLowerCase() === "x";
          text = match[4].trim();
        }
      }
      if (text) {
        items.push({
          id: `ac-${i}`,
          lineIndex: i,
          completed,
          text,
          rawLine
        });
      }
    }
  }
  return items;
}
function parseSubtasks(body) {
  if (!body || typeof body !== "string" || !body.includes("[")) return [];
  const cleanBody = body.startsWith("\uFEFF") ? body.slice(1) : body;
  const hasCodeFence = cleanBody.includes("```") || cleanBody.includes("~~~");
  const hasCR = cleanBody.includes("\r");
  const lines = cleanBody.split("\n");
  const subtasks = [];
  let hasExplicitSubtasksSection = false;
  if (/task/i.test(cleanBody)) {
    if (!hasCodeFence) {
      hasExplicitSubtasksSection = subtasksSectionRegex.test(cleanBody);
    } else {
      let inCode = false;
      for (let i = 0; i < lines.length; i++) {
        const rawLine = lines[i];
        if (/^[ \t]*(?:```|~~~)/.test(rawLine)) {
          inCode = !inCode;
          continue;
        }
        if (inCode) continue;
        if (subtasksSectionRegex.test(rawLine)) {
          hasExplicitSubtasksSection = true;
          break;
        }
      }
    }
  }
  if (hasExplicitSubtasksSection) {
    let inSubtasksSection = false;
    let inCodeFence2 = false;
    for (let i = 0; i < lines.length; i++) {
      const rawLine = lines[i];
      const line = hasCR && rawLine.includes("\r") ? rawLine.replace(/\r/g, "") : rawLine;
      const firstChar = line.charCodeAt(0);
      if (firstChar !== 45 && firstChar !== 42) {
        if (hasCodeFence) {
          if (/^[ \t]*(?:```|~~~)/.test(line)) {
            inCodeFence2 = !inCodeFence2;
            continue;
          }
          if (inCodeFence2) continue;
        }
        if (line.includes("#")) {
          const isSub = subtasksSectionRegex.test(line);
          if (isSub || headingRegex.test(line)) {
            inSubtasksSection = isSub;
            continue;
          }
        }
      } else if (inCodeFence2) {
        continue;
      }
      if (inSubtasksSection) {
        let completed = false;
        let text = "";
        if (line.charCodeAt(0) === 45 && line.charCodeAt(1) === 32 && line.charCodeAt(2) === 91 && (line.charCodeAt(3) === 32 || line.charCodeAt(3) === 120 || line.charCodeAt(3) === 88) && line.charCodeAt(4) === 93 && line.charCodeAt(5) === 32) {
          completed = line.charCodeAt(3) === 120 || line.charCodeAt(3) === 88;
          text = line.slice(6).trim();
        } else {
          const match = line.match(checklistRegex);
          if (match) {
            completed = match[2].toLowerCase() === "x";
            text = match[4].trim();
          }
        }
        if (text) {
          if (text.charCodeAt(0) === 63 || text.charCodeAt(0) === 81 && (text.charCodeAt(1) === 58 || text.startsWith("Question:")) || /^(?:\?|Q:|Question:)/i.test(text)) {
            continue;
          }
          subtasks.push({
            id: `task-${i}`,
            lineIndex: i,
            completed,
            text,
            rawLine
          });
        }
      }
    }
    return subtasks;
  }
  let inExcludedSection = false;
  let inCodeFence = false;
  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = hasCR && rawLine.includes("\r") ? rawLine.replace(/\r/g, "") : rawLine;
    const firstChar = line.charCodeAt(0);
    if (firstChar !== 45 && firstChar !== 42) {
      if (hasCodeFence) {
        if (/^[ \t]*(?:```|~~~)/.test(line)) {
          inCodeFence = !inCodeFence;
          continue;
        }
        if (inCodeFence) continue;
      }
      if (line.includes("#")) {
        const isExcluded = acceptanceCriteriaSectionRegex.test(line) || questionsSectionRegex.test(line) || humanTasksSectionRegex.test(line) || testPlanHeadingRegex.test(line);
        if (isExcluded || headingRegex.test(line)) {
          inExcludedSection = isExcluded;
          continue;
        }
      }
    } else if (inCodeFence) {
      continue;
    }
    if (inExcludedSection) {
      continue;
    }
    let completed = false;
    let text = "";
    if (line.charCodeAt(0) === 45 && line.charCodeAt(1) === 32 && line.charCodeAt(2) === 91 && (line.charCodeAt(3) === 32 || line.charCodeAt(3) === 120 || line.charCodeAt(3) === 88) && line.charCodeAt(4) === 93 && line.charCodeAt(5) === 32) {
      completed = line.charCodeAt(3) === 120 || line.charCodeAt(3) === 88;
      text = line.slice(6).trim();
    } else {
      const match = line.match(checklistRegex);
      if (match) {
        completed = match[2].toLowerCase() === "x";
        text = match[4].trim();
      }
    }
    if (text) {
      if (text.charCodeAt(0) === 63 || text.charCodeAt(0) === 81 && (text.charCodeAt(1) === 58 || text.startsWith("Question:")) || /^(?:\?|Q:|Question:)/i.test(text)) {
        continue;
      }
      subtasks.push({
        id: `task-${i}`,
        lineIndex: i,
        completed,
        text,
        rawLine
      });
    }
  }
  return subtasks;
}
function parseTestPlan(body) {
  const result = {
    issueTests: [],
    batchTests: []
  };
  if (!body || typeof body !== "string" || !body.includes("[")) return result;
  const cleanBody = body.startsWith("\uFEFF") ? body.slice(1) : body;
  if (!/test\s*plan/i.test(cleanBody)) return result;
  const hasCodeFence = cleanBody.includes("```") || cleanBody.includes("~~~");
  const hasCR = cleanBody.includes("\r");
  const lines = cleanBody.split("\n");
  let currentScope = null;
  let inCodeFence = false;
  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = hasCR && rawLine.includes("\r") ? rawLine.replace(/\r/g, "") : rawLine;
    const firstChar = line.charCodeAt(0);
    if (firstChar !== 45 && firstChar !== 42) {
      if (hasCodeFence) {
        if (/^[ \t]*(?:```|~~~)/.test(line)) {
          inCodeFence = !inCodeFence;
          continue;
        }
        if (inCodeFence) continue;
      }
      if (line.includes("#")) {
        if (testPlanIssueHeadingRegex.test(line)) {
          currentScope = "issue";
          continue;
        } else if (testPlanBatchHeadingRegex.test(line)) {
          currentScope = "batch";
          continue;
        } else if (headingRegex.test(line)) {
          currentScope = null;
          continue;
        }
      }
    } else if (inCodeFence) {
      continue;
    }
    if (currentScope) {
      let completed = false;
      let text = "";
      if (line.charCodeAt(0) === 45 && line.charCodeAt(1) === 32 && line.charCodeAt(2) === 91 && (line.charCodeAt(3) === 32 || line.charCodeAt(3) === 120 || line.charCodeAt(3) === 88) && line.charCodeAt(4) === 93 && line.charCodeAt(5) === 32) {
        completed = line.charCodeAt(3) === 120 || line.charCodeAt(3) === 88;
        text = line.slice(6).trim();
      } else {
        const match = line.match(checklistRegex);
        if (match) {
          completed = match[2].toLowerCase() === "x";
          text = match[4].trim();
        }
      }
      if (text) {
        const testItem = {
          text,
          completed,
          lineIndex: i,
          scope: currentScope
        };
        if (currentScope === "issue") {
          result.issueTests.push(testItem);
        } else {
          result.batchTests.push(testItem);
        }
      }
    }
  }
  return result;
}
function isVagueIdea(issue) {
  if (!issue) return true;
  const labels = (issue.labels || []).map((l) => (typeof l === "string" ? l : l.name || "").toLowerCase());
  if (labels.includes("status:needs-alignment")) {
    return true;
  }
  const openQuestions = issue.openQuestions || [];
  if (openQuestions.some((q) => !q.completed)) {
    return true;
  }
  const subtaskCount = (issue.subtasks || []).length;
  const bodyText = (issue.body || "").trim();
  const wordCount = bodyText ? bodyText.split(/\s+/).length : 0;
  return subtaskCount === 0 && wordCount < 20;
}
function resolveIssueWorkType(issue) {
  if (!issue || !Array.isArray(issue.labels)) return "undecided";
  const labelNames2 = issue.labels.map(
    (l) => (typeof l === "string" ? l : l?.name || "").toLowerCase().trim()
  );
  const hasBug = labelNames2.includes("bug");
  const hasEnhancement = labelNames2.includes("enhancement");
  if (hasBug && !hasEnhancement) return "bug";
  if (hasEnhancement && !hasBug) return "feature";
  return "undecided";
}
var WORK_LOG_SENTENCE_RULE = `The \`### Work Log:\` section is optional at issue creation; once work starts, the Work Log must contain exactly one sentence stating the work type and the concrete reason for it`;
var BUG_PATH_RULE = `Bug path: observed versus expected behaviour, reproduction evidence, cause, minimal regression-tested fix, hostile review.`;
var FEATURE_PATH_RULE = `Feature path: desired outcome, research and alternatives, user decisions, then implementation.`;
var EVIDENCE_AUTHORITY_RULE = `Both paths keep existing evidence rules and existing human authority over release and closure.`;
function buildWorkTypeInstructions(target) {
  const workType = typeof target === "string" ? target : resolveIssueWorkType(target);
  if (workType === "bug") {
    return `### Work Type & Proportionate Paths:
- Labels \`bug\` and \`enhancement\` are the only work-type source. This issue is resolved as \`bug\`.
- Proportionate path:
  - ${BUG_PATH_RULE}
  - Retain existing evidence rules and existing human authority over release and closure.
- Work Log: ${WORK_LOG_SENTENCE_RULE} (for example the observed behaviour that contradicts a stated expectation). Keep it one line; do not add fields, counters or machine state to the issue body.`;
  }
  if (workType === "feature") {
    return `### Work Type & Proportionate Paths:
- Labels \`bug\` and \`enhancement\` are the only work-type source. This issue is resolved as \`feature\`.
- Proportionate path:
  - ${FEATURE_PATH_RULE}
  - Retain existing evidence rules and existing human authority over release and closure.
- Work Log: ${WORK_LOG_SENTENCE_RULE} (for example the desired outcome that does not exist yet). Keep it one line; do not add fields, counters or machine state to the issue body.`;
  }
  return `### Work Type & Proportionate Paths:
- Labels \`bug\` and \`enhancement\` are the only work-type source.
- When both or neither are present, the work type is undecided and must be asked about, not guessed. Never infer a type from the title, the mood of the report, or the area of the code.
- Explicit alignment question: Which label (\`bug\` or \`enhancement\`) applies to this issue and what is the concrete reason based strictly on the labels? Ask the user for alignment before proceeding with work that depends on the work type.
- Undecided work type is an alignment question to the user, not a default. Undecided items must be asked about individually. Only block work that depends on the unanswered question; independent authorised work continues.
- Work Log: ${WORK_LOG_SENTENCE_RULE} (for example the observed behaviour that contradicts a stated expectation, or the desired outcome that does not exist yet). Keep it one line; do not add fields, counters or machine state to the issue body.
- Proportionate paths (once resolved):
  - ${BUG_PATH_RULE}
  - ${FEATURE_PATH_RULE}
  - ${EVIDENCE_AUTHORITY_RULE}`;
}
var DEFAULT_WORK_INSTRUCTIONS = buildWorkTypeInstructions("undecided");
var DEPENDENCY_LINE_REGEX = /(?:^|\n)\s*(?:[-*+]|\d+\.)?\s*\[?[ xX]?\]?\s*(?:blocked\s+by|depends\s+on|requires)(?:\s*:)?\s*([^\n]+)/gi;
function parseIssueDependencies(body) {
  if (!body || typeof body !== "string") return [];
  const numbers = /* @__PURE__ */ new Set();
  const matches = body.matchAll(DEPENDENCY_LINE_REGEX);
  for (const match of matches) {
    const text = match[1] || "";
    const numMatches = text.matchAll(/#(\d+)/g);
    for (const nm of numMatches) {
      const n = parseInt(nm[1], 10);
      if (Number.isFinite(n) && n > 0) {
        numbers.add(n);
      }
    }
  }
  return Array.from(numbers).sort((a, b) => a - b);
}
function isIssueClosed(issue) {
  if (!issue) return false;
  if (issue.state === "closed") return true;
  if (issue.state_reason === "completed" || issue.state_reason === "not_planned") return true;
  const labelNames2 = (issue.labels || []).map(
    (l) => (typeof l === "string" ? l : l?.name || "").toLowerCase()
  );
  if (labelNames2.includes("status:done") || labelNames2.includes("status:closed") || labelNames2.includes("done") || labelNames2.includes("closed")) {
    return true;
  }
  return false;
}
function resolveMatchedSession(issue, sessionOrList) {
  if (!sessionOrList || !issue) return null;
  const issueNum = typeof issue.number === "number" ? issue.number : parseInt(String(issue.number || issue.id || 0), 10);
  const issueNumStr = String(issueNum);
  const isBoundToOther = (s, currentNum) => {
    if (!s || !currentNum) return false;
    const currentStr = String(currentNum);
    if (Array.isArray(s.items)) {
      for (const it of s.items) {
        if (!it) continue;
        if (it.id === currentStr) return false;
        const otherNum = it.data?.issueNumber || Array.isArray(it.data?.issueNumbers) && it.data.issueNumbers[0] || (Number.isFinite(Number(it.id)) ? Number(it.id) : null);
        if (otherNum && Number(otherNum) !== currentNum) return true;
      }
    }
    if (typeof s.title === "string") {
      const match = s.title.match(/#(\d+)/);
      if (match && Number(match[1]) !== currentNum) return true;
    }
    const wtName = typeof s.worktree === "string" ? s.worktree : s.worktree?.name || s.worktree?.branch || s.worktree?.directory || "";
    if (wtName) {
      const match = wtName.match(/issue-(\d+)/);
      if (match && Number(match[1]) !== currentNum) return true;
    }
    return false;
  };
  if (Array.isArray(sessionOrList)) {
    if (Number.isFinite(issueNum) && issueNum > 0) {
      return sessionOrList.find((s) => {
        if (!s) return false;
        if (s.items && Array.isArray(s.items) && s.items.some(
          (it) => it && (it.id === issueNumStr || it.data?.issueNumber === issueNum || Array.isArray(it.data?.issueNumbers) && it.data.issueNumbers.includes(issueNum))
        )) {
          return true;
        }
        if (s.data && (s.data.issueNumber === issueNum || Array.isArray(s.data.issueNumbers) && s.data.issueNumbers.includes(issueNum))) {
          return true;
        }
        if (typeof s.title === "string" && s.title.includes(`#${issueNum}`)) return true;
        const wtName = typeof s.worktree === "string" ? s.worktree : s.worktree?.name || s.worktree?.branch || s.worktree?.directory || "";
        if (wtName && wtName.includes(`issue-${issueNum}`)) return true;
        return false;
      }) || (sessionOrList.length === 1 && !isBoundToOther(sessionOrList[0], issueNum) ? sessionOrList[0] : null);
    }
    return sessionOrList.length === 1 ? sessionOrList[0] : null;
  } else if (typeof sessionOrList === "object") {
    if (Number.isFinite(issueNum) && issueNum > 0 && isBoundToOther(sessionOrList, issueNum)) {
      return null;
    }
    return sessionOrList;
  }
  return null;
}
var ATTENTION_PRECEDENCE = {
  "needs-permission": 4,
  "needs-decision": 3,
  "needs-review": 2,
  none: 1
};
var PHASE_PRECEDENCE = {
  done: 10,
  archive: 9,
  publication: 8,
  human_verification: 7,
  verification: 6,
  execution: 5,
  planning: 4,
  alignment: 3,
  exploration: 2,
  draft: 1
};
var LIVENESS_PRECEDENCE = {
  failed: 5,
  retrying: 4,
  running: 3,
  completed: 2,
  idle: 1
};
function resolveV2Metadata(issue, session, allIssues) {
  if (!issue) {
    return {
      phase: "draft",
      attention: "none",
      liveness: "idle",
      dependencyState: "ready",
      isExplicitV2: false
    };
  }
  const rawLabels = Array.isArray(issue.labels) ? issue.labels : [];
  const labelNames2 = rawLabels.map(
    (l) => (typeof l === "string" ? l : l?.name || "").trim().toLowerCase()
  );
  let phase = null;
  let attention = null;
  let liveness = null;
  let dependencyState = null;
  let isExplicitV2 = false;
  for (const name of labelNames2) {
    if (name.startsWith("phase:")) {
      const p = name.slice(6).trim().replace(/-/g, "_");
      if (p === "draft" || p === "exploration" || p === "alignment" || p === "planning" || p === "execution" || p === "verification" || p === "human_verification" || p === "publication" || p === "done" || p === "archive") {
        const candidate = p;
        if (!phase || PHASE_PRECEDENCE[candidate] > PHASE_PRECEDENCE[phase]) {
          phase = candidate;
        }
        isExplicitV2 = true;
      }
    } else if (name.startsWith("attention:")) {
      const a = name.slice(10).trim();
      if (a === "none" || a === "needs-decision" || a === "needs-permission" || a === "needs-review") {
        const candidate = a;
        if (!attention || ATTENTION_PRECEDENCE[candidate] > ATTENTION_PRECEDENCE[attention]) {
          attention = candidate;
        }
        isExplicitV2 = true;
      }
    } else if (name.startsWith("liveness:")) {
      const l = name.slice(9).trim();
      if (l === "idle" || l === "running" || l === "retrying" || l === "failed" || l === "completed") {
        const candidate = l;
        if (!liveness || LIVENESS_PRECEDENCE[candidate] > LIVENESS_PRECEDENCE[liveness]) {
          liveness = candidate;
        }
      }
    } else if (name === "dependency:blocked" || name === "dependency:blocked-by-dependency") {
      dependencyState = "blocked-by-dependency";
    } else if (name === "dependency:ready") {
      if (dependencyState !== "blocked-by-dependency") {
        dependencyState = "ready";
      }
    }
  }
  if (!phase) {
    const rawPhase = issue.phase || (issue.v2Metadata?.isExplicitV2 ? issue.v2Metadata.phase : null);
    if (rawPhase && typeof rawPhase === "string") {
      const p = rawPhase.trim().toLowerCase().replace(/-/g, "_");
      if (p === "draft" || p === "exploration" || p === "alignment" || p === "planning" || p === "execution" || p === "verification" || p === "human_verification" || p === "publication" || p === "done" || p === "archive") {
        phase = p;
        isExplicitV2 = true;
      }
    }
  }
  if (!attention) {
    const rawAttention = issue.attention || (issue.v2Metadata?.isExplicitV2 ? issue.v2Metadata.attention : null);
    if (rawAttention && typeof rawAttention === "string") {
      const a = rawAttention.trim().toLowerCase();
      if (a === "none" || a === "needs-decision" || a === "needs-permission" || a === "needs-review") {
        attention = a;
        isExplicitV2 = true;
      }
    }
  }
  const closed = isIssueClosed(issue);
  if (!phase) {
    if (closed) {
      phase = "done";
    } else if (labelNames2.includes("archived") || labelNames2.includes("archive")) {
      phase = "archive";
    } else if (labelNames2.includes("status:in-review")) {
      phase = "verification";
    } else if (labelNames2.includes("status:in-progress")) {
      phase = "execution";
    } else if (labelNames2.includes("status:planned") || labelNames2.includes("status:todo")) {
      phase = "planning";
    } else if (labelNames2.includes("status:needs-alignment")) {
      phase = "alignment";
    } else if (labelNames2.includes("status:draft") || labelNames2.includes("status:backlog")) {
      phase = "draft";
    } else if (labelNames2.includes("status:needs-human")) {
      phase = "execution";
    } else if (isVagueIdea(issue)) {
      phase = "draft";
    } else {
      phase = "planning";
    }
  }
  const matchedSession = resolveMatchedSession(issue, session);
  if (!attention) {
    if (closed || phase === "done" || phase === "archive") {
      attention = "none";
    } else {
      if (matchedSession) {
        const act = (typeof matchedSession.activity === "string" ? matchedSession.activity : "").trim();
        if (act === "waiting-permission") {
          attention = "needs-permission";
        } else if (act === "waiting-question") {
          attention = "needs-decision";
        } else if (act === "waiting-review") {
          attention = "needs-review";
        } else if (act.startsWith("waiting")) {
          attention = "needs-decision";
        }
      }
      if (!attention) {
        const humanTasks = Array.isArray(issue.humanTasks) ? issue.humanTasks : parseHumanTasks(typeof issue.body === "string" ? issue.body : "");
        const openHumanTasks = humanTasks.filter((t) => !t.completed);
        if (openHumanTasks.length > 0) {
          const hasPerm = openHumanTasks.some(
            (t) => /\b(permission|grant|access|secret|token|credential|deploy|provision)\b/i.test(t.text)
          );
          const hasDec = openHumanTasks.some(
            (t) => /\b(decide|decision|choose|choice|answer)\b/i.test(t.text)
          );
          if (hasPerm) {
            attention = "needs-permission";
          } else if (hasDec) {
            attention = "needs-decision";
          } else {
            attention = "needs-review";
          }
        } else {
          const questions = Array.isArray(issue.openQuestions) ? issue.openQuestions : parseOpenQuestions(typeof issue.body === "string" ? issue.body : "");
          const openQuestions = questions.filter((q) => !q.completed);
          if (openQuestions.length > 0) {
            attention = "needs-decision";
          } else if (labelNames2.includes("status:needs-human")) {
            attention = "needs-review";
          } else {
            attention = "none";
          }
        }
      }
    }
  }
  if (!liveness) {
    if (matchedSession) {
      const act = (typeof matchedSession.activity === "string" ? matchedSession.activity : "").trim();
      const stat = (typeof matchedSession.status === "string" ? matchedSession.status : "").trim();
      if (act === "running" || stat === "running") {
        liveness = "running";
      } else if (act === "retrying" || stat === "retrying") {
        liveness = "retrying";
      } else if (act === "failed" || stat === "failed" || matchedSession.error) {
        liveness = "failed";
      } else if (act === "completed" || stat === "completed") {
        liveness = "completed";
      } else {
        liveness = "idle";
      }
    } else if (closed || phase === "done") {
      liveness = "completed";
    } else {
      liveness = "idle";
    }
  }
  if (!dependencyState) {
    const blockers = parseIssueDependencies(typeof issue.body === "string" ? issue.body : "");
    if (blockers.length > 0) {
      if (allIssues && Array.isArray(allIssues) && allIssues.length > 0) {
        const openBlockers = blockers.filter((num) => {
          const target = allIssues.find((i) => i.number === num);
          if (!target) return true;
          return !isIssueClosed(target);
        });
        dependencyState = openBlockers.length > 0 ? "blocked-by-dependency" : "ready";
      } else {
        dependencyState = "blocked-by-dependency";
      }
    } else {
      dependencyState = "ready";
    }
  }
  return {
    phase,
    attention,
    liveness,
    dependencyState,
    isExplicitV2
  };
}
function hasPriorityLabel(issueOrLabels) {
  if (!issueOrLabels) return false;
  const rawLabels = Array.isArray(issueOrLabels) ? issueOrLabels : Array.isArray(issueOrLabels.labels) ? issueOrLabels.labels : [];
  for (const l of rawLabels) {
    const name = (typeof l === "string" ? l : l?.name || "").trim().toLowerCase();
    if (name.startsWith("priority:")) {
      const val = name.slice(9).trim();
      if (val && val !== "none") {
        return true;
      }
    }
  }
  return false;
}
function resolveIssueColumn(issue, sessionOrList) {
  if (!issue) return null;
  if (isIssueClosed(issue)) {
    return "done";
  }
  const rawLabels = Array.isArray(issue.labels) ? issue.labels : [];
  const labelNames2 = rawLabels.map(
    (l) => (typeof l === "string" ? l : l?.name || "").trim().toLowerCase()
  );
  if (labelNames2.includes("status:done")) return "done";
  if (labelNames2.includes("status:in-review")) return "in-review";
  if (labelNames2.includes("status:needs-human")) return "needs-human";
  const matchedSession = resolveMatchedSession(issue, sessionOrList);
  const isSessionRunning = Boolean(matchedSession && matchedSession.activity === "running");
  const isSessionWaiting = Boolean(
    matchedSession && (matchedSession.activity === "waiting-permission" || matchedSession.activity === "waiting-question" || matchedSession.activity.startsWith("waiting"))
  );
  const isSessionIdle = Boolean(matchedSession && matchedSession.activity === "idle");
  if (labelNames2.includes("status:in-progress")) {
    if (isSessionIdle || isSessionWaiting) {
      return "needs-human";
    }
    return "in-progress";
  }
  if (isSessionRunning) return "in-progress";
  if (isSessionWaiting || isSessionIdle) return "needs-human";
  const hasExplicitPhase = labelNames2.some((l) => l.startsWith("phase:"));
  const hasExplicitAttention = labelNames2.some((l) => l.startsWith("attention:"));
  if (hasExplicitPhase || hasExplicitAttention || issue.v2Metadata?.isExplicitV2) {
    const meta = issue.v2Metadata && issue.v2Metadata.isExplicitV2 ? issue.v2Metadata : resolveV2Metadata(issue, sessionOrList);
    if (meta.phase === "done" || meta.phase === "archive") {
      return "done";
    }
    if (isSessionWaiting || isSessionIdle) {
      return "needs-human";
    }
    if (meta.attention === "needs-decision" || meta.attention === "needs-permission" || meta.attention === "needs-review") {
      return "needs-human";
    }
    if (isSessionRunning) {
      return "in-progress";
    }
    switch (meta.phase) {
      case "draft":
      case "exploration":
      case "alignment":
        return "draft";
      case "planning":
        return "todo";
      case "execution":
        return "in-progress";
      case "verification":
      case "publication":
        return "in-review";
      case "human_verification":
        return "needs-human";
      case "done":
      case "archive":
        return "done";
      default:
        return "todo";
    }
  }
  if (!hasPriorityLabel(issue)) {
    return "draft";
  }
  if (labelNames2.includes("status:planned")) {
    return "planned";
  }
  if (labelNames2.includes("status:todo")) {
    return "todo";
  }
  if (labelNames2.includes("status:backlog")) {
    return "backlog";
  }
  if (labelNames2.includes("status:draft") || isVagueIdea(issue)) {
    return "draft";
  }
  return "todo";
}
function normalizeGithubIssues(rawItems) {
  if (!rawItems || !Array.isArray(rawItems)) return [];
  const parseRepo2 = (val) => {
    if (!val || typeof val !== "string") return null;
    const apiMatch = /api\.github\.com\/repos\/([^/\s]+)\/([^/\s#?]+)/i.exec(val);
    if (apiMatch) return `${apiMatch[1]}/${apiMatch[2].replace(/\.git$/, "")}`;
    const githubMatch = /github\.com\/([^/\s]+)\/([^/\s#?]+)/i.exec(val);
    if (githubMatch) return `${githubMatch[1]}/${githubMatch[2].replace(/\.git$/, "")}`;
    const cleaned = val.trim().replace(/\.git$/, "");
    if (/^[^/\s]+\/[^/\s]+$/.test(cleaned)) return cleaned;
    return null;
  };
  return rawItems.filter((item) => item && !item.pull_request).map((item) => {
    const repo = !item.repo && !item.repository_url && !item.html_url ? void 0 : parseRepo2(item.repo) || parseRepo2(item.repository_url) || parseRepo2(item.html_url) || void 0;
    const ac = parseAcceptanceCriteria(item.body || "");
    const subtasks = parseSubtasks(item.body || "");
    const openQuestions = parseOpenQuestions(item.body || "");
    const humanTasks = parseHumanTasks(item.body || "");
    const labels = Array.isArray(item.labels) && item.labels.length > 0 ? item.labels.map((l) => typeof l === "string" ? { name: l } : { name: l.name, ...l.color ? { color: l.color } : {} }) : [];
    const assignees = Array.isArray(item.assignees) && item.assignees.length > 0 ? item.assignees.map((a) => ({ login: a.login, ...a.avatar_url ? { avatar_url: a.avatar_url } : {} })) : [];
    const issue = {
      number: item.number,
      title: item.title || "",
      body: item.body || "",
      state: item.state || "open",
      html_url: item.html_url || "",
      labels,
      ...item.user ? { user: { login: item.user.login, ...item.user.avatar_url ? { avatar_url: item.user.avatar_url } : {} } } : {},
      assignees,
      comments: item.comments || 0,
      created_at: item.created_at || "",
      ...item.updated_at ? { updated_at: item.updated_at } : {},
      subtasks,
      openQuestions,
      humanTasks,
      ...ac.length > 0 ? { acceptanceCriteria: ac } : {},
      ...repo ? { repo } : {},
      ...item.projectId ? { projectId: item.projectId } : {},
      ...item.projectName ? { projectName: item.projectName } : {}
    };
    const shouldPopulateV2 = Boolean(
      item.v2Metadata || item.labels !== void 0 || ac.length > 0 || item.phase || item.attention
    );
    if (shouldPopulateV2) {
      issue.v2Metadata = resolveV2Metadata(issue);
    }
    return issue;
  });
}

// web/server/board.ts
var statusSet2 = new Set(STATUS_LABELS);
var fencePattern2 = /^ {0,3}(`{3,}|~{3,})/;
var closeFencePattern2 = /^ {0,3}(`{3,}|~{3,})[ \t]*$/;
var indentedCodeLinePattern = /^(?: {4}| {0,3}\t)/;
var orderMarkerSingleLine = /^ {0,3}<!--\s*board-order:\s*(-?(?:\d+(?:\.\d*)?|\.\d+)(?:e[-+]?\d+)?)\s*-->[ \t]*$/i;
function scanBodyLines(body) {
  const lines = [];
  let inCodeFence = false;
  let fenceChar = "";
  let fenceLen = 0;
  let i = 0;
  while (i < body.length) {
    const start = i;
    while (i < body.length && body.charCodeAt(i) !== 10 && body.charCodeAt(i) !== 13) {
      i += 1;
    }
    const contentEnd = i;
    if (i < body.length) {
      if (body.charCodeAt(i) === 13 && i + 1 < body.length && body.charCodeAt(i + 1) === 10) {
        i += 2;
      } else {
        i += 1;
      }
    }
    const fullEnd = i;
    const rawText = body.slice(start, contentEnd);
    const cleanText = start === 0 && rawText.startsWith("\uFEFF") ? rawText.slice(1) : rawText;
    let fenced = inCodeFence;
    if (!inCodeFence) {
      const m = fencePattern2.exec(cleanText);
      if (m) {
        inCodeFence = true;
        fenced = true;
        fenceChar = m[1][0];
        fenceLen = m[1].length;
      }
    } else {
      const m = closeFencePattern2.exec(cleanText);
      if (m && m[1][0] === fenceChar && m[1].length >= fenceLen) {
        inCodeFence = false;
      }
    }
    const indentedCode = !fenced && indentedCodeLinePattern.test(cleanText);
    lines.push({ start, contentEnd, fullEnd, text: cleanText, fenced, indentedCode });
  }
  return lines;
}
function parseMarkerLineValue(line) {
  if (line.fenced || line.indentedCode) return null;
  const match = orderMarkerSingleLine.exec(line.text);
  if (!match) return null;
  const num = Number(match[1]);
  return Number.isFinite(num) ? num : null;
}
function locateTerminalOrderMarker(body) {
  if (!body) return null;
  const lines = scanBodyLines(body);
  let idx = lines.length - 1;
  while (idx >= 0 && !lines[idx].fenced && /^[ \t]*$/.test(lines[idx].text)) {
    idx -= 1;
  }
  if (idx < 0) return null;
  const order = parseMarkerLineValue(lines[idx]);
  if (order === null) return null;
  let firstMarkerIdx = idx;
  let probe = idx - 1;
  while (probe >= 0) {
    let blankProbe = probe;
    while (blankProbe >= 0 && !lines[blankProbe].fenced && /^[ \t]*$/.test(lines[blankProbe].text)) {
      blankProbe -= 1;
    }
    if (blankProbe >= 0 && parseMarkerLineValue(lines[blankProbe]) !== null) {
      firstMarkerIdx = blankProbe;
      probe = blankProbe - 1;
    } else {
      break;
    }
  }
  return { order, cutOffset: lines[firstMarkerIdx].start };
}
function trimTrailingBlankLines(value) {
  const lines = scanBodyLines(value);
  let idx = lines.length - 1;
  while (idx >= 0 && !/\S/.test(lines[idx].text)) {
    idx -= 1;
  }
  return idx >= 0 ? value.slice(0, lines[idx].contentEnd) : "";
}
function hasUnfencedOrderMarkerComment(body = "") {
  return scanBodyLines(body).some(
    (line) => !line.fenced && !line.indentedCode && /^ {0,3}<!--\s*board-order:/i.test(line.text)
  );
}
function parseOrderMarker(body = "") {
  const located = locateTerminalOrderMarker(body);
  return located ? located.order : null;
}
function stripOrderMarker(body = "") {
  const located = locateTerminalOrderMarker(body);
  return located ? body.slice(0, located.cutOffset) : body;
}
function setOrderMarker(body, order) {
  if (!Number.isFinite(order)) throw new BoardError("invalid", "Order must be finite");
  const base = trimTrailingBlankLines(stripOrderMarker(body));
  const eol = body.includes("\r\n") ? "\r\n" : "\n";
  return (base ? base + eol + eol : "") + `<!-- board-order: ${order} -->`;
}
function midpointOrder(previous, next) {
  return previous === null ? next === null ? 1e3 : next - 1e3 : next === null ? previous + 1e3 : previous / 2 + next / 2;
}
function listFields(raw, repository) {
  const body = typeof raw.body === "string" ? raw.body : "";
  const description = trimTrailingBlankLines(stripOrderMarker(body));
  const dependencies = [];
  for (const line of scanBodyLines(description)) {
    if (line.fenced || line.indentedCode) continue;
    if (/^\s*(?:(?:[-*+]|\d+[.)])\s*(?:\[[ xX]\]\s*)?)?(?:blocked by|depends on|requires)\b/i.test(line.text)) {
      for (const match of line.text.matchAll(/#(\d+)/g)) {
        const dep = Number(match[1]);
        if (Number.isInteger(dep) && dep > 0 && !dependencies.includes(dep)) {
          dependencies.push(dep);
        }
      }
    }
  }
  return {
    createdAt: raw.created_at ?? null,
    description,
    order: parseOrderMarker(body),
    fingerprint: issueFingerprint(raw, repository),
    dependencies,
    pendingItems: [...normalizedOf(raw)?.humanTasks ?? [], ...parseWebOpenQuestions(body)].map((item) => ({ text: item.text, completed: item.completed }))
  };
}
var BoardError = class extends Error {
  code;
  constructor(code, message) {
    super(message);
    this.name = "BoardError";
    this.code = code;
  }
};
var checklistRegex2 = /^(\s*(?:[-*+]|\d+\.)\s*\[)([ xX])(\]\s+)(.+)$/;
var questionsSectionRegex2 = /^[ \t]*#{1,6}\s*(?:open\s+)?questions(?:\s*:)?/i;
var humanTasksSectionRegex2 = /^[ \t]*#{1,6}\s*human\s+tasks?(?:\s*:)?/i;
var headingRegex2 = /^[ ]{0,3}#{1,6}\s+/;
function parseWebOpenQuestions(body) {
  if (!body || typeof body !== "string" || !body.includes("[")) return [];
  const cleanBody = body.startsWith("\uFEFF") ? body.slice(1) : body;
  if (!/question/i.test(cleanBody)) return [];
  const hasCR = cleanBody.includes("\r");
  const lines = cleanBody.split("\n");
  const questions = [];
  let inQuestionsSection = false;
  let inHumanTasksSection = false;
  let inCodeFence = false;
  let fenceChar = "";
  let fenceLen = 0;
  for (let i = 0; i < lines.length; i += 1) {
    const rawLine = lines[i];
    const line = hasCR && rawLine.includes("\r") ? rawLine.replace(/\r/g, "") : rawLine;
    const cleanLine = line.replace(/\r$/, "");
    if (!inCodeFence) {
      const match = fencePattern2.exec(cleanLine);
      if (match) {
        inCodeFence = true;
        fenceChar = match[1][0];
        fenceLen = match[1].length;
        continue;
      }
    } else {
      const match = closeFencePattern2.exec(cleanLine);
      if (match && match[1][0] === fenceChar && match[1].length >= fenceLen) {
        inCodeFence = false;
      }
      continue;
    }
    if (indentedCodeLinePattern.test(cleanLine)) {
      continue;
    }
    if (line.includes("#")) {
      const isQuestions = questionsSectionRegex2.test(line);
      const isHuman = humanTasksSectionRegex2.test(line);
      if (isQuestions || isHuman || headingRegex2.test(line)) {
        inQuestionsSection = isQuestions;
        inHumanTasksSection = isHuman;
        continue;
      }
    }
    if (inQuestionsSection) {
      let completed = false;
      let text = "";
      if (line.charCodeAt(0) === 45 && line.charCodeAt(1) === 32 && line.charCodeAt(2) === 91 && (line.charCodeAt(3) === 32 || line.charCodeAt(3) === 120 || line.charCodeAt(3) === 88) && line.charCodeAt(4) === 93 && line.charCodeAt(5) === 32) {
        completed = line.charCodeAt(3) === 120 || line.charCodeAt(3) === 88;
        text = line.slice(6).trim();
      } else {
        const match = line.match(checklistRegex2);
        if (match) {
          completed = match[2].toLowerCase() === "x";
          text = match[4].trim();
        }
      }
      if (text) {
        questions.push({
          id: `question-${i}`,
          lineIndex: i,
          completed,
          text,
          rawLine
        });
      }
    } else if (!inHumanTasksSection) {
      if (line.includes("?") || line.includes("Q:") || line.includes("q:") || /question/i.test(line)) {
        let completed = false;
        let text = "";
        if (line.charCodeAt(0) === 45 && line.charCodeAt(1) === 32 && line.charCodeAt(2) === 91 && (line.charCodeAt(3) === 32 || line.charCodeAt(3) === 120 || line.charCodeAt(3) === 88) && line.charCodeAt(4) === 93 && line.charCodeAt(5) === 32) {
          completed = line.charCodeAt(3) === 120 || line.charCodeAt(3) === 88;
          text = line.slice(6).trim();
        } else {
          const match = line.match(checklistRegex2);
          if (match) {
            completed = match[2].toLowerCase() === "x";
            text = match[4].trim();
          }
        }
        if (text && /^(?:\?|Q:|Question:)/i.test(text)) {
          const qText = text.replace(/^(?:\?|Q:|Question:)\s*/i, "").trim();
          if (qText) {
            questions.push({
              id: `question-${i}`,
              lineIndex: i,
              completed,
              text: qText,
              rawLine
            });
          }
        }
      }
    }
  }
  return questions;
}
function issueKey(repository, number) {
  return repository && repository.full ? `${repository.full}#${number}` : `#${number}`;
}
function labelNames(raw) {
  if (!Array.isArray(raw?.labels)) return [];
  return raw.labels.map((label) => typeof label === "string" ? label : label?.name ?? "").filter((name) => name !== "");
}
function statusLabelOf(labels) {
  for (const label of labels) {
    const normalized = label.trim().toLowerCase();
    if (statusSet2.has(normalized)) return normalized;
  }
  return null;
}
function countsOf(items = []) {
  return {
    total: items.length,
    done: items.filter((item) => item.completed).length,
    open: items.filter((item) => !item.completed).length
  };
}
function issueFingerprint(raw, repository = null) {
  const body = typeof raw?.body === "string" ? raw.body : "";
  const labels = labelNames(raw).map((label) => label.trim().toLowerCase()).sort();
  const state = raw?.state === "closed" ? "closed" : "open";
  return createHash2("sha256").update(JSON.stringify({ body, title: raw?.title ?? "", labels, state, ...repository ? { repository: repository.id ?? repository.full, full: repository.full, number: raw.number } : {} })).digest("hex");
}
function normalizedOf(raw) {
  const issues = normalizeGithubIssues([raw]);
  return issues.length > 0 ? issues[0] : null;
}
function buildBoardListItem(rawItem, repository = null) {
  const normalized = normalizeGithubIssues([rawItem]);
  if (!normalized.length) {
    throw new BoardError("not_an_issue", "That item is not an issue");
  }
  const issue = normalized[0];
  const metadata = resolveV2Metadata(issue);
  const labels = labelNames(issue);
  const questions = parseWebOpenQuestions(issue.body ?? "");
  const friendly = parseFriendlyTitle(stripOrderMarker(issue.body), issue.title);
  const friendlyTitle = friendly.subtitle && friendly.title !== issue.title ? friendly.title : null;
  return {
    ...listFields(rawItem, repository),
    number: issue.number,
    key: issueKey(repository, issue.number),
    repository,
    title: issue.title,
    friendlyTitle,
    state: issue.state,
    htmlUrl: issue.html_url,
    labels,
    statusLabel: statusLabelOf(labels),
    phase: metadata.phase,
    attention: metadata.attention,
    column: resolveIssueColumn(issue),
    updatedAt: issue.updated_at ?? null,
    counts: {
      subtasks: countsOf(issue.subtasks),
      openQuestions: countsOf(questions),
      humanTasks: countsOf(issue.humanTasks ?? [])
    }
  };
}
function buildBoardList(rawItems, repository = null) {
  const raw = Array.isArray(rawItems) ? rawItems : [];
  const issues = raw.filter((item) => normalizedOf(item)).map((item) => buildBoardListItem(item, repository));
  return { issues, excluded: raw.length - issues.length };
}
function buildIssueDetail(raw, repository = null) {
  if (!raw || raw.pull_request) {
    throw new BoardError("not_an_issue", "That number is a pull request or not an issue");
  }
  const issue = normalizedOf(raw);
  if (!issue) {
    throw new BoardError("not_an_issue", "That number is not an issue");
  }
  const metadata = resolveV2Metadata(issue);
  const labels = labelNames(raw);
  const questions = parseWebOpenQuestions(issue.body ?? "");
  let answerIndex = 0;
  const openQuestions = questions.map((question, index) => {
    const view = {
      index,
      answerIndex: question.completed ? null : answerIndex,
      text: question.text,
      completed: question.completed
    };
    if (!question.completed) answerIndex += 1;
    return view;
  });
  const testPlan = parseTestPlan(issue.body);
  const friendly = parseFriendlyTitle(stripOrderMarker(issue.body), issue.title);
  const friendlyTitle = friendly.subtitle && friendly.title !== issue.title ? friendly.title : null;
  return {
    ...listFields(raw, repository),
    number: issue.number,
    key: issueKey(repository, issue.number),
    repository,
    title: issue.title,
    friendlyTitle,
    state: issue.state,
    htmlUrl: issue.html_url,
    body: stripOrderMarker(issue.body),
    fingerprint: issueFingerprint(raw, repository),
    labels,
    statusLabel: statusLabelOf(labels),
    phase: metadata.phase,
    attention: metadata.attention,
    column: resolveIssueColumn(issue),
    updatedAt: issue.updated_at ?? null,
    createdAt: issue.created_at ?? null,
    editableSections: editableSections(stripOrderMarker(issue.body)),
    openQuestions,
    humanTasks: (issue.humanTasks ?? []).map((task) => ({
      text: task.text,
      completed: task.completed,
      lineIndex: task.lineIndex
    })),
    acceptanceCriteria: (issue.acceptanceCriteria ?? []).map((item) => ({
      text: item.text,
      completed: item.completed,
      lineIndex: item.lineIndex
    })),
    subtasks: issue.subtasks.map((item) => ({
      text: item.text,
      completed: item.completed,
      lineIndex: item.lineIndex
    })),
    testPlan: {
      issue: testPlan.issueTests.map((item) => ({ text: item.text, completed: item.completed })),
      batch: testPlan.batchTests.map((item) => ({ text: item.text, completed: item.completed }))
    }
  };
}
function applyQuestionAnswer(raw, index, answer) {
  if (typeof answer !== "string" || answer.trim() === "") {
    throw new BoardError("invalid", "An answer is required");
  }
  if (answer.length > 2e3) {
    throw new BoardError("invalid", "The answer is too long");
  }
  if (typeof index !== "number" || !Number.isInteger(index) || index < 0) {
    throw new BoardError("invalid", "A question index is required");
  }
  const body = typeof raw?.body === "string" ? raw.body : "";
  const questions = parseWebOpenQuestions(body);
  const unresolved = questions.filter((q) => !q.completed);
  if (index >= unresolved.length) {
    throw new BoardError("invalid", "That open question is no longer answerable");
  }
  const target = unresolved[index];
  const lines = body.split("\n");
  const rawLine = lines[target.lineIndex];
  if (!rawLine) {
    throw new BoardError("invalid", "That open question is no longer answerable");
  }
  const hasCr = rawLine.endsWith("\r");
  const cleanLine = hasCr ? rawLine.slice(0, -1) : rawLine;
  if (indentedCodeLinePattern.test(cleanLine)) {
    throw new BoardError("invalid", "That open question is no longer answerable");
  }
  const match = cleanLine.match(checklistRegex2);
  if (!match) {
    throw new BoardError("invalid", "That open question is no longer answerable");
  }
  const cleanAnswer = answer.trim().replace(/\r?\n+/g, " ");
  const lineEnding = hasCr ? "\r" : "";
  const questionContent = match[4].replace(/\s*\*\s*\(Answer:[\s\S]*?\)\s*\*$/i, "").trimEnd();
  lines[target.lineIndex] = `${match[1]}x${match[3]}${questionContent} *(Answer: ${cleanAnswer})*${lineEnding}`;
  return lines.join("\n");
}
function applyStatusChange(raw, status) {
  try {
    return setStatusLabel(labelNames(raw), typeof status === "string" ? status : null);
  } catch (error) {
    if (error instanceof SectionError) {
      throw new BoardError("not_editable", "That status is not part of the agreed label set");
    }
    throw error;
  }
}

// web/server/app.ts
var HttpError = class extends Error {
  status;
  code;
  extra;
  headers;
  constructor(status, code, message, extra = {}, headers = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.extra = extra;
    this.headers = headers;
  }
};
var MAX_BODY_BYTES2 = 64 * 1024;
var MAX_AGGREGATE_ISSUES = 500;
var SECURITY_HEADERS = {
  "content-security-policy": "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "referrer-policy": "no-referrer",
  "cross-origin-opener-policy": "same-origin",
  "cache-control": "no-store"
};
var FORBIDDEN_QUERY_KEYS = ["repo", "repository", "owner", "name", "org", "organization"];
function loadStatic(name) {
  return readFileSync(new URL(`../public/${name}`, import.meta.url), "utf8");
}
function loadStaticBuffer(name) {
  return readFileSync(new URL(`../public/${name}`, import.meta.url));
}
var cachedVersion = null;
function getPackageVersion(packageJsonUrl = new URL("../../package.json", import.meta.url)) {
  const isDefault = packageJsonUrl.toString() === new URL("../../package.json", import.meta.url).toString();
  if (isDefault && cachedVersion !== null) return cachedVersion;
  try {
    const raw = readFileSync(packageJsonUrl, "utf8");
    const parsed = JSON.parse(raw);
    if (typeof parsed.version === "string" && parsed.version) {
      if (isDefault) cachedVersion = parsed.version;
      return parsed.version;
    }
  } catch {
  }
  return "unknown";
}
function getVersionStamp(packageJsonUrl = new URL("../../package.json", import.meta.url)) {
  const pkgVersion = getPackageVersion(packageJsonUrl);
  try {
    const hash = createHash3("sha256");
    const shellAssets = ["index.html", "app.js", "theme.css", "manifest.json"];
    for (const name of shellAssets) {
      const content = readFileSync(new URL(`../public/${name}`, import.meta.url));
      hash.update(name);
      hash.update(content);
    }
    const digest = hash.digest("hex").slice(0, 10);
    return `${pkgVersion}-${digest}`;
  } catch {
    return pkgVersion;
  }
}
function redactLine(line, secrets) {
  let output = line;
  for (const secret of secrets) {
    if (secret && secret.length >= 8) output = output.split(secret).join("[redacted]");
  }
  return output.replace(/gh[pousr]_[A-Za-z0-9_]{8,}/g, "[redacted-token]").replace(/github_pat_[A-Za-z0-9_]{8,}/g, "[redacted-token]").replace(/board_session=[^;\s]+/g, "board_session=[redacted]");
}
function readJsonBody(req, timeoutMs = 1e4) {
  return new Promise((resolve, reject) => {
    if (req.destroyed || req.closed) {
      reject(new HttpError(400, "invalid_request", "The request was aborted"));
      return;
    }
    const chunks = [];
    let size = 0;
    let tooLarge = false;
    let done = false;
    let timer = null;
    const cleanup = () => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      req.removeListener("data", onData);
      req.removeListener("end", onEnd);
      req.removeListener("error", onError);
      req.removeListener("close", onClose);
    };
    const finishReject = (error) => {
      if (done) return;
      done = true;
      cleanup();
      reject(error);
    };
    const finishResolve = (val) => {
      if (done) return;
      done = true;
      cleanup();
      resolve(val);
    };
    const onData = (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES2) {
        tooLarge = true;
        chunks.length = 0;
        return;
      }
      if (!tooLarge) chunks.push(chunk);
    };
    const onEnd = () => {
      if (tooLarge) {
        finishReject(new HttpError(413, "payload_too_large", "The request body is too large"));
        return;
      }
      const raw = Buffer.concat(chunks).toString("utf8");
      if (!raw) return finishResolve(null);
      try {
        finishResolve(JSON.parse(raw));
      } catch {
        finishReject(new HttpError(400, "invalid_json", "The request body must be JSON"));
      }
    };
    const onError = () => {
      finishReject(new HttpError(400, "invalid_request", "The request could not be read"));
    };
    const onClose = () => {
      if (!req.readableEnded) {
        finishReject(new HttpError(400, "invalid_request", "The request connection was closed prematurely"));
      }
    };
    if (timeoutMs > 0) {
      timer = setTimeout(() => {
        req.destroy();
        finishReject(new HttpError(408, "request_timeout", "Request body timed out"));
      }, timeoutMs);
    }
    req.on("data", onData);
    req.on("end", onEnd);
    req.on("error", onError);
    req.on("close", onClose);
  });
}
function mapGitHubError(error) {
  if (error instanceof HttpError) throw error;
  if (error instanceof GitHubError) {
    if (error.kind === "unauthorized") {
      throw new HttpError(502, "github_unauthorized", "GitHub rejected credentials or token expired");
    }
    if (error.kind === "forbidden") {
      throw new HttpError(502, "github_forbidden", "GitHub refused access to the repository");
    }
    if (error.kind === "not_found") {
      throw new HttpError(404, "not_found", "That issue was not found in the configured repository");
    }
    if (error.kind === "invalid") {
      throw new HttpError(400, "invalid_request", "The issue reference is not valid");
    }
    if (error.kind === "rate_limited") {
      throw new HttpError(503, "github_rate_limited", "GitHub is rate limiting the board; try again later");
    }
    throw new HttpError(502, "github_unavailable", "GitHub could not be reached");
  }
  throw error;
}
var ScryptQueue = class {
  active = 0;
  maxConcurrent;
  maxQueue;
  queue = [];
  constructor(maxConcurrent = 2, maxQueue = 4) {
    this.maxConcurrent = maxConcurrent;
    this.maxQueue = maxQueue;
  }
  async run(fn) {
    if (this.active >= this.maxConcurrent) {
      if (this.queue.length >= this.maxQueue) {
        throw new HttpError(
          429,
          "rate_limited",
          "The sign-in service is busy; try again in a moment",
          { retryAfterSeconds: 2 },
          { "retry-after": "2" }
        );
      }
      await new Promise((resolve) => this.queue.push(resolve));
    }
    this.active += 1;
    try {
      return await fn();
    } finally {
      this.active -= 1;
      const next = this.queue.shift();
      if (next) next();
    }
  }
};
function getClientIp(req) {
  return req.socket.remoteAddress ?? "unknown";
}
function assertOriginAllowed(req, baseUrl) {
  if (!baseUrl) return;
  let expectedOrigin;
  try {
    expectedOrigin = new URL(baseUrl).origin;
  } catch {
    return;
  }
  const origin = req.headers.origin;
  if (typeof origin === "string" && origin.trim()) {
    let parsedOrigin;
    try {
      parsedOrigin = new URL(origin).origin;
    } catch {
      throw new HttpError(403, "cross_origin_rejected", "Cross-origin write requests are not allowed");
    }
    if (parsedOrigin !== expectedOrigin) {
      throw new HttpError(403, "cross_origin_rejected", "Cross-origin write requests are not allowed");
    }
    return;
  }
  const referer = req.headers.referer;
  if (typeof referer === "string" && referer.trim()) {
    let parsedRefererOrigin;
    try {
      parsedRefererOrigin = new URL(referer).origin;
    } catch {
      throw new HttpError(403, "cross_origin_rejected", "Cross-origin write requests are not allowed");
    }
    if (parsedRefererOrigin !== expectedOrigin) {
      throw new HttpError(403, "cross_origin_rejected", "Cross-origin write requests are not allowed");
    }
  }
}
async function createBoardServer(options) {
  const { config } = options;
  const now = options.now ?? Date.now;
  const logs = [];
  const sink = options.logger ?? (() => {
  });
  const secrets = [config.githubToken, config.sessionSecret];
  const log = (line) => {
    const safe = redactLine(line, secrets);
    logs.push(safe);
    sink(safe);
  };
  const github = new GitHubClient({
    apiBase: options.githubApiBase ?? config.githubApiBase,
    token: config.githubToken,
    repo: config.repo,
    fetchImpl: options.fetchImpl
  });
  let account;
  try {
    account = await github.getAuthenticatedUser();
  } catch (error) {
    if (error instanceof GitHubError && (error.kind === "unauthorized" || error.kind === "forbidden")) {
      throw new ConfigError("BOARD_GITHUB_TOKEN", "BOARD_GITHUB_TOKEN was rejected by GitHub");
    }
    throw new ConfigError("BOARD_GITHUB_TOKEN", "BOARD_GITHUB_TOKEN could not be verified with GitHub");
  }
  if (account.login.toLowerCase() !== config.githubLogin.toLowerCase()) {
    throw new ConfigError(
      "BOARD_GITHUB_LOGIN",
      "BOARD_GITHUB_LOGIN does not match the account that owns BOARD_GITHUB_TOKEN"
    );
  }
  const repositories = new RepositoryRegistry({ client: github, now, ttlMs: options.repositoryTtlMs });
  await repositories.view();
  function clientFor(repository) {
    return new GitHubClient({
      apiBase: options.githubApiBase ?? config.githubApiBase,
      token: config.githubToken,
      repo: repository,
      fetchImpl: options.fetchImpl
    });
  }
  async function resolveRepository(owner, name) {
    try {
      return await repositories.resolve(owner, name);
    } catch (error) {
      if (error instanceof RepositoryNotAllowedError) throw new HttpError(400, "repository_not_allowed", error.message);
      if (error instanceof DiscoveryUnavailableError) throw new HttpError(503, "discovery_unavailable", "Repository discovery failed; no operation was dispatched");
      throw error;
    }
  }
  const sessionFilePath = options.sessionFilePath !== void 0 ? options.sessionFilePath || void 0 : config.sessionFilePath;
  const namesPath = path3.join(path3.dirname(sessionFilePath || config.sessionFilePath), "project-names.json");
  function projectNames() {
    try {
      const parsed = JSON.parse(readFileSync(namesPath, "utf8"));
      if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") return {};
      return Object.fromEntries(Object.entries(parsed).filter(([key, value]) => /^[a-z0-9_.-]+\/[a-z0-9_.-]+$/i.test(key) && typeof value === "string" && value.length <= 60));
    } catch (error) {
      if (error.code === "ENOENT") return {};
      throw new HttpError(500, "names_unavailable", "Project names could not be read; nothing was changed");
    }
  }
  const sessions = new SessionStore({
    secret: config.sessionSecret,
    passwordHash: config.passwordHash,
    filePath: sessionFilePath,
    absoluteTtlMs: options.sessionTtlMs,
    idleTtlMs: options.idleTtlMs,
    now
  });
  const limiter = new LoginRateLimiter({ now });
  const versionStamp = options.versionStamp ?? getVersionStamp(options.packageJsonUrl);
  const rawSw = loadStatic("sw.js");
  let swBody = rawSw;
  if (/var CACHE_VERSION\s*=\s*['"][^'"]*['"]/.test(rawSw)) {
    swBody = rawSw.replace(
      /var CACHE_VERSION\s*=\s*['"][^'"]*['"]/,
      `var CACHE_VERSION = ${JSON.stringify(versionStamp)}`
    );
  } else if (/var CACHE_NAME\s*=\s*['"][^'"]*['"]/.test(rawSw)) {
    swBody = rawSw.replace(
      /var CACHE_NAME\s*=\s*['"][^'"]*['"]/,
      `var CACHE_NAME = 'workflows-board-' + ${JSON.stringify(versionStamp)}`
    );
  }
  const assets = {
    "/": { body: loadStatic("index.html"), type: "text/html; charset=utf-8" },
    "/index.html": { body: loadStatic("index.html"), type: "text/html; charset=utf-8" },
    "/app.js": { body: loadStatic("app.js"), type: "text/javascript; charset=utf-8" },
    "/theme.css": { body: loadStatic("theme.css"), type: "text/css; charset=utf-8" },
    "/manifest.json": { body: loadStatic("manifest.json"), type: "application/manifest+json; charset=utf-8" },
    "/sw.js": {
      body: swBody,
      type: "application/javascript; charset=utf-8",
      headers: {
        "service-worker-allowed": "/",
        "cache-control": "no-cache"
      }
    },
    "/icon.svg": { body: loadStatic("icon.svg"), type: "image/svg+xml; charset=utf-8" },
    "/icon-192.png": { body: loadStaticBuffer("icon-192.png"), type: "image/png" },
    "/icon-512.png": { body: loadStaticBuffer("icon-512.png"), type: "image/png" },
    "/apple-touch-icon.png": { body: loadStaticBuffer("apple-touch-icon.png"), type: "image/png" }
  };
  const server = http.createServer((req, res) => {
    const startedAt = Date.now();
    void (async () => {
      let response = { status: 204 };
      try {
        response = await handle(req);
      } catch (error) {
        if (error instanceof HttpError) {
          response = {
            status: error.status,
            body: { error: error.code, message: error.message, ...error.extra },
            headers: error.headers
          };
        } else {
          response = {
            status: 500,
            body: { error: "server_error", message: "The board could not complete that request" }
          };
        }
      }
      for (const [name, value] of Object.entries(SECURITY_HEADERS)) res.setHeader(name, value);
      if (config.baseUrl && config.baseUrl.startsWith("https:")) {
        res.setHeader("strict-transport-security", "max-age=31536000; includeSubDomains");
      }
      for (const [name, value] of Object.entries(response.headers ?? {})) {
        res.setHeader(name, value);
      }
      res.statusCode = response.status;
      if (response.buffer !== void 0) {
        res.setHeader("content-type", response.type ?? "application/octet-stream");
        res.end(response.buffer);
      } else if (response.text !== void 0) {
        res.setHeader("content-type", response.type ?? "text/plain; charset=utf-8");
        res.end(response.text);
      } else if (response.body !== void 0) {
        res.setHeader("content-type", "application/json; charset=utf-8");
        res.end(JSON.stringify(response.body));
      } else {
        res.end();
      }
      const pathname = (req.url ?? "/").split("?")[0];
      log(`${req.method ?? "GET"} ${pathname.replace(/\/api\/repos\/[^/]+\/[^/]+/, "/api/repos/:owner/:name")} ${response.status} ${Date.now() - startedAt}ms`);
    })();
  });
  function assertRepoAllowed(url) {
    for (const key of FORBIDDEN_QUERY_KEYS) {
      if (url.searchParams.has(key)) {
        throw new HttpError(
          400,
          "repository_not_allowed",
          "Repository query overrides are not allowed; use an exact discovered repository route"
        );
      }
    }
    if (/^\/repos(\/|$)/i.test(url.pathname) || /another[-_]?repo/i.test(url.pathname)) {
      throw new HttpError(
        400,
        "repository_not_allowed",
        "Repository query overrides are not allowed; use an exact discovered repository route"
      );
    }
  }
  function requireSession(req) {
    const cookies = parseCookieHeader(req.headers.cookie);
    const record = sessions.get(cookies[SESSION_COOKIE]);
    if (!record) {
      throw new HttpError(401, "unauthenticated", "Sign in to use this board");
    }
    return record;
  }
  function requireCsrf(req, record) {
    assertOriginAllowed(req, config.baseUrl);
    const provided = req.headers["x-csrf-token"];
    const token = Array.isArray(provided) ? provided[0] : provided;
    if (!csrfMatches(record.csrfToken, token)) {
      throw new HttpError(403, "csrf_rejected", "That request is missing a valid CSRF token");
    }
  }
  async function handle(req) {
    const url = new URL(req.url ?? "/", "http://board.local");
    const method = req.method ?? "GET";
    assertRepoAllowed(url);
    if (url.pathname === "/health") {
      if (method !== "GET") {
        return methodNotAllowed("GET");
      }
      return {
        status: 200,
        body: {
          status: "ok",
          version: getPackageVersion(options.packageJsonUrl),
          uptime: Math.floor(process.uptime())
        }
      };
    }
    if (method === "GET" && assets[url.pathname]) {
      const asset = assets[url.pathname];
      if (Buffer.isBuffer(asset.body)) {
        return { status: 200, buffer: asset.body, type: asset.type, headers: asset.headers };
      }
      return { status: 200, text: asset.body, type: asset.type, headers: asset.headers };
    }
    if (method !== "GET" && assets[url.pathname]) {
      return { status: 405, body: { error: "method_not_allowed", message: "That method is not allowed" }, headers: { allow: "GET" } };
    }
    if (url.pathname === "/api/session") {
      if (method === "POST") return login(req);
      if (method === "GET") {
        const cookies = parseCookieHeader(req.headers.cookie);
        const record2 = sessions.get(cookies[SESSION_COOKIE]);
        if (!record2) return { status: 200, body: { authenticated: false } };
        return {
          status: 200,
          body: { authenticated: true, csrfToken: record2.csrfToken, expiresAt: new Date(record2.expiresAt).toISOString() }
        };
      }
      if (method === "DELETE") {
        const record2 = requireSession(req);
        requireCsrf(req, record2);
        sessions.destroy(parseCookieHeader(req.headers.cookie)[SESSION_COOKIE]);
        return { status: 204, headers: { "set-cookie": buildClearCookie() } };
      }
      return { status: 405, body: { error: "method_not_allowed", message: "That method is not allowed" }, headers: { allow: "GET, POST, DELETE" } };
    }
    if (!url.pathname.startsWith("/api/")) {
      return { status: 404, body: { error: "not_found", message: "Not found" } };
    }
    const record = requireSession(req);
    if (url.pathname === "/api/repos") {
      if (method !== "GET") return methodNotAllowed("GET");
      return { status: 200, body: { ...await repositories.view(), projectNames: projectNames() } };
    }
    if (url.pathname === "/api/project-names") {
      if (method === "GET") return { status: 200, body: { projectNames: projectNames() } };
      if (method !== "PUT") return methodNotAllowed("GET, PUT");
      requireCsrf(req, record);
      const body = await readJsonBody(req);
      if (typeof body?.repository !== "string" || !/^[a-z0-9_.-]+\/[a-z0-9_.-]+$/i.test(body.repository) || typeof body?.name !== "string" || body.name.trim().length > 60 || /[\x00-\x1f\x7f<>]/.test(body.name)) {
        throw new HttpError(400, "invalid_name", "Use a project name of 1\u201360 characters (empty resets); no control characters or angle brackets");
      }
      const [owner, name] = body.repository.split("/");
      const repository2 = await resolveRepository(owner, name);
      const names = projectNames();
      const key = repository2.full.toLowerCase();
      if (body.name.trim()) names[key] = body.name.trim();
      else delete names[key];
      mkdirSync(path3.dirname(namesPath), { recursive: true, mode: 448 });
      writeFileSync(namesPath + ".tmp", JSON.stringify(names, null, 2) + "\n", { mode: 384 });
      renameSync(namesPath + ".tmp", namesPath);
      return { status: 200, body: { projectNames: names } };
    }
    if (url.pathname === "/api/combined/board") {
      if (method !== "GET") return methodNotAllowed("GET");
      return { status: 200, body: await combinedBoard() };
    }
    let route = url.pathname;
    let repository = null;
    const qualified = /^\/api\/repos\/([^/]+)\/([^/]+)(\/.*)$/.exec(route);
    if (qualified) {
      repository = await resolveRepository(qualified[1], qualified[2]);
      route = "/api" + qualified[3];
    } else if (route.startsWith("/api/repos/")) {
      throw new HttpError(400, "repository_not_allowed", "An exact discovered owner/name is required");
    } else if (route === "/api/board" || route === "/api/issues" || route.startsWith("/api/issues/")) {
      if (!config.repo) throw new HttpError(400, "repository_not_allowed", "Select a discovered repository");
      repository = await resolveRepository(config.repo.owner, config.repo.name);
    }
    const scopedGithub = repository ? clientFor(repository) : null;
    if (route === "/api/board") {
      if (method !== "GET") return methodNotAllowed("GET");
      return { status: 200, body: await repositoryBoard(repository) };
    }
    if (route === "/api/issues" && method === "POST") {
      requireCsrf(req, record);
      const body = await readJsonBody(req);
      if (!body || typeof body !== "object" || Array.isArray(body)) {
        throw new HttpError(400, "invalid_request", "Body must be a JSON object");
      }
      if (typeof body.title !== "string" || !body.title.trim() || body.title.trim().length > 256) {
        throw new HttpError(400, "invalid_request", "Issue title is required and cannot be empty");
      }
      const title = body.title.trim();
      let issueBody = void 0;
      if (body.body !== void 0) {
        if (typeof body.body !== "string") {
          throw new HttpError(400, "invalid_request", "Issue body must be a string");
        }
        issueBody = body.body;
      }
      let labels = ["status:draft"];
      if (body.labels !== void 0) {
        if (!Array.isArray(body.labels) || !body.labels.every((l) => typeof l === "string")) {
          throw new HttpError(400, "invalid_request", "Labels must be an array of strings");
        }
        labels = body.labels;
      }
      const created = await scopedGithub.createIssue({
        title,
        body: issueBody,
        labels
      }).catch(mapGitHubError);
      return {
        status: 201,
        body: {
          ok: true,
          issue: buildBoardListItem(created.item, repository)
        }
      };
    }
    if (route === "/api/issues/batch-align") {
      throw new HttpError(404, "not_found", "Not found");
    }
    const draftMatch = /^\/api\/issues\/([^/]+)\/(draft|order|move)$/.exec(route);
    if (draftMatch) {
      if (method !== "PUT") return methodNotAllowed("PUT");
      requireCsrf(req, record);
      const body = await readJsonBody(req);
      return writeIssue(repository, parseIssueNumberOrThrow(draftMatch[1]), body, {
        kind: draftMatch[2],
        data: body
      });
    }
    const detailMatch = /^\/api\/issues\/([^/]+)$/.exec(route);
    if (detailMatch) {
      if (method === "GET") {
        const number = parseIssueNumberOrThrow(detailMatch[1]);
        const read2 = await scopedGithub.getIssue(number).catch(mapGitHubError);
        if (read2.item.pull_request) {
          throw new HttpError(404, "not_found", "That number is a pull request, not an issue");
        }
        return {
          status: 200,
          body: {
            issue: buildIssueDetail(read2.item, repository),
            fetchedAt: new Date(now()).toISOString(),
            statusOptions: statusOptions()
          }
        };
      }
      if (method === "PATCH") {
        requireCsrf(req, record);
        const number = parseIssueNumberOrThrow(detailMatch[1]);
        const body = await readJsonBody(req);
        return writeIssue(repository, number, body, {
          kind: "patch",
          body: body?.body,
          status: body?.status,
          state: body?.state
        });
      }
      return methodNotAllowed("GET, PATCH");
    }
    const sectionMatch = /^\/api\/issues\/([^/]+)\/section$/.exec(route);
    if (sectionMatch) {
      if (method !== "PUT") return methodNotAllowed("PUT");
      requireCsrf(req, record);
      const number = parseIssueNumberOrThrow(sectionMatch[1]);
      const body = await readJsonBody(req);
      return writeIssue(repository, number, body, {
        kind: "section",
        sectionId: body?.sectionId,
        text: body?.text
      });
    }
    const answerMatch = /^\/api\/issues\/([^/]+)\/questions\/([^/]+)\/answer$/.exec(route);
    if (answerMatch) {
      if (method !== "POST") return methodNotAllowed("POST");
      requireCsrf(req, record);
      const number = parseIssueNumberOrThrow(answerMatch[1]);
      const index = Number(answerMatch[2]);
      if (!/^\d{1,4}$/.test(answerMatch[2])) {
        throw new HttpError(400, "invalid_request", "The question index is not valid");
      }
      const body = await readJsonBody(req);
      return writeIssue(repository, number, body, {
        kind: "question",
        index,
        answer: body?.answer
      });
    }
    const statusMatch = /^\/api\/issues\/([^/]+)\/status$/.exec(route);
    if (statusMatch) {
      if (method !== "POST") return methodNotAllowed("POST");
      requireCsrf(req, record);
      const number = parseIssueNumberOrThrow(statusMatch[1]);
      const body = await readJsonBody(req);
      if (!body || typeof body.status !== "string") {
        throw new HttpError(400, "invalid_request", "A status label is required");
      }
      return writeIssue(repository, number, body, {
        kind: "status",
        status: body.status
      });
    }
    if (url.pathname.startsWith("/api/")) {
      if (!["GET", "POST", "PUT", "DELETE", "PATCH"].includes(method)) {
        return methodNotAllowed("GET, POST, PUT, DELETE, PATCH");
      }
      return { status: 404, body: { error: "not_found", message: "Not found" } };
    }
    return { status: 404, body: { error: "not_found", message: "Not found" } };
  }
  async function repositoryBoard(repository) {
    const listed = repository.hasIssues ? await clientFor(repository).listIssues().catch(mapGitHubError) : { items: [], truncated: false };
    const { issues, excluded } = buildBoardList(listed.items, repository);
    return {
      scope: "repo",
      repository,
      repo: repository.full,
      login: config.githubLogin,
      fetchedAt: new Date(now()).toISOString(),
      truncated: listed.truncated,
      complete: !listed.truncated,
      partial: listed.truncated,
      excludedPullRequests: excluded,
      issues
    };
  }
  let aggregateInFlight = null;
  function combinedBoard() {
    if (aggregateInFlight) return aggregateInFlight;
    aggregateInFlight = aggregate().finally(() => {
      aggregateInFlight = null;
    });
    return aggregateInFlight;
  }
  async function aggregate() {
    const discovery = await repositories.view();
    const issues = [];
    const failures = [];
    let cursor = 0;
    let loaded = 0;
    let truncated = false;
    let excluded = 0;
    async function worker() {
      while (cursor < discovery.repositories.length) {
        const repository = discovery.repositories[cursor++];
        if (!repository.available || discovery.discoveryFailed) {
          failures.push({ repository, message: discovery.discoveryFailed ? "Discovery failed; not refreshed" : "Unavailable" });
          continue;
        }
        try {
          const board = await repositoryBoard(repository);
          issues.push(...board.issues);
          excluded += board.excludedPullRequests;
          truncated ||= board.truncated;
          if (board.truncated) failures.push({ repository, message: "Issue page bound reached; incomplete" });
          loaded++;
        } catch {
          failures.push({ repository, message: "Unavailable or refresh failed" });
        }
      }
    }
    await Promise.all(Array.from({ length: 3 }, () => worker()));
    const truncatedByIssueCap = issues.length > MAX_AGGREGATE_ISSUES;
    if (truncatedByIssueCap) issues.length = MAX_AGGREGATE_ISSUES;
    const limited = truncated || truncatedByIssueCap;
    const partial = discovery.discoveryFailed || failures.length > 0 || limited;
    return {
      scope: "all",
      repo: "All repositories",
      ...discovery,
      issues,
      failures,
      fetchedAt: new Date(now()).toISOString(),
      partial,
      complete: !partial,
      truncated: limited,
      truncatedByIssueCap,
      issueCap: MAX_AGGREGATE_ISSUES,
      repositoriesRequested: discovery.repositories.length,
      repositoriesLoaded: loaded,
      concurrency: 3,
      maxPagesPerRepository: 10,
      excludedPullRequests: excluded
    };
  }
  function methodNotAllowed(allow) {
    return {
      status: 405,
      body: { error: "method_not_allowed", message: "That method is not allowed" },
      headers: { allow }
    };
  }
  function parseIssueNumberOrThrow(value) {
    try {
      return parseIssueNumber(value);
    } catch {
      throw new HttpError(400, "invalid_request", "The issue number is not valid");
    }
  }
  const MAX_IN_FLIGHT_LOGINS = 10;
  const LOGIN_BODY_TIMEOUT_MS = 2e3;
  const LOGIN_SLOT_TIMEOUT_MS = 3e3;
  const inFlightLogins = /* @__PURE__ */ new Set();
  const scryptQueue = new ScryptQueue(2, 4);
  const issueLocks = /* @__PURE__ */ new Map();
  async function withIssueLock(key, fn) {
    while (issueLocks.has(key)) {
      try {
        await issueLocks.get(key);
      } catch {
      }
    }
    let release = () => {
    };
    const lockPromise = new Promise((resolve) => {
      release = resolve;
    });
    issueLocks.set(key, lockPromise);
    try {
      return await fn();
    } finally {
      issueLocks.delete(key);
      release();
    }
  }
  async function login(req) {
    const ip = getClientIp(req);
    const verdict = limiter.check(ip);
    if (!verdict.allowed) {
      return {
        status: 429,
        body: {
          error: "rate_limited",
          message: "Too many failed sign-ins; wait a moment and try again",
          retryAfterSeconds: verdict.retryAfterSeconds
        },
        headers: { "retry-after": String(verdict.retryAfterSeconds) }
      };
    }
    if (inFlightLogins.has(ip)) {
      return {
        status: 429,
        body: {
          error: "rate_limited",
          message: "A login request is already in progress for this client; try again in a moment",
          retryAfterSeconds: 1
        },
        headers: { "retry-after": "1" }
      };
    }
    if (inFlightLogins.size >= MAX_IN_FLIGHT_LOGINS) {
      return {
        status: 429,
        body: {
          error: "rate_limited",
          message: "Too many concurrent sign-in attempts; try again in a moment",
          retryAfterSeconds: 2
        },
        headers: { "retry-after": "2" }
      };
    }
    inFlightLogins.add(ip);
    const slotTimer = setTimeout(() => {
      inFlightLogins.delete(ip);
    }, LOGIN_SLOT_TIMEOUT_MS);
    let valid = false;
    try {
      const body = await readJsonBody(req, LOGIN_BODY_TIMEOUT_MS).catch((error) => {
        throw error instanceof HttpError ? error : new HttpError(400, "invalid_json", "The request body must be JSON");
      });
      const password = body && typeof body.password === "string" ? body.password : "";
      valid = await scryptQueue.run(() => verifyPasswordAsync(password, config.passwordHash));
    } finally {
      clearTimeout(slotTimer);
      inFlightLogins.delete(ip);
    }
    if (!valid) {
      limiter.recordFailure(ip);
      return { status: 401, body: { error: "invalid_credentials", message: "That password is not correct" } };
    }
    limiter.recordSuccess(ip);
    const created = sessions.create(ip);
    return {
      status: 200,
      body: {
        authenticated: true,
        csrfToken: created.csrfToken,
        expiresAt: new Date(now() + created.maxAgeSeconds * 1e3).toISOString()
      },
      headers: { "set-cookie": buildSessionCookie(created.cookieValue, created.maxAgeSeconds) }
    };
  }
  async function writeIssue(repository, number, body, op) {
    const supplied = body && typeof body.fingerprint === "string" ? body.fingerprint : "";
    if (!/^[a-f0-9]{64}$/.test(supplied)) {
      throw new HttpError(
        400,
        "fingerprint_required",
        "Reload the task and retry; the board needs the fingerprint from a current read"
      );
    }
    const runLocked = async () => {
      repository = await resolveRepository(repository.owner, repository.name);
      const github2 = clientFor(repository);
      const fresh = await github2.getIssue(number).catch(mapGitHubError);
      if (fresh.item.pull_request) {
        throw new HttpError(404, "not_found", "That number is a pull request, not an issue");
      }
      const currentFingerprint = issueFingerprint(fresh.item, repository);
      if (currentFingerprint !== supplied) {
        throw new HttpError(409, "conflict", "This task changed on GitHub after you opened it; nothing was written", {
          issue: buildIssueDetail(fresh.item, repository),
          statusOptions: statusOptions()
        });
      }
      let baseSectionId = "";
      let baseText = "";
      let targetText = "";
      let baseQuestionIndex = -1;
      let baseQuestionText = "";
      let targetAnswer = "";
      let baseStatus = null;
      let targetStatus = "";
      if (op.kind === "section") {
        if (typeof op.sectionId !== "string") {
          throw new HttpError(400, "invalid_edit", "A section id is required");
        }
        if (typeof op.text !== "string") {
          throw new HttpError(400, "invalid_edit", "Section text must be a string");
        }
        baseSectionId = op.sectionId;
        const baseSection = findSections(fresh.item.body ?? "").find((s) => s.id === op.sectionId);
        if (!baseSection || !baseSection.editable) {
          throw new HttpError(400, "invalid_edit", "That section cannot be edited from the board");
        }
        baseText = baseSection.text;
        targetText = op.text;
        if (targetText === baseText) {
          throw new HttpError(400, "invalid_edit", "That change would leave the issue unchanged");
        }
      } else if (op.kind === "question") {
        if (typeof op.answer !== "string" || op.answer.trim() === "") {
          throw new HttpError(400, "invalid_edit", "An answer is required");
        }
        if (op.answer.length > 2e3) {
          throw new HttpError(400, "invalid_edit", "The answer is too long");
        }
        const baseDetail = buildIssueDetail(fresh.item, repository);
        const baseQ = baseDetail.openQuestions.find((q) => q.answerIndex === op.index);
        if (!baseQ || baseQ.completed) {
          throw new HttpError(400, "invalid_edit", "That open question is no longer answerable");
        }
        baseQuestionIndex = baseQ.index;
        baseQuestionText = baseQ.text;
        targetAnswer = op.answer;
      } else if (op.kind === "status") {
        if (typeof op.status !== "string" || !op.status) {
          throw new HttpError(400, "invalid_edit", "A status label is required");
        }
        baseStatus = statusLabelOf(labelNames(fresh.item)) ?? "";
        targetStatus = op.status;
        if (targetStatus === baseStatus) {
          throw new HttpError(400, "invalid_edit", "That change would leave the issue unchanged");
        }
      } else if (op.kind === "patch") {
        if (op.body === void 0 && op.status === void 0 && op.state === void 0) {
          throw new HttpError(400, "invalid_edit", "At least one field (body, status, or state) is required");
        }
        if (op.body !== void 0 && typeof op.body !== "string") {
          throw new HttpError(400, "invalid_edit", "Body must be a string");
        }
        if (op.status !== void 0) {
          if (typeof op.status !== "string" || !op.status) {
            throw new HttpError(400, "invalid_edit", "A status label must be a non-empty string");
          }
          baseStatus = statusLabelOf(labelNames(fresh.item)) ?? "";
          targetStatus = op.status;
        }
        if (op.state !== void 0 && op.state !== "open" && op.state !== "closed") {
          throw new HttpError(400, "invalid_edit", "State must be open or closed");
        }
      }
      let patch = {};
      try {
        if (op.kind === "draft" || op.kind === "order" || op.kind === "move") {
          if (fresh.item.state !== "open" || statusLabelOf(labelNames(fresh.item)) !== "status:draft") {
            throw new HttpError(400, "not_draft", "Only open drafts can be edited, moved or reordered here");
          }
          if (op.kind === "draft") {
            if (typeof op.data.title !== "string" || !op.data.title.trim() || op.data.title.trim().length > 256 || typeof op.data.description !== "string" || op.data.description.length > 5e4 || hasUnfencedOrderMarkerComment(op.data.description)) {
              throw new HttpError(400, "invalid_draft", "Use a title of 1\u2013256 characters and a description up to 50,000 characters");
            }
            const order = parseOrderMarker(fresh.item.body ?? "");
            patch = { title: op.data.title.trim(), body: order === null ? op.data.description : setOrderMarker(op.data.description, order) };
          } else if (op.kind === "order") {
            if (Array.isArray(op.data?.updates)) {
              const rawUpdates = op.data.updates;
              const rawNeighbours = Array.isArray(op.data.neighbours) ? op.data.neighbours : [];
              if (rawUpdates.length < 1 || rawUpdates.length > 200 || rawNeighbours.length > 200) {
                throw new HttpError(400, "invalid_order", "Order update list is invalid");
              }
              const preparedMap = /* @__PURE__ */ new Map();
              const updateSequence = [];
              let prevOrderVal = null;
              let includesPrimary = false;
              for (const entry of rawUpdates) {
                if (!entry || typeof entry !== "object") {
                  throw new HttpError(400, "invalid_order", "Order update entry is invalid");
                }
                const repoStr = typeof entry.repo === "string" && entry.repo ? entry.repo : repository.full;
                if (!/^[a-z0-9_.-]+\/[a-z0-9_.-]+$/i.test(repoStr)) {
                  throw new HttpError(400, "invalid_order", "Order update repository is invalid");
                }
                const itemNum = parseIssueNumberOrThrow(String(entry.number ?? ""));
                const itemFp = typeof entry.fingerprint === "string" ? entry.fingerprint : "";
                if (!/^[a-f0-9]{64}$/.test(itemFp)) {
                  throw new HttpError(400, "fingerprint_required", "Each reordered draft requires a valid fingerprint");
                }
                if (typeof entry.order !== "number" || !Number.isFinite(entry.order)) {
                  throw new HttpError(400, "invalid_order", "Each reordered draft requires a finite numeric order");
                }
                if (prevOrderVal !== null && !(entry.order > prevOrderVal)) {
                  throw new HttpError(409, "invalid_order", "Order updates must be strictly increasing");
                }
                prevOrderVal = entry.order;
                const [uOwner, uName] = repoStr.split("/");
                const uRepo = uOwner.toLowerCase() === repository.owner.toLowerCase() && uName.toLowerCase() === repository.name.toLowerCase() ? repository : await resolveRepository(uOwner, uName);
                const k = issueKey(uRepo, itemNum);
                if (preparedMap.has(k)) {
                  throw new HttpError(400, "invalid_order", "Duplicate draft in order updates");
                }
                const isPrimary = uRepo.full.toLowerCase() === repository.full.toLowerCase() && itemNum === number;
                if (isPrimary) {
                  if (itemFp !== supplied) {
                    throw new HttpError(409, "conflict", "This task changed on GitHub after you opened it; nothing was written");
                  }
                  includesPrimary = true;
                }
                const itemRead = isPrimary ? fresh : await clientFor(uRepo).getIssue(itemNum).catch(mapGitHubError);
                if (itemRead.item.pull_request || itemRead.item.state !== "open" || statusLabelOf(labelNames(itemRead.item)) !== "status:draft") {
                  throw new HttpError(400, "not_draft", "Only open drafts can be reordered");
                }
                if (issueFingerprint(itemRead.item, uRepo) !== itemFp) {
                  throw new HttpError(409, "conflict", "A draft in this order changed on GitHub; refresh and try again", {
                    issue: buildIssueDetail(fresh.item, repository),
                    statusOptions: statusOptions()
                  });
                }
                const prepared = {
                  key: k,
                  repo: uRepo,
                  number: itemNum,
                  fingerprint: itemFp,
                  order: entry.order,
                  isUpdate: true,
                  isPrimary,
                  read: itemRead
                };
                preparedMap.set(k, prepared);
                updateSequence.push(prepared);
              }
              if (!includesPrimary) {
                throw new HttpError(400, "invalid_order", "Order updates must include the target draft");
              }
              for (const entry of rawNeighbours) {
                if (!entry || typeof entry !== "object") {
                  throw new HttpError(400, "invalid_order", "Order neighbour entry is invalid");
                }
                const repoStr = typeof entry.repo === "string" && entry.repo ? entry.repo : repository.full;
                if (!/^[a-z0-9_.-]+\/[a-z0-9_.-]+$/i.test(repoStr)) {
                  throw new HttpError(400, "invalid_order", "Order neighbour repository is invalid");
                }
                const itemNum = parseIssueNumberOrThrow(String(entry.number ?? ""));
                const itemFp = typeof entry.fingerprint === "string" ? entry.fingerprint : "";
                if (!/^[a-f0-9]{64}$/.test(itemFp)) {
                  throw new HttpError(400, "fingerprint_required", "Each neighbour draft requires a valid fingerprint");
                }
                const [nOwner, nName] = repoStr.split("/");
                const nRepo = nOwner.toLowerCase() === repository.owner.toLowerCase() && nName.toLowerCase() === repository.name.toLowerCase() ? repository : await resolveRepository(nOwner, nName);
                const k = issueKey(nRepo, itemNum);
                if (preparedMap.has(k)) continue;
                const nRead = await clientFor(nRepo).getIssue(itemNum).catch(mapGitHubError);
                if (nRead.item.pull_request || nRead.item.state !== "open" || statusLabelOf(labelNames(nRead.item)) !== "status:draft") {
                  throw new HttpError(409, "conflict", "A neighbouring draft is no longer an open draft; refresh and try again");
                }
                if (issueFingerprint(nRead.item, nRepo) !== itemFp) {
                  throw new HttpError(409, "conflict", "A neighbouring draft changed on GitHub; nothing was written", {
                    issue: buildIssueDetail(fresh.item, repository),
                    statusOptions: statusOptions()
                  });
                }
                preparedMap.set(k, {
                  key: k,
                  repo: nRepo,
                  number: itemNum,
                  fingerprint: itemFp,
                  order: parseOrderMarker(nRead.item.body ?? ""),
                  isUpdate: false,
                  isPrimary: false,
                  read: nRead
                });
              }
              const updatedDetails = [];
              let primaryDetail = null;
              let writesCompleted = 0;
              for (const item of updateSequence) {
                const nextBody = setOrderMarker(item.read.item.body ?? "", item.order);
                if (nextBody === (item.read.item.body ?? "")) {
                  const detail2 = buildIssueDetail(item.read.item, item.repo);
                  updatedDetails.push(detail2);
                  if (item.isPrimary) primaryDetail = detail2;
                  continue;
                }
                const itemClient = clientFor(item.repo);
                try {
                  await itemClient.updateIssue(item.number, { body: nextBody }, { etag: item.read.etag });
                } catch (error) {
                  if (error instanceof GitHubError && error.status === 412) {
                    if (writesCompleted > 0) {
                      throw new HttpError(
                        409,
                        "partial_order",
                        "Order was only partially updated because another draft changed concurrently; refresh to reconcile the current order.",
                        { updatedIssues: updatedDetails, statusOptions: statusOptions() }
                      );
                    }
                    const reread2 = await github2.getIssue(number).catch(mapGitHubError);
                    throw new HttpError(409, "conflict", "This task changed on GitHub while saving; nothing was written", {
                      issue: buildIssueDetail(reread2.item, repository),
                      statusOptions: statusOptions()
                    });
                  }
                  if (writesCompleted > 0) {
                    throw new HttpError(
                      502,
                      "write_outcome_unknown",
                      "Order was partially written before a GitHub error; refresh the board to reconcile before retrying.",
                      { updatedIssues: updatedDetails, statusOptions: statusOptions() }
                    );
                  }
                  if (error instanceof GitHubError && (error.kind === "network" || error.kind === "server")) {
                    throw new HttpError(502, "write_outcome_unknown", "Outcome unknown \u2014 check the issue on GitHub");
                  }
                  mapGitHubError(error);
                }
                let rereadItem;
                try {
                  rereadItem = await itemClient.getIssue(item.number);
                } catch {
                  throw new HttpError(
                    502,
                    "write_outcome_unknown",
                    "Outcome unknown \u2014 check the issue on GitHub",
                    { updatedIssues: updatedDetails, statusOptions: statusOptions() }
                  );
                }
                if ((rereadItem.item.body ?? "") !== nextBody) {
                  throw new HttpError(
                    502,
                    "write_outcome_unknown",
                    "Outcome unknown \u2014 check the issue on GitHub",
                    { updatedIssues: updatedDetails, statusOptions: statusOptions() }
                  );
                }
                writesCompleted += 1;
                const detail = buildIssueDetail(rereadItem.item, item.repo);
                updatedDetails.push(detail);
                if (item.isPrimary) primaryDetail = detail;
              }
              log(`write order issue=${number} count=${writesCompleted}`);
              return {
                status: 200,
                body: {
                  issue: primaryDetail ?? buildIssueDetail(fresh.item, repository),
                  updatedIssues: updatedDetails,
                  savedAt: new Date(now()).toISOString(),
                  statusOptions: statusOptions()
                }
              };
            }
            const previous = op.data.previous;
            const next = op.data.next;
            if (![previous, next].every((value) => value === null || typeof value === "number" && Number.isFinite(value))) {
              throw new HttpError(400, "invalid_order", "Order neighbours must be finite numbers or null");
            }
            if (previous !== null && next !== null && previous > next) {
              throw new HttpError(409, "invalid_order", "Order neighbours must be in ascending order");
            }
            const hasExplicitNeighbours = Array.isArray(op.data.neighbours);
            if (hasExplicitNeighbours) {
              if (op.data.neighbours.length > 200) {
                throw new HttpError(400, "invalid_order", "Order neighbour list is invalid");
              }
              for (const entry of op.data.neighbours) {
                if (!entry || typeof entry !== "object") {
                  throw new HttpError(400, "invalid_order", "Order neighbour entry is invalid");
                }
                const repoStr = typeof entry.repo === "string" && entry.repo ? entry.repo : repository.full;
                if (!/^[a-z0-9_.-]+\/[a-z0-9_.-]+$/i.test(repoStr)) {
                  throw new HttpError(400, "invalid_order", "Order neighbour repository is invalid");
                }
                const itemNum = parseIssueNumberOrThrow(String(entry.number ?? ""));
                const itemFp = typeof entry.fingerprint === "string" ? entry.fingerprint : "";
                if (!/^[a-f0-9]{64}$/.test(itemFp)) {
                  throw new HttpError(400, "fingerprint_required", "Each neighbour draft requires a valid fingerprint");
                }
                const [nOwner, nName] = repoStr.split("/");
                const nRepo = nOwner.toLowerCase() === repository.owner.toLowerCase() && nName.toLowerCase() === repository.name.toLowerCase() ? repository : await resolveRepository(nOwner, nName);
                const nRead = await clientFor(nRepo).getIssue(itemNum).catch(mapGitHubError);
                if (nRead.item.pull_request || nRead.item.state !== "open" || statusLabelOf(labelNames(nRead.item)) !== "status:draft") {
                  throw new HttpError(409, "conflict", "A neighbouring draft is no longer an open draft; refresh and try again");
                }
                if (issueFingerprint(nRead.item, nRepo) !== itemFp) {
                  throw new HttpError(409, "conflict", "A neighbouring draft changed on GitHub; nothing was written", {
                    issue: buildIssueDetail(fresh.item, repository),
                    statusOptions: statusOptions()
                  });
                }
                if (entry.order !== void 0 && parseOrderMarker(nRead.item.body ?? "") !== entry.order) {
                  throw new HttpError(409, "conflict", "A neighbouring draft changed order on GitHub; refresh the board and try again", {
                    issue: buildIssueDetail(fresh.item, repository),
                    statusOptions: statusOptions()
                  });
                }
              }
            }
            const listed = repository.hasIssues ? await github2.listIssues().catch(mapGitHubError) : { items: [], truncated: false };
            const otherDrafts = (listed.items || []).filter(
              (item) => !item.pull_request && item.state === "open" && item.number !== number && statusLabelOf(labelNames(item)) === "status:draft"
            );
            const otherOrders = otherDrafts.map((item) => parseOrderMarker(item.body ?? "")).filter((val) => val !== null);
            if (previous !== null && next !== null && otherOrders.some((val) => val > previous && val < next)) {
              throw new HttpError(409, "conflict", "Another draft moved into that position; refresh the board and try again", {
                issue: buildIssueDetail(fresh.item, repository),
                statusOptions: statusOptions()
              });
            }
            if (!hasExplicitNeighbours && otherOrders.length > 0) {
              const prevKnown = previous !== null && otherOrders.includes(previous);
              const nextKnown = next !== null && otherOrders.includes(next);
              if ((prevKnown || nextKnown) && (previous !== null && !prevKnown || next !== null && !nextKnown)) {
                throw new HttpError(409, "conflict", "A neighbouring draft changed order on GitHub; refresh the board and try again", {
                  issue: buildIssueDetail(fresh.item, repository),
                  statusOptions: statusOptions()
                });
              }
            }
            let order = midpointOrder(previous, next);
            const midpointUsable = Number.isFinite(order) && (previous === null || order > previous) && (next === null || order < next);
            if (midpointUsable && otherOrders.includes(order)) {
              throw new HttpError(409, "conflict", "Another draft already occupies that order position; refresh the board and try again", {
                issue: buildIssueDetail(fresh.item, repository),
                statusOptions: statusOptions()
              });
            }
            if (!Number.isFinite(order) || previous !== null && next !== null && !(order > previous && order < next)) {
              const baseOrder = previous ?? 0;
              order = baseOrder + 1e3;
              const trailingDrafts = otherDrafts.map((item) => ({ item, order: parseOrderMarker(item.body ?? "") })).filter((entry) => entry.order !== null && entry.order >= (next ?? order)).sort((a, b) => a.order - b.order || a.item.number - b.item.number);
              let step = 2;
              for (const trailing of trailingDrafts) {
                const trailingRead = await github2.getIssue(trailing.item.number).catch(mapGitHubError);
                const rebalancedBody = setOrderMarker(trailingRead.item.body ?? "", baseOrder + step * 1e3);
                step += 1;
                await github2.updateIssue(trailing.item.number, { body: rebalancedBody }, { etag: trailingRead.etag }).catch(mapGitHubError);
              }
            }
            patch = { body: setOrderMarker(fresh.item.body ?? "", order) };
          } else {
            if (op.data?.confirmed !== true) {
              throw new HttpError(400, "confirmation_required", "Confirm moving this draft before transferring it on GitHub");
            }
            if (typeof op.data.target !== "string" || !/^[a-z0-9_.-]+\/[a-z0-9_.-]+$/i.test(op.data.target)) {
              throw new HttpError(400, "invalid_target", "Select a discovered target project");
            }
            const [owner, name] = op.data.target.split("/");
            const target = await resolveRepository(owner, name);
            if (target.full.toLowerCase() === repository.full.toLowerCase() || target.archived || !target.hasIssues) {
              throw new HttpError(400, "invalid_target", "Select a different writable project");
            }
            const targetClient = clientFor(target);
            const targetRepoRaw = await targetClient.getRepository().catch(mapGitHubError);
            if (targetRepoRaw.archived || targetRepoRaw.has_issues === false || targetRepoRaw.disabled) {
              throw new HttpError(400, "invalid_target", "Select a different writable project");
            }
            const issueNodeId = typeof fresh.item.node_id === "string" ? fresh.item.node_id.trim() : "";
            const targetRepoNodeId = typeof targetRepoRaw.node_id === "string" ? targetRepoRaw.node_id.trim() : "";
            if (!issueNodeId || !targetRepoNodeId) {
              throw new HttpError(502, "github_unavailable", "GitHub did not provide GraphQL node identifiers; the draft remains in its current project");
            }
            const sourceKey = issueKey(repository, number);
            let transferred;
            try {
              transferred = await github2.transferIssue({
                issueId: issueNodeId,
                repositoryId: targetRepoNodeId
              });
            } catch (error) {
              if (error instanceof GitHubError) {
                if (error.kind === "forbidden" || error.kind === "unauthorized") {
                  throw new HttpError(
                    403,
                    "transfer_forbidden",
                    `GitHub refused permission to transfer this draft to ${target.full} with the configured token; the draft remains in ${repository.full}.`
                  );
                }
                if (error.kind === "invalid") {
                  throw new HttpError(
                    422,
                    "transfer_rejected",
                    `GitHub rejected transferring this draft to ${target.full}; the draft remains in ${repository.full}.`
                  );
                }
                if (error.kind === "rate_limited") {
                  mapGitHubError(error);
                }
              }
              throw new HttpError(
                502,
                "write_outcome_unknown",
                "Transfer outcome could not be confirmed from GitHub; refresh the board to reconcile before editing or retrying.",
                { sourceKey, targetRepo: target.full }
              );
            }
            if (transferred.repositoryFullName.toLowerCase() !== target.full.toLowerCase()) {
              throw new HttpError(
                502,
                "write_outcome_unknown",
                "Transfer destination did not match the selected project; refresh the board to reconcile.",
                { sourceKey, targetRepo: target.full, targetUrl: transferred.url }
              );
            }
            let targetRead;
            try {
              targetRead = await targetClient.getIssue(transferred.number);
            } catch {
              throw new HttpError(
                502,
                "write_outcome_unknown",
                "Draft transfer completed or is in progress, but reading the moved issue failed; refresh the board to reconcile.",
                { sourceKey, targetRepo: target.full, targetNumber: transferred.number, targetUrl: transferred.url }
              );
            }
            if (targetRead.item.pull_request || targetRead.item.number !== transferred.number || targetRead.item.state !== "open" || targetRead.item.title !== fresh.item.title || (targetRead.item.body ?? "") !== (fresh.item.body ?? "")) {
              throw new HttpError(
                502,
                "write_outcome_unknown",
                "Transferred issue state could not be verified in the target project; refresh the board to reconcile.",
                { sourceKey, targetRepo: target.full, targetNumber: transferred.number, targetUrl: transferred.url }
              );
            }
            const canonicalUrl = targetRead.item.html_url || transferred.url;
            log(`transfer source=${sourceKey} target=${issueKey(target, transferred.number)}`);
            return {
              status: 200,
              body: {
                issue: buildIssueDetail(targetRead.item, target),
                listItem: buildBoardListItem(targetRead.item, target),
                sourceKey,
                sourceRepository: repository.full,
                sourceNumber: number,
                targetRepository: target.full,
                targetNumber: transferred.number,
                targetUrl: canonicalUrl,
                savedAt: new Date(now()).toISOString(),
                statusOptions: statusOptions()
              }
            };
          }
        } else if (op.kind === "section") {
          patch = { body: replaceSectionText(stripOrderMarker(fresh.item.body ?? ""), baseSectionId, op.text) };
          const order = parseOrderMarker(fresh.item.body ?? "");
          if (order !== null) patch.body = setOrderMarker(patch.body, order);
        } else if (op.kind === "question") {
          const curDetail = buildIssueDetail(fresh.item, repository);
          const curQView = curDetail.openQuestions[baseQuestionIndex];
          const answerIdx = curQView?.answerIndex ?? op.index;
          patch = { body: applyQuestionAnswer(fresh.item, answerIdx, op.answer) };
        } else if (op.kind === "status") {
          patch = { labels: applyStatusChange(fresh.item, op.status) };
        } else if (op.kind === "patch") {
          patch = {};
          if (typeof op.body === "string") {
            const order = parseOrderMarker(fresh.item.body ?? "");
            patch.body = order !== null ? setOrderMarker(op.body, order) : op.body;
          }
          if (typeof op.status === "string") {
            patch.labels = applyStatusChange(fresh.item, op.status);
          }
          if (typeof op.state === "string") {
            patch.state = op.state;
          }
          const currentBodyNorm = (fresh.item.body ?? "").replace(/\r\n/g, "\n");
          const targetBodyNorm = typeof op.body === "string" ? patch.body.replace(/\r\n/g, "\n") : currentBodyNorm;
          const bodyChanged = typeof op.body === "string" && currentBodyNorm !== targetBodyNorm;
          const statusChanged = typeof op.status === "string" && targetStatus !== baseStatus;
          const stateChanged = typeof op.state === "string" && op.state !== fresh.item.state;
          if (!bodyChanged && !statusChanged && !stateChanged) {
            throw new HttpError(400, "invalid_edit", "That change would leave the issue unchanged");
          }
        }
      } catch (error) {
        if (error instanceof BoardError) throw new HttpError(400, "invalid_edit", error.message);
        if (error instanceof SectionError) throw new HttpError(400, "invalid_edit", error.message);
        throw error;
      }
      try {
        await github2.updateIssue(number, patch, { etag: fresh.etag });
      } catch (error) {
        if (error instanceof GitHubError && error.status === 412) {
          const reread2 = await github2.getIssue(number).catch(mapGitHubError);
          throw new HttpError(409, "conflict", "This task changed on GitHub while saving; nothing was written", {
            issue: buildIssueDetail(reread2.item, repository),
            statusOptions: statusOptions()
          });
        }
        if (error instanceof GitHubError && (error.kind === "network" || error.kind === "server")) {
          throw new HttpError(502, "write_outcome_unknown", "Outcome unknown \u2014 check the issue on GitHub");
        }
        mapGitHubError(error);
      }
      let reread;
      try {
        reread = await github2.getIssue(number);
      } catch {
        throw new HttpError(502, "write_outcome_unknown", "Outcome unknown \u2014 check the issue on GitHub");
      }
      const currentItem = reread.item;
      let verified = false;
      if (op.kind === "draft" || op.kind === "order") {
        verified = Object.entries(patch).every(([key, value]) => currentItem[key] === value);
      } else if (op.kind === "section") {
        const curSec = findSections(currentItem.body ?? "").find((s) => s.id === op.sectionId);
        const expectedSec = findSections(patch.body ?? "").find((s) => s.id === op.sectionId);
        if (curSec && expectedSec) {
          const canonicalCur = curSec.text.replace(/\r\n/g, "\n").replace(/^\n+/, "").replace(/\n+$/, "");
          const canonicalExpected = expectedSec.text.replace(/\r\n/g, "\n").replace(/^\n+/, "").replace(/\n+$/, "");
          if (canonicalCur === canonicalExpected) {
            verified = true;
          }
        }
      } else if (op.kind === "question") {
        const curDetail = buildIssueDetail(currentItem, repository);
        const curQ = curDetail.openQuestions[baseQuestionIndex];
        const cleanAnswer = targetAnswer.trim().replace(/\r?\n+/g, " ");
        if (curQ && curQ.completed && curQ.text.includes(cleanAnswer)) {
          verified = true;
        }
      } else if (op.kind === "status") {
        const curStatus = statusLabelOf(labelNames(currentItem));
        if (curStatus === targetStatus) {
          verified = true;
        }
      } else if (op.kind === "patch") {
        let matches = true;
        if (typeof op.body === "string") {
          const normCur = (currentItem.body ?? "").replace(/\r\n/g, "\n");
          const normTarget = patch.body.replace(/\r\n/g, "\n");
          if (normCur !== normTarget) matches = false;
        }
        if (typeof op.status === "string") {
          if (statusLabelOf(labelNames(currentItem)) !== op.status) matches = false;
        }
        if (typeof op.state === "string") {
          if (currentItem.state !== op.state) matches = false;
        }
        if (matches) {
          verified = true;
        }
      }
      if (verified) {
        log(`write issue=${number} fields=${Object.keys(patch).join(",")}`);
        return {
          status: 200,
          body: {
            issue: buildIssueDetail(currentItem, repository),
            savedAt: new Date(now()).toISOString(),
            statusOptions: statusOptions()
          }
        };
      }
      throw new HttpError(
        502,
        "write_outcome_unknown",
        "Outcome unknown \u2014 check the issue on GitHub",
        {
          issue: buildIssueDetail(currentItem, repository),
          statusOptions: statusOptions()
        }
      );
    };
    if (op.kind === "order") {
      return withIssueLock("board:order", () => withIssueLock(issueKey(repository, number), runLocked));
    }
    return withIssueLock(issueKey(repository, number), runLocked);
  }
  return {
    config,
    logs,
    listen(port = config.port, host = config.host) {
      return new Promise((resolve, reject) => {
        const onError = (err) => {
          server.removeListener("listening", onListening);
          const code = err.code;
          if (code === "ENOTFOUND" || code === "EAI_AGAIN") {
            reject(new Error(`BOARD_HOST "${host}" could not be resolved: ${err.message}`));
          } else if (code === "EADDRNOTAVAIL") {
            reject(new Error(`BOARD_HOST "${host}" is not available to bind: ${err.message}`));
          } else {
            reject(err);
          }
        };
        const onListening = () => {
          server.removeListener("error", onError);
          const address = server.address();
          if (typeof address === "object" && address) {
            resolve({ port: address.port, host: address.address });
          } else {
            resolve({ port, host });
          }
        };
        server.once("error", onError);
        server.once("listening", onListening);
        server.listen(port, host);
      });
    },
    close() {
      return new Promise((resolve) => {
        server.closeAllConnections?.();
        server.close(() => resolve());
      });
    }
  };
}
function statusOptions() {
  return STATUS_OPTIONS;
}
var STATUS_OPTIONS = ["draft", "backlog", "todo", "planned", "in-progress", "needs-human", "in-review", "done"].map(
  (id) => ({ value: STATUS_METADATA[id].label, label: STATUS_METADATA[id].displayName })
);

// web/server.ts
async function main() {
  let config;
  try {
    config = loadConfig(process.env);
  } catch (error) {
    if (error instanceof ConfigError) {
      console.error(`board: refusing to start: ${error.message}`);
      process.exitCode = 1;
      return;
    }
    throw error;
  }
  let app;
  try {
    app = await createBoardServer({ config });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown startup failure";
    console.error(`board: refusing to start: ${message}`);
    process.exitCode = 1;
    return;
  }
  let listenResult;
  try {
    listenResult = await app.listen(config.port, config.host);
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown startup failure";
    console.error(`board: refusing to start: ${message}`);
    process.exitCode = 1;
    return;
  }
  const { port, host } = listenResult;
  const details = describeConfig(config);
  const formattedHost = host.includes(":") ? `[${host}]` : host;
  const scope = details.repo ? ` for ${details.repo}` : " for all token-visible repositories";
  console.log(
    `board: listening on http://${formattedHost}:${port}${scope} as ${details.login} (password source: ${details.passwordSource})`
  );
  const shutdown = async (signal) => {
    console.log(`board: ${signal} received, closing`);
    await app.close();
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}
void main();
