<env_preflight>
Repo: /workspace/code/openchamber-github-task-board
Worktree: /workspace/code/openchamber-github-task-board/.worktrees/workflows-accelerator-agent-dev-wave7-overhaul
Branch: feat/wave7-overhaul
Base: after `wave7b-canvas-flow` lands on `feat/wave7-overhaul`
Test commands:
- node --test --test-timeout=60000 web/tests/wave7c-progress-questions.test.mjs
- node --test --test-timeout=60000 web/tests/*.test.mjs
- npm test
- npm run typecheck && npx tsc -p web/tsconfig.json --noEmit
- npx esbuild web/server.ts --bundle --platform=node --format=esm --target=node20 --packages=external --outfile=/tmp/antigravity/wave7c-server.mjs
- npx esbuild web/public/app.js --bundle --format=iife --target=es2020 --outfile=/tmp/antigravity/wave7c-app.js
Forbidden:
- NEVER touch `/workspace/code/openchamber-config/**`, `/workspace/.openchamber-data/**`, `board.env`, `jwt-secret`, or real GitHub.
- Keep ALL product invariants (zero `"n8n"`, `"mobile"`, emojis; no `+` icon + `"+"` text; strict CSP; EN/FR I18N key parity; no fake/simulated UI).
- NEVER push, deploy, or spawn subagents.
</env_preflight>

<goal>
Close **all** remaining findings from the 2026-11-13 usability audit (`verifications/usability-audit-2026-11-13/README.md`) and the P2 notes from `discovery-legibility-L4b` (`5edb450`) in **Wave 7c — Unified Counts, Progress Visibility & Question Legibility**.
</goal>

<context>
Read first:
- `verifications/usability-audit-2026-11-13/README.md` (Ranked findings #2–#16)
- `.agents/run/chamberos-board-v2/verifications/discovery-legibility-L4b/README.md` (P2-1..P2-7 notes)
- `web/public/app.js`, `web/public/theme.css`, `web/public/index.html`, `web/server/board.ts`
</context>

<requirements>
1. **Single unified "Needs me" count everywhere (Audit #2, #11, #12)**:
   - Define ONE canonical selector `needsHumanAttention(issue)` (for open issues needing user action: `stageOf(issue) === 'needs-human'` OR open unanswered questions OR pending human tasks).
   - Align the sidebar/list "Needs me" / "À traiter" counter, Decisions badge/list (align count with cards or clearly match open items so badge == displayed items or explicitly scoped!), Blocked view & badge (deduplicate issues that satisfy both human-wait and dependency-block so `#109` never appears twice under one count, and resolve the "Blocked" dock vs "Blocked by dependencies" filter ambiguity with distinct labels & accurate counts!).
2. **Explicit Progress Ratios outside the drawer (Audit #3)**:
   - Compute checklist progress `{ done, total }` and question progress `{ answered, total }` cleanly on issues (`board.ts` / `app.js`).
   - Display compact, legible `done/total` checklist and `answered/total` question indicators on **List rows**, **Canvas cards**, and **Collapsed group summaries** (plus checklist header `done/total` inside the drawer), instead of only `"1 comment"`.
3. **Missing vs Malformed Artifact + Plain Human Copy + Reviewable Link Filter (Audit #4, #5, #14)**:
   - Give `missing` (no `### Human Review:` section) and `malformed` (e.g. broken URL / missing preset options) distinct badges/labels and plain human-readable explanations (zero raw schema syntax like `"### Human Review:"`, `"- URL:"`, `"- Artifact:"` in user-facing UI!).
   - Fix `matchesExtraFilter(issue, 'artifact')` ("Reviewable link" / "Lien à consulter") so it matches tasks carrying a real `humanReview` artifact URL (`image`, `video`, `link`) as well as pending item links — count must match actual reviewable tasks (3 vs 0!).
4. **Question & Gate Polish at 390px and Dark Mode (Audit #6, #7, #8, #9, #10, #13, #15, #16)**:
   - Deduplicate "Waiting for you" chrome above the gate (`#6`: remove redundant duplicate label/chip clutter so instruction stands out immediately).
   - Keep the primary `Answer` button **above the fold at 390x844** even when `Details` / free-text input is expanded (`#7`: sticky footer bar or tighter gate layout in drawer).
   - Raise dark-mode contrast for status badges, Blocked/Decisions meta, and canvas card counters from `2.92:1` / `3.66:1` to **`>= 4.5:1`** (`#8`, `#9` in `theme.css`).
   - Fix all French leaks and inconsistent labels (`#10`, `#16`: localize `open`, `phase: execution`, `needs decision`, `Question`, consistent `"1 action humaine"` / `"En attente de vous"`, and remove Operations `Needs human`/`In review` stale wording if present).
   - Clear stale answered-question badge on Canvas (`#13`: answered questions must show `0` pending / not `1 q`).
   - Make a calm drawer when nothing is asked (`#15`: collapse/de-emphasize empty `"Not blocked by any tasks"` / `"Not blocking any tasks"` boilerplate and secondary controls when no action is needed).
5. **Close `discovery-legibility-L4b` P2 notes**:
   - Clear `#scope-status` on generic load error after a discovery failure (`P2-1`), clear `state.discoveryFailure` on `showLogin()` (`P2-5`), disable `#new-task-btn` while discovery is failed (`P2-6`), localize 503 `discovery_unavailable` in Archive/Operations (`P2-3`), and add regression tests for `clearDiscoveryFailure()`, mid-refresh `board.discoveryFailed`, read-503 EN/FR, and non-JSON 403 (`P2-2`, `P2-7`).
</requirements>

<steps>
1. Write failing tests first in `web/tests/wave7c-progress-questions.test.mjs` covering every item above (unified count, no duplicate card in Blocked, checklist/question ratios, missing vs malformed distinct label + non-schema copy, Reviewable link matching artifacts, FR leaks fixed, stale canvas badge cleared, dark-mode contrast token assertions, L4b P2 recovery/403/503 tests).
2. Implement fixes cleanly in `web/server/board.ts` (if needed for summary counts), `web/public/app.js`, `web/public/theme.css`, `web/public/index.html`.
3. Run all test suites (`wave7c-progress-questions.test.mjs`, `web/tests/*.test.mjs`, `npm test`, `npm run typecheck`, `tsc`, `esbuild`).
4. Commit cleanly as `feat(board): unify counts, expose progress ratios and fix question legibility`.
</steps>

<output>
At most 12 lines: STATUS, COMMITS, TEST_COUNTS (focused, web, npm, typecheck, esbuild exit codes), AUDIT_FINDINGS_CLOSED (list #2..#16 + P2-1..P2-7), INVARIANTS_CHECK, NOT_VERIFIED.
</output>
