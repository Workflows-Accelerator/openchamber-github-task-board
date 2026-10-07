<goal>Fix exactly one residual voice defect from hostile review of repair 2: V2 form field type "external" must not block form answering or consume answer slots.</goal>
<context_files>
[@/workspace/extensions/github-task-board/.agents/run/board-lifecycle/verifications/l4-voice-v2-repair-2.md]
[@/workspace/extensions/github-task-board/.agents/run/board-lifecycle/verifications/voice-v2-repair-2-l4/oracle-audit.md]
[@/workspace/extensions/github-task-board/.agents/run/board-lifecycle/briefs/voice-v2-repair-2-fixes.md]
</context_files>
<skills>
[@/workspace/config/opencode/.agents/skills/build/methodology/test-driven-development/SKILL.md]
[@/workspace/config/opencode/.agents/skills/build/refactoring/surgical-patch/SKILL.md]
[@/workspace/config/opencode/.agents/skills/communication/terse/caveman-lite/SKILL.md]
</skills>
<context>
You are repair 3 (single-defect bounded fix) on branch fix/v2-ratelimit-review-repair in THIS worktree, at the current HEAD (commits f58e11b/67f955f/d582374 plus docs a5ddb77). Independent L4 ses_6d098c99a8d60ed4cbb8364e returned PROCEED-WITH-CONDITIONS on repair 2 with exactly ONE residual defect (Finding 1). All other repairs are reviewed and accepted; do not refactor beyond this one fix.
The V2 form contract (@opencode/protocol form.d.ts) defines non-input field type "external" (a display URL with url/title/description). It takes NO answer and must never block completion of a form's real input fields. The current whitelist in service/host-client.ts throws UNSUPPORTED_FORM_FIELD for "external", making any form that contains an informational link unanswerable over voice. The reviewer also found answer-slot index alignment shifts when external fields are not skipped: answers must map to the form's real input fields in order, regardless of where external fields appear.
Rejected shortcuts and safety rules stand: no session caps, no issue-number heuristics, no guessed form keys, no fan-out re-optimization. No live host session/form/permission mutation, no real GitHub writes, no secrets in any output.
</context>
<scope>
Owned: service/host-client.ts, test/v2-ratelimit-repair.test.js, regenerated service/main.js, worktree run artifacts. Commit locally on the current branch. No other files, no root checkout edits, no branch switches, no push/PR/issue closure, no DB/service changes, no delegation.
</scope>
<criteria>
A regression test FAILS at current HEAD and PASSES after the fix, exercising the real production HostClient reply/normalize paths. npm run verify and npm run build pass with service/main.js parity and zero panel/main.js churn. Report file:line and red/green evidence. Fresh hostile review follows; no acceptance claim.
</criteria>
<constraints>
Minimal surgical change only. Do not add new form types beyond the protocol contract. External fields may be shown as informational content but must never be treated as answerable input. Do not disturb multiselect/integer/boolean/number/label-to-value handling already verified.
</constraints>
<steps>
<step>Red: write a failing test against real HostClient code — a form containing an "external" display field plus real input fields (e.g. one single-select and one integer) must be answerable; no UNSUPPORTED_FORM_FIELD may be thrown; the external field must not consume an answer slot; answers must align to input fields in order even when the external field sits between them.</step>
<step>Green: in service/host-client.ts, skip/filter fields with type "external" before answer-slot iteration in the reply path (and ensure pending-question normalization does not present them as answerable input). Parse and validate exactly as before for all other field types.</step>
<step>Run npm run verify and npm run build; confirm service/main.js parity and panel/main.js untouched. Save red/green logs to worktree run artifacts, commit once, and report.</step>
</steps>
<output>
STATUS; RESULT (file:line, what changed, red/green); CHANGED paths and commit; EVIDENCE commands/counts/exits; NOT VERIFIED; BLOCKERS; LEARNINGS. Nothing is accepted until fresh hostile review and human verdict.
</output>
