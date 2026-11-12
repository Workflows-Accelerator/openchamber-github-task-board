<env_preflight>
Repo: /workspace/code/openchamber-github-task-board
Worktree: /workspace/code/openchamber-github-task-board/.worktrees/team-dev-board-v3
Branch: feat/board-v3
HEAD: b0718cc (5430f36 source, b0718cc tests; base d1eef33 = live V4)
State: tracked tree clean. Untracked: .agents/run/chamberos-board-v2/verifications/V4-2/ (evidence to finish and commit) and .agents/run/chamberos-board-v2/verifications/V4-1-L4/ (OFF LIMITS — never stage, never touch).
Root checkout on ops/task-board-activation: DO NOT modify, switch or commit there.
Chromium: launch only via the existing .agents/run/chamberos-board-v2/verifications/V4-2/scripts/browser-env.sh (extracts libs to /tmp/opencode/v4-2-libs). Do not install anything system-wide.
Timeouts: scripts/generate-delivery-smoke.mjs takes ~5–6 min. Always run it with a 900000 ms tool timeout in the FOREGROUND, never as a background job you then stop watching. Suites strictly sequential.
Hard limits: local commits only. No push, no deploy, no /workspace/releases, no /workspace/code/openchamber-config, no /workspace/.openchamber-data, no real GitHub mutation, no credential output, no `git remote -v`, no file deletion.
</env_preflight>

<goal>
Close the V4-2 increment honestly: get a real result for the post-fix delivery smoke, settle whether the `npm test` failures pre-exist on the released base, commit the evidence, then run a hostile review of 5430f36 + b0718cc and fix only what is genuinely broken.
</goal>

<context>
- Evidence README: .agents/run/chamberos-board-v2/verifications/V4-2/README.md (read first). Its smoke row still says `SMOKE_RESULT` (placeholder) and `logs/delivery-smoke.log` has no EXIT_CODE: the previous worker launched attempt 4 in the background and ended before it finished. Attempt 3 (pre-option-fix) exited 0.
- `npm test` was not green: 617/618 then 615/618, different failures each run (panel-simple-views, scale-and-adversarial timing under load ~12). The worker argued flakiness because panel/** has no diff. That is plausible, not proven.
- Brief of the original spec: .agents/run/chamberos-board-v2/tasks/wave4a-v4-2-notes-decisions.md. Decisions D37/D38/D39 must not change (see that brief's non_regression section).
</context>

<steps>
1. Check whether a delivery-smoke process from the previous worker is still alive (ps). If alive, wait for it with a bounded wait; if dead or absent, run `DELIVERY_DIR=.agents/run/chamberos-board-v2/verifications/V4-2 node scripts/generate-delivery-smoke.mjs` once in the foreground with the 900000 ms timeout, writing logs/delivery-smoke.log with an EXIT_CODE line and timing. Keep earlier attempt logs.
2. `npm test` baseline question: run `npm test` once at HEAD when load is low (record `uptime` before). Then, WITHOUT switching branches in this worktree, prove whether the same suite is flaky on the released base: e.g. `git stash` is NOT allowed; instead use `git worktree add --detach /workspace/code/openchamber-github-task-board/.worktrees/team-dev-v4-2-base d1eef33`, run `npm test` there once (reuse node_modules via symlink only if the lockfile is identical; otherwise `npm ci` there), record result, then `git worktree remove` that path (it holds no work) and `git worktree prune`. This throwaway detached worktree is the only one you may create. Report both counts and the failing test names. If HEAD fails something the base does not fail deterministically, that is a defect, not flakiness.
3. Update README: replace SMOKE_RESULT with the real result, add the npm test head-vs-base comparison with load, keep NOT_VERIFIED. Commit evidence only (`git add .agents/run/chamberos-board-v2/verifications/V4-2`), never V4-1-L4.
4. Hostile review: conduct a hostile review of 5430f36 and b0718cc to figure out what might have been missed or what might be broken. Do not assume that what was done is right. Focus at least on: server note route (CSRF, per-issue lock release on every error path, body size limits, marker spoofing, never PATCH/DELETE comments, error mapping 403/404/410/422, no token leakage in error messages), conditional-request cache keys for comments (ETag reuse across repos/issues, cache growth), multi-repo route `/api/repos/:o/:r/issues/:n/notes` authorization against the configured repo set, client composer (focus return, draft retention, double-send, i18n EN/FR completeness, no inline styles under CSP, no "n8n"/"mobile"/emoji, no + icon with "+" text), Decisions parser backward compatibility and XSS through Markdown in option label/gist/details, radiogroup keyboard behaviour.
5. Fix only genuine defects, each with a test, in a separate commit `fix(v4-2): …`. If you fix anything in application code, re-run sequentially: web tests, typecheck, esbuild check, browser.mjs, framing-promise.mjs, and the delivery smoke (900000 ms). Append to README under "Hostile review" with each finding: severity, evidence, fixed/not fixed and why.
6. Leave tracked tree clean except untracked V4-1-L4/.
</steps>

<output>
At most 20 lines Markdown:
- STATUS: PASS | FAIL | BLOCKED
- SMOKE: exit code, duration, sections
- NPM_TEST: head vs base counts, failing names, load, verdict (pre-existing flake / regression)
- HOSTILE_FINDINGS: each with severity and fixed/not fixed
- COMMITS: SHAs
- TEST_COUNTS after fixes
- NOT_VERIFIED
No claim of live, deployment or human acceptance.
</output>
