<env_preflight>
Repo: /workspace/code/openchamber-github-task-board
Worktree: /workspace/code/openchamber-github-task-board/.worktrees/team-dev-chamberos-board-v2
Branch: feat/chamberos-board-v2
Base commit: de3641a (clean). Changes under review: a578ffd..de3641a; code commit de726e4.
Staged artifact: /tmp/opencode/board-v2-staging/de726e4-foundation/. Preview: http://127.0.0.1:4041 (PIDs 367095/367113), synthetic GitHub :36273.
Test commands: npm test; node --test --test-timeout=30000 web/tests/*.test.mjs; npm run typecheck; node scripts/audit-a5-data.mjs; node scripts/audit-a5.mjs; PACKAGED_RELEASE_DIR=/tmp/opencode/board-v2-staging/de726e4-foundation node scripts/audit-a5-packaged.mjs
Do not touch: /workspace/releases/board/**, /workspace/.openchamber-data/board/**, production :8787, live GitHub, root checkout manager state. No push, merge, closure, deletion. Application code read-only: report findings, do not fix.
Preflight facts are authoritative at dispatch: skip initial git status/pwd/ls discovery.
</env_preflight>
<goal>
Conduct a hostile review of any edits or changes that you made to figure out what you might have missed or what might be broken. Don't assume that what you did is right.
</goal>
<context_files>
[@/workspace/code/openchamber-github-task-board/.agents/run/chamberos-board-v2/tasks/A-delivery-fix2-brief.md]
[@/workspace/code/openchamber-github-task-board/.worktrees/team-dev-chamberos-board-v2/.agents/run/chamberos-board-v2/verifications/A-delivery/hostile/report.md]
[@/workspace/code/openchamber-github-task-board/.worktrees/team-dev-chamberos-board-v2/.agents/run/chamberos-board-v2/verifications/A-delivery/proof.md]
</context_files>
<skills>
[@/workspace/code/openchamber-config/.agents/skills/review/adversarial/doubt-driven-development/SKILL.md]
</skills>
<scope>
Fresh independent review (the builder session ended). Evidence may be added and committed ONLY under .agents/run/chamberos-board-v2/verifications/A-delivery/hostile2/.
</scope>
<criteria>
1. DOT GRID, top priority. The manager inspected screenshot 02-canvas-notes-wires-1280-light-en.png at de3641a: with the gradient reverted to the original two-stop source (unchanged since 0d8c44a), the canvas STILL shows a heavy black/white checkerboard at 72% zoom. The earlier A2/canvas-1280.png (dd9e8ac, same gradient source, 100% zoom, "Generated via Playwright") shows faint crisp dots. Determine whether a real browser would show the checkerboard:
a. Find out how A2 screenshots were produced (Playwright with which browser binary? Obscura over CDP?) and whether that path still works. Try to get a real engine: Playwright chromium/firefox/webkit already installed in caches, chrome-headless-shell, any bundled browser. Report exact commands and errors.
b. In whatever renderer is available, capture the same canvas at 25%, 50%, 72%, 100%, 200% zoom, light and dark, plus a minimal standalone HTML page using the identical gradient values, to separate an app defect from a rasterizer artifact.
c. Compute the actual gridStep, dotRadius, alpha values at those zooms from app.js and reason about the CSS: does any value (e.g. dotRadius >= gridStep/2, alpha, background-size rounding) produce a dense pattern in a spec-compliant renderer?
d. Verdict: APP DEFECT (with file:line and proposed fix), RASTERIZER ARTIFACT (with proof), or UNDETERMINED (state exactly what a human must look at).
2. 360/768/1280 EN/FR light/dark Canvas HUD: every control fully inside the viewport, clickable, labels single-line, nothing overlapping the sidebar toggle or cards in a blocking way. Look at the screenshots yourself, not only the JSON.
3. All-repos-fail-without-cache now returns 502: check the guard at web/server/app.ts ~1332/~1421 for false positives: zero discovered repos (empty org), repositories filtered/unavailable, issue-cap truncation, cached-but-loaded-zero, single-repo mode untouched. UI shows "Could not load" not zeros. The 3 new tests must fail if the guard is removed (mutation check).
4. Smoke script verdict really fails on bad input (inject one failure and observe a non-zero exit, then restore). proof.md counts match commands you rerun (618, 575, 14, 13).
5. Staged checksum strict OK with zero unlisted files; production symlink still 98261a8-20261103; production state dir not modified (compare mtimes/contents read-only, not just /health).
</criteria>
<output>
Report at .agents/run/chamberos-board-v2/verifications/A-delivery/hostile2/report.md with commands, results, screenshot paths, Spec verdict PASS/FAIL, Quality verdict APPROVED/NEEDS-FIXES, overall PROCEED/HALT, dot-grid verdict (criterion 1d) stated in one plain sentence, NOT RUN list (live GitHub writes, external preview access, live cutover, human acceptance at minimum). Commit evidence; return report path, commit SHA, findings with file:line, verdicts.
</output>
