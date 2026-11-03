# Issue 53 hostile review: proof

Reviewed commit: `764bd08b408cdb8eb7a12790d059d4fa3a07c10f` on `feat/issue-53-openchamber-look`.
Reviewer model: `9router/genius`.

## Blockers found and fixed

1. Oversized SVG icons and an empty or collapsed picker label.
   - All `<svg>` elements in `web/public/index.html` now have `width="14" height="14"`.
   - `web/public/theme.css` sets `svg, .icon, .icon-sm { width: 14px; height: 14px; flex-shrink: 0; }`.
   - `renderPicker()` in `web/public/app.js` now keeps `#repo-label` and the button `title` in sync.
   - `.repo-label` no longer shrinks, so the label is not truncated.
   - On desktop, `#repo-select-btn` has `min-width: 128px`. Obscura was sizing the content-sized flex button without its padding, which pushed the icon and chevron onto the border.
2. Simple list rows were laid out wrong and showed markdown.
   - `.simple-row, .view-simple .task-row` now use `flex-direction: row` and `.simple-row-main` uses `flex-direction: column`, giving dot, title/description, then meta.
   - New `cleanPreviewText()` removes headings, rules, code fences, checklist lines, and inline markers.
3. Closed dialogs and popovers were taking up space.
   - Added `dialog:not([open]), .board-sheet:not([open]), .view[hidden], [hidden] { display: none !important; }`.
4. The explicit theme lost to the OS preference.
   - `:root[data-theme="dark"], [data-theme="dark"]` and the matching light rules now come after `@media (prefers-color-scheme: light)`.
   - `theme-color` is now `#0f1012`.
5. Board text painted over the drawer.
   - `#drawer-backdrop` has `z-index: 900` and `#detail-view` has `z-index: 1000` with width `min(480px, 100vw)`. The old duplicate `z-index: 40/45` drawer rules were removed.
   - Desktop: `body.drawer-open #board-view` gets `width: calc(100% - 480px)`.
   - Mobile (600px and below): `#board-view` gets `visibility: hidden; pointer-events: none`. Its `hidden` attribute stays `false`.
6. The quick-add form was missing from Simple list.
   - `#quick-add-form` is now shown whenever `view === 'simple'`.
   - It is compact (32px) on desktop and its controls are 44px on mobile.
7. Tests and harness were too weak.
   - Added unit tests 6.a through 6.f in `web/tests/issue-53-openchamber-look.test.mjs`.
   - The harness now checks:
     - SVG bounding boxes
     - closed sheet, popover, and backdrop: `display:none` and `offsetHeight` 0
     - row geometry: dot `left < 40`, visible title, clean description
     - `#repo-label` is not truncated and the button's children have at least 4px inner padding
     - desktop and mobile drawer hits with `elementFromPoint`
     - computed dark and light backgrounds
     - mobile quick-add controls are at least 44px
     - no horizontal overflow

## Visual inspection (each regenerated PNG opened with `read`)

- `01-desktop-dark-board.png`: dark `#0f1012`; 14px icons; "All Projects" fully inside its button; rows show the dot on the left, the title over a clean one-line description, and the badge and number on the right; quick-add bar at the bottom.
- `02-desktop-search-filter.png`: "Beta" filters the list to one row (#55).
- `03-desktop-detail-drawer.png`: 480px drawer on the right; board shrunk to 800px and dimmed by the backdrop; no text overlaps.
- `04-desktop-light-board.png`: light `#f4f5f7` background with the same layout.
- `05-desktop-settings-theme.png`: settings sheet open with Auto, Dark (checked), and Light.
- `06-mobile-board.png`: dark at 360px; 44px toolbar controls; rows are not clipped; 44px quick-add controls.
- `07-mobile-detail-drawer.png`: drawer is full width; no board text shows through.

## Commands

- `node --test web/tests/issue-53-openchamber-look.test.mjs`: 15/15 pass.
- `node --test web/tests/*.test.mjs`: 479/479 pass.
- `npm test`: 618/618 pass, exit 0.
- `npx tsc --noEmit`: exit 0.
- `npx tsc -p web/tsconfig.json --noEmit`: exit 0.
- `node .agents/run/issue-53-build/harnesses/verify-openchamber-look.mjs` (Obscura CDP on port 9360): 48/48 checks pass, exit 0.
- `node .agents/run/issue-54-build/harnesses/verify-no-flash.mjs`: all checks pass, exit 0. Its regenerated artifacts were reverted because they are outside this change.
- `node web/tests/issue-48-browser-verify.mjs`: NOT VERIFIED. The harness launches local `chrome-headless-shell`, which exits 127 with `libglib-2.0.so.0: cannot open shared object file`. This host has no glib and no other Chromium binary. The failure comes from the environment, not from the code.

## Verdict

- Spec Compliance: PASS. The only exception is the issue-48 Chromium harness, which cannot run on this host.
- Code Quality: APPROVED.
