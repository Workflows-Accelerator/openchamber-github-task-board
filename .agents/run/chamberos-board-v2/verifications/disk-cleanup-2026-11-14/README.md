# Disk cleanup — 2026-11-14

Approved cleanup of `/workspace` (was 100% full, 684 MB free). Executed in tiers with
per-path proof. The live board was not stopped, restarted, or reconfigured.

Run: 2026-11-14T22:53Z · repo `/workspace/code/openchamber-github-task-board` · branch `ops/task-board-activation`

## 1. Before / after

| | `df -h /workspace` | free (bytes) |
|---|---|---|
| before | `75G 72G 684M 100%` | 717,082,624 |
| after | `75G 68G 4.6G 94%` | 4,867,715,072 |

Freed by `df`: **4,150,632,448 bytes (3.87 GiB)**. Measured payload of deleted paths:
Tier A 1,011,047,794 + Tier B 2,972,651,455 = 3,983,699,249 bytes; the remaining
~167 MB came from git metadata pruning / concurrent activity, not from this task's deletions.

## 2. Tier A — ephemeral scratch deleted (11 paths, 1,011,047,794 bytes)

All under `/tmp/opencode/`. Proof of safety for every path:

1. Not referenced by any git-tracked file (`git grep -oh "/tmp/opencode/..." HEAD` → 0 matches for each name; 116 referenced names were excluded by that filter).
2. Not a git worktree/clone (no `.git` file or directory inside).
3. Not open by any process (`/proc/*/fd` scan: only `board-supervisor/` and `board-test-jXoX1M/` are in use by the live service and were kept).

| path | bytes |
|---|---|
| `/tmp/opencode/w7dm` | 961,364,002 |
| `/tmp/opencode/opencode-green-runtime-p1gvMm` | 15,458,880 |
| `/tmp/opencode/opencode-sibling-cross-kmPg8i` | 12,041,891 |
| `/tmp/opencode/w7-l4` | 6,894,309 |
| `/tmp/opencode/l4b-browser` | 3,584,495 |
| `/tmp/opencode/l4b-mut` | 3,549,078 |
| `/tmp/opencode/opencode-green-runtime-qiQLz4` | 2,333,882 |
| `/tmp/opencode/opencode-green-runtime-hpaZwt` | 2,333,882 |
| `/tmp/opencode/sdk-271-check` | 1,485,669 |
| `/tmp/opencode/pycache` | 1,083,554 |
| `/tmp/opencode/w7` | 918,152 |

`w7dm` (the 917 MB item) held `build422/` and `rel/`: plain source copies with no `.git`.
Sampled files (`service/main.ts`, `service/main.js`, `panel/index.html`, `README.md`,
`package.json`) are byte-identical to commit `422b3a0`, which is installed at
`/workspace/releases/board/422b3a0-20261114` and present in the repo. No unique content.

Kept deliberately: `/tmp/opencode/board-supervisor/` (live supervisor + board logs),
`/tmp/opencode/board-test-jXoX1M/` (process 651855 cwd), and all 116 `/tmp/opencode/*`
names referenced from tracked `verifications/`, `.agents/`, `docs/` files — including
`chromium-deps` (referenced by a committed report) and every `issue33-*`, `issue28-*`,
`r28v2-*`, `board-v2-staging`, `red-test` artifact.

## 3. Tier B — merged worktrees removed (17 worktrees, 2,972,651,455 bytes)

Per-worktree gate, all four conditions checked before removal:

- `git status --porcelain` empty (only gitignored build output present: `.opencode/`, `node_modules`, `web/dist/`);
- `git rev-list --count master..<branch>` = 0 (no unique commits);
- `git branch --merged master` lists the branch;
- `oc-worktree merge-check <wt>` → `Merged into base: true / Clean: true / Safe to remove: true`;
- no `.git/worktrees/<id>/locked` file, no process with cwd inside the worktree.

Removed with `/usr/local/bin/oc-worktree remove <worktree>` (repo has no `./bin/oc-worktree`).

