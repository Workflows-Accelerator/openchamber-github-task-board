# V4-1c L4 fixes — verification receipt

Base: `6535937`. Fix commit: `38f6572`. Branch: `feat/board-v3`.
All browser evidence uses real Chromium against synthetic GitHub fixtures. No live GitHub, deployment, push, issue or PR operations were performed.

## Defect evidence

- D1: `web/public/app.js:2721,2826,3015` enforces automatic framing at or above `0.55`, using selected-card or group-centroid fallback. `web/public/theme.css:1862` uses a 16px title, measured at 8.8 effective pixels at the floor. Phone filter cases show three cards and a 44px `Show all (3)` / `Tout afficher (3)` action; explicit fits measure `0.309` at 360 and `0.338` at 390. Filter matrix: 16/16 passing.
- D2: `web/public/app.js:2959,3119,3162` announces off-screen neighbours and suppresses labels whose endpoint cards are fully outside the automatic floored view. Normal focus and spread focus matrices: 16/16 each. Every spread case keeps the selected card visible at `0.55`; all three labels for fully off-screen neighbours are hidden. Explicit spread fits measure `0.2`, `0.2`, `0.245`, `0.263` at 360/390/768/1280 respectively.
- D3: `web/public/app.js:1733,5758` remembers the first narrowing viewport and applies it directly on clearing. Both chip removal at 360 and sheet reset at 1280 restore `{panX:123.125, panY:-47.875, scale:0.873}` with strict numeric equality after an intervening different filtered view.
- D4: `web/public/theme.css:3536` styles Sort/View options consistently with filter options. At 1280 all four Sort options measure 44px high, 1px border, 8px radius, inherited font and exactly one pressed option. View controls also pass the sheet matrix.
- D5: `scripts/generate-delivery-smoke.mjs:288,857,920` settles animations before geometry/opacity measurements and compares opacity around `0.22` with `0.02` tolerance. Three consecutive runs exit 0, with 14/14 passing sections each.
- D6: `web/public/theme.css:3555` raises Settings rename actions to 44px. Both actions measure 44px at 360 dark French; sheet height is 680px within an 800px viewport.
- D7: `web/public/app.js:3383` catches the awaited drag save rejection. Real pointer drag plus injected 403 produces one rejected request, the existing error notice, exact position rollback from/to `{x:460,y:90}`, zero unhandled rejections and zero page errors.

## Commands and results

Run sequentially against final production/test source:

1. `npm test`: exit 0; 618 tests passed, zero failed/skipped/cancelled.
2. `node --test --test-timeout=30000 web/tests/*.test.mjs`: exit 0; 626 tests passed, zero failed/skipped/cancelled.
3. `npm run typecheck`: exit 0.
4. `npx esbuild web/server.ts --bundle --platform=node --format=esm --target=node20 --packages=external --outfile=/tmp/opencode/v4-1c-server-check.mjs`: exit 0; 224.6kb bundle outside repository.
5. `node scripts/generate-delivery-smoke.mjs`, three consecutive runs: exits 0/0/0; 14/14 sections each. Logs: `logs/smoke-run-{1,2,3}.log`; separate verdict snapshots: `smoke-run-{1,2,3}.json`.

Additional completed checks:

- `node .agents/run/chamberos-board-v2/verifications/V4-1c/scripts/v41c-verify.mjs` from repository root: exit 0. See `v41c-measurements.json`, `v41c-summary.json`, `logs/framing-verification.log`.
- `node .agents/run/chamberos-board-v2/verifications/V4-1c/scripts/v41c-sheets.mjs` from repository root: exit 0. All 128 sheet surfaces pass; nested page lock retained; minimum measured control height 44px; zero console/page/CSP errors. See `v41c-sheets.json`, `logs/sheets-verification.log`.
- `python3 .agents/run/chamberos-board-v2/verifications/V4-1c/scripts/v41c-invariants.py` from repository root: exit 0. All 19 source invariant checks pass.
- `node --test --test-timeout=30000 web/tests/v3-ux-client.test.mjs`: exit 0; 21/21 passing.
- `node --check` on both new browser verification scripts: exit 0.
- `git diff --check`: exit 0 before commits.

