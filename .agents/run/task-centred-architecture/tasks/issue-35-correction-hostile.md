<env_preflight>
Repo /workspace/extensions/github-task-board
Worktree /workspace/extensions/github-task-board/.worktrees/team-dev-issue-35-write-refresh
Branch fix/issue-35-write-refresh; HEAD 0af35ae clean at dispatch. Original baseline 12cb9c6; first candidate 6b4032d; hostile report e49ddbe; correction 0af35ae. No builder running. Root node_modules symlink present, no installs/env copy/DB registration.
Key paths panel/main.ts, generated panel/main.js, test/issue-35-write-refresh.test.js, test/test-app-harness.js; original report/probes under verifications/issue-35-review/** and .agents/run/task-centred-architecture/outputs/issue-35-hostile.md.
Tests node --test test/issue-35-write-refresh.test.js; node --test test/current-board.test.js test/issue-34-answer-integrity.test.js; npm test; npm run typecheck; npm run build.
Own only .agents/run/task-centred-architecture/outputs/issue-35-correction-hostile.md and verifications/issue-35-correction-review/**. Product/tests/prior proofs read-only; disposable probes /tmp/opencode. No web/**, service/**, panel/core.ts, skills/config, credentials, real GitHub, installed extension, other worktrees, push/merge/closure/deploy/master.
Preflight facts authoritative at startup; no git status/pwd/ls discovery. Targeted checks on mutation/failure/commit verification allowed.
</env_preflight>
<goal>
Give the single bounded independent verdict on correction 0af35ae and falsify its claimed closure of F1–F8 without fixing anything.
</goal>
<context_files>
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/tasks/issue-35-correction.md]
[@/workspace/extensions/github-task-board/.worktrees/team-dev-issue-35-write-refresh/.agents/run/task-centred-architecture/outputs/issue-35-hostile.md]
[@/workspace/extensions/github-task-board/.worktrees/team-dev-issue-35-write-refresh/.agents/run/task-centred-architecture/outputs/issue-35-correction.md]
</context_files>
<skills>
[@/workspace/config/opencode/.agents/skills/review/adversarial/doubt-driven-development/SKILL.md]
[@/workspace/config/opencode/.agents/skills/review/quality/code-review-and-quality/SKILL.md]
[@/workspace/config/opencode/.agents/skills/verify/ladder/verification-levels/SKILL.md]
</skills>
<scope>
Conduct a hostile review of any edits or changes that you made to figure out what you might have missed or what might be broken. Don't assume that what you did is right.
You did not implement this. FIX NOTHING. Read full e49ddbe..0af35ae diff (587 changed source lines, not just report) and the original 12cb9c6..candidate mechanism. One bounded review only; any failure returns to owner, no fix loop.
Run the previous review's saved actual harness probes against the correction, adapting only fixture paths/output directories. Add independent discriminating probes for gaps in new tests, with deterministic deferred barriers. A test that merely passes is not closure proof.
F1: both creation paths during POST + repository switch; missing response repo falls back to captured target, explicit response repo may never contaminate another cache/admission; later row actions PATCH correct repository, same-number repository remains untouched. Attack the new deferred GET recovery: repo A→B→A transitions, delayed/stale GET, failed GET, and no write from a different repository being smuggled back.
F2: all three drawer handlers; issue switch/repo switch before success, definite rejection and ambiguity; neither rollback nor toast/render may touch the new issue, failed target rolls back itself only, no lost newer same-issue write through old rollback.
F3/F6: all six handlers must distinguish definite pre-commit rejection from unknown post-send outcome, reuse classifier, no success/definite-failure on ambiguity, no automatic repeat. Unconfirmed state must be present on the currently displayed/cache records after refresh publication, not only a detached object; dependent writes must be refused until a successful fresh read. Probe 5xx, 408, abort, network, malformed/trusted 422 and structured rejection boundaries. Existing #34 classifier semantics are the approved boundary, not an atomic GitHub promise.
F4: older incremental response must not overwrite confirmed body/label/state or forget issue membership, in single and combined views; protect before admission must not pin stale incremental data over a fresh subsequent full response. Probe incremental/full overlap and edit completion ordering, repo switch and stale captured object.
F5: first aggregate failure visibly partial, existing rows/cache retained where available, unknown/empty distinct, storage not persisted complete. Later complete success clears partial state; superseded failures cannot replace newer success; all-fail and skipped/no-repo cases honest.
F7/F8: track settlement after render/cache/dispatch errors including sync throws, aggregate obsolete epoch cleanup, no infinite optimistic pin from settled failure. Repo-qualified regression MUST actually write and fail when keyed by number alone. Hung requests and >4000 pinned hard cap may remain documented limitations; no new timeout feature demanded.
Smoke original creation + six mutations + combined refresh defects, #28 freshness and #34 safe answers/UNKNOWN, #36 human-only Done. Inventory mutations again for bypasses introduced by new helpers. No new UI/features or shared parser edits.
</scope>
<criteria>
Spec PASS/PARTIAL/FAIL, Quality APPROVED/NEEDS-FIXES, machine PROCEED/PROCEED-WITH-CONDITIONS/HALT. F1–F8 each closed/open with your own probe evidence. Any standing/new defect must have severity, exact event ordering, observed vs expected, source path:line and minimum correction, explicitly introduced vs existing. Reproduce targeted/full/types/build and bundle parity/hash yourself. Inspect test discrimination (builder claims 9 newly red on 6b4032d), not just counts. State installed-host, production GitHub and real browser NOT RUN unless truly executed. Synthetic DOM is not L3.
</criteria>
<output>
Commit report/proof only. At most 12 lines: verdicts, F1–F8 closure summary, ranked remaining defects, counts/hash/report commit, blind spots, actual provider/model. No fix, merge, push, closure or deployment.
</output>
