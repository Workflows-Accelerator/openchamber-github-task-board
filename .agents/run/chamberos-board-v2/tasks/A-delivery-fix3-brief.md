<env_preflight>
Repo: /workspace/code/openchamber-github-task-board
Worktree: /workspace/code/openchamber-github-task-board/.worktrees/team-dev-chamberos-board-v2
Branch: feat/chamberos-board-v2
Base commit: 4704ddc (clean). Last code commit de726e4.
Files in scope: web/server/app.ts (~1332, ~1421 guards only), web/tests/a5-sections.test.mjs, scripts/generate-delivery-smoke.mjs, scripts/audit-a5.mjs and scripts/audit-a5-packaged.mjs (output paths only), .agents/run/chamberos-board-v2/verifications/A-delivery/** except hostile/ and hostile2/ (read-only evidence).
Real Chromium: source .agents/run/chamberos-board-v2/verifications/A-delivery/hostile2/scripts/chromium-env.sh (unpacks libs/fonts under /tmp/opencode, no root). Use it for ALL delivery screenshots and browser smoke checks.
Test commands: npm test; node --test --test-timeout=30000 web/tests/*.test.mjs; npm run typecheck; node scripts/audit-a5-data.mjs; node scripts/audit-a5.mjs; PACKAGED_RELEASE_DIR=/tmp/opencode/board-v2-staging/<new-sha>-foundation node scripts/audit-a5-packaged.mjs
Preview: http://127.0.0.1:4041 (PIDs 367095/367113). Restart only these from the new bundle.
Do not touch: web/public/app.js line 2268 gradient (verified correct in real Chromium), /workspace/releases/board/**, /workspace/.openchamber-data/board/**, production :8787, live GitHub, root checkout manager state. No push, merge, closure, deletion outside /tmp/opencode/board-v2-staging/.
Preflight facts are authoritative at dispatch: skip initial git status/pwd/ls discovery.
</env_preflight>
<goal>
Fix the six findings of hostile review 2, recapture all delivery screenshots in real Chromium, restage and refresh preview :4041 so the A1–A5 foundation evidence is truthful and ready for human validation.
</goal>
<context_files>
[@/workspace/code/openchamber-github-task-board/.worktrees/team-dev-chamberos-board-v2/.agents/run/chamberos-board-v2/verifications/A-delivery/hostile2/report.md]
[@/workspace/code/openchamber-github-task-board/.worktrees/team-dev-chamberos-board-v2/.agents/run/chamberos-board-v2/verifications/A-delivery/proof.md]
</context_files>
<skills>
[@/workspace/code/openchamber-config/.agents/skills/build/refactoring/surgical-patch/SKILL.md]
[@/workspace/code/openchamber-config/.agents/skills/review/adversarial/doubt-driven-development/SKILL.md]
</skills>
<scope>
1. Outage guard (app.ts ~1332, ~1421): replace the condition with one based on discovery.repositories.some((r) => r.available) as proposed in hostile2, so a sole repository losing access after successful discovery matches /api/combined/board (200 with failures) and a real total outage still returns 502. Add tests: sole-repo-unavailable (200, consistent with combined board), empty account with zero discovered repos (200 empty, not 502), plus keep the 3 existing cases. Mutation-check: removing each clause of the guard must fail at least one test.
2. Smoke script (generate-delivery-smoke.mjs): run it on real Chromium via chromium-env.sh so console errors, uncaught exceptions and CSP violations are actually captured (CDP Runtime.consoleAPICalled/exceptionThrown/Log.entryAdded or a page-side securitypolicyviolation listener). Remove every remaining literal 'PASS' (lines ~464, 472, 480, 488, 493): compute each verdict. Make the HUD containment check (~331) also fail on overlapping controls, not just viewport edges. Prove each check by injecting one failure (console error, exception, overlapping control) and observing non-zero exit; record those runs in A-delivery/smoke-negative.md, then restore.
3. HUD overlap at 768/1280 FR (Arrange vs Reset view per canvas-measurements.json): determine in real Chromium whether controls overlap. If they do, fix in theme.css minimally; if it was an Obscura measurement artifact only, record the Chromium measurements showing no overlap.
4. Audit scripts must not overwrite tracked evidence (A5/independent/browser.json, packaged-browser.json) on rerun: write to an output path given by env var or under /tmp/opencode, defaulting to non-tracked locations. Keep the original files unchanged.
5. Recapture all 12 A-delivery screenshots and canvas-measurements.json in real Chromium. Rewrite proof.md: remove the false "Chromium cannot run" claim, state the renderer used for every screenshot, and give counts only from commands actually rerun.
6. Run all test commands. Commit code+tests (<new-sha>), stage /tmp/opencode/board-v2-staging/<new-sha>-foundation/ (strict checksums, zero unlisted), run packaged audit, restart preview :4041 from it, update proof.md/human-review.md/live-switch.md, commit evidence.
</scope>
<criteria>
- False 502 gone; total outage still 502 with "Could not load" in UI; new tests mutation-proven.
- Smoke script exits non-zero on each injected failure kind; no literal verdicts remain.
- All 12 delivery screenshots from real Chromium; canvas shots show faint dots, no checkerboard; HUD controls contained and non-overlapping at 360/768/1280 EN/FR light/dark.
- Tracked evidence files unchanged by audit reruns (git status clean after running the audits).
- All suites 0 failures; staged checksums strict OK; preview healthy on new bundle; production symlink still 98261a8-20261103.
</criteria>
<output>
Concise report: code SHA, evidence SHA, staged path + checksum result, each suite pass/total, preview PIDs + health, per-finding fix with file:line, screenshot paths, NOT VERIFIED list (live GitHub writes, external preview access, live cutover, human acceptance at minimum).
</output>
