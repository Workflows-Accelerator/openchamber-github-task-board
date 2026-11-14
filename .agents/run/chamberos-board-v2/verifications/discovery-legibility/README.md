# Discovery failure legibility verification

Date: 2026-11-14
Branch: `feat/board-v3`
Fixtures: synthetic fake GitHub HTTP server (`web/tests/fake-github.mjs`) and headless Chromium (`verify.mjs`). No real GitHub token, production session, or `board.env` was used.

## Four cause sentences

| `errorKind` | EN | FR | What the person is told to do |
|---|---|---|---|
| `auth` | The board cannot read GitHub because the token was refused. Someone who holds the token must renew it; refreshing this page will not help. | Le tableau ne peut pas lire GitHub : le jeton a été refusé. Une personne qui détient le jeton doit le renouveler ; actualiser cette page n’y changera rien. | Ask the token holder to renew the board token; refreshing the page will not fix it. |
| `rate_limited` (with reset) | GitHub is limiting the board temporarily. Nothing is required of you; the board will refresh after 14:32. | GitHub limite temporairement le tableau. Rien ne vous est demandé ; le tableau s’actualisera après 14:32. | Nothing is required; wait until the reset time. |
| `rate_limited` (no reset) | GitHub is limiting the board temporarily. Nothing is required of you; try again shortly. | GitHub limite temporairement le tableau. Rien ne vous est demandé ; réessayez dans un instant. | Nothing is required; retry shortly. |
| `network` | GitHub is unreachable from the server. Your session is intact; try again shortly. | GitHub est injoignable depuis le serveur. Votre session est intacte ; réessayez dans un instant. | Wait and try again shortly; no re-login or token action needed. |
| `server` (other) | Discovery failed — tasks are not refreshed. Refresh to try again. | Échec de la découverte — les tâches ne sont pas actualisées. Actualisez pour réessayer. | Refresh to try again. |

## Test counts

- Focused suite (`node --test --test-timeout=60000 web/tests/discovery-legibility.test.mjs`): 16 passed, 0 failed (exit 0)
- Full web suite (`node --test --test-timeout=60000 web/tests/*.test.mjs`): 729 passed, 0 failed (exit 0)
- Extension suite (`npm test`): 618 passed, 0 failed (exit 0)
- Typecheck (`npm run typecheck`, `npx tsc -p web/tsconfig.json --noEmit`): exit 0
- Bundles (`npx esbuild web/server.ts --bundle --platform=node --format=esm --target=node20 --packages=external --outfile=web/dist/server.mjs` and client syntax check on `web/public/app.js`): exit 0

## Real-browser matrix (`verify.mjs` + `report.json`)

- Matrix: 4 causes (`auth`, `rate_limited`, `network`, `server`) × 2 widths (`390x844`, `1280x900`) × 2 themes (`light`, `dark`) × 2 languages (`en`, `fr`) = 32 rows
- Failures: 0 (`pageErrors: 0`, `consoleErrors: 0`, `cspViolations: 0`)
- Captures: 32 files in `screenshots/discovery-{kind}-{width}-{theme}-{lang}.png`:
  - `discovery-auth-390-light-en.png`, `discovery-auth-390-light-fr.png`, `discovery-auth-390-dark-en.png`, `discovery-auth-390-dark-fr.png`
  - `discovery-auth-1280-light-en.png`, `discovery-auth-1280-light-fr.png`, `discovery-auth-1280-dark-en.png`, `discovery-auth-1280-dark-fr.png`
  - `discovery-rate_limited-390-light-en.png`, `discovery-rate_limited-390-light-fr.png`, `discovery-rate_limited-390-dark-en.png`, `discovery-rate_limited-390-dark-fr.png`
  - `discovery-rate_limited-1280-light-en.png`, `discovery-rate_limited-1280-light-fr.png`, `discovery-rate_limited-1280-dark-en.png`, `discovery-rate_limited-1280-dark-fr.png`
  - `discovery-network-390-light-en.png`, `discovery-network-390-light-fr.png`, `discovery-network-390-dark-en.png`, `discovery-network-390-dark-fr.png`
  - `discovery-network-1280-light-en.png`, `discovery-network-1280-light-fr.png`, `discovery-network-1280-dark-en.png`, `discovery-network-1280-dark-fr.png`
  - `discovery-server-390-light-en.png`, `discovery-server-390-light-fr.png`, `discovery-server-390-dark-en.png`, `discovery-server-390-dark-fr.png`
  - `discovery-server-1280-light-en.png`, `discovery-server-1280-light-fr.png`, `discovery-server-1280-dark-en.png`, `discovery-server-1280-dark-fr.png`
