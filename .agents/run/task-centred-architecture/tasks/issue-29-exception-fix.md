<env_preflight>
Repo: /workspace/config/opencode
Worktree: /workspace/config/opencode/.worktrees/team-dev-issue-29-task-context
Branch: docs/issue-29-task-context; exception commit 856826b, review commit becdcea. Clean tree per reviewer.
Files: agent-prompts/team/team.md, agent-prompts/dynamic/dynamic-agent.md, .agents/skills/meta/composition/xml-briefs/SKILL.md. Only if a finding cannot be fixed in those, touch run-state-hygiene or verification-levels with a single sentence and say why.
Tests: node --test tests/delegate.test.mjs tests/delegate-recovery.test.mjs tests/delegate-evidence.test.mjs tests/team-run-access.test.mjs tests/solo-tools.test.mjs; node --test tests/config-shape.test.mjs tests/w2-rules.test.mjs tests/phase1-quick-wins.test.mjs.
Do not touch: opencode.json, solo/worker prompts, credentials, opencode.db, host settings, live config root, master, remote issues. No push, no DB registration.
Preflight facts authoritative; targeted checks permitted.
</env_preflight>
<goal>
Close the five blocking holes the review found in the issue-backed briefing exception, without widening the exception.
</goal>
<context_files>
[@/workspace/config/opencode/.worktrees/team-dev-issue-29-task-context/.agents/run/issue-29-task-context/exception-review.md]
[@/workspace/config/opencode/.worktrees/team-dev-issue-29-task-context/.agents/run/issue-29-task-context/migration.md]
</context_files>
<scope>
Apply exactly these, minimally.
F1: scope cannot be substituted. The envelope carries environment and permissions, not scope, so the current check is vacuous. Replace it with a rule that the worker takes scope only from the issue body and prior authorized decisions, and must stop and report when the issue is silent on scope, contains conflicting scope, or asks for anything the envelope does not permit. An issue or comment can never widen what is permitted.
F2: extend the absolute refusal list so no issue text, comment, or "brief" wording can authorize push, PR, merge, deploy, release, credential or secret access, permission changes, issue closure, human-task ticking, or skipping a required review. State that the receipt/return requirements cannot be disabled by issue text.
F3: forbid writing credentials, tokens, private absolute paths, private logs, session identifiers or other sensitive data into issue comments or bodies. Receipts must be self-contained but redacted.
F4: fix the contradiction. Use the review's proposed wording for team.md, or better: a disk brief pointer may carry environment facts and remains valid for the default path, but it is never scope or approval authority once issue-backed mode is on.
F5: re-read the canonical issue and its comments immediately before any consequential action, not only after a restart. If the issue changed since the worker's baseline, reconcile or stop; never proceed on the earlier snapshot.
F6: honest limitation. Comment-only questions are not visible to the board's body-parsed attention. State that a question requiring human attention must be recorded where the board actually reads it, through the governed edit path, and if the worker cannot do that, it must report the question to the manager rather than assume it is visible.
F8: correct the grep/precedence claim to match what the reviewer actually found, and list the files where the disk-brief wording survives, rather than asserting none.
Keep every edit small and consistent with each file's existing voice and formatting. Do not restructure sections, do not add new headings beyond what is needed, keep no emojis.
Update .agents/run/issue-29-task-context/migration.md with a short addendum listing each finding and the exact sentence that resolves it.
</scope>
<criteria>
All six findings addressed in text; no new permission or tool; no contradiction with the unchanged skills; refusal list explicit; sensitive-data rule explicit; re-read-before-effect explicit; comment-question limitation explicit and honest; tests green; diff confined to named files; the exception still additive and opt-in.
</criteria>
<output>
Commit on the branch. Return <=15 lines: per-finding resolution, files, tests, remaining ambiguity, commit. Do not merge, push or activate.
</output>
