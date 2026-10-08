<goal>Determine whether OpenChamber's existing GitHub authentication can support GitHub conditional requests (ETag/304 caching) for the task board, and report credential type and presence plus safe reuse options without exposing any secret value.</goal>
<context_files>
[@/workspace/extensions/github-task-board/.agents/run/board-lifecycle/feedback-2026-10-08.md]
[@/workspace/extensions/github-task-board/.agents/run/board-lifecycle/specs/rate-limit-manager-review.md]
[@/workspace/extensions/github-task-board/.agents/run/board-lifecycle/verifications/v2-compat-audit.md]
</context_files>
<skills>
[@/workspace/config/opencode/.agents/skills/verify/investigation/investigate-first/SKILL.md]
[@/workspace/config/opencode/.agents/skills/communication/clarity/answer-first/SKILL.md]
</skills>
<scope>
Strictly read-only across /workspace/extensions/github-task-board, /workspace/extensions/chambervoice, the installed OpenChamber and OpenCode SDK modules, and /workspace/.openchamber-data. SECRET WALL: never open the contents of /workspace/.git-credentials, token files, cookies, or any authorization value; never print, log or write any credential value or prefix into any file or output; presence checks (file exists, config key exists) and category-level type inference from key names and documentation only. MUST NOT edit any file except your report at /workspace/extensions/github-task-board/.agents/run/board-lifecycle/verifications/auth-credential-audit-2026-10-08.md. No live host/DB/guest-storage mutation, no service restart, no GitHub write request, no auth configuration change.
</scope>
<criteria>
- Answers with file:line or config-key anchors: (1) how the board authenticates to GitHub today and exactly where Authorization or custom headers are dropped on the host or SDK path; (2) whether ETag / If-None-Match can reach api.github.com today and under which credential category; (3) which GitHub credential categories exist on this host (classic PAT, fine-grained PAT, OAuth app token, git-credential file) proven by key names or file presence only, never values; (4) whether the OpenChamber GitHub login can be reused for the board's conditional reads without new user setup, including the security trade-off; (5) ranked options with trade-offs (reuse host auth, user PAT in board settings with documentation, host change to forward headers, accept plain GETs), recommending one and leaving the decision to the human.
- Explicit NOT VERIFIED section. No secret values or prefixes anywhere.
</criteria>
<steps>
<step>Trace the board's GitHub request path (panel/main.ts, panel/core.ts, apiOrigin configuration) and locate where Authorization or custom headers are set and where the host proxy or SDK GuestRequest drops them, matching the recorded trade-off in specs/rate-limit-manager-review.md.</step>
<step>Inspect the installed OpenChamber and OpenCode host/SDK modules read-only for GitHub credential sources (managed configuration keys, auth providers, host-provided tokens) and classify by key or field names only.</step>
<step>Check presence only for /workspace/.git-credentials and any documented GitHub auth files (for example test -f and directory listings of file names). Never open secret files.</step>
<step>Determine from the request-path evidence which credential categories can send conditional headers today and which require a host change.</step>
<step>Write the full report to /workspace/extensions/github-task-board/.agents/run/board-lifecycle/verifications/auth-credential-audit-2026-10-08.md and return a summary with the ranked options.</step>
</steps>
<output>STATUS; ANSWERS 1-5 with anchors; OPTIONS table (option, setup cost, quota effect, security trade-off, recommendation); EVIDENCE anchors; NOT VERIFIED; BLOCKERS. No credential values, prefixes or file contents.</output>
