<env_preflight>
Repo: /workspace/extensions/github-task-board
Worktree: /workspace/extensions/github-task-board/.worktrees/team-dev-stage2a-attention-views
Branch: feat/stage2a-attention-views
Files: panel/index.html, panel/main.ts, panel/main.js, test/stage2a-attention-ui.test.js
Test command: node --test test/stage2a-attention-ui.test.js && node --test
Do not touch: config/**, master branch (do NOT push to master or origin)
Preflight facts are true and authoritative at dispatch: do not run initial discovery commands (git status, pwd, ls) to re-ground on startup. Re-inspect targeted state only for mutations/pre-commit verification, compaction/resume with stale facts, branch/location changes, or action failure.
</env_preflight>
<goal>Conduct a hostile review of any edits or changes made in Stage 2A to figure out what might have been missed or what might be broken. Don't assume that what was done is right.</goal>
<context_files>
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/PLAN-STAGE2A.md]
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/stage2-doubt-audit.md]
</context_files>
<skills>
[@.agents/skills/review/adversarial/doubt-driven-development/SKILL.md]
[@.agents/skills/review/quality/code-review-and-quality/SKILL.md]
</skills>
<owned_paths>
.agents/run/task-centred-architecture/outputs/task-204-hostile-review.md
</owned_paths>
<depends_on>
task-203
</depends_on>
<steps>
1. Conduct adversarial audit of all git diffs on `feat/stage2a-attention-views`:
   - Inspect `panel/index.html`: Are CSS class names colliding? Is layout responsive down to 360px sidebar mode? Are aria attributes properly maintained?
   - Inspect `panel/main.ts`:
     - Does `renderAttentionView` handle issues with missing or undefined `v2Metadata` without throwing `TypeError: Cannot read properties of undefined`?
     - Does `formatAlertBadges` strictly emit zero HTML for neutral issues?
     - Does `renderDrawerAcceptanceCriteria` properly sanitize markdown text with `escapeHtml` to prevent XSS?
     - Does toggling an AC checkbox corrupt other sections or cause off-by-one lineIndex errors in `body`?
     - What happens if `acceptanceCriteria` is null or undefined?
   - Inspect `test/stage2a-attention-ui.test.js`:
     - Are tests genuine or tautological? Do they execute the production code paths or merely test local mock functions?
2. Stress test with adversarial edge cases:
   - Issue with 500 acceptance criteria items: does the drawer scroll cleanly or crash?
   - Issue with malformed labels or missing titles: does the Attention View render or fail?
   - Rapid view switching between List, Kanban, and Attention: does stale state leak into containers?
3. Execute `npm run typecheck && npm run build && node --test`.
4. Emit findings and hostile verdict: `PROCEED` | `PROCEED-WITH-CONDITIONS` | `HALT` to `.agents/run/task-centred-architecture/outputs/task-204-hostile-review.md`.
</steps>
<criteria>
- Hostile scrutiny applied to all Stage 2A changes.
- Concrete verification of zero regressions and robust handling of edge cases.
- Explicit verdict emitted.
</criteria>
<verification>
node --test test/stage2a-attention-ui.test.js && node --test
</verification>
<output>
Emit structured output in .agents/run/task-centred-architecture/outputs/task-204-hostile-review.md:
# Task 204 Output: Stage 2A Hostile Review
## Verdict: PROCEED | PROCEED-WITH-CONDITIONS | HALT
## Adversarial Findings Matrix:
| ID | Severity | File:Line | Description | Resolution / Residual |
## Edge Case Verification:
- Missing/undefined v2Metadata: PASS / FAIL
- 360px sidebar wrapping: PASS / FAIL
- XSS escaping in drawer AC: PASS / FAIL
- View switching state isolation: PASS / FAIL
## Test Verification:
- Total tests passed: X / Y
</output>
