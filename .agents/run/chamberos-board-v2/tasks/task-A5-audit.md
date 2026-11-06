[@/workspace/code/openchamber-github-task-board/.agents/run/chamberos-board-v2/tasks/_audit.md]

<env_preflight>
FIRST, before any other work, run and paste the raw output in your report:
- `pwd` (must be /workspace/code/openchamber-github-task-board/.worktrees/team-dev-chamberos-board-v2)
- `git rev-parse --abbrev-ref HEAD` (must be feat/chamberos-board-v2)
- `git rev-parse HEAD` (must start 6e189c3)
- `git status --short` (must be empty)
If any differs, STOP and report; do not work elsewhere.
You are the ONLY session in this worktree. Wrap every test or long command in `timeout`.
</env_preflight>

<step>
Step A5, issue #60 (sidebar sections on real data + client presentation mode), plus A4 carry-overs.
Brief: [@/workspace/code/openchamber-github-task-board/.agents/run/chamberos-board-v2/tasks/task-A5-sidebar-sections.md]
Dispatch notes (carry-overs a/b/c): [@/workspace/code/openchamber-github-task-board/.agents/run/chamberos-board-v2/tasks/task-A5-dispatch.md]
Findings handed to the hostile reviewer (8 groups): [@/workspace/code/openchamber-github-task-board/.agents/run/chamberos-board-v2/tasks/task-A5-hostile.md]
Decisions: [@/workspace/code/openchamber-github-task-board/.agents/run/chamberos-board-v2/decisions.md]
Proof: .agents/run/chamberos-board-v2/verifications/A5/proof.md in the worktree; A4 proof alongside.
Commits 341ff45..6e189c3:
- carry-overs 1ed4355 (A4 proof wording), 6ce0195 (undo whitespace), 6c1a3a0 (unsaved note retry)
- a1e368a builder snapshot (builder left it uncommitted)
- hostile fixes 8fb3ea2 (mandatory fingerprints, reopen -> status:backlog, 8-column matrix, closedAt), b43cf04 (global presentation mode), 031f86e (screenshot harness via native CDP), 6e189c3 (proof)
Tests: `npm test` = test/*.test.js only (618). Board suite `node --test --test-timeout=30000 web/tests/*.test.mjs`: A4 538, builder 549, hostile STILL 549 (it edited tests but added none). Plus `npm run typecheck`.
</step>

<manager_observations>
The hostile reviewer reported "NOT VERIFIED: none" and its proof has no NOT RUN entries at all. Treat its proof as unverified claims. Manager checks so far: all hostile SHAs exist; the tree is clean; screenshot 17-client-1280-dark.png no longer shows raw body text; web/server/app.ts ~1586-1613 now looks mandatory but is only read via grep, not proven.
</manager_observations>

<extra_focus>
You are AUTHORISED to fix small, contained defects yourself (commit each with "audit:"). Larger problems: report as FAIL with evidence; do not refactor.
1. Conflict safety, proven with real HTTP against the fake GitHub, with PATCH counts: for each A5 write route (question answer, human-task toggle, reopen, label remove POST and DELETE), missing fingerprint -> 400 and 0 PATCH; stale -> 409 and 0 PATCH; malformed JSON / malformed `completed` -> 400 and 0 PATCH. Then the browser: two quick successive task toggles and a double-click on Answer each produce the intended writes only, no 409 shown to the user for their own consecutive clicks.
2. Client presentation mode across ALL views: turn it on, then visit Canvas, List, the issue drawer, Decisions, Blocked, Operations, Archive; reload; check nothing internal shows (front matter, hidden markers, worktree/agent/model info, internal labels like ready-to-run, Run/worktree controls, notes, raw Questions/Human Tasks). Confirm the disclaimer says it is not a security boundary (EN + FR). Confirm it reuses web/public/markdown.js and existing parsers, not a second renderer.
3. Data honesty: archive and operations keep the real fetch time for cached data and show partial/truncated/failed-repo warnings. Closed history: newest-closed order, load-more returns older items with no duplicates, invalid paging (NaN, negative, huge) is rejected or clamped. "Closed in 7 days" uses closedAt only (an old closed issue edited today must NOT count). Every fetched issue counted exactly once in the status table, including issues with no status label. The "oldest in progress" label must not claim days-in-progress if it measures issue age. Same issue number in two repos is never merged.
4. Reopen now also sets status:backlog. Check this against the issue-lifecycle contract (/workspace/code/openchamber-config/.agents/skills/meta/orchestration/issue-lifecycle/SKILL.md). Do not change it; report whether it fits, so the user can decide in the morning review.
5. Body safety: human-task toggle changes exactly one character for CRLF, LF, BOM, fenced/indented code, the same checkbox text in another section, nested lists, and a missing section. Label removal refuses a label absent from the issue or the repo plainly, keeps every other label.
6. A4 carry-overs: (a) set+strip is byte-identical, including bodies that already ended with blank lines; (b) after a failed note save (409, 500, network) the draft stays with Retry (EN + FR), a poll does not overwrite it, and Retry after 409 does not silently overwrite a remote note change. Give the final A4 verdict too: A4 is still provisional until you pass these.
7. Tests: list each test added or changed since 341ff45 by name and say whether it would fail if the feature were reverted. Add tests where an item above has none (especially presentation mode and fingerprint refusal on every new route). grep for .skip/.todo. Explain the final count from 538.
8. Visual: re-check all 24 A5 screenshots yourself; regenerate any that are wrong. Check French status table/loading/error strings, 360px, dark/light, long titles, empty views, a 401/500/network failure on each section. Look for console errors/CSP violations, "n8n", "mobile", double plus, emojis in new source/fixtures/proof. Confirm the screenshot script does not inject CSS, scripts or fake DOM into the app (fake GitHub is the only allowed fake).
9. Write an honest coverage matrix in proof.md: every item above as PASS (with evidence) / FAIL / NOT RUN. Live GitHub writes are NOT RUN by rule.
</extra_focus>

<evidence_rules>
Every claim in your final report must be backed by raw pasted output the manager can re-check:
- For each fix: the commit SHA AND the output of `git show --stat <sha>`.
- At the end: raw output of `git log --oneline 6e189c3..HEAD` and `git status --short`.
- Test counts: final summary lines (tests/pass/fail/skipped) of `timeout 900 npm test`, `timeout 900 node --test --test-timeout=30000 web/tests/*.test.mjs`, and `timeout 600 npm run typecheck`, pasted verbatim.
- Screenshots: list their paths; they must exist in the worktree and be committed.
The manager verifies every SHA with git. Any SHA that does not exist rejects the whole audit. If you could not do something, say NOT DONE. An honest partial report is accepted; an invented one is not.
</evidence_rules>

<output>
Append an "Independent audit" section to verifications/A5/proof.md (and a short final A4 verdict to verifications/A4/proof.md). Commit. Tree clean.
Reply in at most 20 lines: A5 Spec PASS/PARTIAL/FAIL, A5 Quality APPROVED/NEEDS-FIXES, A4 final verdict, the reopen->backlog finding, defects found / fixed by you / left open (each with file:line), both test totals + typecheck, final SHA, then the raw evidence above.
</output>
