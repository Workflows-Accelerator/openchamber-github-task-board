<goal>Add contract-compliant Friendly Titles to the twelve open issues of Workflows-Accelerator/openchamber-github-task-board and apply the exact approved Human Tasks and Open Questions update to issue 23, preserving all other body content.</goal>
<context_files>
[@/workspace/extensions/github-task-board/.agents/run/board-lifecycle/issue-23-update-2026-10-08.md]
[@/workspace/extensions/github-task-board/.agents/run/board-lifecycle/feedback-2026-10-08.md]
</context_files>
<skills>
[@/workspace/config/opencode/.agents/skills/communication/clarity/answer-first/SKILL.md]
</skills>
<scope>
GitHub issue bodies ONLY in Workflows-Accelerator/openchamber-github-task-board via the gh CLI. MUST NOT edit repository files, issue titles, state, labels, assignees or milestones; MUST NOT close or reopen anything; MUST NOT use --body-file or -F (pass every body as an inline argument); no push or PR; never print token or credential values. Every body edit is a full-body replacement, so reconstruct the existing body faithfully and change only what this brief specifies.</scope>
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
<criteria>
- Each listed open issue ends up with exactly one `### Friendly Title:` heading followed on the next line by its assigned title from the titles block (the heading-plus-next-line shape that issue 23 already uses); every other body line preserved byte-for-byte.
- Issue 22's existing inline `### Friendly Title: ...` is normalized to the heading-plus-next-line shape, keeping its same title text.
- Issue 23 additionally receives exactly the sections from issue-23-update-2026-10-08.md appended once: `### Human Tasks:` with three unchecked boxes, `### Open Questions:` with one unchecked box, and the `## Human review feedback` section. No checkbox is marked done anywhere.
- If inspection of parseFriendlyTitle in /workspace/extensions/github-task-board/panel/core.ts shows a different accepted shape than heading-plus-next-line, use the accepted shape and report the divergence.
- Verification: re-fetch all twelve issues and confirm exactly one Friendly Title per issue, correct title text, and intact remaining content.
</criteria>
<steps>
<step>Read parseFriendlyTitle in /workspace/extensions/github-task-board/panel/core.ts read-only and confirm the exact accepted heading format.</step>
<step>For each issue in the titles block: gh issue view <n> --json body, compose the new body with the Friendly Title inserted directly before the Overview or first major section (normalizing issue 22 in place), and submit with gh issue edit <n> --body '<inline body>'.</step>
<step>For issue 23 append exactly the sections defined in issue-23-update-2026-10-08.md once, after the existing content.</step>
<step>Re-fetch all twelve issues and verify Friendly Title presence, title text and content preservation; report a table of issue, friendly title and what changed.</step>
</steps>
<output>STATUS; table issue -> friendly title -> what changed; VERIFICATION evidence from the re-fetch; NOT VERIFIED; BLOCKERS. No credentials.</output>
