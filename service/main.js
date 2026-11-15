// service/main.ts
import fs3 from "node:fs";
import http from "node:http";
import crypto2 from "node:crypto";
import { fileURLToPath } from "node:url";

// service/config.ts
import fs from "node:fs";
import path from "node:path";
var DEFAULT_HOST_ORIGIN = "http://127.0.0.1:3000";
var DEFAULT_POLL_INTERVAL_MS = 15e3;
var DEFAULT_LEASE_TTL_MS = 6e4;
var DEFAULT_STORAGE_DIR = ".openchamber-data/task-coordinator";
var DEFAULT_DRY_RUN = false;
function resolveStorageDir(rawDir) {
  const envDir = rawDir || process.env.COORDINATOR_STORAGE_DIR;
  if (envDir && envDir.trim()) {
    const trimmed = envDir.trim();
    if (path.isAbsolute(trimmed)) {
      return trimmed;
    }
    if (fs.existsSync("/workspace") && fs.statSync("/workspace").isDirectory()) {
      return path.resolve("/workspace", trimmed);
    }
    return path.resolve(process.cwd(), trimmed);
  }
  if (process.env.OPENCHAMBER_DATA_DIR && process.env.OPENCHAMBER_DATA_DIR.trim()) {
    return path.resolve(process.env.OPENCHAMBER_DATA_DIR.trim(), "task-coordinator");
  }
  if (fs.existsSync("/workspace") && fs.statSync("/workspace").isDirectory()) {
    return path.resolve("/workspace", DEFAULT_STORAGE_DIR);
  }
  return path.resolve(process.cwd(), DEFAULT_STORAGE_DIR);
}
function loadCoordinatorConfig(overrides) {
  const hostOrigin = overrides?.hostOrigin || process.env.OPENCHAMBER_HOST_ORIGIN || DEFAULT_HOST_ORIGIN;
  let pollIntervalMs = DEFAULT_POLL_INTERVAL_MS;
  const pollEnv = overrides?.pollIntervalMs ?? process.env.COORDINATOR_POLL_INTERVAL_MS;
  if (pollEnv !== void 0) {
    const parsed = typeof pollEnv === "number" ? pollEnv : parseInt(String(pollEnv), 10);
    if (!Number.isNaN(parsed) && parsed > 0) {
      pollIntervalMs = parsed;
    }
  }
  let leaseTtlMs = DEFAULT_LEASE_TTL_MS;
  const ttlEnv = overrides?.leaseTtlMs ?? process.env.COORDINATOR_LEASE_TTL_MS;
  if (ttlEnv !== void 0) {
    const parsed = typeof ttlEnv === "number" ? ttlEnv : parseInt(String(ttlEnv), 10);
    if (!Number.isNaN(parsed) && parsed > 0) {
      leaseTtlMs = parsed;
    }
  }
  const storageDir = overrides?.storageDir ? resolveStorageDir(overrides.storageDir) : resolveStorageDir();
  const dryRunEnv = overrides?.dryRun !== void 0 ? overrides.dryRun : process.env.COORDINATOR_DRY_RUN === "true" || process.env.COORDINATOR_DRY_RUN === "1";
  return {
    hostOrigin: hostOrigin.replace(/\/+$/, ""),
    pollIntervalMs,
    leaseTtlMs,
    storageDir,
    dryRun: Boolean(dryRunEnv)
  };
}
function validateServiceHostEnv() {
  const rawPort = process.env.OPENCHAMBER_SERVICE_PORT;
  if (!rawPort || !/^[0-9]+$/.test(rawPort)) {
    process.stderr.write(
      "[Coordinator Service] Startup error: OPENCHAMBER_SERVICE_PORT must be an integer between 1 and 65535.\n"
    );
    process.exit(1);
  }
  const port = Number(rawPort);
  if (!Number.isSafeInteger(port) || port < 1 || port > 65535) {
    process.stderr.write(
      "[Coordinator Service] Startup error: OPENCHAMBER_SERVICE_PORT out of valid range (1..65535).\n"
    );
    process.exit(1);
  }
  const token = process.env.OPENCHAMBER_SERVICE_TOKEN;
  if (!token || typeof token !== "string" || token.trim().length === 0) {
    process.stderr.write(
      "[Coordinator Service] Startup error: OPENCHAMBER_SERVICE_TOKEN must be a non-empty string.\n"
    );
    process.exit(1);
  }
  return { port, token };
}

