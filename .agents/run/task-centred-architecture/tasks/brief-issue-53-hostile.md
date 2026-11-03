<env_preflight>
Repo: /workspace/extensions/github-task-board
Worktree: /workspace/extensions/github-task-board/.worktrees/team-dev-issue-53-openchamber-look (branch feat/issue-53-openchamber-look @ 764bd08b408cdb8eb7a12790d059d4fa3a07c10f, base 4606b45).
Do not touch: `panel/**`, `service/**`, `/workspace/releases/board/**`, live processes, port 3000, `/workspace/.openchamber-data/**`, `.env*`, credentials, `/proc/*/environ`, or live GitHub. Never run `git remote -v`. No git push. Zero emojis.
</env_preflight>
<goal>
Conduct a hostile review of any edits or changes that were made in commit `764bd08b408cdb8eb7a12790d059d4fa3a07c10f` to figure out what might have been missed or what might be broken. Don't assume that what was done is right.
Inspect the captured screenshots `.agents/run/issue-53-build/screenshots/01-desktop-dark-board.png` through `07-mobile-detail-drawer.png` directly — they contain severe visual defects that the builder's automated checks completely missed. Fix every single one and prove the fixes visually by inspecting the regenerated screenshots.
</goal>
<context_files>
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/tasks/brief-issue-53-build.md]
[@/workspace/extensions/github-task-board/.worktrees/team-dev-explore-online-board-polish/.agents/run/online-board-polish-explore/screenshots/panel-1280-dark.png]
[@/workspace/extensions/github-task-board/.worktrees/team-dev-explore-online-board-polish/.agents/run/online-board-polish-explore/screenshots/panel-360-dark.png]
[@/workspace/extensions/github-task-board/.worktrees/team-dev-explore-online-board-polish/.agents/run/online-board-polish-explore/screenshots/panel-drawer-1280-dark.png]
[@/workspace/extensions/github-task-board/.worktrees/team-dev-issue-53-openchamber-look/.agents/run/issue-53-build/screenshots/01-desktop-dark-board.png]
[@/workspace/extensions/github-task-board/.worktrees/team-dev-issue-53-openchamber-look/.agents/run/issue-53-build/screenshots/03-desktop-detail-drawer.png]
[@/workspace/extensions/github-task-board/.worktrees/team-dev-issue-53-openchamber-look/.agents/run/issue-53-build/screenshots/06-mobile-board.png]
panel/index.html
panel/main.ts
web/public/index.html
web/public/theme.css
web/public/app.js
web/tests/issue-53-openchamber-look.test.mjs
</context_files>
<skills>
[@/workspace/config/opencode/.agents/skills/review/adversarial/doubt-driven-development/SKILL.md]
[@/workspace/config/opencode/.agents/skills/review/quality/code-review-and-quality/SKILL.md]
</skills>
<scope>
1. Read the reference OpenChamber panel screenshots (`panel-1280-dark.png`, `panel-360-dark.png`, `panel-drawer-1280-dark.png`) and compare them against the broken `01-desktop-dark-board.png` .. `07-mobile-detail-drawer.png` screenshots. You MUST fix at minimum these 7 visual and functional blockers, plus anything else your hostile audit uncovers:
   - **Blocker 1 (Giant 400px unstyled SVG icon covering the screen):** The SVG inside the repo selector button lacks explicit `width="14" height="14"` attributes AND explicit CSS `width: 14px; height: 14px; flex-shrink: 0;` in `theme.css`, so the browser expands the `<svg viewBox="0 0 16 16">` to ~400px across the page! Every SVG in `index.html` and `app.js` MUST have explicit `width` and `height` attributes AND CSS bounding rules (`svg { width: 14px; height: 14px; flex-shrink: 0; }`), and the repo button text (`All Projects` / short project name) must be visibly rendered inside the compact pill button (like `panel-1280-dark.png`).
   - **Blocker 2 (Simple list task rows are broken, centered, invisible titles, and 3 lines tall):** Look at `01-desktop-dark-board.png` and `06-mobile-board.png` vs `panel-1280-dark.png`:
     - In `01-desktop-dark-board.png`, `.simple-dot` is floating in the horizontal center of the page (`x=640px`), the task titles are not even visible on desktop, on mobile they are clipped horizontally off the left edge (`...rd matches OpenChamber...`) with raw `### Actionable Subtasks` markdown headers in the preview, and the `.simple-row-meta` (`Task Board #53`) sits on a separate line below!
     - Fix `.simple-row` layout so it matches the OpenChamber panel (`panel/index.html` / `panel-1280-dark.png`): left-aligned horizontal flex row (`display: flex; align-items: center; justify-content: flex-start; gap: 10px; width: 100%; text-align: left;`) where:
       - `.simple-dot` is on the far left (`x < 32px`, `width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0;`),
       - `.simple-row-main` (`flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; align-items: flex-start; text-align: left;`) holds the visible `.simple-row-title` (`font-size: 13px; font-weight: 500; color: var(--fg); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%;`) and optional 1-line clean description preview `.simple-row-desc` (`font-size: 12px; color: var(--fg-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%;` — strip markdown headings like `## Overview` / `### Actionable Subtasks` so only clean plain-text preview shows, or omit if empty),
       - `.simple-row-meta` sits on the right side of the same row (`margin-left: auto; flex-shrink: 0; display: flex; align-items: center; gap: 6px;`).
   - **Blocker 3 (`#settings-popover` / "Done" box is visible on the page when closed!):** Look at `01-desktop-dark-board.png` and `06-mobile-board.png`: there is a big rounded white/gray card at the bottom-left with a `[Done]` button! That happens because `#settings-popover` (or a popover/dialog) has a CSS rule like `.settings-popover { display: flex; ... }` that overrides the HTML `[hidden]` attribute (`[hidden] { display: none !important; }` is missing or overridden)! Ensure `[hidden] { display: none !important; }` is enforced globally in `web/public/theme.css` so no hidden popover, modal, backdrop, or view ever renders when `hidden` is present.
   - **Blocker 4 (Dark theme was NOT dark in `01-desktop-dark-board.png`!):** Look at `01-desktop-dark-board.png`: the background is light gray (`#f4f5f7`), identical to `04-desktop-light-board.png`! Why? Because in Obscura headless browser, `prefers-color-scheme` defaults to `light`, and `:root` had `@media (prefers-color-scheme: light)` overriding `:root`, while `data-theme="dark"` either wasn't set or was overridden by the `@media (prefers-color-scheme: light)` block!
     - Check CSS specificity and order in `web/public/theme.css`: if `:root[data-theme="dark"]` appears BEFORE `@media (prefers-color-scheme: light) { :root:not([data-theme="light"]) { ... } }`, the media query overwrites `data-theme="dark"`!
     - Furthermore, what should the default theme be when the user has not chosen a preference? Look at OpenChamber (`panel-1280-dark.png`) and `index.html` (`<meta name="theme-color" content="#0f1012">`): in `theme.css`, `:root` should define the OpenChamber Dark palette (`--bg: #0f1012`, `--surf: #16181b`, `--fg: #f0f2f5`, etc.), `@media (prefers-color-scheme: light) { :root:not([data-theme="dark"]) { ... light tokens ... } }` applies light tokens ONLY when `data-theme` is NOT `"dark"`, AND explicit `:root[data-theme="dark"]` and `:root[data-theme="light"]` blocks come AFTER the `@media` block so an explicit theme always wins!
     - Verify in the Obscura harness that `01-desktop-dark-board.png` and `06-mobile-board.png` actually render in dark mode (`#0f1012` dark background, light text `#f0f2f5`), and `04-desktop-light-board.png` renders in light mode (`#f4f5f7` / `#ffffff`).
   - **Blocker 5 (Detail drawer `z-index` and header bleed-through in `03-desktop-detail-drawer.png`):** Look at `03-desktop-detail-drawer.png`: the main board's top toolbar (`View: Simple list`, `Filter`, `Sort: Priority`, `Settings`, `Sign out`) and task row `#53`/`#54`/`#55` badges are bleeding right on top of the open `#detail-view` drawer!
     - `#drawer-backdrop` must cover the entire viewport (`position: fixed; inset: 0; z-index: 900; background: rgba(0, 0, 0, 0.45);`) and `#detail-view` must sit above everything (`position: fixed; top: 0; right: 0; bottom: 0; width: min(480px, 100vw); z-index: 1000; background: var(--surf); border-left: 1px solid var(--border); overflow-y: auto;`) so nothing from `#board-view` or `#board-toolbar` ever bleeds through or overlaps `#detail-view`.
     - Also style `#detail-view` to look like OpenChamber's sleek drawer (`panel-drawer-1280-dark.png`): compact header with `#<num>`, GitHub link, and close `×` / `Back to board` button, uppercase muted section labels (`ACCEPTANCE CRITERIA`, `SUBTASKS CHECKLIST`, `OVERVIEW`, `OPEN QUESTIONS`, `WORKFLOW STATUS`, `HUMAN TASKS`) with clean compact dark/light surfaces instead of giant white rounded cards.
   - **Blocker 6 (Quick-add draft row at bottom of Simple list):** Verify that the inline quick-add draft row at the bottom of Simple list (and draft reordering / project transfer controls) is visible, cleanly styled in OpenChamber's compact row style, and works end-to-end.
   - **Blocker 7 (Harnesses must assert real visual geometry, not weak checks):** Update `web/tests/issue-53-openchamber-look.test.mjs` and `.agents/run/issue-53-build/harnesses/verify-openchamber-look.mjs` so they assert:
     - Every `<svg>` bounding box has `width <= 24` and `height <= 24`.
     - `#settings-popover`, `#filter-popover`, `#view-popover`, and `#drawer-backdrop` have `getComputedStyle(el).display === 'none'` (`offsetHeight === 0`) when `[hidden]` is present.
     - In Simple list view, `.simple-dot` has `rect.left < 40`, `.simple-row-title` has `rect.width > 100` and non-empty visible text on screen (`rect.left >= 20 && rect.right <= window.innerWidth`), and `.simple-row` is a single compact row (`rect.height <= 56`).
     - When `#detail-view` is open at 1280px, `document.elementFromPoint(1200, 20)` and `document.elementFromPoint(1200, 150)` are inside `#detail-view` (proving no toolbar or task row bleeds over the drawer).
     - In dark mode (`data-theme="dark"`), `getComputedStyle(document.body).backgroundColor` is `rgb(15, 16, 18)` (`#0f1012`), and in light mode (`data-theme="light"`), it is `rgb(244, 245, 247)` (`#f4f5f7`).
2. After fixing all defects, regenerate all screenshots in `.agents/run/issue-53-build/screenshots/` AND read/inspect every regenerated screenshot image file yourself using the `read` tool to visually confirm it looks like `panel-1280-dark.png`, `panel-360-dark.png`, and `panel-drawer-1280-dark.png` with zero visual glitches.
3. Run all test suites (`node --test web/tests/*.test.mjs`, `npm test`, both `tsc --noEmit`, `verify-openchamber-look.mjs`, and `verify-no-flash.mjs`).
4. Write `<worktree>/.agents/run/issue-53-hostile/verifications/proof.md` documenting all findings and fixes, and commit on `feat/issue-53-openchamber-look`.
</scope>
<output>
Return <=12 lines: findings found & fixed; confirmation that regenerated screenshots were visually inspected with `read`; test & Obscura counts; Spec Compliance (PASS/FAIL) and Code Quality (APPROVED/NEEDS-FIXES); commit hash; actual provider/model.
</output>
