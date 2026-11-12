<env_preflight>
Repo: /workspace/code/openchamber-github-task-board
Worktree: /workspace/code/openchamber-github-task-board/.worktrees/team-dev-board-v3
Branch: feat/board-v3
HEAD: 0cef002f5401d54483c2c037fea998702fc5da08, evidence-only commit; actual application at cd64af1.
Tracked tree clean. Untracked .agents/run/chamberos-board-v2/verifications/V4-1-L4/ must stay untouched and untracked. Prior reviewer evidence V4-final-L4/ is committed, read-only.
Root: ops/task-board-activation, DO NOT edit/switch/commit there.
Owned files: web/public/app.js; necessary focused regression tests in web/tests/v3-ux-client.test.mjs; exact existing R1/R2 acceptance assertions in scripts/generate-delivery-smoke.mjs only if needed to reflect approved truthful feedback (do not rewrite smoke); new proof under .agents/run/chamberos-board-v2/verifications/V4-bounded-fix/**.
Tests sequentially: npm test; node --test --test-timeout=30000 web/tests/*.test.mjs; npm run typecheck; npx esbuild web/server.ts --bundle --platform=node --format=esm --target=node20 --packages=external --outfile=/tmp/opencode/v4-bounded-fix-server.mjs; node scripts/generate-delivery-smoke.mjs.
Browser: use launch helpers from committed V4-final-L4 scripts (Chromium 156 executable and existing Playwright package); no new project dependencies or blind stale /tmp env setup.
Preflight authoritative: no initial pwd/ls/status rediscovery loop. Inspect exact diff/source/failing probes as required, git checks before commits.
</env_preflight>
<goal>
Close ONLY final-review blockers R1 and R2 under the user's D39 bounded correction, preserving approved D37/D38 and every already-passing surface; commit local fixes with fresh failing-before/passing-after proof.
</goal>
<context_files>
[@/workspace/code/openchamber-github-task-board/.agents/run/chamberos-board-v2/decisions.md]
[@.agents/run/chamberos-board-v2/verifications/V4-final-L4/report.md]
[@.agents/run/chamberos-board-v2/verifications/V4-final-L4/scripts/independent-browser.mjs]
[@.agents/run/chamberos-board-v2/verifications/V4-final-L4/scripts/completion-browser-corrected.mjs]
[@.agents/run/chamberos-board-v2/verifications/V4-final-L4/scripts/fixture-helpers.mjs]
</context_files>
<skills>
[@.agents/skills/frontend-design/SKILL.md]
[@.agents/skills/ui-skills/SKILL.md]
[@.agents/skills/web-design-guidelines/SKILL.md]
[@.agents/skills/impeccable-critique/SKILL.md]
</skills>
<scope>
One bounded application fix, no redesign. No new linked-task list/jump/navigation, no widening global 0.2..2.5 zoom range, no change to 0.55 automatic readable floor, no dependency additions. Keep existing pan navigation and current theme/layout.
No push/deploy/master/GitHub mutation, branch switch, secret read, file deletion, edits to global config/releases, server/panel/service, dot grid, Arrange or Markdown. Do not touch prior proof files. New evidence is clearly labelled as fresh.
Do not delegate. If solution requires a product fork or out-of-scope file ownership, report BLOCKED rather than silently extending scope.
</scope>
<approved_behaviour>
D39 user selected limited correction: truthful message remains when explicit Show all cannot contain all tasks; hide misleading labels for absent endpoints; navigation remains pan/zoom. Fix filter/focus return state. They rejected widening this pass to a linked-task navigator.
R1 should not be "fixed" by claiming containment at min zoom. Preserve default readable focus and the existing Show all opportunity for groups that can fit. After failed full-fit, explain in EN/FR that zoom limit is reached and some linked tasks remain outside the view (can pan to them); no deceptive successful all-visible state. Keep the current legend and rail surfaces rather than new panels/navigation.
</approved_behaviour>
<steps>
1. Reproduce R1 and R2 from independent probes BEFORE changes; preserve both failures and numeric screenshots under new evidence path. Read full relevant functions, not only stated lines.
2. R1 app.js ~3039–3045/3176–3185/3228–3247: after explicit full-fit, compute true geometric containment of neighbourhood at final clamped view and reserved HUD/legend bounds. Distinguish readable-floor fallback from zoom-limit incomplete fit. Keep an honest warning when incomplete. Endpoint labels must not imply missing cards are present; absence rule must not depend solely on the old readable-floor flag. Apply same truthfulness to filtered Show all if it shares this bug. Do not weaken count or conceal missing cards. Show-all control must not falsely announce success or enter a useless repeated action loop at the same bound.
3. R2 app.js ~5803–5823/3115–3124: defer pending filter return while dependency focus owns view. Closing focus must resolve the right saved view: if last filter was removed, restore original prefilter view exactly and consume stale memory/storage; if filters remain, preserve correct filtered return. No early pending-flag clearing. Verify multiple interleavings and a subsequent independent cycle with a distinct starting viewport.
4. Add focused regression coverage for both state transitions. Preserve existing normal full-fit, D37 auto floor, D38 rail, List/reload/search-only filter state, reduced motion and existing counts. No assertion weakening to get green.
5. Required hostile self-check before reporting: Conduct a hostile review of any edits or changes that you made to figure out what you might have missed or what might be broken. Don't assume that what you did is right. Re-run actual failure probes, not just unit tests; record any corrections made in this pass. Manager still dispatches independent review next.
</steps>
<acceptance>
R1: normal and spread fixtures, 360/390/768/1280, EN/FR, light/dark. Automatic framing >=0.55 and readable; full-fit contains all where feasible. At phone min-zoom failure, real measurements show missing cards, warning remains truthful and visible/hit-testable without covering selected card, absent-endpoint labels hidden; no false PASS for geometric containment. Screen captures for FR phone before/after and desktop full-fit.
R2: at 360 and 1280 start {123.125,-47.875,0.873}; filter, focus, clear filter, close focus -> exact initial view and return state/storage consumed. Move to {-201.625,93.375,1.237}, new filter cycle -> second initial view exactly, never first. Also change filter under focus without emptying, exit while filter remains then clear; clear in List+reload; search interleave; check dependency-only enter/exit unaffected. No stale flags or NaN.
Run original independent scripts with expectations adjusted only for D39 truthful-limit acceptance (retain old expectation and document disposition; no hidden formerly failing all-contained assertion). Do not alter committed independent evidence; write fresh targeted probes.
Full suites sequentially + one delivery smoke; existing accepted features invariant checks. Save raw logs/exit codes, screenshots, actual evidence SHA. All fixes local.
</acceptance>
<signals>
Scope low; ambiguity bounded by D39; sensitivity high (twice-rejected release gate); reversible local commits. Another review failure or a new design fork goes back to user, not automatic further loops.
</signals>
<output>
Full README.md report and machine-readable R1/R2 measurements in V4-bounded-fix/. Commit source/tests separately from evidence. Return <=15 lines: status, SHAs, exact R1/R2 changes with source lines and numeric proof, self-hostile findings/fixes, counts, screenshot paths, preserved limits, unverified surfaces. No publication recommendation masquerading as independent approval.
</output>
