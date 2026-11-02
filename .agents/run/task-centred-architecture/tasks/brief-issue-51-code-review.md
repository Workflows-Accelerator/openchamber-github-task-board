<env_preflight>
Repo: /workspace/extensions/github-task-board
Worktree: /workspace/extensions/github-task-board/.worktrees/team-dev-issue-51-toolbar-controls
Branch: fix/issue-51-toolbar-controls, HEAD 7b7bbc5 (after L4 hostile review), clean. #51 base f0dae5b (accepted #50). Master ab7516c4a3634c3d69f7b82936ddb7655d327ebb.
Preflight facts are authoritative: skip initial pwd/ls/git status discovery.
Files to audit (read-only): git diff f0dae5b..HEAD -- panel/ test/ ; .agents/run/issue-51-build/verifications/proof.md (incl. "Hostile Findings (L4)") ; .agents/run/issue-51-build/verifications/screenshots/*.
Test commands: npm run typecheck ; node --test test/toolbar-controls.test.js test/panel-service-connection.test.js test/panel-simple-views.test.js test/shipped-parity.test.js ; npm test
Do not touch: ANY application, test, build, or plan file. Strictly read-only independent auditor except for writing .agents/run/issue-51-code-review/**.
Secrets wall: never read /workspace/.openchamber-data/**, .env*, board.env, credential/cookie/session files, process environments, git remote URLs or `git remote -v`. No live GitHub calls/writes, label updates, agent starts, host toggles/restarts, production data, port 3000. Zero emojis.
</env_preflight>
<goal>
Independently audit the final #51 toolbar diff (`f0dae5b..HEAD`) and render two-verdict Spec and Quality rulings without editing product or test files.
</goal>
<context_files>
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/tasks/brief-issue-51-build.md]
[@/workspace/extensions/github-task-board/.worktrees/team-dev-issue-51-toolbar-controls/.agents/run/issue-51-build/verifications/proof.md]
</context_files>
<skills>
[@/workspace/config/opencode/.agents/skills/review/adversarial/doubt-driven-development/SKILL.md]
[@/workspace/config/opencode/.agents/skills/review/quality/code-review-and-quality/SKILL.md]
[@/workspace/config/opencode/.agents/skills/communication/terse/caveman-lite/SKILL.md]
</skills>
<owned_paths>
.agents/run/issue-51-code-review/**
</owned_paths>
<criteria>
1. Inspect `git diff f0dae5b..HEAD -- panel/ test/` and run the test commands yourself.
2. Verify specifically:
- Diff is CSS-only in panel/index.html plus the new test (panel/main.ts/main.js and service/** untouched; #50 connection logic intact).
- The three defects are fixed as specified: Sort readable in both themes (never white-on-white, sensible native popup scheme per theme); project label left-aligned with end-only ellipsis, caret visible, full owner/repo tooltip kept; View label never clipped; zero horizontal page overflow at 1280/980/360px.
- No collateral restyling: every new/changed selector matches only the intended toolbar controls; no dead selectors; any new :root tokens resolve in both themes.
- No controls added or restored; ARIA and keyboard unchanged; focus-visible rings present.
- Tests assert meaningful behavior, not tautological string greps.
- Proof clearly separates Chromium-family results from Obscura results and states real OpenChamber host styling is unverified. Read at least 6 screenshots yourself (include 360px long-label dark and light, and 1280px dark long-label) and report what you see.
3. Write `.agents/run/issue-51-code-review/findings.md` with Spec Verdict (`PASS` | `PARTIAL` | `FAIL`) and Quality Verdict (`APPROVED` | `NEEDS-FIXES`), and commit only `.agents/run/issue-51-code-review/**`.
</criteria>
<verification>
npm run typecheck && node --test test/toolbar-controls.test.js test/panel-service-connection.test.js test/panel-simple-views.test.js test/shipped-parity.test.js && npm test && git status --short
</verification>
<output>
Commit only .agents/run/issue-51-code-review/** on fix/issue-51-toolbar-controls (do not push). Return <=10 lines: Spec verdict; Quality verdict; key checks verified; screenshots inspected + observations; blocking/non-blocking notes; test counts; commit hash; actual provider/model.
</output>
