// service/main.ts
import fs3 from "node:fs";
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
var LeaseStore = class {
  filePath;
  defaultTtlMs;
  leases = {};
  queue = Promise.resolve();
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
   */
  async init() {
    return this.runExclusive(async () => {
      const dir = path2.dirname(this.filePath);
      await fs2.promises.mkdir(dir, { recursive: true });
      try {
        const raw = await fs2.promises.readFile(this.filePath, "utf8");
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed.leases === "object" && parsed.leases !== null) {
          this.leases = { ...parsed.leases };
        } else {
          this.leases = {};
          await this.saveToDisk();
        }
      } catch (err) {
        if (err.code === "ENOENT") {
          this.leases = {};
          await this.saveToDisk();
        } else {
          if (err instanceof SyntaxError || err?.name === "SyntaxError") {
            try {
              const backupPath = `${this.filePath}.corrupted.${Date.now()}.bak`;
              await fs2.promises.copyFile(this.filePath, backupPath);
            } catch {
            }
          }
          this.leases = {};
          await this.saveToDisk();
        }
      }
    });
  }
  /**
   * Reload state from disk to synchronize with any external writes.
   */
  async loadFromDisk() {
    try {
      const raw = await fs2.promises.readFile(this.filePath, "utf8");
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.leases === "object" && parsed.leases !== null) {
        this.leases = { ...parsed.leases };
      }
    } catch (err) {
      if (err.code !== "ENOENT") {
      }
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
   */
  async saveToDisk() {
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

// service/cas.ts
import crypto from "node:crypto";
function computeIssueSha(body) {
  const content = (body ?? "").replace(/\r\n/g, "\n");
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
      const rawIssuePhase = issue?.v2Metadata?.phase || issue?.phase;
      const rawLeasePhase = lease?.phase;
      const issuePhase = typeof rawIssuePhase === "string" ? rawIssuePhase.trim().toLowerCase() : "";
      const leasePhase = typeof rawLeasePhase === "string" ? rawLeasePhase.trim().toLowerCase() : "";
      const rawAttention = issue?.v2Metadata?.attention || issue?.attention || "none";
      const currentAttention = typeof rawAttention === "string" ? rawAttention.trim().toLowerCase() : "none";
      if (issuePhase === "done" || leasePhase === "done") {
        return {
          action: "release",
          reason: "Task is complete"
        };
      }
      if (issuePhase === "verification" || leasePhase === "verification" || currentAttention === "needs-review") {
        return {
          action: "poll",
          reason: "Awaiting human review"
        };
      }
      const currentPhase = leasePhase || issuePhase || "exploration";
      if (currentPhase === "exploration") {
        return {
          action: "advance",
          targetPhase: "planning",
          targetAttention: "needs-review",
          reason: "Worker completed execution cleanly"
        };
      }
      if (currentPhase === "execution") {
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
var CoordinatorService = class {
  config;
  status = "stopped";
  timer = null;
  heldLeases = /* @__PURE__ */ new Set();
  leaseStore;
  constructor(config, leaseStore) {
    this.config = loadCoordinatorConfig(config);
    this.leaseStore = leaseStore || new LeaseStore(void 0, this.config.leaseTtlMs);
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
  async releaseHeldLeases() {
    if (this.heldLeases.size === 0) {
      return;
    }
    console.log(`[Coordinator Service] Releasing ${this.heldLeases.size} held leases...`);
    this.heldLeases.clear();
  }
};
if (process.argv[1] && import.meta.url) {
  try {
    const currentFilePath = fileURLToPath(import.meta.url);
    if (process.argv[1] === currentFilePath) {
      const service = new CoordinatorService();
      const shutdown = async (signal) => {
        console.log(`[Coordinator Service] Received ${signal}, initiating graceful shutdown...`);
        try {
          await service.stop();
        } catch (err) {
          console.error("[Coordinator Service] Error during shutdown:", err);
        } finally {
          process.exit(0);
        }
      };
      process.on("SIGINT", () => void shutdown("SIGINT"));
      process.on("SIGTERM", () => void shutdown("SIGTERM"));
      service.start().catch((err) => {
        console.error("[Coordinator Service] Fatal startup error:", err);
        process.exit(1);
      });
    }
  } catch {
  }
}
export {
  CasManager,
  CoordinatorReconciler,
  CoordinatorService,
  DEFAULT_DRY_RUN,
  DEFAULT_HOST_ORIGIN,
  DEFAULT_LEASE_TTL_MS,
  DEFAULT_POLL_INTERVAL_MS,
  DEFAULT_STORAGE_DIR,
  LeaseStore,
  SessionWatcher,
  TaskClaimEngine,
  claimPilotTask,
  computeIssueSha,
  getDefaultLeasesFilePath,
  inspectSessionLiveness,
  isTaskEligibleForPilot,
  loadCoordinatorConfig,
  reconcileTaskState,
  resolveLeaseStorageDir,
  resolveStorageDir,
  verifyIssueCas
};
