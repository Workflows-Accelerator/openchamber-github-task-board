<env_preflight>
Repo: /workspace/code/openchamber-github-task-board
Worktree: /workspace/code/openchamber-github-task-board/.worktrees/team-dev-chamberos-board-v2
Branch: feat/chamberos-board-v2
Base commit: b88e198 (clean, verified by manager). Application code frozen at 59e5d05; manager verified `git diff --stat 59e5d05 b88e198 -- web/ scripts/` touches only scripts/generate-delivery-smoke.mjs.
Diff to review: 0d66b56..b88e198 (smoke script + A-delivery/{proof.md,human-review.md,smoke-negative.md} + A-delivery/fix4/**).
Artifact: /tmp/opencode/board-v2-staging/59e5d05-foundation/. Preview: http://127.0.0.1:4041, PIDs 486338/486368, synthetic GitHub only, password `correct horse battery staple`. Real Chromium: source .agents/run/chamberos-board-v2/verifications/A-delivery/hostile2/scripts/chromium-env.sh.
Tests: npm test; node --test --test-timeout=30000 web/tests/*.test.mjs; npm run typecheck; node scripts/generate-delivery-smoke.mjs (DELIVERY_DIR under /tmp/opencode only).
Do not touch: application source, any tracked evidence outside hostile4/, the staged bundle, /workspace/releases/board/**, /workspace/.openchamber-data/board/**, production :8787, live GitHub, root checkout manager state. Do NOT run Arrange on the :4041 preview (it persists positions the human reviewer will see) — use a throwaway server from the staged dir on another port. No push, merge, issue comment, service change, installation or deletion. Mutations ONLY in a task-owned copy under /tmp/opencode.
Preflight facts authoritative at dispatch: skip initial git status/pwd/ls discovery.
</env_preflight>
<goal>
Conduct a hostile review of any edits or changes that you made to figure out what you might have missed or what might be broken. Don't assume that what you did is right.
</goal>
<context_files>
[@/workspace/code/openchamber-github-task-board/.agents/run/chamberos-board-v2/tasks/A-delivery-fix4-brief.md]
[@/workspace/code/openchamber-github-task-board/.worktrees/team-dev-chamberos-board-v2/.agents/run/chamberos-board-v2/verifications/A-delivery/hostile3/report.md]
[@/workspace/code/openchamber-github-task-board/.worktrees/team-dev-chamberos-board-v2/.agents/run/chamberos-board-v2/verifications/A-delivery/proof.md]
[@/workspace/code/openchamber-github-task-board/.worktrees/team-dev-chamberos-board-v2/.agents/run/chamberos-board-v2/verifications/A-delivery/human-review.md]
[@/workspace/code/openchamber-github-task-board/.worktrees/team-dev-chamberos-board-v2/.agents/run/chamberos-board-v2/verifications/A-delivery/smoke-negative.md]
</context_files>
<skills>
[@/workspace/code/openchamber-config/.agents/skills/review/adversarial/doubt-driven-development/SKILL.md]
</skills>
<scope>
Fresh independent, TARGETED review of fix4 only (user decision D32: bounded verification-only fix). Review exactly: H3-1, H3-2, H3-3, guard mutation proof, Undo-visible FR recheck, and identity/freeze. Do NOT reopen resolved hostile3 items, HUD/gradient design, or deferred B-D features. Write and commit review evidence ONLY under .agents/run/chamberos-board-v2/verifications/A-delivery/hostile4/. If defects remain, report precise reproduction and stop without fixes. No extra workers.
</scope>
<criteria>
1. H3-1: read the new containment code (generate-delivery-smoke.mjs ~296-329, ~490-495). Confirm both axes are checked against the canvas viewport rect, verdicts are computed, and the failing control is named. Independently write YOUR OWN injections (not just rerun the builder's harness): above, below, and one partial vertical overflow (e.g. a control half below the viewport bottom by ~10px). Also try a control hidden via a different mechanism (e.g. `top`/`margin` instead of transform) to check the measurement is not transform-specific. Each must exit 1; baseline must exit 0 with 10/10 computed PASS. Check that the "visible" filter cannot be gamed to skip an offscreen control (e.g. a control that is offscreen but not display:none).
2. H3-2: grep all delivery docs for the password; every occurrence has spaces. Sign in to :4041 in real Chromium using exactly the documented string (read-only; no Arrange, no writes). Access-limit wording is accurate and does not imply external reachability.
3. H3-3: proof.md does not present audit-a5.mjs as asserted; asserting evidence cited separately; no other unasserted success claims remain in proof.md or human-review.md.
4. Mutation proof: independently re-create at least the three mutants for one guard (prefer ~1421) in your own /tmp/opencode copy and confirm each fails a named test; unmutated copy passes. Check the builder's mutation.md matches what you observe.
5. Undo-visible: on a throwaway server from the staged bundle, reproduce 360 FR and 1280 FR with "Undo arrange" visible; measure containment (both axes) and pairwise overlap. Note the 2px Arrange/Undo gap at 1280 — overlap or not, and whether it is visually acceptable in a screenshot you inspect.
6. Identity: `git diff 59e5d05 b88e198 -- web/` empty; staged `sha256sum -c --strict` 13/13 OK; preview :4041 healthy and not restarted (same PIDs); production symlink still 98261a8-20261103 (read-only). Rerun npm test, web tests, typecheck and report exact counts.
</criteria>
<output>
Commit a concise report at .agents/run/chamberos-board-v2/verifications/A-delivery/hostile4/report.md with per-item RESOLVED/OPEN and direct command/artifact proof, Spec PASS/FAIL, Quality APPROVED/NEEDS-FIXES and PROCEED/HALT. If PASS, also return a plain French five-item human click checklist (one per issue #56-#60) and exact preview access instructions, naming blockers to the user's access. NOT RUN at minimum: live GitHub writes, external preview access, live cutover, human tactile acceptance, real touch/Firefox/WebKit. Return commit SHA, report path, counts and findings. Approval means ready for human validation only, never permission to publish.
</output>
