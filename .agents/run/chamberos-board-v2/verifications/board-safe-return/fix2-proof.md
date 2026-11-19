# Board safe return — second blocker fix proof

> **Superseded in part (fix3).** The §1/§3.1 claim that "all state writes now go through one writer that refuses an unconfirmed transition" was true only against the panel cache. Label-only status moves and the two "no transition" archive paths still transmitted `state`, so a stale cache could close or reopen a GitHub issue. `fix3-proof.md` (`79d4b35`) fixes the payload at the transport boundary. The rest of this proof is preserved unchanged.

Status: both delta-review blockers are closed in the isolated candidate worktree. Committed locally only. Not pushed, merged, installed, released or promoted. No live GitHub write, no installed-host check, no physical-phone check and no user acceptance claimed.

Worktree: `/workspace/code/openchamber-github-task-board/.worktrees/workflows-accelerator-agent-dev-board-safe-return`
Branch: `feat/board-safe-return`
Base: `8eccb95`
Reviewed candidate: `6068882` (`fix(board): gate every close, reopen, and dependency removal in-panel`)
Fix commit: `26734881f22c7dafe360ce8a982ff396a9c74d51` (`fix(board): confirm archive state changes and drop the false Reopen`)
Fix date: 2026-11-19

Source of the blockers: `.agents/run/chamberos-board-v2/verifications/board-safe-return/delta-review.md`. Both review files (`first-pass-review.md`, `delta-review.md`) are preserved unchanged and remain untracked.

This proof file is added in a follow-up local commit so it can name the fix commit exactly.

## 1. Verdict against the delta review

| # | Delta finding | Result |
|---|---|---|
| B1 | Archive/Unarchive closes or reopens GitHub with no confirmation; double-click closes then reopens | Fixed. Any archive/unarchive whose computed effect changes the actual GitHub state opens the same in-panel confirmation, names the action, the effect and the repo-qualified issue, and writes only on confirm. A repeated gesture leaves one dialog and produces one state change. |
| B2 | Open issue carrying `status:done` shows a card "Reopen" that is only a label edit and writes without confirmation | Fixed. The card next-stage shortcut is not rendered when the card sits in Done only because of a label. The card says nothing about Reopen and produces no request. A genuinely closed issue still offers Reopen behind confirmation. |
| N3 | Archive rollback reverts only the clicked object; unknown-repo return mutates before checking | Fixed. The repository is checked before any mutation, and a failed archive reverts both the clicked object and the record published in `issues`. |
| N5 | Archive view hides archived closed issues, so it can look empty | Fixed. The explicit Archive view is exempt from the default closed-issue filter, so archived closed issues stay reachable. |
| — | The proof claimed every close/reopen was gated while two live paths were not | Fixed at the transport boundary: all state writes now go through one writer that refuses an unconfirmed transition. |

No product choice surfaced. The intended archive effects are unchanged: archive preserves the current status label and closes; unarchive restores the preserved category and reopens unless that category is `done`.

## 2. Findings matrix (offline evidence)

Real-handler tests use the built `panel/main.js` through `test/test-app-harness.js`; browser evidence uses the built panel in a `sandbox="allow-scripts"` iframe with a fake transport.

