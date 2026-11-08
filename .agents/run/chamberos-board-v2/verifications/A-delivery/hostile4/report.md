# Hostile Review 4: fix4 / b88e198

Date: 2026-11-08. Targeted, independent review of `0d66b56..b88e198` (fix4). Packaged application code is still `59e5d05`. Scope covers H3-1, H3-2, H3-3, the guard-mutation proof, the Undo-visible FR recheck, and identity/freeze. Resolved hostile3 items, HUD/gradient design and deferred B–D features were not reopened. No application, tracked-evidence, staged-bundle, preview or production change was made. Mutations happened only in task-owned copies under `/tmp/opencode/hostile4-*`.

**Spec: PASS. Quality: APPROVED (one Low hardening note, non-blocking). Verdict: PROCEED, meaning ready for human validation only. This is not permission to publish, cut over or write to live GitHub.**

## H3-1: two-axis HUD containment (RESOLVED)

Code read: `scripts/generate-delivery-smoke.mjs:296-303,319,322-330,337,490-495`. Every measured control with non-zero width and height is checked against the `#canvas-viewport` rect on all four sides: `left/right/top/bottom`, with 0.5px tolerance. The window check now covers `top<0` and `bottom>height`. Offending controls are listed with `id` and rect in `buttonsOutsideViewport`. The console warning prints them with the viewport rect, and smoke.json `violations` carries them. `casePass` is computed. `grep -c "verdict: '" scripts/generate-delivery-smoke.mjs` returns 0, so no literal verdict was added. The horizontal and pairwise-overlap checks are unchanged.

I wrote my own injections, not the builder's harness: `scripts/containment-challenges.mjs`. It makes disposable copies under `/tmp/opencode/hostile4-smoke-*` and changes browser style only, never verdict variables. It ran in real Chromium (`chromium-env.sh`) against :4041. The smoke itself is read-only: it does not run Arrange, and it restores the theme/language/client toggles it uses. Output is in `containment-challenges.json`, `raw/containment-harness.log` and `raw/smoke-<variant>.log`. All rects below are `#canvas-arrange` at 1280×900 light EN. The viewport there is `x 230..1280, y 74.5..900`.

| Variant | Mechanism | Exit | Failed cases | Named in `buttonsOutsideViewport` (rect) |
|---|---|---|---|---|
| baseline | none | **0**, 10/10 computed PASS | 0/9 | none |
| relTopAbove | `position:relative; top:-2000px` | **1** | 9/9 | canvas-arrange (y −1906.5..−1882.5) |
| relTopBelow | `position:relative; top:2000px` | **1** | 9/9 | canvas-arrange (y 2093.5..2117.5) |
| partialBelowVp | bottom pushed 10px past viewport bottom | **1** | 9/9 | canvas-arrange (y 886..910) |
| partialAboveVpInWindow | 10px above viewport top, still inside window | **1** | 9/9 | canvas-arrange (y 64.5..88.5). `buttonOverflow:false`, so only the new viewport check caught it |
| marginTopAbove | `margin-top:-3000px` | **1** | 9/9 | canvas-arrange (y −1406.5..−1382.5) |
| fixedBelow | `position:fixed` below the window | **1** | 9/9 | canvas-arrange (x 2195..2259, y 1039.5..1063.5) |
| hudContainerAbove | whole `#canvas-controls` `translateY(-2000px)` | **1** | 9/9 | all six visible controls |
| opacityZeroBelow | `opacity:0` + `top:2000px` | **1** | 9/9 | canvas-arrange (y 2093.5..2117.5) |
| visibilityHiddenBelow | `visibility:hidden` + `top:2000px` | **1** | 9/9 | canvas-arrange (y 2093.5..2117.5) |
| tinyScaleBelow | `translateY(2000px) scale(0.05)` (3.2×1.2px) | **1** | 9/9 | canvas-arrange (y 2104.9..2106.1) |
| displayNoneReference | `display:none` (reference) | 0 | 0/9 | not measured, 0×0 rect |

The "visible" filter cannot be gamed by opacity, visibility, tiny scale, fixed positioning, margins, offsets or container transforms. Only `display:none` (or the `hidden` attribute) drops a control, and that leaves it without a rendered box. A control the user cannot see cannot overflow, so I consider the skip acceptable. Measurement is not transform-specific.

