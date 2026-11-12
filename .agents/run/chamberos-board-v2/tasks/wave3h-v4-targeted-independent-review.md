<env_preflight>
Repo: /workspace/code/openchamber-github-task-board
Worktree: /workspace/code/openchamber-github-task-board/.worktrees/team-dev-board-v3
Branch: feat/board-v3
HEAD: b07dd94 (evidence). Application fix to review: a1225f0. Prior rejected state: cd64af1; review evidence 0cef002.
Tracked tree clean at dispatch. Untracked verifications/V4-1-L4/ must remain untouched and unstaged. Committed review dirs V4-final-L4/, V4-bounded-fix/ are read-only inputs.
Root checkout ops/task-board-activation: read-only, never commit or switch there.
Tests SEQUENTIALLY: npm test; node --test --test-timeout=30000 web/tests/*.test.mjs; npm run typecheck; npx esbuild web/server.ts --bundle --platform=node --format=esm --target=node20 --packages=external --outfile=/tmp/opencode/v4-targeted-review-server.mjs; node scripts/generate-delivery-smoke.mjs.
Browser: Chromium 156 through the existing Playwright package and the launch helpers already committed under V4-final-L4/scripts. No new dependency, no system install, no stale /tmp env script.
</env_preflight>
<goal>
Targeted independent verification of whether D39's bounded correction genuinely closes R1 and R2 from the previous review, without regression, and whether the remaining 0.2-zoom limitation is now stated honestly rather than hidden. Two verdicts: SPEC PASS/FAIL for the correction scope and regression, QUALITY APPROVED/CHANGES REQUESTED.
</goal>
<role>
You did not write this fix. Treat the builder's 32/32 and 12/12 claims as hypotheses. The user approved exactly: keep existing pan/zoom and bounds, keep automatic readable floor, keep truthful limit feedback and suppress misleading labels, and fix the filter/focus return state. No navigation feature. Reject anything that widened scope.
</role>
<context_files>
[@.agents/run/chamberos-board-v2/verifications/V4-final-L4/report.md]
[@.agents/run/chamberos-board-v2/verifications/V4-final-L4/scripts/independent-browser.mjs]
[@.agents/run/chamberos-board-v2/verifications/V4-final-L4/scripts/completion-browser-corrected.mjs]
[@.agents/run/chamberos-board-v2/verifications/V4-bounded-fix/README.md]
[@/workspace/code/openchamber-github-task-board/.agents/run/chamberos-board-v2/decisions.md]
</context_files>
<skills>
[@.agents/skills/ui-skills/SKILL.md]
[@.agents/skills/web-design-guidelines/SKILL.md]
</skills>
<scope>
REVIEW ONLY. Do not modify application, tests, or smoke. Own only .agents/run/chamberos-board-v2/verifications/V4-targeted-L4/**; commit only that evidence on feat/board-v3.
No push, deploy, master move, GitHub mutation, secret access, protected paths, or deletion. Preserve untracked V4-1-L4/ and prior committed evidence byte-for-byte.
</scope>
<attack>
1. Re-run the original failing reproductions against a1225f0: spread fixture 360/390, Dependencies, then real click on Show all. Confirm measured containment of each neighbour at the clamped transform, that the honest limit message is present, visible, hit-testable, not covering the selected card, in EN and FR, and that labels whose endpoint is off screen are hidden. Confirm the button does not invite a pointless repeat at the same bound. Verify the same for a filtered Show all that hits the limit.
2. Verify the message is truthful in the OTHER direction: when all cards do fit (normal fixture phone, spread 768/1280), no limit message appears and the fit is genuinely complete.
3. Attack the geometry: HUD/legend reservation, device widths 360/390/768/1280, both themes, both languages, and the 768/769 breakpoint. Check no card or the selected card is covered by the message at any width.
4. Re-run the R2 interleavings independently, not via the builder script: filter, focus, clear last filter, close focus, then a second cycle with a distinct starting viewport; also filter change without clearing, exit with filter still active and then clear, clear in List then reload then Canvas, and search-only. Verify exact numbers, no stale filterView, no stale localStorage, no premature pending consumption, and dependency-only enter/exit unchanged.
5. Regression spot checks, fresh: sheets 112-surface smoke, D38 rail collapse/reload/reopen at 1280 plus phone drawer with persisted preference, drag save + reload and refused save rollback with no unhandled error, Arrange+Undo exact restore, reduced motion, keyboard Escape/Enter/Tab.
6. Invariants: dot grid byte-identical to 28af19b, no banned words, no emoji, no inline style attribute, CSP untouched, protected dirs untouched, no new dependency, zoom bounds still 0.2..2.5 and readable floor still 0.55.
</attack>
<acceptance>
- Both previous defects closed by your own fresh reproductions, or a precise residual statement with severity and file:line.
- Any place the app still implies missing cards are visible, or still shows a limit message that is false, is a FAIL.
- Builder tests may not be trusted as the only proof: at least one independent probe per defect.
- Full suites sequential with real counts and exit codes; one delivery smoke run. Preserve failures instead of retrying to green.
</acceptance>
<output>
Write report.md plus JSON, logs and screenshots in V4-targeted-L4, commit evidence only. Return <=15 lines: SPEC and QUALITY verdicts, per-defect closure with measured numbers, any residual finding with severity/file:line, reviewed application SHA, evidence commit, test counts, unverified surfaces, publication recommendation restricted to this scope.
</output>
