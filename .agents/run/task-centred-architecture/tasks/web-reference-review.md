<env_preflight>
Repo: /workspace/extensions/chambervoice
Worktree: /workspace/extensions/chambervoice/.worktrees/team-dev-board-web-reference
Branch: docs/board-web-reference; base 7c6f816 with report-only commit 4b8b1fd, worker reports clean.
Files: .agents/run/board-web-reference/report.md and actual standalone-serving/auth source referenced there.
Verification: source inspection and disposable isolated probes in /tmp/opencode; no real login, host changes or remote effects.
Do not touch: product code, credentials/env files, production, opencode.db, proxy/DNS/certs, service activation, GitHub issues or branches. Potential security findings stay local/private; do not publish vulnerability details on public issues.
Preflight facts authoritative; no initial pwd/status/ls, targeted commit checks permitted.
</env_preflight>
<goal>Independently challenge the standalone-board reference report and produce a safe minimum implementation handoff for board.workflows.ac without copying a possibly unsafe authentication pattern.</goal>
<context_files>
[@/workspace/extensions/chambervoice/.worktrees/team-dev-board-web-reference/.agents/run/board-web-reference/report.md]
</context_files>
<skills>
[@/workspace/config/opencode/.agents/skills/review/adversarial/doubt-driven-development/SKILL.md]
[@/workspace/config/opencode/.agents/skills/security/security-and-hardening/SKILL.md]
[@/workspace/config/opencode/.agents/skills/communication/clarity/answer-first/SKILL.md]
</skills>
<scope>
Conduct a hostile review of any edits or changes that you made to figure out what you might have missed or what might be broken. Don't assume that what you did is right.
Report review only. Verify claims about reusable serving, host frame SDK dependencies, whether existing authenticated Web can offer a board-only route at the requested domain, and the standalone authorization gap. Re-check whether the reported swallowed-auth-failure mechanism really accepts bad credentials; isolate source/synthetic proof without interacting with production login. Treat as unconfirmed until reproduced; do not disclose public details or touch credential storage. Distinguish inability of a Node service to call host from alternatives that an authenticated first-party web frame already supports. Prior report must not force an unnecessary host fork if reverse-proxy/board-only authenticated surface suffices. Don't invent working proxy/DNS/TLS config: certificate probe is not evidence of who owns current route. Recommend minimal plan with no weakening auth, no token in browser storage/URLs. Include what to test before deployment, precisely required user-facing product choice and external authority, and what can be built now under existing scope. Do not decide editing/launch-agent public behavior. No application fixes.
</scope>
<criteria>
Two verdicts for factual grounding and plan safety; concrete source/probe evidence, no fake live proof; one implementation recommendation consistent with user request. Confirm or reject security concern privately; no safe-to-copy auth claim without proof.
</criteria>
<output>
Write and commit report only at .agents/run/board-web-reference/review.md in worktree. Return enough concise detail in completion for manager to act: verdict, recommendation, findings/severity, blockers, exact supported reuse, what not verified, supplied model/provider. Manager cannot directly read this cross-repo worktree report under current tool permissions, so completion must be self-contained and credential-free. No full logs.
</output>
