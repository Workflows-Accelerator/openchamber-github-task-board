# Stage 2B Implementation Plan: Host Runtime Probing & Background Coordinator Pilot

Date: 2026-10-23
Methodology: Doubt-Driven Development (`$doubt-driven-development`)
Base Branch: `feat/v2-binding-and-ratelimit`
Worktree: `.worktrees/team-dev-stage2b-pilot-coordinator`
Feature Branch: `feat/stage2b-pilot-coordinator`

---

## 1. Context & Objectives
In Stage 1 and Stage 2A, we delivered:
- The 4-axis orthogonal state model (`phase`, `attention`, `liveness`, `dependencyState`).
- Section-scoped markdown parsing (`parseAcceptanceCriteria`, `parseSubtasks`).
- Interactive Attention Action Queues (`needs-decision`, `needs-permission`, `needs-review`), alert-only card badges, and drawer Acceptance Criteria checklist with line-index precision write-back.
- 414 automated tests passing green (100%).

Stage 2B implements the **Single-Writer Pilot Coordinator** running as an OpenChamber background host service:
- Probing confirmed that OpenChamber extensions declare persistent background services via:
  `"openchamber.contributes.service": { "entry": "service/main.js", "runtime": "host" }`
  (empirically verified via `chambervoice`).
- The coordinator runs in Node.js on the host independently of panel iframe mounts/unmounts.
- Operates under strict Doubt-Driven Development guardrails:
  1. **Storage Isolation:** Operational leases, heartbeat timestamps, and attempt receipts live in extension storage (`.openchamber-data/task-coordinator/leases.json`), completely avoiding SQLite/opencode.db contamination.
  2. **Single-Writer Lease Management:** Prevents multiple coordinator loops or split-brain runners from competing for the same task. Leases have strict TTL (e.g. 60s) with active heartbeat renewal.
  3. **Compare-And-Swap (CAS) Pre-Flight Check:** Emulates atomic updates via SHA-256 body hashes before any GitHub Issue mutation. If the remote SHA diverged from the claimed SHA, the write aborts and flags an alert (`needs-decision` conflict).
  4. **Opt-In Pilot Scope:** Only claims tasks with explicit pilot activation (`phase:exploration` / `phase:execution` or coordinator tag), preventing runaway loops on legacy or untagged tasks.
  5. **Session Liveness Reconciliation:** Inspects linked OpenChamber agent sessions; detects when a worker session finishes, fails, or pauses on a permission/question; and cleanly updates the task attention/phase state.

---

## 2. Invariants & Guardrails
1. **Never Clobber Remote Edits:** Every issue write MUST verify the target issue body's SHA-256 against the claimed baseline. If it changed, abort write and log conflict.
2. **Zero In-Memory Drift:** Heartbeats and leases must be atomically serialized to disk with backup fallback.
3. **Graceful Panel Independence:** The service must be fully operational without requiring any open webview panel.
4. **Clean Shutdown:** On SIGINT/SIGTERM, all held leases must be released or marked expired.
5. **No Master Pushes Without Human Gate:** Feature branch `feat/stage2b-pilot-coordinator` pushes to origin autonomously; `master` updates remain strictly gated behind human L5 review.

---

## 3. Decomposed Task Breakdown

### Task 206: Host Service Architecture & Build Pipeline
- **Files:** `package.json`, `tsconfig.json`, `service/types.ts`, `service/config.ts`, `service/main.ts`
- **Scope:**
  - Update `package.json` to declare `openchamber.contributes.service` (`service/main.js`, runtime: `host`).
  - Add `build:service` script (`esbuild service/main.ts --bundle --platform=node --format=esm --target=node20 --packages=external --outfile=service/main.js`).
  - Create `service/types.ts` defining `CoordinatorConfig`, `TaskLease`, `ClaimResult`, `ReconciliationAction`, `SessionLivenessState`.
  - Create `service/config.ts` resolving host origin, token, port, and storage paths (`.openchamber-data/task-coordinator/`).

### Task 207: Single-Writer Lease Engine & SHA-256 CAS Pre-Flight
- **Files:** `service/lease-store.ts`, `service/cas.ts`
- **Scope:**
  - Implement `LeaseStore` in `service/lease-store.ts`:
    - Acquire lease with owner ID, lease TTL (default 60s), and heartbeat timestamp.
    - Renew heartbeat periodically.
    - Detect expired leases and cleanly evict or reclaim.
    - Write to `.openchamber-data/task-coordinator/leases.json` with atomic rename.
  - Implement `CasManager` in `service/cas.ts`:
    - Compute SHA-256 hash of issue bodies.
    - Compare target issue SHA before applying updates.
    - Safe conflict detection and escalation.

### Task 208: Task Claiming Engine & Session Liveness Watcher
- **Files:** `service/task-claim.ts`, `service/reconciler.ts`
- **Scope:**
  - Implement `TaskClaimEngine`:
    - Filter candidate issues: only opt-in tasks in active workflow phases (`exploration`, `execution`).
    - Guard against claiming tasks already locked by active leases.
    - Acquire lease and record baseline body SHA.
  - Implement `CoordinatorReconciler`:
    - Inspect linked agent session status (running, completed, failed, blocked).
    - Map session states to task 4-axis metadata transitions:
      - Session blocked on permission -> set `attention: 'needs-permission'`.
      - Session blocked on question -> set `attention: 'needs-decision'`.
      - Session completed successfully -> advance to `phase: 'verification'`, `attention: 'needs-review'`.
      - Session errored/failed -> mark `attention: 'needs-decision'`, record failure reason.

### Task 209: Test Suite, Service Build & Shipped Parity
- **Files:** `test/stage2b-pilot-coordinator.test.js`, `service/main.js`, `package.json`
- **Scope:**
  - Author comprehensive test suite `test/stage2b-pilot-coordinator.test.js`:
    - Manifest service declaration validation.
    - Lease store acquisition, TTL expiration, heartbeat renewal, and atomic disk persistence.
    - SHA-256 CAS pre-flight verification (happy path, remote drift conflict abort).
    - Single-writer exclusivity (second worker rejected when task is leased).
    - Session reconciliation state transitions.
  - Compile `service/main.js` via `npm run build:service`.
  - Run full test suite: all 414 existing tests + Stage 2B tests pass (target: >= 430 tests).

### Task 210: Hostile Adversarial Review (L4)
- **Scope:**
  - Adversarial audit of lease expiration races, filesystem permission failures, stale lockfile recovery, concurrent claiming collisions, and zombie session detection.
  - Remediate all findings until PROCEED verdict.

### Task 211: Integration Merge of Stage 2B & Origin Push
- **Scope:**
  - Merge `feat/stage2b-pilot-coordinator` into `feat/v2-binding-and-ratelimit`.
  - Rebuild all bundles (`panel/main.js` and `service/main.js`).
  - Run full test suite.
  - Remove feature worktree.
  - Push tracking branches to GitHub origin.
  - Present final completion walkthrough to user.
