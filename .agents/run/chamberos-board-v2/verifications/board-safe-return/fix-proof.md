# Board safe return — blocker fix proof

Status: fixes complete in the isolated candidate worktree. Committed locally only. Not pushed, not merged, not installed, not released. No live GitHub write, no owner preview, no phone proof claimed.

Worktree: `/workspace/code/openchamber-github-task-board/.worktrees/workflows-accelerator-agent-dev-board-safe-return`
Branch: `feat/board-safe-return`
Base: `8eccb95` (`fix(decisions): close the remaining false states and pin the rules`)
Reviewed candidate: `3e0840c` (`feat(board): safe task return and separate Done from navigation`)
Fix date: 2026-11-19

Source of the blocker: `.agents/run/chamberos-board-v2/verifications/board-safe-return/first-pass-review.md` (preserved unchanged).

## 1. Verdict against the first-pass review

| # | Review finding | Result |
|---|---|---|
| 1 | `window.confirm` inert in the `sandbox="allow-scripts"` guest frame | Fixed. Both confirmations use a new in-panel modal; no native modal call remains in this slice. |
| 2 | `status:done` label treated as closed; open issue offered Reopen | Fixed. Drawer action, graph checkbox and pill state use `isActuallyClosed` (GitHub `state`). |
| 3 | Drawer status `<select>` closes with no confirmation | Fixed. Selecting `done` routes through `requestDoneToggle`; selecting another column on a closed issue refuses and toasts. |
| 4 | Drawer dependency pill removes with no confirmation or repo identity | Fixed. Pill resolves the blocker in the same repo and routes through `requestDependencyRemoval`; an unrepresentable blocker renders no remove control. |
| 5 | Graph checkbox and kanban drop close with no confirmation | Fixed. Both route through `requestDoneToggle`; kanban refuses an ambiguous number. |
| 6 | `stripFriendlyTitleSection` drops `### Overview` after an empty Friendly Title | Fixed and covered by a dedicated test. |
| 7 | New section labels hardcoded English | Fixed for the two labels this slice introduced (`Task outcome`, `Visibility`) with EN/FR copy keys. Other pre-existing drawer labels (`Priority`, `Workflow Status`, `T-shirt Complexity`) remain as inherited. |
| 8 | Dependency inspector not keyboard-operable | Improved. Escape dismisses, focus moves to the inspector's first action, and the inspector text names the repository. No outside-click dismissal or focus trap was added. |
| 9 | `renderBlockerChip` emits `data-target`/`data-blocker` while the handler reads `data-target-key`/`data-blocker-key` | Not changed in this fix. The graph card path bridges the attributes before the handler runs; no other live caller of `renderBlockerChips` was found. Latent, out of this blocker's scope. |

The slice's Done and dependency-removal claims now hold in a real `sandbox="allow-scripts"` iframe, not only in the Node harness.

## 2. What changed

### In-panel confirmation gate (`panel/main.ts`)

- `showConfirmDialog` / `dismissConfirmDialog` / `onConfirmDialogKeydown` (around lines 2977-3160).
  - `role="dialog"`, `aria-modal="true"`, labelled and described.
  - Cancel receives focus by default.
  - Escape dismisses and returns focus to the opener.
  - Tab is kept inside the two controls.
  - Confirm is one-shot: a `settled` flag makes a repeated click a no-op.
- `requestDoneToggle` is the only close/reopen entry point. On confirm it re-resolves the task by repo-qualified key, re-checks repository, drawer identity (when required) and actual `state` before writing. A task that vanished or changed state writes nothing.
- `requestDependencyRemoval` is the only removal entry point. It requires target and blocker to resolve in the same repository; otherwise it toasts `dependencyUnavailable` and writes nothing. On confirm it re-resolves both and re-checks the repository before writing.
- `openDrawer`, `closeDrawer` and `invalidateDrawerForScopeChange` dismiss any open confirmation, so a scope change or navigation cannot leave a live confirm behind.
- `updateIssueStatus` now also blocks an automatic reopen of a closed issue unless `isHumanGesture` is set, mirroring the existing automatic-close guard. Background status reconciliation passes no gesture, so it can do neither.

### Route gates

| Route | Before | After |
|---|---|---|
| Drawer `Mark done and close issue` / `Reopen issue` | inert `window.confirm` | in-panel dialog, state-based label |
| Drawer workflow status `<select>` → `done` | direct close | `requestDoneToggle`, select restored |
| Drawer status `<select>` → other column on closed issue | direct reopen | refused, `reopenBeforeMoving` toast |
| Card next-stage → `done` | direct close | `requestDoneToggle` |
| Card next-stage on a closed issue | direct reopen | `requestDoneToggle` (reopen) |
| Kanban drop → `done` | direct close | `requestDoneToggle` |
| Kanban drop on closed issue | direct reopen | refused, `reopenBeforeMoving` toast |
| Kanban drop with duplicate number | first match by number | `ambiguousTask` toast, no write |
| Graph checkbox | direct close/reopen | `requestDoneToggle`, checkbox reset until confirmed |
| Drawer dependency pill × | direct `handleRemoveDependency` | `requestDependencyRemoval`, same-repo resolution |
| Graph / inspector remove | inert `window.confirm` | in-panel dialog, repo-qualified |
| Status reconciler | close blocked; reopen possible | close blocked; reopen blocked |

Navigation-only graph edges stay read-only and point the owner to the explicit task action. No action label is silently dead: the removal control is not rendered when the dependency cannot be represented safely.

### Copy (`panel/decisions.ts`)

New EN/FR keys: `confirmMarkDone`, `confirmReopen`, `dependencyBlocks`, `confirmRemoveDependency`, `reopenBeforeMoving`, `ambiguousTask`, `dependencyUnavailable`, `taskOutcome`, `visibility`. Messages state the action, the task, and the repo-qualified target; dependency copy names both ends and the repository.

