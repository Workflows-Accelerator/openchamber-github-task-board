# Integration Merge — Issue #37 (Multi-Repository Task Board)

- **Target branch:** `feat/v2-binding-and-ratelimit`
- **Source branch:** `feat/issue-37-multi-repo` (HEAD `cdc48b1d7aed4470b2aa6d326aa3b5da162f69e3`)
- **Merge commit:** `8660d2154a7d0a2d2d376c736ee727387ca8b575` (`git merge --no-ff feat/issue-37-multi-repo -m "feat(web): integrate multi-repository board (issue 37)"`)
- **Parent 1:** `2739ea08dfc204c35eef723d78c005fbcba0e08f`
- **Parent 2:** `cdc48b1d7aed4470b2aa6d326aa3b5da162f69e3`
- **Conflicts:** None (0 conflicts, clean automatic merge)

## Verification Results

| Gate / Suite | Command | Exit | Result |
| --- | --- | --- | --- |
| Web Test Suite | `node --test web/tests/*.test.mjs` | 0 | **384/384 pass**, 0 fail, 0 skipped, 0 cancelled (18.7s) |
| Root Test Suite | `npm test` | 0 | **517/517 pass**, 0 fail, 0 skipped, 0 cancelled (20.6s) |
| Root Typecheck | `npm run typecheck` | 0 | 0 errors |
| Web Typecheck | `npx tsc -p web/tsconfig.json` | 0 | 0 errors |
| Panel & Service Build | `npm run build` | 0 | Updated committed `panel/main.js` (654.4kb); service `service/main.js` (31.3kb) |
| Web Server Bundle | `npx esbuild web/server.ts --bundle --platform=node --format=esm --target=node20 --packages=external --outfile=web/dist/server.mjs` | 0 | SHA-256 `006ebe36925f4c13a5f8743257e1acedf848e608d2a60abc3aedf47b9f0fc797` (gitignored) |
| Hosting Test Suite | `node --test web/tests/hosting.test.mjs` | 0 | **11/11 pass**, 0 fail, 0 skipped, 0 cancelled (5.4s; builds & boots real bundle) |

### Notes on Root Suite Flakes
- First full suite run encountered pre-existing load-sensitive timing flake on `test/scale-and-adversarial.test.js:119` (`Multi-page normalization and merging took 62.6ms, expected <60ms`). Targeted run of `test/scale-and-adversarial.test.js` passed 33/33 in 375ms (18.6ms for the tested assertion), and full suite rerun passed 517/517.

## Scratch Harness Probes (F1–F4)

Independent scratch harness probes executed against root product code:

| Probe | File | Result | Verified Behaviors |
| --- | --- | --- | --- |
| **F1** | `verifications/issue-37-integration/probes/probe-f1.mjs` | **PASS** | Write to revoked repository during gated discovery refresh refused with 400 `repository_not_allowed`; 0 upstream PATCH calls; 0 calls to `/repos/owner/alpha`; accessible repository beta unaffected (1 PATCH). |
| **F2** | `verifications/issue-37-integration/probes/probe-f2.mjs` | **PASS** | Cross-repository client race: alpha save resolving during beta load retains beta board and label `owner/beta`, Refresh enabled; overlapping loads resolve cleanly without cross-label row leakage; rejected load clears board with Refresh enabled. |
| **F3** | `verifications/issue-37-integration/probes/probe-f3.mjs` | **PASS** | Pre-dispatch discovery refusal (503 `discovery_unavailable`) across section, status, and question treated as definite refusal; uncertain set remains empty (0 items); draft and detail preserved; ambiguous 502/503 outcomes preserved as UNKNOWN. |
| **F4** | `verifications/issue-37-integration/probes/probe-f4.mjs` | **PASS** | Combined view aggregate cap: exactly 500 issues complete with `truncatedByIssueCap:false`, `complete:true`; 501 issues capped at 500 with `truncatedByIssueCap:true`, `truncated:true`, `partial:true`, `complete:false`; duplicate-only page in `GitHubClient.listIssues` sets `truncated:true`. |

## Tracked State & File Integrity

- Working tree tracked status is clean after committing deliverables.
- Forbidden files (`.agents/idle-nontext-state.json`, `.agents/run/board-lifecycle/**`, `.agents/run/test-inspection.mjs`, `.agents/run/task-centred-architecture/outputs/{deployment-preflight-private,devops-board-deployment}.md`, `tasks/issue-34-hostile-review.md`, and `*-private.md`) were unread, uncopied, unstaged, and untouched.
- Manager tracking files (`continuation.md`, `mission.md`, `tasks.md`) untouched.
- `web/dist` remains gitignored and untracked.

## Model Attribution

- **Provider / Model:** `9router/engineer` (`Engineer`)

## Blind Spots & Exclusions

- Synthetic HTTP and fake GitHub fixtures only; no live multi-repository GitHub token or real-time organization permission changes.
- Concurrency timing in F1 and F2 simulated with deterministic gating rather than live production races.
- No real browser engine in container environment; CDP browser tests and physical touch/mobile Tab traversal not run.
- Production hosting, container restart durability, Let's Encrypt TLS, and reverse proxy publication remain pending explicit owner deployment authorization.
