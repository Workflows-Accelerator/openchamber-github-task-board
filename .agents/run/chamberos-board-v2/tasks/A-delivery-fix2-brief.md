<env_preflight>
Repo: /workspace/code/openchamber-github-task-board
Worktree: /workspace/code/openchamber-github-task-board/.worktrees/team-dev-chamberos-board-v2
Branch: feat/chamberos-board-v2
Base commit: a578ffd (clean). Last code commit c1f1807.
Files in scope: web/public/theme.css, web/public/app.js (line ~2268 gradient only), web/server/app.ts (archiveData ~1302, operationsData ~1395), web/tests/a5-sections.test.mjs, scripts/generate-delivery-smoke.mjs, scripts/audit-a5-packaged.mjs, .agents/run/chamberos-board-v2/verifications/A-delivery/** (excluding hostile/ which is read-only evidence).
Test commands: npm test; node --test web/tests/*.test.mjs; npm run typecheck; node scripts/audit-a5-data.mjs; node scripts/audit-a5.mjs; PACKAGED_RELEASE_DIR=/tmp/opencode/board-v2-staging/<new-sha>-foundation node scripts/audit-a5-packaged.mjs
Preview: isolated, http://127.0.0.1:4041 (supervisor PID 247563, node 247583, synthetic GitHub :44149). Restart it from the new staged bundle when done.
Do not touch: /workspace/releases/board/** (production releases and current symlink), /workspace/.openchamber-data/board/**, production :8787, live GitHub API, root checkout manager state. No push, merge, issue edits/closures, deletions outside /tmp/opencode/board-v2-staging/.
Preflight facts are authoritative at dispatch: skip initial git status/pwd/ls discovery; targeted checks allowed for mutations, commit verification, or action failure.
</env_preflight>
<goal>
Fix the five findings from the independent hostile review of c1f1807, then rebuild the staged foundation bundle, refresh preview :4041 and the A-delivery proof so the foundation is ready for human validation.
</goal>
<context_files>
[@/workspace/code/openchamber-github-task-board/.worktrees/team-dev-chamberos-board-v2/.agents/run/chamberos-board-v2/verifications/A-delivery/hostile/report.md]
[@/workspace/code/openchamber-github-task-board/.worktrees/team-dev-chamberos-board-v2/.agents/run/chamberos-board-v2/verifications/A-delivery/hostile/canvas-measurements.json]
[@/workspace/code/openchamber-github-task-board/.agents/run/chamberos-board-v2/tasks/A-delivery-polish-brief.md]
[@/workspace/code/openchamber-github-task-board/.agents/run/chamberos-board-v2/verifications/delivery-manager-review.md]
</context_files>
<skills>
[@/workspace/code/openchamber-config/.agents/skills/build/refactoring/surgical-patch/SKILL.md]
[@/workspace/code/openchamber-config/.agents/skills/review/adversarial/doubt-driven-development/SKILL.md]
</skills>
<scope>
1. Canvas HUD at 360px (real app bug, theme.css ~1593-1630): with nowrap labels the French HUD is 377px wide and its left edge is at -31px, clipping the zoom-out button. Make .canvas-floating-controls fit inside the viewport at every width: for example allow the container to wrap onto two rows, or let it span left/right with a max-width of calc(100vw - 28px), or shorten nothing in the translations. Labels stay on one line each. Every control must stay fully visible and clickable at 360/768/1280, EN/FR, light/dark. Do not hide controls.
2. Dot grid (app.js ~2268): the extra "0px" stop added in c1f1807 made Obscura draw a black/white checkerboard. Decide by REAL CHROMIUM (Playwright chromium / chrome-headless-shell; earlier A2/A4 screenshots used it), not Obscura. If the original two-stop gradient renders crisp faint dots in Chromium, revert to it. Keep the dotRadius and alpha expressions intact (web/tests/canvas.test.mjs lines 421-424). Recapture Canvas delivery screenshots 02/03 (and any canvas shot) with real Chromium. If Chromium is truly unavailable, say so in proof.md and do not present Obscura canvas screenshots as visual proof.
3. Total outage after successful discovery (app.ts ~1327, ~1413): in All Projects mode, when discovery succeeds but every repository fails AND no cached data was served (zero repositories contributed data), return an error (502, same error shape as discovery_unavailable or a clear equivalent) instead of 200 with all-zero counts. Partial failures and cached fallback keep returning 200 with partial:true and failures. The UI must show its "Could not load" error state for this case. Add a test for: all repos failing with no cache -> error; one repo failing -> 200 partial; all failing with cache -> 200 partial cached.
4. proof.md line ~52: packaged audit now runs 13 checks, not 12. Make every count in proof.md match a command you actually ran.
5. scripts/generate-delivery-smoke.mjs:391 hardcodes verdict 'PASS'. Compute the verdict from real assertions (zero exceptions, zero console errors, expected wire count) and fail the script when they fail.
6. Run the full test commands. Commit code + tests on feat/chamberos-board-v2 (<new-sha>). Build and stage /tmp/opencode/board-v2-staging/<new-sha>-foundation/ with checksums.sha256 passing sha256sum -c --strict and zero unlisted files (same layout as c1f1807-foundation). Run the packaged audit against it. Restart the isolated preview :4041 from the new bundle (stop only the preview PIDs above). Regenerate A-delivery screenshots and smoke.json, update proof.md, human-review.md, live-switch.md to <new-sha>, commit the evidence.
</scope>
<criteria>
- 360px FR light/dark: every Canvas control has its full rect inside 0..360 horizontally; measured and recorded in A-delivery (JSON with rects).
- Canvas screenshots captured in real Chromium show faint crisp dots, no checkerboard; source gradient decided by Chromium evidence.
- All-repos-fail-no-cache returns an error and the UI shows the load error; partial and cached cases unchanged; tests prove all three.
- proof.md counts match the commands run; smoke verdict is computed.
- All suites pass with 0 failures; staged checksums strict OK; preview :4041 healthy on the new bundle; /workspace/releases/board/current still points to 98261a8-20261103.
</criteria>
<output>
Concise report: code SHA and evidence SHA; staged path and checksum result; each suite with pass/total; preview PIDs and health; per-finding fix summary with file:line; screenshot paths; NOT VERIFIED list (live GitHub writes, external preview access, live cutover and human acceptance remain unverified at minimum).
</output>
