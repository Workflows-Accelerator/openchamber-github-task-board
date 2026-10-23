# Task 210 Output: Stage 2B Hostile Review

## Two-Verdict Summary
- **Spec Compliance:** `PARTIAL` (Core primitives and single-writer lease engine implemented; critical gaps identified in reconciliation idempotency, CRLF normalization, and opt-in scoping)
- **Quality:** `NEEDS-FIXES` (Must remediate adversarial blockers ADV-2B-01, ADV-2B-02, and ADV-2B-04 prior to unattended issue body mutation in production)

---

## Verdict: PROCEED-WITH-CONDITIONS

The Stage 2B implementation successfully establishes the OpenChamber host background service architecture (`openchamber.contributes.service`), atomic file-backed single-writer lease engine, SHA-256 CAS pre-flight verification, session liveness watcher, and 449 passing tests (up from 414 in Stage 2A).

However, hostile adversarial stress-testing identified 3 critical defects that would cause runtime failures or unintended mutations if unattended auto-mutation were enabled against live GitHub repositories:
1. **Reconciliation Ping-Pong & Review Bypass (ADV-2B-01):** Completed sessions cause repeated state mutations that skip human verification directly into `done`, then bounce back to `verification`.
2. **False CAS Conflicts on CRLF Newlines (ADV-2B-02):** Un-normalized line endings in SHA-256 digests treat identical issue bodies as divergent when submitted via GitHub web UI vs POSIX runtimes.
3. **Over-Broad Pilot Claiming (ADV-2B-04):** Any legacy issue with `status:in-progress` is claimed by the pilot coordinator even without explicit pilot activation or v2 labels.

Because the current pilot service (`service/main.ts`) runs a safe tick loop that only prunes expired leases and does not yet execute unattended GitHub writes, the branch is structurally sound to proceed to integration staging **on the condition** that the identified defects are remediated before live issue mutation is enabled.

---

## Adversarial Findings Matrix

| ID | Severity | File:Line | Description | Resolution / Condition |
| :--- | :--- | :--- | :--- | :--- |
| **ADV-2B-01** | **Catastrophic** | `service/reconciler.ts:178-200` | **Non-Idempotent Reconciliation Loop:** When a worker session completes on a task in `execution`, Tick 1 advances it to `verification`. On Tick 2, because the session remains completed in history and the issue is in `verification`, `reconcileTaskState` advances the task to `done` without human review! On Tick 3, `done` is advanced back to `verification`. | Guard reconciliation: If task is in `verification` with `needs-review` or in `done`, return `{ action: 'poll', reason: 'Awaiting human verification' }`. Only advance from `execution` when not already in `verification`. |
| **ADV-2B-02** | **Catastrophic** | `service/cas.ts:12-15`<br>`service/task-claim.ts:8-11` | **CRLF vs LF Divergence False Conflicts:** `computeIssueSha` hashes raw string bytes without normalizing `\r\n` to `\n`. Markdown edited via GitHub Web UI on Windows/macOS or fetched via REST API with CRLF will mismatch LF baselines (`47e54e...` vs `9140dd...`), causing spurious CAS conflict aborts. | Normalize newlines: `(body ?? '').replace(/\r\n/g, '\n')` prior to SHA-256 digest computation. Remove duplicated function in `task-claim.ts`. |
| **ADV-2B-03** | **Moderate** | `service/lease-store.ts:140-176` | **Cross-Process Concurrency Race:** In-process serialization (`this.queue`) protects single-instance callers, but two independent processes/instances calling `acquireLease` concurrently will both read an empty store and both return `{ acquired: true }`. The last writer's rename erases the first writer's lease. | Single-host daemon architecture isolates the OpenChamber pilot; multi-process runners must implement atomic lockfile directories (`leases.lock/`) or file descriptor locks. |
| **ADV-2B-04** | **Moderate** | `service/task-claim.ts:61-64` | **Unintended Legacy Task Hijacking:** `isTaskEligibleForPilot` returns true if `hasPilotLabel || isEligiblePhase`. Any untagged legacy issue with label `status:in-progress` projects to `phase: 'execution'`, causing the coordinator to claim tasks belonging to human developers. | Require explicit opt-in: `hasPilotLabel || (isEligiblePhase && issue.v2Metadata?.isExplicitV2 === true)`. |
| **ADV-2B-05** | **Moderate** | `service/lease-store.ts:169, 215, 240` | **In-Memory State Drift on Disk Failure:** `this.leases` is mutated in-memory *before* `await this.saveToDisk()`. If disk write fails (e.g. disk full `ENOSPC`, permission `EACCES`), in-memory state diverges permanently from disk. | Rollback in-memory mutation or mutate only after `saveToDisk()` resolves. |
| **ADV-2B-06** | **Low** | `service/lease-store.ts:101-105` | **Corrupted Store Overwritten Without Backup:** `init()` catches `JSON.parse` syntax errors and overwrites `leases.json` with an empty state immediately, destroying forensic lease records. | Rename corrupted file to `leases.json.corrupted.<timestamp>.bak` before re-initializing. |
| **ADV-2B-07** | **Low** | `service/reconciler.ts:6-144`<br>`service/session-watcher.ts:13-203` | **Duplicate Session Inspection Logic:** `reconciler.ts` reimplements a 140-line private `inspectSession` instead of reusing `inspectSessionLiveness` from `session-watcher.ts`. | Deduplicate: import `inspectSessionLiveness` into `reconciler.ts`. |
| **ADV-2B-08** | **Low** | `service/lease-store.ts:144, 163` | **Wall-Clock Skew & Absence of Fencing Tokens:** Uses `Date.now()`. Positive NTP jumps expire active leases prematurely; negative jumps prolong them. No epoch/fencing tokens exist to invalidate writes from expired workers. | Document NTP sensitivity and add generation epoch to `TaskLease`. |