| Scenario | Before | After |
|---|---|---|
| Archive open `#21` from the drawer | no dialog; PATCH `{"state":"closed","labels":["status:todo","archived"]}` | dialog `Archive issue #21 … in acme/a? This closes the GitHub issue.`; cancel 0 writes; confirm 1 PATCH `{"state":"closed","labels":["status:todo","archived"]}` |
| Unarchive closed+archived `#25` (status:todo) | no dialog; PATCH `{"state":"open","labels":["status:todo"]}` | dialog `Unarchive issue #25 … in acme/a? This reopens the GitHub issue.`; cancel 0 writes; confirm 1 PATCH `{"state":"open","labels":["status:todo"]}` |
| Double-click Archive on open `#28` | two PATCHes: close then reopen | one dialog, zero writes before confirm, one PATCH `{"state":"closed","labels":["status:todo","archived"]}` |
| Archive already-closed `#26` | direct PATCH, state stays closed | direct PATCH, state stays closed, no dialog (pinned) |
| Unarchive closed+archived `#27` with `status:done` | direct PATCH, state stays closed | direct PATCH, state stays closed, no dialog (pinned) |
| Card for open `#22` carrying `status:done` | `↺ Reopen` label, no dialog, PATCH `{"state":"open","labels":["status:todo"]}` | no `.card-btn-next`, card text has no `Reopen`, 0 PATCH |
| Unknown repository archive | `issue.state`/`issue.labels` mutated before the early return | no mutation, no PATCH |
| Archive failure with a concurrently published record | only the clicked object reverted | clicked object and published record both revert |
| Explicit Archive view in the simple layout | empty while closed issues are hidden | archived closed issue `#25` rendered, with its Unarchive control |
| Direct `updateIssueStatus(closed, 'in-progress', { isHumanGesture: true })` | would reopen | shared writer refuses; 0 PATCH; optimistic state reverted |

## 3. Outbound write-path inventory

### 3.1 GitHub issue state writers

Only two call sites send a PATCH containing `state`. Both now go through `writeIssueState` (`panel/main.ts:2896`), which compares the desired state with the state the caller observed and throws before sending when they differ and `confirmed` is false.

1. `updateIssueStatus` (`panel/main.ts:2913`) → `writeIssueState`.
   - `requestDoneToggle` on confirm (`panel/main.ts:3155`) passes `confirmedStateChange: true`. This is the only close/reopen UI gate.
   - Card next-stage handler (`panel/main.ts:4937`): Done routes to `requestDoneToggle`; a genuinely closed issue routes to `requestDoneToggle`; an open Done-labelled card has no control.
   - Live kanban drop handlers (`panel/main.ts:5170`, `5181`): an open issue dropped on Done routes to `requestDoneToggle`; a closed issue is refused on other columns; other moves do not change state.
   - Drawer status dropdown (`panel/main.ts:10690`): Done routes to `requestDoneToggle`; a closed issue on another column is refused; other moves do not change state.
   - Status reconciler (`panel/main.ts:3643`) and background automations (`panel/main.ts:8597`, `8696`, `8742`) pass no human or confirmed signal and remain blocked for Done/reopen.
   - The static `setupDragAndDrop` path (`panel/main.ts:9959`) is dead because the containers it binds are detached, and it also lacks the confirmed signal, so the shared writer would refuse a transition if it ever fired.
2. `toggleArchiveIssue` (`panel/main.ts:3339`) → `computeArchiveEffect` (`panel/main.ts:3249`) → `applyArchiveToggle` (`panel/main.ts:3283`) → `writeIssueState`.
   - Drawer archive button and card archive/unarchive button.
   - Confirmation is required only when the computed `nextState` differs from the actual GitHub state. Confirm re-resolves the repo-qualified key, re-checks repository, archive metadata and state, and recomputes the effect; a changed target or vanished transition writes nothing.

All other PATCH sites carry `body`, `labels` or `title` only and cannot change state: `updateIssueBody` (`2727`), title edit (`4438`), add label (`7723`), remove label (`7751`), draft alignment (`9742`), priority (`10637`), status-label removal (`10666`), complexity (`10714`). New-issue creation is a POST and creates an open issue; it is not a transition.

### 3.2 Dependency-body writers

- `updateIssueBody` (`panel/main.ts:2677`) is the only body PATCH.
- Removal: `requestDependencyRemoval` (`6890`) opens the confirmation, then re-resolves both ends and requires the same repository, then calls `handleRemoveDependency` (`6865`) → `updateIssueBody`. Dedicated removal controls are the dependency inspector (`6973`), the drawer blocker chip (`7550`) and graph-edge controls (`7004`, `7248`); all route through `requestDependencyRemoval`.
- Addition: `handleAddDependency` (`6846`) → `updateIssueBody`. Adding a blocker is not a removal and was not given a confirmation requirement by this slice.
- Normal explicit body editing also calls `updateIssueBody`; it is not automatically a dependency-change UI. Deleting a `Blocked by` line in the body editor remains an explicit body edit, outside the dependency-control invariant.

