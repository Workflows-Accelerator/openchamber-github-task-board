# Task 210c Output: Remediation Hostile Review (Second Pass)

Scope: commit `d6050be` on `feat/stage2b-pilot-coordinator` (plus doc commit `2f0df80`). Second-pass review of the Task 210b remediation fixes only. All findings below were empirically probed (scripts under `/tmp/opencode/probe-*.mjs`), not read off the diff.

## Verdict: PROCEED-WITH-CONDITIONS

The three adversarial fixes (ADV-2B-01 idempotency, ADV-2B-02 CRLF normalization, ADV-2B-04 opt-in scoping) hold on their primary paths and no regression was found in the shipped bundle or test suite. However, hostile probing of the fixes themselves found the ADV-2B-01 guard is scoped too narrowly (terminal/verification protection exists only in the `completed` liveness branch), the ADV-2B-06 backup fix is dead code in the shipped service and still destroys lease data on non-SyntaxError failures, and ADV-2B-02 leaves bare-`\r` and trailing-whitespace bodies as false-conflict sources. Conditions below must land before unattended GitHub mutation is enabled (same gate as Task 210).

## Findings Matrix

| ID | Severity | File:Line | Description | Resolution / Residual |
| :--- | :--- | :--- | :--- | :--- |
| **ADV-2C-01** | **Moderate** | `service/reconciler.ts:23-37, 90-105` (vs guard at `:47-61`) | **Terminal/verification guard only in `completed` branch.** The `done`/`verification`/`needs-review` guards apply only to `completed` sessions. Probed: `failed`, `blocked-permission`, `blocked-question` sessions on a task in `verification` return `escalate` and overwrite `needs-review` (human review flag destroyed); the same on `done`/`archive` tasks mutate terminal issues to `attention: needs-decision` / `needs-permission`, re-entering them into attention views. Attention can still flap between `needs-decision` and `needs-review` as session liveness alternates (phase no longer flaps). | Move the `done`/`archive`/`verification` guard above the `switch` so it applies to every liveness state, not just `completed`. Residual of ADV-2B-01 (incomplete). |
| **ADV-2C-02** | **Moderate** | `service/reconciler.ts:64` + `service/lease-store.ts:166-175` | **Stale lease phase outranks live issue phase.** `currentPhase = leasePhase || issuePhase` prefers the lease's claim-time snapshot over the issue's current metadata; `lease-store` never updates `phase` after acquire. Probed: issue `planning` + lease `execution` + completed session -> `advance` to `verification` (skips the human execution gate); issue `execution` + lease `done` -> `release` on a live task. | Prefer `issuePhase` over `leasePhase`, or refresh `lease.phase` on every reconcile write. |
| **ADV-2C-03** | **Moderate** | `service/lease-store.ts:96-113` + `service/main.ts:96-108` | **ADV-2B-06 backup is dead code in production and still lossy.** (a) `CoordinatorService` never calls `LeaseStore.init()` — the shipped tick loop uses `pruneExpired()`/`loadFromDisk()` (`:120-132`), which silently swallows corruption and later `saveToDisk()` overwrites the corrupted file with no backup. (b) The backup triggers only on `SyntaxError`; probed: a transient read error (`EIO`/`EACCES` on `readFile`) resets `this.leases = {}` and overwrites a **valid** `leases.json` with no backup (good lease data destroyed). (c) Valid-JSON-but-wrong-shape files (`null`, `42`, `{"leases":null}`) are also reset without backup. The new test covers only the SyntaxError + `init()` path. | Call `init()` from `CoordinatorService.start()`; back up on any unparseable/unexpected-shape load failure and on read errors, or refuse to overwrite when the prior state could not be read. |
| **ADV-2C-04** | **Low** | `service/cas.ts:14` | **ADV-2B-02 normalization is CRLF-only.** Probed: bare `\r` (old Mac) and mixed `\r\n`/`\r` bodies still digest differently from LF; trailing whitespace is not normalized (`'Line 2   \n' != 'Line 2\n'`), so any external writer that trims produces a false CAS conflict. Claim-time and verify-time digests are identical and both normalize (PASS), so the fix is internally consistent. | Normalize bare `\r` -> `\n`. Trailing-whitespace trimming intentionally NOT adopted (a false match there could clobber a real edit; false conflicts abort safely). |
| **ADV-2C-05** | **Low** | `service/reconciler.ts:56, 66-82` | **`needs-decision`/`needs-permission` do not block `advance`.** Probed: `completed` session + phase `execution`/`exploration` + `attention: 'needs-decision'` -> `advance`, silently discarding the open human question (guard checks only `needs-review`). | Treat any non-`none` attention as "await human" in the `completed` branch. |
| **ADV-2C-06** | **Low** | `test/stage2b-pilot-coordinator.test.js:8-13` | **Test suite requires TypeScript type stripping (Node >= 22.18 / >= 23.6); Node 20 (the bundle target) cannot run it.** Probed: `node --no-experimental-strip-types --test` reproduces `ERR_UNKNOWN_FILE_EXTENSION .ts`. **Pre-existing** at base `4286d40`; `d6050be` extended `.ts` runtime imports to intra-service cross-imports but left the shipped bundle self-contained. | Document the Node floor for `npm test`; shipped bundle is Node-20 clean. |
| **ADV-2C-07** | **Low** | `service/lease-store.ts:106-108` | **Backup failure swallowed silently.** Probed: `copyFile` failure (EACCES) -> `init()` resolves (no crash-loop: PASS), but the corrupted file is then overwritten with zero forensic evidence and zero log output. | Log the backup failure; skip the destructive reset when backup failed. |
| **ADV-2C-08** | **Low** | `service/reconciler.ts:84-87, 39-64` | **Residual edges:** `archive` phase + `completed` session polls forever (lease never released; `done` guard should include `archive`); null/empty issue + `completed` session defaults to `advance` to `planning`; `planning -> execution` is no longer reachable via reconcile (human-only — intended). | Include `archive` in the terminal guard; guard `issue` presence. |
| **ADV-2C-09** | **Low** | `service/task-claim.ts:42, 54-55` | **Eligibility inconsistencies:** `attention: ''` passes the attention guard but fails `isEligiblePhase`; `isExplicitV2: 'true'` (string) and top-level `isExplicitV2` are rejected. Conservative-direction (fewer claims). | Documented residual only. |
| **ADV-2C-10** | **Low** | `test/test-app-harness.js` | **Test discovery discrepancy:** `node --test` counts `test/test-app-harness.js` (helper matching `test-*`) as a test (453); `npm test` glob excludes it (452). Pre-existing. | Documented residual only. |

