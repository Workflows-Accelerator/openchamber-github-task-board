<env_preflight>
Repo: /workspace/code/openchamber-github-task-board
Worktree: /workspace/code/openchamber-github-task-board/.worktrees/team-dev-board-v3
Branch: feat/board-v3
Base commit: 594cb21 (V4-1c fixes for L4 defects D1–D7)
State at dispatch: DIRTY. Uncommitted work from the interrupted previous worker (ses_08535601c18ea3729d5baced): web/public/app.js (+59/-?) and web/public/theme.css (+15/-4), about 70 inserted lines in total. Assume it is the start of the D38 rail toggle and/or hostile-review fixes. It is unverified. Untracked .agents/run/chamberos-board-v2/verifications/V4-1-L4/ must stay untracked and untouched.
Root checkout: /workspace/code/openchamber-github-task-board on ops/task-board-activation (DO NOT modify or switch branches there)
Real Chromium launcher: .agents/run/chamberos-board-v2/verifications/A-delivery/hostile2/scripts/chromium-env.sh (if libs are missing after a container restart: node node_modules/playwright/cli.js install-deps chromium, then source the env, unset FONTCONFIG_FILE if its path is gone)
Test commands (SEQUENTIAL, never parallel): npm test; node --test --test-timeout=30000 web/tests/*.test.mjs; npm run typecheck; npx esbuild web/server.ts --bundle --platform=node --format=esm --target=node20 --packages=external --outfile=/tmp/opencode/v4-1d-server-check.mjs; node scripts/generate-delivery-smoke.mjs
Hard limits: local commits only. No push, deploy, master move, gh, issue or PR change. Do not touch /workspace/releases/board, /workspace/code/openchamber-config, web/server/**, panel/**, service/**, markdown.js, arrange.js, the dot-grid function.
</env_preflight>
<goal>
Finish the interrupted pass. It has three parts: the hostile review of 6535937..594cb21, the user-approved D38 desktop rail toggle, and the four targeted attacks below. Leave a clean committed tree with fresh evidence.
</goal>
<first_step>
Run `git diff` and read the uncommitted change in full. Decide for each hunk: keep, fix, or discard (git restore). State which in your report. Do not build on unverified hunks blindly.
</first_step>
<decisions>
D37 (user-approved): readability first. Keep the 0.55 floor and "Tout afficher (N)" / "Show all (N)" exactly as built in 38f6572.
D38 (user-approved): on desktop (>= 769px), the collapsed sidebar keeps an always-visible open/collapse toggle at the top of the rail. Today, once it is collapsed, nothing reopens it and the state persists in localStorage. The phone drawer and #sidebar-toggle-btn-compact must stay unaffected at 360/390, with and without a persisted collapsed preference.
</decisions>
<attacks>
1. Phone focus at 0.55: is the "Show all" action obvious, fully in the viewport, and not under the legend or the zoom bar? Does the legend text truthfully say the connected tasks are off screen, in fr and en?
2. The 16px canvas title change: any overflow, truncation, or Arrange spacing regression? Arrange measures offsetHeight (arrange.js:407, 414). Confirm that in a real browser with Arrange + Undo restoring exact positions.
3. The return view when a filter is changed (not cleared), and after a page reload with filters active: no stale or lost viewport.
4. Remove or regenerate the 8 stale suffix-less screenshots in verifications/V4-1c/screenshots so the evidence matches the code.
</attacks>
<verification>
D38 proof at 1280 with real clicks: collapse, reload, the toggle is still visible, reopen, reload, still open. Screenshots in light and dark. Also prove 360/390 with the collapsed preference set: the phone drawer opens and closes by real clicks.
Put evidence under .agents/run/chamberos-board-v2/verifications/V4-1d/. Run the full suites sequentially with final counts. Run the smoke twice back to back.
</verification>
<output>
STATUS: PASS | FAIL. DIRTY_STATE_DISPOSITION: per hunk kept, fixed or discarded. FINDINGS: severity, file:line, fixed or not. COMMITS: SHAs from 594cb21. D38_PROOF. TEST_COUNTS. SCREENSHOTS. NOT_VERIFIED. Final git status must show only the untracked V4-1-L4/.
</output>
