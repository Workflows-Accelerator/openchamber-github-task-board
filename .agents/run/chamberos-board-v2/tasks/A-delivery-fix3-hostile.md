<env_preflight>
Repo: /workspace/code/openchamber-github-task-board
Worktree: /workspace/code/openchamber-github-task-board/.worktrees/team-dev-chamberos-board-v2
Branch: feat/chamberos-board-v2
Base commit: d4b957b (clean, verified by manager); code commit 59e5d05.
Diff to review: 4704ddc..d4b957b. Code changes limited to web/server/app.ts (2 guards), web/tests/a5-sections.test.mjs, scripts/generate-delivery-smoke.mjs, scripts/audit-a5.mjs, scripts/audit-a5-packaged.mjs. Evidence under .agents/run/chamberos-board-v2/verifications/A-delivery/.
Artifact: /tmp/opencode/board-v2-staging/59e5d05-foundation/. Preview: http://127.0.0.1:4041, wrapper PID 486338, child 486368. Synthetic GitHub only. Real Chromium available using hostile2/scripts/chromium-env.sh (user-space libraries/fonts under /tmp/opencode, no root installation).
Tests: npm test; node --test --test-timeout=30000 web/tests/*.test.mjs; npm run typecheck; node scripts/audit-a5-data.mjs; node scripts/audit-a5.mjs; PACKAGED_RELEASE_DIR=/tmp/opencode/board-v2-staging/59e5d05-foundation node scripts/audit-a5-packaged.mjs; node scripts/generate-delivery-smoke.mjs.
Do not touch: application source, original evidence, /workspace/releases/board/**, /workspace/.openchamber-data/board/**, production :8787, live GitHub, root checkout manager state. No push, merge, issue closure, service change, installation or deletion. Mutation tests ONLY in a temporary task-owned copy; leave tracked files and preview state unchanged.
Preflight facts authoritative at dispatch: skip initial git status/pwd/ls discovery. Targeted checks allowed for mutation verification, action failure or stale facts on resume.
</env_preflight>
<goal>
Conduct a hostile review of any edits or changes that you made to figure out what you might have missed or what might be broken. Don't assume that what you did is right.
</goal>
<context_files>
[@/workspace/code/openchamber-github-task-board/.agents/run/chamberos-board-v2/tasks/A-delivery-fix3-brief.md]
[@/workspace/code/openchamber-github-task-board/.worktrees/team-dev-chamberos-board-v2/.agents/run/chamberos-board-v2/verifications/A-delivery/hostile2/report.md]
[@/workspace/code/openchamber-github-task-board/.worktrees/team-dev-chamberos-board-v2/.agents/run/chamberos-board-v2/verifications/A-delivery/proof.md]
[@/workspace/code/openchamber-github-task-board/.worktrees/team-dev-chamberos-board-v2/.agents/run/chamberos-board-v2/verifications/A-delivery/smoke-negative.md]
</context_files>
<skills>
[@/workspace/code/openchamber-config/.agents/skills/review/adversarial/doubt-driven-development/SKILL.md]
</skills>
<scope>
Fresh independent final review of fix3 and its actual artifact. Do NOT reopen already resolved gradient/HUD source design or deferred B-D features. Review the five changed source/test scripts and six hostile2 findings. Original evidence read-only; write and commit review evidence ONLY at .agents/run/chamberos-board-v2/verifications/A-delivery/hostile3/. If defects remain, report precise reproduction and stop without fixes. No extra workers.
</scope>
<criteria>
1. Guards: independently reproduce Operations AND Archive empty-account (200 empty), sole unavailable repository (200 partial, clear warning consistent with combined board), partial failure with data retained, all available repositories failing with no cache (502 and human-visible Could not load), cached fallback (200 partial). Verify current source against staged server. Mutation challenge in throwaway copy must fail when each necessary guard clause is removed. Do not invent a new HTTP policy; preserve the approved partial-vs-unavailable distinction.
2. Smoke script: run real Chromium; ensure console errors, uncaught exceptions, CSP violations, missing wires, offscreen controls and pairwise control overlap actually yield nonzero exit and non-PASS evidence. Challenge at least console error, uncaught exception and control overlap independently using the submitted negative-injection mechanism. Inspect CSP listener and exercise a CSP violation if feasible. Ensure injections do not use the same variable to force both a failure and its expected verdict without observing the browser. Verify there are no uncomputed success claims. Check errors after navigation aren't lost and expected HTTP-error probes aren't spuriously counted. Count identity: builder claims 575 web tests despite two new edge-case tests; reconcile empirical count rather than propagating old numbers.
3. Evidence: inspect all 12 updated screenshots/metadata, confirm current Chromium capture and subtle dot grid; no fresh visual defects, all controls non-overlapping and inside viewport at 360/768/1280 EN/FR light/dark. Use existing valid hostile2 24-case proof plus a targeted current preview recheck (360 FR and 1280 FR with Undo arrange). Synthetic fixture content must be disclosed; stale ports/PIDs/SHAs and false Chromium-unavailable claim must be removed. proof.md must not present unasserted diagnostics as success.
4. Audit output discipline: rerun browser + packaged audits with default outputs; prove tracked JSON/screenshots unchanged, no tracked raw output changes. Run generate-delivery-smoke with an output override/task-owned destination so original delivery evidence remains unchanged; if it has no override, use a temporary copy. All counts and verdicts must match exact commands actually run (builder claims legacy 618, web 575, data 14, packaged 13, smoke 10).
5. Artifact: strict checksum 13/13 and zero unlisted; packaged files match code 59e5d05. Production symlink still points at 98261a8-20261103; read-only identity/health check only, no production writes. Do not claim production state is untouched beyond evidence available (previous review only checked mtimes). Preview remains healthy.
</criteria>
<output>
Commit a concise report at .agents/run/chamberos-board-v2/verifications/A-delivery/hostile3/report.md with per-finding RESOLVED/OPEN and direct command/artifact proof, Spec PASS/FAIL, Quality APPROVED/NEEDS-FIXES and PROCEED/HALT. If PASS, return a plain French five-item human click checklist (#56-60) and the exact preview access instructions; identify any blockers to the user's access. NOT RUN at minimum: live GitHub writes, external preview access, live cutover, human tactile acceptance, real touch/Firefox/WebKit. Return commit SHA, report path, counts and findings. Approval means ready for human validation only, never permission to publish.
</output>
