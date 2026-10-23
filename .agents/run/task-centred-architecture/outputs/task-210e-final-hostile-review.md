# Task 210e Output: Final Hostile Review (Third Pass, Bounded)

Scope: commit `656500b` (Task 210d remediation) diff only — `service/reconciler.ts`, `service/lease-store.ts`, `service/cas.ts`, `service/main.ts`, `service/main.js` (bundle), `test/stage2b-pilot-coordinator.test.js`. All findings empirically probed (`/tmp/opencode/probe-210e-*.mjs`), not read off the diff. Bounding rule applied: only Moderate-or-higher behavioral defects become conditions.

## Verdict: PROCEED-WITH-CONDITIONS

The 210d fixes hold on every 210c probe failure mode: guard hoisting, issue-phase precedence, forensic backup, and CR normalization all verified empirically against both the TypeScript source and the shipped `service/main.js` bundle (0 parity diffs). One new Moderate defect was found in the 210d backup fix itself: the wrong-shape detector accepts an **array**-valued `leases` field (`typeof [] === 'object'`), so `{"leases":[...]}` is loaded without a forensic backup, its entries silently re-keyed to `'0'`, and the prior file overwritten on the next write — falsifying the "backups trigger on ANY wrong shape" resolution claim. One condition below. Everything else is Low and recorded as documented residuals.

## 210c Probe Re-Verification:

| Probe | Result |
| :--- | :--- |
| `failed` / `blocked-permission` / `blocked-question` sessions on `verification` task: `poll`, `needs-review` untouched | **PASS** — all 3 shapes return `poll` with no `targetAttention`/`targetPhase`; issue attention unmodified; source and shipped bundle agree |
| Any liveness state on `done`/`archive`/closed tasks: `release`, zero attention mutation | **PASS** — 8 liveness shapes x (`done`,`archive`) x (v2Metadata phase, top-level phase) all return `release`; closed via `state:'closed'`, `closed:true`, `closed_at` all `release`; no `targetAttention`/`targetPhase` anywhere |
| Issue `planning` + stale lease `execution` + completed session: `poll`, not `advance` to `verification` | **PASS** — returns `poll`, no `targetPhase`; converse also holds (`execution` + stale lease `done` -> `advance`, live task not released); lease phase used only when the issue carries no phase at all |
| `completed` + `execution` + `attention: 'needs-decision'`: `poll`, question not discarded | **PASS** — also `needs-permission` and `needs-review`; all return `poll` with zero mutation; re-escalation over an open decision also blocked |
| Read-error and wrong-shape load failures: prior file preserved (backed up or byte-identical), never silently overwritten | **PARTIAL** — read error (`EIO`), `SyntaxError`, `null`, `42`, `{"leases":null}`, `[]`, `"str"` all backed up byte-identical before reset (PASS); `{"leases":[...]}` bypasses the shape check entirely and is overwritten with no backup (FAIL, ADV-2E-01) |
| Bare `\r` and mixed-ending bodies: digests equal LF-normalized body | **PASS** — bare CR, CRLF, and mixed endings all digest equal to LF; claim-time/verify-time symmetric; trailing-whitespace strictness deliberate and asserted |
| Guard ordering: hoisted guards do not block legitimate transitions | **PASS** — `execution`->`verification` and `exploration`->`planning` advances reachable; `failed`/`blocked-*` escalations on live tasks reachable; terminal release reachable even with a stale lease snapshot |
| Refusal-mode recovery (backup-fails-then-backup-succeeds) | **PASS** (caveat ADV-2E-02) — see Adjudications |

Note: one initial probe sweep expectation was over-strict (it flagged well-formed top-level `phase`/`attention` fixtures and unknown-phase escalation as "non-conservative"); re-classified after confirming `reconciler.ts:34,39` legitimately read top-level metadata as a source. No code defect in those three cases.

## Findings (if any):

