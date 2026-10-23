# Issue #28 independent hostile review

Spec: **FAIL**. Quality: **NEEDS-FIXES**. Machine verdict: **HALT** pending minimum concurrency remediation; no integration, closure or human approval inferred.

Reviewed HEAD `29d1634db06eb1e674c2ca56c621285f0aa4bd3b` against `7013bd9`, canonical issue read with `gh issue view 28 --repo Workflows-Accelerator/openchamber-github-task-board --json title,body,state,url` (exit 0; OPEN). Actual available identity: Engineer, provider/model `9router/engineer`; same supplied identity. Independent reviewer session, not a different model/provider claim.

## Findings

### R1 — Moderate: successful explicit edit overwritten by older full refresh

Anchors: `panel/main.ts:1431-1436`, `1539-1547`, `1987-2021` (body editing), `2032-2082` (optimistic status editing). `publishIssueSnapshot` replaces every issue object with normalized request data without accounting for writes accepted after the GET started. Body/status edits invalidate issueCache, but neither invalidate active full snapshot nor protect changed fields. The completed full snapshot then persists the old body and announces a successful full sync.

Independent shipped-bundle reproduction: initial full GET issue 1 body `old`; defer next full GET; call exported existing `updateIssueBody` with `new saved body`; recording host accepts exactly one PATCH and body is visible as new; release earlier GET with body `old`. Display and persistent cache both become `old`. No GitHub writes occurred: all traffic synthetic. Command `node /tmp/opencode/issue28-review-probes.mjs` exits 0 because it asserts the defect's observed outcome, not because this invariant passes. Log `/tmp/opencode/issue28-review-probes.log`.

Minimum remediation: distinguish authoritative membership from field-version admission. Track successful/in-flight local edits after request start, protect them at final publication (including cache), or invalidate/restart the snapshot with bounded behavior when editing occurs. Add deferred GET versus successful body/status PATCH regressions. Do not merely merge old membership back, which would undo issue #28's deletion fix. This race family may predate this patch; it remains an explicitly requested editing-preservation gate, not claimed newly introduced in all paths.

### R2 — Moderate: completed incremental response loses to older paginated full snapshot

Anchors: `panel/main.ts:1475-1480`, `1431-1439`, `1775-1791`, `1808-1809`, `1831`. Full refresh and an incremental request started during that refresh share `activeStreamEpoch`. The incremental result is admitted and rendered, but page-two completion publishes the separately accumulated older full snapshot, restoring stale fields. It also resets the watermark to the older full-request start. Epoch guards protect refresh-versus-refresh, not all concurrently admitted publications.

Independent shipped-bundle reproduction: initial issue 1; full page 1 contains 100 issues with issue 1 body `old`; defer page 2; complete incremental response with issue 1 body `incremental new` and assert visible; return empty page 2. Final issue 1 body is `old`. Same probe command/log as R1.

Minimum remediation: retain authoritative full membership while reconciling later-admitted incremental fields using a mutation/publication generation or per-issue versions. Add full-page-two versus incremental deferred regression and watermark assertions. Preventing stale publication must not silently drop incremental activity or falsely mark incomplete membership complete.

## Positive evidence and audit

- Clean tracked status before review; targeted changed paths only, no service changes. Rebuild exited 0 with clean tracked status afterward: generated output byte-identical to HEAD.
- `npm run typecheck`: exit 0; `/tmp/opencode/issue28-review-typecheck.log`.
- `npm run build`: exit 0; `/tmp/opencode/issue28-review-build.log`.
- `npm test`: exit 0; 475 passed, zero failed/skipped; `/tmp/opencode/issue28-review-suite.log`.
- `node --test test/current-board.test.js test/d12-origins-cache.test.js test/v2-binding-and-ratelimit.test.js`: exit 0; 23 passed, zero failed/skipped; `/tmp/opencode/issue28-review-targeted.log`.
- `git diff --check`: exit 0 before reports.
- Independent probe: A-to-B-to-A final display and persistent A cache contain only newest issue 3; no recorded non-GET requests. Failure then empty retry clears error and restores full-sync notice. Four scenarios: two pass invariants, two confirmed defects. Probe source remains under `/tmp/opencode`, no application/test edits.
- Builder's nine shipped tests genuinely cover empty/full membership, settings-ready requests, visibility activation, superseded full responses, pagination failure, empty 304, superseded incremental watermark and failure freshness. They omit concurrent successful edits and incremental-during-full publication. The changed page-size assertion expects rejection instead of swallowed failure; retained-row/request-count assertions remain, justified by owner-level error handling.
- Single-repository cache/page-one/page-two awaited paths have admission guards before the displayed/cache/watermark publications examined. `fetchIssuePage` can still alter per-repository page-size policy after a superseded oversized response (`panel/core.ts:4042-4045`); not cross-repository membership corruption. All Projects legacy freshness/admission gaps remain outside this correction's stated scope.

## Browser boundary

Obscura 0.2.5 installed, `playwright-cli` unavailable; no playwright/playwright-core package resolved. Attempted actual unchanged built `panel/index.html` and `main.js` in local iframe with deterministic recording host, files served solely from allowlisted panel paths and synthetic file responses. No credential files read, no real token/network GitHub request, fixture rejects non-GET mutations.

`obscura fetch http://127.0.0.1:8938/ --allow-private-network --wait 3 --eval "JSON.stringify({fresh:document.querySelector('iframe').contentDocument.getElementById('boardFreshness').textContent,calls:window.calls})" -s /tmp/opencode/issue28-desktop.png` exited 0. DOM reports `owner/a · Refreshing — cached data is provisional · No completed full sync`; recording shows synthetic workspace/config/cache/token-discovery requests. Screenshot inspected: entirely blank background, despite iframe DOM text. Fixture did not complete network refresh in this engine. This is **not** visual PASS or proof of product blankness; iframe rendering/settling boundary unresolved. Earlier incomplete fixture produced expected workspace-data warning. Logs `/tmp/opencode/issue28-browser-desktop.log`; source `/tmp/opencode/issue28-browser-server.py`.

Desktop/narrow freshness layout, focus retention, visual empty/failure/recovery and clean console: **NOT VERIFIED**. Authenticated installed extension, actual activation delivery and human review: **NOT RUN / AWAITING HUMAN**. Synthetic fixtures do not establish L3 installed-host E2E. Existing automatic reconciliation remains a separate known write boundary; opening is not certified read-only. No live panel opened with credentials, issue mutation, deployment, merge, push or application fix.

## Learnings

DIDN'T WORK: `python /tmp/opencode/issue28-browser-server.py` exited 127 (`python: command not found`), first browser fetch exited 1 (connection refused). FINALLY WORKED: `python3` served fixture; Obscura navigation/DOM evaluation exited 0, but meaningful visual proof remained blocked.

DIDN'T WORK: initial browser fixture lacked workspace/config-shaped responses and returned workspace warning; adding synthetic native-shaped responses reached provisional refresh DOM. FINALLY WORKED: only partial browser DOM observation; did not relabel blank screenshot or unfinished refresh as passing evidence.

Stop for manager judgement. Reports only committed; no fixes attempted.
