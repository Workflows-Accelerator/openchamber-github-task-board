# #33 hostile re-review — manager ruling (2026-10-24)

Review: 2151ce2 by Genius, Product HEAD a795985. Verdicts Security NEEDS-FIXES / Spec PARTIAL / Quality NEEDS-FIXES. Status PROCEED-WITH-CONDITIONS, not merge authority.

Accepted evidence (independently reproduced by reviewer):
- R1 Medium: truncated response after committed PATCH returns generic 500 instead of unknown, server `github.ts:119-131`, `app.ts:706-727`; browser transport loss shows raw error, not unknown. Violates the owner's ambiguous-write rule. Must fix and test at real HTTP/browser level, no automatic repeat.
- R2 Medium: unfinished login POST holds the address slot indefinitely; correct sign-in 429 after 61s. Hash queue bounds active work only; 200 distinct sources admitted with no queue cap. Not account takeover, but the "F2 CLOSED/bounded" claims are false. Bound request occupancy and queue admission; no permanent lockout; authenticated sessions stay usable.
- R3 Medium: new `BOARD_TRUST_PROXY` trusts first X-Forwarded-For from any peer and README recommends it. Amendment said no new forwarded-header trust. Remove for this slice unless a safe peer-bound contract is separately approved and tested.
- R4 Low: fenced-code closer grammar still misparses `\`\`\`not-a-closing-fence`.
- R5 Low: hash tool is not executable on Node 22 (TypeScript annotations in .mjs); README command still records a password in shell history.
- R6 Low: session eviction is FIFO; LRU documentation is false.
- R7 Low: CRLF readback falsely reports unknown after a correct write; conservative but a regression on supported input.
- R8 Low: same-origin pagination Link can point to another repository path. Trusted-upstream residual; validate path or disclose.
- Deployment: loopback-only bind confirmed; no `/health` endpoint. Not part of this fix.

Ruling per finding: R1/R2/R3 in scope now (correctness/security of the owner-accepted design). R4/R5/R6/R7/R8 in the same bounded remediation because each is a false claim or a broken documented command in shipped files; each gets a regression. Do not widen to new features, push, notifications or deployment.

The review's own framing that all HTTP 4xx/5xx prove rejection is NOT adopted. Only a definitive pre-commit rejection may roll back; any potentially post-send failure is UNKNOWN. Reviewer evidence supports treating truncated body/transport loss as ambiguous, not the reverse.

After remediation: one more independent hostile pass, bounded. If new High defects appear, HALT and bring the fork to the owner rather than looping. No merge until that pass and the batched human review. Deployment/`master` still need explicit owner go.
