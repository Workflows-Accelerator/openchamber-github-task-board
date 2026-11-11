<env_preflight>
Repo: /workspace/code/openchamber-github-task-board
Worktree: /workspace/code/openchamber-github-task-board/.worktrees/team-dev-board-v3
Branch: feat/board-v3
Base commit: 2ae7f9d (clean)
Review scope: `git diff 6826bc8..2ae7f9d` — V3-5 sign-in hotfix (`0e6d237`) plus V3-6 canvas-write fix (`274c152`, evidence `2ae7f9d`)
Root checkout: /workspace/code/openchamber-github-task-board on branch ops/task-board-activation (DO NOT modify or switch branches in root checkout)
Real Chromium launcher: /workspace/code/openchamber-github-task-board/.worktrees/team-dev-board-v3/.agents/run/chamberos-board-v2/verifications/A-delivery/hostile2/scripts/chromium-env.sh
Test commands (RUN SEQUENTIALLY, never in parallel): npm test ; node --test --test-timeout=30000 web/tests/*.test.mjs ; npm run typecheck ; npx esbuild web/server.ts --bundle --platform=node --format=esm --target=node20 --packages=external --outfile=/tmp/opencode/v3-review.mjs
Do not touch: panel/**, service/**, dot-grid formula at web/public/app.js:2268, /workspace/code/openchamber-config/**, /workspace/.openchamber-data/**, /workspace/releases/**, git push, git reset, git rebase, GitHub issue/label mutations
Do NOT run `git remote -v` or print any credential. Never mutate a real GitHub repository; all GitHub behaviour must be modelled by the fake fixtures or a local stub.
Preflight facts are true and authoritative at dispatch.
</env_preflight>

<goal>
Run an independent, hostile L4 review of two commits that have NOT been reviewed: the V3-5 sign-in hotfix (already live) and the V3-6 fix that removed `If-Match` from issue writes. Assume both are wrong until proven. Return two explicit verdicts. The manager will not push `master` or deploy without them.
</goal>

<claims_to_attack>
The V3-6 author claims:
1. Root cause: `github.ts:257-259` sent `If-Match` on the issue `PATCH`; real GitHub rejects any unsafe request with a conditional header (`400 Conditional request headers are not allowed in unsafe requests...`), so no issue write has ever reached GitHub on this codebase (since `af62a4e`).
2. `kindForStatus()` had no `400` case and returned `'server'`, producing `502 write_outcome_unknown` — the "unknown error" the user reported.
3. Fix: `If-Match` removed from issue updates (`github.ts:257-264,543`, call sites `app.ts:2266,2434,2606`); `400 -> 'invalid'` (`github.ts:148`); a new `write_rejected` branch with GitHub's reason (`app.ts:2615-2627`); EN+FR client messages (`app.js:685-691,868-874,2767-2795,2872`).
4. Fakes previously hid the bug because `honorIfMatch` defaulted off; the fixture now refuses conditional unsafe requests like GitHub.
5. The regression suite `web/tests/v3-6-canvas-persistence.test.mjs` (8 tests) fails 5/8 on `5b46807` and passes 8/8 on the fix.
6. Nothing else changed: `panel`/`service` untouched, dot grid byte-identical, 618 legacy + 609 web + typecheck + bundle + smoke all green.
</claims_to_attack>

<attack_list>
1. **Lost-update safety.** With `If-Match` gone, what prevents two writers from clobbering each other? Find the actual mechanism (fingerprint/409) and prove it still works end to end for: two tabs editing the same issue, a drag racing a status change, and a body-deleting write racing a note. If the guarantee is now weaker, say exactly what is no longer protected and whether the user can lose data.
2. **Scope of the removal.** Grep the whole `web/` tree for `If-Match`, `if-match`, `etag` on unsafe methods. Prove no other unsafe request still carries a conditional header, and that conditional GETs (`If-None-Match`) are untouched and still correct.
3. **Error classification.** Audit `kindForStatus()` and the new `write_rejected` branch: can a genuinely retryable failure now be reported as a permanent rejection, or vice versa? Does a `400` from a different cause (bad label, invalid field) produce a message that helps the user fix it? Are `401/403/404/409/412/422/429/5xx` all classified sensibly?
4. **Regression-suite integrity.** Read `web/tests/v3-6-canvas-persistence.test.mjs` and prove it would fail for the right reason on the base commit, not because of a fixture artefact. Check `fake-github.mjs` and the two inverted assertions (`simple-views.test.mjs:108`, `github.test.mjs:62-80`): confirm no assertion was deleted or weakened, and that removing five `honorIfMatch` fixtures did not reduce coverage of other real behaviours.
5. **Client behaviour.** On a failed canvas write, does the card snap back to its persisted position, is the typed or dragged state not silently lost, and is the message precise in EN and FR? Assert zero generic "Outcome unknown" for known 4xx causes.
6. **V3-5 sign-in hotfix.** Verify the CSS guard cannot hide the dock for a signed-in user (including a slow or failed `/api/board`), cannot be bypassed by the login view being shown after the board was rendered, and that the regression test would fail if the guard were removed. Check the sign-in card centring at `360x800` and `1280x900` in both themes.
7. **Whole-path sanity.** With the fake modelling real GitHub refusal, exercise every write the product offers end to end — create task, status change, priority, draft/order, dependency add/remove, canvas drag, note, reopen — and report which of them were also broken before the fix and are now working. This list matters for the user.
</attack_list>

<conduct>
- Reproduce before believing: run the failing scenario on the base commit if you doubt a claim.
- Fix only P0/P1 defects you find, at root cause, with a regression test; maximum two bounded fix passes. P2 findings are reported, not fixed.
- Do not change product behaviour the user approved; a defect fix must restore intended behaviour, not redesign it.
- Record everything in `.agents/run/chamberos-board-v2/verifications/V3-7/report.md` and commit on `feat/board-v3`.
</conduct>

<criteria>
1. Two explicit verdicts: Spec (PASS/FAIL) and Quality (APPROVED/NEEDS_FIXES), with zero open P0/P1.
2. A table of every product write path: broken before the fix, working after, proven with fake-GitHub-backed tests.
3. A clear statement of the current concurrency guarantee after removing `If-Match` (what is protected, what is not, and the residual risk in one sentence).
4. Evidence that no assertion was deleted or weakened anywhere in the diff.
5. `npm test` 618/618, all `web/tests/*.test.mjs`, typecheck and bundle pass, sequential, on the final clean tree.
</criteria>

<output>
Respond in concise structured Markdown with:
- SPEC_VERDICT: PASS | FAIL
- QUALITY_VERDICT: APPROVED | NEEDS_FIXES
- WRITE_PATH_TABLE: path | broken before | working after | how proven
- CONCURRENCY_AFTER: one paragraph
- DEFECTS_FOUND_AND_FIXED: numbered, with file:line and SHA, or none
- ASSERTION_AUDIT: proof nothing was deleted or weakened
- FINAL_HEAD_SHA: clean commit
- TEST_COUNTS: sequential
- NOT_RUN: honest list
</output>