### Layout (`panel/index.html`)

`.confirm-backdrop` / `.confirm-modal` / `.confirm-message` reuse the existing modal pattern with wrapping footer buttons for narrow widths. No host sandbox, CSP, manifest or permission change.

### Regressions

- `panel/markdown.ts`: an empty Friendly Title no longer consumes the following `### Overview` heading.
- `panel/main.ts`: `Task outcome` and `Visibility` are rendered from copy keys; the static HTML carries an id only.

## 3. Commands and exact results

All commands run in the candidate worktree. Node v22.23.5, npm 10.9.9, esbuild 0.25.12, tsc 5.9.3 from the parent repository's `node_modules/.bin`.

| Command | Result |
|---|---|
| `npm run typecheck` | PASS — exit 0, no diagnostics |
| `npm run build:panel` | PASS — exit 0, `panel/main.js` 828008 bytes |
| fresh `esbuild` rebuild to `/tmp/opencode/main-rebuild-check.js`, then `cmp panel/main.js …` | PASS — byte-identical, `cmp` exit 0 |
| `node --test test/board-safe-return.test.js` | PASS — 25 tests, 25 pass, 0 fail, exit 0 |
| `node --test --test-concurrency=1 test/*.test.js` | PASS — 808 tests, 808 pass, 0 fail, exit 0 |
| `npm test` (parallel) | PASS once — 808/808, exit 0 (`/tmp/opencode/full4.log`) |
| `npm test` (parallel, repeated) | Intermittent unrelated timing failures under load; see caveats |

Targeted suite: 25 tests in `test/board-safe-return.test.js`. New coverage beyond the 11 builder tests:

- Escape dismisses and writes nothing.
- A repeated confirm writes at most once.
- An open issue carrying `status:done` is not offered Reopen.
- A genuinely closed issue offers Reopen and PATCHes `{"state":"open"}` only after confirmation.
- The drawer status dropdown routes `done` through the confirmation.
- A non-state status change still writes directly.
- Background reconciliation can neither close nor reopen.
- The dropdown cannot reopen a closed issue.
- The card next-stage routes Done through the confirmation.
- A scope change or another task opening while the dialog is open dismisses it and writes nothing.
- The drawer dependency chip removes only through the confirmation.
- The empty-Friendly-Title heading survives.

Two repositories sharing issue `#3` are covered for Done; removal uses repo-qualified keys and same-repo resolution.

## 4. Real built panel in a sandboxed iframe

Harness (disposable, not committed): `/tmp/opencode/board-safe-return-browser/sandbox-harness.mjs`.
Raw results: `/tmp/opencode/board-safe-return-browser/sandbox-results.json`.
Screenshots: `sandbox-360x740.png`, `sandbox-390x844.png`.

Command: `cd /tmp/opencode/board-safe-return-browser && node sandbox-harness.mjs` → exit 0.

Setup: a local host page embeds the built `panel/index.html` in `<iframe sandbox="allow-scripts">` (no `allow-modals`, no `allow-same-origin`). The panel document is served with the SDK's guest-frame CSP header (`default-src 'none'; script-src … 'self' …; style-src 'self' …; connect-src 'none'`). The fake host transport records every outbound request and answers GitHub reads with fixtures.

Results at both 360x740 and 390x844:

- Dialog visible, `role="dialog"`, `aria-modal="true"`, cancel focused, both buttons inside the viewport.
- Cancel: dialog closed, 0 PATCH.
- Confirm: exactly one PATCH to `/repos/acme/a/issues/21` with `{"state":"closed","labels":["status:done"]}`.
- Open issue with `status:done`: label reads `Mark done and close issue`, not Reopen.
- Genuinely closed issue: label reads `Reopen issue`; confirm writes exactly one PATCH to `/repos/acme/a/issues/23` with `{"state":"open","labels":["status:todo"]}`.
- Dependency removal dialog: `Remove the dependency: #21 feat(drawer): open task blocks #24 feat(board): dependent task in acme/a?`; confirm writes one PATCH to `/repos/acme/a/issues/24` removing only the blocker line.
- No page errors at either width.

## 5. Caveats and limits

- The browser proof uses a local host page, a fake transport and fixture issues. It is not the installed owner preview, not live GitHub, and not a physical phone. Widths are CSS pixels in headless Chromium 156.0.8078.79.
- The installed OpenChamber binary was not launched. The sandbox conclusion rests on the shipped SDK frame policy and this Chromium iframe reproduction.
- `npm test` in parallel intermittently fails unrelated timing assertions under load: `scale-and-adversarial.test.js` (normalization under 60 ms), `panel-simple-views.test.js` (drawer description editor), `session-marks.test.js` (poll count). Each passes in isolation and the full suite passes serially 808/808. None exercises the changed handlers.
- The background status reconciler is unchanged. It already skipped `done`; the new `updateIssueStatus` guard now also blocks an un-signaled reopen. This is the inherited preview constraint, not a new reconciliation design.
- The unrelated draft-transfer path still calls `window.confirm` (`panel/main.ts:4505`) and remains inert in the guest frame; it was not touched, so project transfer fails closed rather than unconfirmed.
- The dependency inspector now supports Escape and receives focus, but has no outside-click dismissal and no focus trap. It is a popover, not a modal.
- Finding 9 (blocker-chip attribute mismatch in `panel/core.ts`) is left as-is; no live caller other than the graph card path, which bridges the attributes.
- No push, merge, install, release, remote branch, config, secret or host-state change was made. `first-pass-review.md` is preserved unchanged.

## 6. Remaining work

None for this blocker. The next step is the hostile re-review; this proof does not claim it passed.
