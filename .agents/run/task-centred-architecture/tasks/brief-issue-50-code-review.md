<env_preflight>
Repo: /workspace/extensions/github-task-board
Worktree: /workspace/extensions/github-task-board/.worktrees/team-dev-issue-50-host-connection
Branch: fix/issue-50-host-connection, HEAD 1863b0d7920b35e7d688dce28916256c43d77c49, clean. Base master ab7516c4a3634c3d69f7b82936ddb7655d327ebb.
Preflight facts are authoritative: skip initial pwd/ls/git status discovery.
Files to audit (read-only): git diff ab7516c..1863b0d -- service/ panel/ test/ ; .agents/run/issue-50-plan/PLAN.md ; .agents/run/issue-50-build/verifications/proof.md.
Test commands: node --test test/service-host-connection.test.js test/panel-service-connection.test.js test/stage2b-pilot-coordinator.test.js test/shipped-parity.test.js
Do not touch: ANY application, test, build, or plan file. You are a strictly read-only independent code auditor except for writing your audit artifact under .agents/run/issue-50-code-review/**.
Secrets wall: never read /workspace/.openchamber-data/**, .env*, board.env, credential/cookie/session files, process environments, git remote URLs or `git remote -v`. No live GitHub calls/writes, label updates, agent starts, host toggles/restarts, production data. Zero emojis.
</env_preflight>
<goal>
Independently audit the final #50 implementation diff (`ab7516c..1863b0d`) and render final two-verdict Spec and Quality rulings without editing product or test files.
</goal>
<context_files>
[@/workspace/extensions/github-task-board/.worktrees/team-dev-issue-50-host-connection/.agents/run/issue-50-plan/PLAN.md]
[@/workspace/extensions/github-task-board/.worktrees/team-dev-issue-50-host-connection/.agents/run/issue-50-build/verifications/proof.md]
</context_files>
<skills>
[@/workspace/config/opencode/.agents/skills/review/adversarial/doubt-driven-development/SKILL.md]
[@/workspace/config/opencode/.agents/skills/review/quality/code-review-and-quality/SKILL.md]
[@/workspace/config/opencode/.agents/skills/communication/terse/caveman-lite/SKILL.md]
</skills>
<owned_paths>
.agents/run/issue-50-code-review/**
</owned_paths>
<criteria>
1. Inspect `git diff ab7516c..1863b0d -- service/ panel/ test/` and run the targeted test suite (`node --test test/service-host-connection.test.js test/panel-service-connection.test.js test/stage2b-pilot-coordinator.test.js test/shipped-parity.test.js` and `npm run typecheck`).
2. Verify specifically:
- Did the L4 fix introduce any regression or unwanted exposure (e.g., evaluate whether `window.__taskBoardBackgroundService` on `window` in `panel/main.ts` exposes anything sensitive or is just a harmless reference to the no-arg `checkBackgroundServiceConnection` helper)?
- Does `setRepository` banner guard still allow normal repo-setup banners to clear when a repository IS selected, while only preserving `'Background coordinator'` notices? (Wait: if the banner currently shows `'Background coordinator service is not enabled...'`, and the user has no repo selected and then selects a repo, preserving the coordinator notice is fine; what if the user clicks the banner's own close button? Verify the close button still works.)
- Are all 6 plan corrections + D59 + 4 advisories + 6 L4 fixes cleanly implemented with zero collateral churn, zero emojis, and clean bundles?
3. Write `.agents/run/issue-50-code-review/findings.md` with Spec Verdict (`PASS` | `PARTIAL` | `FAIL`) and Quality Verdict (`APPROVED` | `NEEDS-FIXES`), and commit only `.agents/run/issue-50-code-review/**`.
</criteria>
<verification>
npm run typecheck && node --test test/service-host-connection.test.js test/panel-service-connection.test.js test/stage2b-pilot-coordinator.test.js test/shipped-parity.test.js && git status --short
</verification>
<output>
Commit only .agents/run/issue-50-code-review/** on fix/issue-50-host-connection (do not push). Return <=10 lines: Spec verdict; Quality verdict; key audit checks verified; any blocking or non-blocking notes; commit hash; actual provider/model.
</output>
