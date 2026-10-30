# #49 builder handoff — not accepted

Date: 2026-10-30
Builder ses_b75ff32406f2d7fdcab54699 actual 9router/engineer completed; branch fix/issue-49-login-label at a07de3b, clean. Product CSS commit76edb66 plus217-line test e9ee37d and proof a07de3b.

Claims: web452/root595/parity18/types0/browser33+14; synthetic sign-in succeeds, screenshots clean. Manager read129-line worktree proof and inspected complete CSS + partial217-line new-test diff.

Important evidence distinction: proof explicitly says Chromium base screenshots are ALREADY clean; Obscura alone reproduces username bleed. Do not describe this as a confirmed ordinary Chrome visual bug. Original live audit used Obscura. Physical autofill/screensreader never proven by DOM presence.

Review doubts (required independent evaluation): new *.test.mjs browser test imports Playwright from transient /workspace/.npm/_npx/<hash> path and launches hardcoded browser path; could break documented clean node --test web/tests/*.test.mjs. Regression asserts chosen implementation u.right<=0 even though Chromium base not visibly broken; causal visual correctness weak. Added opacity:0 + offscreen + global clip-path might be redundant or affect password-manager heuristics; DOM attributes do not prove native recognition. No manager acceptance yet.

Independent hostile reviewer ses_759df564c9d85c6782726479 RUNNING engineer in same #49 worktree, source/tests READ ONLY; brief tasks/brief-issue-49-hostile.md. Return two verdicts and fail required portability/regression gaps. Actual model deferred to completion wake. No duplicate worker or polling.

User approved preparation only (D57), never #49 publication/deployment/closure. No product source from #49 in root, master or live release. L5 pending after independent L4.
