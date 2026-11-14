<env_preflight>
Repo: /workspace/code/openchamber-github-task-board
Worktree: /workspace/code/openchamber-github-task-board/.worktrees/workflows-accelerator-agent-dev-wave7a-session-activity
Branch: feat/wave7a-session-activity
HEAD: a151e14 (base feat/board-v3 e1f90aa)
Test command: node --test --test-timeout=60000 web/tests/session-activity.test.mjs && npx tsc -p web/tsconfig.json --noEmit
Forbidden: push, deploy, touching files outside web/server/session-activity.ts and web/tests/session-activity.test.mjs, /workspace/code/openchamber-config/**, /workspace/.openchamber-data/**, GitHub writes, delegation.
</env_preflight>

<goal>
Conduct a hostile review of any edits or changes in `a151e14` (`web/server/session-activity.ts` and `web/tests/session-activity.test.mjs`) to figure out what might have been missed or what might be broken. Do not assume what was done is right.
</goal>

<attack_checklist>
1. Read `web/server/session-activity.ts` and `web/tests/session-activity.test.mjs` completely.
2. Check SSRF / URL validation: does it reject `file:`, `ftp:`, non-http(s) URLs, credentials in URLs (`user:pass@`), or huge response bodies?
3. Check `extractIssueRefs`: false positives (e.g. hex color `#123`, markdown anchors `#1-heading`, URL fragments, `#0`, negative numbers), case normalization (`Owner/Repo#12` vs `owner/repo#12`), prototype-pollution keys (`__proto__`, `constructor`).
4. Check singleflight + TTL cache + `forceRefresh`: if an in-flight call is degraded or cached, does `forceRefresh` bypass cleanly without poisoning concurrent callers? Does an aborted/timed-out request leak timers or leave `inFlight` stuck?
5. Check OpenChamber + Triggers merge: what if Triggers reports `sessionId` X for `#10` and OpenChamber reports `sessionId` X is `idle`, vs `busy`, vs OpenChamber unreachable while Triggers has stale `sessionId`? Must NOT falsely animate a green border when the run already ended!
6. Fix any genuine defect you find with a failing test first, re-run `node --test --test-timeout=60000 web/tests/session-activity.test.mjs` and `npx tsc -p web/tsconfig.json --noEmit`, and commit as `fix(board): harden session activity tracker after hostile review` (or report clean APPROVED if zero defects found).
</attack_checklist>

<output>
At most 10 lines: VERDICT (APPROVED or FIXED_AND_APPROVED), FINDINGS, TESTS (count + exit code), TYPECHECK (exit code), COMMIT.
</output>