Baseline race recorded, not fixed: `handleRemoveDependency` computes the new body from the in-memory issue and `updateIssueBody` does not re-read the issue from GitHub immediately before the PATCH. A concurrent remote body edit could therefore be overwritten by a confirmed removal. This predates the slice and is not claimed as fixed.

## 4. Commands and raw results

| Command | Result |
|---|---|
| `git rev-parse HEAD` (fix commit) | `26734881f22c7dafe360ce8a982ff396a9c74d51` |
| `npm run typecheck` | PASS (no output) |
| `node --test test/board-safe-return.test.js` | PASS 35/35 |
| `node --test --test-concurrency=1 test/*.test.js` | PASS 818/818 |
| `npm run build:panel` | PASS; `panel/main.js` 811.8kb |
| `sha256sum panel/main.js` before and after rebuild | `897577f5cd9eb29693ab361ad514990e3cff9dc63c950e245b099ae6bf3a0f64` both times |
| Browser harness at 360x740 and 390x844 | PASS; 0 page errors at both widths |

The targeted file grew from 25 to 35 tests. The four existing tests that called `updateIssueStatus(..., 'done', { isHumanGesture: true })` directly now also pass `confirmedStateChange: true`; that is the new explicit contract, not a loosened assertion.

## 5. Browser evidence (built panel, fake transport, sandboxed iframe)

Harness: `/tmp/opencode/board-safe-return-fix2/harness.mjs`. Results: `/tmp/opencode/board-safe-return-fix2/results.json`. Screenshots: `archive-confirm-360x740.png`, `archive-confirm-390x844.png`, `archive-view-360x740.png`, `archive-view-390x844.png`.

At both widths, with zero page errors:

| Check | 360x740 | 390x844 |
|---|---|---|
| Archive open `#21`: dialog title / message | `Archive issue` / `Archive issue #21 Archive open task in acme/a? This closes the GitHub issue.` | same |
| Cancel archive | dialog closed, 0 PATCH | same |
| Confirm archive | 1 PATCH `/repos/acme/a/issues/21` `{"state":"closed","labels":["status:todo","archived"]}` | same |
| Open+`status:done` card `#22` | no `.card-btn-next`, no `Reopen`, 0 PATCH | same |
| Archive view reachable from the narrow-screen More menu | banner present, `#25` card present with Unarchive | same |
| Unarchive `#25`: dialog | `Unarchive issue` / `Unarchive issue #25 Archived closed task in acme/a? This reopens the GitHub issue.` | same |
| Cancel unarchive | 0 PATCH | same |
| Confirm unarchive | 1 PATCH `/repos/acme/a/issues/25` `{"state":"open","labels":["status:todo"]}` | same |
| Double archive gesture `#28` | one dialog, 0 PATCH before confirm, 1 PATCH closed | same |
| Archive closed `#26` | no dialog, 1 PATCH state closed | same |
| Unarchive closed+done `#27` | no dialog, 1 PATCH state closed | same |

The Archive view is reached through the More menu at these widths because the toolbar archive button is hidden below 660px by existing CSS. No new navigation control was added.

## 6. Limitations

- Not the installed extension or host. No installed-host, service or permission behaviour was exercised.
- No physical phone. Both widths are Chromium viewport emulation inside a sandboxed iframe.
- No user acceptance or owner preview.
- No live GitHub API traffic or write. All PATCH evidence comes from the fake transport.
- The N3 rollback test simulates a detached clicked object alongside the published record; it does not interleave a real refresh during the request.
- The dependency-removal body race in §3.2 remains open and is not claimed as fixed.
- The dead static drag-and-drop path was left in place; the shared writer now refuses any unconfirmed transition if it ever fires, but it was not removed because that is outside this slice.
- Nothing was pushed, merged, installed, released or promoted. Hostile re-review is the next step.