---

## Edge Case Verification

### 1. Corrupted `leases.json` recovery: PASS
- **Observed Behavior:** `LeaseStore.init()` safely catches `SyntaxError` from corrupted JSON files and resets internal state to `{ version: 1, leases: {} }` without crashing or entering infinite restart loops.
- **Verification:** Empirically verified via `test('Part 6: Store recovers gracefully from corrupted disk file')`.
- **Residual:** Corrupted files are currently overwritten without a forensic `.bak` snapshot (logged as ADV-2B-06).

### 2. CRLF vs LF SHA-256 consistency: FAIL
- **Observed Behavior:** `computeIssueSha("Line 1\r\nLine 2")` yields `47e54e3f...` while `computeIssueSha("Line 1\nLine 2")` yields `9140ddc6...`. Calling `verifyIssueCas(lf, shaCrlf)` returns `match: false`.
- **Impact:** False conflict detection and aborts on cross-platform or GitHub Web UI edits.
- **Remediation Condition:** Add `\r\n` -> `\n` normalization before digest computation.

### 3. Concurrent claiming collisions: FAIL (Multi-Instance) / PASS (In-Process)
- **Observed Behavior:** In-process concurrency is safely serialized via `this.queue` (verified by 20-worker test). However, two independent `LeaseStore` instances calling `acquireLease` concurrently both receive `{ acquired: true }` on issue #100, and the second rename overwrites the disk file.
- **Impact:** Split-brain claiming if multiple instances run simultaneously.
- **Remediation Condition:** Safe for single-process OpenChamber host service pilot; file-level locking required for multi-daemon scaling.

### 4. Clock skew & TTL monotonicity: PASS-WITH-RESERVATION
- **Observed Behavior:** `existing.expiresAt > now` enforces strict TTL expiration for steady monotonic progression.
- **Residual:** Wall-clock `Date.now()` is subject to NTP clock jumps, and lack of fencing tokens means an expired worker could theoretically attempt a late write if CAS does not detect divergence.

### 5. Zombie session reconciliation: FAIL
- **Observed Behavior:** Missing idempotency in `reconcileTaskState`. When an agent session finishes:
- Step 1: `execution` -> `verification`
- Step 2: `verification` -> `done` (skips human review!)
- Step 3: `done` -> `verification` (infinite flapper loop)
Additionally, null/deleted sessions are classified as `idle`, causing indefinite polling rather than dead-session escalation.
- **Remediation Condition:** Idempotency guard and explicit session-completion handling required before live mutation loop is activated.

---

## Test Verification

- **Node Test Runner Command:** `npm run typecheck && npm run build && node --test test/stage2b-pilot-coordinator.test.js && node --test`
- **Total Tests Passed:** 449 / 449 (100% PASS, 0 failures, 0 skipped)
- **Stage 2B Suite Coverage:** 35 dedicated unit and integration tests covering manifest declarations, config resolution, CAS digests, single-writer acquisition, mutual exclusion, heartbeat renewal, TTL expiration, release, atomic disk persistence, opt-in filtering, session watcher classifications, and reconciler state transitions.
- **Zero Regressions:** All 414 existing tests across Kanban, Attention Views, acceptance criteria checklists, markdown parsing, and git worktrees pass without modification.

---

## Conditions for Integration Merge (Task 211)

To maintain architectural integrity and prevent regressions in production, the integration merge of `feat/stage2b-pilot-coordinator` into `feat/v2-binding-and-ratelimit` may proceed under the following binding conditions:

1. **Gate Live Mutation Behind Remediations:** Unattended background issue body mutations and label transitions must remain inactive in `service/main.ts` until ADV-2B-01 (reconciliation idempotency) and ADV-2B-02 (CRLF normalization) are patched.
2. **Strict Opt-In Enforcement:** Update `isTaskEligibleForPilot` to require `hasPilotLabel || (isEligiblePhase && issue.v2Metadata?.isExplicitV2 === true)` so un-migrated human tasks in `status:in-progress` are never claimed.
3. **Single Host Daemon Invariant:** Ensure only a single instance of `openchamber.contributes.service` is spawned by the host runtime, honoring the single-writer coordinator guarantee.
