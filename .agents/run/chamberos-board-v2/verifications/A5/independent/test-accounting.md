# Independent test accounting: 341ff45 to final audit

Final fresh web run: 559 tests, 559 pass, 0 fail, 0 skipped, 0 todo. Legacy `npm test` remains 618 because it runs `test/*.test.js`, not `web/tests/*.test.mjs`.

538 (A4 audited base) + 2 carry-over tests + 9 A5 section tests = 549 at 6e189c3. Hostile review strengthened existing assertions but added no tests. This audit adds 8 API/parser tests and 2 presentation tests: 549 + 8 + 2 = 559. No test removed by this audit; no assertions skipped or loosened.

Reversion sensitivity below is source-based unless explicitly marked observed. No full mutation-test run performed. Reverting all A5 code would also remove exports/routes, causing import/404 failures; that is weaker evidence than detecting a particular defect. Passing tests do not establish the broader acceptance criteria.

## Existing tests added or changed since 341ff45

### `web/tests/canvas.test.mjs`

1. Changed/renamed: `canvas marker strip: removes unfenced markers and preceding blank line separator` (formerly `canvas marker strip: removes unfenced markers and preserves other content`). Expected outputs now strip one preceding blank line. Would fail if 6ce0195 stripping behavior reverted. This is an intentional expectation change for removing an inserted separator, not proof that arbitrary original whitespace survives.
2. Added: `canvas marker set+strip: preserves original body byte-for-byte`. Would fail with pre-6ce0195 strip logic for its newline-terminated fixtures. Missing no-final-newline and whitespace-only bodies; independent data probe exposes both failures.
3. Changed: `PUT /api/issues/:n/canvas: Arrange undo payload clears position of a previously unplaced card`. Prefix assertion became exact equality, but original fixture also gained final CRLF. Would fail if separator stripping reverted for this fixture. The fixture change removes coverage of the original no-final-newline body; exact equality alone is not stronger across the original domain. This audit did not repeat that substitution.
4. Added: `canvas client: note save failure retains draft with localized retry and shields draft from poll overwrite`. Source-regex assertions would fail if 6c1a3a0 removed the named map/Retry code. Not behavioral: still green with broken conflict recovery. Real browser reproduced draft retention AND unsafe refresh/Retry overwrite.

### `web/tests/a5-sections.test.mjs` — nine added, several strengthened during hostile review

5. `parseWebHumanTasks extracts checkboxes under Human Tasks and computes accurate character offsets`. Behavioral parser test; removal/broken extraction would fail. Does not prove UI.
6. `toggleHumanTaskInMarkdown preserves markdown byte-for-byte except for the single checkbox character`. Behavioral exact comparison and inverse; toggle removal or broad destructive edit would fail.
7. `toggleHumanTaskInMarkdown preserves CRLF line endings byte-for-byte`. Behavioral length/EOL/offset checks; removed toggle or EOL normalization fails. Less comprehensive than whole-string comparison, supplemented by independent test.
8. `parseWebHumanTasks ignores code fences and indented code`. Fenced fixture fails if fence exclusion reverted; despite name, this fixture contains no indented-code case. Independent test supplies that case.
9. `POST /api/issues/:n/human-tasks/:index/toggle toggles checkbox, enforces fingerprints, and validates boolean completed`. Real HTTP; route removal, missing-fingerprint exemption, non-boolean acceptance or wrong body fails. Total one-PATCH assertion covers preceding refusal cases collectively.
10. `POST /api/issues/:n/reopen enforces fingerprints, sets state:open, assigns status:backlog, and refuses open issues`. Real HTTP; route removal, missing-fingerprint exemption, or status reconciliation removal fails. Encodes backlog destination, not owner approval of that policy.
11. `POST /api/issues/:n/labels/remove and DELETE /api/issues/:n/labels/:label enforce mandatory fingerprints, reject malformed JSON, and require label presence`. Real HTTP; route removal, missing-fingerprint exemptions or absent-label write would fail. Despite name, no malformed-JSON request appears in this test; independent route tests supply it.
12. `GET /api/archive returns backburner and closed issues with bounded pagination, stable sort, and preserved metadata`. Real HTTP; endpoint removal, basic sorting/paging regressions fail. Tiny complete fixture cannot expose bounded all-issue history loss or missing client warnings.
13. `GET /api/operations returns real counts, 8 standard status columns, and accurate closed7Days using closedAt`. Real HTTP; endpoint removal or missing columns fails. Fake default `closed_at = updated_at` means using updatedAt could still pass this fixture; planned/todo assignment not asserted. Both blind spots covered independently.

### `web/tests/fake-github.mjs` — helper changes, no test count

Added explicit `closed_at`, default for closed issues, state filtering of list requests, and closed_at updates when state changes. Defaults couple closure/update timestamps; independent old-closed/edited-today fixture sets them separately. Fake pagination fixture preserves insertion order and does not model every GitHub sort behavior. Its 1000-open/one-closed bound failure is valid evidence of missing dedicated closed fetch, not a live-GitHub pagination benchmark.

## Tests added by this independent audit

### `web/tests/a5-audit.test.mjs` — eight

