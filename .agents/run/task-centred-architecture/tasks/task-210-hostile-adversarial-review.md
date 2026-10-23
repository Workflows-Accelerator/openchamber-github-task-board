<env_preflight>
Repo: /workspace/extensions/github-task-board
Worktree: /workspace/extensions/github-task-board/.worktrees/team-dev-stage2b-pilot-coordinator
Branch: feat/stage2b-pilot-coordinator
Files: service/lease-store.ts, service/cas.ts, service/task-claim.ts, service/reconciler.ts, service/session-watcher.ts, service/main.ts, test/stage2b-pilot-coordinator.test.js
Test command: node --test test/stage2b-pilot-coordinator.test.js && node --test
Do not touch: config/**, master branch (do NOT push to master or origin)
Preflight facts are true and authoritative at dispatch: do not run initial discovery commands (git status, pwd, ls) to re-ground on startup. Re-inspect targeted state only for mutations/pre-commit verification, compaction/resume with stale facts, branch/location changes, or action failure.
</env_preflight>
<goal>Conduct a hostile review of any edits or changes made in Stage 2B to figure out what might have been missed or what might be broken. Don't assume that what was done is right.</goal>
<context_files>
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/PLAN-STAGE2B.md]
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/stage2-doubt-audit.md]
</context_files>
<skills>
[@.agents/skills/review/adversarial/doubt-driven-development/SKILL.md]
[@.agents/skills/review/quality/code-review-and-quality/SKILL.md]
</skills>
<owned_paths>
.agents/run/task-centred-architecture/outputs/task-210-hostile-review.md
</owned_paths>
<depends_on>
task-209
</depends_on>
<steps>
1. Conduct adversarial audit of all git diffs on `feat/stage2b-pilot-coordinator`:
   - Inspect `service/lease-store.ts`:
     - What happens if the directory `.openchamber-data/task-coordinator/` does not exist or has permission errors?
     - What happens if `leases.json` contains corrupted JSON? Is there a backup recovery path or does the service crash loop?
     - What happens if two coordinator instances attempt atomic rename simultaneously? Does it handle cross-device link errors (EXDEV) or Windows locks?
     - Is lease expiration monotonic (`expiresAt < now`)? Could system clock skew cause thrashing?
   - Inspect `service/cas.ts`:
     - Does SHA-256 computation normalize CRLF vs LF line endings, or does a Windows vs Linux checkout trigger a false conflict?
     - What happens if `body` is null or undefined?
   - Inspect `service/task-claim.ts`:
     - Can a coordinator steal a task that another agent is actively working on without an expired lease?
     - Is the opt-in filter strict enough to prevent claiming unapproved tasks?
   - Inspect `service/reconciler.ts`:
     - Are session state transitions idempotent? If the reconciler runs 10 times during a running session, does it avoid redundant mutations?
     - What happens if a session is deleted from OpenChamber?
   - Inspect `test/stage2b-pilot-coordinator.test.js`:
     - Are tests genuine adversarial tests or mocks that always pass?
2. Execute `npm run typecheck && npm run build && node --test test/stage2b-pilot-coordinator.test.js && node --test`.
3. Emit findings and hostile verdict: `PROCEED` | `PROCEED-WITH-CONDITIONS` | `HALT` to `.agents/run/task-centred-architecture/outputs/task-210-hostile-review.md`.
</steps>
<criteria>
- Hostile scrutiny applied to all Stage 2B changes.
- Concrete verification of zero regressions and robust handling of lease/CAS edge cases.
- Explicit verdict emitted.
</criteria>
<verification>
node --test test/stage2b-pilot-coordinator.test.js && node --test
</verification>
<output>
Emit structured output in .agents/run/task-centred-architecture/outputs/task-210-hostile-review.md:
# Task 210 Output: Stage 2B Hostile Review
## Verdict: PROCEED | PROCEED-WITH-CONDITIONS | HALT
## Adversarial Findings Matrix:
| ID | Severity | File:Line | Description | Resolution / Residual |
## Edge Case Verification:
- Corrupted leases.json recovery: PASS / FAIL
- CRLF vs LF SHA-256 consistency: PASS / FAIL
- Concurrent claiming collisions: PASS / FAIL
- Clock skew & TTL monotonicity: PASS / FAIL
- Zombie session reconciliation: PASS / FAIL
## Test Verification:
- Total tests passed: X / Y
</output>
