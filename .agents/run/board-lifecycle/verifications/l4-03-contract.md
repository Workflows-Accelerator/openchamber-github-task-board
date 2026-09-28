# L4 hostile review — CONTRACT + EXTRACTION (ses_cb7138841e2593d7a1f8bdff)

Reviewed: commit 7196e06 (issue #22). Verdict: PASSED with 12 findings, fixes claimed
applied BUT **NEVER COMMITTED — worktree /tmp/opencode/issue-lifecycle-issue-contract-v1
was wiped before integration (2026-09-28). THE FIXES BELOW MUST BE RE-APPLIED.**
This file is the recovery blueprint.

## Findings and required fixes

1. [HIGH] panel/core.ts:78 — heading regexes (questionsSectionRegex, humanTasksSectionRegex,
   headingRegex) lacked optional leading whitespace (`^[ \\t]*`) and heading levels beyond h4
   (`#{1,6}`), dropping indented or nested markdown headings. FIX: support leading
   whitespace + h1-h6.
2. [MEDIUM] panel/core.ts:89,144,192,224 — parseFriendlyTitle/parseHumanTasks/
   parseOpenQuestions/parseSubtasks failed to strip leading UTF-8 BOM (`\uFEFF`). FIX: strip BOM.
3. [MEDIUM] panel/core.ts:164,209,248 — parsers accepted empty/whitespace-only checklist
   items (`- [ ]   `), pushing blank entries into collections. FIX: ignore empty items.
4. [MEDIUM] panel/core.ts:153,201,234 — line parsing stripped only trailing `\r`
   (`replace(/\r$/, '')`), leaving CR on mixed CRLF strings. FIX: global `replace(/\r/g, '')`.
5. [HIGH] panel/core.ts:328 — collectHumanTodos multi-session fallback picked `session[0]`
   even when bound to another issue (cross-issue waiting-task hijack). FIX: match session to
   issue by number, title, or worktree; fall back only when `session.length === 1`.
6. [MEDIUM] panel/labels.ts:107,163 — STATUS_METADATA descriptions for `draft` and `done`
   diverged from spec (draft must state passive ideas/notes; done must reflect human
   validation, no agent self-close). FIX: align with docs/issue-body-contract.md.
7. [HIGH] panel/main.ts:1767,1828 — resolveIssueColumn in main.ts routed idle sessions to
   `'in-review'` instead of `'needs-human'` (D3). FIX: route idle -> needs-human.
8. [HIGH] panel/main.js — production bundle out of sync with TS sources. FIX: rebuild via
   `npm run build`.
9. [MEDIUM] test/shipped-parity.test.js:46 — answerOpenQuestionInMarkdown exported but
   omitted from JS_FUNCS parity list. FIX: add to parity list + test.
10. [MEDIUM] test/optimizations.test.js:258,355 — mocks of resolveIssueColumn/
    resolveDefaultTab omitted `status:needs-human`, breaking tab resolution tests. FIX: add
    explicit status:needs-human check to the mocks.
11. [docs] docs/issue-body-contract.md — fold the 3 v1 clarifications (D9):
    (a) Human Tasks and Open Questions items must be self-contained prose (voice reads raw
    issue bodies over REST, no drawer metadata);
    (b) cross-repo dependencies use full URLs, never `#N` shorthand;
    (c) issues actively blocked awaiting alignment sit in `status:needs-human`; passive
    ideas stay `status:draft`.
12. Test additions claimed in test/human-tasks.test.js: duplicate sections, fallback
    hierarchies, whitespace heading variants, HTML entities, BOM, mixed CRLF. Plus
    test/status-model.test.js assertions validating status metadata descriptions against v1.

## Post-fix evidence (claimed, uncommitted)
- npm run build PASS (panel/main.js 407.8kb), npm run typecheck PASS,
  npm test PASS (217 tests, 0 fail).

## Recovery acceptance
All fixes above present; full suite green (expect >= 234 with the views tests);
panel/main.js rebuilt; shipped-parity green; docs contain the 3 clarifications.
