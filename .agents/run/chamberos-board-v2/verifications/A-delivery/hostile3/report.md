# Hostile Review 3 — fix3 / 59e5d05

Date: 2026-11-06. Independent review of `4704ddc..d4b957b`; packaged code `59e5d05ec97ad506a3c48f36a212382ca599e3e2`. No application fixes, original evidence edits, preview restart or production writes performed. Review stopped after confirming remaining defects, as requested.

**Spec: FAIL. Quality: NEEDS-FIXES. Verdict: HALT.** No catastrophic application defect found; three bounded tooling/documentation defects remain. Approval, if later obtained, means ready for human validation only, never permission to publish.

## Open findings

### H3-1 — Moderate: vertically offscreen HUD controls still produce 10/10 PASS

`scripts/generate-delivery-smoke.mjs:268-270,293-309` checks horizontal containment and pairwise overlap, but never checks button top/bottom against the viewport. A control entirely above the screen passes every check.

Reproduction, using the submitted negative-injection technique in disposable copies only:

```bash
source .agents/run/chamberos-board-v2/verifications/A-delivery/hostile2/scripts/chromium-env.sh
node .agents/run/chamberos-board-v2/verifications/A-delivery/hostile3/scripts/smoke-challenges.mjs
```

The `offscreenY` variant inserts immediately before `const metrics = await page.evaluate(...)`:

```js
await page.evaluate(() => {
  document.getElementById('canvas-arrange').style.transform = 'translateY(-2000px)';
});
```

Observed Chromium DOM bounds at 1280 EN: Arrange `left=1195`, `right=1259`, **`top=-1906.5`, `bottom=-1882.5`**. All nine matrix cases retain `pass: true`; process exits **0**, smoke records **10/10 PASS**, including containment. This changes only browser style, not measurement variables, counts or verdict logic.

Direct proof: `scripts/smoke-challenges.mjs`, `smoke-challenges.json` (`offscreenY`), `offscreen-y-measurements.json`, `raw/smoke-offscreenY.log`. Disposable sources/output locations are recorded in `smoke-challenges.json`. This fails criterion 2's explicit offscreen-control challenge; actual baseline controls were not shown to be offscreen.

Required bounded correction: check both axes of visible controls against the canvas viewport, then prove above/below-screen injections yield exit 1 and FAIL evidence. No source correction attempted.

### H3-2 — Low: human-review login instructions give the wrong synthetic password

`../human-review.md:7` says **`correct-horse-battery-staple`**. `web/tests/helpers.mjs:9` defines **`correct horse battery staple`** (spaces). Successful independent Chromium baseline imports and uses that constant (`scripts/generate-delivery-smoke.mjs:4,169-174`); `raw/smoke-baseline.log` and its ten PASS records prove successful sign-in with spaces. A reviewer following the documented hyphenated password cannot reproduce that login.

Preview access currently requires forwarding **container** loopback port 4041 to the workstation, then opening `http://127.0.0.1:4041`. Example, only if the SSH endpoint shares/reaches the container network namespace:

```bash
ssh -N -L 4041:127.0.0.1:4041 <user>@<host-reaching-container-loopback>
```

Synthetic password: `correct horse battery staple`. No concrete SSH host, credentials or approved ingress URL was supplied. Ordinary forwarding to a host with a different loopback namespace is insufficient. External reachability remains unverified; `https://board.workflows.ac` is production, not this preview.

### H3-3 — Low: proof labels an observational audit “ALL PASS” without assertions

`../proof.md:58` calls the independent browser probe **ALL PASS**. `scripts/audit-a5.mjs:24-25,205-219` records observations and writes JSON, but has no verdict computation or assertion over those observations. A JavaScript exception can fail the command; wrong recorded values do not. The rerun exits 0 with 58 trace records and no verdict fields (`browser-rerun.json`). This is useful evidence, not an asserted all-pass suite. Criterion 3 explicitly forbids presenting unasserted diagnostics as success. Qualify the summary as an observational probe and separately cite the computed Chromium smoke result; no broad audit refactor requested.

## Six hostile2 findings

