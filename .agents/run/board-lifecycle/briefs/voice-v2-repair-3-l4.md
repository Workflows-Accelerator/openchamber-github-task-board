<goal>Independent hostile L4 delta review of voice repair 3 (commit a7e3ac9) on branch fix/v2-ratelimit-review-repair: the non-input external form-field skip. Verdict per the doubt-driven protocol; assume the fix is broken until proven.</goal>
<context_files>
[@/workspace/extensions/github-task-board/.agents/run/board-lifecycle/verifications/l4-voice-v2-repair-2.md]
[@/workspace/extensions/github-task-board/.agents/run/board-lifecycle/verifications/voice-v2-repair-2-l4/oracle-audit.md]
[@/workspace/extensions/github-task-board/.agents/run/board-lifecycle/briefs/voice-v2-repair-3-fix.md]
</context_files>
<skills>
[@/workspace/config/opencode/.agents/skills/review/adversarial/doubt-driven-development/SKILL.md]
[@/workspace/config/opencode/.agents/skills/verify/ladder/verification-levels/SKILL.md]
</skills>
<context>
Review target: THIS worktree /workspace/extensions/chambervoice/.worktrees/team-dev-v2-ratelimit-review-repair, branch fix/v2-ratelimit-review-repair, delta a5ddb77..a7e3ac9 (single commit a7e3ac9). Base a5ddb77 was already review-verified PROCEED-WITH-CONDITIONS by ses_6d098c99a8d60ed4cbb8364e with exactly one residual defect (Finding 1: external form field type rejected in replyQuestion, service/host-client.ts). Everything outside the delta is previously verified; your job is the delta plus collateral damage to the 3 repair-2 fixes (integer form type, dead-V1-404 removal with typed NOT_FOUND, per-repo generation-protected cache + canCache guard) and the 9 repair-1 fixes.
Builder ses_de7b947c163f3c1c57b71b9f claims: external fields filtered from normalizeQuestionRequest (pending.questions presents only answerable fields), external keys stripped from object-format answers, inputFields filtering before answer-slot iteration in replyQuestion (slots align even when external fields are interspersed), red baseline 3!==2 count + UNSUPPORTED_FORM_FIELD reproduced at a5ddb77, 460 tests green, service/main.js rebuilt with parity, panel/live bundles zero diff.
Protocol oracle: @opencode/protocol form.d.ts defines type "external" as { key, type: "external", url, title?, description? } — a display URL that takes NO entry in the reply answer record. Requirements to enforce: a form containing an external field plus real input fields (single-select, integer, multiselect, string) must be fully answerable; the external field must never consume an answer slot, never trigger UNSUPPORTED_FORM_FIELD, and never appear in the submitted answer record; answer slots must align to input fields in order regardless of where external fields sit; normalizeQuestionRequest must not present external fields as answerable questions (but must not lose real input fields); duplicate/ambiguous label handling and integer validation from repair 2 must be undisturbed.
Test-oracle standard: tests must execute real production HostClient paths via the transport boundary (fetchImpl interception), not copied simulations. The prior reviews rejected simulate* enactments; keep that standard. Verify the red proof genuinely fails at a5ddb77 (extract the base into a scratch dir and run it) and the green test passes at a7e3ac9.
Safety rules stand: no live session/form/permission mutation on the shared host at 127.0.0.1:3000, no real GitHub writes, no secrets in output. The NOT RUN gap (positive live reply proof) is a known design limitation — record it, do not attempt to close it here.
</context>
<scope>
Read-only review of a5ddb77..a7e3ac9 in THIS worktree. No application edits, commits, merges, branch switches, stash/reset, push, PR, issue closure, DB writes, service restarts. Write sanitized review artifacts only to /workspace/extensions/github-task-board/.agents/run/board-lifecycle/verifications/voice-v2-repair-3-l4/ and the report to /workspace/extensions/github-task-board/.agents/run/board-lifecycle/verifications/l4-voice-v2-repair-3.md (absolute paths — the ROOT checkout run dir, not the worktree's). Tests and read-only probes may run. No delegation.
</scope>
<criteria>
One verdict: PROCEED, PROCEED-WITH-CONDITIONS, or HALT. Every finding needs file:line, severity, expected vs actual, minimal repair. Confirm red/green reproduction yourself. Collateral sweep: npm run verify (460 expected), npm run build with bundle parity claims (service/main.js changed only; panel/main.js and live/* byte-identical to base), and spot-check the 3 repair-2 fixes still behave. Enumerate remaining NOT RUN gaps yourself. Record exact commands/results. No release, closure or approval authority.
</criteria>
<steps>
<step>Verify branch and commit chain (a5ddb77..a7e3ac9, exactly one commit). Run npm run verify and npm run build; diff bundle outputs against a5ddb77 to confirm parity claims. Re-run test/v2-ratelimit-repair.test.js and inspect which tests execute production HostClient code.</step>
<step>Red proof: extract a5ddb77 to a scratch dir, run the new regression test against it, confirm it fails for the stated reasons (question count 3!==2 and/or UNSUPPORTED_FORM_FIELD). Green: run it at HEAD and confirm it passes.</step>
<step>External-field semantics: audit all form-field handling paths (normalizeQuestionRequest, replyQuestion, object-answer path) for (a) external fields excluded from answerable questions and answer records, (b) slot alignment when external fields are first, last, or interspersed, (c) no loss or reordering of real input fields, (d) no residual code path where an external field can reach the unsupported-type throw. Check the form key resolution (f.key || f.id) is consistent after filtering.</step>
<step>Collateral sweep: integer validation, multiselect arrays, label-to-value mapping, duplicate-label ambiguity, SCHEMA_UNAVAILABLE on missing schema, typed NOT_FOUND without dead V1 probes, per-repo cache generation guards — none degraded. Check filtering does not break legacy V1 question shapes (no type field).</step>
<step>Enumerate NOT RUN gaps (live reply proof on shared host, real browser voice flow) and stop after read-only review.</step>
</steps>
<output>
Write the report at the scope path. Return: STATUS; verdict; findings with file:line/severity/expected vs actual/minimal repair; red/green reproduction results; test-oracle assessment; evidence commands/counts/exits; NOT RUN gaps; report path and commits reviewed. Nothing is human-approved or released. Never include credentials.
</output>