## Probe Results

- **service/main.js evaluates on plain Node (no type stripping):** PASS — `node --check` PASS; import with `--no-experimental-strip-types` clean (only `node:` built-ins); live smoke run starts, ticks, shuts down cleanly on SIGTERM; manifest entry asserted by tests; rebuilt bundle produced no diff.
- **npm test runnable without experimental flags:** PASS on this machine (Node v22.23.3: 452/452) / FAIL on Node 20 (ADV-2C-06, pre-existing).
- **Full tick-sequence idempotency (all phases):** PARTIAL — completed-session path PASS (no phase skip, no flapping); non-`completed` liveness FAIL (ADV-2C-01); stale-lease precedence FAIL (ADV-2C-02).
- **CRLF / bare-CR / trailing-space digest consistency:** PARTIAL — CRLF == LF PASS (claim-time and verify-time identical); bare `\r` FAIL, mixed endings FAIL (ADV-2C-04).
- **Backup failure path degrades safely:** PARTIAL — no crash-loop on backup failure PASS; forensic evidence silently lost (ADV-2C-07); non-`SyntaxError` load failures destroy valid lease data without backup FAIL; backup path never executes in shipped service (`CoordinatorService` never calls `init()`) FAIL (ADV-2C-03).
- **Deduplication behavior preserved:** PASS — 0 liveness-state differences across 32 session shapes; all 105 old-vs-new `reconcileTaskState` differences are exactly the intended idempotency changes.

## Test Verification

- `npm run typecheck`: PASS (0 errors)
- `npm run build`: PASS (panel 610.6kb, service 26.9kb; committed bundles current)
- `node --test`: PASS — 453 / 453; `test/stage2b-pilot-coordinator.test.js` 39 / 39
- `npm test`: PASS — 452 / 452 (ADV-2C-10 discovery discrepancy)

## Residual Risks (before live GitHub mutation)

1. ADV-2C-01 and ADV-2C-02 are blocking residuals of the ADV-2B-01 remediation.
2. ADV-2C-03: the corrupted-store forensic guarantee claimed by 210b does not hold in the shipped service.
3. ADV-2C-06 (pre-existing): Node floor for the test suite; shipped bundle is Node-20 clean.
4. Unchanged from Task 210: ADV-2B-03, ADV-2B-05, ADV-2B-08 remain open (out of 210b scope).
