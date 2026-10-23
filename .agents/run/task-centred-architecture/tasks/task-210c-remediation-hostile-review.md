<env_preflight>
Repo: /workspace/extensions/github-task-board
Worktree: /workspace/extensions/github-task-board/.worktrees/team-dev-stage2b-pilot-coordinator
Branch: feat/stage2b-pilot-coordinator
Files under review: service/cas.ts, service/task-claim.ts, service/reconciler.ts, service/lease-store.ts, service/main.ts, tsconfig.json, test/stage2b-pilot-coordinator.test.js
Test command: npm run typecheck && npm run build && node --test
Do not touch: config/**, master branch (do NOT push to master or origin)
Preflight facts are true and authoritative at dispatch: do not run initial discovery commands (git status, pwd, ls) to re-ground on startup. Re-inspect targeted state only for mutations/pre-commit verification, compaction/resume with stale facts, branch/location changes, or action failure.
</env_preflight>
<goal>Conduct a hostile review of the Task 210b remediation diff (commit d6050be on feat/stage2b-pilot-coordinator) to figure out what might have been missed or what might be broken. Don't assume that what was done is right. This is a focused second-pass review of the fixes themselves, not a re-review of all of Stage 2B.</goal>
<context_files>
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/outputs/task-210-hostile-review.md]
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/outputs/task-210b-remediation.md]
</context_files>
<skills>
[@.agents/skills/review/adversarial/doubt-driven-development/SKILL.md]
[@.agents/skills/review/quality/code-review-and-quality/SKILL.md]
</skills>
<owned_paths>
.agents/run/task-centred-architecture/outputs/task-210c-remediation-hostile-review.md
</owned_paths>
<depends_on>
task-210b
</depends_on>
<steps>
1. Inspect the remediation diff: `git show d6050be` (and any uncommitted state) in the worktree.
2. Adversarially probe the fixes:
   - **tsconfig.json change (`allowImportingTsExtensions` + `noEmit`) and `.ts` cross-file imports:**
     - Does `service/main.js` (the shipped bundle) still evaluate under plain Node without type stripping? Verify empirically: `node -e "import('./service/main.js')"` (or equivalent) — the bundle target is node20 and must not depend on experimental type stripping.
     - Does `npm test` (which runs `node --test` over `test/*.test.js`) still work? Do the test files now import `.ts` sources at runtime, and if so does that make the suite un-runnable on Node 20 (the shipped target) even though it passes on this machine's Node?
     - Does `allowImportingTsExtensions` silently weaken type checking anywhere (e.g. `noEmit` conflicts with the esbuild pipeline)?
   - **ADV-2B-01 idempotency guard:** simulate the full tick sequence for every reachable phase (`exploration`, `planning`, `execution`, `verification`, `done`) with a `completed` session and confirm no state can ever skip human review or flap. Also check `failed` sessions on tasks already in `verification`.
   - **ADV-2B-02 CRLF normalization:** confirm both claim-time (`claimedSha`) and verify-time digests normalize identically, and that a body with bare `\r` (old Mac) or trailing whitespace cannot still cause false conflicts.
   - **ADV-2B-06 backup path:** what happens when the backup copy itself fails (EACCES, ENOSPC, read-only fs)? Does `init()` throw and crash-loop, or degrade safely?
   - **ADV-2B-07 deduplication:** did removing the private `inspectSession` change any observable behavior (field mapping, default states) versus the original?
3. Execute `npm run typecheck && npm run build && node --test`.
4. Emit findings and verdict `PROCEED` | `PROCEED-WITH-CONDITIONS` | `HALT` to `.agents/run/task-centred-architecture/outputs/task-210c-remediation-hostile-review.md`.
</steps>
<criteria>
- The remediation fixes themselves are stress-tested, not assumed correct.
- The shipped bundle's Node-20 runtime independence from type stripping is empirically verified.
- Explicit verdict emitted with residual risks listed.
</criteria>
<verification>
npm run typecheck && npm run build && node --test
</verification>
<output>
Emit structured output in .agents/run/task-centred-architecture/outputs/task-210c-remediation-hostile-review.md:
# Task 210c Output: Remediation Hostile Review (Second Pass)
## Verdict: PROCEED | PROCEED-WITH-CONDITIONS | HALT
## Findings Matrix:
| ID | Severity | File:Line | Description | Resolution / Residual |
## Probe Results:
- service/main.js evaluates on plain Node (no type stripping): PASS / FAIL
- npm test runnable without experimental flags: PASS / FAIL
- Full tick-sequence idempotency (all phases): PASS / FAIL
- CRLF / bare-CR / trailing-space digest consistency: PASS / FAIL
- Backup failure path degrades safely: PASS / FAIL
- Deduplication behavior preserved: PASS / FAIL
## Test Verification:
- Total tests passed: X / Y
</output>
