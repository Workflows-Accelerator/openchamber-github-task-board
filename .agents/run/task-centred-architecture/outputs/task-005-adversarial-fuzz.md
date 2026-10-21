# Task 005 Output: Adversarial Fuzzing & Hostile Disproval

## Status: completed

## Attack Vectors Tested:
- Fenced code blocks: PASS
- Heading variations & CRLF: PASS
- 5,000-item scale performance: PASS (40.03ms across 5 distinct parsers)
- Conflicting labels precedence: PASS

## Defects Found & Resolved:
1. **CRLF Line-Ending Trailing Carriage Return Regex Incompatibility in `updateSubtaskInMarkdown` and `answerOpenQuestionInMarkdown`:**
   - *Discovery:* When parsing Windows/CRLF markdown files (`\r\n`), lines split by `\n` retained `\r` at the end of the line. Because ECMAScript `.` in regular expressions does not match line terminators (`\r`), `checklistRegex = /^(\s*(?:[-*+]|\d+\.)\s*\[)([ xX])(\]\s+)(.+)$/` failed to match any line ending in `\r`, causing checkbox updates to silently fail and no-op on CRLF documents.
   - *Fix:* Stripped trailing `\r` before regex evaluation in `updateSubtaskInMarkdown` and `answerOpenQuestionInMarkdown`, and preserved the exact `\r\n` line termination when rewriting the line, preventing line-ending degradation and ensuring reliable toggling.

2. **Uncaught TypeError in `parseOpenQuestions` with Non-String Inputs:**
   - *Discovery:* Passing non-string inputs (e.g., numbers, booleans, objects) threw `TypeError: body.startsWith is not a function` because `!body` evaluated to `false` for truthy non-strings while `body.startsWith('\uFEFF')` failed.
   - *Fix:* Added strict type checking `if (!body || typeof body !== 'string') return [];` matching `parseAcceptanceCriteria`, `parseSubtasks`, `parseHumanTasks`, and `parseTestPlan`.

3. **Fallback Section Bleeding for Unparenthesized `## Test Plan` Headings in `parseSubtasks`:**
   - *Discovery:* Issues lacking an explicit subtasks section fell back to collecting unstructured checkboxes. While `## Test Plan (Issue)` and `## Test Plan (Batch)` were excluded, unparenthesized `## Test Plan:` or `## Test Plan` headings were not matched by the exclusion regex, causing test items under generic test plan headings to bleed into subtasks.
   - *Fix:* Replaced specific exclusions with a unified `testPlanHeadingRegex = /^[ \t]*#{1,6}\s*test\s+plan(?:\s*\(.*?\))?(?:\s*:)?/i` ensuring all test plan variations are cleanly excluded during fallback extraction.

4. **Missing UTF-8 BOM Stripping and CRLF Normalization in `parseTestPlan`:**
   - *Discovery:* `parseTestPlan` lacked `\uFEFF` BOM handling and line-by-line `\r` removal present in the other parsers, making it fragile to Windows line endings and UTF-8 encoded files.
   - *Fix:* Added `\uFEFF` BOM stripping and line-by-line carriage return removal to `parseTestPlan`.

5. **Non-Deterministic Ordering for Conflicting V2 Labels in `resolveV2Metadata`:**
   - *Discovery:* Conflicting labels within the same axis (e.g., `['attention:none', 'attention:needs-permission']` or `['phase:draft', 'phase:done']`) were resolved based purely on array traversal order rather than state semantics, meaning label ordering could unintentionally demote an active permission request.
   - *Fix:* Implemented deterministic precedence mappings: `ATTENTION_PRECEDENCE` (`needs-permission` [4] > `needs-decision` [3] > `needs-review` [2] > `none` [1]), `PHASE_PRECEDENCE` (`done` [10] > `archive` [9] > ... > `draft` [1]), `LIVENESS_PRECEDENCE` (`failed` [5] > ... > `idle` [1]), and `dependency:blocked` > `dependency:ready`.
