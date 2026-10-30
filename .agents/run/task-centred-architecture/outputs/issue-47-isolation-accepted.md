# #47 — test-storage correction accepted, awaiting batch

Date: 2026-10-29
Candidate: 268bd28738443863d6a58b5e4500ad20b6aaa05f, includes af9b39c + 4b3f475.
Independent reviewer: ses_461dba08beef2f87a65063b3, actual 9router/engineer verified in completion metadata.
Verdicts: Spec PASS / Quality APPROVED / Finding E CLOSED.
Detailed report inspected: /workspace/extensions/github-task-board/.worktrees/team-dev-issue-47-fresh-app-signin/.agents/run/issue-47-isolation-review/verifications/proof.md (1–126).
Manager inspected product-free repair diff in web/tests/{helpers,hosting,app}.mjs. No application changes in isolation repair.

## Evidence
- hosting12/12, web413/413, root553/553; both typechecks exit0.
- Real-config retained restart harness12/12 and HTTP lifecycle9/9 exit0; unchanged password restart, changed password rejection, CSRF and logout remain proven through local HTTP.
- Private stand-in default sessions altered under the buggy setup, byte-identical under explicit private test storage. Review audited all test server/store/subprocess constructors and cleanup. No real saved-session file was accessed to test this.
- Durable source/logs retained in #47 worktree .agents/run/issue-47-session-hardening/{harnesses,verifications}/. Independent report is untracked evidence to preserve before worktree removal.

## Rulings
- E CLOSED; this supersedes the hold in outputs/issue-47-session-hardening-review-gate.md. #47 product candidate parked AWAITING BATCH, not a user blocker and not deployed.
- A remains low/deferred: native form without working JavaScript returns invalid_json; board requires JavaScript. Do not imply fixed during integration unless actually corrected and tested.
- D accepted only with complete public assets shipped and manifest verification.
- Earlier test impact on production sign-ins UNKNOWN; no authorised evidence to say safe or damaged.
- Physical autofill, real installed-PWA upgrade, multi-process sessions and live-data restart NOT VERIFIED. L5 AWAITING HUMAN, no approval to master/deploy/close.
- Web branch based on af9b39c still needs a normal merge of latest #47 before any full web suite; must also audit new #48 rename and browser storage paths. Do not assume test isolation on #47 proves newly added #48 callers.

## Next
Await #48 review completion, then one correction worker in its existing worktree merges #47 latest branch without rebase/cherry-pick and addresses grouped findings. New L4 follows. Human receives one combined preview only when extension and web both pass.
