<env_preflight>
Repo: /workspace/extensions/github-task-board
Location: root checkout (READ ONLY source), branch feat/v2-binding-and-ratelimit. Manager state is on this branch; never switch, merge, restore or mutate root source.
Published master: ab7516c4a3634c3d69f7b82936ddb7655d327ebb. Source worktrees #47/#48 were merged. Branches must persist, local feature checkouts must not.
Cleanup ses_c7d8c17bd19b53b47656c376 completed actual 9router/engineer. CLAIMS: 300 artifacts root preserved-batch-simplify/** with checksums.sha256/INDEX.md, root commit590f0d2 on feat/v2-binding-and-ratelimit; staging at76fd5e1 clean, preserved3 source paths removed normally and 3 worktree DB rows deregistered; no runtime mutations. Verify independently. Staging itself still exists, no worker running there. Root untracked .agents/idle-nontext-state.json unrelated, leave untouched. No initial discovery spin; use targeted checks described below.
Relevant files: .agents/run/task-centred-architecture/outputs/batch-simplify-cleanup-receipt.md, preserved-batch-simplify/**, outputs/batch-simplify-live-audit-gate.md. All product files read-only.
Tests: checksum verification using archived manifests and targeted git ancestry/worktree inspection only. No rebuild, browser run, production HTTP mutation or GitHub mutations needed.
Secrets wall: never read /workspace/.openchamber-data/**, .env*, private auth/session data, process environments or token-bearing remote URLs. No remote -v. No force removal, git clean, reset/rebase, remote deletion or host restart. Read only nonsecret OpenCode DB directory registration as needed, adapt DB path to ~/.local/share/opencode/opencode.db.
Preflight authoritative at startup: skip initial pwd/ls/status discovery spin. Targeted checks allowed for cleanup mutation safety, commit verification/failure/resume.
</env_preflight>
<goal>
Independently verify complete evidence preservation and safe #47/#48 cleanup, then remove the now-idle staging checkout only if every unique artifact is retained.
</goal>
<context_files>
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/outputs/batch-simplify-cleanup-receipt.md]
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/outputs/batch-simplify-live-audit-gate.md]
</context_files>
<skills>
[@/workspace/config/opencode/.agents/skills/ship/worktree/management/SKILL.md]
[@/workspace/config/opencode/.agents/skills/review/adversarial/doubt-driven-development/SKILL.md]
[@/workspace/config/opencode/.agents/skills/communication/terse/caveman-lite/SKILL.md]
</skills>
<review_prompt>
Conduct a hostile review of any edits or changes that you made to figure out what you might have missed or what might be broken. Don't assume that what you did is right.
You are independent of the cleanup worker. Treat its report as claims. Challenge archive completeness including harnesses, raw logs, screenshots, new audit evidence and original histories, not merely summary proof files. Do not write application code or change user scope.
</review_prompt>
<scope>
1. Verify every manifest entry of the archived evidence and retained commits. Compare staging originals to archived counterparts before removal; make sure integration, release, audit, screenshots and preview harnesses are retained. Count/identify missing unique material. Do not echo sensitive content. If a new archive gap can be filled without any product/secret access, preserve exact missing nonsecret evidence under root preserved-batch-simplify/staging and update manifest/index. Otherwise HALT teardown and report.
2. Verify only approved merged source worktrees were removed, branches retained, unrelated worktrees/branch tips not modified, and DB deregistration scoped to removed paths. Verify source and staging product ancestors of published master. A run-state-only evidence commit ahead of master is acceptable ONLY if its entire unique content/history is preserved on retained local branch and archive.
3. Staging is now idle after all previous workers finished. Once full archive parity and no uncommitted product edits established, commit only unique sanitized staging evidence if needed (on feature branch, NEVER master). Then use normal git worktree remove for staging, git worktree prune and narrowly scoped DB deregistration. Do not force removal or delete branches. Never delete content manually to bypass normal worktree refusal; report blocker.
4. Root activation diagnosis read-only: independently verify proposed branch switch and reload instructions are grounded, root/master divergence and untracked risks understood. Specifically challenge cleanup receipt's proposed Developer: Reload Window: this is OpenChamber, not necessarily VSCode, so locate actual supported extension reload mechanism in host source or docs; do not recommend an invented command. Inspect only targeted source/nonsecret metadata, never private config/data. Determine whether a supported reload RPC/UI exists, or full host restart is needed, and what active sessions it could interrupt. If unsupported/unclear say NOT VERIFIED and do not invent a safe action. Do NOT switch root, overwrite source or mutate shared host/config. Do not infer extension activation from published source. No live session polling; targeted static host source only.
5. Write only .agents/run/task-centred-architecture/outputs/batch-simplify-cleanup-hostile.md and any narrowly scoped evidence archive additions. Local checkpoint commit of these exact paths allowed; no broad git add, root switch or push. Manager owns mission/tasks/decisions, don't edit those.
</scope>
<criteria>
Spec PASS/FAIL and Quality APPROVED/NEEDS-FIXES for evidence+cleanup claims. Staging teardown only after byte-complete unique preservation, normal removal and scoped DB changes. No source/runtime mutation; extension remains NOT ACTIVE/NOT VERIFIED pending alignment. If incomplete, report exactly what remains, not success.
</criteria>
<output>
Return <=12 lines: independent two verdicts; manifest counts/exits and completeness; retained evidence commit and archive paths; exact worktrees removed/remaining; branch/DB outcomes; root activation safety verdict (no mutation); blockers; actual provider/model. Full evidence and commands/exits in outputs/batch-simplify-cleanup-hostile.md.
</output>
