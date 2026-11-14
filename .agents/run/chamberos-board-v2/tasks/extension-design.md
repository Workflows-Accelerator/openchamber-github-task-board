<env_preflight>
Repo: /workspace/code/openchamber-github-task-board
Worktree: /workspace/code/openchamber-github-task-board
Mode: READ-ONLY on source. Write ONLY under `.agents/run/chamberos-board-v2/verifications/extension-design/`.
Forbidden: never edit source, never read or print secrets, never push, never restart the board, never spawn subagents.
</env_preflight>

<goal>
Design — not implement — the exact content of three new surfaces so the owner can approve them before a line of code changes: the Work Status section, the sidebar marks, and the agent-facing instructions/skill. Be concrete enough that implementation is transcription.
</goal>

<checklist>
1. Load the `openchamber-extensions` skill (id: `openchamber-extensions`) and read its `statusSection`, `marks` and `instructions`/`skills` recipes.
2. Read `.agents/run/chamberos-board-v2/verifications/extension-audit/README.md` (the inventory) and `verifications/usability-audit-2026-11-13/README.md` (what the owner found scary: three different "needs me" counts, progress invisible, questions illegible).
3. **Design the section.** Propose at most 6 rows (limit is 16) for `GET /status`. For each row: `kind` (line/note), `id`, EN label, FR label, the exact value it shows, `dot` tone, and any `actions` (label EN/FR, variant). Cover: needs-me count, running agents, blocked, top item needing the owner (with its repo#number and title), and the data-age note when the snapshot is stale. Define the three states precisely: no snapshot yet (service just started), stale snapshot (older than N minutes), and live. Say exactly what the empty and stale states read in EN and FR — no invented numbers, no fake data.
4. **Design the marks.** Which target (`sessionId` vs `directory,branch`), which icon name (Remixicon subset), which tone, and the exact tooltip text EN/FR. Define the rules: when a mark is set, when it is cleared, and what happens when the same issue has both a running agent and a pending question. Keep to one mark per target, since a row draws at most two.
5. **Design the agent-facing text.** `instructions` is capped at 4,096 characters: write the exact text (short facts only — board URL, the gate rule, when to write a question). Then outline `skills/board/SKILL.md`: its `name`, the `description` that makes an agent pick it, and a section list. Reuse the shipped issue-body contract (`docs/issue-body-contract.md`), do not invent syntax.
6. **Copy rules.** Every string must exist in EN and FR, use no `!`, no emoji, no `n8n`, no `mobile`, and no internal vocabulary ("payload", "service", "statusSection") in user-facing text. Give both languages for every string you propose.
7. State what you deliberately did NOT propose and why (e.g. a row that would need a new GitHub call per poll).
8. Write `.agents/run/chamberos-board-v2/verifications/extension-design/README.md` and commit only that directory.
</checklist>

<output>
At most 14 lines: ROWS (count + one line each: id, EN label, value), STATES (empty/stale/live one line each), MARKS (rule + icon + tone), INSTRUCTIONS_CHARS, SKILL (name + description), NOT_PROPOSED (short), OPEN_QUESTIONS_FOR_OWNER, COMMIT, NOT_VERIFIED.
</output>
