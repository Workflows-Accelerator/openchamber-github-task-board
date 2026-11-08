<env_preflight>
Repo: /workspace/code/openchamber-github-task-board
Worktree: /workspace/code/openchamber-github-task-board/.worktrees/team-dev-chamberos-board-v2
Branch: feat/chamberos-board-v2
Base commit: 0d66b56 (clean). Last application code commit 59e5d05 — FROZEN.
Files in scope (edit): scripts/generate-delivery-smoke.mjs; .agents/run/chamberos-board-v2/verifications/A-delivery/{proof.md,human-review.md,smoke-negative.md}; new files under .agents/run/chamberos-board-v2/verifications/A-delivery/fix4/.
Read-only evidence: A-delivery/hostile/, hostile2/, hostile3/, screenshots/, canvas-measurements.json, live-switch.md.
Real Chromium: source .agents/run/chamberos-board-v2/verifications/A-delivery/hostile2/scripts/chromium-env.sh (no root). Use it for every browser check.
Hostile3 harness to reuse: .agents/run/chamberos-board-v2/verifications/A-delivery/hostile3/scripts/smoke-challenges.mjs (copy into fix4/ if you need to extend it; do not edit the hostile3 original).
Test commands: npm test; node --test --test-timeout=30000 web/tests/*.test.mjs; npm run typecheck; node scripts/generate-delivery-smoke.mjs (under chromium-env, with DELIVERY_DIR pointing under /tmp/opencode so tracked screenshots are not rewritten).
Preview: http://127.0.0.1:4041 (PIDs 486338/486368) on /tmp/opencode/board-v2-staging/59e5d05-foundation — leave running, do not restart.
Do not touch: web/public/**, web/server/**, web/server.ts, web/tests/** (except reading), web/public/app.js:2268 gradient, /tmp/opencode/board-v2-staging/59e5d05-foundation/**, /workspace/releases/board/**, /workspace/.openchamber-data/board/**, production :8787, live GitHub, root checkout manager state. No push, merge, issue comment, closure, deletion.
Preflight facts are authoritative at dispatch: skip initial git status/pwd/ls discovery.
</env_preflight>
<goal>
Close the three verification defects found by hostile review 3 and run the two checks it left unfinished, without touching the board application, so the A1–A5 evidence is honest and complete for human validation (user decision D32).
</goal>
<context_files>
[@/workspace/code/openchamber-github-task-board/.worktrees/team-dev-chamberos-board-v2/.agents/run/chamberos-board-v2/verifications/A-delivery/hostile3/report.md]
[@/workspace/code/openchamber-github-task-board/.worktrees/team-dev-chamberos-board-v2/.agents/run/chamberos-board-v2/verifications/A-delivery/proof.md]
[@/workspace/code/openchamber-github-task-board/.agents/run/chamberos-board-v2/verifications/recovery-direction.md]
</context_files>
<skills>
[@/workspace/code/openchamber-config/.agents/skills/build/refactoring/surgical-patch/SKILL.md]
[@/workspace/code/openchamber-config/.agents/skills/review/adversarial/doubt-driven-development/SKILL.md]
</skills>
<scope>
1. H3-1 — scripts/generate-delivery-smoke.mjs (~268-270, 293-309): containment must check BOTH axes. Every visible HUD control must satisfy left>=vp.left, right<=vp.right, top>=vp.top, bottom<=vp.bottom against the canvas viewport rect (not just window), with the failing control and its rect printed. Keep the existing horizontal and pairwise-overlap checks. Verdicts stay computed, never literal.
   Prove it in real Chromium on disposable copies: (a) baseline exits 0 with all computed PASS; (b) translateY(-2000px) on #canvas-arrange (above) exits 1 with FAIL naming that control; (c) translateY(+2000px) (below) exits 1; (d) re-run hostile3's seven earlier injections and confirm each still exits 1. Record command, exit code, failing record, and the injected rect for each in smoke-negative.md and fix4/ raw logs.
2. H3-2 — human-review.md: password is `correct horse battery staple` (spaces; source web/tests/helpers.mjs:9). Fix every occurrence. State the access limit honestly: preview binds only to container loopback 127.0.0.1:4041; external access needs port forwarding to a host sharing that network namespace or a user-approved ingress — neither verified. board.workflows.ac is production, not this preview.
3. H3-3 — proof.md: relabel scripts/audit-a5.mjs as an observational trace probe (58 trace records, no assertions, no verdicts). Cite the asserted real-Chromium smoke result (from this run) separately as the asserting evidence. Do not refactor audit-a5.mjs.
4. Guard-clause mutation proof (unfinished by hostile3): in a disposable copy under /tmp/opencode/fix4-mutation/ (git worktree add --detach is NOT allowed; use `git archive 59e5d05` extraction or cp -r of tracked files, with node_modules symlinked), mutate web/server/app.ts guards at ~1332 and ~1421 one clause at a time: (i) drop `discovery.repositories.some((r) => r.available)`; (ii) drop `(board.repositoriesLoaded ?? 0) === 0`; (iii) invert to `!==`. For each mutant run the relevant web test file and record that at least one test fails (name + exit code). Also run the unmutated copy: all pass. Record in fix4/mutation.md. Never edit the real worktree's app.ts.
5. Undo-visible recheck (unfinished by hostile3): in real Chromium against the frozen staged bundle (the running preview :4041 or a fresh throwaway server from the staged dir on another port), trigger Arrange so "Undo arrange" is visible, then measure all HUD controls at 360 FR and 1280 FR (light at least; dark too if cheap): containment on both axes and zero pairwise overlap. Save screenshots + JSON under fix4/. If a real overlap or overflow exists, DO NOT fix the app — stop, record it, and report it as a product finding.
6. Run npm test, web tests, typecheck; confirm counts unchanged (618/618, 575/575, 0). Confirm `git diff 59e5d05 -- web/` is empty and staged checksums still `sha256sum -c --strict` OK. Confirm tracked evidence outside the files you edited is byte-identical (git status shows only intended paths). Commit once: tooling + docs + fix4 evidence.
</scope>
<criteria>
- Above- and below-viewport injections each exit 1 with a FAIL naming the control; baseline exits 0; the seven earlier injections still exit 1.
- No literal 'PASS' added; verdict logic computed.
- human-review.md password has spaces everywhere; access limit stated plainly.
- proof.md no longer calls audit-a5.mjs an asserted pass; asserting evidence cited separately.
- Each of the three guard mutants fails at least one named test; unmutated copy passes.
- 360 FR and 1280 FR with Undo arrange visible: measured containment (both axes) and zero overlap, or an honest product finding.
- web/ unchanged since 59e5d05; staged bundle untouched; preview not restarted; production symlink still 98261a8-20261103.
</criteria>
<output>
Concise report: commit SHA; per item 1–6 what changed (file:line) and the exact evidence path; each negative injection with exit code; each mutant with failing test name; Undo recheck measurements summary; suite counts; `git diff 59e5d05 -- web/` result; checksum result; NOT VERIFIED list (live GitHub writes, external preview access, live cutover, real touch, Firefox/WebKit, human acceptance at minimum). Include a DIDN'T WORK / FINALLY WORKED note if anything needed retries.
</output>