// service/lease-store.ts
import fs2 from "node:fs";
import path2 from "node:path";
var DEFAULT_LEASE_TTL_MS2 = 6e4;
var DEFAULT_STORAGE_DIR2 = ".openchamber-data/task-coordinator";
function resolveLeaseStorageDir(rawDir) {
  const envDir = rawDir || process.env.COORDINATOR_STORAGE_DIR;
  if (envDir && envDir.trim()) {
    const trimmed = envDir.trim();
    if (path2.isAbsolute(trimmed)) {
      return trimmed;
    }
    if (fs2.existsSync("/workspace") && fs2.statSync("/workspace").isDirectory()) {
      return path2.resolve("/workspace", trimmed);
    }
    return path2.resolve(process.cwd(), trimmed);
  }
  if (process.env.OPENCHAMBER_DATA_DIR && process.env.OPENCHAMBER_DATA_DIR.trim()) {
    return path2.resolve(process.env.OPENCHAMBER_DATA_DIR.trim(), "task-coordinator");
  }
  if (fs2.existsSync("/workspace") && fs2.statSync("/workspace").isDirectory()) {
    return path2.resolve("/workspace", DEFAULT_STORAGE_DIR2);
  }
  return path2.resolve(process.cwd(), DEFAULT_STORAGE_DIR2);
}
function getDefaultLeasesFilePath() {
  return path2.join(resolveLeaseStorageDir(), "leases.json");
}
function isPlainLeasesMap(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
var LeaseStore = class {
  filePath;
  defaultTtlMs;
  leases = {};
  queue = Promise.resolve();
  backupBlocked = false;
  constructor(filePath, defaultTtlMs = DEFAULT_LEASE_TTL_MS2) {
    this.filePath = filePath || getDefaultLeasesFilePath();
    this.defaultTtlMs = defaultTtlMs > 0 ? defaultTtlMs : DEFAULT_LEASE_TTL_MS2;
  }
  getFilePath() {
    return this.filePath;
  }
  getDefaultTtlMs() {
    return this.defaultTtlMs;
  }
  /**
   * Helper to compute consistent lease lookup key.
   */
  getLeaseKey(repo, issueNumber) {
    return `${repo.trim()}#${Number(issueNumber)}`;
  }
  /**
   * Serialize internal mutating operations to prevent in-process race conditions.
   */
  async runExclusive(fn) {
    const resultPromise = this.queue.then(() => fn());
    this.queue = resultPromise.catch(() => {
    });
    return resultPromise;
  }
  /**
   * Initialize the store: loads existing state or creates empty structure with version: 1.
   * Any load failure (read error, unparseable JSON, valid-JSON-but-wrong-shape) is backed up
   * forensically before the store is reset (ADV-2C-03).
   */
  async init() {
    return this.runExclusive(async () => {
      const dir = path2.dirname(this.filePath);
      await fs2.promises.mkdir(dir, { recursive: true });
      try {
        const raw = await fs2.promises.readFile(this.filePath, "utf8");
        const parsed = JSON.parse(raw);
        if (parsed && isPlainLeasesMap(parsed.leases)) {
          this.leases = { ...parsed.leases };
          this.backupBlocked = false;
          return;
        }
        await this.resetPreservingPriorState("unexpected store shape");
      } catch (err) {
        if (err?.code === "ENOENT") {
          this.leases = {};
          this.backupBlocked = false;
          await this.saveToDisk();
          return;
        }
        const reason = err instanceof SyntaxError || err?.name === "SyntaxError" ? "unparseable JSON" : `read error (${err?.code || err?.message || "unknown"})`;
        await this.resetPreservingPriorState(reason);
      }
    });
  }
  /**
   * Preserve a forensic copy of the on-disk state before it can be overwritten.
   * Returns true when there is nothing to preserve (no file) or the backup succeeded.
   * On failure, logs the error and returns false (ADV-2C-07): callers must not
   * perform destructive writes without a successful backup.
   */
  async backupPriorState(reason) {
    try {
      if (!fs2.existsSync(this.filePath)) {
        return true;
      }
      const backupPath = `${this.filePath}.corrupted.${Date.now()}.bak`;
      await fs2.promises.copyFile(this.filePath, backupPath);
      return true;
    } catch (err) {
      console.error(`[LeaseStore] Failed to back up prior lease state (${reason}):`, err);
      return false;
    }
  }
  /**
   * Reset in-memory state after a load failure. The prior file is backed up first;
   * when the backup fails the destructive reset write is skipped entirely
   * (ADV-2C-07) — the unreadable file stays on disk untouched and later writes
   * are refused until a backup succeeds.
   */
  async resetPreservingPriorState(reason) {
    const backedUp = await this.backupPriorState(reason);
    this.leases = {};
    this.backupBlocked = !backedUp;
    if (backedUp) {
      await this.saveToDisk();
    }
  }
  /**
   * Reload state from disk to synchronize with any external writes.
   * On load failures the prior file is backed up before any later write can
   * overwrite it (ADV-2C-03); in-memory state is kept on transient read errors.
   */
  async loadFromDisk() {
    try {
      const raw = await fs2.promises.readFile(this.filePath, "utf8");
      const parsed = JSON.parse(raw);
      if (parsed && isPlainLeasesMap(parsed.leases)) {
        this.leases = { ...parsed.leases };
        this.backupBlocked = false;
        return;
      }
      this.backupBlocked = !await this.backupPriorState("unexpected store shape");
    } catch (err) {
      if (err?.code === "ENOENT") {
        return;
      }
      this.backupBlocked = !await this.backupPriorState(
        `read error (${err?.code || err?.message || "unknown"})`
      );
    }
  }
  /**
   * Acquire a lease on a task.
   * - If an active unexpired lease exists owned by another worker, acquisition fails.
   * - If lease does not exist, is expired, or is held by the same owner, a lease is granted.
   */
  async acquireLease(repo, issueNumber, ownerId, bodySha, phase, ttlMs) {
    return this.runExclusive(async () => {
      await this.loadFromDisk();
      const key = this.getLeaseKey(repo, issueNumber);
      const existing = this.leases[key];
      const now = Date.now();
      if (existing && existing.expiresAt > now && existing.ownerId !== ownerId) {
        return {
          acquired: false,
          conflictReason: "Task is currently leased by " + existing.ownerId
        };
      }
      const ttl = typeof ttlMs === "number" && ttlMs > 0 ? ttlMs : this.defaultTtlMs;
      const isSameOwnerActive = existing && existing.ownerId === ownerId && existing.expiresAt > now;
      const claimedAt = isSameOwnerActive ? existing.claimedAt : now;
      const lease = {
        issueNumber: Number(issueNumber),
        repo: repo.trim(),
        ownerId,
        claimedAt,
        expiresAt: now + ttl,
        heartbeatAt: now,
        claimedSha: bodySha,
        phase
      };
      this.leases[key] = lease;
      await this.saveToDisk();
      return {
        acquired: true,
        lease: { ...lease }
      };
    });
  }
  /**
   * Renew the heartbeat of an existing active lease.
   * Refreshes heartbeatAt and extends expiresAt.
   * Returns true if renewed, false if lease not found, expired, or owned by someone else.
   */
  async renewHeartbeat(repo, issueNumber, ownerId, ttlExtensionMs) {
    return this.runExclusive(async () => {
      await this.loadFromDisk();
      const key = this.getLeaseKey(repo, issueNumber);
      const existing = this.leases[key];
      const now = Date.now();
      if (!existing) {
        return false;
      }
      if (existing.ownerId !== ownerId) {
        return false;
      }
      if (existing.expiresAt <= now) {
        return false;
      }
      const extension = typeof ttlExtensionMs === "number" && ttlExtensionMs > 0 ? ttlExtensionMs : this.defaultTtlMs;
      existing.heartbeatAt = now;
      existing.expiresAt = now + extension;
      await this.saveToDisk();
      return true;
    });
  }
  /**
   * Release an acquired lease if owned by the caller.
   * Removes lease and atomically saves to disk.
   */
  async releaseLease(repo, issueNumber, ownerId) {
    return this.runExclusive(async () => {
      await this.loadFromDisk();
      const key = this.getLeaseKey(repo, issueNumber);
      const existing = this.leases[key];
      if (!existing) {
        return false;
      }
      if (existing.ownerId !== ownerId) {
        return false;
      }
      delete this.leases[key];
      await this.saveToDisk();
      return true;
    });
  }
  /**
   * Retrieve active unexpired lease for a task, or null if expired/absent.
   */
  getLease(repo, issueNumber) {
    const key = this.getLeaseKey(repo, issueNumber);
    const existing = this.leases[key];
    if (!existing) {
      return null;
    }
    const now = Date.now();
    if (existing.expiresAt <= now) {
      return null;
    }
    return { ...existing };
  }
  /**
   * List all currently active (unexpired) leases.
   */
  listActiveLeases() {
    const now = Date.now();
    return Object.values(this.leases).filter((lease) => lease.expiresAt > now).map((lease) => ({ ...lease }));
  }
  /**
   * Clean up expired leases from memory and disk. Returns count of pruned leases.
   */
  async pruneExpired() {
    return this.runExclusive(async () => {
      await this.loadFromDisk();
      const now = Date.now();
      let prunedCount = 0;
      for (const [key, lease] of Object.entries(this.leases)) {
        if (lease.expiresAt <= now) {
          delete this.leases[key];
          prunedCount++;
        }
      }
      if (prunedCount > 0) {
        await this.saveToDisk();
      }
      return prunedCount;
    });
  }
  /**
   * Reset all leases (useful for test teardown).
   */
  async clearAllLeases() {
    return this.runExclusive(async () => {
      this.leases = {};
      await this.saveToDisk();
    });
  }
  /**
   * Atomically save state to disk via temp file write and atomic rename.
   * Refuses to overwrite when prior state could not be read or backed up
   * (ADV-2C-03, ADV-2C-07): never destroy prior state without a successful backup.
   */
  async saveToDisk() {
    if (this.backupBlocked) {
      const backedUp = await this.backupPriorState("prior state unreadable before overwrite");
      if (!backedUp) {
        throw new Error("Refusing to overwrite lease store: prior state could not be read or backed up");
      }
      this.backupBlocked = false;
    }
    const dir = path2.dirname(this.filePath);
    await fs2.promises.mkdir(dir, { recursive: true });
    const baseName = path2.basename(this.filePath);
    const tmpFile = path2.join(
      dir,
      `.${baseName}.tmp.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2)}`
    );
    const state = {
      version: 1,
      leases: this.leases
    };
    const content = JSON.stringify(state, null, 2);
    try {
      await fs2.promises.writeFile(tmpFile, content, "utf8");
      await fs2.promises.rename(tmpFile, this.filePath);
    } catch (err) {
      try {
        await fs2.promises.unlink(tmpFile);
      } catch {
      }
      throw err;
    }
  }
};

// service/snapshot.ts
import path3 from "node:path";
var STALE_MS = 10 * 60 * 1e3;
var SNAPSHOT_MAX_BYTES = 16384;
var SNAPSHOT_MAX_AGE_MS = 9e4;
var SNAPSHOT_MAX_FUTURE_MS = 5e3;
var COUNT_MAX = 9999;
var ROOT_KEYS = ["v", "directory", "at", "complete", "counts", "top"];
var COUNT_KEYS = ["needsMe", "running", "blocked", "done", "total"];
var TOP_KEYS = ["repo", "number", "title"];
var FORBIDDEN_KEYS = /* @__PURE__ */ new Set(["__proto__", "constructor", "prototype"]);
var REPO_PATTERN = /^[A-Za-z0-9_.-]{1,100}\/[A-Za-z0-9_.-]{1,100}$/;
var DIRECTORY_MAX = 1024;
var TITLE_MAX = 2048;
var FORBIDDEN_CHARS = /[\u0000-\u001F\u007F-\u009F\u202A-\u202E\u2066-\u2069]/;
var LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;
var CREDENTIAL_PATTERNS = [/gh[pousr]_[A-Za-z0-9]{20,}/, /github_pat_[A-Za-z0-9_]{20,}/, /Bearer\s+\S+/];
var hasForbiddenText = (value) => FORBIDDEN_CHARS.test(value) || LONE_SURROGATE.test(value);
var isPlainObject = (value) => {
  if (Object(value) !== value || value === null || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
};
var hasExactKeys = (value, keys) => {
  const own = Object.keys(value);
  if (own.length !== keys.length) return false;
  return keys.every((key) => Object.prototype.hasOwnProperty.call(value, key));
};
var isBoundedInteger = (value, min, max) => typeof value === "number" && Number.isSafeInteger(value) && value >= min && value <= max;
var containsForbiddenKey = (value) => Object.keys(value).some((key) => FORBIDDEN_KEYS.has(key));
var looksLikeCredential = (value) => CREDENTIAL_PATTERNS.some((pattern) => pattern.test(value));
function normalizeDirectory(value) {
  if (typeof value !== "string") return null;
  if (value.length === 0 || value.length > DIRECTORY_MAX) return null;
  if (!path3.isAbsolute(value)) return null;
  if (hasForbiddenText(value)) return null;
  if (value.split("/").some((segment) => segment === "..")) return null;
  const normalized = path3.normalize(value);
  if (!path3.isAbsolute(normalized)) return null;
  return normalized.length > 1 ? normalized.replace(/\/+$/, "") : normalized;
}
function parseSnapshotBody(raw, receivedAt) {
  let wire;
  try {
    wire = JSON.parse(raw);
  } catch {
    return { ok: false, reason: "invalid_snapshot" };
  }
  if (!isPlainObject(wire) || containsForbiddenKey(wire)) return { ok: false, reason: "invalid_snapshot" };
  if (!hasExactKeys(wire, ROOT_KEYS)) return { ok: false, reason: "invalid_snapshot" };
  if (wire.v !== 1 || wire.complete !== true) return { ok: false, reason: "invalid_snapshot" };
  const directory = normalizeDirectory(wire.directory);
  if (!directory) return { ok: false, reason: "invalid_snapshot" };
  if (!isBoundedInteger(wire.at, 0, Number.MAX_SAFE_INTEGER)) return { ok: false, reason: "invalid_snapshot" };
  const at = wire.at;
  if (at < receivedAt - SNAPSHOT_MAX_AGE_MS || at > receivedAt + SNAPSHOT_MAX_FUTURE_MS) {
    return { ok: false, reason: "invalid_snapshot" };
  }
  const counts = wire.counts;
  if (!isPlainObject(counts) || containsForbiddenKey(counts)) return { ok: false, reason: "invalid_snapshot" };
  if (!hasExactKeys(counts, COUNT_KEYS)) return { ok: false, reason: "invalid_snapshot" };
  for (const key of COUNT_KEYS) {
    if (!isBoundedInteger(counts[key], 0, COUNT_MAX)) return { ok: false, reason: "invalid_snapshot" };
  }
  const parsedCounts = {
    needsMe: counts.needsMe,
    running: counts.running,
    blocked: counts.blocked,
    done: counts.done,
    total: counts.total
  };
  if (parsedCounts.done > parsedCounts.total) return { ok: false, reason: "invalid_snapshot" };
  if (parsedCounts.needsMe > parsedCounts.total) return { ok: false, reason: "invalid_snapshot" };
  if (parsedCounts.blocked > parsedCounts.total) return { ok: false, reason: "invalid_snapshot" };
  let top = null;
  if (wire.top !== null) {
    const candidate = wire.top;
    if (!isPlainObject(candidate) || containsForbiddenKey(candidate)) return { ok: false, reason: "invalid_snapshot" };
    if (!hasExactKeys(candidate, TOP_KEYS)) return { ok: false, reason: "invalid_snapshot" };
    if (typeof candidate.repo !== "string" || !REPO_PATTERN.test(candidate.repo)) return { ok: false, reason: "invalid_snapshot" };
    if (!isBoundedInteger(candidate.number, 1, 1e9)) return { ok: false, reason: "invalid_snapshot" };
    if (typeof candidate.title !== "string") return { ok: false, reason: "invalid_snapshot" };
    const title = candidate.title.trim();
    if (title.length === 0 || title.length > TITLE_MAX) return { ok: false, reason: "invalid_snapshot" };
    if (FORBIDDEN_CHARS.test(title) || LONE_SURROGATE.test(title) || looksLikeCredential(title) || looksLikeCredential(candidate.repo)) {
      return { ok: false, reason: "invalid_snapshot" };
    }
    top = { repo: candidate.repo, number: candidate.number, title };
  }
  if (top !== null && parsedCounts.needsMe === 0) return { ok: false, reason: "invalid_snapshot" };
  return {
    ok: true,
    snapshot: { directory, at, complete: true, counts: parsedCounts, top }
  };
}
var SnapshotStore = class {
  snapshots = /* @__PURE__ */ new Map();
  set(snapshot) {
    this.snapshots.set(snapshot.directory, snapshot);
  }
  /** The snapshot for exactly this directory, or `undefined`. Never another project's. */
  get(directory) {
    const key = normalizeDirectory(directory);
    if (!key) return void 0;
    return this.snapshots.get(key);
  }
  size() {
    return this.snapshots.size;
  }
  clear() {
    this.snapshots.clear();
  }
};

// service/status-view.ts
var CLAMP = { label: 60, value: 80, content: 200, note: 300 };
var ELLIPSIS = "...";
var CONTROL_CHARS = /[\u0000-\u001F\u007F-\u009F\u202A-\u202E\u2066-\u2069]/g;
var LONE_SURROGATES = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g;
var dropLoneSurrogates = (value) => value.replace(LONE_SURROGATES, "");
function clampText(value, max) {
  const raw = typeof value === "string" ? value : "";
  const clean = dropLoneSurrogates(raw.replace(CONTROL_CHARS, " ")).replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  if (max <= ELLIPSIS.length) return dropLoneSurrogates(clean.slice(0, max));
  return dropLoneSurrogates(`${clean.slice(0, max - ELLIPSIS.length).trimEnd()}${ELLIPSIS}`);
}
function isFrenchLocale(locale) {
  return typeof locale === "string" && /^fr/i.test(locale.trim());
}
var EN = {
  needsMe: "Needs me",
  top: "Next task",
  progress: "Progress",
  running: "Running agents",
  blocked: "Blocked by dependencies",
  task: (n) => n === 1 ? "1 task" : `${n} tasks`,
  nothingWaiting: "Nothing waiting",
  noTask: "No task needs you",
  noTasksYet: "No tasks yet",
  done: (done, total) => `${done} of ${total} done`,
  runningCount: (n) => `${n} running`,
  none: "None",
  noneFeminine: "None",
  loadedJustNow: "Loaded just now",
  loadedMinutes: (n) => `Loaded ${n} min ago`,
  staleMinutes: (n) => `Data loaded ${n} min ago. Open the board to refresh.`,
  staleHours: (n) => `Data loaded ${n} h ago. Open the board to refresh.`,
  empty: "No board data yet. Open the board once to load it."
};
var FR = {
  needsMe: "\xC0 traiter",
  top: "Prochaine t\xE2che",
  progress: "Avancement",
  running: "Agents en cours",
  blocked: "Bloqu\xE9es par des d\xE9pendances",
  task: (n) => n === 1 ? "1 t\xE2che" : `${n} t\xE2ches`,
  nothingWaiting: "Rien en attente",
  noTask: "Aucune t\xE2che ne vous attend",
  noTasksYet: "Aucune t\xE2che",
  done: (done, total) => `${done} sur ${total} termin\xE9es`,
  runningCount: (n) => `${n} en cours`,
  none: "Aucun",
  noneFeminine: "Aucune",
  loadedJustNow: "Charg\xE9 \xE0 l'instant",
  loadedMinutes: (n) => `Charg\xE9 il y a ${n} min`,
  staleMinutes: (n) => `Donn\xE9es charg\xE9es il y a ${n} min. Ouvrez le tableau pour actualiser.`,
  staleHours: (n) => `Donn\xE9es charg\xE9es il y a ${n} h. Ouvrez le tableau pour actualiser.`,
  empty: "Aucune donn\xE9e du tableau pour l'instant. Ouvrez le tableau une fois pour le charger."
};
var copyFor = (locale) => isFrenchLocale(locale) ? FR : EN;
function topValue(top, max) {
  let prefix = `${top.repo}#${top.number}`;
  if (prefix.length > max) {
    const shortRepo = top.repo.split("/").pop() || top.repo;
    prefix = `${shortRepo}#${top.number}`;
  }
  if (prefix.length > max) prefix = `#${top.number}`;
  if (prefix.length >= max) return clampText(prefix, max);
  const title = clampText(top.title, max - prefix.length - 1);
  return title ? `${prefix} ${title}` : prefix;
}
function ageNoteText(copy, age) {
  const minutes = Math.floor(age / 6e4);
  if (age < STALE_MS) {
    return age < 6e4 ? copy.loadedJustNow : copy.loadedMinutes(minutes);
  }
  if (age < 36e5) return copy.staleMinutes(minutes);
  return copy.staleHours(Math.floor(age / 36e5));
}
function buildStatusView(snapshot, locale, now) {
  const copy = copyFor(locale);
  if (!snapshot) {
    return { rows: [{ kind: "note", id: "empty", text: clampText(copy.empty, CLAMP.note), tone: "muted" }] };
  }
  const elapsed = now - snapshot.at;
  const age = Number.isFinite(elapsed) ? Math.max(0, elapsed) : STALE_MS;
  const { needsMe, running, blocked, done, total } = snapshot.counts;
  const rows = [
    {
      kind: "line",
      id: "needs-me",
      label: clampText(copy.needsMe, CLAMP.label),
      value: clampText(needsMe === 0 ? copy.nothingWaiting : copy.task(needsMe), CLAMP.value),
      dot: needsMe > 0 ? "warning" : "success"
    },
    {
      kind: "line",
      id: "top",
      label: clampText(copy.top, CLAMP.label),
      value: clampText(snapshot.top ? topValue(snapshot.top, CLAMP.value) : copy.noTask, CLAMP.value),
      dot: snapshot.top ? "warning" : "success",
      ...snapshot.top ? {
        content: {
          kind: "chips",
          chips: [
            {
              id: "issue",
              label: clampText(`#${snapshot.top.number}`, CLAMP.label),
              url: `https://github.com/${snapshot.top.repo}/issues/${snapshot.top.number}`
            }
          ]
        }
      } : {}
    },
    {
      kind: "line",
      id: "progress",
      label: clampText(copy.progress, CLAMP.label),
      value: clampText(total === 0 ? copy.noTasksYet : copy.done(done, total), CLAMP.value),
      dot: "default",
      content: {
        kind: "bar",
        value: total === 0 ? 0 : Math.min(100, Math.max(0, Math.round(done / total * 100)))
      }
    },
    {
      kind: "line",
      id: "running",
      label: clampText(copy.running, CLAMP.label),
      value: clampText(running === 0 ? copy.none : copy.runningCount(running), CLAMP.value),
      dot: running > 0 ? "success" : "muted"
    },
    {
      kind: "line",
      id: "blocked",
      label: clampText(copy.blocked, CLAMP.label),
      value: clampText(blocked === 0 ? copy.noneFeminine : copy.task(blocked), CLAMP.value),
      dot: blocked > 0 ? "error" : "success"
    },
    {
      kind: "note",
      id: "age",
      text: clampText(ageNoteText(copy, age), CLAMP.note),
      tone: age >= STALE_MS ? "warning" : "muted"
    }
  ];
  return { rows };
}

// service/session-event.ts
var SESSION_EVENTS_WIRE_VERSION = 1;
var SESSION_EVENTS_PATH = "/session-events";
var SESSION_EVENT_TYPES = [
  "turn-finished",
  "turn-failed",
  "permission-asked",
  "question-asked",
  "turn-started",
  "session-created",
  "session-archived",
  "session-deleted"
];
var isSessionEventType = (value) => SESSION_EVENT_TYPES.includes(value);
var isObject = (value) => Object(value) === value;
function readSessionEvent(body) {
  let wire;
  try {
    const parsed = JSON.parse(body);
    if (!isObject(parsed) || parsed === null || Array.isArray(parsed)) return null;
    wire = parsed;
  } catch {
    return null;
  }
  const { v, requestId, event, content } = wire;
  if (v !== SESSION_EVENTS_WIRE_VERSION) return null;
  if (typeof requestId !== "string" || requestId.length === 0) return null;
  if (!isObject(event) || event === void 0) return null;
  const { id, type, at, session, project, linked, permission, question } = event;
  if (typeof id !== "string" || id.length === 0) return null;
  if (typeof type !== "string" || !isSessionEventType(type)) return null;
  if (typeof at !== "number" || !Number.isFinite(at)) return null;
  if (!isObject(session) || session === void 0) return null;
  const sessionId = session.id;
  if (typeof sessionId !== "string" || sessionId.length === 0) return null;
  const parentId = session.parentId;
  if (parentId !== null && (typeof parentId !== "string" || parentId.length === 0)) return null;
  if (!isObject(project) || project === void 0) return null;
  const directory = project.directory;
  if (directory !== null && (typeof directory !== "string" || directory.length === 0)) return null;
  if (!Array.isArray(linked)) return null;
  const request = {
    v: SESSION_EVENTS_WIRE_VERSION,
    requestId,
    event: {
      id,
      type,
      at,
      session: { id: sessionId, parentId },
      project: { directory },
      linked
    }
  };
  if (permission !== void 0) {
    if (!isObject(permission)) return null;
    const permissionRequestId = permission.requestId;
    if (typeof permissionRequestId !== "string" || permissionRequestId.length === 0) return null;
    request.event.permission = { requestId: permissionRequestId };
  }
  if (question !== void 0) {
    if (!isObject(question)) return null;
    const kind = question.kind;
    const questionId = question.id;
    if (kind !== "form" && kind !== "page") return null;
    if (typeof questionId !== "string" || questionId.length === 0) return null;
    request.event.question = { kind, id: questionId };
  }
  if (content !== void 0) {
    if (!isObject(content) || content.type !== type) return null;
    request.content = content;
  }
  return request;
}

// service/session-marks.ts
var MARK_POLL_MS = 3e4;
var MARK_POLL_MAX_MS = 3e5;
var MARK_CHANGES_PER_MINUTE = 60;
var MARK_MAX = 200;
var MARK_TEXT = {
  running: { en: "Agent running", fr: "Agent en cours" },
  waiting: { en: "Waiting for your answer", fr: "En attente de votre r\xE9ponse" }
};
var SessionMarks = class {
  entries = /* @__PURE__ */ new Map();
  /** French before the section has ever polled: the owner's language (D49.2). */
  language = "fr";
  changeTimes = [];
  /** Sessions whose desired mark differs from the delivered one but had no slot yet. */
  pending = /* @__PURE__ */ new Set();
  flushTimer = null;
  pollMs;
  now;
  changesPerMinute;
  windowMs;
  onStatus;
  host;
  /** What the host currently shows per session; absence means no mark. */
  delivered = /* @__PURE__ */ new Map();
  constructor(host, options = {}) {
    this.host = host;
    this.pollMs = options.pollMs ?? MARK_POLL_MS;
    this.now = options.now ?? Date.now;
    this.changesPerMinute = options.changesPerMinute ?? MARK_CHANGES_PER_MINUTE;
    this.windowMs = options.windowMs ?? 6e4;
    this.onStatus = options.onStatus;
  }
  /** Applies one session event. A subagent's row is ignored: its parent's turn is the one to watch. */
  handleEvent(request) {
    const { session, type } = request.event;
    if (session.parentId) return;
    switch (type) {
      case "turn-started":
        this.apply(session.id, "running");
        break;
      case "permission-asked":
      case "question-asked":
        this.apply(session.id, "waiting");
        break;
      case "turn-finished":
      case "turn-failed":
      // An archived or deleted session can no longer answer, so its mark must
      // not outlive it (design §4.3). Clearing stops the poll with the entry.
      case "session-archived":
      case "session-deleted":
        this.clear(session.id);
        break;
      default:
        break;
    }
  }
  /** Remembers the language of the most recent `GET /status` and re-sets live marks when it changes. */
  noteLocale(locale) {
    const next = isFrenchLocale(locale) ? "fr" : "en";
    if (next === this.language) return;
    this.language = next;
    for (const sessionId of this.entries.keys()) {
      this.request(sessionId);
    }
  }
  /** The current mark state of a session, for tests and diagnostics. */
  stateOf(sessionId) {
    return this.entries.get(sessionId)?.state;
  }
  languageOf() {
    return this.language;
  }
  /** Stops every poll and every deferred change. Marks themselves die with the process. */
  stop() {
    for (const entry of this.entries.values()) this.stopTimer(entry);
    this.entries.clear();
    if (this.flushTimer) clearTimeout(this.flushTimer);
    this.flushTimer = null;
    this.pending.clear();
    this.delivered.clear();
  }
  apply(sessionId, state) {
    const current = this.entries.get(sessionId);
    if (current && current.state === state) {
      this.pending.delete(sessionId);
      return;
    }
    if (!current && this.entries.size >= MARK_MAX) return;
    if (current) this.stopTimer(current);
    const entry = { state, timer: null, delay: this.pollMs };
    this.entries.set(sessionId, entry);
    this.request(sessionId);
    if (state === "waiting") this.schedulePoll(sessionId);
  }
  clear(sessionId) {
    const current = this.entries.get(sessionId);
    if (!current) return;
    this.stopTimer(current);
    this.entries.delete(sessionId);
    this.request(sessionId);
  }
  /**
   * Sends the desired mark of one session when it differs from what the host
   * already shows. A change the rate limit refuses is remembered and delivered
   * when the window frees: dropping it would leave a stale "waiting" mark that
   * no later event ever clears.
   */
  request(sessionId) {
    const desired = this.entries.get(sessionId)?.state ?? null;
    const shown = this.delivered.get(sessionId);
    const upToDate = desired === null ? shown === void 0 : shown !== void 0 && shown.state === desired && shown.lang === this.language;
    if (upToDate) {
      this.pending.delete(sessionId);
      return;
    }
    if (!this.takeChangeSlot()) {
      this.pending.add(sessionId);
      this.armFlush();
      return;
    }
    this.pending.delete(sessionId);
    this.deliver(sessionId, desired);
  }
  deliver(sessionId, state) {
    if (state === null) this.delivered.delete(sessionId);
    else this.delivered.set(sessionId, { state, lang: this.language });
    const mark = state === null ? null : {
      icon: state === "running" ? "time" : "question",
      tone: state === "running" ? "info" : "warning",
      text: MARK_TEXT[state][this.language]
    };
    void Promise.resolve().then(() => this.host.setMark({ sessionId }, mark)).catch(() => {
    });
  }
  /** Delivers the changes held back by the rate limit, once the window frees a slot. */
  armFlush() {
    if (this.flushTimer) return;
    const oldest = this.changeTimes[0];
    const wait = oldest === void 0 ? 1 : oldest + this.windowMs - this.now() + 1;
    const timer = setTimeout(() => {
      this.flushTimer = null;
      this.flush();
    }, Math.max(1, wait));
    timer.unref?.();
    this.flushTimer = timer;
  }
  flush() {
    for (const sessionId of [...this.pending]) {
      if (!this.pending.has(sessionId)) continue;
      this.request(sessionId);
      if (this.pending.has(sessionId)) {
        this.armFlush();
        return;
      }
    }
  }
  takeChangeSlot() {
    const now = this.now();
    while (this.changeTimes.length > 0 && now - this.changeTimes[0] >= this.windowMs) this.changeTimes.shift();
    if (this.changeTimes.length >= this.changesPerMinute) return false;
    this.changeTimes.push(now);
    return true;
  }
  schedulePoll(sessionId) {
    const entry = this.entries.get(sessionId);
    if (!entry || entry.state !== "waiting") return;
    const timer = setTimeout(() => {
      void this.poll(sessionId);
    }, entry.delay);
    timer.unref?.();
    entry.timer = timer;
  }
  async poll(sessionId) {
    const entry = this.entries.get(sessionId);
    if (!entry || entry.state !== "waiting") return;
    entry.timer = null;
    try {
      const status = await this.host.sessionStatus(sessionId);
      this.onStatus?.(sessionId, status);
      if (status === "busy") {
        this.apply(sessionId, "running");
        return;
      }
      if (status === "idle") {
        this.clear(sessionId);
        return;
      }
      entry.delay = this.pollMs;
    } catch {
      entry.delay = Math.min(Math.max(entry.delay * 2, this.pollMs), MARK_POLL_MAX_MS);
    }
    const after = this.entries.get(sessionId);
    if (after && after.state === "waiting") this.schedulePoll(sessionId);
  }
  stopTimer(entry) {
    if (!entry.timer) return;
    clearTimeout(entry.timer);
    entry.timer = null;
  }
};

// service/decision-form.ts
var FORM_MAX_FIELDS = 40;
var FORM_MAX_OPTIONS = 50;
var FORM_MAX_TITLE = 200;
var FORM_MAX_DESCRIPTION = 500;
var FORM_MAX_CUSTOM = 2e3;
var isObject2 = (value) => Object(value) === value && !Array.isArray(value);
function cutText(value, max) {
  if (value.length <= max) return { text: value, cut: false };
  let end = max;
  const code = value.charCodeAt(end - 1);
  if (code >= 55296 && code <= 56319) end -= 1;
  return { text: value.slice(0, end), cut: true };
}
var isFieldType = (value) => value === "string" || value === "number" || value === "integer" || value === "boolean" || value === "multiselect" || value === "external";
function clampFormFields(raw) {
  const result = { fields: [], droppedFields: 0, droppedOptions: 0, truncated: false };
  if (!Array.isArray(raw)) return result;
  const seenKeys = /* @__PURE__ */ new Set();
  for (const candidate of raw) {
    if (!isObject2(candidate)) continue;
    const key = candidate.key;
    if (typeof key !== "string" || key.length === 0 || seenKeys.has(key)) continue;
    if (!isFieldType(candidate.type)) continue;
    const rawTitle = candidate.title;
    if (typeof rawTitle !== "string") continue;
    if (result.fields.length >= FORM_MAX_FIELDS) {
      result.droppedFields += 1;
      continue;
    }
    const title = cutText(rawTitle, FORM_MAX_TITLE);
    if (title.cut) result.truncated = true;
    const rawDescription = candidate.description;
    const description = typeof rawDescription === "string" ? cutText(rawDescription, FORM_MAX_DESCRIPTION) : { text: null, cut: false };
    if (description.cut) result.truncated = true;
    const field = {
      key,
      type: candidate.type,
      title: title.text,
      description: description.text,
      required: candidate.required === true
    };
    if (Array.isArray(candidate.options)) {
      const options = [];
      for (const option of candidate.options) {
        if (!isObject2(option)) continue;
        const value = option.value;
        const label = option.label;
        if (typeof value !== "string" || typeof label !== "string") continue;
        if (options.length >= FORM_MAX_OPTIONS) {
          result.droppedOptions += 1;
          continue;
        }
        options.push({ value, label });
      }
      if (options.length > 0) field.options = options;
    }
    if (candidate.custom === true) field.custom = true;
    if (Array.isArray(candidate.when)) {
      const when = [];
      for (const condition of candidate.when) {
        if (!isObject2(condition)) continue;
        const op = condition.op;
        const conditionValue = condition.value;
        if (typeof condition.key !== "string" || condition.key.length === 0) continue;
        if (op !== "eq" && op !== "neq") continue;
        if (typeof conditionValue !== "string" && typeof conditionValue !== "number" && typeof conditionValue !== "boolean") {
          continue;
        }
        when.push({ key: condition.key, op, value: conditionValue });
      }
      if (when.length > 0) field.when = when;
    }
    seenKeys.add(key);
    result.fields.push(field);
  }
  return result;
}
function conditionHolds(actual, condition) {
  if (actual === void 0 || actual === null) return condition.op === "neq";
  const expected = condition.value;
  let equal;
  if (typeof expected === "number") {
    equal = typeof actual === "number" ? actual === expected : Number(actual) === expected;
  } else if (typeof expected === "boolean") {
    equal = typeof actual === "boolean" ? actual === expected : String(actual) === String(expected);
  } else {
    equal = typeof actual === "string" ? actual === expected : String(actual) === expected;
  }
  return condition.op === "eq" ? equal : !equal;
}
function visibleFieldKeys(fields, values) {
  const known = new Set(fields.map((field) => field.key));
  const visible = /* @__PURE__ */ new Set();
  for (const field of fields) {
    const conditions = field.when ?? [];
    const holds = conditions.every((condition) => {
      if (!known.has(condition.key)) return false;
      return conditionHolds(values[condition.key], condition);
    });
    if (holds) visible.add(field.key);
  }
  return visible;
}
var isEmpty = (value) => {
  if (value === void 0) return true;
  if (typeof value === "string") return value.trim().length === 0;
  if (Array.isArray(value)) return value.length === 0;
  return false;
};
var isPlainValue = (value) => {
  if (typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
};
function validateFormAnswer(fields, raw) {
  if (!isObject2(raw)) return { ok: false, code: "ANSWER_INVALID", detail: [] };
  const submitted = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!isPlainValue(value)) return { ok: false, code: "ANSWER_INVALID", detail: [key] };
    submitted[key] = value;
  }
  if (Object.keys(submitted).length === 0) return { ok: false, code: "ANSWER_INVALID", detail: [] };
  if (fields.some((field) => field.type === "external")) {
    return { ok: false, code: "ANSWER_NEEDS_EXTERNAL", detail: fields.filter((f) => f.type === "external").map((f) => f.key) };
  }
  const known = new Set(fields.map((field) => field.key));
  for (const key of Object.keys(submitted)) {
    if (!known.has(key)) return { ok: false, code: "ANSWER_INVALID", detail: [key] };
  }
  const visible = visibleFieldKeys(fields, submitted);
  const values = {};
  const dropped = [];
  const invalid = [];
  for (const field of fields) {
    const value = submitted[field.key];
    if (!visible.has(field.key)) {
      if (value !== void 0) dropped.push(field.key);
      continue;
    }
    if (value === void 0) {
      if (field.required) invalid.push(field.key);
      continue;
    }
    if (!fieldValid(field, value)) {
      invalid.push(field.key);
      continue;
    }
    values[field.key] = value;
  }
  if (invalid.length > 0) return { ok: false, code: "ANSWER_INVALID", detail: invalid };
  return { ok: true, values, dropped };
}
function fieldValid(field, value) {
  switch (field.type) {
    case "string": {
      if (typeof value !== "string") return false;
      if (field.required && value.trim().length === 0) return false;
      if (field.options && field.options.length > 0) {
        if (field.options.some((option) => option.value === value)) return true;
        return field.custom === true && value.trim().length > 0 && value.trim().length <= FORM_MAX_CUSTOM;
      }
      return true;
    }
    case "number":
      return typeof value === "number" && Number.isFinite(value);
    case "integer":
      return typeof value === "number" && Number.isInteger(value);
    case "boolean":
      return typeof value === "boolean";
    case "multiselect": {
      if (!Array.isArray(value) || value.length === 0) return false;
      const offered = new Set((field.options ?? []).map((option) => option.value));
      return value.every((entry) => offered.has(entry) || field.custom === true && entry.length <= FORM_MAX_CUSTOM);
    }
    case "external":
      return false;
  }
}
function formIsAnswerable(fields) {
  return !fields.some((field) => field.type === "external");
}
function formIsComplete(fields, values) {
  const visible = visibleFieldKeys(fields, values);
  return fields.every((field) => {
    if (!visible.has(field.key) || !field.required) return true;
    const value = values[field.key];
    if (isEmpty(value)) return false;
    return fieldValid(field, value);
  });
}

// service/decision-store.ts
var DECISIONS_MAX = 50;
var DECISIONS_BODY_MAX = 64 * 1024;
var DECISION_STALENESS_MS = 10 * 6e4;
var DECISION_TOMBSTONES_MAX = 200;
var DECISION_MESSAGE_MAX = 2e3;
var DECISION_TITLE_MAX = 200;
var LINKED_MAX = 8;
var isObject3 = (value) => Object(value) === value && !Array.isArray(value);
var cut = (value, max) => value.length <= max ? value : value.slice(0, max);
function normalizeLinked(raw) {
  if (!Array.isArray(raw)) return [];
  const items = [];
  for (const candidate of raw) {
    if (!isObject3(candidate)) continue;
    const id = candidate.id;
    if (typeof id !== "string" || id.length === 0) continue;
    const number = typeof candidate.number === "number" && Number.isFinite(candidate.number) ? candidate.number : null;
    const url = typeof candidate.url === "string" ? candidate.url : "";
    items.push({ id: cut(id, 300), number, url: cut(url, 500) });
    if (items.length >= LINKED_MAX) break;
  }
  return items;
}
function readAsk(content, askId) {
  if (!content || content.type !== "question-asked") return null;
  const ask = content.ask;
  if (!isObject3(ask)) return null;
  if (ask.id !== askId) return null;
  return ask;
}
var DecisionStore = class {
  entries = /* @__PURE__ */ new Map();
  now;
  maxEntries;
  stalenessMs;
  log;
  projects = /* @__PURE__ */ new Set();
  /** A decision removed after the host said it was gone never comes back as live. */
  removed = /* @__PURE__ */ new Set();
  removedOrder = [];
  host;
  startedAt;
  constructor(options = {}) {
    this.now = options.now ?? Date.now;
    this.maxEntries = options.maxEntries ?? DECISIONS_MAX;
    this.stalenessMs = options.stalenessMs ?? DECISION_STALENESS_MS;
    this.log = options.log ?? (() => {
    });
    this.host = options.host;
    if (options.projectDirectory) this.registerProject(options.projectDirectory);
    this.startedAt = this.now();
  }
  /** Set once the host client exists, or replaced in a test. */
  setHost(host) {
    this.host = host;
  }
  /**
   * Adds one project directory the board owns. Called from `POST /snapshot`
   * (the panel's own project) and from the constructor. A worktree under the
   * project is still the project, so a subdirectory matches.
   */
  registerProject(directory) {
    if (typeof directory !== "string" || directory.length === 0) return;
    this.projects.add(directory.replace(/\/+$/, ""));
  }
  /** True when the store has no project scope, or `directory` is inside it. */
  inScope(directory) {
    if (this.projects.size === 0) return true;
    if (typeof directory !== "string" || directory.length === 0) return false;
    const normalized = directory.replace(/\/+$/, "");
    for (const project of this.projects) {
      if (normalized === project || normalized.startsWith(`${project}/`)) return true;
    }
    return false;
  }
  rememberRemoved(id) {
    if (this.removed.has(id)) return;
    this.removed.add(id);
    this.removedOrder.push(id);
    while (this.removedOrder.length > DECISION_TOMBSTONES_MAX) {
      const oldest = this.removedOrder.shift();
      if (oldest) this.removed.delete(oldest);
    }
  }
  size() {
    return this.entries.size;
  }
  get(id) {
    return this.entries.get(id);
  }
  entriesOf(sessionId) {
    return [...this.entries.values()].filter((entry) => entry.sessionId === sessionId);
  }
  /**
   * Applies one session event.
   *
   * - `question-asked` creates or refreshes one entry (§3.1).
   * - `turn-finished` / `turn-failed` close every entry of the session: the
   *   host's own definition of idle is "nothing waiting" (§3.5).
   * - `session-archived` / `session-deleted` remove every entry of the session.
   * - `turn-started` clears nothing: answering a form resumes the turn without
   *   a new `turn-started` (§3.5).
   * - `permission-asked` is out of scope for this release (D53 scope decision).
   */
  handleEvent(request) {
    const { event } = request;
    const sessionId = event.session.id;
    switch (event.type) {
      case "question-asked":
        this.createFromQuestion(request);
        break;
      case "turn-finished":
      case "turn-failed":
        this.removeSession(sessionId);
        break;
      case "session-archived":
      case "session-deleted":
        this.removeSession(sessionId);
        break;
      default:
        break;
    }
  }
  /**
   * One `sessions.status` answer, shared with the marks poll (§7.1). `waiting`
   * confirms every entry of the session; `idle`/`busy` closes them.
   */
  observeStatus(sessionId, status) {
    if (status === "waiting") {
      const at = this.now();
      for (const entry of this.entriesOf(sessionId)) entry.confirmedAt = at;
      return;
    }
    this.removeSession(sessionId);
  }
  /** True when the last positive observation is older than the staleness window. */
  isUnconfirmed(entry) {
    return this.now() - entry.confirmedAt > this.stalenessMs;
  }
  /**
   * `GET /decisions` (§3.8). Sorted per §3.4 and capped at 64 KB: when the
   * projection is too large, the oldest entries are dropped first.
   */
  list() {
    const at = this.now();
    let decisions = this.sorted();
    let view = { v: 1, at, startedAt: this.startedAt, decisions };
    while (decisions.length > 0 && Buffer.byteLength(JSON.stringify(view), "utf8") > DECISIONS_BODY_MAX) {
      const oldest = [...decisions].sort((a, b) => a.askedAt - b.askedAt)[0];
      decisions = decisions.filter((entry) => entry !== oldest);
      view = { v: 1, at, startedAt: this.startedAt, decisions };
      this.log(`[decisions] projection over ${DECISIONS_BODY_MAX} bytes; dropped ${oldest.id}`);
    }
    return view;
  }
  /**
   * `POST /decision/answer` (§5.1). The client sends a decision id and values;
   * the service resolves session, form id and kind from its own entry, so a
   * compromised panel can only answer decisions the service already knows.
   */
  async answer(request) {
    const id = request.id;
    if (typeof id !== "string" || id.length === 0) {
      return { status: 400, body: { v: 1, code: "ANSWER_INVALID", detail: [] } };
    }
    const entry = this.entries.get(id);
    if (!entry) return { status: 404, body: { v: 1, code: "DECISION_UNKNOWN" } };
    if (entry.state !== "pending") return { status: 409, body: { v: 1, code: "DECISION_NOT_PENDING" } };
    if (entry.linked.length === 0) return { status: 409, body: { v: 1, code: "DECISION_NOT_LINKED" } };
    if (!this.inScope(entry.directory)) {
      return { status: 409, body: { v: 1, code: "DECISION_FOREIGN_PROJECT" } };
    }
    if (this.isUnconfirmed(entry)) return { status: 409, body: { v: 1, code: "DECISION_STALE" } };
    if (entry.kind !== "form") {
      return { status: 400, body: { v: 1, code: "ANSWER_INVALID", detail: [] } };
    }
    const values = request.values;
    const message = request.message;
    let answerValues = null;
    let answerMessage;
    if (values === null || values === void 0) {
      if (typeof message !== "string") {
        return { status: 400, body: { v: 1, code: "ANSWER_INVALID", detail: ["message"] } };
      }
      const trimmed = message.trim();
      if (trimmed.length === 0 || trimmed.length > DECISION_MESSAGE_MAX) {
        return { status: 400, body: { v: 1, code: "ANSWER_INVALID", detail: ["message"] } };
      }
      answerValues = null;
      answerMessage = trimmed;
    } else {
      if (message !== null && message !== void 0) {
        return { status: 400, body: { v: 1, code: "ANSWER_INVALID", detail: ["message"] } };
      }
      const validation = validateFormAnswer(entry.fields ?? [], values);
      if (!validation.ok) {
        return { status: 400, body: { v: 1, code: validation.code, detail: validation.detail } };
      }
      if (Object.keys(validation.values).length === 0) {
        return { status: 400, body: { v: 1, code: "ANSWER_INVALID", detail: [] } };
      }
      answerValues = validation.values;
    }
    const host = this.host;
    if (!host) {
      return { status: 503, body: { v: 1, code: "HOST_UNAVAILABLE" } };
    }
    entry.state = "answering";
    try {
      const result = await host.answerForm(entry.sessionId, entry.askId, answerValues, answerMessage);
      if (result?.answered !== true) {
        entry.state = "pending";
        return { status: 400, body: { v: 1, code: "ANSWER_REFUSED" } };
      }
      entry.state = "answered-unconfirmed";
      entry.answeredAt = this.now();
      entry.confirmedAt = entry.answeredAt;
      return { status: 200, body: { v: 1, state: "answered-unconfirmed" } };
    } catch (error) {
      return this.mapHostError(entry, error);
    }
  }
  /** Maps one host failure to the wire answer and the entry state, no retry (§5.1). */
  mapHostError(entry, error) {
    const status = isObject3(error) || typeof error === "object" ? Number(error?.status ?? 0) : 0;
    const message = typeof error?.message === "string" ? String(error.message) : void 0;
    if (status === 404) {
      this.entries.delete(entry.id);
      this.rememberRemoved(entry.id);
      return { status: 404, body: { v: 1, code: "DECISION_GONE" } };
    }
    if (status === 403) {
      entry.state = "pending";
      return { status: 403, body: { v: 1, code: "PERMISSION_MISSING", message: message ?? null } };
    }
    if (status === 400) {
      entry.state = "pending";
      return { status: 400, body: { v: 1, code: "ANSWER_REFUSED", message: message ?? null } };
    }
    if (status === 429) {
      entry.state = "pending";
      return { status: 429, body: { v: 1, code: "RATE_LIMITED" } };
    }
    return { status: 502, body: { v: 1, code: "UNKNOWN", message: message ?? null } };
  }
  createFromQuestion(request) {
    const { event } = request;
    const question = event.question;
    if (!question) return;
    const sessionId = event.session.id;
    const askId = question.id;
    const id = `${sessionId}:${question.kind}:${askId}`;
    const ask = readAsk(request.content, askId);
    const now = this.now();
    if (this.removed.has(id)) return;
    const existing = this.entries.get(id);
    if (existing) {
      existing.askedAt = Math.min(existing.askedAt, event.at);
      existing.confirmedAt = now;
      if (ask) {
        this.applyAsk(existing, ask);
      }
      return;
    }
    if (!sessionId) return;
    if (!this.inScope(event.project.directory)) return;
    const entry = {
      id,
      kind: question.kind,
      sessionId,
      parentId: event.session.parentId,
      directory: event.project.directory,
      askId,
      title: null,
      sessionTitle: typeof request.content?.sessionTitle === "string" ? request.content.sessionTitle : null,
      askedAt: event.at,
      state: "pending",
      confirmedAt: now,
      answeredAt: null,
      linked: normalizeLinked(event.linked),
      fields: null,
      page: question.kind === "page" ? { hasHtml: false, hasUi: false, htmlChars: 0, mode: null } : null,
      droppedFields: 0,
      droppedOptions: 0
    };
    if (ask) this.applyAsk(entry, ask);
    this.entries.set(id, entry);
    this.enforceCap();
  }
  /** Reads title/fields from an ask. Without `transcript` the ask is absent and the entry stays blind. */
  applyAsk(entry, ask) {
    const title = ask.title;
    if (typeof title === "string" && title.length > 0) entry.title = cut(title, DECISION_TITLE_MAX);
    if (entry.kind !== "form") return;
    if (!Array.isArray(ask.fields)) return;
    const clamped = clampFormFields(ask.fields);
    entry.fields = clamped.fields;
    entry.droppedFields = clamped.droppedFields;
    entry.droppedOptions = clamped.droppedOptions;
  }
  removeSession(sessionId) {
    for (const [id, entry] of this.entries) {
      if (entry.sessionId === sessionId) {
        this.entries.delete(id);
        this.rememberRemoved(id);
      }
    }
  }
  /** §7.6: at most 50 entries; answered entries are evicted before waiting ones. */
  enforceCap() {
    while (this.entries.size > this.maxEntries) {
      const all = [...this.entries.values()];
      const answered = all.filter((entry) => entry.state === "answered-unconfirmed").sort((a, b) => (a.answeredAt ?? a.askedAt) - (b.answeredAt ?? b.askedAt));
      const victim = answered[0] ?? all.sort((a, b) => a.askedAt - b.askedAt)[0];
      if (!victim) return;
      this.entries.delete(victim.id);
      this.rememberRemoved(victim.id);
      this.log(`[decisions] store at ${this.maxEntries}; dropped ${victim.id}`);
    }
  }
  /** §3.4: waiting before confirming, then newest first, then ask id descending. */
  sorted() {
    return [...this.entries.values()].sort((a, b) => {
      const aWaiting = a.state === "answered-unconfirmed" ? 1 : 0;
      const bWaiting = b.state === "answered-unconfirmed" ? 1 : 0;
      if (aWaiting !== bWaiting) return aWaiting - bWaiting;
      if (a.askedAt !== b.askedAt) return b.askedAt - a.askedAt;
      return a.askId < b.askId ? 1 : a.askId > b.askId ? -1 : 0;
    });
  }
};

// service/host-client.ts
var HOST_CALLBACK_URL_ENV = "OPENCHAMBER_HOST_CALLBACK_URL";
var SERVICE_HOST_PATH = "/service/call";
var SERVICE_HOST_TIMEOUT_MS = 3e4;
var HostCallError = class extends Error {
  code;
  status;
  constructor(message, code, status) {
    super(message);
    this.name = "HostCallError";
    this.code = code;
    this.status = status;
  }
};
function createHostClient(env) {
  const call = async (method, input) => {
    const base = env[HOST_CALLBACK_URL_ENV];
    const token = env.OPENCHAMBER_SERVICE_TOKEN;
    if (!base || !token) {
      throw new HostCallError("This service was not started by OpenChamber.", "HOST_UNAVAILABLE", 0);
    }
    let response;
    try {
      response = await fetch(`${base.replace(/\/+$/, "")}${SERVICE_HOST_PATH}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ method, input }),
        signal: AbortSignal.timeout(SERVICE_HOST_TIMEOUT_MS)
      });
    } catch {
      throw new HostCallError("OpenChamber did not answer.", "HOST_UNAVAILABLE", 0);
    }
    const body = await response.json().catch(() => null);
    if (response.ok && body?.result !== void 0) return body.result;
    throw new HostCallError(
      body?.error?.message ?? `OpenChamber answered HTTP ${response.status}.`,
      body?.error?.code ?? "HOST_UNAVAILABLE",
      response.status
    );
  };
  return {
    setInstructions: async (directory, text) => {
      await call("instructions.set", { directory, text });
    },
    setMark: async (target, mark) => {
      await call("marks.set", { target, mark });
    },
    sessionStatus: async (sessionId) => {
      const result = await call("sessions.status", { sessionId });
      const status = result?.status;
      if (status === "idle" || status === "busy" || status === "waiting") return status;
      throw new HostCallError("OpenChamber answered an unknown session status.", "HOST_UNAVAILABLE", 0);
    },
    answerForm: async (sessionId, formId, values, message) => {
      const input = { sessionId, formId, values };
      if (message !== void 0) input.message = message;
      const result = await call("sessions.answerForm", input);
      if (result?.answered !== true) {
        throw new HostCallError("OpenChamber did not take the answer.", "HOST_UNAVAILABLE", 0);
      }
      return { answered: true };
    },
    send: async (sessionId, prompt) => {
      const result = await call("sessions.send", { sessionId, prompt });
      if (result?.sent !== true) {
        throw new HostCallError("OpenChamber did not take the message.", "HOST_UNAVAILABLE", 0);
      }
      return { sent: true };
    }
  };
}

// service/instructions.ts
var TASK_BOARD_INSTRUCTIONS = String.raw`Board: https://board.workflows.ac
Tasks are GitHub issues. The board reads the issue body and its status label.

Status labels: status:todo, status:in-progress, status:in-review, status:needs-human. status:in-review means you are reviewing your own work; it asks nothing of the person. Never set status:done. Never close an issue.

Human gate. A task may sit in status:needs-human only when its body carries a click-through artifact:

### Human Review:
- Artifact: image
- URL: https://example.com/shot.png
- Instruction: Compare the empty state with the approved mockup.

Artifact is image, video, link or question. image needs an https URL. video and link need an http or https URL and one Instruction line of at most 200 characters. question takes no URL: it points at the first unanswered item under ### Open Questions: and needs at least one preset line. Without a valid artifact the board refuses status:needs-human.

Write a question when a decision blocks the work. Put it under ### Open Questions: as one self-contained sentence, with preset lines directly below:
  - Label :: one-line gist :: details
Block only the work that depends on the answer. Independent work continues.

When you block on a person or hand off for validation, add verb-first items under ### Human Tasks: at that moment and stop cleanly. Never check a human's box.`;

// service/cas.ts
import crypto from "node:crypto";
function computeIssueSha(body) {
  const content = (body ?? "").replace(/\r\n?/g, "\n");
  return crypto.createHash("sha256").update(content).digest("hex");
}
function verifyIssueCas(currentBody, expectedSha) {
  const currentSha = computeIssueSha(currentBody);
  const normalizedExpected = (expectedSha || "").trim().toLowerCase();
  const match = currentSha.toLowerCase() === normalizedExpected;
  return {
    match,
    currentSha
  };
}
var CasManager = class {
  static compute(body) {
    return computeIssueSha(body);
  }
  static verify(currentBody, expectedSha) {
    return verifyIssueCas(currentBody, expectedSha);
  }
};

// service/task-claim.ts
function isTaskEligibleForPilot(issue) {
  if (!issue || typeof issue !== "object") {
    return false;
  }
  if (issue.state === "closed" || typeof issue.state === "string" && issue.state.toLowerCase() === "closed" || issue.closed === true || Boolean(issue.closed_at)) {
    return false;
  }
  const rawPhase = issue.v2Metadata?.phase ?? issue.phase ?? "";
  const phase = typeof rawPhase === "string" ? rawPhase.trim().toLowerCase() : "";
  if (phase === "done" || phase === "archive") {
    return false;
  }
  const rawAttention = issue.v2Metadata?.attention ?? issue.attention ?? "none";
  const attention = typeof rawAttention === "string" ? rawAttention.trim().toLowerCase() : "none";
  if (attention !== "none" && attention !== "") {
    return false;
  }
  const rawLabels = Array.isArray(issue.labels) ? issue.labels : [];
  const labelNames = rawLabels.map(
    (l) => (typeof l === "string" ? l : l?.name || "").trim().toLowerCase()
  );
  const hasPilotLabel = labelNames.includes("coordinator:pilot") || labelNames.includes("pilot");
  const isExplicitV2 = issue.v2Metadata?.isExplicitV2 === true;
  const isEligiblePhase = (phase === "exploration" || phase === "execution") && attention === "none";
  return hasPilotLabel || isEligiblePhase && isExplicitV2;
}
async function claimPilotTask(issue, repo, leaseStore, workerId, ttlMs) {
  if (!issue || typeof issue !== "object") {
    return {
      acquired: false,
      conflictReason: "Invalid issue object provided"
    };
  }
  if (!isTaskEligibleForPilot(issue)) {
    return {
      acquired: false,
      conflictReason: "Task is not eligible for coordinator pilot"
    };
  }
  const issueNumber = Number(issue.number);
  if (!issueNumber || Number.isNaN(issueNumber)) {
    return {
      acquired: false,
      conflictReason: "Issue must have a valid issue number"
    };
  }
  const claimedSha = computeIssueSha(issue.body);
  const rawPhase = issue.v2Metadata?.phase ?? issue.phase ?? "exploration";
  const phase = typeof rawPhase === "string" && rawPhase.trim() ? rawPhase.trim().toLowerCase() : "exploration";
  return await leaseStore.acquireLease(repo, issueNumber, workerId, claimedSha, phase, ttlMs);
}
var TaskClaimEngine = class {
  leaseStore;
  workerId;
  defaultTtlMs;
  constructor(leaseStore, workerId, defaultTtlMs) {
    this.leaseStore = leaseStore;
    this.workerId = workerId;
    this.defaultTtlMs = defaultTtlMs;
  }
  isEligible(issue) {
    return isTaskEligibleForPilot(issue);
  }
  async claim(issue, repo, ttlMs) {
    return claimPilotTask(issue, repo, this.leaseStore, this.workerId, ttlMs ?? this.defaultTtlMs);
  }
};

// service/session-watcher.ts
function inspectSessionLiveness(session) {
  if (!session) {
    return {
      state: "idle",
      details: "No session provided",
      reason: "No session provided"
    };
  }
  if (typeof session === "string") {
    const norm = session.trim().toLowerCase();
    if (norm === "blocked-permission" || norm === "waiting-permission") {
      return { state: "blocked-permission", details: "Session blocked on permissions", reason: "Session blocked on permissions" };
    }
    if (norm === "blocked-question" || norm === "waiting-question") {
      return { state: "blocked-question", details: "Session waiting for human decision", reason: "Session waiting for human decision" };
    }
    if (norm === "completed" || norm === "done" || norm === "success") {
      return { state: "completed", details: "Session completed successfully", reason: "Session completed successfully" };
    }
    if (norm === "failed" || norm === "error") {
      return { state: "failed", details: "Session failed", reason: "Session failed" };
    }
    if (norm === "running" || norm === "busy") {
      return { state: "running", details: "Session is running", reason: "Session is running" };
    }
    return { state: "idle", details: "Session is idle", reason: "Session is idle" };
  }
  const sessionId = session.id || session.sessionId || void 0;
  const updatedAt = session.updatedAt || session.lastActivityAt || void 0;
  const hasPendingPermissions = Array.isArray(session.pendingPermissions) && session.pendingPermissions.length > 0 || Array.isArray(session.permissionRequests) && session.permissionRequests.length > 0 || Array.isArray(session.permissions) && session.permissions.length > 0 || session.waitingForPermission === true || session.hasPendingPermissions === true || session.activity === "waiting-permission" || session.activity === "blocked-permission" || session.status === "waiting-permission" || session.status === "blocked-permission" || session.state === "waiting-permission" || session.state === "blocked-permission";
  if (hasPendingPermissions) {
    const permList = Array.isArray(session.pendingPermissions) ? session.pendingPermissions : Array.isArray(session.permissionRequests) ? session.permissionRequests : Array.isArray(session.permissions) ? session.permissions : [];
    const details2 = permList.length > 0 ? `Pending permissions: ${permList.map((p) => typeof p === "string" ? p : p.name || p.id || JSON.stringify(p)).join(", ")}` : session.reason || "Session waiting on tool permissions";
    return {
      sessionId,
      state: "blocked-permission",
      details: details2,
      reason: details2,
      updatedAt
    };
  }
  const hasPendingQuestions = Array.isArray(session.pendingQuestions) && session.pendingQuestions.length > 0 || Array.isArray(session.questions) && session.questions.some((q) => !q.answered && !q.completed) || session.waitingForQuestion === true || session.hasPendingQuestions === true || session.activity === "waiting-question" || session.activity === "blocked-question" || session.status === "waiting-question" || session.status === "blocked-question" || session.state === "waiting-question" || session.state === "blocked-question";
  if (hasPendingQuestions) {
    const qList = Array.isArray(session.pendingQuestions) ? session.pendingQuestions : Array.isArray(session.questions) ? session.questions.filter((q) => !q.answered && !q.completed) : [];
    const firstQ = qList[0];
    const details2 = firstQ ? `Pending question: ${typeof firstQ === "string" ? firstQ : firstQ.text || firstQ.question || JSON.stringify(firstQ)}` : session.reason || "Session waiting on user response";
    return {
      sessionId,
      state: "blocked-question",
      details: details2,
      reason: details2,
      updatedAt
    };
  }
  const isFailed = Boolean(session.error) || typeof session.exitCode === "number" && session.exitCode !== 0 || session.failed === true || session.status === "failed" || session.status === "error" || session.state === "failed" || session.state === "error" || session.activity === "failed" || session.activity === "error";
  if (isFailed) {
    let details2 = "Session failed";
    if (session.error) {
      details2 = typeof session.error === "object" ? session.error.message || JSON.stringify(session.error) : String(session.error);
    } else if (typeof session.exitCode === "number" && session.exitCode !== 0) {
      details2 = `Session process exited with error code ${session.exitCode}`;
    } else if (session.reason) {
      details2 = String(session.reason);
    }
    return {
      sessionId,
      state: "failed",
      details: details2,
      reason: details2,
      updatedAt
    };
  }
  const isCompleted = session.status === "completed" || session.status === "done" || session.status === "success" || session.state === "completed" || session.state === "done" || session.state === "success" || session.activity === "completed" || session.activity === "done" || session.completed === true || session.exitCode === 0;
  if (isCompleted) {
    const details2 = session.reason || "Session completed successfully";
    return {
      sessionId,
      state: "completed",
      details: details2,
      reason: details2,
      updatedAt
    };
  }
  const isRunning = session.status === "running" || session.status === "busy" || session.state === "running" || session.state === "busy" || session.activity === "running" || session.busy === true || session.active === true;
  if (isRunning) {
    const details2 = session.reason || "Session is actively running";
    return {
      sessionId,
      state: "running",
      details: details2,
      reason: details2,
      updatedAt
    };
  }
  const details = session.reason || "Session is idle";
  return {
    sessionId,
    state: "idle",
    details,
    reason: details,
    updatedAt
  };
}
var SessionWatcher = class {
  inspectSession(session) {
    return inspectSessionLiveness(session);
  }
};

// service/reconciler.ts
function reconcileTaskState(issue, session, lease) {
  const liveness = inspectSessionLiveness(session);
  if (!issue || typeof issue !== "object") {
    return {
      action: "poll",
      reason: "No issue data"
    };
  }
  const rawIssuePhase = issue.v2Metadata?.phase || issue.phase;
  const rawLeasePhase = lease?.phase;
  const issuePhase = typeof rawIssuePhase === "string" ? rawIssuePhase.trim().toLowerCase() : "";
  const leasePhase = typeof rawLeasePhase === "string" ? rawLeasePhase.trim().toLowerCase() : "";
  const rawAttention = issue.v2Metadata?.attention || issue.attention || "none";
  const currentAttention = typeof rawAttention === "string" ? rawAttention.trim().toLowerCase() : "none";
  const currentPhase = issuePhase || leasePhase;
  const isClosed = typeof issue.state === "string" && issue.state.toLowerCase() === "closed" || issue.closed === true || Boolean(issue.closed_at);
  if (isClosed || currentPhase === "done" || currentPhase === "archive") {
    return {
      action: "release",
      reason: "Task is complete"
    };
  }
  if (!currentPhase) {
    return {
      action: "poll",
      reason: "No issue data"
    };
  }
  if (currentPhase === "verification" || currentAttention !== "none") {
    return {
      action: "poll",
      reason: "Awaiting human verification"
    };
  }
  switch (liveness.state) {
    case "blocked-permission":
      return {
        action: "escalate",
        targetAttention: "needs-permission",
        reason: "Linked session blocked on tool permissions"
      };
    case "blocked-question":
      return {
        action: "escalate",
        targetAttention: "needs-decision",
        reason: "Linked session waiting for human response"
      };
    case "completed": {
      if (currentAttention === "none" && currentPhase === "exploration") {
        return {
          action: "advance",
          targetPhase: "planning",
          targetAttention: "needs-review",
          reason: "Worker completed execution cleanly"
        };
      }
      if (currentAttention === "none" && currentPhase === "execution") {
        return {
          action: "advance",
          targetPhase: "verification",
          targetAttention: "needs-review",
          reason: "Worker completed execution cleanly"
        };
      }
      return {
        action: "poll",
        reason: "Awaiting human review"
      };
    }
    case "failed": {
      let errReason = "unknown error";
      if (session?.error) {
        errReason = typeof session.error === "object" ? session.error.message || JSON.stringify(session.error) : String(session.error);
      } else if (liveness.details) {
        errReason = liveness.details;
      }
      return {
        action: "escalate",
        targetAttention: "needs-decision",
        reason: "Worker session failed or crashed: " + errReason
      };
    }
    case "running":
      return {
        action: "poll",
        reason: "Worker session actively progressing"
      };
    case "idle":
    default:
      return {
        action: "poll",
        reason: "Worker session is idle"
      };
  }
}
var CoordinatorReconciler = class {
  reconcile(issue, session, lease) {
    return reconcileTaskState(issue, session, lease);
  }
};

// service/main.ts
var SOCKET_TIMEOUT_ARMED = Symbol("socketTimeoutArmed");
var CoordinatorService = class {
  config;
  status = "stopped";
  timer = null;
  ownerId;
  heldLeases = /* @__PURE__ */ new Map();
  leaseStore;
  constructor(config, leaseStore) {
    this.config = loadCoordinatorConfig(config);
    this.leaseStore = leaseStore || new LeaseStore(void 0, this.config.leaseTtlMs);
    this.ownerId = `coordinator-${process.pid}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }
  getConfig() {
    return { ...this.config };
  }
  getStatus() {
    return this.status;
  }
  getLeaseStore() {
    return this.leaseStore;
  }
  getOwnerId() {
    return this.ownerId;
  }
  /**
   * Acquire a lease on behalf of this coordinator instance and track it so
   * clean shutdown can release it (PLAN-STAGE2B invariant 4).
   */
  async acquireLease(repo, issueNumber, bodySha, phase, ttlMs) {
    const result = await this.leaseStore.acquireLease(
      repo,
      issueNumber,
      this.ownerId,
      bodySha,
      phase,
      ttlMs ?? this.config.leaseTtlMs
    );
    if (result.acquired) {
      this.heldLeases.set(this.leaseStore.getLeaseKey(repo, issueNumber), {
        repo: repo.trim(),
        issueNumber: Number(issueNumber),
        ownerId: this.ownerId
      });
    }
    return result;
  }
  async start() {
    if (this.status === "running" || this.status === "starting") {
      return;
    }
    this.status = "starting";
    console.log("[Coordinator Service] ========================================");
    console.log("[Coordinator Service] Starting OpenChamber Task Coordinator");
    console.log(`[Coordinator Service] Host origin: ${this.config.hostOrigin}`);
    console.log(`[Coordinator Service] Poll interval: ${this.config.pollIntervalMs}ms`);
    console.log(`[Coordinator Service] Lease TTL: ${this.config.leaseTtlMs}ms`);
    console.log(`[Coordinator Service] Storage dir: ${this.config.storageDir}`);
    console.log(`[Coordinator Service] Dry run: ${this.config.dryRun}`);
    console.log("[Coordinator Service] ========================================");
    try {
      if (!fs3.existsSync(this.config.storageDir)) {
        fs3.mkdirSync(this.config.storageDir, { recursive: true });
      }
    } catch (err) {
      console.error(`[Coordinator Service] Failed to create storage dir ${this.config.storageDir}:`, err);
      this.status = "stopped";
      throw err;
    }
    try {
      await this.leaseStore.init();
    } catch (err) {
      console.error("[Coordinator Service] Failed to initialize lease store:", err);
      this.status = "stopped";
      throw err;
    }
    this.status = "running";
    this.startReconciliationLoop();
  }
  async stop() {
    if (this.status === "stopped" || this.status === "stopping") {
      return;
    }
    this.status = "stopping";
    console.log("[Coordinator Service] Stopping coordinator service...");
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    await this.releaseHeldLeases();
    this.status = "stopped";
    console.log("[Coordinator Service] Coordinator service stopped cleanly.");
  }
  startReconciliationLoop() {
    if (this.timer) {
      clearInterval(this.timer);
    }
    this.timer = setInterval(async () => {
      try {
        await this.reconcileOnce();
      } catch (err) {
        console.error("[Coordinator Service] Error in reconciliation tick:", err);
      }
    }, this.config.pollIntervalMs);
    void this.reconcileOnce().catch((err) => {
      console.error("[Coordinator Service] Error in initial reconciliation tick:", err);
    });
  }
  async reconcileOnce() {
    if (this.status !== "running") {
      return;
    }
    try {
      await this.leaseStore.pruneExpired();
    } catch (err) {
      console.error("[Coordinator Service] Error pruning expired leases:", err);
    }
    if (this.config.dryRun) {
    }
  }
  /**
   * Release every lease this instance holds on shutdown (PLAN-STAGE2B invariant 4):
   * tracked acquisitions plus any store lease still owned by this instance.
   * Other owners' leases are never touched (single-writer safety).
   */
  async releaseHeldLeases() {
    const pending = new Map(this.heldLeases);
    for (const lease of this.leaseStore.listActiveLeases()) {
      if (lease.ownerId === this.ownerId) {
        pending.set(this.leaseStore.getLeaseKey(lease.repo, lease.issueNumber), {
          repo: lease.repo,
          issueNumber: lease.issueNumber,
          ownerId: lease.ownerId
        });
      }
    }
    if (pending.size === 0) {
      return;
    }
    console.log(`[Coordinator Service] Releasing ${pending.size} held leases...`);
    for (const [key, entry] of pending) {
      try {
        await this.leaseStore.releaseLease(entry.repo, entry.issueNumber, entry.ownerId);
      } catch (err) {
        console.error(`[Coordinator Service] Failed to release lease ${key} on shutdown:`, err);
      }
    }
    this.heldLeases.clear();
  }
};
function authenticateRequest(authHeader, expectedToken) {
  if (!authHeader || typeof authHeader !== "string") return false;
  const match = /^Bearer\s+(\S+)$/.exec(authHeader.trim());
  if (!match) return false;
  const presentedToken = match[1];
  const expectedHash = crypto2.createHash("sha256").update(expectedToken, "utf8").digest();
  const presentedHash = crypto2.createHash("sha256").update(presentedToken, "utf8").digest();
  return crypto2.timingSafeEqual(expectedHash, presentedHash);
}
var MinuteWindow = class {
  stamps = [];
  limit;
  now;
  constructor(limit, now) {
    this.limit = limit;
    this.now = now;
  }
  take() {
    const now = this.now();
    while (this.stamps.length > 0 && now - this.stamps[0] >= 6e4) this.stamps.shift();
    if (this.stamps.length >= this.limit) return false;
    this.stamps.push(now);
    return true;
  }
};
var JSON_HEADERS = { "Content-Type": "application/json; charset=utf-8" };
var STATUS_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff"
};
function sendJson(res, status, body, headers = JSON_HEADERS, extra = {}) {
  res.writeHead(status, { ...headers, ...extra });
  res.end(JSON.stringify(body));
}
function readBody(req, res, cap, onBody) {
  let bytes = 0;
  let settled = false;
  const chunks = [];
  req.on("data", (chunk) => {
    if (settled) return;
    bytes += chunk.length;
    if (bytes > cap) {
      settled = true;
      if (!res.headersSent) sendJson(res, 413, { error: "Payload Too Large" });
      req.destroy();
      return;
    }
    chunks.push(chunk);
  });
  req.on("end", () => {
    if (settled) return;
    settled = true;
    onBody(Buffer.concat(chunks).toString("utf8"));
  });
  req.on("error", () => {
    settled = true;
  });
}
function createCoordinatorHostServer(token, getStatus, options = {}) {
  const MAX_BODY_BYTES = 65536;
  const snapshotStore = options.snapshotStore ?? new SnapshotStore();
  const now = options.now ?? Date.now;
  const marks = options.marks;
  const decisions = options.decisions ?? new DecisionStore({ now });
  const snapshotAttempts = new MinuteWindow(30, now);
  const snapshotWrites = new MinuteWindow(10, now);
  const statusReads = new MinuteWindow(240, now);
  const decisionReads = new MinuteWindow(120, now);
  const answerAttempts = new MinuteWindow(30, now);
  const server = http.createServer((req, res) => {
    const socket = req.socket;
    if (!socket[SOCKET_TIMEOUT_ARMED]) {
      socket[SOCKET_TIMEOUT_ARMED] = true;
      socket.setTimeout(15e3, () => {
        socket.destroy();
      });
    }
    if (req.headers.origin !== void 0) {
      res.writeHead(403, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ error: "Forbidden" }));
      req.resume();
      return;
    }
    const authHeader = req.headers.authorization;
    if (!authenticateRequest(authHeader, token)) {
      res.writeHead(401, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ error: "Unauthorized" }));
      req.resume();
      return;
    }
    const contentLength = req.headers["content-length"] ? Number(req.headers["content-length"]) : null;
    if (contentLength !== null && (!Number.isSafeInteger(contentLength) || contentLength > MAX_BODY_BYTES)) {
      res.writeHead(413, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ error: "Payload Too Large" }));
      req.destroy();
      return;
    }
    const url = new URL(req.url || "/", "http://127.0.0.1");
    const normalizedPath = url.pathname.replace(/\/+$/, "") || "/";
    if (normalizedPath === "/health") {
      if (req.method === "GET") {
        if (getStatus && getStatus() !== "running") {
          res.writeHead(503, { "Content-Type": "application/json; charset=utf-8" });
          res.end(JSON.stringify({ error: "Service Unavailable" }));
          return;
        }
        res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
        res.end(JSON.stringify({ status: "ok", service: "task-coordinator" }));
        return;
      } else {
        res.writeHead(405, { "Content-Type": "application/json; charset=utf-8" });
        res.end(JSON.stringify({ error: "Method Not Allowed" }));
        req.resume();
        return;
      }
    }
    if (normalizedPath === "/status") {
      if (req.method !== "GET") {
        sendJson(res, 405, { error: "Method Not Allowed" });
        req.resume();
        return;
      }
      if (!statusReads.take()) {
        sendJson(res, 429, { error: "Too Many Requests" }, JSON_HEADERS, { "Retry-After": "60" });
        req.resume();
        return;
      }
      const directory = url.searchParams.get("directory");
      const locale = url.searchParams.get("locale");
      marks?.noteLocale(locale);
      sendJson(res, 200, buildStatusView(snapshotStore.get(directory), locale, now()), STATUS_HEADERS);
      req.resume();
      return;
    }
    if (normalizedPath === "/snapshot") {
      if (req.method !== "POST") {
        sendJson(res, 405, { error: "Method Not Allowed" });
        req.resume();
        return;
      }
      if (!snapshotAttempts.take()) {
        sendJson(res, 429, { error: "Too Many Requests" }, JSON_HEADERS, { "Retry-After": "60" });
        req.resume();
        return;
      }
      const contentType = String(req.headers["content-type"] || "").split(";")[0].trim().toLowerCase();
      if (contentType !== "application/json") {
        sendJson(res, 415, { error: "Unsupported Media Type" });
        req.resume();
        return;
      }
      readBody(req, res, SNAPSHOT_MAX_BYTES, (body) => {
        const parsed = parseSnapshotBody(body, now());
        if (!parsed.ok) {
          sendJson(res, 400, { error: parsed.reason });
          return;
        }
        if (!snapshotWrites.take()) {
          sendJson(res, 429, { error: "Too Many Requests" }, JSON_HEADERS, { "Retry-After": "60" });
          return;
        }
        snapshotStore.set(parsed.snapshot);
        decisions.registerProject(parsed.snapshot.directory);
        res.writeHead(204);
        res.end();
      });
      return;
    }
    if (normalizedPath === "/decisions") {
      if (req.method !== "GET") {
        sendJson(res, 405, { error: "Method Not Allowed" });
        req.resume();
        return;
      }
      if (!decisionReads.take()) {
        sendJson(res, 429, { error: "Too Many Requests" }, JSON_HEADERS, { "Retry-After": "60" });
        req.resume();
        return;
      }
      sendJson(res, 200, decisions.list(), STATUS_HEADERS);
      req.resume();
      return;
    }
    if (normalizedPath === "/decision/answer") {
      if (req.method !== "POST") {
        sendJson(res, 405, { error: "Method Not Allowed" });
        req.resume();
        return;
      }
      if (!answerAttempts.take()) {
        sendJson(res, 429, { error: "Too Many Requests" }, JSON_HEADERS, { "Retry-After": "60" });
        req.resume();
        return;
      }
      const contentType = String(req.headers["content-type"] || "").split(";")[0].trim().toLowerCase();
      if (contentType !== "application/json") {
        sendJson(res, 415, { error: "Unsupported Media Type" });
        req.resume();
        return;
      }
      readBody(req, res, MAX_BODY_BYTES, (body) => {
        let parsed;
        try {
          parsed = JSON.parse(body);
        } catch {
          sendJson(res, 400, { v: 1, code: "ANSWER_INVALID" });
          return;
        }
        if (Object(parsed) !== parsed || Array.isArray(parsed)) {
          sendJson(res, 400, { v: 1, code: "ANSWER_INVALID" });
          return;
        }
        void decisions.answer(parsed).then((result) => sendJson(res, result.status, result.body, STATUS_HEADERS)).catch(() => sendJson(res, 502, { v: 1, code: "UNKNOWN" }, STATUS_HEADERS));
      });
      return;
    }
    if (normalizedPath === SESSION_EVENTS_PATH) {
      if (req.method !== "POST") {
        sendJson(res, 405, { error: "Method Not Allowed" });
        req.resume();
        return;
      }
      readBody(req, res, MAX_BODY_BYTES, (body) => {
        const event = readSessionEvent(body);
        if (!event) {
          sendJson(res, 400, { ok: false, error: "invalid_session_event" });
          return;
        }
        sendJson(res, 200, { ok: true });
        marks?.handleEvent(event);
        decisions.handleEvent(event);
      });
      return;
    }
    sendJson(res, 404, { error: "Not Found" });
    req.resume();
  });
  return server;
}
function isDirectExecution() {
  if (!process.argv[1] || !import.meta.url) return false;
  try {
    const entryPath = fileURLToPath(import.meta.url);
    if (process.argv[1] === entryPath) return true;
    try {
      if (fs3.realpathSync(process.argv[1]) === entryPath) return true;
    } catch {
    }
  } catch {
    return false;
  }
  return false;
}
async function startHostServiceServer() {
  const { port, token } = validateServiceHostEnv();
  const coordinatorService = new CoordinatorService();
  const snapshotStore = new SnapshotStore();
  const serviceHost = createHostClient(process.env);
  const decisions = new DecisionStore({ host: serviceHost });
  const marks = new SessionMarks(serviceHost, {
    // One poll serves both features: the marks loop already asks for the status
    // of every waiting session, and the decision store reads the same answer.
    onStatus: (sessionId, status) => decisions.observeStatus(sessionId, status)
  });
  const server = createCoordinatorHostServer(token, () => coordinatorService.getStatus(), {
    snapshotStore,
    marks,
    decisions
  });
  let isShuttingDown = false;
  const shutdown = async (signal) => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    console.log(`[Coordinator Service] Received ${signal}, initiating graceful shutdown...`);
    const safetyTimer = setTimeout(() => {
      console.warn("[Coordinator Service] Graceful shutdown deadline exceeded; forcing exit.");
      server.closeAllConnections?.();
      process.exit(1);
    }, 3500);
    safetyTimer.unref();
    const closeServerPromise = new Promise((resolve) => {
      server.close(() => resolve());
    });
    server.closeIdleConnections?.();
    try {
      marks.stop();
      await Promise.all([
        coordinatorService.stop(),
        closeServerPromise
      ]);
    } catch (err) {
      console.error("[Coordinator Service] Error during shutdown:", err);
    } finally {
      clearTimeout(safetyTimer);
      process.exit(0);
    }
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  server.on("error", (err) => {
    console.error("[Coordinator Service] Server error:", err);
    process.exit(1);
  });
  try {
    await coordinatorService.start();
  } catch (err) {
    console.error("[Coordinator Service] Fatal startup error:", err);
    process.exit(1);
  }
  try {
    await new Promise((resolve, reject) => {
      server.listen(port, "127.0.0.1", () => {
        console.log(`[Coordinator Service] Host adapter listening on http://127.0.0.1:${port}`);
        resolve();
      });
      server.once("error", reject);
    });
  } catch (err) {
    console.error("[Coordinator Service] Server bind error:", err);
    await coordinatorService.stop().catch(() => {
    });
    process.exit(1);
  }
  void serviceHost.setInstructions(null, TASK_BOARD_INSTRUCTIONS).catch(() => {
    console.warn("[Coordinator Service] Board instructions were not installed; the extension may not be approved yet.");
  });
}
if (isDirectExecution()) {
  startHostServiceServer().catch((err) => {
    console.error("[Coordinator Service] Fatal startup error:", err);
    process.exit(1);
  });
}
export {
  CLAMP,
  COUNT_MAX,
  CasManager,
  CoordinatorReconciler,
  CoordinatorService,
  DECISIONS_BODY_MAX,
  DECISIONS_MAX,
  DECISION_MESSAGE_MAX,
  DECISION_STALENESS_MS,
  DECISION_TITLE_MAX,
  DECISION_TOMBSTONES_MAX,
  DEFAULT_DRY_RUN,
  DEFAULT_HOST_ORIGIN,
  DEFAULT_LEASE_TTL_MS,
  DEFAULT_POLL_INTERVAL_MS,
  DEFAULT_STORAGE_DIR,
  DecisionStore,
  FORM_MAX_CUSTOM,
  FORM_MAX_DESCRIPTION,
  FORM_MAX_FIELDS,
  FORM_MAX_OPTIONS,
  FORM_MAX_TITLE,
  HOST_CALLBACK_URL_ENV,
  HostCallError,
  LINKED_MAX,
  LeaseStore,
  MARK_CHANGES_PER_MINUTE,
  MARK_MAX,
  MARK_POLL_MAX_MS,
  MARK_POLL_MS,
  MARK_TEXT,
  SERVICE_HOST_PATH,
  SERVICE_HOST_TIMEOUT_MS,
  SESSION_EVENTS_PATH,
  SESSION_EVENTS_WIRE_VERSION,
  SESSION_EVENT_TYPES,
  SNAPSHOT_MAX_AGE_MS,
  SNAPSHOT_MAX_BYTES,
  SNAPSHOT_MAX_FUTURE_MS,
  STALE_MS,
  SessionMarks,
  SessionWatcher,
  SnapshotStore,
  TASK_BOARD_INSTRUCTIONS,
  TaskClaimEngine,
  ageNoteText,
  authenticateRequest,
  buildStatusView,
  claimPilotTask,
  clampFormFields,
  clampText,
  computeIssueSha,
  conditionHolds,
  createCoordinatorHostServer,
  createHostClient,
  cutText,
  formIsAnswerable,
  formIsComplete,
  getDefaultLeasesFilePath,
  hasForbiddenText,
  inspectSessionLiveness,
  isFrenchLocale,
  isTaskEligibleForPilot,
  loadCoordinatorConfig,
  normalizeDirectory,
  normalizeLinked,
  parseSnapshotBody,
  readSessionEvent,
  reconcileTaskState,
  resolveLeaseStorageDir,
  resolveStorageDir,
  startHostServiceServer,
  topValue,
  validateFormAnswer,
  validateServiceHostEnv,
  verifyIssueCas,
  visibleFieldKeys
};
