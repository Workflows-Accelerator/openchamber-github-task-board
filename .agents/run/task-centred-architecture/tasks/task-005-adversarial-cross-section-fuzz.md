<env_preflight>
Repo: /workspace/extensions/github-task-board
Worktree: /workspace/extensions/github-task-board/.worktrees/team-dev-stage1-contract-shell
Branch: feat/stage1-contract-shell
Base commit: 98eb0e3
Files: panel/core.ts, test/stage1-dual-mode-and-scoping.test.js
Test command: node --test test/stage1-dual-mode-and-scoping.test.js && node --test
Do not touch: panel/labels.ts, panel/main.ts, docs/issue-body-contract.md, package.json
Preflight facts are true and authoritative at dispatch: do not run initial discovery commands (git status, pwd, ls) to re-ground on startup. Re-inspect targeted state only for mutations/pre-commit verification, compaction/resume with stale facts, branch/location changes, or action failure.
</env_preflight>
<goal>Conduct adversarial stress-testing against Stage 1 parsing and grouping logic to actively hunt for edge cases, section bleeding, and malformed markdown exploits.</goal>
<context_files>
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/PLAN.md]
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/outputs/task-001-section-scoped-parser.md]
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/outputs/task-002-dual-mode-4axis-metadata.md]
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/outputs/task-003-attention-grouping.md]
</context_files>
<skills>
[@.agents/skills/review/adversarial/doubt-driven-development/SKILL.md]
[@.agents/skills/review/audit/ponytail-review/SKILL.md]
</skills>
<owned_paths>
panel/core.ts
test/stage1-dual-mode-and-scoping.test.js
.agents/run/task-centred-architecture/outputs/task-005-adversarial-fuzz.md
</owned_paths>
<depends_on>
task-004
</depends_on>
<steps>
1. Author hostile edge-case and fuzz tests in test/stage1-dual-mode-and-scoping.test.js:
   - Fenced code blocks with `- [ ]` syntax: verify excluded from all checklist items.
   - Heading variations: trailing colon missing, extra spaces, uppercase/lowercase.
   - Large payload performance: 5,000 checkboxes across sections execute in <50ms.
   - Mixed/conflicting labels: deterministic precedence verification.
   - CRLF and mixed line endings.
2. Run test command: node --test test/stage1-dual-mode-and-scoping.test.js.
3. If any section bleeding or crash is discovered, fix in panel/core.ts.
4. Record all adversarial attacks and outcomes in .agents/run/task-centred-architecture/outputs/task-005-adversarial-fuzz.md.
</steps>
<criteria>
- Checkboxes inside code blocks are strictly excluded.
- Heading variations and malformed inputs never throw exceptions.
- 5,000 checkbox payload parses in <50ms without catastrophic backtracking.
- Full regression test suite remains 100% passing (360/360 pass).
</criteria>
<verification>
node --test test/stage1-dual-mode-and-scoping.test.js && node --test
</verification>
<output>
Emit structured output in .agents/run/task-centred-architecture/outputs/task-005-adversarial-fuzz.md:
# Task 005 Output: Adversarial Fuzzing & Hostile Disproval
## Status: completed | failed
## Attack Vectors Tested:
- Fenced code blocks: PASS / FAIL
- Heading variations & CRLF: PASS / FAIL
- 5,000-item scale performance: PASS / FAIL (duration_ms)
- Conflicting labels precedence: PASS / FAIL
## Defects Found & Resolved:
- List of fixes applied
</output>
