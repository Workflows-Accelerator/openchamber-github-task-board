# Board safe return — third fix proof (transport boundary)

Status: the final-review blocker is closed in the isolated candidate worktree. A workflow label update can no longer close or reopen a GitHub issue, even when the panel cache and the server disagree, because label-only PATCHes omit `state` entirely and only an explicit confirmed transition sends it. Committed locally only. Not pushed, merged, installed, released or promoted. No live GitHub write, no installed-host check, no physical-phone check and no user acceptance claimed.

Worktree: `/workspace/code/openchamber-github-task-board/.worktrees/workflows-accelerator-agent-dev-board-safe-return`
Branch: `feat/board-safe-return`
Base: `8eccb950a3667e004a172a22d995ead734bc0c51`
Previous product commit: `26734881f22c7dafe360ce8a982ff396a9c74d51`
Previous docs commit (reviewed candidate): `094c7d8bad8c68cfc5c0a66d1d9eb059b4fa7059`
Fix commit: `79d4b35bef8f5ad7179d538b935a97994ba7927b` (`fix(board): keep label-only writes from changing issue state`)
Fix date: 2026-11-19

Source of the blocker: `.agents/run/chamberos-board-v2/verifications/board-safe-return/final-review.md` §2. `first-pass-review.md`, `delta-review.md` and `final-review.md` are preserved unchanged and remain untracked. `fix2-proof.md` is preserved with a superseding note at its top.

## 1. Defect and fix

Before, `writeIssueState` always sent both fields:

```ts
await githubRequestWithRetry('PATCH', `/repos/${repo}/issues/${issue.number}`, {
  state: nextState,
  labels,
});
```

The guard compared `nextState` with the caller's cached `previousState`, so it proved only intent. With a stale cache, an ordinary status-label move (cached open, server closed) reopened the issue, and the two "no transition" archive paths closed or reopened it. The reconciler reopened a closed issue with no user gesture.

After (`panel/main.ts:2897-2913`), the same writer chooses the payload shape from one expression:

