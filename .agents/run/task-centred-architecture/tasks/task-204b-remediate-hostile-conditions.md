<env_preflight>
Repo: /workspace/extensions/github-task-board
Worktree: /workspace/extensions/github-task-board/.worktrees/team-dev-stage2a-attention-views
Branch: feat/stage2a-attention-views
Files: panel/main.ts, panel/index.html, test/stage2a-attention-ui.test.js
Test command: npm run typecheck && npm run build && node --test test/stage2a-attention-ui.test.js && node --test
Do not touch: config/**, master branch (do NOT push to master or origin)
Preflight facts are true and authoritative at dispatch: do not run initial discovery commands (git status, pwd, ls) to re-ground on startup. Re-inspect targeted state only for mutations/pre-commit verification, compaction/resume with stale facts, branch/location changes, or action failure.
</env_preflight>
<goal>Remediate the 5 adversarial findings (ADV-01..ADV-06) identified during the hostile review: line drift race in drawer AC, stale v2Metadata caching on mutation, null guards, accessibility labels, and repo badge truncation.</goal>
<context_files>
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/outputs/task-204-hostile-review.md]
</context_files>
<skills>
[@.agents/skills/build/discipline/surgical-patch/SKILL.md]
[@.agents/skills/build/methodology/test-driven-development/SKILL.md]
</skills>
<owned_paths>
panel/main.ts
panel/index.html
test/stage2a-attention-ui.test.js
.agents/run/task-centred-architecture/outputs/task-204b-remediation.md
</owned_paths>
<depends_on>
task-204
</depends_on>
<steps>
1. In panel/main.ts:
   - In `renderDrawerAcceptanceCriteria(issue: Issue)`:
     - Add entry guard: `if (!issue) { if (elDrawerAcceptanceCriteriaSection) elDrawerAcceptanceCriteriaSection.style.display = 'none'; return; }` (ADV-03).
     - Set accessible label on checkbox: `cb.setAttribute('aria-label', item.text);` (ADV-05).
     - In `onToggle`: After `await reloadIssueBeforeMutation(issue)`, re-locate the target item in fresh `parseAcceptanceCriteria(issue.body)` by finding item with `it.text.trim() === item.text.trim()`. Use this fresh item's `lineIndex` as the target line for `updateSubtaskInMarkdown`. If not found, fall back safely to `item.lineIndex` (ADV-01).
   - In `updateIssueBody`, `reloadIssueBeforeMutation`, and `updateIssueStatus`:
     - Recompute and update `issue.v2Metadata = resolveV2Metadata(issue, sessionsMap ? sessionsMap.get(issue.number) : undefined)` (or appropriate session lookup) so card alert badges immediately reflect changes to subtasks/questions (ADV-02).
2. In panel/index.html:
   - In CSS for `.attention-repo-badge`, add `max-width: 90px; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;` to prevent layout squeeze in 360px sidebar mode (ADV-06).
3. In test/stage2a-attention-ui.test.js:
   - Add tests verifying:
     - `renderDrawerAcceptanceCriteria(null)` does not crash.
     - AC checkboxes have `aria-label`.
     - AC toggle re-locates target item lineIndex when body lines shifted.
     - `issue.v2Metadata` is refreshed on issue update.
4. Execute `npm run typecheck && npm run build && node --test test/stage2a-attention-ui.test.js && node --test`.
5. Commit fixes on `feat/stage2a-attention-views` with conventional commit:
   `fix(ui): remediate hostile review findings for drawer AC line drift, metadata cache, and accessibility`
6. Emit completion output to `.agents/run/task-centred-architecture/outputs/task-204b-remediation.md`.
</steps>
<criteria>
- ADV-01 (line drift race) is remediated with post-reload text matching.
- ADV-02 (stale v2Metadata) is remediated with metadata recomputation.
- ADV-03 (null guard) and ADV-05 (aria-label) and ADV-06 (badge ellipsis) are resolved.
- Full test suite passes 100% (409+ tests).
</criteria>
<verification>
npm run typecheck && npm run build && node --test
</verification>
<output>
Emit structured output in .agents/run/task-centred-architecture/outputs/task-204b-remediation.md:
# Task 204b Output: Hostile Findings Remediation
## Status: completed | failed
## Evidence:
- Typecheck: PASS / FAIL
- Bundle build: PASS / FAIL
- Full test suite: passed / total
- Commit SHA on feat/stage2a-attention-views
</output>