| worktree | branch | bytes | merge proof |
|---|---|---|---|
| `workflows-accelerator-agent-dev-wave7-full-l4` | `feat/wave7-full-l4` | 479,862,463 | ahead=0, merged, merge-check safe |
| `workflows-accelerator-agent-dev-wave7b-canvas-l4` | `feat/wave7b-canvas-l4` | 479,186,108 | ahead=0, merged, merge-check safe |
| `workflows-accelerator-agent-dev-wave7a-server-wiring-l4` | `feat/wave7a-server-wiring-l4` | 479,142,888 | ahead=0, merged, merge-check safe |
| `workflows-accelerator-agent-dev-wave7a-flow-layout` | `feat/wave7a-flow-layout` | 478,618,221 | ahead=0, merged, merge-check safe |
| `workflows-accelerator-agent-dev-wave7a-session-activity` | `feat/wave7a-session-activity` | 478,618,115 | ahead=0, merged, merge-check safe |
| `workflows-accelerator-agent-dev-wave7a-server-layout` | `feat/wave7a-server-layout` | 478,570,444 | ahead=0, merged, merge-check safe |
| `team-dev-issue-31-pwa-push` | `feat/issue-31-pwa-push` | 58,069,810 | ahead=0, merged, merge-check safe |
| `team-dev-issue-32-pilot-b` | `docs/pilot-issue-context-b` | 12,039,648 | ahead=0, merged, merge-check safe |
| `team-dev-issue-32-pilot-a` | `docs/pilot-issue-context-a` | 4,457,391 | ahead=0, merged, merge-check safe |
| `team-dev-live-drafting-feedback` | `feat/live-drafting-feedback` | 3,469,649 | ahead=0, merged, merge-check safe |
| `team-dev-human-tasks-wake` | `feat/issue-14-human-tasks-wake` | 3,445,251 | ahead=0, merged, merge-check safe |
| `team-dev-direct-editor-nav` | `feat/direct-editor-navigation` | 3,440,076 | ahead=0, merged, merge-check safe |
| `team-dev-native-skills` | `feat/native-skill-declarations` | 3,446,854 | ahead=0, merged, merge-check safe |
| `team-dev-optimistic-locking` | `feat/optimistic-locking` | 3,450,407 | ahead=0, merged, merge-check safe |
| `team-dev-d12-origins-etag` | `feat/d12-origins-etag` | 2,675,663 | ahead=0, merged, merge-check safe |
| `team-dev-review-feedback-views` | `fix/review-feedback-views` | 2,560,463 | ahead=0, merged, merge-check safe |
| `team-dev-v2-binding-ratelimit-review-repair` | `fix/v2-binding-ratelimit-review-repair` | 1,598,004 | ahead=0, merged, merge-check safe |

Note on the six wave7 worktrees: ~440 MB of each was tracked `.agents/run` content committed on
the branch. Because each branch tip is an ancestor of `master` (ahead=0), that content is
reachable in `master` history and recoverable from git; the checkout copy was redundant.

## 4. Refused — nothing deleted (Tier B leftovers)

| worktree | branch | size | reason |
|---|---|---|---|
| `team-dev-board-v3` | `feat/board-v3` | 495M | untracked `?? .agents/run/chamberos-board-v2/verifications/V4-1-L4/` — untracked data, out of scope |
| `workflows-accelerator-agent-dev-wave7-overhaul` | `feat/wave7-overhaul` | 476M | 1 commit not in `master` |
| `workflows-accelerator-agent-dev-r1-oc-questions` | `docs/r1-oc-questions` | 475M | 2 commits not in `master` |
| `workflows-accelerator-agent-dev-board-issue-52-worktree-remote` | `fix/issue-52-worktree-git-remote` | 473M | 1 commit not in `master` |
| `team-dev-chamberos-board-v2` | `feat/chamberos-board-v2` | 102M | 1 commit not in `master` |
| `team-dev-issue-37-multi-repo` | `feat/issue-37-multi-repo` | 58M | 2 uncommitted/untracked entries |
| `team-dev-issue-30-work-type` | `feat/issue-30-work-type` | 45M | 6 uncommitted/untracked entries |
| `team-ops-board-deployment` | `ops/board-deployment` | 44M | 20 uncommitted/untracked entries |
| `team-dev-issue-30-31-design` | `docs/issue-30-31-design` | 15M | 7 commits not in `master` |
| `team-dev-issue-35-write-refresh` | `fix/issue-35-write-refresh` | 13M | 6 commits not in `master` + 1 dirty entry |
| `team-dev-coordinator-host-contract` | `fix/coordinator-host-contract` | 4.9M | 3 commits not in `master` |
| `team-research-task-centred-github` | `docs/task-centred-github-research` | 4.3M | 3 commits not in `master` |
| `team-research-task-centred-proposal` | `docs/task-centred-proposal` | 4.2M | 14 commits not in `master` + 1 dirty entry |
| `team-research-task-centred-board` | `docs/task-centred-board-research` | 3.9M | 2 commits not in `master` |
| `team-dev-clickthrough-titles-queues-picker` | `fix/clickthrough-titles-queues-picker` | 3.3M | 1 uncommitted/untracked entry |
| `team-dev-pr25-pagesize-port` | `fix/issue-page-size-fallback` | 3.0M | 3 uncommitted/untracked entries |
| `team-dev-contract-l4r` | `issue-lifecycle-issue-contract-l4r` | 1.4M | 1 uncommitted/untracked entry |

