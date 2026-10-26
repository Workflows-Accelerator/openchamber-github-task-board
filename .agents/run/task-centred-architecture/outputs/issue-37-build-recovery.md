# Issue 37 multi-repository build recovery

Status: complete build candidate, ready for independent hostile review. Not pushed, merged, deployed, closed or self-approved. Actual provider/model: `9router/genius`.

## 1. Scope and recovered work

The interrupted worker left valid discovery, registry, fixture and regression material. I preserved it, reproduced its state, and completed the missing route, identity, UI and proof work.

Recovered:

- `web/server/github.ts` partial bounded `/user/repos` discovery.
- `web/server/repositories.ts` unused registry.
- `web/server/board.ts` declared `key`/`repository` fields, not populated.
- `web/tests/fake-github.mjs` partial multi-repository fixture.
- `web/tests/multi-repo.test.mjs` original 12 tests.

Recovery run against the partial source (`verifications/issue-37-build/recovered-red.log`): 12 tests, 2 pass, 10 fail, exit 1. The original worker's "all 12 new tests fail" was not reproducible after its already-committed discovery client; the 10 missing-route failures were reproducible.

## 2. Mechanism map before recovery edits

- `web/server/config.ts` required `BOARD_REPO` and `app.ts` verified `/user` plus that repository at startup.
- One GitHub client, one repository, number-only issue locks, number-only list/detail projections.
- `/api/board` and `/api/issues/...` accepted only the configured repository implicitly.
- `public/app.js` held one board/detail, number-only navigation, number-only mutation validation and DOM-local drafts.
- Existing security controls: password session, HttpOnly/Secure/SameSite cookie, CSRF, origin/referer refusal, redirect refusal, ETag conflict checks, consumed-detail validation, UNKNOWN-never-repeat.
- Existing test seams: localhost fake GitHub, `helpers.mjs`, saved #33 browser/HTTP harnesses.

## 3. What was built

### Discovery and allowlist

- `/user/repos` discovery with `affiliation=owner,collaborator,organization_member`, 100/page, at most 10 pages.
- Strict entry parsing: exact `owner/name`, matching `owner.login`/`name`, boolean archived/has_issues, positive safe id when present.
- Duplicate names, malformed pages, malformed pagination Link URLs, origin/path escapes and page-bound overflow reject the whole discovery. No partial page is published as complete.
- `RepositoryRegistry`: 60-second freshness, coalesced refresh, failed-refresh backoff, retained last-known identities, `available` false after access loss, 10,000-entry history bound fails closed rather than evicting.
- `BOARD_REPO` is optional. When present it is a legacy default resolved through the same allowlist, never an authorization source. Inaccessible configured repository no longer prevents startup.
- Exact case-sensitive `owner/name` required for qualified reads/writes. Fabricated, case-variant, unavailable or numeric-ID-only client references return 400 before any issue upstream call. Query repository overrides remain refused.

### Qualified identity and writes

- `BoardRepository` includes owner, name, full, numeric id when available, archived and hasIssues.
- Every list row/detail has `key = owner/name#number` and `repository`.
- Fingerprint includes repository id or full name, full name and issue number in addition to body/labels/state.
- Write locks key on `owner/name#number`; queued writes re-resolve discovery freshness before any issue request.
- All three write routes (`section`, `status`, `questions/{index}/answer`) use qualified fingerprints and return qualified detail.
- Legacy `/api/board` and `/api/issues/...` still work for an existing single-repository configuration, but only through the same discovered allowlist, never a fallback.
- Combined view: `/api/combined/board`, three fixed workers, coalesced simultaneous requests, per-repository error boundary, explicit `partial`/`complete`/`failures`/loaded counts, no retries.

### Picker and combined UI

- `/api/repos` picker plus `All repositories (combined)`.
- Rows name repository; archived rows and archived scope are marked.
- Empty repository is selectable with honest empty text; issues-disabled repository is distinguished.
- Lost access stays in the picker as unavailable, with retained identity, never empty or silently removed.
- Discovery failure keeps last-known picker and pauses repository operations; no-repositories-visible and discovery-failed are distinct messages.
- Last choice is `all` or an opaque SHA-256 repository-identity digest in localStorage. No repository name, token, session/CSRF or issue/draft content is persisted.
- Detail hash contains only the issue number; combined identity is memory-only and is not inferred from a bare number on reload.
- Drafts are repository-qualified, memory-only, bound to the observed fingerprint, and old-revision drafts are displayed separately for manual recovery.
- Exact source repository, question text/index and fingerprint are checked before answering. Generation guards prevent stale reads from overwriting newer confirmed writes or an UNKNOWN outcome.
- Combined row updates replace only the exact repository identity and recompute counts.

