<env_preflight>
Fix round after independent hostile review ses_55a5f4030bdd1951c05d4251 (9router/engineer, HALT). Candidate 785684b tracked-clean; reviewer made no product edits. Worktree may contain untracked reviewer evidence under .agents/run/task-centred-architecture/outputs/ and verifications/issue-30-review/ — preserve it byte-identical, never commit it.
Repo /workspace/extensions/github-task-board
Worktree /workspace/extensions/github-task-board/.worktrees/team-dev-issue-30-work-type
Branch feat/issue-30-work-type; base c337901, current candidate 785684b. node_modules symlink exists; no installs, no env copy, no DB registration.
Scope files: panel/core.ts, panel/main.ts, panel/main.js, docs/issue-body-contract.md, test/issue-30-work-type.test.js. Nothing else.
No web/**, service/**, admission/refresh/answer/Done-guard/repository-selection changes; no real GitHub, installed extension, credentials, push, merge, closure, deployment, other worktrees, master.
Scratch /tmp/opencode. Tests: node --test test/issue-30-work-type.test.js; npm test; npm run typecheck; npm run build (commit the regenerated panel/main.js).
Preflight authoritative at dispatch; targeted checks before committing.
</env_preflight>
<goal>
Close the four blocking review findings with the smallest correct change and prove enforcement by testing generated prompt output, not source text.
</goal>
<context_files>
[@/workspace/extensions/github-task-board/.worktrees/team-dev-issue-30-work-type/.agents/run/task-centred-architecture/outputs/issue-30-hostile.md]
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/decisions-2026-10-24.md]
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/tasks/issue-30-work-type.md]
</context_files>
<scope>
1. Finding 1 — dead resolver. `resolveIssueWorkType` is exported and imported but never called. Wire it into the places where work instructions are actually composed: the preflight brief builder (`updatePreflightBrief`) and the per-issue batch launch path (`launchBatchSeparateSessions`). Behaviour: for a single issue, resolve its work type; if `bug` or `feature`, include only that path's instructions; if `undecided`, do not emit the generic prose as if the answer were known — emit the explicit alignment question (which label applies and why, based only on the labels) and the rule that independent work continues while that question is open. Batch of several issues: resolve per issue where the code composes per-issue text; if the flow composes one prompt for many issues, keep the neutral rule but state that undecided items must be asked about individually. Do not invent UI, modals or new state; prompt composition only. Remove any now-unused duplicate constant or make it the single source used by these paths.
2. Finding 2 — contradictory Work Log rule. State it once and unambiguously in every copy: the `### Work Log:` section is optional at issue creation; once work starts, the Work Log must contain exactly one sentence stating the work type and the concrete reason. Fix panel/core.ts (both prompt copies) and docs/issue-body-contract.md (lines around 17 and 47). No contradiction may remain between "optional" and "exactly one required sentence".
3. Finding 3 — scope creep. Remove the uncontracted `### Research & Alternatives` section and the `- [ ] Align on user decisions` subtask from the feature template; restore those template lines to their base text except for changes the brief already authorised (desired outcome wording, observed-versus-expected wording, reproduction wording). Keep the feature path's "research and alternatives, then user decisions" statement in the instructions, not in the template.
4. Finding 4 — mock-passing tests. Replace assertions that read `main.ts` or `core.ts` as text (`MAIN_TS.includes`, source-string checks) with assertions on actual generated output: call the prompt/brief builders with fixture issues and assert the returned string contains the required instruction and the right path, and does not contain the other path. Cover: bug-only, enhancement-only, both labels, neither label, and the Work Log sentence rule. Keep the existing structural checks that genuinely guard the contract (no `type:*` label, no body work-type field).
5. Mutation checks you must run and report: in a scratch copy, (a) make the resolver return 'bug' for both labels — the undecided test must fail; (b) remove the launch instructions — the launch test must fail; (c) remove the Work Log rule — the Work Log test must fail; (d) emit both paths for a bug — the path-isolation test must fail. Restore and confirm green.
6. Keep the diff minimal. No reformatting, no new abstraction layer, no change to label routing outside the audit-justified places. If wiring the resolver needs a small helper, keep it local and typed.
</scope>
<criteria>
All four findings closed and each proven by a test that fails when the behaviour is broken. No contradictory Work Log wording remains anywhere in the diff. Feature template returns to contracted scope. Full suite, typecheck and build green; bundle committed and hash reported. No change to admission, refresh, answer, Done guard or repository selection. Report claims precisely: what is enforced in code versus merely stated in prompt text.
</criteria>
<output>
At most 12 lines: what changed per finding, enforcement mechanism now in code, red/green/mutation results with commands and exits, test counts, bundle hash, residual duplication or drift risk, blind spots, actual provider/model. No self-approval; an independent recheck follows.
</output>
