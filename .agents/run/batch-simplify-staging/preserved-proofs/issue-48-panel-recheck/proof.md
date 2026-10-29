# Deep Verification Result: Independent Recheck, Correction Round 1 (Issue #48 Extension Panel)

**Task:** Independent recheck of hostile findings `C1`, `C2`, `H1`–`H3`, `M1`–`M3` and the `M4` L5 disclosure on `feat/issue-48-panel-simple-views`.
**Candidate:** `c9fb61b8f4d7fa2178481abaff588b2e23b8380e` (prior `253f9f23e4b4eda7f39ca0a059dff3a21e33eb84`, base `cc083796c4bf62b57aaa76e2908f8b5cd47347dd`; correction commits `7a6b68e`, `60ba457`, `c9fb61b`; nothing pushed)
**Status:** PARTIAL (L0–L4 PASS; L5 AWAITING HUMAN)
**Spec Compliance Verdict:** PASS
**Quality Verdict:** APPROVED
**Model:** `9router/genius`
**Timestamp:** 2026-10-29

### Executed Levels
- **L0 Static:** PASS
  - `npm run typecheck`: exit 0 (`logs/typecheck.log`)
  - `npm run build:panel -- --outfile=.agents/run/issue-48-panel-recheck/verifications/scratch/main.js`: exit 0 (`logs/build.log`)
  - `cmp panel/main.js .agents/run/issue-48-panel-recheck/verifications/scratch/main.js`: exit 0. The bytes are identical, so `panel/main.js` parity holds.
  - `git diff --check cc08379..HEAD`: exit 0
- **L1 Unit:** PASS
  - `node --test --test-concurrency=1 test/*.test.js`: exit 0, 595 pass / 0 fail / 0 skipped / 0 todo (`logs/root-tests.log`)
  - `node --test test/shipped-parity.test.js`: exit 0, 18 pass / 0 fail (`logs/shipped-parity.log`)
- **L2 Integration (test harness with fake host and fake GitHub):** PASS. Covered by the L1 suite (`test/panel-simple-views.test.js`, `test/viewstate.test.js`, `test/dependency-graph.test.js`).
- **L3 End-to-End Chromium:** PASS
  - `node .agents/run/issue-48-panel-recheck/verifications/browser.mjs`: exit 0, 27 result records, 0 `pageerror` (`logs/browser.log`, `logs/browser-results.json`)
  - Harness: the built `panel/index.html` and `panel/main.js` run inside an iframe with a synthetic OpenChamber SDK bridge and fake GitHub REST and GraphQL. All non-loopback requests are aborted. No credentials were used.
  - Console showed only the expected synthetic errors (`Synthetic response lost`, `GitHub API error: 422`) and the fixture `/workspace` project warning.
  - The recheck harness is independent of the correction harness and makes harder checks: a 360px tap reorder; a 55-halving exhausted gap; unconfirmed title and move buttons locked, then `#btnRefresh` clearing the lock; distinct `data-issue-key` values plus a scoped `Blocked by #1` edge; a real pointer click on refresh while typing; and hard-break spaces surviving a save.
- **L4 Adversarial / Test-Weakening Audit:** PASS (details below)
- **L5 Human Verification:** AWAITING HUMAN

