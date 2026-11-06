<env_preflight>
Repo: /workspace/code/openchamber-github-task-board
Worktree: /workspace/code/openchamber-github-task-board/.worktrees/team-dev-chamberos-board-v2
Branch: feat/chamberos-board-v2
Base commit: PENDING_REPAIR_HOSTILE_WAKE_AND_MANAGER_GIT_VERIFICATION — DO NOT DISPATCH UNTIL REPLACED.
Clean/dirty state: PENDING_MANAGER_VERIFICATION.
A4 begins at d0d5b72, A5 begins at 341ff45, latest repair begins at 81ed5b6. All SHAs must be verified, not assumed.
Files: web/server/{app,board,github,sections}.ts; web/public/{app,markdown}.js, index.html, theme.css; web/tests/**; scripts/audit-a5*.mjs; worktree A4/A5 proof and screenshots.
Test commands: timeout 900 npm test; timeout 900 node --test --test-timeout=30000 web/tests/*.test.mjs; timeout 600 npm run typecheck; timeout 120 node scripts/audit-a5-data.mjs; timeout 240 env AUDIT_NO_SHOTS=1 node scripts/audit-a5.mjs.
Do not touch: main checkout outside this worktree; panel/**; service/**; live issue data; production processes; /workspace/releases/**; /workspace/.openchamber-data/**; .env* or credentials; /proc/*/environ; repository settings. No pushes, PRs, merge/reset/rebase, deletion, closure or live switch. No new dependencies. Zero emojis.
Authoritative preflight: skip startup pwd/ls/git status discovery. Targeted inspections permitted before/after mutations/commits, stale resume, branch/location change or action failure. No other worker will be active in this worktree at dispatch.
</env_preflight>
<goal>
Independently determine whether A4 and A5 meet their approved specifications on a packaged foundation preview, with separate Spec and Quality verdicts for each issue and a reviewable preview ready for human validation if both pass.
</goal>
<context_files>
[@/workspace/code/openchamber-github-task-board/.agents/run/chamberos-board-v2/tasks/task-A4-notes-arrange.md]
[@/workspace/code/openchamber-github-task-board/.agents/run/chamberos-board-v2/tasks/task-A5-sidebar-sections.md]
[@/workspace/code/openchamber-github-task-board/.agents/run/chamberos-board-v2/tasks/task-A5-repair.md]
[@/workspace/code/openchamber-github-task-board/.agents/run/chamberos-board-v2/tasks/task-A5-repair-hostile.md]
[@/workspace/code/openchamber-github-task-board/.agents/run/chamberos-board-v2/decisions.md]
[@/workspace/code/openchamber-github-task-board/.agents/run/chamberos-board-v2/tasks/task-A-foundation-preview.md]
Urgent D30/D31: foundation only first, advanced B-D remain deferred. To avoid serial startup overhead and testing an artifact different from the preview, combine the final independent browser audit with minimum A-only preview packaging. The preview brief's PENDING base is replaced by this brief's verified preflight; use it as a detailed checklist, not a separate dispatch. This is preview preparation ONLY and is conditional on the foundation passing; never implies release approval.
Read worktree .agents/run/chamberos-board-v2/verifications/A4/proof.md, A5/proof.md and A5/independent/audit-findings.md. Previous audits discovered data loss/presentation leaks despite green suites; do not trust proof claims. Previous manager verification rejected an invented report with nonexistent SHAs; every claim here needs real artifacts.
</context_files>
<skills>
[@/workspace/code/openchamber-config/.agents/skills/review/adversarial/doubt-driven-development/SKILL.md]
[@/workspace/code/openchamber-config/.agents/skills/verify/browser/browser-testing-with-devtools/SKILL.md]
[@/workspace/code/openchamber-config/.agents/skills/communication/terse/caveman-lite/SKILL.md]
</skills>
<scope>
Independent verification plus minimum foundation preview preparation, not another open-ended feature build. Own worktree .agents/run/chamberos-board-v2/verifications/A4/**, A5/** and A-delivery/**, narrowly needed independent scripts/audit-a5*.mjs and new regression tests in web/tests/**. May create an isolated packaged preview under /tmp/opencode/board-v2-staging/<verified-sha>-foundation/ and start its own preview processes; no live service, proxy or credential changes. Keep application assets identical to verified source; if you fix code, rebuild/recheck final artifact. No need to alter web/README.md unless an actual launch blocker exists. You may fix at most small clearly contained defects in web/** after recording failing evidence; commit audit fixes separately and rerun affected proof. Larger defects or product forks: report FAIL, do not decide them. No test weakening. Preserve prior reports/logs as history, append clear final-state findings. Manual Reopen is approved; destination status:backlog remains unchanged and flagged for human review, not a reason to autonomously reopen or change real issues.
</scope>
<criteria>
1. Reproduce every one of the nine repair scenarios independently against final code, including browser note remote-conflict preservation/retry/explicit overwrite, rapid task double-clicks, global presentation navigation/reload, marker exact bytes, truthful timestamps, >1000-open dedicated closed fetch, warnings EN/FR, counts and finite pagination. Inspect real upstream write traces; no mock-only claim.
2. Review original A4/A5 criteria beyond the repair probes. Close previous explicit gaps where practical: timed poll and full reload over unsaved drafts, empty sections, per/all-project browser switching, real-shaped cross-repo links, offline/401/403/500 handling, touch notes/resize, 200% zoom, partial Arrange failure/Undo. Mark each unexecuted scenario NOT RUN and explain which acceptance criterion it leaves unproven. Do not say fully verified when essential criteria remain untested.
3. Fresh browser evidence from unmodified app assets, fake GitHub only as upstream boundary; screenshots 360/768/1280, light/dark, English/French with visible localized headers/loading/error states and no presentation leak. Inspect console/CSP/server logs. No injected proof-only HTML/CSS/DOM. All real GitHub writes NOT RUN.
4. Rerun both suites, typecheck and both probes solo. Record raw exact commands/exit codes/counts and account for changed tests from 618 legacy/559 web at pre-repair baseline. Check no weakened or deleted tests, unrelated code, secret exposure, fake production behavior, banned terms or double-plus regression.
5. Separate verdicts A4 Spec PASS/PARTIAL/FAIL + Quality APPROVED/NEEDS-FIXES; same for A5. Only fully evidenced accepted criteria yield PASS/APPROVED. L5 remains AWAITING HUMAN; no approval to publish/merge/close.
6. Package final verified source using actual existing board build/release procedure, strict checksums and isolated session/test-data paths. Run fresh browser audit against this artifact, rather than another throwaway server, then leave preview available if PASS. Follow task-A-foundation-preview.md for source/artifact identity, auth, clear fake-versus-real data disclosure, reachable access path (loopback alone is not a remote review URL), read-only actual rollback target and human-review/live-switch documents. No public bind or new proxy without approval. If user access is unavailable, report this as a specific blocker, not a usable link. If FAIL, preserve evidence and stop; never publish broken preview as ready.
</criteria>
<verification>
Run all env_preflight test/probe commands with timeouts, then fresh browser scenarios and relevant independent regressions. Keep final audit evidence separate from historical failed runs; do not overwrite old logs as if they passed. Ensure every cited SHA exists via git show --stat. Commit reports/scoped fixes and finish with raw git log --oneline 81ed5b6..HEAD plus git status --short. Clean tree required, but do not remove unknown files. If an unexpected worker appears or changes files concurrently, stop verification and report overlap; never invent final-state coverage.
</verification>
<output>
Append Final independent repair audit to worktree A4/proof.md and A5/proof.md. Update A5/independent/audit-findings.md with final matrix retaining history. On PASS write A-delivery/proof.md, human-review.md and live-switch.md from the preview checklist, clearly pending hostile packaging check and human sign-off. Return <=20 lines: A4 Spec/Quality, A5 Spec/Quality, findings/fixed/open counts with file:line for open defects, legacy/web/typecheck/probes raw summaries, screenshot/report paths, preview URL/data source/access limit and actual rollback target, NOT RUN summary, verified final SHA and raw git log/status. No fabricated claims, no Done/merge authorisation.
</output>
