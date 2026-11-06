<env_preflight>
Repo: /workspace/code/openchamber-github-task-board
Worktree: /workspace/code/openchamber-github-task-board/.worktrees/team-dev-chamberos-board-v2
Branch: feat/chamberos-board-v2
Base commit: 9e244aa (clean); changes under review: 4a122bd..9e244aa; code commit c1f1807.
Files: web/public/app.js, web/public/theme.css, web/server/app.ts, web/tests/a5-sections.test.mjs, scripts/audit-a5-packaged.mjs, scripts/generate-delivery-smoke.mjs, .agents/run/chamberos-board-v2/verifications/A-delivery/**.
Test commands: npm test; node --test web/tests/*.test.mjs; npm run typecheck; node scripts/audit-a5-data.mjs; node scripts/audit-a5.mjs; PACKAGED_RELEASE_DIR=/tmp/opencode/board-v2-staging/c1f1807-foundation node scripts/audit-a5-packaged.mjs.
Staged artifact: /tmp/opencode/board-v2-staging/c1f1807-foundation/. Isolated preview: http://127.0.0.1:4041, synthetic GitHub only.
Do not touch: /workspace/releases/board/**, /workspace/.openchamber-data/board/**, live GitHub writes, root manager state. No push, merge, closure or deletion. No new code changes; report findings for a bounded fix task if needed.
Preflight facts are authoritative at dispatch: do not run initial git status, pwd or ls discovery. Targeted checks permitted for mutations, compaction/resume or action failure.
</env_preflight>
<goal>
Conduct a hostile review of any edits or changes that you made to figure out what you might have missed or what might be broken. Don't assume that what you did is right.
</goal>
<context_files>
[@/workspace/code/openchamber-github-task-board/.agents/run/chamberos-board-v2/tasks/A-delivery-polish-brief.md]
[@/workspace/code/openchamber-github-task-board/.worktrees/team-dev-chamberos-board-v2/.agents/run/chamberos-board-v2/verifications/A-delivery/proof.md]
[@/workspace/code/openchamber-github-task-board/.worktrees/team-dev-chamberos-board-v2/.agents/run/chamberos-board-v2/verifications/A-delivery/human-review.md]
</context_files>
<skills>
[@/workspace/code/openchamber-config/.agents/skills/review/adversarial/doubt-driven-development/SKILL.md]
[@/workspace/code/openchamber-config/.agents/skills/communication/clarity/answer-first/SKILL.md]
</skills>
<scope>
Independent review of the recent polish diff and actual staged artifact. Read-only application scope; may add and commit review evidence ONLY under .agents/run/chamberos-board-v2/verifications/A-delivery/hostile/. Do not grade based only on builder claims or source regex tests. Do not mark anything human-validated or shipped. This is a fresh review session because the builder session ended.
</scope>
<criteria>
1. Reproduce All Projects aggregation through UI for Operations AND Archive with BOARD_REPO configured and two nonempty repositories. Assert both repositories' distinct fixtures and aligned blocked totals; changing project must retain section. Test initial selection plus switching back to All Projects.
2. Verify discovery failure vs partial per-repo failure behavior: 401, 403, 500, lost connection, single repo, all repos failing, cached fallback. No outage may display a plausible all-zero success; partial data must be visibly marked with meaningful failures. Check whether the discovery guard actually covers per-repo failures after successful discovery; report any uncovered case.
3. Inspect real browser rendering of Canvas controls at 360/768/1280, EN/FR light/dark, for horizontal viewport overflow, single-line labels, useful hit targets. Review explicit 0px gradient change for unintended appearance. Use real Chromium if available for screenshot proof; label Obscura rasterizer limits honestly. No cosmetic source rewrite solely to appease a test browser.
4. Verify wire-count smoke check counts visible rendered wires, not just detached/hidden groups. Check screenshots are fresh, diagnostic arrays are actually asserted, and test counts in proof are truthful (builder reports 618, 574, 14, 12).
5. Verify staged checksums and full file manifest, production symlink unchanged at /workspace/releases/board/98261a8-20261103, live state untouched; healthy /health alone does not prove untouched.
6. Capture exact blocker findings with file:line and reproduction, or explain evidence for Spec PASS / Quality APPROVED. Separate synthetic test proof from unverified live GitHub behavior and external browser preview access.
</criteria>
<output>
Write report at .agents/run/chamberos-board-v2/verifications/A-delivery/hostile/report.md, with runnable commands, results, screenshot paths, production read-only comparison, NOT RUN blind spots, Spec verdict (PASS/FAIL), Quality verdict (APPROVED/NEEDS-FIXES), overall PROCEED/HALT. Include current preview PIDs, exact commit and staged identity, and a concise human click checklist. Commit only review evidence and return report path, commit, findings and verdicts. Never claim nothing relevant is unverified: live writes, external access, live cutover and human acceptance remain unverified.
</output>
