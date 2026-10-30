# #49 hostile gate — correction required

Date:2026-10-30
Reviewer ses_759df564c9d85c6782726479 actual9router/engineer, worktree checkpoint6f079f9. SpecPASS / QualityNEEDS-FIXES / NOTL5READY. Manager read findings54lines.

F1HIGH required: new web/tests/login-label.test.mjs imports Playwright from transient cache and launches hardcoded browser from standard unit-test glob, clean install fails ERR_MODULE_NOT_FOUND. Fix by dependency-free normal tests and explicitly invoked repo-pattern CDP harness outside glob, not by hiding/skipping tests or adding deps.
F2MED required: base Chromium already clean; offscreen geometry assertion fabricated unclipped text region instead of visible outcome. Obscura-only native text clipping defect. Ablation proves left:-9999px alone effective; global clip-path doesn't fix and opacity0 unnecessary/risky for autofill. Minimal scoped positioning and causal screenshots/pixel region proof, disclose engine distinction.
F3LOW blindspot: DOM/AX tree says names/roles/attributes; cannot claim real native password-manager popup or spoken screen-reader verification. Keep NOTVERIFIED for L5.

Correction1 ses_f4015b07b5d060d0948e87ae RUNNING engineer in same feature worktree, brief tasks/brief-issue-49-correction-1.md. No automatic publication/deploy/closure. On wake dispatch fresh independent recheck, don't resume ended sessions. Two failed escalations then stop/ask per manager policy. No duplicate/polling; actual tier verify at wake.

GitHub: status returned to in-progress successfully. Follow-up review receipt comment attempt was permission denied (shell) on2026-10-30; NOT posted, no retry/bypass. Earlier issuecomment6524896559 retains review-in-progress receipt; findings currently durable locally only. Ask user only if permission needed to continue required remote receipt; local correction unaffected.

Concurrent runtime boundary investigator ses_04a22335f02da8ec1bb431cb is separate read-only root work, no file collision. Manager commit evidence only; root/master source stays exact reviewed ab7516c.
