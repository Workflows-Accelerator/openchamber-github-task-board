# Hostile Review 4 — fix4 (b88e198), targeted

Date: 2026-11-08. Reviewer is independent of the fix4 builder. Scope (D32): H3-1, H3-2, H3-3, guard mutation proof, Undo-visible FR recheck, identity/freeze. Read-only toward the application, the staged bundle, the :4041 preview and production. All browser runs used real Chromium (`hostile2/scripts/chromium-env.sh`) on disposable copies under `/tmp/opencode/hostile4-*`.

Paths below are relative to `.agents/run/chamberos-board-v2/verifications/A-delivery/`.

## Verdict

- **Spec: PASS**
- **Quality: APPROVED** (low-risk notes below, none blocking)
- **PROCEED**: ready for human validation only. This is not permission to publish, cut over, push or merge.

## Per item

### H3-1 — two-axis HUD containment: RESOLVED

Code read: `scripts/generate-delivery-smoke.mjs:296-324` and `:490-495`.
- `outsideViewport` checks `left/right/top/bottom` of every measured control against the `#canvas-viewport` rect, with 0.5px tolerance. The window check is kept in `hasButtonOverflow`, and so are the horizontal HUD checks and the pairwise overlap check.
- `casePass` is computed. The `Canvas controls mobile containment` verdict is `canvasMeasurementsPass ? 'PASS' : 'FAIL'`. Violations log the control id and its rect.

I wrote my own injections in `hostile4/scripts/containment-challenges.mjs`. Each injection changes browser style only and runs before every matrix measurement, across 9 cases. Results are in `hostile4/containment-challenges.json` and `hostile4/raw/containment-harness.log`, with one log per run in `hostile4/raw/smoke-<name>.log`.

| Injection | Mechanism | Exit | Verdicts | Cases with `canvas-arrange` outside (1280 EN rect) |
|---|---|---|---|---|
| baseline | none | 0 | 10/10 computed PASS | 0/9 |
| relTopAbove | `position:relative; top:-2000px` | 1 | 9/10, containment FAIL | 9/9 (y -1906.5..-1882.5) |
| relTopBelow | `top:+2000px` | 1 | 9/10 | 9/9 (y 2093.5..2117.5) |
| partialBelowVp | bottom 10px below viewport bottom | 1 | 9/10 | 9/9 (y 886..910, viewport bottom 900) |
| partialAboveVpInWindow | 10px above viewport top, still inside the window | 1 | 9/10 | 9/9 (y 64.5..88.5, viewport top 74.5). This isolates the viewport-rect check from the window check. |
| marginTopAbove | `margin-top:-3000px` | 1 | 9/10 | 9/9 |
| fixedBelow | `position:fixed`, below the window | 1 | 9/10 | 9/9 |
| hudContainerAbove | `#canvas-controls` translateY(-2000px) | 1 | 9/10 | 9/9 |
| opacityZeroBelow | `opacity:0` + `top:+2000px` | 1 | 9/10 | 9/9 |
| visibilityHiddenBelow | `visibility:hidden` + `top:+2000px` | 1 | 9/10 | 9/9 |
| tinyScaleBelow | translateY(2000px) scale(0.05), 3.2×1.2px | 1 | 9/10 | 9/9 |
| displayNoneReference | `display:none` (reference) | 0 | 10/10 | 0/9, Arrange width 0 and excluded |

**Can the visible filter be gamed?** No, not for offscreen controls. The filter is `!b.hidden` plus `width>0 && height>0`. Opacity 0, visibility hidden and tiny scale offscreen all still fail. Excluding `display:none`/`[hidden]` is correct: a control taken out of layout is absent, not overflowing. That covers the hidden Undo button before Arrange runs.

**Low-risk gap:** the smoke never asserts that each expected control is present. If Arrange were removed (`display:none`), the smoke would still pass 10/10. This is outside H3-1, which is about containment.

### H3-2 — password and access wording: RESOLVED

- `grep -nE "correct-horse|horse-battery|battery-staple"` over `proof.md human-review.md live-switch.md smoke-negative.md fix4/` returned no match. The spaced form appears at `human-review.md:7` and `proof.md:117`.
- `hostile4/scripts/signin-documented.mjs` extracts the string from `human-review.md:7` (28 chars) and types it into :4041 in real Chromium. The board became visible with 8 issues and 0 console errors; `pass:true`, exit 0 (`hostile4/signin-documented.json`, `raw/signin-documented.log`, `screenshots/signin-documented-1280.png`). This was a read-only login: no Arrange, no writes.
- Access wording (`human-review.md:9-12`, `proof.md:73,126`): loopback-only, not reachable from outside the container, forwarding or an approved ingress required, "neither set up or verified", and `board.workflows.ac` is production. Nothing implies external reachability.

### H3-3 — audit-a5.mjs labelling: RESOLVED

- `proof.md:58` now reads "Observational browser trace probe (not an asserted suite) … no assertions, no verdict fields. Wrong recorded values would not fail this command". The asserting browser evidence is a separate row, `proof.md:60`, which points to `fix4/raw/smoke-baseline-direct.log`.
- Other success claims in `proof.md` and `human-review.md` were checked against their sources:
  - `audit-a5-data.mjs` 14/14: the log has 14 computed `"verdict":"PASS"`.
  - `audit-a5-packaged.mjs` 13/13: verdicts are computed and the script exits 1 on any non-PASS (`:525-526`).
  - A grep for `all pass|all green|fully verified|production ready|externally reachable` found nothing.
