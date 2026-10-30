<env_preflight>
Repo: /workspace/extensions/github-task-board
Worktree: /workspace/extensions/github-task-board/.worktrees/team-dev-issue-31-pwa-push
Branch: feat/issue-31-pwa-push
Base commit: 48d1fb29b1bf503e4e9b64b792d5c8cc5d9f132b (master)
Goal: Implement Slice A for Issue #31: Installable PWA shell, persistent subscription storage, VAPID key management, and test-push delivery with standard library web push engine and SSRF defenses.
Commands:
- In worktree root: ln -sf $(pwd)/../../node_modules ./node_modules
- Tests: node --test web/tests/push.test.mjs ; node --test web/tests/*.test.mjs ; npm test ; npm run typecheck ; npx tsc -p web/tsconfig.json
Guardrails:
- Zero third-party runtime dependencies in web/server (use node:crypto, node:http, node:fs, node:net).
- Never log or print secret token, password, or private key values.
- Adhere strictly to the Zero-Emoji policy.
</env_preflight>

<goal>
Build Slice A of Issue #31 (PWA Shell & Standalone Push Subsystem):
1. PWA Installable Shell:
   - `web/public/manifest.webmanifest` (name: "GitHub Task Board", short_name: "Task Board", display: "standalone", start_url: "/#attention", scope: "/", theme_color: "#0f172a", background_color: "#0f172a", icons: 192x192 & 512x512).
   - Minimal standard icons in `web/public/icons/` (icon-192.png, icon-512.png) or SVG fallbacks.
   - `web/public/sw.js`: Service worker handling `push` (reads payload or defaults to generic lockscreen notification: `{ title: 'GitHub Task Board', body: '1 issue needs attention', tag: 'task-board-attention' }`) and `notificationclick` (focuses or opens relative `/#attention` on current origin).
   - In `web/server/app.ts`, serve `sw.js` and `manifest.webmanifest` with appropriate content types (`application/javascript` with `Service-Worker-Allowed: /`, `application/manifest+json`).
2. Server Push Subsystem (`web/server/push.ts`):
   - Keypair Management: Auto-generate VAPID keypair (EC prime256v1) to `data/vapid.json` (mode 0600) on first run if absent; allow env overrides `BOARD_VAPID_PUBLIC_KEY`, `BOARD_VAPID_PRIVATE_KEY`, `BOARD_VAPID_SUBJECT` (default `mailto:admin@workflows.ac`).
   - Subscription Storage: `data/push-subscriptions.json` (mode 0600, atomic write via temp file + rename, capped at 25 devices, prunes 404/410 Gone). Configurable data dir via `BOARD_DATA_DIR` (defaults to `./data`).
   - SSRF & Egress Defenses: Validate push endpoints: scheme MUST be `https:`, no credentials/userinfo, hostname must not be loopback (`127.0.0.1`, `localhost`, `::1`) or private/link-local IP addresses (RFC 1918, RFC 3927, RFC 4193).
   - Web Push Protocol Engine: Use `node:crypto` (ECDH prime256v1 + HKDF + AES-128-GCM per RFC 8291, and VAPID JWT signature per RFC 8292) to format and deliver web push messages to push relay endpoints.
   - Endpoints in `web/server/app.ts`:
     - `GET /api/push/key`: returns `{ publicKey: string, enabled: boolean }`.
     - `POST /api/push/subscribe`: requires session auth + CSRF. Body: `{ endpoint, keys: { auth, p256dh }, userAgent }`. Saves subscription.
     - `DELETE /api/push/subscribe`: requires session auth + CSRF. Body: `{ endpoint }`. Removes subscription.
     - `POST /api/push/test`: requires session auth + CSRF. Rate-limited to 1 request per 30s per session. Sends a test notification to all user subscriptions.
3. Tests (`web/tests/push.test.mjs`):
   - Verify VAPID key generation and retrieval.
   - Verify subscription addition, deduplication, 25-cap enforcement, and deletion.
   - Verify SSRF rejection (HTTP endpoints, loopback, private IP ranges).
   - Verify CSRF and auth rejection for unauthenticated/forged requests.
   - Verify test push rate-limiting (30s window).
   - Verify atomic persistence with file mode 0600.
   - Verify service worker push and notificationclick event handling.
4. Verify all existing tests and typechecks continue to pass without regressions.
</goal>

<scope>
1. Set up symlink to `node_modules` in the worktree root.
2. Create `web/public/manifest.webmanifest`, `web/public/sw.js`, and `web/public/icons/`.
3. Create `web/server/push.ts` with VAPID management, subscription storage, SSRF validators, and RFC 8291/8292 web push delivery.
4. Wire push routes and static file handlers in `web/server/app.ts`.
5. Create comprehensive test suite `web/tests/push.test.mjs`.
6. Run:
   - `node --test web/tests/push.test.mjs`
   - `node --test web/tests/*.test.mjs`
   - `npm test`
   - `npm run typecheck`
   - `npx tsc -p web/tsconfig.json`
7. Commit changes with a clean conventional commit.
</scope>

<criteria>
Zero external dependencies in web/server; all push routes authenticated and CSRF-protected; SSRF endpoints blocked; all unit and web tests pass; typecheck clean (0 errors); zero emojis.
</criteria>

<output>
At most 10 lines:
Summary of files created/modified; test pass counts; typecheck exits; commit hash.
</output>
