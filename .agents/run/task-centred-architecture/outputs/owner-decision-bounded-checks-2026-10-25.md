# Owner decision needed — both bounded rechecks failed (2026-10-25)

Both independent rechecks returned HALT. Neither candidate is merged. Both findings sets are narrow,
anchored and independently reproduced with saved probe matrices; only new authority is needed to
continue, because decision 16 bound #33 to one correction plus one recheck, and #35 has already had
two builder attempts.

## #33 standalone board — candidate d41ff34, recheck a4191a4

Security APPROVED, Spec PARTIAL, Quality NEEDS-FIXES.
Passed: 12 protocol / 108 web / 466 root tests, types, bundle parity (97ad1611...), redirect refusal,
auth/CSRF/credential boundaries, 28 preserved probes, 32-check baseline, desktop and 360px visuals.
Standing defects, all in the new write-outcome and question-target code:
1. R1 Medium — save-reply validation is shallow: `statusOptions:[null]`, `statusLabel:{}`,
   `editableSections:[{}]` still throw raw errors, show false "Saved", or wipe drafts.
   51/84 browser cases pass, 33 fail; exactly one PATCH per case, no repeat.
2. R2 Low — `errors:[]`, a generic errors array, or a "validation failed" substring still turns a
   committed 422 into a definitive 400 instead of unknown. 27/36 HTTP cases pass.
3. R3 Low — one to three spaces followed by a tab reaches code indentation and is offered as a real
   question; direct answer mutates code with one PATCH. 18/24 HTTP cases pass.

Minimum corrections are stated per finding; no schema framework, no `panel/core.ts` edit.

## #35 write-through-refresh — candidate 0af35ae, recheck 220d1d5

Spec PARTIAL, Quality NEEDS-FIXES, HALT. 25 targeted / 45 preserved / 542 full green, types, build,
byte parity (d7595492...), and 30 saved probes pass. 165 independent observations: 125 pass, 40 fail.
1. R1 High — a creation reply whose body names another repository can replace that repository's row
   and make the next label change land there (both creation paths).
2. R2 Moderate — an older refresh erases UNKNOWN protection, so a dependent write proceeds; the
   combined cache can miss the marker entirely.
3. R3 Moderate — an older definite rejection rolls back a newer successful label change (all three
   drawer writes).
4. R4 Moderate — an older incremental refresh deletes an issue created since it started.
5. R5 Moderate — a write through a stale issue object never reaches the refreshed current row.
6. R6 Moderate — partial aggregate warning is lost when the combined cache is re-entered.
7. R7 Moderate — an HTTP 200 non-list aggregate reply is treated as an empty, complete repository.
8. R8 Moderate — a failed success toast marks a confirmed write as unknown.
9. R9 Low — the new two-repository test still passes with number-only identity keys.

## Options

1. **One final narrow pass each (recommended).** #33: exactly R1–R3 plus regressions, then one
   independent recheck. #35: R1–R9 with a regression each, then one independent recheck. A third
   failure parks that issue permanently with no further autonomous pass. Keeps the flagship board and
   closes the wrong-write risk before any human uses the panel.
2. **Narrow #35 to its danger and truthfulness findings.** Fix R1, R3, R8, R9 now; split R2, R4–R7
   into a follow-up issue. #33 still gets R1–R3. Faster release, partial delivery against #35's own
   stated outcome.
3. **Park both.** Validate and release the three already-accepted fixes (#28, #34, #36) on the panel,
   leave #33 and #35 blocked with these findings recorded for later.

Nothing is deployed either way; master and issue closure remain owner-only.
