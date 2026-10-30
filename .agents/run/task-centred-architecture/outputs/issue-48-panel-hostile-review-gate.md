# #48 extension hostile review gate — FAIL / NEEDS-FIXES (correction round 1 dispatched)

Date: 2026-10-29
Candidate: `253f9f23e4b4eda7f39ca0a059dff3a21e33eb84` on base `cc083796c4bf62b57aaa76e2908f8b5cd47347dd`
Independent reviewer: `ses_8a6ddd2fbedfdd4581cadc93`, actual `9router/genius` verified.
Verdicts: Spec Compliance `FAIL` | Quality `NEEDS-FIXES` | L4 `HALT` | L5 `AWAITING HUMAN`.
Full proof: `/workspace/extensions/github-task-board/.worktrees/team-dev-issue-48-panel-simple-views/.agents/run/issue-48-panel-hostile/verifications/proof.md` (1–113).

## Ranked Findings & Manager Rulings (all required in Correction Round 1)
1. **C1 [Catastrophic] — Manual reorder refuses unmarked, mixed, equal-marker, and exhausted-gap destinations (`panel/viewstate.ts:192-223`, `panel/main.ts:3792-3814`, `test/viewstate.test.js:158-171`, `test/panel-simple-views.test.js:186-197`):**
   - Ruling: Replace single-write-only `computeMove` with a planner that returns the minimal ordered list of `{ index, order }` writes (lazily assigning `ORDER_GAP`-spaced markers `1000, 2000, ...` to any unmarked prefix/neighbours up to `toIndex` or rebalancing the minimal contiguous equal/exhausted span). In `reorderDraft`, reload all participating issues and sequentially apply conflict-safe `updateIssueBody` writes. Also perform the move on the first gesture even when switching Sort to Manual order (no repeated gesture needed). Replace the two refusal tests with lazy-initialisation/rebalance tests.
2. **C2 [Catastrophic] — Saved-draft project picker transfers on `change` with zero confirmation dialog and allows blind retries after ambiguous failures (`panel/main.ts:3610,3825-3875`):**
   - Ruling: Under D55, require explicit confirmation (`window.confirm` / `host.confirm`) naming the target project and warning that issue number/URL may change BEFORE any network call; on Cancel, reset `select.value = repo` and `select.title = repo` with 0 network writes. Validate `targetRepo` against `availableProjectRepos()`. On non-definitive `POST /graphql` failure (`!isDefinitivePreCommitRejection(err)`), mark `(issue as any).unconfirmed = true` (and on `findIssueRecord(repo, issue)`), disable further mutations until refresh reconciles source+target, and never auto-retry `transferIssue`.
3. **H1 [High] — Filter popover renders off-screen left at `x = -147px` on `360px` viewport (`panel/index.html:3429,3481-3484`):**
   - Ruling: Left-anchor or clamp `.filter-popover` within the viewport (`left: 0; right: auto; max-width: calc(100vw - 16px)` or viewport-clamped positioning) so all filter chips have `x >= 0` and are clickable at 360px width.
4. **H2 [High] — `stripOrderMarker` strips fenced `<!-- board-order: ... -->` code examples and normalises `\r\n` to `\n` (`panel/viewstate.ts:73,89-99,122-126`, `panel/main.ts:3579,3769,9383`):**
   - Ruling: Match/strip/set ONLY a terminal unfenced `<!-- board-order: N -->` marker outside code fences at the end of the body, preserving CRLF/LF and trailing Markdown hard-break spaces.
5. **H3 [High] — All Projects Graph view keys nodes by `issue.number`, dropping colliding `#1` issues across repos (`panel/core.ts:2791-2845`, `panel/main.ts:6158`):**
   - Ruling: Key graph nodes and `visibleNumbers` by repo-qualified key (`${getIssueRepoFullName(issue) || ''}#${issue.number}`) while scoping unqualified `#N` dependency references to the same repository (and supporting cross-repo `owner/repo#N` if present).
6. **M1 [Moderate] — No touch or button reorder controls on draft rows (`panel/main.ts:3548-3648`):**
   - Ruling: Add compact accessible Move Up / Move Down buttons on editable draft rows calling `reorderDraft(issue, sorted, index +/- 1)` alongside `Alt+ArrowUp/Down` and drag-and-drop.
7. **M2 [Moderate] — Full DOM rebuild of `.simple-row` inputs on `renderViews()` wipes unsaved typing on refresh, drops `Tab` focus to `BODY` after title edit, and discards text on failed description `PATCH` (`panel/main.ts:3526-3650,3731-3776`):**
   - Ruling: Preserve in-progress draft input values/selection and next-focus target across `renderViews()` keyed by `data-draft-key` (`repo#number`), and keep the user's unsaved description text in the textarea when `editDraftDescription` fails.
8. **M3 [Moderate] — Sort tie-breakers omit repository identity in All Projects (`panel/viewstate.ts:157-167,363-386`):**
   - Ruling: Add `(a.repo || '').localeCompare(b.repo || '')` before `issue.number` in `compareManualOrder` and `byNumberDesc` so web and extension tie-break identically.
9. **M4 [Moderate] — Undisclosed functional removals (`Priority`/`Tag` filters, Group-by, `Select All with Tag`, Graph theme filter, Attention sub-pills, `All Tasks` collapsible sections):**
   - Ruling: Per D52, unified View + Filter + Sort intentionally replaces the old preset/tab/sub-pill maze. Do NOT re-bloat the toolbar; record the exact removed controls in the L5 handoff for explicit user sign-off.
