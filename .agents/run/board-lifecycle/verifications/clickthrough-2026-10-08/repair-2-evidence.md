# Repair 2 Verification Evidence: F-01 (LOW) Token-Boundary Lookaround Parser

**Date:** 2026-10-08  
**Worktree:** `/workspace/extensions/github-task-board/.worktrees/team-dev-clickthrough-titles-queues-picker`  
**Branch:** `fix/clickthrough-titles-queues-picker`  
**Target:** Finding F-01 (LOW) in `formatTaskTextWithLinks` (`panel/core.ts`)  

---

## 1. Finding F-01 Summary & Root Mechanism

- **Defect:** In `formatTaskTextWithLinks`, sequential regex matching over HTML resulted in:
  1. Nested `<a>` tags when markdown link labels contained issue URLs or shorthand references (e.g. `[https://github.com/owner/repo/issues/1](...)` -> `<a ...><a ...>...</a></a>`).
  2. Skipped adjacent URLs due to delimiter consumption by `(^|[^"'])` and `([^"']|$)` in regex 2.
- **Mechanism Applied:** Reworked URL and shorthand matching to use zero-width token-boundary lookarounds:
  - Full issue URL regex: `/(?<![\w/])(https:\/\/github\.com\/[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+\/issues\/\d+)(?![^<]*<\/a>)(?![/\w])/g`
  - Cross-repo shorthand regex: `/(?<![\w/])([a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+)#(\d+)\b(?![^<]*<\/a>)/g`
  - Negative lookahead `(?![^<]*<\/a>)` guarantees tokens inside an existing `<a>` tag (in `href` attribute or link label text) are never matched.
  - Lookbehind `(?<![\w/])` and lookahead `(?![/\w])` match tokens at exact word boundaries without consuming intervening whitespace delimiters.

---

## 2. Red / Green Proof & Mutation Evidence

### Reproduction & Red Phase
- Added 3 regression tests to `test/clickthrough-repair-titles-queues-picker.test.js`:
  1. `F-01: formatTaskTextWithLinks does not wrap markdown link labels with URLs or shorthand in nested <a> tags`
  2. `F-01: formatTaskTextWithLinks links multiple adjacent issue URLs separated by whitespace independently`
  3. `F-01: formatTaskTextWithLinks bare URL links correctly and preserves security invariants`
- Mutated fix off (restoring sequential regexes with delimiter consumption):
  - Subtest 12 FAILED: `actual: '<a href="https://example.com" ...><a href="https://github.com/owner/repo/issues/1" ...>https://github.com/owner/repo/issues/1</a></a>'`, `expected: '<a href="https://example.com" ...>https://github.com/owner/repo/issues/1</a>'`.
  - Subtest 13 FAILED: `'second adjacent URL must be converted to link'` (`expected: true, actual: false`).

### Green Phase
- Applied token-boundary lookarounds in `panel/core.ts:185,191`.
- Rebuilt bundle `panel/main.js`.
- All 14 tests in `test/clickthrough-repair-titles-queues-picker.test.js` PASSED.

---

## 3. Hostile Security Audit

Re-verified all XSS and injection defenses:
1. **HTML entity escaping before linking:** `<script>alert(1)</script>` -> `&lt;script&gt;alert(1)&lt;/script&gt;` (PASS).
2. **Attribute breakout blocked:** `[click](https://evil.com/x"onmouseover="alert(1))` -> attribute safely escaped as `&quot;onmouseover=&quot;` within `href` attribute (PASS).
3. **Dangerous protocol blocked:** `[click](javascript:alert(1))` -> `javascript:` does not match `https?://` protocol requirement and remains unlinked text (PASS).

---

## 4. Full Quality Gates

- `npm run typecheck`: 0 errors (PASS).
- `npm run build`: built bundle in 79ms (PASS).
- `git diff --exit-code panel/main.js`: 0 (byte parity verified) (PASS).
- `node --test test/*.test.js`: 297 passed, 0 failed (294 baseline + 3 new regression tests) (PASS).
