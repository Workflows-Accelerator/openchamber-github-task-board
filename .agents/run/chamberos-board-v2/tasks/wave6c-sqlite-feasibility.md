<env_preflight>
Repo: /workspace/code/openchamber-github-task-board
Worktree: /workspace/code/openchamber-github-task-board/.worktrees/team-dev-board-v3
Branch: feat/board-v3
HEAD: d74779b.
READ-ONLY TASK. You may read any file in the worktree. You must NOT edit, commit, stage or run git at all — another worker is fixing the live service in this same worktree and any git command of yours would collide. Write your output to /tmp/opencode/board-sqlite-design/report.md.
Forbidden: source edits, git, push, deploy, GitHub writes, /workspace/code/openchamber-config, /workspace/.openchamber-data (never read board.env, tokens or cookies), credential output, delegation.
</env_preflight>

<goal>
Answer the owner's question with evidence and judgement: would moving the board's GitHub reads into a local SQLite mirror really stop the API pressure, and is it worth building now? The owner asked, verbatim: "How hard is it to remap everything so that we have an SQLite database so that we avoid spamming GitHub API? Is it hard? Is it smart? Is it something we should do?"
</goal>

<context>
Read first, and do not trust this summary:
- `web/server/repositories.ts` — token discovery, 60 s freshness, ETag cached for single-page lists only.
- `web/server/app.ts` — discovery and board payload caches, weak ETag on responses, `boardCacheTtlMs`, aggregate fan-out with concurrency 3–6, `rateLimitRef`, `github_rate_limited` → 503, `discovery_unavailable` → 503.
- `web/server/github.ts` — how each call is made, pagination, ETag use, error kinds, rate-limit parsing.
- `web/server/board.ts` and the write routes — which writes exist and how the client learns the result.
- Any existing persistence in the service (check for a state directory, JSON files, or nothing at all).
</context>

<questions_to_answer>
1. Where does the API pressure actually come from today? Count the calls per user action: initial load, refresh, a repository switch, opening a task, posting a note, changing a status. Read the code and give numbers, not impressions.
2. What is already cached, with what TTL, and what is not cached at all? Name the gaps.
3. If we add a SQLite mirror: what exactly gets mirrored (issues, labels, bodies, comments, PRs, repository list), what is the sync trigger (webhook, polling, on-demand), and what is the staleness the user would see? Be concrete about the worst case.
4. What breaks or gets more dangerous: writes that must not be served stale, per-session permissions (is the token per user or shared?), multi-repository aggregation, the "append-only comment" rule, the 232-issue scale, and a second source of truth that can disagree with GitHub.
5. Effort: a realistic range in focused working days for (a) conditional requests and a better cache only, (b) a full SQLite mirror with a background sync. Justify each range by naming the files and the tests that would have to change.
6. Recommendation with a trigger condition: what should be done now, what should be deferred until a measurable threshold (name the threshold: rate-limit remaining, load time, issue count).
</questions_to_answer>

<output_shape>
Write /tmp/opencode/board-sqlite-design/report.md: a short answer first, then the call-count table, then the two options with effort and risk, then the recommendation and its trigger. Return at most 14 lines: VERDICT (hard? smart? now?), CALLS_PER_ACTION (the numbers), CACHED_TODAY, GAPS, OPTION_A (effort, risk), OPTION_B (effort, risk), RECOMMENDATION, TRIGGER, WHAT_WOULD_BREAK, NOT_VERIFIED.
</output_shape>
