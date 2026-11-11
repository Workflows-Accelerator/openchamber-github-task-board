<env_preflight>
Repo: /workspace/code/openchamber-github-task-board
Worktree: /workspace/code/openchamber-github-task-board/.worktrees/team-dev-board-v3
Branch: feat/board-v3
Base commit: 5e283b7 (clean; contains V4-1 build commits 011e297, 46a4ba8, 5e283b7 after the hostile self-review)
Root checkout: /workspace/code/openchamber-github-task-board on branch ops/task-board-activation (DO NOT modify or switch branches in root checkout)
Real Chromium launcher: .agents/run/chamberos-board-v2/verifications/A-delivery/hostile2/scripts/chromium-env.sh
Test commands (RUN SEQUENTIALLY, never in parallel — parallel CPU contention flakes stage1-dual-mode-and-scoping.test.js):
  npm test
  node --test --test-timeout=30000 web/tests/*.test.mjs
  npm run typecheck
  npx esbuild web/server.ts --bundle --platform=node --format=esm --target=node20 --packages=external --outfile=/tmp/opencode/v4-1b-server-check.mjs
  (then) generate-delivery-smoke.mjs with the chromium env sourced
Do not touch: web/server/**, panel/**, service/**, /workspace/code/openchamber-config/**, /workspace/releases/board/**, GitHub (no gh, no push, no deploy, no issue or PR changes)
Do not touch: the dot-grid function in web/public/app.js (two-stop non-growing grid), web/public/markdown.js, arrange.js topological sort
</env_preflight>
<goal>
Fix the five manager findings M1–M5 so that on a 360px phone the Canvas dependency focus shows the selected task together with its blockers and dependents, every edge label is readable and inside the viewport, and an applied filter frames its matching tasks.
</goal>
<context_files>
[@.agents/run/chamberos-board-v2/verifications/V4-1-manager-screenshot-review.md]
[@.agents/run/chamberos-board-v2/verifications/V4-1/design-plan.md]
[@.agents/run/chamberos-board-v2/feedback-2026-11-11-v3-live.md]
[@.agents/run/chamberos-board-v2/decisions.md]
</context_files>
<skills>
[@.agents/skills/ui/frontend-design/SKILL.md]
[@.agents/skills/ui/ui-skills/SKILL.md]
[@.agents/skills/ui/web-design-guidelines/SKILL.md]
[@.agents/skills/review/impeccable-critique/SKILL.md]
</skills>
<findings>
M1 P1 — Dependency focus does not frame the neighbourhood. `state.dependencyFocus` (web/public/app.js ~2634) dims unrelated cards and wires but never moves or zooms the canvas. At 360px only the selected card is visible; blocker #1 and dependents #3/#11 are off screen. Required: on selecting Dependencies, compute the bounding box of selected + direct blockers + direct dependents, then animate the canvas viewport (pan and zoom-to-fit with a margin, zoom clamped to the existing min/max, reduced-motion users get an instant jump) so all of them are visible. On exit, restore the viewport that was active before the focus started.
M2 P1 — Edge labels clip and overlap. "#1 bloque #2" is cut at the left viewport edge; "#2 bloque #3" sits on the card border and its connector dot. Labels must be clamped inside the canvas viewport and offset off card bodies (collision padding), readable at every zoom level, in both languages, both themes.
M3 P1 — Applied filter leaves the Canvas unframed. With "Haute" (3 matches) only one card is visible, which reads as one result. After applying or removing a filter, fit the matching cards into view with the same measured fit as M1, or provide an explicit "3 tâches — Tout afficher" affordance that does the fit. Do not hide non-matching cards; the requirement is legibility, not a filtered canvas.
M4 P2 — Two filter entry points side by side on phone: the top-bar funnel icon and the "Filtres"/"Filters" button in the applied-filter bar. Keep one entry point, or show the applied bar only while a filter is active. Say which you chose and why.
M5 P2 — Focus-mode exit label "Quitter" reads as leaving the app. Use "Fermer"/"Close" for the dependency focus and keep wording unambiguous in both languages.
</findings>
<constraints>
- Keep every invariant from V4-1: views named Canvas/Canevas and List/Liste with sidebar navigation, sticky notes under cards, Arrange + Undo, zero "n8n", zero "mobile", zero emojis, no button with both a + icon and "+" text, strict CSP with style-src 'self' (no inline style attributes, animate via transforms and classes), nothing simulated.
- The dot grid function must stay byte-identical.
- No new dependency, no new build step, no framework.
- Vanilla JS in the existing module style; French and English copy both updated.
</constraints>
<verification>
Real Chromium screenshots under .agents/run/chamberos-board-v2/verifications/V4-1b/screenshots/ at 360, 390, 768 and 1280, light and dark, en and fr, for: dependency focus before and after the fit (the blocker AND dependents visible, all three labels fully inside the viewport), filter applied with the matching tasks framed, focus exit restoring the previous viewport, and the M4/M5 wording. Record measured JSON: viewport size, card rects inside/outside the viewport after the fit, each label rect vs viewport bounds, zoom before/after, and the restored zoom after exit.
Sequential suites with final counts: npm test, node --test web/tests/*.test.mjs, npm run typecheck, esbuild, generate-delivery-smoke.mjs. Add regression tests for the fit computation and for label clamping in web/tests/v3-ux-client.test.mjs (pure functions, no DOM timers).
</verification>
<output>
STATUS: PASS | FAIL. COMMITS: SHAs on feat/board-v3 from 5e283b7. DELIVERED: what changed per finding with file:line. MEASUREMENTS: the table above. INVARIANTS: proof each still holds (git diff of the dot-grid function empty, zero "mobile"/"n8n"/emoji, no inline style). TEST_COUNTS. SCREENSHOTS: paths. NOT_VERIFIED: honestly.
</output>
