<env_preflight>
Repo: /workspace/extensions/github-task-board
Worktree: /workspace/extensions/github-task-board/.worktrees/team-dev-issue-46-mobile-parity-offline
Branch: feat/issue-46-mobile-parity-offline (based on master @ 8df6d7b)
Test command: node --test test/*.test.js && node --test web/tests/*.test.mjs
Do not touch: config files, secrets, container configs
</env_preflight>

<goal>
Implement Batch 1 of the mobile overhaul:
1. Remove 'Align Drafts' button from the standalone web board (`web/public/index.html` & `web/public/app.js`), preserving and refining it strictly in the OpenChamber panel extension (`panel/main.ts` & `panel/index.html`) with sleek progress feedback.
2. Full mobile & web task detail parity in `web/public/app.js`: parse friendly output titles, tap cards to open a mobile-friendly Task Details Drawer, answer questions inline, toggle Acceptance Criteria & Subtasks checkboxes with line-index precision, and transition status to Done.
3. Offline quick-add drafting in `web/public/app.js`: automatically queue drafts in `localStorage` when offline or on network failure with an `(offline)` badge, and auto-sync to GitHub when connection returns.
4. Polished PWA icons: create `icon.svg`, `icon-192.png`, `icon-512.png`, and `apple-touch-icon.png` (180x180), and register in `manifest.json` and `index.html`.
5. Maintain 100% test pass rate across all existing unit tests and add new tests for offline drafting and drawer interaction.
</goal>

<context_files>
/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/decisions-batch-mobile-parity.md
/workspace/extensions/github-task-board/panel/core.ts
/workspace/extensions/github-task-board/panel/main.ts
/workspace/extensions/github-task-board/panel/index.html
/workspace/extensions/github-task-board/web/public/app.js
/workspace/extensions/github-task-board/web/public/index.html
/workspace/extensions/github-task-board/web/public/theme.css
/workspace/extensions/github-task-board/web/public/manifest.json
/workspace/extensions/github-task-board/web/tests/app.test.mjs
</context_files>

<steps>
1. Symlink node_modules:
   `ln -s /workspace/extensions/github-task-board/node_modules node_modules`

2. Align Drafts surface scoping:
   - Remove `#btnAlignDrafts` from `web/public/index.html` and `web/public/app.js`.
   - Update `web/tests/app.test.mjs` to reflect that the standalone web board no longer exposes the batch align button.
   - Refine `#btnAlignDrafts` in `panel/index.html` and `panel/main.ts`: sleek styling, disabled state with spinner/text `Aligning (X drafts)...` while in-flight, and clear toast on completion `Aligned X drafts to Backlog`.

3. Web & Mobile Task Detail Drawer & Parity:
   - In `web/public/app.js`:
     - Add `parseFriendlyTitle` to render human-readable output title on task cards, showing the raw technical title as a muted subtitle.
     - Add markdown checklist parser for `Acceptance Criteria` and `Actionable Subtasks` and open questions parser.
     - Add task detail drawer modal: tapping any task card slides open a mobile drawer displaying friendly title, status badge, repo pill, overview text, interactive checkboxes for Acceptance Criteria and Subtasks, open question answer inputs, and a 'Mark Done' action.
     - Toggling checkboxes sends a PATCH request updating the issue markdown body cleanly.
     - Answering questions sends a PATCH request submitting the answer.
   - In `web/public/theme.css`:
     - Style `.task-drawer`, `.drawer-backdrop`, checklists, and question inputs with >=44px touch targets and safe-area padding for mobile.

4. Offline Quick-Add Drafting:
   - In `web/public/app.js`:
     - If `!navigator.onLine` or fetch throws a network error during quick-add, catch and persist to `localStorage` key `openchamber_offline_drafts`.
     - Render offline drafts into the Drafts column immediately with an `(offline)` badge.
     - On `online` event or next page load, call `syncOfflineDrafts()` to send pending drafts to `POST /api/repos/:owner/:repo/issues`, update state, and remove from `localStorage`.

5. Polished PWA Icons:
   - Create clean, professional icons: `icon.svg`, `icon-192.png`, `icon-512.png`, `apple-touch-icon.png`.
   - Update `web/public/manifest.json` and `web/public/index.html`.

6. Build and verify:
   - `npm run build:panel`
   - `npm run build:service`
   - `npx esbuild web/server.ts --bundle --platform=node --format=esm --target=node20 --packages=external --outfile=web/dist/server.mjs`
   - `node --test test/*.test.js`
   - `node --test web/tests/*.test.mjs`
   - Write new test suite `test/offline-drafts.test.js` and `test/web-drawer-parity.test.js` verifying the new behavior.
</steps>

<output>
Report:
- Files modified
- Test results (tests passed, 0 failures)
- Build status of panel and web bundles
- Hostile review self-check for edge cases (malformed markdown, offline sync errors, iOS viewport bounds)
</output>
