# Board safe return — slice proof

Status: implementation complete in an isolated worktree. Not merged, not pushed, not installed, not released. Human validation not claimed.

Worktree: `/workspace/code/openchamber-github-task-board/.worktrees/workflows-accelerator-agent-dev-board-safe-return`
Branch: `feat/board-safe-return`
Base: `8eccb95` (`fix(decisions): close the remaining false states and pin the rules`)
Date: 2026-11-19

## 1. Authorised slice

Built from `clarity/alignment-draft.md` `first_slice` (owner-approved) and `clarity/first-slice-worker.md`:

1. Scope changes invalidate an open task drawer and its actions; a thumb-friendly Back to board control returns to the list position and opener.
2. Graph edge navigation is read-only; removal is a separate control with a confirmation naming both tasks, preserving repository identity.
3. Done stays human-only but is separated from dismissing the drawer, labelled for its real effect, and confirmed.
4. The default simple list hides actually closed issues behind an explicit reversible control; Friendly Title metadata is removed from summaries and the drawer while the raw body stays intact.

Nothing else in the draft was treated as authorised.

## 2. Commands and results

| Command | Result |
|---|---|
| `npm test` on base `8eccb95` before changes | PASS — 783 tests, 0 fail, exit 0 |
| `node --test test/board-safe-return.test.js` (RED, before implementation, built bundle unchanged) | FAIL as expected — 6/6 new tests failed, exit 1 |
| `PATH="/workspace/code/openchamber-github-task-board/node_modules/.bin:$PATH" npm run build:panel` | PASS — exit 0, `panel/main.js` 799.7kb |
| `PATH="/workspace/code/openchamber-github-task-board/node_modules/.bin:$PATH" npm run typecheck` | PASS — exit 0, no diagnostics |
| `node --test test/board-safe-return.test.js` | PASS — 11 tests, 11 pass, 0 fail, exit 0 |
| `npm test` | PASS — 794 tests, 794 pass, 0 fail, exit 0 |

`npm test` is `node --test test/*.test.js`; the new file is picked up by that glob. Baseline 783 + 11 new = 794.

Dependencies were not installed. The worktree has no `node_modules`; the repo build and typecheck ran with the parent repository's existing `node_modules/.bin` on `PATH` (`esbuild` 0.25.12, `tsc` 5.9.3). Node is v22.23.5, npm 10.9.9.

## 3. Regression cases pinned

`test/board-safe-return.test.js` (11 tests):

1. Friendly Title preview returns the first substantive line for inline, multiline, bold and no-metadata bodies.
2. Simple list hides a genuinely closed issue by default and the filter-popover control reveals and re-hides it.
3. A repository scope change dismisses an open drawer, clears the active task, and a stale Done control writes nothing.
4. Closing the drawer restores the list scroll offset and returns focus to the opener row.
5. Done is labelled `Mark done and close issue`, cancel is inert, and confirm performs exactly one PATCH to `/repos/acme/a/issues/7` with `state: closed` and `status:done`.
6. Two repositories sharing issue `#3`: Done targets the original repository only.
7. A stale drawer generation cannot repaint the drawer after it was replaced.
8. Opening the dependency inspector writes nothing; cancel writes nothing and dismisses the inspector.
9. Confirmed dependency removal names `#302` and `#301`, cancels with zero writes, and on confirm PATCHes only `/repos/acme/a/issues/301` with the blocker removed from the body.
10. `stripFriendlyTitleSection` drops the metadata block for inline, multiline and bold forms, and leaves a body without metadata unchanged.
11. Static contract: the Back control exists, Done sits in the drawer scroll body (not the header), and every new copy key exists in both English and French.

Existing tests were not deleted, skipped or loosened.

## 4. Real built panel at 360 and 390 (synthetic host)

Disposable harness: `/tmp/opencode/board-safe-return-browser/harness.mjs` (not committed). It serves the built `panel/index.html` and `panel/main.js` from this worktree, mocks the OpenChamber host and GitHub responses, and drives Chromium over CDP through the existing `obscura` binary and `playwright-core` at `/workspace/.npm/_npx/e41f203b7505f1fb/node_modules/playwright-core/index.mjs`. No credentials, no live GitHub, no install.

