# Review gate — #47 persistent sign-in hardening

Date: 2026-10-29
Candidate: 4b3f4750bf20bf370bbdc4632a05714e8e3dd009
Reviewer: ses_9b79521102d2101911053528, actual 9router/engineer (completion metadata verified).
Source proof: /workspace/extensions/github-task-board/.worktrees/team-dev-issue-47-fresh-app-signin/.agents/run/issue-47-session-hardening/verifications/proof.md
GitHub prior receipt: https://github.com/Workflows-Accelerator/openchamber-github-task-board/issues/47#issuecomment-6495833880

## Decision
Runtime authentication changes accepted as a reviewed candidate; release remains HELD for test-isolation finding E and the rest of the batch. Reviewer's Spec PASS/Quality APPROVED is not human validation and does not waive an unsafe test side effect.

## Verified by independent reviewer
- npm run typecheck -> 0; npx tsc -p web/tsconfig.json -> 0.
- web tests 412/412 -> 0; root/panel tests 553/553 -> 0.
- Real loadConfig across server restarts, both BOARD_PASSWORD and BOARD_PASSWORD_HASH: unchanged config retains session, password or session secret rotation rejects old session.
- CSRF tokens derived at runtime, cross-session replay rejected; hashed session IDs and HMAC password fingerprint on disk; mode 0600, atomic rename. Sign out remains revoked after restart.
- Service worker network-first/version/header checks are harness evidence, not proof of upgrading a physical installed app. Physical autofill and live-data container restart NOT RUN.

## Findings and manager rulings
- B, C: CLOSED by independent verification (CSRF-at-rest and password-rotation invalidation).
- A (native form without JS returns JSON error): low; deferred/accepted for this batch unless integrated UI produces a real supported-path failure. No JS-free board is promised. User was earlier told a fix would follow; disclose if retaining this limitation rather than falsely claiming fixed.
- D (version fallback if public files absent): low accepted, with complete release-manifest checks mandatory.
- E (hosting.test.mjs:186,210 uses default SessionStore path): reviewer called low, manager raises to release blocker. Running tests must never load/prune the real session store. Need isolated temp BOARD_SESSION_FILE for every server-construction test, safe test shutdown/cleanup, and a behavioural assertion showing a private stand-in default store is untouched. Do not read or modify /workspace/.openchamber-data/** to prove it. No full web test rerun until default-path creation risk is removed.

## Queue and concurrency
Do NOT spawn a second web writer while #48 web builder ses_5ecd23a8361540b21b87243a is active. Queue E correction for after its completion/review, preferably with its other necessary fixes and #47 integration. No polling or duplicate builder. Current web #48 branch starts at af9b39c and must incorporate 4b3f475 without losing passwordHash wiring.

## Evidence preservation requirement
Review proof cites /tmp/antigravity/test_restart_behavior.mjs and test_http_restart.mjs, not durable repo artifacts. Before cleanup, a worker must retain secret-free harness source and logs under .agents/run/**, reproduce exact commands if files are missing, and copy the proof into durable root run state through worker report delivery. Do not treat temporary-file references as permanently reproducible.

## Human gate
L5 AWAITING HUMAN. No #47/#48 approval or deployment exists. No individual review ask until both issues are independently ready and one usable integration preview is running.
