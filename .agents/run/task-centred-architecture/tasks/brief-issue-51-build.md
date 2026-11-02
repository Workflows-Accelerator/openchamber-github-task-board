<env_preflight>
Repo: /workspace/extensions/github-task-board
Worktree: /workspace/extensions/github-task-board/.worktrees/team-dev-issue-51-toolbar-controls
Branch: fix/issue-51-toolbar-controls, HEAD f0dae5b (branched cleanly on top of accepted #50 fix/issue-50-host-connection), clean, node_modules symlinked.
Preflight facts are authoritative at dispatch: skip initial pwd/ls/git status discovery.
Setup: on startup you may register this worktree in `~/.local/share/antigravity/antigravity.db` (or `~/.local/share/opencode/opencode.db` if present) per the worktree-lifecycle skill; do not install deps or copy .env files.
Files to inspect: panel/index.html (specifically lines 105-145, 3070-3115, 3420-3520), panel/main.ts (only if needed for class/attribute wiring — prefer pure CSS in panel/index.html if sufficient), test/shipped-parity.test.js, test/panel-simple-views.test.js.
Test commands: npm run build ; npm run typecheck ; node --test test/toolbar-controls.test.js test/panel-service-connection.test.js test/panel-simple-views.test.js test/shipped-parity.test.js ; npm test
Do not touch: service/**, web/**, package.json, package-lock.json, #50 caller logic in panel/main.ts, root checkout, other worktrees.
Secrets wall: never read /workspace/.openchamber-data/**, .env*, board.env, credential/cookie/session files, process environments, git remote URLs or `git remote -v`. No live GitHub calls/writes, label updates, task creation, agent starts, host toggles/restarts, production data. Zero emojis anywhere.
</env_preflight>
<goal>
Implement Issue #51's narrow toolbar styling repair in `panel/index.html` (and `panel/main.ts`/`panel/main.js` only if minimally required), verify with automated tests plus real Chromium 156.0 and Obscura 0.2.5 visual screenshots at 1280px, 980px and 360px in dark and light themes, and record empirical proof.
</goal>
<context_files>
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/runtime-boundary/verifications/proof.md]
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/outputs/extension-repairs-approval.md]
</context_files>
<skills>
[@/workspace/config/opencode/.agents/skills/build/methodology/test-driven-development/SKILL.md]
[@/workspace/config/opencode/.agents/skills/build/implementation/lean-build/SKILL.md]
[@/workspace/config/opencode/.agents/skills/communication/terse/caveman-lite/SKILL.md]
</skills>
<owned_paths>
panel/index.html
panel/main.ts
panel/main.js
test/toolbar-controls.test.js
.agents/run/issue-51-build/**
</owned_paths>
<depends_on>
issue-50 (f0dae5b, already in branch history)
</depends_on>
<criteria>
1. Exact 3 defects to fix (no toolbar redesign, no restored removed controls, no behavior changes):
- Defect 1 (`#selectSort`): Currently an unstyled native `<select id="selectSort" class="toolbar-sort-select">` that gets native UA gray in Chromium (`rgb(107,107,107)` / `rgb(239,239,239)`) and white-on-white (`rgb(255,255,255)` bg with `rgb(240,242,245)` light text) in Obscura dark mode. Reuse the panel's existing toolbar button/select styling tokens (`background: var(--bg-elev)`, `color: var(--fg)`, `border: 1px solid var(--border)`, `border-radius: var(--radius-xs)`, `height: 28px`, `font-size: 11px`, `font-weight: 500`, `color-scheme` or explicit `<option>` background/color so dropdown options are also readable in both dark and light themes, focus-visible ring matching toolbar buttons).
- Defect 2 (`#txtRepoLabel` / `#btnRepoSelect`): Button centers text (`justify-content: center` on `button`) and `#txtRepoLabel` overflows horizontally at 360px (`scrollWidth > clientWidth`), clipping the START of the project label (`ecting repo...`). Fix so project labels retain the start of their text (`text-align: left`, `justify-content: flex-start` on `.repo-select-btn`, `min-width: 0` on `#txtRepoLabel` / flex container as needed) and truncate only the end (`text-overflow: ellipsis; overflow: hidden; white-space: nowrap;`), while preserving the full repository tooltip (`title`) and dropdown caret.
- Defect 3 (`#btnViewSelect` / `.toolbar-dropdown-wrap`): View button label gets crowded (`clientWidth < scrollWidth` in compact flex layout) or clips. Ensure `#btnViewSelect` / `.toolbar-view-btn` keeps appropriate padding/space (`flex-shrink: 0` or sufficient `min-width`/`white-space: nowrap` without causing horizontal viewport overflow `document.documentElement.scrollWidth <= window.innerWidth` at 1280px, 980px, and 360px, including when a very long project label is active).
2. Preservations:
- View, Filter, and Sort interactive behaviors, focus states, ARIA attributes, and keyboard access are unchanged; no controls are added or restored.
- #50's background service connection check in `panel/main.ts` remains completely intact.
- If `panel/main.ts` is touched or if tests inspect `panel/main.js`, run `npm run build` so bundles stay in sync.
3. Verification (TDD + Browser Proof):
- Write `test/toolbar-controls.test.js` (RED before CSS fix, GREEN after) verifying the CSS/DOM contract in `panel/index.html` for `#selectSort`, `.repo-select-btn` / `#txtRepoLabel`, and `#btnViewSelect`, plus absence of removed legacy controls.
- Run a local read-only synthetic harness (no live GitHub calls, no production host credentials) driving both Standard Chromium Headless Shell (`/workspace/.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell` via Playwright) and Obscura (if available on port 9333 or CLI) across 1280px, 980px, and 360px in both dark and light themes, testing both default label (`Selecting repo...`) and a long project name (e.g., `Workflows-Accelerator/openchamber-github-task-board-extended-name` with tooltip).
- Assert and record in `.agents/run/issue-51-build/verifications/proof.md`:
  - Computed background and text color of `#selectSort` in dark and light themes (never white-on-white; matches theme surface/foreground with readable contrast).
  - `#txtRepoLabel` `text-align: left`, `.repo-select-btn` `justify-content: flex-start`, end-truncation only, full `title` tooltip preserved.
  - `#btnViewSelect` not clipped (`scrollWidth <= clientWidth`), and zero horizontal page overflow (`documentElement.scrollWidth <= innerWidth`) at 1280px, 980px, and 360px.
  - Read-only interaction & keyboard focus checks on View, Filter, Sort, and Repo buttons with zero page/console errors.
  - Save screenshots under `.agents/run/issue-51-build/verifications/screenshots/` and inspect them visually with `read` to verify they actually look clean.
  - Explicitly distinguish Chromium 156.0 results from Obscura results and state that actual authenticated OpenChamber parent host styling remains unverified (awaiting L5).
</criteria>
<steps>
<step>Inspect panel/index.html around lines 105-145, 3070-3115, 3420-3520 to identify the exact CSS rules for .repo-select-btn, #txtRepoLabel, .toolbar-view-btn / #btnViewSelect, and .toolbar-sort-select / #selectSort.</step>
<step>Write failing test/toolbar-controls.test.js and confirm RED.</step>
<step>Apply the minimal CSS fix in panel/index.html (and rebuild if needed), confirm test/toolbar-controls.test.js GREEN, and commit locally.</step>
<step>Run real browser verification across 1280px, 980px, and 360px in dark and light themes (with short and long repo labels), capture and read screenshots, and verify computed styles, truncation, overflow, and keyboard focus.</step>
<step>Run npm run build, npm run typecheck, and full npm test; write .agents/run/issue-51-build/verifications/proof.md and commit locally.</step>
</steps>
<verification>
npm run build && npm run typecheck && node --test test/toolbar-controls.test.js test/panel-service-connection.test.js test/panel-simple-views.test.js test/shipped-parity.test.js && npm test
</verification>
<output>
Local atomic commits on fix/issue-51-toolbar-controls (do not push). Return <=12 lines: status; commits created; files changed; computed style/layout measurements (Sort bg/fg, Repo alignment/truncation, View fit, 360px viewport overflow); screenshot count + path; test suite pass count; actual provider/model.
</output>
