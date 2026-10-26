<env_preflight>
Repository /workspace/extensions/github-task-board. Worktree /workspace/extensions/github-task-board/.worktrees/team-dev-issue-30-31-design branch docs/issue-30-31-design HEAD37242dd tracked clean. This is read-only exploration and a compact implementation plan, not app code. Do not merge/checkout/update this older design tree; inspect accepted board via git show095768f:path or read-only root code. No root write, no app/config/skill edit, no credentials/network/push/issue update/deployment.
Current accepted board immutable095768fc7160d66b61a1c019a6f7c332920bdfbf includes#37 all-repo; final audit PASS/APPROVED/PROCEED. #30 panel correction is in independent review in a separate worktree, no overlap. #35 parked, not a dependency for narrowed standalone#31.
Owned output .agents/run/task-centred-architecture/outputs/issue-31-plan.md and optional evidence under verifications/issue-31-plan/** in THIS design tree. Commit only your owned nonsecret output; no raw host/private findings, no absolute local paths in public proposed text. Tests are source-grounded plan checks only; implementation/browser/device delivery NOT RUN.
Preflight authoritative; targeted git/source searches permitted, no startup discovery loops.
</env_preflight>
<goal>
Produce the smallest implementation plan for the aligned standalone save-answer-and-notify loop, identifying only remaining real decisions and security boundaries before build.
</goal>
<context_files>
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/decisions-2026-10-24.md]
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/outputs/notification-channel-spike.md]
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/outputs/issue-37-integration-acceptance.md]
Accepted root web/server/{app,auth,config,github,repositories,board}.ts, web/public/{app.js,index.html,styles.css}, package.json and web tests: read-only source inputs. Use exact source names verified, don't assume all listed files exist.
</context_files>
<skills>
[@/workspace/config/opencode/.agents/skills/review/adversarial/doubt-driven-development/SKILL.md]
[@/workspace/config/opencode/.agents/skills/build/planning/planning-and-task-breakdown/SKILL.md]
[@/workspace/config/opencode/.agents/skills/communication/terse/caveman-lite/SKILL.md]
</skills>
<scope>
Decision23: saved exact-current-question GitHub answers + privacy-safe PWA notifications only. No agent resumption/control/OpenChamber change/voice-auth reuse. Existing choice: test-notification button FIRST then real alerts;60s conditional GitHub observer not webhook; in-board attention base; changed-question refusal; identical delete/re-ask entirely between observations may be missed (accepted). No editable body counter/tamper/history promise. Multi-repo qualification+discovery caps must persist.
1. Map what accepted web already does for question answers/auth/CSRF/current revision/UNKNOWN: don't rebuild existing#33/#34 functionality or depend on parked#35 panel. Give exact source anchors and test coverage; no live proof claim.
2. Propose at most3 small slices: (a)installable shell/subscription+test delivery, (b)bounded conditional attention observer/dedup/reconnect, (c)real-device/user-way verification+deployment integration. Reuse runtime libraries, minimal dependencies (standard audited web-push library preferable to custom crypto; do not install yet). Exact files/APIs tentative until approved; describe auth/CSRF/read-only vs mutations, persistent VAPID/subscriptions data0600 and atomicity, size/count limits, missing config disabled state, revoke/unsubscribe/410, logging/privacy.
3. Hostile threat analysis: browser-controlled subscription endpoints are server-side HTTP destinations (SSRF, DNS/private/reserved targets, redirects, credential-bearing URL/userinfo/query logs, callback payload); choose a safe minimum, flag real policy forks for user rather than silently provider-lock. Persistent push keys/subscriptions are secret, not issue data. Keep generic lockscreen text with no repo/title/question; click lands same-origin authenticated board attention, not arbitrary URL. Test-notification rate limits and authentication; multi-device subscription ownership/logout/revocation; never falsely claim received when merely queued/accepted by relay. Permission denied, unsupported and iOS Home Screen conditions handled.
4. Observer60s is nominal best-effort not a promise under rate limit/backoff; conditional ETag per route/page/repo, bounded concurrency/work and no unbounded re-paging. Ensure secondary limits/Retry-After, repo permission removal fail closed, no private payload persists outside intended restricted state. Define initial baseline/no startup flood, restart dedup scope, transitions/missed-change semantics and real user choices if not settled. Poller is informational only, never writes/resumes agents. Don't silently adopt notification semantics not aligned if meaningful fork.
5. Exact proof criteria and before/after mutants for each slice, real service worker/browser path, TLS/device limitations and honest NOT VERIFIED. Plan phases and dependency graph avoid root merge collisions. Credentials/VAPID generation and persistent state may extend deployment package; identify needed amendments, don't modify it or silently ship#31 with old artifact.
6. Return a short batch of at most3 genuine user questions only if needed, with plain options/tradeoffs/recommendation; distinguish ordinary technical choices you can recommend from permission/product forks. No manufactured question if clear.
</scope>
<criteria>
Source-grounded minimal plan<=200lines with clear boundaries, no code/side effects, preserves existing reviewed answer path, no implicit resumption, explicit SSRF/subscription privacy, bounded observer, test-notification-first, deployment dependency honestly shown. Remaining decisions explicit; no spec inflation.
</criteria>
<output>
Commit owned plan, return<=12lines: commit/report pointer; existing reuse; proposed3slices; remaining real forks if any; security and deployment dependencies; proof not run; actual provider/model. This plan is proposed, not implementation approval.
</output>