I also cross-checked the builder's harness output (`../fix4/smoke-challenges.json`): baseline exits 0; console, exception, overlap, csp, offscreenX, offscreenY, offscreenYBelow, missingWire and beforeNavigation all exit 1, with the failing record matching `../smoke-negative.md`.

**H4-L1, Low, hardening, non-blocking: the containment check passes vacuously when zero controls are measured.**

Reproduction: `ONLY=hudDisplayNone,canvasViewNotShown OUT_JSON=vacuity-challenges.json node hostile4/scripts/containment-challenges.mjs` under chromium-env (`vacuity-challenges.json`, `raw/vacuity-harness.log`).

- `canvasViewNotShown` clicks `#nav-list` before each measurement. It exits **0** with 10/10 PASS, although 0 controls were measured in all 9 cases.
- `hudDisplayNone` exits 1, but only because the 0×0 HUD rect at x=0 trips the left-overflow check at 1280. The 768 and 360 cases pass with 0 controls.

The normal flow cannot reach this state: the script switches to Canvas and waits for cards and 4 wires before the matrix. All 9 real baseline cases measure 6 controls. It is not a fix4 regression; the same was true before H3-1. A future hardening would assert the expected visible-control count (≥6) per case. I made no fix.

## H3-2: password and access limit (RESOLVED)

- I grepped `proof.md`, `human-review.md`, `live-switch.md` and `smoke-negative.md`. Every password occurrence is `correct horse battery staple` (`human-review.md:7`, `proof.md:117`), and no hyphenated form remains. It matches `web/tests/helpers.mjs:9`.
- Real-Chromium sign-in to :4041 used the exact string parsed from `human-review.md:7`, typed key by key: `scripts/signin-documented.mjs`. The script is read-only: login and board load only, with no Arrange and no writes. Result: exit 0; typed value `correct horse battery staple` (28 chars); board visible; 8 issues; 0 console errors. Evidence: `signin-documented.json`, `raw/signin-documented.log`, `screenshots/signin-documented-1280.png`.
- Access wording at `human-review.md:9-12` and `proof.md:73,126` is accurate. It says the preview binds to container loopback only, needs either SSH forwarding to a host sharing or reaching the container namespace or a user-approved ingress, that neither exists or was verified, and that `board.workflows.ac` is production. Nothing implies external reachability.

## H3-3: observational audit labelling (RESOLVED)

`proof.md:58` now reads "Observational browser trace probe (not an asserted suite) … 58 observational trace records, no assertions, no verdict fields". `proof.md:60` cites the asserted real-Chromium smoke separately: 10/10 computed PASS, `fix4/raw/smoke-baseline-direct.log`, which ends `exit=0`. No "ALL PASS" or similar unasserted claim remains in `proof.md`, `human-review.md`, `live-switch.md` or `smoke-negative.md`. The remaining PASS counts are computed suites or probes.

## Guard mutation proof (RESOLVED; builder's claim reproduced)

I made my own copy (`git archive 59e5d05 | tar -x` to `/tmp/opencode/hostile4-mutation/base`, with `node_modules` symlinked) and confirmed with `cmp` that its `app.ts` matches the worktree. I applied one-line mutants at `web/server/app.ts:1421` (`operationsData`). The mutator refuses to write if the original line does not match. Diffs and logs are in `raw/mutation/`.

The command for each mutant was `node --test --test-timeout=30000 web/tests/a5-sections.test.mjs`.

| Copy | Exit | Result | Failing test(s) (assert location) |
|---|---|---|---|
| base | 0 | 11/11 pass | — |
| m1421-dropAvailable (`if ((board.repositoriesLoaded ?? 0) === 0)`) | 1 | 10/1 | `multi-repo Operations and Archive failure modes: total outage, partial per-repo failure, and cached fallback` (`:597`) |
| m1421-dropLoaded (`if (discovery.repositories.some((r) => r.available))`) | 1 | 9/2 | `multi-repo All Projects Operations aggregates multiple repositories and handles discovery failure` (`:394`) and the failure-modes test (`:463`) |
| m1421-invert (`!== 0`) | 1 | 9/2 | same two tests (`:394`, `:463`) |

All six rows match `../fix4/mutation.md:29,33-35` exactly: tests, counts and line numbers. I did not independently re-create the `:1332` mutants; I accept them from the builder's logs.

## Undo-arrange-visible FR recheck (RESOLVED; no product finding)

