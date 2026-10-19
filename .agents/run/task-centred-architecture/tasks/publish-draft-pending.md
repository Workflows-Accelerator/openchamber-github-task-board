<env_preflight>
Repo: /workspace/extensions/github-task-board
Worktree: SET AFTER FINAL REVIEW
Branch/base commit: SET AFTER FINAL REVIEW
State: NOT READY FOR DISPATCH. Publication requires manager-confirmed final independent PASS / APPROVED and exact approved artifact path/digest. User authorized one deep draft issue, not implementation, child execution issues, branch pushes, PRs or merges.
Files: final reviewed issue body/title and review proof to be set.
Test command: exact issue-create response plus authenticated GET/readback of title, body, state and labels. No application tests for document publication.
Do not touch: code/config/skills/agents, credentials, schedules, existing issue bodies except a new draft creation receipt in owned report.
</env_preflight>
<goal>Publish exactly one reviewed architecture draft issue and prove its remote content matches the reviewed document without exposing authentication material.</goal>
<scope>
Own only .agents/run/task-centred-architecture/publication.md in assigned worktree. GitHub mutation allowance: create ONE open issue in Workflows-Accelerator/openchamber-github-task-board with manager-designated final title/body and existing status:draft label if present. Do not create labels, close issues, edit other issues, open PRs, push branches or change repository settings. If an equivalent issue was already created after a lost response, adopt it rather than duplicate it.
</scope>
<criteria>
- This is a deep architecture DRAFT for design alignment, not a completed feature. All future acceptance criteria remain unchecked; no checked human decisions, auto-start labels or execution links.
- Check near-exact title duplicates before create. On ambiguous network/create response stop and reconcile before retry; never blind repeated POST.
- gh is absent in manager checkout. Use only an actually available, permitted supported issue API/CLI integration and approved existing authentication. Do not install tools, dump config/env/token files, reveal authorization headers, copy tokens, invent credentials or bypass a permission rejection. If no safe path exists, return BLOCKED with exact user action needed; preserve final reviewed Markdown.
- Do not feed files into gh with --body-file or -F. If gh is available in this environment, allowed issue subcommands only; never gh issue develop. No raw authenticated remotes or shell debug tracing.
- Publish only reviewed final body, stripping any separate local title metadata as specified. Do not publish private paths, session internals, secrets, or unreviewed raw research. Source links must be usable by intended readers. Do not weaken or silently alter reviewed wording for size limits; return blocked if too large.
- Read back remote issue; compare exact title/body (apart from documented API newline normalization), expected open state and draft label. Record URL, number, remote ID, timestamps and sanitized equality results. API success alone is not exact content proof.
- If label unavailable, create open issue without it and record missing label rather than inventing another workflow status or creating labels. If repository publication permission missing, don't switch to an unrelated repository.
</criteria>
<output>
Commit only publication.md locally with URL/number/title, final artifact reference, create/readback evidence, duplicate check, content comparison and any limitations. Return <=10 lines: PUBLISHED or BLOCKED, URL, number, equality result, safe required action if blocked. No credential values. Publication does not authorize implementation or closure.
</output>
