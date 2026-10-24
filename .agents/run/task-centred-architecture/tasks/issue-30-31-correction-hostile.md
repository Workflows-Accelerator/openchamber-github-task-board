<env_preflight>
Repo: /workspace/extensions/github-task-board
Worktree: /workspace/extensions/github-task-board/.worktrees/team-dev-issue-30-31-design
Branch: docs/issue-30-31-design. Base review 6c5620c, corrected proposal eb9d86c. No active worker owns this worktree. Last observed clean after correction commit; do not run initial startup status/pwd/ls. Targeted checks allowed for stale resume, action failure or pre-commit verification.
Owned: only .agents/run/issue-30-31-design/correction-hostile.md. Everything else read-only, including proposal. Tests: deterministic probes of proposed matching/generation behavior using throwaway files under /tmp/opencode, if needed; no application suite required for this documentation review. No GitHub mutations, real credentials, config/skills edits, production changes, push, merge or closure.
</env_preflight>
<goal>
Give an independent, bounded verdict on whether the corrected #30/#31 design can safely guide the owner's now-aligned choices.
</goal>
<context_files>
[@/workspace/extensions/github-task-board/.worktrees/team-dev-issue-30-31-design/.agents/run/issue-30-31-design/proposal.md]
[@/workspace/extensions/github-task-board/.worktrees/team-dev-issue-30-31-design/.agents/run/issue-30-31-design/revised-review.md]
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/decisions-2026-10-24.md]
</context_files>
<skills>
[@/workspace/config/opencode/.agents/skills/review/adversarial/doubt-driven-development/SKILL.md]
</skills>
<scope>
Conduct a hostile review of any edits or changes that you made to figure out what you might have missed or what might be broken. Don't assume that what you did is right.
You are the independent reviewer, not the author. Review only the eb9d86c corrections against 6c5620c findings; no design expansion or code edits. Validate exact source question text preserves case, punctuation AND Markdown link destinations (display text equality cannot authorize). Reject duplicates/ambiguity. Check whether a body-stored generation counter actually detects manual lowering across fresh sessions or deleted metadata; if it cannot, call the detection claim false, do not invent durable server state. Check for contradictions on HTTP rejection versus ambiguous transport error/readback UNKNOWN (proposal steps 5/6).
Owner choices SUPERSEDE the proposal's formerly open questions: D1 labels bug/enhancement + Work Log; D3 refuse stale and show new text; D2 standalone PWA push using 60s conditional polling, NOT OpenChamber notifications. Mark obsolete options historical, not blockers requiring the same owner answer again. No forcing needs-human phase, no atomic GitHub claim, service runtime remains unverified. #34 answer bugfix is running separately and does not yet implement question hashes/counters.
No fixes, no repeated pass. If blocking flaws remain, return findings and minimum correction needed; manager will adjudicate rather than loop blindly.
</scope>
<criteria>
Two verdicts Spec Compliance PASS/PARTIAL/FAIL and Quality APPROVED/NEEDS-FIXES with exact source lines and reproducible counterexample for any blocker. Distinguish an actual approval-integrity defect from obsolete recommendation text. Never call runtime verified based only on prose.
</criteria>
<output>
Write/commit the review report only in this worktree. Return at most 12 lines: verdicts, ranked findings, evidence, correction commit inspected, actual provider/model or UNVERIFIED. No issue closure.
</output>
