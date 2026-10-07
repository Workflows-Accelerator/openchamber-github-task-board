<goal>Fix exactly the three residual voice defects from hostile review of 252225a, with failing-first regression tests, no scope expansion.</goal>
<context_files>
[@/workspace/extensions/github-task-board/.agents/run/board-lifecycle/verifications/l4-voice-v2-repair-1.md]
[@/workspace/extensions/github-task-board/.agents/run/board-lifecycle/verifications/voice-v2-repair-1-l4/oracle-audit.md]
[@/workspace/extensions/github-task-board/.agents/run/board-lifecycle/verifications/voice-v2-repair-1-l4/test-oracle-matrix.md]
[@/workspace/extensions/github-task-board/.agents/run/board-lifecycle/briefs/voice-v2-ratelimit-repair-1.md]
</context_files>
<skills>
[@/workspace/config/opencode/.agents/skills/build/methodology/test-driven-development/SKILL.md]
[@/workspace/config/opencode/.agents/skills/build/refactoring/surgical-patch/SKILL.md]
[@/workspace/config/opencode/.agents/skills/communication/terse/caveman-lite/SKILL.md]
</skills>
<context>
You are repair 2 (bounded fix) on branch fix/v2-ratelimit-review-repair in THIS worktree at 252225a. Independent L4 ses_e8f6110f2851bb374fe3c0bd returned PROCEED-WITH-CONDITIONS with exactly three defects to repair. Everything else in the repair is reviewed and accepted up to another review; do not refactor, rename, or restructure beyond these three fixes.
Rejected shortcuts still stand: no session caps, no issue-number heuristics, no guessed form keys, no fan-out re-optimization. Do not touch live host sessions/permissions/forms or real GitHub issues. No secrets in any output.
</context>
<scope>
Owned: service/host-client.ts, service/taskboard.ts, test/v2-ratelimit-repair.test.js and minimal additions to test/taskboard.test.js, regenerated service/main.js, worktree run artifacts. Commit locally on the current branch. No other files, no root checkout edits, no branch switches, no push/PR/issue closure, no DB/service changes, no delegation.
</scope>
<criteria>
Each fix has a regression test that FAILS against 252225a and PASSES after; tests exercise real production functions, not simulations. npm run verify and npm run build pass with generated bundle parity. Report per-fix file:line and red/green evidence. Fresh hostile review follows; no acceptance claim.
</criteria>
<steps>
<step>Fix 1 — integer form fields: add the real V2 `type: "integer"` to the supported form-field handling in host-client.ts (normalize and reply paths), parsing and validating integer answers per the protocol contract in oracle-audit.md. Any other documented V2 field types still missing from the whitelist must be listed in the report, not silently added beyond the contract.</step>
<step>Fix 2 — 404 fall-through masking: in replyQuestion and replyPermission, a 404 on a V2 form/permission entity (missing or expired) must surface a clear typed error to the caller and must NOT fall through to legacy V1 routes. Legacy fallback remains allowed only where a route itself is unsupported (proven 404 on the V2 collection route), never for a missing entity after successful V2 discovery.</step>
<step>Fix 3 — partial-cache poisoning: in getTasks() All Projects mode, a failed repository must not cause its stale or partial list to be cached for the 30s TTL as if complete. Failed repos must retry on the next call (or be marked incomplete), while successful repos may keep their cached results. Prove with a test where repo B fails and repo A succeeds.</step>
<step>Run npm run verify and npm run build; confirm service/main.js parity and that panel/main.js is untouched. Save red/green logs in the worktree run artifacts, commit once per fix, and report.</step>
</steps>
<output>
STATUS; RESULTS per fix (file:line, what changed, red/green); CHANGED paths and commits; EVIDENCE commands/counts/exits; NOT VERIFIED; BLOCKERS; LEARNINGS. Nothing is accepted until fresh hostile review and human verdict.
</output>
