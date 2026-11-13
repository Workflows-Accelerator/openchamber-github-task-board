<env_preflight>
Repo: /workspace/code/openchamber-github-task-board
Worktree: /workspace/code/openchamber-github-task-board/.worktrees/team-dev-board-v3
Branch: feat/board-v3
Base and HEAD: a6f61f3 (V4-2 LIVE, no V4-3 commit exists).
State after server restart: DIRTY, exactly 3 tracked files modified: web/public/app.js (+53/-1), web/server/app.ts (+23/-1), web/server/board.ts (+233); total 307 insertions/2 deletions. Treat these as inherited, unverified edits, not accepted work. Preserve all until you inspect them.
Only untracked directory: .agents/run/chamberos-board-v2/verifications/V4-1-L4/ — OFF LIMITS, never stage or modify. No V4-3 evidence directory exists yet.
Prior worker ses_3ea186555b74bd41ddaaeb58 is confirmed IDLE, last text "Now the i18n keys, in both dictionaries." Actual model verified 9router/genius. It made no commits, no test/evidence report, and no GitHub writes. There is no worker running this task in parallel.
Root checkout on ops/task-board-activation: never edit, commit or switch there.
Tests: npm test (618 baseline); node --test --test-timeout=60000 web/tests/*.test.mjs (672 baseline); npm run typecheck; esbuild client and web/server.ts; browser/framing probes; delivery smoke. Run sequentially.
Chromium setup: existing .agents/run/chamberos-board-v2/verifications/V4-2/scripts/browser-env.sh. Reuse it and copy probes to V4-3/ where needed so prior evidence stays immutable. Delivery smoke takes 5–6 minutes: use 900000 ms foreground timeout. Never finish with a job still running.
Forbidden: push, deployment, production mutation, /workspace/releases/**, /workspace/code/openchamber-config/**, /workspace/.openchamber-data/**, credentials, git remote -v, deleting files, additional workers, any GitHub write (including labels/comments/bodies).
Preflight facts are authoritative at dispatch: no initial pwd/status/ls rediscovery; inspect inherited diff and relevant source directly. Recheck git at checkpoint/pre-commit or after failure.
</env_preflight>
<goal>
Finish the approved V4-3 product policy by recovering the partial implementation, preserving completed V4-2, and returning committed code, tests and empirical evidence without any GitHub write.
</goal>
<context_files>
Read the complete approved specification at /workspace/code/openchamber-github-task-board/.agents/run/chamberos-board-v2/tasks/wave5a-v4-3-policy-in-product.md; its requirements, authoring_and_docs, scope and verification are binding. This recovery brief changes execution sequencing, not product scope.
Record progress in .agents/run/chamberos-board-v2/verifications/V4-3/README.md. Report the disposition of the inherited 3-file diff there.
</context_files>
<skills>
Load build and verify; use their narrower testing/review skills as relevant. Use design if needed for the already-approved artifact UI, not to reopen the product direction. No global configuration or skill-file edits.
</skills>
<scope>
Own exactly the paths allowed in wave5a-v4-3-policy-in-product.md: web/public/app.js, index.html, theme.css; web/server/board.ts, app.ts, github.ts; web/tests/**; docs/issue-body-contract.md; panel/core.ts and panel/main.js prompt strings only; scripts/generate-delivery-smoke.mjs only for genuinely new smoke coverage; verifications/V4-3/**.
Read-only: arrange.js, markdown.js internals, all prior evidence, panel outside prompt text, service, root run state. No dependency/lockfile changes.
</scope>
<steps>
1. Read the inherited diff in full and compare it to the approved spec. For each file state kept/fixed/discarded with reasons. The diff added parseHumanReview, payload fields and some client/enforcement plumbing; none is tested. Do not rebuild it from zero and do not assume it is right.
2. Finish the smallest coherent policy slice: parser/types/payload and server guard, with focused tests. Commit a truthful checkpoint once its focused tests are green; it is still local/unreviewed and may not be deployed. Do not leave 300 more lines uncommitted while building the whole UI.
3. Finish artifact actions, inline image, one-line instruction, legacy missing/malformed reason, agent-review vs human-decision presentation, V4-2 preset renderer reuse, equal EN/FR keys, and style within CSP. Commit with focused client tests green.
4. Finish contract documentation and both authoring prompt strings, including panel/main.js shipped parity. Add a test extracting the doc's fenced example through the real parser, plus a mutation that must fail then restore byte-identically. Avoid repeating V4-2's inert-feature documentation gap.
5. Run all approved checks sequentially. Preserve failures and distinguish actual regression from resource-related timeout, with evidence. New policy tests may require fixture bodies to contain genuine valid review artifacts, but never weaken assertions or silently permit legacy states through the server guard to get green. Record explicitly any existing tests/fixtures adjusted to the new approved policy.
6. Conduct a hostile review of any edits or changes that you made to figure out what you might have missed or what might be broken. Don't assume that what you did is right. Cover every status-entry path, not only the label endpoint: creation, move/reopen, preset answer consequences, multi-repo routes, and non-user-facing sources of waiting state. Check malformed/duplicate section fields, code-fenced headings, URL safety, precise i18n refusal messages, and the legacy presentation. Fix proven defects with tests; report a genuine product fork instead of guessing.
7. Commit source and tests in bounded coherent checkpoints, evidence separately. Leave the tracked tree clean; only untouched V4-1-L4/ may remain untracked. Write the final report on disk before ending. No background work promised after your final answer.
</steps>
<criteria>
All original wave5a requirements are implemented; server rejects unsupported human gates with precise 4xx and accepts valid artifacts; client distinguishes agent review from human decision and explains legacy invalid gates; docs and both prompts teach the format with a real doc-parser lock; image/video/link/preset/legacy cases proven in Chromium at the approved widths/themes/languages; V4-2 note/Decisions and D37/D38/D39 regressions stay green; raw logs/counts/screenshots exist under V4-3/; local commits clean; zero real writes or deployment.
</criteria>
<signals>
Scope high (several layers), ambiguity bounded by approved original spec, sensitivity high (status gate), reversibility local commits only. One recovery after an interrupted highest-tier worker; do not repeat an identical unfinished run.
</signals>
<output>
Return raw Markdown, maximum 15 lines: STATUS PASS/FAIL/BLOCKED; COMMITS; INHERITED_DIFF disposition; POLICY anchors; UI; DOC_LOCK; SELF_HOSTILE findings; TEST_COUNTS with exit codes; EVIDENCE path; NOT_VERIFIED. No claim of live, closure, reclassification or human acceptance.
</output>