## 4. Verification ledger

All commands were run at the final product HEAD (`fc86290`) from the worktree root. Raw logs are in `verifications/issue-37-build/`.

| Check | Result | Evidence |
| --- | --- | --- |
| Web suite `node --test web/tests/*.test.mjs` | 380/380 pass, exit 0 | `final-web-tests.log`, `final-exits.txt` |
| Root suite `npm test` | 517/517 pass, exit 0 | `final-root-tests.log`, `final-exits.txt` |
| `npx tsc -p web/tsconfig.json` | exit 0 | `final-web-types.log` |
| `npx tsc --noEmit` | exit 0 | `final-root-types.log` |
| Exact bundle build | exit 0 | `final-build.log` |
| Deterministic rebuild | exit 0 | `final-rebuild.log` |
| `sha256sum -c` bundle hash | OK, exit 0 | `bundle-sha256.txt`, `final-hash-parity.log` |
| Bundle ignored | `web/dist/server.mjs`, exit 0 | `final-bundle-ignored.log` |
| Source/bundle behavior parity | 26 normalized checkpoints equal; 25 upstream calls and 3 qualified patches per entry | `source-bundle-parity.json`, `.log` |
| Mutation harness | identity and allowlist mutants exit 1 red, restored exit 0 green | `final-mutants.log`, mutant logs |

Fresh bundle SHA-256:

`b1d2b27232b38303761d6c90c8c406190953b6c0f53a7ed8484eec217c1061f6  web/dist/server.mjs`

Bundle is gitignored and was not force-added. `web/dist/server.mjs` is a build/start artifact only.

### Red-before/green-after

- Original partial recovery: 2/12 pass, 10/12 fail (`recovered-red.log`).
- Four added discovery/identity tests: 2/16 pass, 14 fail before implementation (`extended-red.log`).
- Optional `BOARD_REPO`: 12/13 pass, 1 fail before config change (`config-red.log`).
- Client qualification suite: 0/7 pass, 7 fail before UI change (`client-red.log`).
- Late-read/UNKNOWN race: 7/8 pass, 1 fail before write-generation guard (`race-red.log`).
- Detached answer control: 0/1 pass, 1 fail before exact-source binding (`question-binding-red.log`).
- Combined row count after answer: 0/1 pass, 1 fail before count recomputation (`row-count-red.log`).
- Cleared draft resurrection: 0/1 pass before deletion, then pass (`draft-clear-red.log`, `draft-clear-green.log`).
- Unknown repository after expired failed discovery: 0/1 pass, then pass after fail-closed resolver change (`cold-allowlist-red.log`).

Discriminating mutants (`mutants.mjs`):

- Number-only `identity()` in `web/public/app.js`: fails `qualified overview drafts survive navigation without crossing same-number repositories`; mutant 0 pass/1 fail/exit 1, restored 1 pass/0 fail/exit 0.
- Allowlist bypass in `web/server/app.ts` returning a fabricated repository entry: fails `fabricated, unknown and case-variant repositories are refused before any GitHub call and never fall back to the default`; mutant 0 pass/1 fail/exit 1, restored 1 pass/0 fail/exit 0.

## 5. #33 saved matrix preservation

Copied the saved #33 harnesses into this proof directory, changing only proof output paths and qualified route paths. Synthetic producer fixtures now include repository identity because the response contract changed. No assertions or cases were deleted or skipped.

| Adapted harness | Result |
| --- | --- |
| `browser-baseline.mjs` | 32/32 checks, exit 0, 10 screenshots |
| `browser-matrix.mjs` | 84/84, exit 0 |
| `additional-browser.mjs` | 117/117, exit 0 |
| `residual-http.mjs` | 36/36, exit 0 |
| `additional-http.mjs` | 129/129, exit 0 |
| `browser-gateway.mjs` | 19/19, exit 0; one committed PATCH per case, UNKNOWN with refresh guidance, no repeat |

The adapted baseline and matrix logs are `final-browser-*.log`, `final-residual-http.log`, `final-additional-http.log` and `final-browser-gateway.log`; JSON summaries are the corresponding `.json` files.

## 6. Multi-repository visual proof

`multi-browser.mjs` (synthetic localhost, Obscura CDP) passed 25/25 checks and wrote 12 final screenshots:

- `screenshots/combined-1280.png`, `combined-360.png`
- `screenshots/archived-1280.png`, `archived-360.png`
- `screenshots/empty-1280.png`, `empty-360.png`
- `screenshots/partial-1280.png`, `partial-360.png`
- `screenshots/unavailable-1280.png`, `unavailable-360.png`
- `screenshots/discovery-failed-1280.png`, `discovery-failed-360.png`

