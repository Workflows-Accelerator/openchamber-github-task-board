<goal>Independently hostile-review the GitHub issue-body edits just applied to the twelve open issues of Workflows-Accelerator/openchamber-github-task-board (friendly titles plus the issue 23 Human Tasks/Open Questions handoff) and find anything mangled, missing, duplicated, truncated or misapplied. Do not trust the implementer's report.</goal>
<context_files>
[@/workspace/extensions/github-task-board/.agents/run/board-lifecycle/issue-23-update-2026-10-08.md]
[@/workspace/extensions/github-task-board/.agents/run/board-lifecycle/feedback-2026-10-08.md]
</context_files>
<skills>
[@/workspace/config/opencode/.agents/skills/review/adversarial/doubt-driven-development/SKILL.md]
[@/workspace/config/opencode/.agents/skills/communication/clarity/answer-first/SKILL.md]
</skills>
<scope>
Read-only everywhere. GitHub reads via gh only. MUST NOT edit any issue, label, state or file, and MUST NOT run any write command. Your only output is the review report returned to the manager, optionally also written to /workspace/extensions/github-task-board/.agents/run/board-lifecycle/verifications/issue-bodies-l4-2026-10-08.md. Never print token or credential values.
</scope>
<titles>
#10 Watch All Project Sessions
#12 Batch Review Before Done
#14 Notify Agent When Tasks Done
#15 Protect Scratchpad Across Repos
#17 Fix Voice All Projects Queries
#18 Add Rate Limit Backoff
#19 Keep Inputs Focused While Loading
#20 Stop Idle Moves To Review
#21 Issue Lifecycle Agent Skill
#22 Human Tasks Contract and Status Semantics
#23 Add Simplified Task Views
#24 Find and Switch Repositories
</titles>
<checks>
- Exactly one `### Friendly Title:` per issue, heading followed by the title on the next line, and the title text exactly matches the assigned entry above on the right issue (watch for off-by-one or cross-attributed titles).
- Shell-quoting damage: bodies were passed inline through a shell. Hunt for truncation at apostrophes, stray quote/backtick artifacts, dollar or backslash damage, and half-written final sections.
- Pre-existing structure still present per issue: Overview, Acceptance Criteria, Actionable Subtasks, Test Plan, Coordination, Repro or notes sections that existed before the edit remain in place and uncorrupted; markdown tables and code fences intact.
- Issue 23: the `### Human Tasks:` (3 items), `### Open Questions:` (1 item) and `## Human review feedback — 2026-10-08` sections appear exactly once each at the end, every checkbox unchecked, and the original Friendly Title / Overview / Acceptance Criteria are intact above them.
- Issue 22: the Friendly Title was an inline single-line heading before; confirm it was normalized to heading-plus-next-line with the same title text and nothing else changed.
- No issue outside the twelve listed was touched: fetch the recent issue list and confirm no unexpected titles or bodies stand out.
- Title extraction: run the real parseFriendlyTitle (panel/core.ts:85-115, via node in /workspace/extensions/github-task-board if reachable, otherwise replicate its regex and say it is a replica) against each body and confirm it yields the assigned title.
</checks>
<steps>
<step>Fetch all twelve bodies with gh issue view and reconstruct each against the checks above.</step>
<step>Record for each issue and check: PASS or FAIL with an evidence snippet. Where the pre-edit original is unknown, say so explicitly instead of assuming preservation.</step>
<step>Return verdict PROCEED or HALT with the exact required fixes. Findings are evidence, not reassurance.</step>
</steps>
<output>Verdict (PROCEED/HALT); findings table (issue, check, verdict, evidence); issues verified; NOT VERIFIED; no credentials.</output>
