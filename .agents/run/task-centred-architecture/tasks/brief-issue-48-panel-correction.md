<env_preflight>
Repo: /workspace/extensions/github-task-board
Worktree: /workspace/extensions/github-task-board/.worktrees/team-dev-issue-48-panel-simple-views
Branch: feat/issue-48-panel-simple-views
Base/current candidate:253f9f23e4b4eda7f39ca0a059dff3a21e33eb84 (base releasecc083796c4bf62b57aaa76e2908f8b5cd47347dd).
State: DISPATCHABLE NOW. Independent reviewer ses_8a6ddd2fbedfdd4581cadc93 completed read-only with 0 app/test edits and untracked proof under .agents/run/issue-48-panel-hostile/** (preserve that directory untouched). No concurrent writer in this worktree.
Owned: panel/** and only #48-related test/** plus own .agents/run/issue-48-panel-correction/**. Do not modify web/**, shared config, dependencies, unrelated root tests or the other worktrees.
Tests: npm run typecheck; npm run build:panel; node --test --test-concurrency=1 test/*.test.js; node --test test/shipped-parity.test.js; built-panel browser verification with fake host/GraphQL/REST.
Do not run web tests or access real GitHub, credentials, /workspace/.openchamber-data/**, /workspace/releases/** or production board. No merge, push, deployment, reset/rebase/force, issue close or cleanup. No secret values in logs/argv/evidence.
Facts authoritative after completed review receipt exists. Skip initial pwd/ls/status discovery. Targeted diff/commit/state checks for mutations or stale facts allowed.
</env_preflight>
<goal>
Make the extension's quick draft capture, unrestricted ordering and confirmed project changes satisfy the aligned contract and resolve the independent review findings without weakening existing safety tests.
</goal>
<context_files>
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/decisions-batch-simplify-views.md]
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/outputs/issue-48-panel-build-receipt.md]
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/tasks/amendment-issue-48-confirmed-transfer.md]
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/outputs/simplification-review-requirements.md]
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/outputs/issue-48-panel-hostile-review-gate.md]
[@/workspace/extensions/github-task-board/.worktrees/team-dev-issue-48-panel-simple-views/.agents/run/issue-48-panel-hostile/verifications/proof.md]
</context_files>
<skills>
[@/workspace/config/opencode/.agents/skills/build/methodology/test-driven-development/SKILL.md]
[@/workspace/config/opencode/.agents/skills/review/adversarial/doubt-driven-development/SKILL.md]
[@/workspace/config/opencode/.agents/skills/communication/terse/caveman-lite/SKILL.md]
</skills>
<scope>
1. Free draft reorder: manager's moved-item-only constraint is superseded where it makes the user request impossible. Permit minimal lazy neighbour initialization/rebalance while preserving numeric marker semantics. ALL-unmarked downward/upward, mixed, tied markers, endpoints, dense/precision-exhausted ranks and same-number cross-repo items must work. Do not refuse a destination simply to preserve the obsolete restriction. Each touched issue gets fresh raw-body/conflict checks and existing UNKNOWN protections; partial multi-issue failure must reconcile honestly and never silently revert or blindly resend. Do not imply whole-list atomicity or GitHub compare-and-swap. Repeated gesture should not be required just to switch to Manual sort when a single gesture can safely perform intended move.
2. D55 APPROVED confirmed native GitHub project transfer (previous receipt's scope warning obsolete): verify/improve existing transfer path, no copy+close. Cancel0writes, explicit named source/target confirmation, allowlisted target, fresh node IDs, canonical returned repository/number/URL, failure identity retention, UNKNOWN/no-blind-retry, in-flight drawer/edit/reorder and refresh races, same-number identity and source/target cache invalidation. Do not broaden credentials or start sessions. Keep native GitHub history and show permission errors.
3. Preserve body text: draft inspiration editing must not silently replace structured sections with a truncated preview. Marker parsing/setting cannot remove examples inside code fences or normalize unrelated CRLF/blank lines. Retain only true hidden metadata. Title/description unsaved edits must survive unrelated render/poll, project/view changes or show an honest guard; Enter/double-submit no duplicates. Any changed focus continuity must be actually browser-tested, not assumed by native inputs.
4. Apply ALL independent findings C1, C2, H1, H2, H3, M1, M2, M3 from issue-48-panel-hostile-review-gate.md and proof.md (with red-before regressions):
- C1 (`panel/viewstate.ts:192-223`, `panel/main.ts:3792-3814`, `test/viewstate.test.js:158-171`, `test/panel-simple-views.test.js:186-197`): replace single-write-only `computeMove` with a planner returning the minimal ordered list of `{ index, order }` writes (lazily assigning `ORDER_GAP`-spaced markers `1000, 2000, ...` to unmarked prefix/neighbours up to `toIndex` or rebalancing the minimal contiguous equal/exhausted span), reload participating issues in `reorderDraft` and sequentially apply conflict-safe `updateIssueBody` writes. Also perform the move on the first gesture when switching Sort to Manual order. Replace the two refusal tests with lazy-initialisation/rebalance tests.
- C2 (`panel/main.ts:3610,3825-3875`): require explicit confirmation (`window.confirm` / `host.confirm`) naming the target project and warning that issue number/URL may change BEFORE any network call in `transferDraftProject`; on Cancel reset `select.value = repo` and `select.title = repo` with 0 writes; validate `targetRepo` against `availableProjectRepos()`; on non-definitive `POST /graphql` failure (`!isDefinitivePreCommitRejection(err)`), mark `(issue as any).unconfirmed = true` (and on `findIssueRecord(repo, issue)`), disable further mutations until refresh reconciles source+target, and never auto-retry `transferIssue`.
- H1 (`panel/index.html:3429,3481-3484`): left-anchor or clamp `.filter-popover` within the viewport so on a 360px viewport `#filterPopover` and `[data-filter="stage:draft"]` have `x >= 0` and are clickable by standard pointer click.
- H2 (`panel/viewstate.ts:73,89-99,122-126`, `panel/main.ts:3579,3769,9383`): match/strip/set ONLY a terminal unfenced `<!-- board-order: N -->` marker outside code fences at the end of the body, preserving CRLF (`\r\n`) vs LF (`\n`) and Markdown trailing hard-break spaces.
- H3 (`panel/core.ts:2791-2845`, `panel/main.ts:6158`): key `buildDependencyGraph` nodes and `visibleNumbers` by repo-qualified key (`${getIssueRepoFullName(issue) || ''}#${issue.number}`) while scoping unqualified `#N` dependency references to the same repository so All Projects Graph view never drops colliding `#1` issues across repos.
- M1 (`panel/main.ts:3548-3648`): add compact accessible Move Up / Move Down buttons on editable draft rows calling `reorderDraft(issue, sorted, index +/- 1)` alongside `Alt+ArrowUp/Down` and drag-and-drop.
- M2 (`panel/main.ts:3526-3650,3731-3776`): preserve in-progress draft input values/selection and next-focus target across `renderViews()` keyed by `data-draft-key` (`repo#number`), and keep the user's unsaved description text in the textarea when `editDraftDescription` fails.
- M3 (`panel/viewstate.ts:157-167,363-386`): add `(a.repo || '').localeCompare(b.repo || '')` before `issue.number` in `compareManualOrder` and `byNumberDesc`.
- M4: per manager ruling in issue-48-panel-hostile-review-gate.md, do NOT re-bloat the toolbar with old removed controls; M4 is handled by explicit L5 disclosure.
No removal/weakening of existing answer integrity, mutation UNKNOWN, repo-routing or CPU threshold tests. Rebuild `panel/main.js` and verify `cmp` parity.
5. Narrow screenshot already inspected by manager: first row starts around200px, 5rows~400px; title truncates to roughly20chars at360px because per-row project select shares line; optional description is an always-visible textarea with resize handle. Keep minimal quick-capture aesthetic, avoid form-heavy controls, preserve 44px touch and accessible keyboard controls. No unapproved redesign or dropped features. Human will decide subjective simplicity at L5. Add row remains bottom and reachable.
6. Preserve durable browser harness, fake host fixtures, logs and screenshots under own .agents/run/**; builder's /tmp/opencode/issue48-browser.mjs alone is not durable proof. Reproduce all5views, filters, actions and capture/reorder/transfer failure paths through shipped main.js. Synthetic host is not installed OpenChamber and mock GitHub isn't live authority. Explicit blind spots mandatory.
</scope>
<criteria>
Regression before fix for each required review finding. Both typecheck/build0 and all root+shipped tests pass without weaker assertions. Scratch rebuild matches committed main.js. Reorder persistence verified through second render/client and hidden raw metadata; no unrelated body changes. Transfer cancel/failure/unknown/race checks pass with fake network. Browser keyboard, description edit, phone360/390 +desktop screenshots inspected, zero unexplained page/console errors. No full PASS claim for installed host, screen readers or real GitHub.
</criteria>
<signals>
Scope M; sensitivity HIGH (issue body/identity and multi-issue writes); ambiguity bounded by D55 and review; local reversibility. Correction round1 for panel #48. Stop for a product fork or inability to preserve existing user data.
</signals>
<output>
Commit local micro-steps. Write full proof, findings disposition and durable harness/logs/screenshots under .agents/run/issue-48-panel-correction/verifications/proof.md. Return <=15lines: exact SHA, findings closed/open, commands/counts/exit codes, browser artifacts path and actual provider/model if known. L5 awaiting human; no Done/release claim. Independent recheck follows.
</output>
