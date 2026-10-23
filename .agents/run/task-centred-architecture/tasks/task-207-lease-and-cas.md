<env_preflight>
Repo: /workspace/extensions/github-task-board
Worktree: /workspace/extensions/github-task-board/.worktrees/team-dev-stage2b-pilot-coordinator
Branch: feat/stage2b-pilot-coordinator
Base commit: 9d4f8da
Files: service/lease-store.ts, service/cas.ts, test/stage2b-pilot-coordinator.test.js
Test command: npm run typecheck && node --test test/stage2b-pilot-coordinator.test.js
Do not touch: config/**, master branch (do NOT push to master or origin)
Preflight facts are true and authoritative at dispatch: do not run initial discovery commands (git status, pwd, ls) to re-ground on startup. Re-inspect targeted state only for mutations/pre-commit verification, compaction/resume with stale facts, branch/location changes, or action failure.
</env_preflight>
<goal>Implement the isolated single-writer lease store (service/lease-store.ts) with TTL expiration, heartbeat renewal, and atomic disk persistence in .openchamber-data/task-coordinator/leases.json, and the SHA-256 Compare-And-Swap (CAS) pre-flight validator (service/cas.ts).</goal>
<context_files>
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/PLAN-STAGE2B.md]
[@/workspace/extensions/github-task-board/service/types.ts]
[@/workspace/extensions/github-task-board/service/config.ts]
</context_files>
<skills>
[@.agents/skills/build/methodology/test-driven-development/SKILL.md]
[@.agents/skills/build/discipline/incremental-implementation/SKILL.md]
[@.agents/skills/build/discipline/surgical-patch/SKILL.md]
</skills>
<owned_paths>
service/lease-store.ts
service/cas.ts
test/stage2b-pilot-coordinator.test.js
.agents/run/task-centred-architecture/outputs/task-207-lease-and-cas.md
</owned_paths>
<depends_on>
task-206
</depends_on>
<steps>
1. Create `service/cas.ts`:
   - Implement `computeIssueSha(body: string): string` using Node `crypto.createHash('sha256').update(body || '').digest('hex')`.
   - Implement `verifyIssueCas(currentBody: string, expectedSha: string): { match: boolean, currentSha: string }`.
2. Create `service/lease-store.ts`:
   - Implement `LeaseStore` class managing operational leases:
     - `constructor(filePath: string, defaultTtlMs: number = 60000)`
     - `init(): Promise<void>`: loads existing state or creates empty structure with `version: 1`.
     - `acquireLease(repo: string, issueNumber: number, ownerId: string, bodySha: string, phase: string, ttlMs?: number): Promise<ClaimResult>`:
       - Checks if active unexpired lease exists for `${repo}#${issueNumber}`.
       - If active lease exists owned by another worker, returns `{ acquired: false, conflictReason: 'Task is currently leased by ' + lease.ownerId }`.
       - If lease does not exist or is expired, creates new lease with `claimedAt: Date.now()`, `expiresAt: Date.now() + ttl`, `heartbeatAt: Date.now()`, `claimedSha: bodySha`.
       - Atomically saves to disk.
       - Returns `{ acquired: true, lease }`.
     - `renewHeartbeat(repo: string, issueNumber: number, ownerId: string, ttlExtensionMs?: number): Promise<boolean>`:
       - Refreshes `heartbeatAt` and extends `expiresAt`.
       - Returns true if renewed, false if lease not found or expired or owned by someone else.
     - `releaseLease(repo: string, issueNumber: number, ownerId: string): Promise<boolean>`:
       - Removes lease if owned by `ownerId`.
       - Atomically saves to disk.
     - `getLease(repo: string, issueNumber: number): TaskLease | null`: returns active lease or null if expired/absent.
     - `listActiveLeases(): TaskLease[]`: returns all unexpired leases.
     - `pruneExpired(): Promise<number>`: cleans up expired leases and returns pruned count.
     - Persistence: writes to temporary file (`.leases.json.tmp.<pid>`) and atomically renames (`fs.promises.rename`) to guarantee zero partial-file corruption.
3. Author unit tests in `test/stage2b-pilot-coordinator.test.js`:
   - CAS hash calculation: identical bodies produce identical SHA-256; whitespace/content changes produce divergent hashes.
   - CAS verification: matches expected baseline, rejects modified content.
   - Lease acquisition: successfully claims available task.
   - Mutual exclusion: second worker fails to claim task locked by active lease.
   - Heartbeat renewal: extends expiration timestamp.
   - Expiration and reclamation: expired lease can be reclaimed by a new worker after TTL passes.
   - Atomic persistence: state correctly survives store reload from disk.
4. Run `npm run typecheck && node --test test/stage2b-pilot-coordinator.test.js` to verify 100% green.
5. Emit structured output to `.agents/run/task-centred-architecture/outputs/task-207-lease-and-cas.md`.
</steps>
<criteria>
- CAS SHA-256 computation and verification are deterministic.
- Lease store enforces single-writer mutual exclusion.
- Expired leases are safely detected and eligible for reclamation.
- Disk persistence uses atomic file replacement (temp file + rename).
- Tests pass cleanly with zero type errors.
</criteria>
<verification>
npm run typecheck && node --test test/stage2b-pilot-coordinator.test.js
</verification>
<output>
Emit structured output in .agents/run/task-centred-architecture/outputs/task-207-lease-and-cas.md:
# Task 207 Output: Lease Engine & CAS Pre-Flight
## Status: completed | failed
## Evidence:
- Typecheck output
- Test run output for test/stage2b-pilot-coordinator.test.js
## Changes:
- Modified files and key functions implemented
## Verification:
- Exact test assertions verified
</output>