### Per-Finding Disposition
| ID | Verdict | Code evidence | Runtime evidence |
|---|---|---|---|
| C1 | CLOSED | `panel/viewstate.ts:316` `computeMove` returns a write plan with lazy markers and minimal-span rebalance; `panel/main.ts:4001` `reorderDraft` | Unmarked #1 moved down with 2 PATCHes (#2 set to 1000, #1 set to 2000). The 55-halving exhausted gap rebalanced with 2 PATCHes in the correct order. With Priority sort, the first gesture switched to Manual and moved #3 to the top. Drag-and-drop works. |
| C2 | CLOSED (D55) | `panel/main.ts:4111-4112` confirms before any network request; `:4174-4175` sets `unconfirmed` on an ambiguous error; `:2503` blocks mutations while unconfirmed; `:2475` reconcile clears it | The dialog warns that the "issue number and URL may change". Cancel made 0 requests and reset the select. Confirm transferred the draft to other#19. A lost GraphQL response locked the row (badge; select, title and move controls disabled) with no retry. `#btnRefresh` cleared the lock. Only 1 GraphQL call was made on ambiguous failure (unit test). There is no copy-and-close path. **Transfer is proven only in fake-runtime tests (harness and synthetic Chromium bridge), not against live GitHub.** |
| H1 | CLOSED | `panel/index.html:3429` uses `left:0`, `width:min(320px, 100vw-16px)`; `panel/main.ts:9065` adds a runtime clamp | At 360px the popover is at x=32 with width 320, and chip `stage:draft` is at x=42. A standard click succeeds. |
| H2 | CLOSED | `panel/viewstate.ts:153-195` makes the marker scan fence-aware, terminal-only and CRLF-preserving; `panel/main.ts:3964` `editDraftDescription` skips no-op saves after CRLF normalisation | The textarea keeps the fenced `777` example and `Line with hard break  `. Blur without an edit made 0 PATCHes. Save kept CRLF, the fence, the hard-break spaces and the terminal `<!-- board-order: 1000 -->`. |
| H3 | CLOSED | `panel/core.ts:2796` (`buildDependencyGraph` uses repo-qualified keys and `blockerKeys` at 2890-2931); `panel/main.ts:6190` (`data-issue-key`), `:6474` | The All Projects Graph shows 7 nodes. Keys `acme/openchamber-github-task-board#1` and `acme/very-long-project-name-for-narrow-layout#1` are distinct, with 1 scoped edge. |
| M1 | CLOSED | `panel/main.ts:3796` move buttons; `panel/index.html:3446-3449` | 6 move buttons with accessible names; boundary buttons are disabled. Tap down and tap up both reorder correctly at 360px. |
| M2 | CLOSED | `panel/main.ts:3584-3616` restores focus, selection and value; `:3685`, `:3732` guard against blur when focus moves to refresh | Tab moves focus to the TEXTAREA "Description for draft #1". A 422 response keeps "DO NOT LOSE THIS EDIT". Refresh while typing, whether programmatic or a pointer click, keeps "UNSAVED TYPING" with 0 mutations. |
| M3 | CLOSED | `panel/viewstate.ts:235-236` (`compareManualOrder`), `:530-534` (`byNumberDesc`) compare repo before number | `test/viewstate.test.js:341-350` passes. |
| M4 | DISCLOSED FOR L5 | `.agents/run/issue-48-panel-correction/verifications/proof.md:44,48-49` lists the removed controls | The toolbar has not been re-bloated. `panel/index.html:3478-3516` contains only search, Filter, Sort, Refresh and the View picker. |

### Test-Weakening Audit (`git diff 253f9f2..c9fb61b -- test/`)
- `test/viewstate.test.js` and `test/panel-simple-views.test.js`: the replaced assertions are the C1 refusal tests (moves returned `null` and "more than one marker" toasts) and the old single-item `{index, order, exact}` shape. Under the C1 ruling this expectation legitimately changed. The replacement tests check write plans plus the resulting order, a partial-failure rollback, and no blind retry.
- `stripOrderMarker('A\n<!-- board-order: 1 -->\nB')` now expects a non-terminal marker to be left untouched. This is a legitimate H2 change (terminal-only marker), and a new fence/CRLF/hard-break test was added.
- `test/layout-and-views.test.js`: the `visibleNumbers` source assertion was updated to the repo-qualified key (H3), so its strength is the same.
- `test/test-app-harness.js`: additive only (`data-*` dataset, `setSelectionRange`, `innerWidth`, `window.confirm` hook).
- No safety, answer-integrity, CPU or transfer assertions were deleted, skipped or loosened. Of the old C2 test, the "failure keeps identity" assertions remain. The equal-marker rebalance checks use `length >= 2` plus an exact order `deepEqual`, which is acceptable.

### Screenshots (inspected)
`screenshots/filter-popover-360.png`, `draft-360.png`, `graph-all-projects-both-visible.png`, `unmarked-down-reordered.png`, `transfer-confirmed-and-unconfirmed-locked.png`, `failed-description-preserved.png`, `fenced-sample-preserved.png`, and per-view `{simple,cards,kanban,graph,pending}-{980,360}.png`. All render correctly with no overflow. Cosmetic only, not defects: the one-row textarea shows only "Sample: ```html", and the unconfirmed badge narrows the description in All Projects.

### Low-Risk Notes (not blockers)
- `reorderDraft` returns without moving when the switch to Manual reverses direction (`directionMismatch`). The user must repeat the gesture.
- An exhausted-gap rebalance can write negative or very small marker values (for example `-999.9999999999999`). The order is still correct.
- Transfer confirmation uses `window.confirm`, not `host.confirm`. This is acceptable under the D55 ruling, but the dialog may look different inside the real host.

### Blind Spots
Not verified: the real OpenChamber host (including iframe `window.confirm` behaviour), live GitHub REST and GraphQL `transferIssue` permissions and number reassignment, physical touch devices, and screen readers.

### Scope and Safety
Only `.agents/run/issue-48-panel-recheck/**` was written. No app or test files changed (`git status --short`). Not touched: real GitHub, credentials, `/workspace/.openchamber-data/**`, `/workspace/releases/**`, the production board, merge, push, deploy, and issue closure.

### L5 Human Handoff
AWAITING HUMAN: visual simplicity, the 360px truncation tradeoffs, explicit sign-off on the M4 removed controls, and a real-host transfer confirmation.
