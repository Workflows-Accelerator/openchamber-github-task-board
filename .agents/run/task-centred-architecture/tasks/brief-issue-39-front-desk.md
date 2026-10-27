<env_preflight>
Repo: /workspace/config/opencode
Worktree: /workspace/config/opencode/.worktrees/team-dev-issue-39-front-desk
Branch: feat/issue-39-front-desk
Goal: Implement Front Desk Agent definition and specialized issue management skill per Issue #39.
Commands: npm test ; npm run typecheck (if present) ; JSON syntax validation.
Guardrails: Never log or print secrets; follow doubt-driven development and zero-emoji policy.
</env_preflight>

<goal>
Configure the Front Desk agent (a lightweight, user-facing agent in opencode.json) and author its core issue management skill so that the user interacts with a fast front-desk intake agent that keeps the GitHub task board up to date, answers questions, opens tasks, and guides the user without writing application code or blocking on worker sessions.
</goal>

<context_files>
[@/workspace/config/opencode/opencode.json]
[@/workspace/config/opencode/.agents/skills/meta/orchestration/issue-lifecycle/SKILL.md]
[@/workspace/extensions/github-task-board/docs/issue-body-contract.md]
</context_files>

<scope>
1. Inspect `opencode.json` to understand existing agent configurations (e.g. `team`, `build`, etc.):
   - Examine model tiers, prompts, tool configurations, and capabilities.
2. Define the `frontdesk` (or `front-desk`) agent:
   - Model tier: lightweight, responsive (e.g., `intern` or `worker` tier, fast response).
   - Persona: Courteous, focused, structured front desk intake manager.
   - Core purpose: User-facing triage, answering questions, updating the task board, drafting clear issues per Issue Body Contract v1, attaching sessions, and opening files.
   - Boundaries: Does NOT write application code or make direct code edits; dispatches or organizes tasks on the board.
3. Author a dedicated skill for the Front Desk agent:
   - Place in `.agents/skills/meta/orchestration/front-desk/SKILL.md` (or appropriate directory).
   - Teach exact protocol for:
     a) Quick-add task drafting with self-categorization and friendly titles (3-6 words, plain English).
     b) Collecting and answering open questions directly on the issue markdown.
     c) Updating issue priorities and status transitions.
     d) Triggering session launches from tasks on the board.
     e) Strict adherence to the Zero-Emoji Policy and Issue Body Contract v1.
4. Validate `opencode.json` syntax and schema integrity. Ensure all tests in the config repo pass.
5. Perform an adversarial hostile review (L4):
   - What happens if the user asks Front Desk to fix code directly? (Must refuse application coding and offer to file/queue a task on the board).
   - Are prompt instructions unambiguous and compact?
   - Does it prevent hallucinating non-existent tools?
6. Commit changes locally with clean conventional commits.
</scope>

<criteria>
Front Desk agent is cleanly declared in opencode.json; front-desk skill is complete and adheres to Issue Body Contract v1; JSON is valid; hostile review passes with zero defects.
</criteria>

<output>
At most 10 lines:
Summary of agent configuration; skill file created; validation results; hostile review findings; commit hash.
</output>
