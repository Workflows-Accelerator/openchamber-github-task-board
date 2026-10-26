<env_preflight>
Builder ses_bfefbb62a52f5fbaf5a3af15 finished at 785684b; tracked-clean, no active builder. This reviewer is independent and must not trust the builder's summary.
Repo /workspace/extensions/github-task-board
Worktree /workspace/extensions/github-task-board/.worktrees/team-dev-issue-30-work-type
Branch feat/issue-30-work-type; base c337901a81d5eca08ea39372ed49a3e55be0b79e, candidate 785684b. Product/test diff from base read-only. node_modules symlink to installed root dependencies exists; no installs.
Own only .agents/run/task-centred-architecture/outputs/issue-30-hostile.md and verifications/issue-30-review/** in this worktree; leave them untracked or commit only inside your own evidence paths if the repository convention allows. Never modify candidate product, tests, docs or generated bundle.
Commands: node --test test/issue-30-work-type.test.js; npm test; npm run typecheck; npm run build (fresh bundle in a scratch copy only; compare hashes, do not overwrite panel/main.js in the candidate tree); targeted node --test test/*.test.js.
Scratch /tmp/opencode. No real GitHub writes, no installed extension, no credentials, no push/merge/close/deploy, no other worktree.
Preflight authoritative at dispatch; targeted checks only where a claim needs evidence.
</env_preflight>
<goal>
Independently decide whether issue #30's work-type and proportionate-path contract is complete, unambiguous, non-duplicative and actually enforced, before it can be considered for the review batch.
</goal>
<context_files>
Issue: https://github.com/Workflows-Accelerator/openchamber-github-task-board/issues/30 (read-only; gh issue view, never edit or close).
Decision4 in /workspace/extensions/github-task-board/.agents/run/task-centred-architecture/decisions-2026-10-24.md: existing `bug`/`enhancement` labels are the single source of work type, plus one justification sentence in the Work Log. No body field, no `type:*` label.
Builder claims, not evidence: audit says label work type partly existed at panel/core.ts:1719, Work Log sentence missing at docs/issue-body-contract.md:46, proportionate paths missing at panel/core.ts:1846 and 2262. Changed docs/issue-body-contract.md, panel/core.ts, panel/main.ts, panel/main.js, test/issue-30-work-type.test.js at 785684b. Slice tests 7/7, full suite 524/524, typecheck pass, bundle abbda09d… . Red-before claimed on base c337901. Blind spots claimed: no live GitHub label mutation; human reply to the undecided prompt depends on runtime interaction.
</context_files>
<skills>
[@/workspace/config/opencode/.agents/skills/review/adversarial/doubt-driven-development/SKILL.md]
[@/workspace/config/opencode/.agents/skills/communication/terse/caveman-lite/SKILL.md]
</skills>
<scope>
Conduct a hostile review of the change to find what the builder missed. FIX NOTHING.
1. Run the slice tests yourself, then the full suite and typecheck. Verify the claimed red-before state independently: copy the candidate to /tmp/opencode, revert only the product/doc changes, and confirm the new tests fail for the intended reason, not a missing import or syntax error. Report the exact failing assertions.
2. Enforcement, not prose. `resolveIssueWorkType` is exported and imported in panel/main.ts — find every call site. If it is never called, that is a finding: a resolver nobody uses enforces nothing. Decide whether the contract is actually enforced at the point where work instructions are generated, or whether the slice only adds text.
3. Single source of truth. The same work-type/proportionate-path text now appears in DEFAULT_WORK_INSTRUCTIONS, the AI issue prompt, the consolidated issue prompt, and docs/issue-body-contract.md. Judge whether that duplication will drift, whether any copy contradicts another, and specifically check the contradiction between "Optional ### Work Log:" and "exactly one required sentence". Name which copy wins and what an agent reading it would do.
4. Decision4 fidelity. Confirm the change never introduces a `type:*` label, a body work-type field, a counter or machine state. Confirm the bug/feature decision is derived only from the two labels and that both-or-neither is undecided, asked, and never guessed from title, tone or code area. Check case, whitespace and object-vs-string label shapes.
5. Scope. The feature template gained "Research & Alternatives" and an "Align on user decisions" subtask beyond the brief's "state briefly". Judge whether that is justified by decision4 or scope creep, and whether the bug template change is behavioural or cosmetic. Flag anything else outside the brief.
6. Existing behaviour. Diff the prompt inputs to launch, batch and consolidated flows: confirm no other instruction text was lost or reordered, no admission/refresh/answer/Done-guard code touched, and the generated bundle matches a fresh build from the changed sources. Report the two hashes if they differ.
7. Tests that could pass while broken. Check the new tests assert content that would matter to a model reading the prompt, not just substring presence of a phrase that also appears elsewhere. Break the resolver (e.g. return 'bug' for both labels) and the Work Log sentence in a scratch copy and show which tests fail.
8. Expiry boundary. Confirm nothing in the diff schedules, deletes, closes or auto-expires bug work, and that the undecided meaning of expiry remains documented as an open owner question rather than resolved by implication.
</scope>
<criteria>
Security APPROVED/NEEDS-FIXES (prompt-injection or credential surface only if the diff creates one), Spec PASS/PARTIAL/FAIL against the issue and decision4, Quality APPROVED/NEEDS-FIXES, machine PROCEED/HALT. Blocking: dead resolver with no enforcement, contradictory required/optional Work Log instruction, reintroduced second source of work type, bundle/source mismatch, scope beyond the brief that changes behaviour, or tests that pass with the core guard broken.
</criteria>
<output>
At most 12 lines: verdicts, ranked findings with file:line and the minimal fix, independent red/green and mutation results, bundle hash comparison, what is enforced versus merely stated, residual risks, report path, actual provider/model. No approval to merge, deploy or close.
</output>
