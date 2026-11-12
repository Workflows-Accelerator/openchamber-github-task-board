<env_preflight>
Repo: /workspace/code/openchamber-github-task-board
Worktree: /workspace/code/openchamber-github-task-board/.worktrees/team-dev-board-v3
Branch: feat/board-v3
Reviewed delta: a7867e8..1d9f237 (88d66d1 feat, 1d9f237 evidence). The full V4-2 was already reviewed at a7867e8 in verifications/V4-2-L4/README.md.
Tree: tracked clean. Untracked and OFF LIMITS: .agents/run/chamberos-board-v2/verifications/V4-1-L4/ — never stage, never touch.
Root checkout on ops/task-board-activation: DO NOT modify, switch or commit there.
Suites SEQUENTIALLY; delivery smoke needs a 900000 ms tool timeout; Chromium only through the env script already under verifications/V4-2/scripts/.
Constraints: no push, no deploy, no /workspace/releases, no /workspace/code/openchamber-config, no /workspace/.openchamber-data, no real GitHub mutation, no credential output, no `git remote -v`, no deletion, no application edits.
</env_preflight>

<goal>
Decide whether the one blocking finding of the V4-2 review is actually closed, and whether V4-2 may now be published. You did not write this correction. Judge it.
</goal>

<prior_verdict>
The reviewer at a7867e8 wrote: SPEC PASS, QUALITY CHANGES REQUIRED, PUBLISH NO as-is / YES after H1. H1: the `  - label :: gist :: details` convention existed only as a comment in web/server/board.ts, absent from docs/issue-body-contract.md §2.5 and from the panel authoring prompts, so the feature would stay inert. It also asked for the contract's "self-contained prose" rule to be reconciled.
</prior_verdict>

<what_the_author_claims>
- `web/tests/issue-body-contract.test.mjs` extracts the fenced §2.5 example from the document at test time, parses it with `parseWebOpenQuestions`, deep-equals both options, and locks the 8-option / 120-character caps, so changing the document without the code fails.
- Two prompts name the convention (`DEFAULT_AI_ISSUE_PROMPT`, `DEFAULT_AI_ALIGNMENT_PROMPT`), both keep the free-text answer requirement; the shipped `panel/main.js` carries the same two strings and `shipped-parity` passes 18/18.
- Copy: a 410 now says the conversation is unavailable (issues disabled, deleted or transferred) and asks to reload; the 4,000-character cap is attributed to the board, not GitHub.
- Counts: npm test 618/618, web 672/672, typecheck, esbuild, browser 12/48, smoke 14/14 in 336 s.
</what_the_author_claims>

<what_to_check>
1. Read `git diff a7867e8..1d9f237` yourself. Confirm the change set is bounded to the document, the two prompt constants, the shipped panel strings, the two copy strings and the tests, and that the parser's accepted syntax did not change.
2. Judge the test as a real lock: read it, run it, then mutate the document in a scratch way (for example change `::` to `:` in the fenced example, or the cap to 9) and confirm the test fails for the right reason; restore the file exactly (`git checkout -- <path>`) and confirm the tree is clean again.
3. Read §2.5 as a person writing an issue would. Is the syntax unambiguous, complete, and reconciled with the "self-contained prose" rule? Would an author following it produce a question that still reads as plain prose with the options stripped? Would the free-text path remain obvious? Quote anything that would mislead.
4. Check the two prompts: do they name the exact delimiter, the caps, and the free-text requirement, without contradicting the rest of the prompt? Do they stay within a sane length?
5. Check the two corrected messages in EN and FR: true in each case, actionable, equal dictionary sizes.
6. Re-run sequentially: `npm test`, the web suite, typecheck, esbuild, browser probe, delivery smoke. Report real counts and exit codes. Spot-check one rendered screen from the browser probe to confirm the copy change did not break layout at 360.
7. Confirm nothing in D37/D38/D39 or the V4-2 non-regression set moved.
</what_to_check>

<verdict>
- H1: CLOSED or STILL OPEN, with the evidence.
- SPEC: PASS or FAIL for the whole increment d1eef33..1d9f237.
- QUALITY: APPROVED or CHANGES REQUIRED.
- PUBLISH: YES or NO, with the exact caveats to tell the user before it goes live, including anything about how the panel prompt reaches agents in practice.
Write your evidence under .agents/run/chamberos-board-v2/verifications/V4-2-L4-delta/ and commit it there. Do not fix application code. Do not push.
</verdict>
