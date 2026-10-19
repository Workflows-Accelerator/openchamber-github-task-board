<env_preflight>
Repo: /workspace/extensions/github-task-board
Worktree: /workspace/extensions/github-task-board/.worktrees/team-research-task-centred-board
Branch: docs/task-centred-board-research
Base commit: f77a2a9 (research report committed by original worker, source remains at 55ddeaa).
State: original research worker completed; no code changes were authorized. Own a new review artifact; preserve original research.
Files: .agents/run/task-centred-architecture/explore/board.md; source paths cited therein, host SDK and installed plugin code.
Test command: targeted read-only SDK/source checks and documentation/math verification. No live mutations; app tests unnecessary for report-only review. Record NOT RUN runtime behaviors.
Do not touch: application, original report, config, agents, skills, schedules, credentials or authenticated git remotes.
Preflight facts authoritative at dispatch; no initial pwd/ls/status loops. Targeted inspection permitted for mutation verification, stale resume or command failure.
</env_preflight>
<goal>Independently distinguish verified board/host capabilities from unsupported recommendations and correct architectural hazards before the research informs a user-facing proposal.</goal>
<hostile_prompt>
Conduct a hostile review of any edits or changes that you made to figure out what you might have missed or what might be broken. Don't assume that what you did is right.
You are a fresh independent reviewer applying this prompt to the prior researcher's edits; do not trust their self-check or completion summary.
</hostile_prompt>
<context_files>
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/mission.md]
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/decisions.md]
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/explore/scenarios-to-cover.md]
[@/workspace/extensions/github-task-board/.worktrees/team-research-task-centred-board/.agents/run/task-centred-architecture/explore/board.md]
</context_files>
<skills>
[@/workspace/config/opencode/.agents/skills/review/adversarial/doubt-driven-development/SKILL.md]
[@/workspace/config/opencode/.agents/skills/build/domain/api-and-interface-design/SKILL.md]
[@/workspace/config/opencode/.agents/skills/communication/terse/caveman-lite/SKILL.md]
</skills>
<scope>
Own ONLY .agents/run/task-centred-architecture/verifications/board-hostile.md and sanitized supporting board-hostile-evidence/ in this worktree. All original source/reports read-only. No code/config/skill edits, API or scheduler mutations, remote pushes/PRs, other workers, user questions, issue publication or direct DB mutation. Existing worktree registration need not be rechecked.
</scope>
<criteria>
- Return separate Spec Compliance PASS|FAIL|PARTIAL and Quality & Health APPROVED|NEEDS-FIXES. Approve only claims supportable as research; no implemented/runtime-proof claims from source alone.
- Verify representative exact source anchors for iframe lifecycle and service support (unmount on which events? host-service lifecycle?), request headers/startSession clamp/open-file API, status state, existing wake prompt/session targeting and schedule capabilities. Missing API on one SDK version not equivalent to missing host/platform capability. Mark source version/unknowns, do not invent file:// workaround.
- Scrutinize local SQLite/fencing architecture: local lockfile/SQLite does not elect a leader across independent devices; expiry does not prove worker dead; fencing only prevents side effects at controlled enforcement points, not arbitrary stale workers or human GitHub edits; do not write into core OpenCode DB as an approved design. Need proposal vs proven clear and smallest single-controller scope as alternative.
- Verify rate arithmetic and claims: five workers every five seconds is 3600 GET/hour before ancillary reads, not 'rate-limited within minutes' under universal 5000/hour; rate limits vary auth/endpoint. Check 200-800ms/zero latency statements for evidence.
- Distinguish suggested schedule overlap/catch-up policy from actual installed scheduler behavior. Recognized action/schema not a live proof. Verify abort/context.abort/stopShell claims and scope revocation race/in-flight side effects without promising immediate rollback.
- Human authority remains: fast path cannot skip independent hostile review or human closure/sign-off gates; ordinary verifier-found fixable defects should return to execution, not always escalate to human. Native question tool blocks a session; nonblocking question recording requires different behavior. No closed issue/checkbox automatically authorizes next side effect.
- Current body safety fresh GET + text match is NOT atomic CAS or true distributed optimistic locking. Invisible revision/lease tokens alone cannot stop external GitHub writers. SDK clamp proof referenced must actually exist; missing artifacts must be called out.
- Check both task truth vs local operational state and prior enhancement status honestly; data.skills persistence does not load skills; 'implemented & verified' source-only entries need qualification. Final synthesis must retain open decisions rather than convert recommendations into alignment.
- Review state-model coverage: hierarchy separate from graph/checklist; phase vs attention vs liveness; blocking only no authorized continuation; ongoing definitions/runs; no-repo intake; worktree/file collisions; privacy and artifact portability; right-sized exploration.
</criteria>
<output>
Write board-hostile.md: independent two verdicts, findings by severity with report/source anchors and precise corrections, verified facts safe to carry forward, unsupported claims/NOT RUN, minimal corrective guidance. Do NOT rewrite original board.md. Local commit owned review artifacts only. Return <=15 lines including report path/commit, verdicts, must-fix findings, actual provider/model if exposed. Review approval does not authorize implementation.
</output>