14. `audit A5 answer: missing/stale fingerprints and malformed JSON refuse with zero PATCH`.
15. `audit A5 human task: missing/stale fingerprints and malformed JSON refuse with zero PATCH`.
16. `audit A5 reopen: missing/stale fingerprints and malformed JSON refuse with zero PATCH`.
17. `audit A5 remove label POST: missing/stale fingerprints and malformed JSON refuse with zero PATCH`.
18. `audit A5 remove label DELETE: missing/stale fingerprints and malformed JSON refuse with zero PATCH`.

Each is a real HTTP test, asserting per-case 400/409 and actual fake PATCH count zero. Tests 15–18 would fail if hostile missing-fingerprint exemptions returned. Answer already required fingerprints before hostile review, so test 14 is not sensitive to that specific reversion; it guards existing question safety. All five detect removal of respective routes. Shared stale-fingerprint/JSON guards predate A5; their failure would be detected, but not attributed specifically to A5. Human-task test additionally rejects six non-boolean values and stale index after insertion with zero PATCH.

19. `audit A5 human task: BOM, LF, CRLF, fences, indented code, duplicate text and two-space nested list preserve exact bytes`. Behavioral exact string slicing; parser/toggle reversion or broad edits fail. Covers two-space nested list only; four-space content is intentionally treated as code. Missing section returns no tasks and toggle throws.
20. `audit A5 operations: old closure edited today excluded; unlabelled/planned/review issues counted once; repository-qualified identity`. Real HTTP over two repositories sharing issue #1; closure-only metric, project totals and planned/review counts asserted. **Observed red before product fix:** planned count `0 !== 1` in `raw/status-before-fix.log`; unchanged test green after 47bda6d. Only repository-scoped cached fetchedAt asserted here; combined fetchedAt failure recorded separately in data probe.
21. `audit A5 label removal preserves unrelated labels and refuses absent assignment with zero PATCH`. Real HTTP exact outgoing labels payload; removing absent-label precondition or deleting other labels fails.

### `web/tests/a5-presentation-audit.test.mjs` — two

22. `audit A5 presentation en: saved toggle restores global body mode and filters draft rows without altering board data`.
23. `audit A5 presentation fr: saved toggle restores global body mode and filters draft rows without altering board data`.

Behavioral VM tests execute actual client boot/render/event handlers with a minimal DOM/storage boundary. Removing persisted global toggle, body class, draft row filtering, exit restoration or data-preservation behavior fails. Language is selected in both tests, but localized wording is NOT asserted here; native browser evidence supplies the disclaimers. These tests intentionally make no claim about presentation leaks in other views, actual browser layout, CSS or Retry correctness.

## Provenance and exclusions

Manager reported concurrent auditors; earlier `web/tests/a5-audit.test.mjs` content was replaced during overlap. Its original source is not reconstructable from Git. Preserved `raw/overlap-untrusted-added.log` reports 6 pass/2 fail (question request 400 versus expected 200, Operations 0 versus 1). Do not count those as final tests or infer product correctness from them. Final eight-test file was read in full, committed in 47bda6d, and rerun after overlap. Combined final run includes all 559 current tests. No tests were deleted to address known product failures: failing exploration records remain in `data.json` and `browser.json`, whose scripts finish normally after recording observations rather than asserting suite success.

`.skip` / `.todo` scan over `test/` and `web/tests/`: zero matching lines; final TAP also reports zero skipped/todo. Scan evidence: `raw/scans.log`.

---

## Post-repair test accounting (`81ed5b6..ddfaa2c`)

Final fresh web run at `ddfaa2c`: **573 tests, 573 pass, 0 fail, 0 skipped, 0 todo** (`raw/web-test-repair-final.log`). Legacy `npm test` remains **618/618 pass** (`raw/npm-test-repair-final.log`).

Tests added after `81ed5b6` (559 -> 569 in repair range -> 573 in `ddfaa2c`):
- `web/tests/canvas.test.mjs` (+2 in `b7f1517`): exact byte-identity round-trip coverage across no-final-newline and whitespace-only bodies (`"Plain"`, `"Plain\n"`, `"Plain\n\n"`, `"Plain\r\n\r\n"`, `" \n\n"`).
- `web/tests/a5-sections.test.mjs` (+3 in `19bc8c9`): combined cached `fetchedAt` stability, dedicated `state=closed` archive pagination beyond 1,000 open issues, and non-finite `Infinity` pagination normalization.
- `web/tests/a5-presentation-audit.test.mjs` (+5 in `f2439fd` / `175af85`, +4 in `ddfaa2c`):
  - Global presentation filtering across views, note 409 conflict recovery, serialized human-task toggles, and Closed-issue exclusion from Decisions/Blocked (`f2439fd` / `175af85`).
  - `audit A4/A5 note 409: refresh preserves conflict state so Retry refuses overwrite until explicit Overwrite` (`ddfaa2c`).
  - `audit A5 presentation: planned and todo issues remain visible while explicit draft issues are hidden` (`ddfaa2c`).
  - `audit A5 cross-repo dependencies: parseRestDependencies preserves repository full_name and repository_url` (`ddfaa2c`).
  - `audit A5 navigation: boot and refresh preserve active section view` (`ddfaa2c`).