| ID | Severity | File:Line | Description | Disposition |
| :--- | :--- | :--- | :--- | :--- |
| **ADV-2E-01** | **Moderate** | `service/lease-store.ts:93` (and `:159` in `loadFromDisk`) | **Array-shaped `leases` defeats the ADV-2C-03 wrong-shape backup.** The shape check `typeof parsed.leases === 'object' && parsed.leases !== null` accepts arrays. Probed: `{"leases":[{...valid lease fields...}]}` loads with `{...arr}`, re-keying the lease to `'0'` (repo/issue identity destroyed, unfindable via `getLeaseKey`); no `.corrupted.*.bak` is created; the next `saveToDisk` silently overwrites the prior file — the exact no-forensic-overwrite failure mode 210d claims RESOLVED. The new test covers only `null`, `42`, `{"leases":null}`. | **CONDITION** — reject arrays in the shape check (require a plain object) in both `init()` and `loadFromDisk()`, and add `{"leases":[]}` / `{"leases":[{...}]}` to the wrong-shape regression test. |
| ADV-2E-02 | Low | `service/lease-store.ts:220-221, 264-267, 291-292, 366-373` | **Refused writes mutate in-memory state before throwing.** Under refusal mode (`backupBlocked` + backup failure), `acquireLease` throws but leaves a phantom lease visible via `getLease()` (probed), `renewHeartbeat` leaves an extended `expiresAt`, `releaseLease` leaves the lease deleted in memory while it persists on disk. Consequence in-process: a second owner's acquire gets a structured false conflict ("Task is currently leased by ...") instead of the write-refusal error. All confined to the corrupt-plus-unbackupable state, outcome-equivalent for callers (writes fail either way), phantom bounded by lease TTL (60s default). Residual of the ADV-2B-05 in-memory-drift class, made deterministic by the new refusal path. | Documented residual (degraded-mode only, TTL-bounded). Suggested later fix: mutate `this.leases` only after `saveToDisk` resolves. |
| ADV-2E-03 | Low | `service/lease-store.ts:126, 155-175` | **Forensic backup fidelity.** (a) Backup name is `.corrupted.<Date.now()>.bak` only — probed: two backups within the same millisecond collide and the earlier forensic copy is overwritten. (b) A transient read error on a perfectly valid file also produces a `.corrupted.*` backup (misleading name), one per failing operation (probed: repeated transient failures create backups continuously — unbounded growth while the fault persists). | Documented residual. Suggested later fix: add a monotonic counter/random suffix; only name backups `.corrupted.` when content is actually suspect. |
| ADV-2E-04 | Low | `service/lease-store.ts:172` | `loadFromDisk` reports a `SyntaxError` as `read error (unknown)` in its log/backup reason (`init()` at `:107-109` distinguishes correctly). Cosmetic log inaccuracy. | Documented residual. |
| ADV-2E-05 | Low | `service/main.ts:58-64` | Behavior change not in any finding: `CoordinatorService.start()` now fails hard (throws) when the `init()` reset write fails after a successful backup — previously a corrupt `leases.json` could not block startup. Fail-fast is defensible but is a startup-availability change worth knowing about. | Documented residual (no change requested). |

## Adjudications:

- **Changed test expectation 1: LEGITIMATE.** `reconcileTaskState respects phase from TaskLease when available` -> `reconcileTaskState falls back to TaskLease phase when the issue carries no phase (ADV-2C-02 fallback)` (`test/stage2b-pilot-coordinator.test.js:990-1008`). The old fixture (issue phase `draft` + stale lease phase `execution` -> `advance`) *was* the ADV-2C-02 probe failure mode; keeping it would re-encode forbidden behavior. The retitled test exercises the lease phase on the fallback path the finding preserves (issue carries no phase), and the corrected precedence is asserted strictly by the new ADV-2C-02 regression test (`planning` + stale `execution` -> `poll`; `execution` + stale `done` -> `advance`). Assertion strength unchanged (exact action + target equality). Behavior changed because a finding forbade it, not to keep tests green.
- **Changed test expectation 2: LEGITIMATE.** ADV-2B-01 idempotency tick-2 reason `'Awaiting human review'` -> `'Awaiting human verification'` (`:1050`). Strict-equality assertion retained; the string is the one the hoisted awaiting-human guard (`reconciler.ts:70`) now returns for a `verification`+`needs-review` task; action and semantics unchanged. Grep confirms no consumer keys on reconciler reason strings (only the test and an unrelated panel tooltip).
- **Refusal-mode recovery: PASS.** Probed `backup-fails-then-backup-succeeds`: with `copyFile` failing, `init()` resolves (no crash-loop), `acquireLease` rejects with `Refusing to overwrite lease store: ...`, the corrupted file stays byte-identical, and no tmp files leak; once `copyFile` recovers, the next mutating operation backs up the corrupt payload (byte-identical `.bak` present) and the write succeeds. Also probed: removing the unreadable file unblocks writes (`backupPriorState`'s no-file branch). Persistent total backup failure keeps refusing forever — that is the intended "never destroy prior state" design, not a lockout bug; the store never locks out legitimate writes while the underlying fault is gone. Caveat ADV-2E-02 (in-memory mutation before the refused write).

## Test Verification:

- `npm run typecheck`: PASS (0 errors)
- `npm run build`: PASS (panel 610.6kb, service 29.7kb; deterministic — identical sha256 for `service/main.js` and `panel/main.js` across the committed tree and two rebuilds; `git status` clean on both bundles)
- `node --test`: PASS — 463 / 463
- `npm test`: PASS — 462 / 462 (ADV-2C-10 discovery discrepancy, pre-existing)
- `node --check service/main.js`: PASS; import with type stripping disabled: PASS (21 exports; bundle imports only `node:` built-ins — self-contained despite the `.ts` source import specifiers)
- Source vs shipped bundle parity over the reconcile matrix (7 issue shapes x 8 session shapes x 3 lease states): 0 differences
- Total tests passed: 463 / 463 (`node --test`), 462 / 462 (`npm test`)

## Condition (before unattended GitHub mutation):

1. **ADV-2E-01**: tighten the `LeaseStore` shape validation to reject array-valued `leases` in both `init()` and `loadFromDisk()` so `{"leases":[...]}` takes the forensic-backup path, and extend the wrong-shape regression test with array variants. One-line fix; everything else in the 210d remediation is verified.
