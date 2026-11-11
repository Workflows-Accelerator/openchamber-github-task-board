<env_preflight>
Repo: /workspace/code/openchamber-github-task-board
Worktree: /workspace/code/openchamber-github-task-board/.worktrees/team-dev-board-v3
Branch: feat/board-v3
Base commit: 28af19b (clean; contains the L4-approved write fix now live as `7339629-20261111`)
Root checkout: /workspace/code/openchamber-github-task-board on branch ops/task-board-activation (DO NOT modify or switch branches in root checkout)
Real Chromium launcher: /workspace/code/openchamber-github-task-board/.worktrees/team-dev-board-v3/.agents/run/chamberos-board-v2/verifications/A-delivery/hostile2/scripts/chromium-env.sh
Test commands (RUN SEQUENTIALLY, never in parallel — parallel CPU contention flakes test/stage1-dual-mode-and-scoping.test.js):
  npm test
  node --test --test-timeout=30000 web/tests/*.test.mjs
  npm run typecheck
  npx esbuild web/server.ts --bundle --platform=node --format=esm --target=node20 --packages=external --outfile=/tmp/opencode/v3-server-check.mjs
  source .agents/run/chamberos-board-v2/verifications/A-delivery/hostile2/scripts/chromium-env.sh && node scripts/generate-delivery-smoke.mjs
Do not touch: panel/**, service/**, dot-grid formula at web/public/app.js:2268 (two-stop radial-gradient — NEVER alter), /workspace/code/openchamber-config/** (READ/EXECUTE only), /workspace/.openchamber-data/** (never read or print secrets), /workspace/releases/** (no deploy in this task), GitHub issues/labels, git push
Do NOT run `git remote -v` or print any URL containing credentials.
Preflight facts are true and authoritative at dispatch: do not run initial discovery commands (git status, pwd, ls) to re-ground on startup. Re-inspect targeted state only for mutations/pre-commit verification, compaction/resume with stale facts, branch/location changes, or action failure.
</env_preflight>

<goal>
Deliver the biggest UX batch from the user's first phone review of the live board: replace the current bottom sheets (filters, settings, and any other) with one coherent sheet system that is legible at 360–430px, make applied filters obvious while working on the Canvas, make dependencies on the Canvas readable at a glance, rename the product from "Atelier" to "Workflows Board", and run a spacing pass across all views.
</goal>

<user_feedback_source>
[@/workspace/code/openchamber-github-task-board/.agents/run/chamberos-board-v2/feedback-2026-11-11-v3-live.md]
Relevant items: F2 (every bottom sheet is ugly, filters unclear in Canvas), F3 (Canvas dependencies not legible), F4 (spacing details), F7 (rename "Atelier").
</user_feedback_source>

<skills>
[@/workspace/code/openchamber-github-task-board/.worktrees/team-dev-board-v3/.agents/skills/frontend-design/SKILL.md]
[@/workspace/code/openchamber-github-task-board/.worktrees/team-dev-board-v3/.agents/skills/ui-skills/SKILL.md]
[@/workspace/code/openchamber-github-task-board/.worktrees/team-dev-board-v3/.agents/skills/web-design-guidelines/SKILL.md]
[@/workspace/code/openchamber-github-task-board/.worktrees/team-dev-board-v3/.agents/skills/impeccable-critique/SKILL.md]
</skills>

<owned_paths>
web/public/index.html
web/public/theme.css
web/public/app.js
web/public/sw.js
web/public/manifest.json
scripts/generate-delivery-smoke.mjs
web/tests/**
.agents/run/chamberos-board-v2/verifications/V4-1/**
</owned_paths>

<scope>
1. Rename the product to "Workflows Board" (decided by the user 2026-11-11):
   - Replace "Atelier" everywhere: `<title>`, `.sidebar-brand-title`, manifest `name`/`short_name`, any aria-label or PWA string. Zero occurrences of "Atelier" must remain anywhere in `web/**` or `scripts/**`.
   - Keep the existing geometric brand mark unless it reads as broken at 14–20px; do not introduce an emoji, an image file, or a font dependency. Wordmark in sentence case, no letter-spacing tricks.
   - Update `sw.js` `CACHE_VERSION` if cached shell strings change.
2. One sheet system, replacing every bottom sheet (filters, settings, and any other sheet currently in the app):
   - Phone (`<=768px`): slides up from the bottom, `max-height: 85dvh`, rounded top corners, drag handle, sticky header (title + close, both `>=44x44px`), scrollable body with `overscroll-behavior: contain`, sticky footer holding the primary action, `padding-bottom: env(safe-area-inset-bottom)`, backdrop with `Escape` and backdrop-tap close, focus trap and focus restore, `prefers-reduced-motion` respected.
   - Desktop (`>=1024px`): same component as a right-side panel (or centered dialog where a panel makes no sense) — no full-width stretched sheets.
   - Zero inline `style="..."` (CSP `style-src 'self'`), zero body scroll bleed, no layout shift when opening.
3. Filters, rebuilt so the Canvas is never ambiguous:
   - Group the filters explicitly (stage, priority, project, dependencies/attention, "has something for me to click" i.e. human-reviewable artifact), one row per group, each option a chip with a live count.
   - Live result count in the sheet footer ("Afficher 12 tâches"), plus "Tout effacer".
   - Always-visible applied-filter bar above the Canvas (and in List), showing one removable chip per active filter and a clear "Filters" button carrying an active indicator; removing a chip re-renders immediately without opening the sheet.
   - Empty result must say what to relax and offer a one-tap reset, never a blank canvas.
4. Settings, rebuilt with the same sheet:
   - Sections: Appearance (theme), Language, Canvas (behaviour that actually exists today), Data and API (rate limit + cache freshness readout already available), About (version). Remove any control that does not do something real. Every toggle must persist and take effect immediately.
5. Canvas dependency legibility (no change to the dot grid, Arrange or Undo):
   - Edges carry meaning: consistent curve, arrowhead at the blocked end, subtle relationship colour, and a label ("bloque #12" / "bloque par #3") shown on selection or hover.
   - Selecting a card dims unrelated cards, highlights its blockers and its dependents in two distinct accents, and shows a small legend.
   - A "Dependencies" toggle in the canvas controls can hide all edges; selection keeps the workspace readable at 360px.
   - Keep the existing layout maths and the topological Arrange intact.
6. Spacing and rhythm pass across Canvas, List, Decisions, Blocked, Operations, Archive, Client view and the drawer: consistent 4/8px rhythm, consistent card padding, consistent vertical gaps between groups, no orphan 1px hairlines.
</scope>

<criteria>
1. Zero "Atelier" remains; the product reads "Workflows Board" in tab title, sidebar, manifest and PWA install name.
2. Every sheet in the app uses the same component and behaviour; in real Chromium at `360x800`, `390x844`, `768x900`, `1280x900`, Light and Dark, EN and FR: sheet opens/closes by button, backdrop and `Escape`; focus moves in and returns to the trigger; no horizontal overflow; no clipped footer; zero console errors and zero CSP violations.
3. On the Canvas at `360x800` FR, an applied filter is visible without opening the sheet, and removing that chip updates the board immediately; the filters sheet shows a live result count and a working "Tout effacer".
4. Selecting a dependency-linked card visibly separates blockers from dependents, unrelated cards dim, and the edge labels are readable at `360px` and `1280px`; the dependencies toggle removes and restores edges; Arrange + Undo still work; `app.js:2268` dot-grid string is byte-identical to the base commit.
5. Settings contains only working controls; changing theme and language from the sheet applies immediately and persists after reload.
6. Zero `"mobile"`, zero `"n8n"`, zero emojis, no button with both a `+` icon and `"+"` text; views still named `Canvas`/`Canevas` and `List`/`Liste`; sidebar navigation intact; `#nav-discussions` still hidden.
7. `npm test` 618/618, all `web/tests/*.test.mjs`, `npm run typecheck`, esbuild, and `scripts/generate-delivery-smoke.mjs` pass, run sequentially. New tests cover the sheet system, the applied-filter bar, and dependency focus.
8. Real Chromium screenshots for filters sheet, settings sheet, applied-filter bar on Canvas, dependency focus, and the renamed brand, at `360x800`, `390x844`, `1280x900`, Light and Dark, EN and FR, under `.agents/run/chamberos-board-v2/verifications/V4-1/screenshots/`. Inspect your own PNGs with the Squint Test before committing.
9. `git diff 28af19b..HEAD -- panel service` is empty. Commit on `feat/board-v3`; do not push; do not deploy.
</criteria>

<output>
Respond in concise structured Markdown with:
- STATUS: PASS | FAIL
- COMMITS: exact SHAs
- DELIVERED: sheet system, filters, settings, dependency legibility, rename, spacing — each with file:line anchors
- MEASUREMENTS: sheet geometry and focus behaviour per viewport; dependency dim/opacity values; filter bar behaviour
- INVARIANTS: dot-grid byte check, banned-string greps, CSP, view names
- TEST_COUNTS: legacy, web, typecheck, bundle, smoke — sequential
- SCREENSHOTS: paths
- NOT_VERIFIED: honest blind spots
</output>
