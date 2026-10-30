<env_preflight>
Repo: /workspace/extensions/github-task-board
Worktree: /workspace/extensions/github-task-board/.worktrees/team-dev-issue-48-panel-simple-views
Branch: feat/issue-48-panel-simple-views
Base: cc083796c4bf62b57aaa76e2908f8b5cd47347dd
Candidate: 253f9f23e4b4eda7f39ca0a059dff3a21e33eb84 (builder ses_cfa486c39fa33858987536fc completed, four commits after base).
State: builder reports clean tree and has completed. No other writer authorised. Preserve all product edits and evidence; app and tests read-only. Builder reported unrepresentable reorder refusals and added real GraphQL transferIssue after confirmation. Reorder refusal is NOT accepted. Transfer is a product fork, not approved just because it preserves history; report and do not execute against real GitHub.
Review paths: panel/**, test/** changed by this feature, generated panel/main.js. App/test code READ ONLY. Evidence writes only under this worktree's .agents/run/issue-48-panel-hostile/**.
Tests: npm run typecheck; npm run build:panel only into a private scratch output for deterministic parity, not over tracked bundle; node --test --test-concurrency=1 test/*.test.js; targeted tests added for #48. Browser testing against local built panel with synthetic bridge and fake GitHub only.
Do not access live GitHub issues, production board, saved credentials, /workspace/.openchamber-data/**, /workspace/releases/** or config. No merge, push, deployment or issue closure. No full web test glob: this branch does not contain #47 storage isolation. No raw secrets in any logs, argv, reports or commits.
Preflight facts authoritative once completion receipt exists; skip initial pwd/ls/status discovery. Targeted candidate/mutation/diff checks permitted, especially if builder receipt is missing or branch moved.
</env_preflight>
<goal>
Independently establish whether the extension meets the approved simple task-browsing and draft-capture experience without regressions or destructive side effects.
</goal>
<context_files>
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/decisions-batch-simplify-views.md]
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/tasks/brief-issue-48-panel-simple-views.md]
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/outputs/simplification-review-requirements.md]
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/outputs/issue-48-panel-build-receipt.md]
</context_files>
<skills>
[@/workspace/config/opencode/.agents/skills/review/adversarial/doubt-driven-development/SKILL.md]
[@/workspace/config/opencode/.agents/skills/verify/ladder/verification-levels/SKILL.md]
</skills>
<review_prompt>
Conduct a hostile review of any edits or changes that you made to figure out what you might have missed or what might be broken. Don't assume that what you did is right.
You are the independent reviewer, not the builder. Apply the prompt to this candidate and reject self-grading.
</review_prompt>
<scope>
1. View/Filter/Sort: five views, Simple default, no old duplicated tabs/presets, consistent filters across all views, removable chips and Clear, remembered state/migration. Human tasks and questions remain visible AND actionable in appropriate views/drawer; Pending items preserves existing Human Tasks experience. Needs me is attention across stages, not a destructive status rewrite. Check sort ties, statuses, project and attention intersections, empty/error state and All Projects same-number issues.
2. Draft capture: Enter saves status:draft without any agent/session launch; optional inspiration description editable without destroying raw issue body sections. Add at bottom remains reachable with keyboard and narrow viewport. Short project names exact shared rule plus rename overrides, full identity available. Empty titles, long text, retry/failure, unsaved focus-switch/re-render and repeated Enter must not lose or duplicate data.
3. Manual ordering: actually exercise ALL UNMARKED drafts, downward/upward moves in mixed sets, equal markers, very small/negative/midpoint exhaustion and cross-project issue numbers. Web builder found single-marker ordered-first contract prevents some downward placements. Do not accept the same gap here. A manager-imposed numeric storage rule is not grounds for denying the user's free reorder. Test source and shipped bundle wiring, stale ETag body fetch, unknown response handling and rollback. Drag visibly selects or requires Manual order; hidden marker never shown and code fences/CRLF preserved.
4. Project assignment: NEW unsaved drafts may choose their destination. Existing issue move must never copy+close automatically or start agents. If a GitHub transfer path was added, check exact explicit confirmation, history preservation, target allowlist, identity invalidation, source/target refresh and lost-response handling. User did not approve silently closing or recreating saved issues. Do not invent transfer approval or execute live transfers; report any new product fork.
5. Safe write routing: every new mutation stays within existing conflict/UNKNOWN protections; tests cannot satisfy source greps using dead/commented calls. Mutation before repository switch, stale refresh, rapid edits/reorder, offline and partial write errors must never target a different repo/issue or overwrite someone else's body. Preserve #46 Align Drafts spinner/toast and extension-only presence.
6. Browser proof: use actual built panel with controlled OpenChamber bridge, not only isolated helpers. Capture Simple, Draft, Cards, Kanban, Graph and Pending items at desktop and narrow viewport; inspect console/page errors, focus/keyboard/drag interaction. Screenshots must be visually inspected, not just generated. Synthetic bridge proves UI wiring, NOT installed extension + real GitHub integration. Record missing runtime capabilities honestly.
7. Generated asset: scratch rebuild main.js must match committed main.js; root shipped-parity tests run. Inventory replaced assertions and ensure coverage remains behavioural; no weakened CPU thresholds or removed safety tests. Compare shared web short-name and marker contracts by source; do not modify another worktree.
</scope>
<criteria>
Separate Spec Compliance PASS/PARTIAL/FAIL and Quality APPROVED/NEEDS-FIXES, with findings severity, exact file:line, empirical reproduction and smallest correction. No full pass without browser interaction evidence; clearly distinguish fixture testing from installed-host proof. Group all required corrections into one bounded report. L5 AWAITING HUMAN.
</criteria>
<output>
Write reproducible detailed proof/logs/screenshots under .agents/run/issue-48-panel-hostile/verifications/proof.md in this worktree. Return at most 15 lines: two verdicts, ranked findings, candidate SHA, counts/exit codes, full evidence path, blind spots, and actual provider/model only when known. Do not change app or tests. Do not call Done or authorise deployment.
</output>
