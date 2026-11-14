<env_preflight>
Repo: /workspace/code/openchamber-github-task-board
Worktree: /workspace/code/openchamber-github-task-board/.worktrees/workflows-accelerator-agent-dev-wave7b-canvas-l4
Branch: feat/wave7b-canvas-l4
HEAD: f66ce54 (base 4fba1fd)
Mode: Adversarial audit. You may write ONLY: `web/tests/wave7b-canvas-flow.test.mjs`, `web/public/app.js`, `web/public/theme.css`, `web/public/index.html`, `web/public/sw.js`, `web/server/app.ts`, and your report under `.agents/run/chamberos-board-v2/verifications/wave7b-canvas-L4/`.
Forbidden:
- NEVER touch `/workspace/code/openchamber-config/**`, `/workspace/.openchamber-data/**`, `board.env`, `jwt-secret`, or real GitHub.
- NEVER push, deploy, or spawn subagents. Do NOT merge into `feat/wave7-overhaul`; your branch stays separate.
Test commands:
- node --test --test-timeout=60000 web/tests/wave7b-canvas-flow.test.mjs
- node --test --test-timeout=60000 web/tests/*.test.mjs
- npm test
- npm run typecheck && npx tsc -p web/tsconfig.json --noEmit
- npx esbuild web/public/app.js --bundle --format=iife --target=es2020 --outfile=/tmp/antigravity/wave7b-l4-app.js
</env_preflight>

<goal>
Conduct a hostile review of `4fba1fd..f66ce54` (Wave 7b canvas flow overhaul). The implementing worker admitted that "4 spec assertions were wrong" and it "fixed them in the test file, not by weakening app code" — treat that claim as UNPROVEN and prove or disprove it. Do not assume anything in the commit is correct.
</goal>

<attack_checklist>
1. Inspect `git show f66ce54` completely, then read the final `web/public/app.js` canvas section, `web/public/theme.css`, `web/public/index.html`, `web/public/sw.js`, `web/server/app.ts`, `web/tests/wave7b-canvas-flow.test.mjs`.
2. **Prove or disprove the test-weakening claim.** Diff `web/tests/wave7b-canvas-flow.test.mjs` against the version in the worker's earlier commits if present (`git log --oneline 4fba1fd..f66ce54`), and judge whether the 4 changed assertions genuinely described impossible/wrong behaviour or whether they were relaxed to make failing app code pass. Quote the before/after of each changed assertion in your report and give a verdict per assertion.
3. **Attack the flow graph itself:**
   - With 345 issues across 27 repos: does `renderCanvasIssues` still iterate and create DOM for every card (performance cliff), or does it truly render collapsed groups? What is the node count in the DOM for the default collapsed state?
   - Are dependency wires still correct when one endpoint is inside a collapsed group (dangling/overlapping wires, wires to group nodes)?
   - Does `arrangeFlowGraph` get real `parentKey` data (from `4fba1fd` server work) or does it fall back to "Standalone" for everything in practice?
   - Pan/zoom/dot grid: is the non-growing two-stop dot grid preserved (grep the CSS/JS and check the transform math)?
   - Sticky notes: do they still follow their card when cards are laid out by the flow engine and when groups collapse/expand?
4. **Attack layout persistence:**
   - `PATCH /api/layout` on every drag — is it debounced, or does a drag storm hammer the server? Any race where an older response overwrites a newer local position?
   - Does a failed `PATCH /api/layout` surface a localized EN/FR error, or fail silently?
   - Does `order: null` reset actually clear `<!-- board-order: N -->` without damaging the rest of the body (and is it covered by a test)?
   - Confirm zero GitHub writes on drag/arrange (grep for issue PATCH calls in the drag path).
5. **Attack CSP and invariants:** zero `style="` attributes added, zero inline `<style>`, `style-src 'self'` unchanged, no `n8n`/`mobile`/emoji in changed files, `#empty-state` clean on `state.board === null`, animated ring respects `prefers-reduced-motion: reduce` and is visually distinct from steady `in-progress`.
6. **Attack the server route:** `/flow-layout.js` served with correct content-type, added to `sw.js` `SHELL_ASSETS` and network-first list (stale-cache risk if missed), and `web/tests/sw.test.mjs` still meaningful (did it get updated to assert the new file, or weakened?).
7. Run every test command. If you find a genuine defect, add a failing test first, fix it, and commit as `fix(canvas): harden flow graph after hostile review`. If you find only P2 notes, record them and commit only your report.
8. Write `.agents/run/chamberos-board-v2/verifications/wave7b-canvas-L4/README.md` with per-finding severity and evidence, and commit only that directory (plus any fixes).
</attack_checklist>

<output>
At most 12 lines: SPEC_VERDICT (PASS/FAIL), QUALITY_VERDICT, PUBLISH_VERDICT (YES/NO), TEST_WEAKENING (per-assertion verdict), FINDINGS (P0/P1/P2 or NONE), DOM_NODE_COUNT_DEFAULT, TEST_COUNTS, COMMIT, NOT_VERIFIED.
</output>