`scripts/undo-visible.mjs` is a copy of the fix4 script with two additions: the Arrange-to-Undo gap and HUD crop screenshots. It ran a throwaway server from the unmodified staged bundle on `127.0.0.1:4061`, with its own fake GitHub and state under `/tmp/opencode/hostile4-undo-*`; the server was down again afterward. Undo was reached through the real UI (`#canvas-arrange`, then `#arrange-scope-all`, then `#arrange-confirm-btn`; summary "6 cards arranged."). Exit 0, `allPass` computed. Evidence: `undo-visible.json`, `raw/undo-visible.log`, `screenshots/undo-visible-{360,1280}-{light,dark}-fr.png`, `screenshots/hud-crop-*.png`.

- **360 FR (light and dark), viewport y 184.5..848:** the HUD wraps to 3 rows, with Undo `Annuler l’organisation` at x 191..339, y 263.5..287.5 on its own row. Zero controls outside the viewport and zero overlaps.
- **1280 FR (light and dark), viewport x 230..1280:** all controls sit in one row at y 93.5..117.5. Arrange is at x 1035..1109 and Undo at 1111..1259. Zero outside, zero overlaps, no document overflow, 0 exceptions or console errors.
- **2px gap:** this is not an overlap. In the inspected crops and full screenshots, the two labels "Organiser" and "Annuler l’organisation" are clearly separated by the buttons' 8px padding, and the label gap is about 18px. The spacing is identical to the other adjacent pairs ("Ajuster tout"/"Réinitialiser la vue", zoom buttons), which use the same 2px flex gap. I judge it visually acceptable; final aesthetic acceptance is the human's call.

## Identity and freeze (RESOLVED)

Evidence: `raw/identity-before.log`, `raw/identity-after.log`, `raw/exits.txt`.

- `git diff 59e5d05 b88e198 -- web/` is 0 bytes, and the worktree `git diff 59e5d05 -- web/` is also 0 bytes. Between `59e5d05` and `b88e198`, only `scripts/generate-delivery-smoke.mjs` changed under `web/` and `scripts/`.
- Staged bundle `sha256sum -c --strict checksums.sha256`: exit 0, 13/13 OK, 13 files, 0 symlinks, checked before and after.
- Preview: PIDs 486338 and 486368 have the same start time (Fri Nov 6 20:17:08). `/health` returns 200 `{"status":"ok","version":"1.2.1"}`, not restarted.
- Production (read-only check): `/workspace/releases/board/current` resolves to `98261a8-20261103`, and `:8787/health` returns 200.
- Suites, rerun at `b88e198`:
  - `npm test`: exit 0, **618/618** (0 fail/skip).
  - `node --test --test-timeout=30000 web/tests/*.test.mjs`: exit 0, **575/575**.
  - `npm run typecheck`: exit 0.
  - Logs: `raw/{npm-test,web-test,typecheck}.log`.

## Noticed, not changed (outside fix4 scope)

- `generate-delivery-smoke.mjs:473,482-483,496,503-538` writes fixed tracked-path strings into the `screenshot`/`artifact` fields even when `DELIVERY_DIR` points under `/tmp/opencode`. Evidence copies made under `/tmp` therefore cite tracked paths. This was already the case before fix4, and it is cosmetic.
- `undo-visible.json` `metrics.lang` reads `en` because the app does not set `<html lang>`. FR mode is confirmed by the rendered labels; fix4 already recorded this.

## NOT RUN

- Live GitHub writes: synthetic fixtures only.
- External preview access: there is no forwarding endpoint or approved ingress.
- Live cutover, publishing, production restart.
- Human tactile and aesthetic acceptance; real touch hardware; Firefox; WebKit.
- Independent re-creation of the `:1332` mutants (builder logs accepted).
- Production state contents (identity and health only).

## Re-run

```bash
source .agents/run/chamberos-board-v2/verifications/A-delivery/hostile2/scripts/chromium-env.sh
H=.agents/run/chamberos-board-v2/verifications/A-delivery/hostile4/scripts
node $H/containment-challenges.mjs        # ONLY=a,b OUT_JSON=x.json to select variants
node $H/signin-documented.mjs             # read-only login on :4041
node $H/undo-visible.mjs                  # throwaway staged server on :4061
```

VERDICT=PROCEED (ready for human validation only)
