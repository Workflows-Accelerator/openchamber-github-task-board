# Issue #47 — L4 hostile review

Candidate: af9b39c (fix/issue-47-fresh-app-stay-signed-in). Reviewer session ses_0d95741ddbcddbfcbff01512.
Verdict: Spec PASS, Quality APPROVED. State: awaiting batch (with #48 panel + web).

Evidence: typecheck exit 0; web tsc exit 0; bundle exit 0; web tests 409/409; panel tests 553/553; bundle harness (30-day TTL, restart survival, 0600, instant logout, corrupt/unwritable recovery) PASS.

| # | Finding | Severity | Resolution |
|---|---|---|---|
| A | Native form POST without JS gets 400 invalid_json (app.ts:924); password stays in body, not URL | low | Open - fix after #48 web lands (app.ts collision) |
| B | CSRF token stored in plaintext in sessions.json (auth.ts:165); useless without the signed cookie | low | CLOSED in 4b3f475, independently verified by ses_9b79521102d2101911053528: runtime HMAC derivation, no CSRF token on disk |
| C | Changing BOARD_PASSWORD keeps existing sessions valid up to 30 days (auth.ts:220) | low | CLOSED in 4b3f475, independent real-config restart tests confirm password rotation invalidation |
| D | Version stamp falls back to package version if public dir missing (app.ts:143) | low | Accept - release layout always ships public/ |

Not verified: physical iOS/Android autofill; live restart against /workspace/.openchamber-data.
L5: AWAITING HUMAN.
