# Discovery failure legibility verification

Date: 2026-11-14
Branch: `feat/board-v3`
Fixtures: synthetic fake GitHub HTTP server (`web/tests/fake-github.mjs`) and headless Chromium (`verify.mjs`). No real GitHub token, production session, or `board.env` was used.

## Four cause sentences

| `errorKind` | EN | FR | What the person is told to do |
|---|---|---|---|
| `auth` | The board cannot read GitHub because the token was refused. Someone who holds the token must renew it; refreshing this page will not help. | Le tableau ne peut pas lire GitHub : le jeton a été refusé. Une personne qui détient le jeton doit le renouveler ; actualiser cette page n’y changera rien. | Ask the token holder to renew the board token; refreshing the page will not fix it. |
| `rate_limited` (reset on another day) | GitHub is limiting the board temporarily. Refresh after Tue 15 Jan 10:30. | GitHub limite temporairement le tableau. Actualisez après mar. 15 janv. 10:30. | Refresh manually after the reset time. |
| `rate_limited` (no reset, or reset already past) | GitHub is limiting the board temporarily. Try again shortly. | GitHub limite temporairement le tableau. Réessayez dans un instant. | Try again shortly. |
| `network` | GitHub is unreachable from the server. Your session is intact; try again shortly. | GitHub est injoignable depuis le serveur. Votre session est intacte ; réessayez dans un instant. | Wait and try again shortly; no re-login or token action needed. |
| `server` (other) | Discovery failed — tasks are not refreshed. Refresh to try again. | Échec de la découverte — les tâches ne sont pas actualisées. Actualisez pour réessayer. | Refresh to try again. |

The toolbar `#scope-status` carries only a short cause label (`GitHub token refused`, `GitHub rate limit`, `GitHub unreachable`, `Discovery failed`, and their FR equivalents), so `.status-strip` never repeats the full sentence or overflows. A reset timestamp is shown only when it comes from the failing response itself and is still in the future; another calendar day adds date context.

## Test counts

- Focused suite (`node --test --test-timeout=60000 web/tests/discovery-legibility.test.mjs`): 24 passed, 0 failed (exit 0)
- Full web suite (`node --test --test-timeout=60000 web/tests/*.test.mjs`): 737 passed, 0 failed (exit 0)
- Extension suite (`npm test`): 618 passed, 0 failed (exit 0)
- Typecheck (`npm run typecheck`, `npx tsc -p web/tsconfig.json --noEmit`): exit 0
- Bundles (`npx esbuild web/server.ts ... --outfile=/tmp/antigravity/wave6f-server.mjs`, `npx esbuild web/public/app.js ... --outfile=/tmp/antigravity/wave6f-app.js`): exit 0

## Real-browser matrix (`verify.mjs` + `report.json`)

- Matrix: 4 causes (`auth`, `rate_limited`, `network`, `server`) × 2 widths (`390x844`, `1280x900`) × 2 themes (`light`, `dark`) × 2 languages (`en`, `fr`) = 32 rows
- Failures: 0 (`pageErrors: 0`, `consoleErrors: 0`, `cspViolations: 0`)
- Captures: 33 files. 32 are `screenshots/discovery-{kind}-{width}-{theme}-{lang}.png`:
  - `discovery-auth-390-light-en.png`, `discovery-auth-390-light-fr.png`, `discovery-auth-390-dark-en.png`, `discovery-auth-390-dark-fr.png`
  - `discovery-auth-1280-light-en.png`, `discovery-auth-1280-light-fr.png`, `discovery-auth-1280-dark-en.png`, `discovery-auth-1280-dark-fr.png`
  - `discovery-rate_limited-390-light-en.png`, `discovery-rate_limited-390-light-fr.png`, `discovery-rate_limited-390-dark-en.png`, `discovery-rate_limited-390-dark-fr.png`
  - `discovery-rate_limited-1280-light-en.png`, `discovery-rate_limited-1280-light-fr.png`, `discovery-rate_limited-1280-dark-en.png`, `discovery-rate_limited-1280-dark-fr.png`
  - `discovery-network-390-light-en.png`, `discovery-network-390-light-fr.png`, `discovery-network-390-dark-en.png`, `discovery-network-390-dark-fr.png`
  - `discovery-network-1280-light-en.png`, `discovery-network-1280-light-fr.png`, `discovery-network-1280-dark-en.png`, `discovery-network-1280-dark-fr.png`
  - `discovery-server-390-light-en.png`, `discovery-server-390-light-fr.png`, `discovery-server-390-dark-en.png`, `discovery-server-390-dark-fr.png`
  - `discovery-server-1280-light-en.png`, `discovery-server-1280-light-fr.png`, `discovery-server-1280-dark-en.png`, `discovery-server-1280-dark-fr.png`
- The 33rd capture, `screenshots/canvas-discovery-failure-1280.png`, shows the Canvas failure state: `#canvas-cards` and `#canvas-wires` empty, `#canvas-viewport` `display: none`, `#empty-state` displayed, and `#empty-create` hidden and disabled.

## Assertions added by `verify.mjs`

- At `1280x900`: `.status-strip` `scrollWidth <= clientWidth` for every cause, theme, and language; `#list-group-toggle`, `#new-task-btn`, and `#freshness` bounding boxes stay inside the viewport on both axes (16 layout rows in `report.json`).
- `#scope-status` equals the short cause label and never the full sentence; `#empty-state p` and `#discovery-status` keep the full sentence.
- `#empty-create` is `hidden` and `disabled` while discovery fails.
- Switching EN <-> FR while the board is null re-renders `#notice`, `#scope-status`, `#empty-state p`, and `#discovery-status` in the new language (8 switch rows).
- Canvas discovery failure clears stale cards and wires instead of leaving them visible or clickable.

## Artifacts in This Directory

- `README.md` — This verification summary.
- `verify.mjs` — Synthetic HTTP + headless Chromium matrix and screenshot capture.
- `report.json` — Captured rows, layout boxes, language-switch results, and Canvas failure evidence.
- `screenshots/*.png` — The 33 captures described above.