Also refused:

- `/tmp/opencode/base-issue83-check` (81M) — a registered git worktree of
  `/workspace/code/openchamber-config` (`gitdir: …/openchamber-config/.git/worktrees/base-issue83-check`).
  Deleting it would modify a forbidden repo's metadata.
- `/workspace/code/openchamber-config` (2.6G), `/workspace/.openchamber-data` (124M) — forbidden paths.
- `/workspace/.cache` (633M) — regenerable, but a cache outside the approved Tier A list; needs its own approval.
- `/tmp/t02.log` (184M) — a stale log, but not in the approved Tier A list (no archives/tarballs found in `/tmp`).
- `/workspace/tmp` — empty (4.0K).

## 5. Tier C — old releases, awaiting separate approval (nothing deleted)

Live: `422b3a0-20261114` (1008K). Rollback: `b85676f-20261113` (880K). One older kept:
`e604b9e-20261112` (852K).

Candidates (11, ~5.6 MB total — small, so low priority):

| release | size | date |
|---|---|---|
| `26fbc00-20261112` | 816K | 2026-11-12 |
| `7339629-20261111` | 756K | 2026-11-11 |
| `0e6d237-20261111` | 752K | 2026-11-11 |
| `5bf1c62-20261111` | 752K | 2026-11-11 |
| `59e5d05-20261111` | 700K | 2026-11-11 |
| `98261a8-20261103` | 380K | 2026-11-03 |
| `8b7e059-20261102` | 360K | 2026-11-02 |
| `ab7516c-20261030` | 360K | 2026-10-30 |
| `cc08379-20261029` | 280K | 2026-10-29 |
| `8df6d7b-20261028` | 240K | 2026-10-28 |
| `07d8511-20261027` | 204K | 2026-10-27 |

Deleting a release is irreversible and was outside this approval; none were touched.

## 6. Tier D — never touched, reported only

| path | size |
|---|---|
| `/workspace/code/openchamber-config` | 2.6G |
| `/workspace/.openchamber-data` | 124M |
| `/workspace/.cache` | 633M |
| `/tmp/t02.log` | 184M |
| `/tmp/opencode` (after cleanup) | 186M |
| `/workspace/code/**` source checkouts | unchanged |
| `node_modules` inside remaining worktrees | gitignored build output, left in place |
| untracked files inside worktrees | left in place (see §4) |

## 7. Post-cleanup verification

| check | result |
|---|---|
| `df -h /workspace` | `75G 68G 4.6G 94%` |
| `curl -fsS http://127.0.0.1:8787/health` | **200** (also 200 after Tier A, before Tier B) |
| `readlink /workspace/releases/board/current` | `/workspace/releases/board/422b3a0-20261114` |
| `git worktree list` | 19 entries (main + 18 remaining worktrees), no broken registrations |
| `git branch` | 70 branches |
| `master` HEAD | `6d82a3b` (unchanged) |

`oc-worktree remove` exited 0 for all 17 worktrees and removed each directory, its branch,
and its DB registration; no error was returned and no manual `git worktree remove` was used.

Not verified: that no other concurrent agent session lost state inside the removed worktrees —
no lock or live process was present at check time, and every removed branch was an ancestor
of `master`, so only checked-out copies were released.
