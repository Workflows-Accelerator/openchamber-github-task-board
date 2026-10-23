<env_preflight>
Repo: /workspace/extensions/github-task-board
Worktree: /workspace/extensions/github-task-board/.worktrees/team-dev-issue-30-31-design
Branch: docs/issue-30-31-design; base c436dbf; newly created clean tracked worktree. Root checkout and other worktrees belong to other tasks; leave them alone.
Files owned: .agents/run/issue-30-31-design/ only. Product source is read-only reference.
Tests: none required; read-only inspection and existing test reads only.
Do not touch: product files, panel/**, service/**, web/**, test/**, shared agents/skills/config, credentials, opencode.db, host settings, remote issues (no comments, labels or body edits), branches, production, master. No DB registration, no push.
Preflight facts authoritative; targeted inspection permitted for code references and before commit.
</env_preflight>
<goal>
Turn the user's two rough ideas into one coherent, minimal, implementable design: a feature path versus a bug path, and a complete question/notification loop, both compatible with the existing board and issue format.
</goal>
<context_files>
https://github.com/Workflows-Accelerator/openchamber-github-task-board/issues/30
https://github.com/Workflows-Accelerator/openchamber-github-task-board/issues/31
https://github.com/Workflows-Accelerator/openchamber-github-task-board/issues/26
[@/workspace/extensions/github-task-board/docs/issue-body-contract.md]
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/outputs/verify-user-workflow.md]
</context_files>
<scope>
Read the current issue contract, board parsing, attention views, label reconciliation, session activity model and notification capability available in this installed host. Cite exact files and functions for every claim about what exists; mark what is only proposed.
Feature versus bug: define the smallest classification that changes behavior, not a new state machine. A feature earns exploration, batched alignment questions, and research; a bug earns reproduction, cause evidence, a narrow regression-tested patch and hostile review. Show how a misclassified or ambiguous item routes to a human question instead of guessing. Cover small changes that deserve no ceremony. Resolve what "expiration" could plausibly mean and explicitly leave it undecided rather than inventing destructive behavior.
Questions: specify how a question is written so it is self-contained and machine-extractable from the existing body, how an agent asks one without editing unrelated content, how the board shows it, how it is answered durably, and how a stale, superseded or already-answered question is rejected. Keep attention orthogonal to workflow phase. State exactly which parts the current parser already supports and which need a contract change.
Notifications: compare only channels that genuinely exist here (in-page attention views, host/app notifications, and anything else verified in source) against their real limits. Recommend the smallest complete loop: one actionable notification, deduplicated, no private content leak, recoverable after missed delivery. If the honest answer is that no reliable delivery channel exists yet, say so and propose the minimal honest fallback.
Bug path specifics: reproduction evidence, minimal patch discipline, when a "bug" actually needs alignment because it changes desired behavior, and a bounded repair loop with escalation.
Include a worked example for each path on a real recent defect and a real recent feature, using this repository's own history. Include a table of what changes in the issue body contract, parser, board UI, agent instructions and tests, each marked existing / small change / new, with effort honestly stated. Identify the two or three decisions that genuinely need the user, phrased in product terms, with a recommendation for each. Do not propose a new daemon, new labels beyond the existing status set unless a change is unavoidable and justified, or a rewrite of the orchestration skills.
</scope>
<criteria>
Every "exists" claim has a file/function anchor; every proposal is marked proposed; no destructive retention semantics invented; no new daemon; no new dependencies; attention stays orthogonal to phase; human-only closure preserved; two or three real user decisions maximum, each with a recommendation. One integrated document, not two unrelated essays.
</criteria>
<output>
Commit .agents/run/issue-30-31-design/proposal.md (single integrated document). Return <=15 lines: the core recommendation, the user decisions, what already exists versus new, and the commit. Do not edit issues. Independent review follows.
</output>
