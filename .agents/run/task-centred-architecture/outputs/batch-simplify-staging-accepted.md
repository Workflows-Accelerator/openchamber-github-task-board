# Combined Staging Integration Gate (#47 + #48)

- **Staging Worktree:** `/workspace/extensions/github-task-board/.worktrees/team-dev-batch-simplify-staging`
- **Branch:** `feat/batch-simplify-staging` (branched from `master` `cc083796c4bf62b57aaa76e2908f8b5cd47347dd`)
- **Staging HEAD:** `ab7516c4a3634c3d69f7b82936ddb7655d327ebb` (product merge commit `a29192c`, proof preservation commit `ab7516c`)
- **Integrated Accepted Candidates:**
  - `#47` Fresh App & Stay Signed In: `268bd28738443863d6a58b5e4500ad20b6aaa05f` (L4 ACCEPTED)
  - `#48` Extension Panel Simplified Views & Drafts: `c9fb61b8f4d7fa2178481abaff588b2e23b8380e` (L4 ACCEPTED)
  - `#48` Standalone Web Simplified Views & Drafts: `d5a205da26827d0555824339fcb14c9a39d7af7f` (L4 ACCEPTED; contains `#47` `268bd28`)
- **Integration Worker:** `ses_eca7e0e0844247c8973a2a69` (`9router/engineer`)
- **Combined L0–L4 Status:** PASS (`L5 AWAITING HUMAN`)

## Verification Summary
- Ancestry verified (`git merge-base --is-ancestor` exit `0` for `cc08379`, `268bd28`, `c9fb61b`, `d5a205d`).
- Protected `#47` files (`web/server/auth.ts`, `web/server/config.ts`, `web/public/sw.js`) have `0`-byte diff vs `268bd28`.
- Deterministic panel bundle parity: `0`-byte diff (`cmp -s panel/main.js /tmp/antigravity/panel-staging-check.js` exit `0`).
- `npm run typecheck`: exit `0`
- `npx tsc -p web/tsconfig.json`: exit `0`
- `node --test test/shipped-parity.test.js`: `18/18` pass (exit `0`)
- `node --test --test-concurrency=1 test/*.test.js`: `595/595` pass (exit `0`)
- `node --test web/tests/*.test.mjs`: `449/449` pass (exit `0`)
- `node web/tests/issue-48-browser-verify.mjs`: `14/14` pass, `0` page errors (exit `0`)
- `node web/tests/browser-verify.mjs`: `33/33` pass, `0` page errors (exit `0`)
- Nonproduction preview server started on `http://127.0.0.1:4040` (PID `1690522`, synthetic multi-project data, password `correct horse battery staple`) and verified via live HTTP and headless browser (`preview-login.png`, `preview-board.png`, `preview-mobile.png`).
- All 6 feature-worktree proof files preserved and committed under `.agents/run/batch-simplify-staging/preserved-proofs/` on `feat/batch-simplify-staging`.
