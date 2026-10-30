# Initial gate — #48 web implementation

Date: 2026-10-29
Builder ses_5ecd23a8361540b21b87243a. Candidate e630a9ddd044389787a66f458b1ee49c944db250; commits42de557/cc9ce34/e630a9d. Requested genius, actual model not yet proven.
Verdict from builder: PARTIAL. Manager: not accepted for release.
Independent reviewer ses_ca48a1f70a74aef3aa647615 running, read-only.
Receipt: https://github.com/Workflows-Accelerator/openchamber-github-task-board/issues/48#issuecomment-6496368410

## Claimed evidence (pending hostile validation)
- Both typechecks/build exit0; web435/root553 (one unchanged CPU timing assertion failed51.76ms then rerun553/553), browser14checks/16screenshots/no page errors.
- Protected SW/auth/login/registration remain at af9b39c; latest4b3f475 not integrated.
- No push, merge, deployment or real GitHub writes.

## Defects/gaps acknowledged by builder
- Some downward positions among legacy unmarked drafts cannot be represented under the manager-authored ordered-first/single-marker contract; UI refuses those moves. User expectation of free reorder is not met. Underlying engineering contract may need relaxation; do not ask user to choose numeric marker mechanics if a safe smallest correction can preserve approved behaviour.
- Existing saved-draft moves create target then comment and close source; halfway failures returned no-retry warning but no durable journal. This closes issues without aligned semantics. Must remove/replace unsafe operation before release; assigning a NEW draft's project is approved.
- Lost create response + automatic retry can duplicate queued drafts. Reviewer must check new and preserved offline paths.
- Different-item simultaneous moves can produce equal markers, deterministic tie-breaker but no transaction. Record limit; do not call cross-device atomic ordering proven.
- Graph uses dependency tree, no GitHub sub-issue API data. Short-name overrides shared among web devices, not extension.

## Screenshot inspection (manager judgement, NOT independent test verdict)
Read verifications/screenshots/issue-48-web-390-844-drafts.png. Page has roughly first420px consumed by header/project selector/notice/title/2x2toolbar/filter chips/help text before first task. Each draft uses ~150px for title, description and a full control row. Only about2.5draft rows visible in844px height; add row below list, not initially visible. This could still feel too heavy for the user's minimal screenshot request. Do not silently request another redesign: wait for independent view report and present concrete preview for user's L5 simplicity judgement. New layout is not yet labelled usable or perfect.

## Next
Fold review wake into one bounded correction; include test-isolation integration and latest#47 carefully, no simultaneous product writers. Ask once for human review when all batch members pass and preview is running. No approval from previous #46 release carries forward.
