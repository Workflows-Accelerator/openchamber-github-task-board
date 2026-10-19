<env_preflight>
Repo: /workspace/extensions/github-task-board
Worktree: /workspace/extensions/github-task-board/.worktrees/team-research-task-centred-proposal
Branch: docs/task-centred-proposal
Base commit: SET AFTER FINAL VERIFICATION (final fix commit; worktree clean)
State: NOT READY until the fresh final verifier returns READY and the manager gate passes. This publisher did not author, fix or review the draft. The user authorized exactly one deep draft issue; implementation, child execution issues, branch pushes, PRs, merges, schedules, agent/skill/config changes and closure are not authorized.
Files: issue-draft.md (final reviewed body; strip the separate `Title:` metadata line) and the final title from the manager/fixer; final verifier proof at `verifications/final.md`.
Test command: authenticated create response plus a fresh GET/readback of title, body, state and labels. No application tests for document publication.
Do not touch: code/config/skills/agents, credentials, schedules, existing issue bodies, labels, repository settings, other worktrees. Own only `publication.md`.
</env_preflight>
<goal>Publish exactly one reviewed architecture draft issue to the public target repository and prove that its remote title, body, open state and draft label match the reviewed artifact, without exposing authentication material or creating any duplicate.</goal>
<scope>
- Create exactly one open issue in `Workflows-Accelerator/openchamber-github-task-board` with the manager-designated final title and the reviewed body. Add the existing `status:draft` label only. Do not create labels or add other workflow statuses.
- Do not create child issues, comments, PRs, branches, pushes, releases, schedules, repository settings or issue closures. Do not edit any existing issue.
- Strip the local `Title:` metadata line; the published body must start at `### Friendly Title:` and be otherwise byte-equivalent to the reviewed body apart from documented GitHub newline normalization. Do not publish local run-state paths, session IDs, credentials or unreviewed research.
- Before create, query the target repository for an exact or near-exact duplicate title. If the create response is lost or ambiguous, reconcile with a search and adopt the matching issue rather than blindly retrying. Never send repeated POSTs without a duplicate check.
- `gh` is absent in the manager checkout. Use only an already available, supported, authenticated issue API/CLI route. Do not install tools, dump environment or git config, reveal authorization headers, copy tokens, invent credentials or bypass a permission denial. If no safe path exists, stop BLOCKED and preserve the reviewed body.
- If `gh` is available in the assigned environment, allowed issue subcommands only; never `gh issue develop`. Do not feed files into `gh` with `--body-file` or `-F`; do not use `gh api` if it would expose the token.
- The target repository is public. Confirm no private path, session identifier, credential, customer name or private context appears in the published body. Source links must be stable public URLs or repository-relative paths; local-only commit hashes must not be presented as public evidence.
- Read back the created issue with a fresh authenticated GET. Compare exact title, normalized body, open state and expected label. API success alone is not content proof.
</scope>
<criteria>
- Exactly one issue is created and it is open; no child execution issues, comments, PRs, branch pushes, closures or label creation.
- The remote body starts at `### Friendly Title:` and matches the reviewed artifact; title matches exactly; `status:draft` is the only label if it exists; if unavailable, publish without inventing a status and record it.
- No credential, token, authorization header, private absolute path, session ID or run-state path is printed, committed or included in the issue.
- Duplicate check and lost-response reconciliation are evidenced, not asserted. No blind retry.
- Readback equality and limitations are recorded in `publication.md` with URL, number, timestamps and sanitized results.
- Publication does not authorize implementation, deployment, merge, closure, schedules, child issues, or any agent/skill/config change.
</criteria>
<steps>
1. Confirm the final verification commit and manager gate; read the exact final title/body. Do not publish if either is missing or the body starts with `Title:`.
2. Check auth availability without printing secrets; check duplicate titles. If no safe auth path, stop BLOCKED.
3. Create the one issue with the reviewed body and `status:draft` if present.
4. If the response is ambiguous, search and adopt an equivalent issue; never blind retry.
5. Read back title/body/state/labels; compare and record.
6. Commit only `publication.md` with the receipt. Return PUBLISHED or BLOCKED.
</steps>
<output>
Commit only `.agents/run/task-centred-architecture/publication.md` locally. Return <=10 lines: PUBLISHED or BLOCKED, URL, issue number, title/body/state/label equality summary, safe required action if blocked. No credential values and no implementation authority.
</output>
