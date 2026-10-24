<env_preflight>
Repo: /workspace/extensions/github-task-board
Worktree: /workspace/extensions/github-task-board/.worktrees/team-dev-issue-33-standalone-board
Branch: feat/issue-33-standalone-board at d8467a4. Check `git status` once; preserve any uncommitted work you find and report it.
Owned: web/**, service/** board server code, their tests, README board section, .agents/run/task-centred-architecture/ report/proof in this worktree.
Tests: the board test suite and npm test; tsc; build. node_modules symlinked from root.
Do not touch: panel/** (another worker is on it), shared config/skills, credentials, opencode.db, host settings, DNS/TLS, production, master, other worktrees. No push, merge, close, deployment or live credentials. Synthetic GitHub fakes only.
</env_preflight>
<goal>
Bring the standalone board in line with the owner's 2026-10-24 decisions and make every safety claim in code, page and README true.
</goal>
<context_files>
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/decisions-2026-10-24.md]
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/tasks/issue-33-remediation-amendment.md]
[@/workspace/extensions/github-task-board/.worktrees/team-dev-issue-33-standalone-board/.agents/run/task-centred-architecture/outputs/issue-33-hostile-review.md]
[@/workspace/extensions/github-task-board/.worktrees/team-dev-issue-33-standalone-board/.agents/run/task-centred-architecture/outputs/issue-33-remediation.md]
https://github.com/Workflows-Accelerator/openchamber-github-task-board/issues/33 (see owner-decision comment 6382593765)
</context_files>
<skills>
[@/workspace/config/opencode/.agents/skills/review/adversarial/doubt-driven-development/SKILL.md]
[@/workspace/config/opencode/.agents/skills/build/refactoring/surgical-patch/SKILL.md]
[@/workspace/config/opencode/.agents/skills/build/methodology/test-driven-development/SKILL.md]
</skills>
<scope>
Owner decisions (binding):
A. Sign-in: keep the separate board password plus server-held GitHub token. Do not check GitHub identity, do not add OAuth. Remove/adjust any test or doc that still asserts "a second GitHub account is refused".
B. Best-effort editing: keep a pre-save conflict check (fresh GET compared to the version the user saw) and refuse when it differs. Remove any automatic retry, re-apply or repeat of a write. Remove every "atomic", "fail-closed", "guaranteed" or equivalent claim from code comments, page text, README and report. Add a clear, short warning on the page near editing controls and in README: a simultaneous edit on GitHub or by an agent can still be overwritten. If a write's outcome is ambiguous (timeout, network error after send, readback mismatch), show "outcome unknown — check the issue on GitHub" and never repeat it automatically.
C. F2: implement bounded early rate limiting exactly as in the earlier amendment (cooldown at most 60s, no accumulating or permanent lockout, bounded memory, existing authenticated sessions unaffected, no new forwarded-header trust). README states plainly that owner sign-in from the same address can be briefly rate limited. No claim that a correct password bypasses the limit.
D. Re-verify that F4–F9 claims in the remediation report are actually true in code at HEAD; mark any not true as OPEN.
Tests first for B (no retry after ambiguous outcome; conflict refused; warning present in page and README) and C (bounded cooldown, bounded memory, authenticated session works during cooldown).
F1 status: report as "MITIGATED (best-effort, owner-accepted)", with the exact remaining interleaving written plainly. Never CLOSED.
</scope>
<criteria>
No retry path on writes; no atomic/fail-closed wording anywhere (grep proof); warning visible in page and README; F2 tests green; full suite, tsc, build green; browser check of sign-in, edit, conflict refusal and warning still passes.
</criteria>
<output>
Commit on feat/issue-33-standalone-board. Update the remediation report (cite this brief). Return at most 15 lines: commit, per-finding status F1–F10, grep proof for removed claims, test counts, bundle sha256, what you did not verify, actual model. A fresh hostile review follows.
</output>
