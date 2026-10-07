# L5 human validation — Batch 2 ask (SINGLE ask)

Status: READY TO SEND once both integration merges land and their gates re-run green in the served roots. Batch 2 L4 quorum reached (both members PROCEED). Send ONCE. Batch 1 verdicts (l5-batch-1.md) remain pending — do NOT repeat that ask; the user may answer both in one sitting but each verdict is per issue.

What changed since the draft: both members passed hostile review with zero residual findings; the reviewed chains are being merged into the served preview branches (board: fix/v2-binding-ratelimit-review-repair -> feat/v2-binding-and-ratelimit; voice: fix/v2-ratelimit-review-repair -> feat/v2-compat-and-ratelimit) so what loads in the app is the code that was reviewed. Local master is untouched until verdicts; nothing has been pushed.

## Members (verdicts are per member/issue)

1. Task board — V2 session binding + request efficiency (board issue; batch 2 member 1).
2. Voice — V2 compatibility + request efficiency (voice issue; batch 2 member 2).

## Numbered click-through — what to click and what should happen

### Member 1: task board

1. Open the task board on a project with GitHub repos bound. Issues appear, grouped in the views (including Human Tasks / All Tasks / Questions from batch 1). Switch between single-repo and All Projects: no missing issues, no duplicates, no wrong-repo grouping.
2. Click one issue's comments, then immediately click a different issue in another repo that has the same issue number. The comments that open belong to the issue you clicked last — no stale swap, no comments attached to the wrong issue.
3. Drag a task to "no priority": the priority label clears. Drag it to another status: the label updates. Nothing silently reverts.
4. Edit or close a task while the board is idle; within about a minute the change shows up without pressing Refresh. Delete a comment and confirm the same.
5. Press Refresh explicitly: the board reconciles everything immediately (this is also the safety net for the deletion gap in decision A below).
6. If a repo ever has more than 1,000 changed issues in one sync, the board shows a visible "partial data" warning instead of silently showing a short list. (Expect NOT to see this in normal use — it is a guard, not a feature.)

### Member 2: voice

7. Ask the voice assistant for tasks on a single project. Then ask across all projects. Both answer; the cross-project answer includes every repo's tasks and is fast on repeat asks (about a second cold, instant warm).
8. Trigger a form that contains an information/link field alongside real questions (e.g. a form with a URL notice plus a text question and a number question). Voice asks only the real questions, accepts your answers, and does not error on the link field. Also try answering the number question with an integer ("3") and a multi-select question with several choices.
9. Let the task cache age out (30+ seconds) and ask again: fresh data comes back; if one repo errors at that moment, the answer still includes the other repos and says so rather than showing a stale or partial list as complete.

## Known blind spots (state these with the ask)

- No live browser/webview end-to-end run: tests execute the real built bundles and real production functions via fixture harnesses, but nobody drove a real OpenChamber UI session end to end.
- No live form/permission *reply* proof: answering a live form would mutate the shared host database and session roster, which is not authorized. Discovery paths were verified live; reply paths are verified against fixtures only.
- No real GitHub mutations in tests: create/edit/close/drag paths run against mocked transports in tests. Your click-through is the first real-GitHub exercise of them.
- No end-to-end measured quota savings against GitHub's live rate-limit counters; savings are computed from fixture-measured request counts.
- Browser microphone/worklet voice flow unverified.
- The two decision gaps below are known and accepted only if you accept them here.

## The two decisions (ask both in the same message)

A. **Deleted/transferred issues.** GitHub's incremental "since" API cannot see deletions or transfers, so automatic idle refresh will not remove an issue someone deleted on GitHub. Manual Refresh reconciles immediately. Accept: "auto-refresh keeps content fresh; Refresh button is the cleanup path" — or approve extra deletion-check requests (costs additional GitHub calls periodically).

B. **Conditional reads need a PAT.** The 304 caching that cuts quota use works only when a GitHub Personal Access Token is configured; through the default SDK host proxy, custom headers are dropped and non-PAT users degrade to plain GETs (correct, just less quota-efficient). Accept: "non-PAT users get correct but unoptimized requests" — or approve a change (e.g. encourage PAT setup in docs, or another transport).

## Reply shape requested from the user

- Per member: PASS or BOUNCE with the note (bounced members return to In Progress with the note attached).
- Decision A: ACCEPT or APPROVE-extra-checks.
- Decision B: ACCEPT or APPROVE-change (say which).
