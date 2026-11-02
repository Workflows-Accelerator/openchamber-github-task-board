<env_preflight>
Repo: /workspace/extensions/github-task-board
Worktree: /workspace/extensions/github-task-board/.worktrees/team-dev-issue-51-toolbar-controls
Branch: fix/issue-51-toolbar-controls, HEAD 54700cb (builder commits 7be537d code/test, 54700cb proof+screenshots), clean. Built on accepted #50 head f0dae5b. Base master ab7516c4a3634c3d69f7b82936ddb7655d327ebb.
Preflight facts are authoritative at dispatch: skip initial pwd/ls/git status discovery.
Files to inspect: git diff f0dae5b..HEAD -- panel/ test/ ; .agents/run/issue-51-build/verifications/proof.md ; .agents/run/issue-51-build/verifications/screenshots/* ; .agents/run/issue-51-build/verifications/run-verify.mjs (if present).
Test commands: npm run build ; npm run typecheck ; node --test test/toolbar-controls.test.js test/panel-service-connection.test.js test/panel-simple-views.test.js test/shipped-parity.test.js ; npm test
Do not touch: service/**, web/**, package.json, package-lock.json, #50 caller logic in panel/main.ts (checkBackgroundServiceConnection and its wiring), root checkout, other worktrees.
Secrets wall: never read /workspace/.openchamber-data/**, .env*, board.env, credential/cookie/session files, process environments, git remote URLs or `git remote -v`. No live GitHub calls/writes, label updates, task creation, agent starts, host toggles/restarts, production data. Do not use port 3000 (password-protected real OpenChamber UI). Do not install system packages. Zero emojis.
</env_preflight>
<goal>
Conduct a hostile review of any edits or changes that were made for #51 to figure out what might have been missed or what might be broken. Don't assume that what was done is right.
</goal>
<context_files>
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/tasks/brief-issue-51-build.md]
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/runtime-boundary/verifications/proof.md]
[@/workspace/extensions/github-task-board/.worktrees/team-dev-issue-51-toolbar-controls/.agents/run/issue-51-build/verifications/proof.md]
</context_files>
<skills>
[@/workspace/config/opencode/.agents/skills/review/adversarial/doubt-driven-development/SKILL.md]
[@/workspace/config/opencode/.agents/skills/verify/ladder/verification-levels/SKILL.md]
[@/workspace/config/opencode/.agents/skills/communication/terse/caveman-lite/SKILL.md]
</skills>
<owned_paths>
panel/index.html
test/toolbar-controls.test.js
.agents/run/issue-51-build/**
</owned_paths>
<criteria>
1. Distrust the builder's 618/618 and 0px-overflow claims: read `git diff f0dae5b..HEAD -- panel/ test/` line by line and run the verification commands yourself.
2. Stress-test specifically (each item gets a finding: defect / not a defect, with evidence):
- Browser engines: the builder reports Chromium headless shell failed (missing libglib-2.0.so.0) and only Obscura 0.2.5 was verified. Try to get a real Chromium-family engine running WITHOUT installing system packages (e.g. other binaries under /workspace/.cache/ms-playwright/, a bundled chromium, LD_LIBRARY_PATH to libs already on disk, Obscura CDP via Playwright connectOverCDP). If none works, state that explicitly with the exact error; never present Obscura results as Chromium results.
- `color-scheme: dark light` on `#selectSort`: in the LIGHT theme does the native options popup render dark (wrong scheme)? Should color-scheme follow the active theme (e.g. per-theme value) or should explicit `option` background/color cover it? Verify computed `color-scheme` per theme.
- Hover `border-color: rgba(255,255,255,0.18)` is effectively invisible on the light theme surface. Should hover use an existing theme token instead? Fix if it is a real regression vs. other toolbar buttons.
- New `:root` aliases `--bg-elev: var(--surf)` and `--radius-xs: var(--rad-sm)`: are they defined for BOTH dark and light themes (does light theme override `--surf`)? Do they collide with any existing variable names or change any other element? Prefer existing tokens directly if aliases add nothing.
- Redundant selectors (`.sort-control select, .toolbar-sort-select, #selectSort`; `.btn-view-select` / `.toolbar-view-btn`; `.repo-btn, .repo-select-btn`): do the classes `.sort-control`, `.btn-view-select`, `.repo-btn` even exist in the markup? Does any rule now restyle an element it should not (e.g. other selects in a `.sort-control`, other `.repo-btn` elements in dialogs)? Remove dead selectors.
- View button padding changed to `0 18px 0 8px`: is the caret still positioned correctly and the label not clipped in every view mode label (Simple list, Cards, Kanban board, Graph, Pending items)?
- `.repo-select-btn` `max-width` at 360px: does a long project name truncate at the END only, keep the caret visible, keep the full `owner/repo` in `title`, and leave View/Filter/Sort reachable without wrapping into a broken layout?
- Re-inspect EVERY screenshot in `.agents/run/issue-51-build/verifications/screenshots/` with `read` (especially 1280px dark long-label). Report anything that looks wrong; do not trust the proof's descriptions.
- Are focus-visible rings present for Sort, View, Filter and Repo in both themes? Are ARIA attributes and keyboard behavior unchanged (diff panel/main.ts/main.js: should be untouched)?
- Does `test/toolbar-controls.test.js` assert real behavior or just grep for strings that would pass even if the CSS were broken (tautology)? Strengthen if needed.
- `npm run build` leaves the tree clean (bundles consistent). Zero-emoji compliance on changed files.
3. If you find ANY real defect or test tautology: fix it minimally in owned paths, re-run tests and the browser harness, recapture affected screenshots, commit atomically. Record every finding and its resolution in `.agents/run/issue-51-build/verifications/proof.md` under `### Hostile Findings (L4)`, including a clearly separated Chromium vs Obscura section and the statement that the real authenticated OpenChamber parent host styling remains unverified.
4. Give two explicit verdicts: Spec (PASS / PARTIAL / FAIL) and Quality (APPROVED / NEEDS-FIXES).
</criteria>
<verification>
npm run build && git status --short && npm run typecheck && node --test test/toolbar-controls.test.js test/panel-service-connection.test.js test/panel-simple-views.test.js test/shipped-parity.test.js && npm test
</verification>
<output>
Commit fixes and the updated proof locally on fix/issue-51-toolbar-controls (do not push). Return <=12 lines: Spec verdict; Quality verdict; findings found + fixed; Chromium status (worked / unavailable + exact error); screenshots re-inspected count + anything wrong; build/clean-tree check; test counts; head commit hash; actual provider/model.
</output>