## Preserved invariants

`updateCanvasTransform`, including dot-grid behavior, is byte-identical to `6535937`; SHA256 `692903b749bcd9e2dcd07a48d91574522c81d52b513eea8a6abff7ea92aec274`.

Restricted server/panel/service paths, Markdown renderer, Arrange implementation, CSP, package manifests and lockfiles are unchanged. No inline style attribute added, banned product copy or pictographic glyphs found, or duplicate icon-plus/text-plus buttons observed. Product identity, one phone filter entry, Close/Fermer wording, 24px group rhythm and theme colors are retained. Applied filters/counts and real-click phone sidebar behavior pass all three delivery smokes. Reduced-motion focus in English/French at 360 has exactly identical early/late viewport state at the readable floor.

## Screenshots

151 PNG files in `screenshots/` (V4-1d removed 8 stale suffix-less `d2-spread-*` files the script no longer writes), including:

- `d1-filter-applied-360-light-en.png`
- `d2-focus-360-light-en.png`
- `d2-spread-focus-360-dark-fr.png`
- `d2-spread-show-all-1280-dark-fr.png`
- `d3-filter-cleared-360.png`
- `d4-sort-sheet-1280-dark-en.png`
- `d6-settings-360-dark-fr.png`
- `d7-drag-save-refused-1280-light-en.png`

Tracked `../V4-1/` outputs were regenerated by the final delivery smoke. Independent `../V4-1-L4/` inputs remain untracked and were not modified or committed.

## Boundaries and diagnostic notes

- The deliberately spread fixture cannot be fully contained at 360/390 even at the existing absolute minimum zoom `0.2`. The automatic view stays readable and explicitly announces off-screen neighbours; the user-requested fit reaches that minimum. Full containment after that explicit fit is proven at 768/1280, not on spread phones. The measured JSON preserves actual containment rather than asserting it on phones.
- Normal-fixture phone focus also uses the selected-card fallback: all four cards have readable title sizing at `0.55`, but only the selected card is wholly contained. Explicit full fit contains all four at lower user-chosen scales. At 768/1280 all four normal-fixture cards are wholly contained and readable automatically.
- Chromium emits `Failed to load resource: the server responded with a status of 403 (Forbidden)` for the deliberately injected drag failure. This exact diagnostic is recorded separately under `dragFailure.expectedResourceErrors`; unexpected console errors still fail verification.
- No live GitHub persistence, installed release, production service, non-Chromium browser or physical-device behavior was verified.

## Investigation learnings

- DIDN'T WORK: the first explicit-action browser check left the phone filter view at `0.55`; the bar button had no click binding. FINALLY WORKED: bound `canvas-show-all` to `showAllCanvas` and added a regression assertion; browser checks now confirm lower-scale fit and containment.
- DIDN'T WORK: the first label check equated partial clipping with a fully off-screen endpoint, producing false failures. FINALLY WORKED: compare label visibility against actual endpoint intersection, retaining labels for partially visible cards.
- DIDN'T WORK: treating the deliberately injected 403 resource diagnostic as an unexpected console error made the verification command exit 1 despite correct rollback and zero unhandled rejections. FINALLY WORKED: record only that exact expected diagnostic separately while requiring zero unexpected errors.
- DIDN'T WORK: an earlier test edit redeclared `selected` (`Identifier 'selected' has already been declared`). FINALLY WORKED: renamed the local to `selectedCard`; final suites pass.
- DIDN'T WORK: loading optional `git-workflow-and-versioning` returned `Unable to load skill git-workflow-and-versioning`. FINALLY WORKED: reviewed explicit diffs and staged only authorized paths using available Git commands.
