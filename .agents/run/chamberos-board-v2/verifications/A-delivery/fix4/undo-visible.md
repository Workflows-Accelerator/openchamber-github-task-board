# Fix4 — Undo-Arrange-Visible HUD Recheck (hostile3 unfinished check)

Date: 2026-11-08. Renderer: real Chromium (`chrome-headless-shell` via `hostile2/scripts/chromium-env.sh`) through Playwright.

## Setup

- Server: a throwaway instance of the frozen staged bundle, run with `node --import <preload> web/dist/server.mjs`, cwd `/tmp/opencode/board-v2-staging/59e5d05-foundation`, on `127.0.0.1:4051`. It uses its own synthetic fake GitHub and a state directory under `/tmp/opencode/fix4-undo-*`. The bundle was not modified, copied or rebuilt.
- Why not :4041: running Arrange saves canvas positions. Doing that against the running preview would change the synthetic positions the human reviewer will see. The :4041 preview (PIDs 486338/486368) was not touched or restarted. `/health` still returned 200 afterwards.
- Undo was made visible through the real UI: click `#canvas-arrange`, select `#arrange-scope-all`, click `#arrange-confirm-btn`. The script then waited until `#canvas-arrange-undo` was not hidden and the dialog had closed. Summary text: `6 cards arranged.`
- Command:

```bash
source .agents/run/chamberos-board-v2/verifications/A-delivery/hostile2/scripts/chromium-env.sh
timeout 180 node .agents/run/chamberos-board-v2/verifications/A-delivery/fix4/scripts/undo-visible.mjs
```

Exit 0. `allPass` is computed from: Undo visible with non-zero size, every visible control inside the `#canvas-viewport` rect on both axes, zero pairwise overlap, no horizontal document overflow, and zero page exceptions and console errors. Output: `undo-visible.json`, `raw/undo-visible.log`, and `screenshots/undo-visible-{360,1280}-{light,dark}-fr.png`.

## Measurements (FR labels; light and dark rects are identical)

360 × 800, viewport `x 0..360, y 184.5..848`:

| Control | Label | x | y |
|---|---|---|---|
| canvas-zoom-out | - | 236..260 | 203.5..227.5 |
| canvas-zoom-readout | 90% | 262..310 | 203.5..227.5 |
| canvas-zoom-in | + | 312..339 | 203.5..227.5 |
| canvas-fit-all | Ajuster tout | 41..128 | 235.5..259.5 |
| canvas-reset-view | Réinitialiser la vue | 130..253 | 235.5..259.5 |
| canvas-arrange | Organiser | 265..339 | 235.5..259.5 |
| canvas-arrange-undo | Annuler l’organisation | 191..339 | 263.5..287.5 |

1280 × 900, viewport `x 230..1280, y 74.5..900`:

| Control | Label | x | y |
|---|---|---|---|
| canvas-zoom-out | - | 696..720 | 93.5..117.5 |
| canvas-zoom-readout | 90% | 722..770 | 93.5..117.5 |
| canvas-zoom-in | + | 772..799 | 93.5..117.5 |
| canvas-fit-all | Ajuster tout | 811..898 | 93.5..117.5 |
| canvas-reset-view | Réinitialiser la vue | 900..1023 | 93.5..117.5 |
| canvas-arrange | Organiser | 1035..1109 | 93.5..117.5 |
| canvas-arrange-undo | Annuler l’organisation | 1111..1259 | 93.5..117.5 |

Result for all four cases (360 light FR, 360 dark FR, 1280 light FR, 1280 dark FR): Undo visible; zero controls outside the viewport on either axis; zero overlaps; no document overflow; zero exceptions and console errors. No product finding.

At 360 the HUD wraps to three rows, with Undo on its own row. At 1280, Arrange and Undo are 2px apart (1109 vs 1111). They do not overlap, but the gap is tight. Whether that looks acceptable is for the human reviewer, not a measured defect.

Note: `metrics.lang` in the JSON reads `en` because the app never sets `document.documentElement.lang`. FR mode is confirmed by the rendered French labels above, which come from the `tb_lang` toggle. This is recorded as an observation and was not fixed (application frozen).