Also inspected final baseline screenshots: board/detail/login/conflict/stale/empty at desktop and 360px, timestamped `2026-10-26T18-44-42-356Z`.

Observed:

- Combined rows show `owner/alpha #1`, `owner/beta #1`, `owner/archived #1`; same number remains separate.
- Archived select is marked `archived`, scope says archived and may refuse edits.
- Empty repository shows honest `No tasks in owner/empty`.
- Partial refresh banner says `Partial refresh — results are NOT complete` and names `owner/beta`.
- Lost access says unavailable, last identity retained, not empty.
- Discovery failure keeps the picker and says operations are paused.
- No horizontal overflow at 1280 or 360; labels readable.

## 7. Security assessment

Full self-check: `verifications/issue-37-build/security-audit.md`.

Count: Critical 0, High 0, Medium 0, Low 3, Info 2.

Preserved: password session, server-held token, CSRF, origin/referer checks, redirect refusal, ETag conflict handling, post-write verification, UNKNOWN-never-repeat, consumed-detail validation, mixed-indent exclusion, CSP/security headers.

Low findings:

1. No total combined issue cap; up to 1,000 current repositories x 1,000 issues can be materialized with 3 workers. Bounded, but large estates could be slow/heavy. Documented, not silently omitted.
2. Repository-choice digest in localStorage is pseudonymous, not a secret; candidate names can be guessed. No name/credential/content stored.
3. Unavailable identity history is process-memory only; restart loses it.

Info: 60-second stale allowlist window; upstream denies lost access. Synthetic credentials appear only in fixtures.

## 8. Files and commits

Commits (four product/test commits, then this report/proof commit):

- `9fae7a1` `feat(web): discover and enforce repository-qualified board access`
- `23d0c33` `feat(web): add repository picker and isolated combined-view editing`
- `7a444b1` `fix(web): bind answer controls and refresh qualified row counts`
- `fc86290` `test(web): cover cleared drafts and aggregate discovery boundaries`
- final report/proof commit to be recorded in the handoff

Changed product/test paths relative to `752407a`:

`web/README.md`, `web/public/app.js`, `web/public/index.html`, `web/public/theme.css`, `web/server/app.ts`, `web/server/board.ts`, `web/server/config.ts`, `web/server/github.ts`, `web/server/repositories.ts`, `web/tests/app.test.mjs`, `web/tests/config.test.mjs`, `web/tests/fake-github.mjs`, `web/tests/multi-repo-client.test.mjs`, `web/tests/multi-repo.test.mjs`.

No panel/service/root-test/shared-config/other-worktree changes. No new dependencies. No push/merge/deploy/closure.

## 9. Limitations and blind spots

- No real multi-repository GitHub token or live GitHub: all evidence is synthetic localhost.
- No claim that hidden private repositories are enumerable; discovery is only `/user/repos` token visibility.
- No deployment, hosting, proxy/TLS/container changes or operational validation.
- No independent hostile review or self-approval.
- Combined detail identity is memory-only; reload from a combined context returns to the board rather than reconstructing repository identity from a number-only URL.
- Restart loses previously known unavailable identities.
- No durable draft store; drafts are memory-only and bounded (latest 100 entries).
- No full keyboard/tab traversal matrix; visual harness checks text, identity, storage, URL, logs and overflow.
- Total combined issue response remains a disclosed low-risk bound.

## 10. Build/recovery notes

- DIDN'T WORK: partial source had 2/12 recovery tests passing, not the claimed 12 red. FINALLY WORKED: recorded the actual 10 route failures and used the preserved source as the baseline.
- DIDN'T WORK: initial typecheck rejected optional private `repo` and implicit `part`. FINALLY WORKED: explicit nullable `repo` field and string annotation.
- DIDN'T WORK: lazy discovery broke existing startup/error fixtures. FINALLY WORKED: nonfatal startup discovery, preserving auth/security expectations while `BOARD_REPO` stopped gating startup.
- DIDN'T WORK: an expired failed discovery still allowed a fabricated repository to trigger discovery. FINALLY WORKED: unknown names fail before refresh; zero upstream calls.
- DIDN'T WORK: a stale detail read could clear a later UNKNOWN. FINALLY WORKED: write-generation guard.
- DIDN'T WORK: detached answer input could target the current issue. FINALLY WORKED: source repository/fingerprint binding.
- DIDN'T WORK: Obscura has no `selectedOptions`; harness threw `TypeError: Cannot read properties of undefined (reading '0')`. FINALLY WORKED: look up the selected value in `.options`.
- DIDN'T WORK: clearing a draft could resurrect the old typed value. FINALLY WORKED: delete the current fingerprint draft when fields equal the observed issue.