- Caveat (low): `audit-a5-data.mjs` has computed verdicts but no `process.exit(1)`. Its "14/14 PASS" is backed by the log content, not by the exit code. This predates fix4 and is outside its scope.

### Guard mutation proof: RESOLVED

Independent copy: `/tmp/opencode/hostile4-mutation/{base,m1421-*}`. `base/web/server/app.ts` is byte-identical to `git show 59e5d05:web/server/app.ts` (cmp). Mutants were made with `hostile4/raw/mutation/mutate.mjs`, which refuses to write if line 1421 does not match. Each diff (`raw/mutation/*.diff`) changes exactly one line. Command: `node --test --test-timeout=30000 web/tests/a5-sections.test.mjs`.

| Copy | Exit | Result | Failing test(s) |
|---|---|---|---|
| base | 0 | 11/11 | none |
| m1421-dropAvailable | 1 | 10 pass, 1 fail | `multi-repo Operations and Archive failure modes…` (`:597`) |
| m1421-dropLoaded | 1 | 9 pass, 2 fail | `multi-repo All Projects Operations aggregates…` (`:394`) and failure-modes (`:463`) |
| m1421-invert | 1 | 9 pass, 2 fail | same two (`:394`, `:463`) |

All three match `fix4/mutation.md` rows m-1421-* exactly: tests, counts and line numbers. I did not independently re-run the 1332 mutants; the brief required one guard.

### Undo-visible FR recheck: RESOLVED

Setup: a throwaway server from the staged bundle on `127.0.0.1:4061`, with state in `/tmp/opencode/hostile4-undo-hjm5yG`. Arrange was triggered through the real UI ("6 cards arranged."). :4041 was not used for Arrange. Output: `hostile4/undo-visible.json`, `raw/undo-visible.log`, `screenshots/undo-visible-*` and `screenshots/hud-crop-*`.

- 360×800 FR, light and dark: Undo `191..339 × 263.5..287.5` on its own row, inside viewport `0..360 × 184.5..848`. Outside: none. Overlaps: none.
- 1280×900 FR, light and dark: Arrange `1035..1109` and Undo `1111..1259` on the same row (`93.5..117.5`), inside viewport `230..1280 × 74.5..900`. Outside: none. Overlaps: none. The gap between the two button boxes is 2px.
- **The 2px gap is visually acceptable.** I looked at `hud-crop-1280-{light,dark}-fr.png`. Because of the internal padding, "Organiser" and "Annuler l'organisation" read as two separate labels with clear whitespace between them. They do not touch, overlap or get clipped. Cosmetic note only: there is no group divider between Arrange and Undo like the ones between the other groups. This is not a defect, and HUD design is out of scope.
- 0 exceptions and 0 console errors.
- Harness nit: `metrics.lang` records `document.documentElement.lang`, which stays `en`. FR mode is confirmed by `undoText` "Annuler l'organisation" and by the crops.

### Identity and freeze: RESOLVED

Checks run in this session (earlier capture in `hostile4/raw/identity-before.log`):
- HEAD `b88e198`. `git diff 59e5d05 b88e198 -- web/` is 0 bytes, and so is `git diff 59e5d05 -- web/`. `git diff --stat 59e5d05 b88e198 -- web/ scripts/` touches only `scripts/generate-delivery-smoke.mjs`.
- `sha256sum -c --strict checksums.sha256` in the staged dir: 13/13 OK, exit 0.
- :4041 `/health` returns HTTP 200. PIDs 486338/486368 still have their start time of Fri Nov 6 20:17:08, so they were not restarted.
- `readlink /workspace/releases/board/current` = `/workspace/releases/board/98261a8-20261103`.
- Suites (`raw/npm-test.log`, `raw/web-test.log`, `raw/typecheck.log`, `raw/exits.txt`):
  - `npm test`: 618/618, exit 0
  - web tests: 575/575, exit 0
  - `npm run typecheck`: exit 0
- `git status` before this commit showed only `hostile4/` untracked.

## Risk matrix

- Catastrophic: none.
- Moderate: none.
- Low:
  - (1) The smoke has no presence assertion for expected HUD controls (displayNoneReference passes).
  - (2) `audit-a5-data.mjs` does not exit non-zero on FAIL.
  - (3) There is no divider between Arrange and Undo at 1280.
  - (4) At 768 and 360, `#canvas-viewport` extends 48px below the window (bottom 948/848 vs height 900/800). HUD controls are unaffected because they sit at the top. This is outside scope and noted for a later layout check.
  - (5) `<html lang>` stays `en` in FR mode (an accessibility/product observation, outside scope).

## NOT RUN

- Live GitHub writes.
- External preview access: no forwarding or ingress exists.
- Live cutover.
- Human tactile acceptance.
- Real touch devices, Firefox and WebKit.
- 1332-guard mutants (re-run in fix4 only).
- Dark 768 Undo-visible.