Command: `cd /tmp/opencode/board-safe-return-browser && node harness.mjs` → exit 0.
Raw results: `/tmp/opencode/board-safe-return-browser/results.json`.
Screenshots: `/tmp/opencode/board-safe-return-browser/panel-360x740.png`, `panel-390x844.png`.

This is synthetic fixture evidence, not a live board, not a physical phone, and not the installed extension.

Observed at both 360x740 and 390x844:

- Initial simple rows: 3. The closed issue (`state: closed`) is absent.
- An open issue carrying `status:done` remains visible, so a status label is not treated as closed state.
- Friendly-title row: main title `Ship the narrow drawer`, quiet subtitle `feat(drawer): narrow drawer return`, preview `First substantive description for the friendly task.`; no `Friendly Title` text in the row.
- Filter popover shows the closed-visibility control; activating it reveals 4 rows including the closed issue; activating again returns to 3.
- Drawer Back control: text `Back to board`, measured 44px high.
- Drawer Done control: text `Mark done and close issue`, measured 44px high, top 417px against drawer head bottom 196px — outside the header, in the scroll body.
- Drawer subtitle shows the technical title; drawer description contains the Overview text and no `Friendly Title` metadata.
- Back dismisses the drawer and focus returns to the opener row (`data-issue-key` matches). List scroll restore was not exercised in the browser because the 3-row fixture does not overflow the viewport at 740/844 height; it is covered by the unit test in item 4 above.

## 5. What changed

- `panel/main.ts` — scope-change drawer invalidation, repo-qualified drawer identity, opener/scroll return, closed-visibility filter, Friendly Title display in rows and drawer, confirmed Done, read-only dependency inspector, repo-qualified dependency removal.
- `panel/markdown.ts` — `stripFriendlyTitleSection`; preview skips the Friendly Title metadata line.
- `panel/decisions.ts` — English and French copy for the new controls.
- `panel/index.html` — Back control, drawer subtitle, Done block moved into the scroll body, CSS for new controls (44px targets, no new inline style attributes).
- `panel/main.js` — rebuilt bundle read by the test harness.
- `test/test-app-harness.js` — exports and state for the new functions and `showClosedIssues`.
- `test/board-safe-return.test.js` — new regression suite.

No GitHub mutation, no issue-body write, no live action, no push, no merge, no install, no deployment. `/workspace/code/openchamber-config`, `/workspace/.openchamber-data`, `board.env`, `jwt-secret`, tokens and the installed feature worktree were not touched. Decision form behaviour was not changed.

## 6. Caveats and not proven

- Done and dependency removal were exercised only against the offline harness; their real GitHub effect is the pre-existing `updateIssueStatus` / `updateIssueBody` path, now gated by `window.confirm` and an identity re-check. No live write was made.
- The browser harness uses synthetic fixtures and a mocked host. It is not owner preview, physical-phone proof, or live-board proof.
- Graph edge rendering was not exercised in the browser harness (the harness DOM lacks SVG creation). The inspector and removal gating are covered by runtime tests on the built bundle; the edge handlers themselves were reviewed statically.
- Scroll restoration is unit-tested; the browser fixture was too short to overflow.
- System back across the host iframe was not promised or tested; the new control only closes the panel drawer. Host history was not touched.
- The old drawer "Close Issue" button did close the GitHub issue (`state: closed` plus `status:done`); the new control keeps that effect and says so. It is not a new Done mechanism.
- This is implementation complete, not hostile review and not release.

## 7. Preview suggestion (no install, no deploy)

To inspect the slice without installing it into the user's extension:

1. Serve this worktree's `panel/` directory over a local static server and open `panel/index.html` with the existing mock-host harness used above, or
2. Run the committed test suite and read the evidence in this file.

Do not copy the worktree into `/workspace/code/openchamber-config` or the installed extension. Promotion needs the separate hostile-review and release turns.
