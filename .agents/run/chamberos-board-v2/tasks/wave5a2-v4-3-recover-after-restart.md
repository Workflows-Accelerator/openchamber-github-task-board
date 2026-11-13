<env_preflight>
Repo: /workspace/code/openchamber-github-task-board
Worktree: /workspace/code/openchamber-github-task-board/.worktrees/team-dev-board-v3
Branch: feat/board-v3
Base and HEAD: a6f61f3; V4-2 already LIVE as e604b9e-20261112. DO NOT repeat or republish V4-2.
Dirty inherited files: web/public/app.js (+53/-1), web/server/app.ts (+23/-1), web/server/board.ts (+233). Total 307 insertions, 2 deletions. No new tests, no V4-3 evidence directory, no V4-3 commit exists.
Untracked and OFF LIMITS: .agents/run/chamberos-board-v2/verifications/V4-1-L4/ (preserve exactly, never stage).
The previous worker ses_3ea186555b74bd41ddaaeb58 stopped midway after saying "Now the i18n keys, in both dictionaries." Session confirmed idle and explicitly stopped via delegate before this dispatch; you are the sole writer. Real model was 9router/genius.
Root checkout remains ops/task-board-activation; never edit, switch or commit there.
Browser env exists at .agents/run/chamberos-board-v2/verifications/V4-2/scripts/browser-env.sh. Use it without new system packages; Node version is not assumed, record the actual runtime in evidence.
Suites strictly sequential. Smoke needs foreground timeout 900000 ms; never finish your turn with a job still running.
Preflight is authoritative at startup: no pwd/ls/status rediscovery; targeted diff/source/test inspection is required, and git checks are allowed before commits or after unexpected failures.
</env_preflight>
<goal>
Recover the existing V4-3 partial implementation and finish the approved code-only human-validation rule with tests and proof, without repeating completed V4-2 work or changing GitHub.
</goal>
<context_files>
Read the complete approved spec at /workspace/code/openchamber-github-task-board/.agents/run/chamberos-board-v2/tasks/wave5a-v4-3-policy-in-product.md.
Read the inherited git diff in all three files before editing: none of those lines has been verified or accepted.
The partial board.ts adds HumanReviewKind/State/Reason/View, parseHumanReview and a Human Review heading convention, and exposes humanReview on list/detail. The partial app.ts adds transition enforcement; app.js has only partial UI changes. These are untrusted starting points, not approved implementation choices.
D33 permits release after independent review, but this brief forbids deployment and GitHub mutation. D40 authorizes a future, separate deterministic label/comment reclassification; do not perform it here.
</context_files>
<skills>
Load build and verify for their relevant sub-skills. Use xml-briefs if you need to structure the final report. Do not load or modify global configuration skills on disk.
</skills>
<scope>
Owned: web/public/app.js, web/public/index.html, web/public/theme.css, web/server/board.ts, web/server/app.ts, web/server/github.ts, web/tests/**, docs/issue-body-contract.md, the two authoring prompt constants in panel/core.ts and their exact shipped panel/main.js strings, scripts/generate-delivery-smoke.mjs only for new surfaces, new evidence .agents/run/chamberos-board-v2/verifications/V4-3/**.
Read-only: web/public/arrange.js, web/public/markdown.js internals, other panel logic, service/**, all prior evidence directories (copy probes into V4-3 before running them so historical evidence is not dirtied).
No push, deploy, real GitHub writes, file deletion, environment/config changes, /workspace/releases/**, /workspace/.openchamber-data/**, /workspace/code/openchamber-config/**, secret output or git remote -v. No delegation. No new dependency. Do not drop an inherited hunk without reviewing and recording why.
</scope>
<steps>
1. Review the three inherited diffs and classify kept/fixed/replaced. Determine precisely which approved requirements are still missing. Capture that in V4-3/README.md before adding more work.
2. Finish the policy described in the original spec: human queue requires clickable image/video/link plus one-line instruction or a question using the existing preset+free-text shape; missing/malformed legacy artifacts get a precise visible reason instead of a silent human wait; in-review means agent review, without new status labels unless unavoidable.
3. Audit every board-controlled transition into needs-human, not only one route. Prove 4xx with no GitHub write when no valid artifact, and acceptance for valid artifacts. Reuse existing contracts and no duplicate storage.
4. Finish the UI, EN/FR dictionaries, styles, contract documentation, both authoring prompts and shipped parity. Lock the documented example to the real parser using a test that actually fails under a reversible document mutation; restore byte-identically.
5. Add focused tests BEFORE filling the rest; retain source/tests in small coherent local commits after each verified checkpoint so a restart does not strand an hour of uncommitted work. Evidence is a separate final commit. Do not stage V4-1-L4/ or use git add .
6. Run focused tests, then suites sequentially, then the new real Chromium probes, V4-2 regression probes and delivery smoke. Store each exit code and count, including failures. Do not weaken assertions, skip tests or loop until green. Separate load timeouts from assertion failures.
7. Conduct a hostile review of any edits or changes that you made to figure out what you might have missed or what might be broken. Don't assume that what you did is right. Fix evidenced defects with tests and record every finding.
8. Write final V4-3/README.md and a concise recovery report there. Leave tracked tree clean, except preserved untracked V4-1-L4/. Report completed commits and remaining blind spots, never claim live or human acceptance.
</steps>
<criteria>
All requirements and invariants of wave5a-v4-3-policy-in-product.md satisfied, with no real GitHub mutation.
Valid artifacts render with one clear action, malformed/missing ones cannot enter the human queue through board routes, and agent review is visibly distinct.
Docs, prompt constants and shipped prompt strings agree with parser; free-text fallback remains.
V4-2 note/comment flow, Markdown Decisions, D37/D38/D39 framing, filters, Arrange+Undo, drag persistence, CSP and dot grid remain intact.
No test count drops below baseline: panel 618, web 672. Report any additions and actual counts.
</criteria>
<verification>
Sequential: npm test
node --test --test-timeout=60000 web/tests/*.test.mjs
npm run typecheck
esbuild for web/server.ts and client (use the repository's existing command/entry; do not ship stale web/dist/server.mjs).
Chromium at 360x800, 390x844, 1280x900, light/dark, EN/FR: image/video/link/preset-question, missing-artifact legacy state and agent review. Zero unexpected console errors or CSP violations.
Copy existing V4-2 browser and framing probes to V4-3 at the same depth; run copies without modifying prior evidence. Then DELIVERY_DIR pointing into V4-3 node scripts/generate-delivery-smoke.mjs with 900000 ms foreground timeout.
</verification>
<signals>
Scope high; ambiguity bounded by approved spec; sensitivity high (changes who is asked to act); reversibility local commits only, no external writes.
If a genuine user-facing fork or new capability wall appears, stop with the exact question instead of silently choosing or bypassing permissions.
</signals>
<output>
Return raw Markdown, at most 15 lines: STATUS (PASS/FAIL/BLOCKED), COMMITS, INHERITED_DIFF disposition, POLICY routes and file:line, UI states, DOC_LOCK and mutation proof, TEST_COUNTS and exit codes, HOSTILE findings, EVIDENCE path, NOT_VERIFIED. Every long-running job must have ended before the return.
</output>