```ts
const observed = String(options.previousState ?? issue.state ?? '').toLowerCase();
const stateChanges = nextState !== observed;
if (stateChanges && !options.confirmed) {
  throw new Error(`Refused unconfirmed state change of #${issue.number} to ${nextState}`);
}
await githubRequestWithRetry(
  'PATCH',
  `/repos/${repo}/issues/${issue.number}`,
  stateChanges ? { state: nextState, labels } : { labels }
);
```

- A label-only call sends `{labels}`; the `state` key is absent.
- A confirmed intended transition sends `{state: nextState, labels}`.
- An unconfirmed intended transition still throws before any request.

Safety no longer depends on the cache being right. A label-only call cannot carry `state`, so it cannot change server state; a state-bearing call requires the confirmed signal. The guard's cached comparison is used only to refuse unconfirmed intent, not to claim what the server holds.

Only one PATCH site in `panel/main.ts` can emit `state` now (`panel/main.ts:2912`). The other PATCH sites (`2727` body, `4441` title, `7726` add label, `7754` remove label, `9745` draft, `10640` priority, `10669` status-label removal, `10717` complexity) send body, title or labels only.

## 2. Regression tests (committed, not ephemeral)

`test/board-safe-return.test.js` grew from 35 to 42 tests. The new `fakeServer` helper (`:45`) keeps its own issue state, independent of the panel cache, and records only PATCH bodies that contain `state`. Each new test asserts both the outbound property absence and the unchanged server state.

| Test | Cache | Fake server | Action | Asserted |
|---|---|---|---|---|
| `a label-only status move omits state…` (`:804`) | open | closed | `updateIssueStatus(…, 'in-progress')` | one PATCH, no `state`, `status:in-progress` sent, server still closed, 0 transitions |
| `background reconciliation omits state…` (`:823`) | open | closed | `statusReconciler.reconcile` with a running session | one PATCH, no `state`, server still closed, 0 transitions |
| `archiving a cached-closed issue omits state…` (`:843`) | closed | open | drawer Archive | no dialog, one PATCH, no `state`, `archived` sent, server still open, 0 transitions |
| `unarchiving a cached-open issue omits state…` (`:863`) | archived open | closed | drawer Unarchive | no dialog, one PATCH, no `state`, server still closed, 0 transitions |
| `unarchiving a cached-closed done issue omits state…` (`:888`) | archived done closed | open | drawer Unarchive | no dialog, one PATCH, no `state`, server still open, 0 transitions |
| `a confirmed close sends the intended state exactly once…` (`:913`) | open | open | drawer Done, confirm | one PATCH with `state:'closed'`, server closes, exactly one transition |
| `an ordinary priority label edit still sends…` (`:936`) | open | open | drawer priority `important` | one PATCH, no `state`, `priority:important` sent, 0 transitions |

Three earlier assertions that accepted a state-bearing label PATCH were corrected, not loosened:

- `a non-state status change writes directly without a confirmation` (`:319`): asserted `state:'open'`; now asserts the `state` property is absent.
- `archiving an already closed issue keeps it closed without a state confirmation` (`:618`): asserted `state:'closed'`; now asserts absence.
- `unarchiving a closed done issue stays closed without a state confirmation` (`:636`): asserted `state:'closed'`; now asserts absence.

Cancel, Escape, repeated confirm, scope change, competing drawer, dependency cancel and navigation tests are unchanged and still pass.

## 3. Commands and raw results

| Command | Result |
|---|---|
| `git rev-parse HEAD` (before this proof commit) | `79d4b35bef8f5ad7179d538b935a97994ba7927b` |
| `npm run typecheck` | exit 0, no diagnostics |
| `node --test test/board-safe-return.test.js` | exit 0, 42 tests, 42 pass, 0 fail |
| `node --test --test-concurrency=1 test/*.test.js` | exit 0, 825 tests, 825 pass, 0 fail |
| `npm run build:panel` twice | PASS; `sha256sum panel/main.js` `e60b78de84c83a5f79adc81bf55672fffcc3a40d8f9f43b83cb8dc9c3f31a2f2` both times, byte-identical |
| `cd /tmp/opencode/board-safe-return-fix3 && node divergence-harness.mjs` | exit 0, 0 page errors at 360x740 and 390x844 |
| `cd /tmp/opencode/board-safe-return-fix3 && node standard-harness.mjs` | exit 0, 0 page errors at both widths |
| `cd /tmp/opencode/board-safe-return-fix3 && node archive-harness.mjs` | exit 0, 0 page errors at both widths |
| `cd /tmp/opencode/board-safe-return-fix3 && node reconciler-harness.mjs` | exit 0, labels-only PATCH, 0 transitions |

The browser harnesses embed the committed built `panel/index.html` and `panel/main.js` in `<iframe sandbox="allow-scripts">`, so `window.confirm` is inert and the in-panel dialog is the only gate. All GitHub traffic is answered by fixtures. The harnesses are copies; the final-review failure evidence in `/tmp/opencode/board-safe-return-final-review` was not rewritten.

## 4. Outbound payload evidence (built panel, fake transport)

### 4.1 Divergence harness — the four blocker rows

Results: `/tmp/opencode/board-safe-return-fix3/divergence-results.json`. Identical at 360x740 and 390x844, zero page errors.

| Fixture | Cache / server | Action | Before (final-review) | After |
|---|---|---|---|---|
| `#21` | open / closed | drawer status to `in-progress` | `{"state":"open","labels":["status:in-progress"]}`, closed → open | `{"labels":["status:in-progress"]}`, server stays closed, 0 transitions |
| `#26` | closed / open | Archive | `{"state":"closed",…}`, open → closed | `{"labels":["status:todo","archived"]}`, server stays open, 0 transitions |
| `#29` | archived open / closed | Unarchive | `{"state":"open",…}`, closed → open | `{"labels":["status:todo"]}`, server stays closed, 0 transitions |
| `#30` | archived done closed / open | Unarchive | `{"state":"closed",…}`, open → closed | `{"labels":["status:done"]}`, server stays open, 0 transitions |
| `#31` control | open / open | drawer status to `in-progress` | `{"state":"open",…}` (redundant field) | `{"labels":["status:in-progress"]}`, no `state` |
| `#32` control | open / open | priority `important` | `{"labels":[…,"priority:important"]}` | unchanged, no `state` |

### 4.2 Standard archive harness

Results: `/tmp/opencode/board-safe-return-fix3/results.json`. Both widths, zero page errors.

| Check | Observation |
|---|---|
| Archive open `#21`: dialog / cancel / confirm | dialog names `#21`, `acme/a`, "closes the GitHub issue"; cancel 0 PATCH; confirm 1 PATCH `{"state":"closed","labels":["status:todo","archived"]}` |
| Unarchive `#25`: dialog / cancel / confirm | "reopens the GitHub issue"; cancel 0 PATCH; confirm 1 PATCH `{"state":"open","labels":["status:todo"]}` |
| Double archive gesture `#28` | one dialog, 0 PATCH before confirm, 1 PATCH `{"state":"closed",…}` |
| Archive already-closed `#26` | no dialog, 1 PATCH `{"labels":["status:todo","archived"]}` (state omitted) |
| Unarchive closed+done `#27` | no dialog, 1 PATCH `{"labels":["status:done"]}` (state omitted) |
| Open + `status:done` card `#22` | no `.card-btn-next`, no `Reopen`, 0 PATCH |
| Archive view via More menu | banner present, `#25` card reachable |

### 4.3 Archive edge harness

Results: `/tmp/opencode/board-safe-return-fix3/archive-edge-results.json`. Both widths, zero page errors.

| Scenario | Observation |
|---|---|
| Dialog open, refresh changes `#40` open → closed, then confirm | dialog survives; confirm 0 PATCH, 0 transitions |
| Dialog open, refresh adds `archived` to `#41`, then confirm | confirm 0 PATCH |
| Dialog open, refresh replaces `acme/a#50` with `acme/b#50`, then confirm | confirm 0 PATCH; no request to `acme/b` |
| Dialog open on `acme/a#51`; refresh lists `acme/b#51` first while both remain; confirm | 1 PATCH `/repos/acme/a/issues/51` `{"state":"closed",…}`; no request to `acme/b` |
| Dialog open, switch repository to `acme/b` | dialog dismissed, 0 PATCH |
| Confirmed archive `#43`, PATCH held, refresh publishes server-open, then 500 | server stays open; optimistic state reverted; no false archived record |
| Confirmed archive `#44`, PATCH held, refresh publishes server-open, then 200 | server closes; published row still in the default list until the next refresh (LIM-1) |

### 4.4 Background reconciler

Results: `/tmp/opencode/board-safe-return-fix3/reconciler-result.json`. Cache open, server closed, running session.

```
PATCH /repos/acme/a/issues/60
{"labels":["status:in-progress"]}
```

No dialog, no `state`, no server transition, server stays `closed`. The local projection stays `open` until the next refresh (display race, §5).

## 5. Remaining risks (unchanged by this fix)

- Display race after a label-only write against a divergent cache: the panel keeps its optimistic projection and ignores the PATCH reply, so the column can disagree with GitHub until the next refresh. The reconciler run above shows it (`issueStateAfter: "open"`, server `closed`). This is a display defect, not a server transition.
- LIM-1 from the final review remains: a concurrent refresh during a successful confirmed archive can leave a stale open row until the next refresh.
- LIM-2 remains: dependency removal still PATCHes the full body with no `If-Match`; a concurrent remote body edit can be overwritten. Pre-existing, not fixed, not accepted on the owner's behalf.
- LIM-3 remains: Done-label removal through routine status controls is still unconfirmed. It is a routine label write and now sends no `state`, so it cannot close or reopen an issue.
- LIM-4 remains: an archive PATCH that commits server-side but loses its response is reverted in the UI until the next refresh. Code trace only.
- Not the installed extension or host; no physical phone; no live GitHub traffic; no owner acceptance; no screen-reader or real keyboard run.

## 6. Scope guard

No new write framework: the same single writer changed one payload expression. No extra GET was added. No cached-state equality is used as proof of server state; equality only selects the label-only payload, whose safety comes from omitting `state`. Repository qualification, scope checks, rollback, one-shot confirmation, dependency behaviour, native decisions, permissions, the installed product and retirement are unchanged. No merge, push, install, deployment or promotion.

## 7. Evidence files

- `/tmp/opencode/board-safe-return-fix3/divergence-harness.mjs`
- `/tmp/opencode/board-safe-return-fix3/divergence-results.json`
- `/tmp/opencode/board-safe-return-fix3/standard-harness.mjs`
- `/tmp/opencode/board-safe-return-fix3/results.json`
- `/tmp/opencode/board-safe-return-fix3/archive-harness.mjs`
- `/tmp/opencode/board-safe-return-fix3/archive-edge-results.json`
- `/tmp/opencode/board-safe-return-fix3/reconciler-harness.mjs`
- `/tmp/opencode/board-safe-return-fix3/reconciler-result.json`
- `/tmp/opencode/fix3-full-suite.log`
- `/tmp/opencode/fix3-hash1.txt`, `/tmp/opencode/fix3-hash2.txt`

All harnesses are disposable and uncommitted.