- **H2-1 RESOLVED:** inspected all 12 updated delivery PNGs individually. Canvas 02/03 show subtle dots, notes and wires, no checkerboard. All 12 dimensions, byte sizes and SHA-256 values match `proof.md` (`screenshot-metadata.json`). Current independent real-Chromium baseline captures all 12 again without errors (`raw/smoke-baseline.log`; task-owned destination in `smoke-challenges.json`). Chromium-unavailable assertion is removed from current proof. Synthetic data is disclosed in `human-review.md` and `proof.md`.
- **H2-2 RESOLVED for reported FR overlap:** current nine-case Chromium baseline has zero overlaps/overflow (`baseline-measurements.json`); 1280 FR Reset ends at 1173 and Arrange starts at 1185. The original 24-case real-Chromium proof remains available under `../hostile2/hud-matrix-chromium.json`. Full containment claim has the remaining tooling hole H3-1. Fresh 360/1280 FR Undo-visible recheck not completed after stop condition.
- **H2-3 RESOLVED:** `web/server/app.ts:1332,1421` uses `some(r => r.available) && repositoriesLoaded === 0`. Independent synthetic probe asserts Operations AND Archive: empty account 200 empty; sole known inaccessible repository 200 partial with the same `Unavailable` failures as combined board and visible partial warning; mixed success/failure 200 retaining open, backburner and closed data; total available-repository failure without cache 502 with human-visible `Could not load`; cached fallback 200 partial retaining data. `guards.json`, `raw/guards.log`, `screenshots/{unavailable,total}-{operations,archive}.png`; command `node .../hostile3/scripts/guards.mjs` under chromium-env exits 0. No new HTTP policy proposed.
- **H2-4 OPEN (remaining smoke validation hole H3-1):** original console/exception/CSP/static-verdict faults are fixed. Independent Chromium console error, asynchronous exception, overlapping buttons, blocked inline CSP script, horizontal offscreen button, missing wire, and error before reload each yield exit 1 and FAIL evidence. Baseline yields exit 0, ten computed PASS verdicts. Console error survives reload; CSP listener captures `inline` and CDP captures the policy violation. Seven independent injected faults detected, one vertical-offscreen fault missed. `smoke-challenges.json`, `raw/smoke-*.log`. Injections never write expected verdict variables. Missing-wire injection occurs after the readiness wait and is observed as three DOM wires, proving the final assertion rather than merely timing out. Audit HTTP-refusal probes did not produce console failures in their Obscura runs; these scripts are not Chromium diagnostics proof.
- **H2-5 RESOLVED for edge-case coverage:** both new scenarios are blocks inside the existing `multi-repo Operations and Archive failure modes` test, not two new `test()` declarations (`raw/guard.diff`). Thus empirical web count remains **575**, not 577. Independent guard-clause mutation challenge was not completed after H3-1 triggered the required stop; builder's mutation claim is not independently certified here.
- **H2-6 RESOLVED:** default `node scripts/audit-a5.mjs` writes `/tmp/opencode/audit-a5/` including screenshots; default packaged audit writes `/tmp/opencode/packaged-browser.json`. Original tracked verification files, including JSON, PNG and raw logs, match the pre-run SHA-256 inventory (`raw/evidence-unchanged.log`, check exit 0). Only new `hostile3/` files were present in final Git status. Smoke used `DELIVERY_DIR` pointing to task-owned `/tmp/opencode/hostile3-smoke-*`, never original delivery evidence.

## Commands and exact counts

All six listed suite/audit commands were independently rerun; exits in `raw/exits.txt`, full outputs in `raw/{legacy,web,typecheck,data,browser,packaged}.log`.

- `timeout 900 npm test`: exit 0; **618/618**, zero failures/skips.
- `timeout 900 node --test --test-timeout=30000 web/tests/*.test.mjs`: exit 0; **575/575**, zero failures/skips.
- `timeout 600 npm run typecheck`: exit 0.
- `timeout 120 node scripts/audit-a5-data.mjs`: exit 0; **14/14** computed PASS records.
- `timeout 240 node scripts/audit-a5.mjs`: exit 0; **58 observational trace records**, not 58 asserted tests. `browser-rerun.json` has no verdict fields. Its exceptions/console/CSP arrays are empty in Obscura. `proof.md`'s “ALL PASS” must not be read as a separate asserted test suite; authoritative Chromium diagnostics come from the independent baseline and negative challenges.
- `timeout 240 env PACKAGED_RELEASE_DIR=/tmp/opencode/board-v2-staging/59e5d05-foundation node scripts/audit-a5-packaged.mjs`: exit 0; **13/13** computed PASS records (`packaged-rerun.json`). Renderer: Obscura; not used to validate dot rendering.
- `node .../hostile3/scripts/smoke-challenges.mjs` under chromium-env: harness exit 0, records child exits explicitly. Baseline **10/10 PASS**; seven injected variants correctly exit 1; vertical-offscreen variant incorrectly exits 0. Harness exit 0 is not a claim all negative tests passed.

## Artifact and isolation

- `/tmp/opencode/board-v2-staging/59e5d05-foundation/`: `sha256sum -c --strict checksums.sha256` **13/13 OK**, exit 0 (`raw/checksums.log`). `artifact.json`: 13 listed files, zero unlisted/missing, zero symlinks.
- All packaged files other than compiled server match `git show 59e5d05:<path>` byte-for-byte (`artifact.json`). Fresh `npx --no-install esbuild web/server.ts --bundle --platform=node --format=esm --target=node20 --packages=external --outfile=/tmp/opencode/hostile3-server.mjs` exits 0; `cmp` against staged `web/dist/server.mjs` exits 0 (`raw/build.log`, `raw/identity-health.log`). Current guard source is therefore in the staged server.
- Preview wrapper **486338**, child **486368**, child cwd points to the staged release; `/health` HTTP 200, status ok, version 1.2.1. Synthetic GitHub port **44821** matches preview metadata. No stale SHA/PID/port observed in current delivery proof.
- Read-only production identity: `/workspace/releases/board/current` still resolves to `/workspace/releases/board/98261a8-20261103`; `:8787/health` HTTP 200. `raw/identity-health.log`. No production state contents, hashes or mtimes audited here; no assertion that production state could not have changed concurrently.

## NOT RUN / remaining boundary

- Live GitHub writes; only synthetic fixtures used.
- External preview access; concrete forwarding endpoint/approved ingress absent.
- Live cutover, publishing or production restart.
- Human tactile/aesthetic acceptance; real touch hardware; Firefox; WebKit.
- Independent guard-clause mutations and targeted current 360/1280 FR Undo-visible recheck: stopped after confirmed H3-1, per brief. Prior hostile2 proof is not represented as a fresh run.
- Full source/staged endpoint matrix in two separately launched engines: source matrix asserted and staged bundle matched byte-for-byte instead.

No fixes attempted. No human click checklist issued because Spec is FAIL. Required next step: correct H3-1, H3-2 and H3-3, then rerun the missed acceptance checks before requesting human validation.

DIDN'T WORK: contact-sheet attempt with `python` failed (`command not found`); `python3` lacked Pillow (`ModuleNotFoundError: No module named 'PIL'`). FINALLY WORKED: inspected all 12 original PNGs directly and verified metadata with Node, without installation. `git diff --cached --check` reports a new blank line at EOF in unedited captured `raw/typecheck.log`; retained exact command output rather than rewriting evidence.

VERDICT=HALT
