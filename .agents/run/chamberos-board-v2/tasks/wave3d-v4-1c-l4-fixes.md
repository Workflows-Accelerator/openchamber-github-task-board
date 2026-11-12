<env_preflight>
Repo: /workspace/code/openchamber-github-task-board
Worktree: /workspace/code/openchamber-github-task-board/.worktrees/team-dev-board-v3
Branch: feat/board-v3
Base commit: 6535937 (tracked tree clean; only untracked .agents/run/chamberos-board-v2/verifications/V4-1-L4/ from the independent review — leave it alone, do not commit or delete it)
Root checkout: /workspace/code/openchamber-github-task-board on ops/task-board-activation (DO NOT modify or switch branches in root checkout)
Real Chromium launcher: .agents/run/chamberos-board-v2/verifications/A-delivery/hostile2/scripts/chromium-env.sh
Test commands (SEQUENTIAL, never parallel): npm test; node --test --test-timeout=30000 web/tests/*.test.mjs; npm run typecheck; npx esbuild web/server.ts --bundle --platform=node --format=esm --target=node20 --packages=external --outfile=/tmp/opencode/v4-1c-server-check.mjs; node scripts/generate-delivery-smoke.mjs
Hard limits: no push, no deploy, no /workspace/releases/board, no /workspace/code/openchamber-config, no gh, no issue or PR changes, no master movement.
Do not touch: web/server/**, panel/**, service/**, markdown.js, arrange.js topological sort, the dot-grid function.
</env_preflight>
<goal>
Close the seven defects from the independent L4 review (D1–D7) so the Canvas framing is readable on a 360px phone, clearing a filter restores the user's previous view, and the acceptance smoke stops flaking.
</goal>
<role>
You are fixing a review, not re-implementing it. Change the smallest thing that removes each defect and keeps every previously proven behaviour. Do not restyle anything the review accepted (sheet system, filter state, rename, spacing rhythm).
</role>
<context_files>
[@.agents/run/chamberos-board-v2/verifications/V4-1-L4/l4-consumer.json]
[@.agents/run/chamberos-board-v2/verifications/V4-1-L4/l4-spread.json]
[@.agents/run/chamberos-board-v2/verifications/V4-1-L4/l4-sort.json]
[@.agents/run/chamberos-board-v2/verifications/V4-1-L4/l4-canvas.json]
[@.agents/run/chamberos-board-v2/verifications/V4-1-L4/l4-misc.json]
[@.agents/run/chamberos-board-v2/verifications/V4-1-L4/l4-sheets.json]
</context_files>
<defects>
D1 (P1) No readable minimum scale. At 360 the filter fit lands at 0.309 and the dependency focus at 0.315, which is a ~4px card title; at 1280 on a spread board the focus lands at 0.264 (3.4px). Fix: introduce a legibility floor (0.55, the value renderCanvasIssues already uses around web/public/app.js:5223) for framing. When the group cannot fit at or above the floor, frame the selected card or the group centroid at the floor and surface an explicit "Tout afficher (N)" / "Show all (N)" button whose action performs the full fit (allowed to go below the floor, it is an explicit user choice). Update web/tests/v3-ux-client.test.mjs:493 to assert the floor and the fallback instead of accepting >= 0.2.
D2 (P1) Containment claim false on spread boards. At 360/390 with neighbours far apart, focus clamps at 0.2 and the blocker and both dependents stay outside the viewport while the legend still explains directions. Fix: per D1, never enter a state where the app claims to show a neighbourhood it does not show. Frame the selected card at the floor, show the "Tout afficher (N)" action, and make sure the legend/edge labels do not imply the other cards are visible. Prove with a spread fixture at 360, 390, 768 and 1280.
D3 (P2) Clearing filters destroys the viewport. Remember {panX, panY, scale} when the first filter is applied and restore it when the filter set becomes empty, instead of calling frameFilteredCanvas() on clear (web/public/app.js:5543 path).
D4 (P2) Sort sheet uses raw UA buttons. Render sort options with the existing .filter-option treatment or add .sheet-option mirroring it (min-height 44, border, radius, font: inherit, pressed state, theme colours). Applies at 1280 where the sheet is reachable.
D5 (P2) The delivery smoke flakes: 2 of 3 identical runs failed, on a mid-animation opacity (0.225 vs 0.22) and a mid-enter sheet bottom (901.72 vs 900). Fix scripts/generate-delivery-smoke.mjs: wait for document.getAnimations() to settle before measuring, compare the dim opacity with a tolerance, and measure sheet geometry after the enter animation. Then run the smoke three times back to back and show all three passing.
D6 (P3) "Save name" in Settings is 32px tall; give the rename action min-height 44px.
D7 (P3) An unhandled ApiError escapes from the async drag handler (web/public/app.js:3167, 3183). Wrap the awaited save in try/catch; the notice is already set inside the save path.
</defects>
<constraints>
- Keep every accepted behaviour: 128/128 sheet surfaces, applied-filter rail and counts, one phone filter entry, "Fermer"/"Close", Workflows Board naming, 24px rhythm, dependency colours/arrows/labels, reduced motion, phone sidebar by real clicks.
- Invariants: dot grid byte-identical, zero Atelier/n8n/mobile/emoji, no inline style attribute, CSP untouched, no button with both a + icon and "+" text, no new dependency or build step.
- French and English copy both updated.
</constraints>
<verification>
Real Chromium under .agents/run/chamberos-board-v2/verifications/V4-1c/: screenshots and measured JSON at 360/390/768/1280, light and dark, en and fr for: filter applied (readable titles, measured effective font size >= ~9px), dependency focus on the normal fixture (all four readable) AND on a spread fixture (selected card readable at the floor, "Tout afficher (N)" present, and the full fit after pressing it), clear-filter restoring the exact previous pan and scale (numeric before/after), the sort sheet at 1280, and Settings at 360. Three consecutive smoke runs, all passing, with the logs.
Sequential suites with final counts. Update the tests so D1/D2/D3 are regression-covered.
</verification>
<output>
STATUS: PASS | FAIL. COMMITS: SHAs from 6535937. PER_DEFECT: what changed, file:line, and the measurement that proves it closed. SMOKE: three run results. INVARIANTS: proof. TEST_COUNTS. SCREENSHOTS: paths. NOT_VERIFIED.
</output>
