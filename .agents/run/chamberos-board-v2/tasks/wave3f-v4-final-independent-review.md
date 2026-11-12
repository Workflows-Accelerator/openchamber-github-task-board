<env_preflight>
Repo: /workspace/code/openchamber-github-task-board
Worktree: /workspace/code/openchamber-github-task-board/.worktrees/team-dev-board-v3
Branch: feat/board-v3
Base: 28af19b is the last published baseline. Review HEAD: cd64af10bbc2e888990377143a2fcd1ce812bb7c. Latest fixes since failed review: 6535937..cd64af1. Tracked tree clean; only untracked .agents/run/chamberos-board-v2/verifications/V4-1-L4/ (prior independent review evidence, preserve untouched).
Root checkout: ops/task-board-activation, read-only. Do not switch branches or alter root.
Files: web/public/app.js, theme.css, index.html, manifest.json, sw.js; scripts/generate-delivery-smoke.mjs; web/tests/v3-ux-client.test.mjs; evidence V4-1 through V4-1d.
Tests SEQUENTIALLY: npm test; node --test --test-timeout=30000 web/tests/*.test.mjs; npm run typecheck; npx esbuild web/server.ts --bundle --platform=node --format=esm --target=node20 --packages=external --outfile=/tmp/opencode/v4-final-review-server.mjs; node scripts/generate-delivery-smoke.mjs twice back to back.
Browser: installed Playwright Chromium 156. Prior /tmp/opencode/hostile2-apt paths were wiped by restart; do not blindly source stale chromium-env.sh. Current system Playwright deps worked for V4-1d. If genuinely unavailable, report the missing dependency rather than inventing browser proof.
Preflight facts authoritative at dispatch. Targeted inspection permitted for mutations, stale context and failure recovery.
</env_preflight>
<goal>
Conduct a hostile review of any edits or changes that you made to figure out what you might have missed or what might be broken. Don't assume that what you did is right.
As the independent reviewer (you did not implement these changes), apply that hostile instruction to the complete increment 28af19b..cd64af1 and especially the fixes since the rejected review; deliver Spec PASS/FAIL and Quality APPROVED/CHANGES REQUESTED with fresh empirical evidence.
</goal>
<context_files>
[@/workspace/code/openchamber-github-task-board/.agents/run/chamberos-board-v2/decisions.md]
[@/workspace/code/openchamber-github-task-board/.agents/run/chamberos-board-v2/feedback-2026-11-11-v3-live.md]
[@.agents/run/chamberos-board-v2/verifications/V4-1c/README.md]
[@.agents/run/chamberos-board-v2/verifications/V4-1d/README.md]
[@.agents/run/chamberos-board-v2/verifications/V4-1-L4/l4-consumer.json]
[@.agents/run/chamberos-board-v2/verifications/V4-1-L4/l4-spread.json]
</context_files>
<skills>
[@.agents/skills/frontend-design/SKILL.md]
[@.agents/skills/ui-skills/SKILL.md]
[@.agents/skills/web-design-guidelines/SKILL.md]
[@.agents/skills/impeccable-critique/SKILL.md]
</skills>
<scope>
REVIEW ONLY for application and tests. Do not fix or alter app/test/smoke source in this pass. Own only .agents/run/chamberos-board-v2/verifications/V4-final-L4/**; create repeatable verification scripts, logs, screenshots, report.md there and commit that evidence alone on feat/board-v3. Preserve untracked V4-1-L4/ without staging it.
No push, deploy, master movement, branch switch, GitHub mutations, secret access, production writes, or change under /workspace/code/openchamber-config or /workspace/releases. Do not delegate further.
</scope>
<alignment>
User-approved D37: prioritize readability. Automatic framing has a 0.55 floor. When the group cannot fit readably, selected card/group may be centered while others are off screen, with truthful copy and explicit Tout afficher (N)/Show all (N). Do NOT reject merely because the user cannot read all four cards simultaneously on a 360px screen: that trade-off is approved.
User-approved D38: desktop collapsed rail keeps an always-visible toggle at the top; phone drawer unchanged.
D33 authorizes publication of approved scope after passing independent review, not bypassing review. User already confirmed the PREVIOUS live drag fix on their real phone. Do not claim that proves this local increment, and do not touch real issues.
No new product forks or implementation by this reviewer. If a real fork remains, give concrete alternatives for the manager to ask the user.
</alignment>
<acceptance>
1. Independently close or reopen each prior defect D1–D7 with source and fresh runtime proof: automatic floor/explicit full-fit, honest offscreen handling, exact filter return viewport, Sort styled controls, animation-safe smoke, 44px rename button, failed drag rollback without unhandled rejection.
2. D38 fresh pointer clicks at 1280: collapse, reload, visible and hit-testable toggle, reopen, reload open. Both themes and languages. Phone 360/390 persisted collapsed preference never hides hamburger or shrinks drawer; check 768/769 breakpoint via targeted probe.
3. Filter return-view state after changing filters, reload with filters active, clearing in List then reload then Canvas, and search-only usage. Verify finite/clamped saved scale and no stale return view; test a second filter cycle.
4. Framing on normal AND spread fixture at 360/390/768/1280. Measure auto scale, selected-card legibility, Show all placement, full-fit action and labels. Builder admits spread neighbours cannot all fit at 360/390 even at 0.2; do not hide this in a PASS. Determine whether the action/copy falsely promises all N while still omitting cards, assess severity, report if unresolved. Do not widen global zoom range or change navigation without approval.
5. Fresh sheets/filters/dependency screenshots, sample visually; no unlabeled stale artifacts. At least 360 FR light+dark and 1280 EN. Check sheet focus/close/backdrop/scroll lock; remaining surface matrix through existing smoke.
6. Regression: real-pointer drag + reload, status change, Arrange+Undo exact numeric restore, 16px title overflow and layout gaps, Markdown note layer, reduced motion and keyboard. A forced write refusal must produce visible error/rollback and no unhandled pageerror.
7. Invariants against published 28af19b: dot-grid byte-identical, Canvas/Canevas and List/Liste/sidebar preserved, zero prohibited words in product source, zero emojis, no inline HTML style attributes, no + icon plus + text duplication, CSP unchanged, panel/service/server protected. CSSOM transforms are not HTML inline-style source violations.
8. Full suites sequentially, final counts and exit codes. Smoke two back-to-back passes with no retries disguised as first-time passes. If a test fails, preserve evidence, distinguish load/timing from a defect; never weaken tests.
</acceptance>
<signals>
Scope medium; ambiguity low except documented spread-board limitation; sensitivity high (publication gate), reversibility high (read-only app review). Treat all builder PASS claims as hypotheses.
</signals>
<output>
Write full report.md plus proof pointers in V4-final-L4, commit evidence only. Return <=15 lines: SPEC verdict (sheets, dependencies per D37, rename, spacing, D38), QUALITY verdict, open findings severity/file:line/reproduction, evidence commit and reviewed application SHA, actual test counts, screenshot paths, unverified surfaces, and whether publication is blocked. No claim of live proof or permission to close issues.
</output>
