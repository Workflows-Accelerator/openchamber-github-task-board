<env_preflight>
Repo: /workspace/code/openchamber-github-task-board
Worktree: /workspace/code/openchamber-github-task-board/.worktrees/team-dev-chamberos-board-v2
Branch: feat/chamberos-board-v2 at b88e198. Only untracked path: .agents/run/chamberos-board-v2/verifications/A-delivery/hostile4/ (partial evidence from a previous reviewer session that ended before finishing — reuse it, do not delete it).
Real Chromium: source .agents/run/chamberos-board-v2/verifications/A-delivery/hostile2/scripts/chromium-env.sh.
Preview :4041 PIDs 486338/486368 (do not restart, no Arrange/writes on it). Staged bundle /tmp/opencode/board-v2-staging/59e5d05-foundation/ (read-only).
Do not touch: application source, tracked evidence outside hostile4/, staged bundle, /workspace/releases/board/**, /workspace/.openchamber-data/board/**, production :8787, live GitHub, root checkout manager state. No push, merge, comment, service change, install, deletion.
IMPORTANT: run long commands in the FOREGROUND with an explicit long timeout (e.g. 900000 ms). Do NOT background a job and then end your turn waiting for it — the previous session died that way.
Preflight facts authoritative: skip discovery.
</env_preflight>
<goal>
Conduct a hostile review of any edits or changes that you made to figure out what you might have missed or what might be broken. Don't assume that what you did is right. Concretely: finish the targeted hostile review 4 of fix4 (b88e198) and write its verdict.
</goal>
<context_files>
[@/workspace/code/openchamber-github-task-board/.agents/run/chamberos-board-v2/tasks/A-delivery-fix4-hostile.md]
[@/workspace/code/openchamber-github-task-board/.agents/run/chamberos-board-v2/tasks/A-delivery-fix4-brief.md]
</context_files>
<skills>
[@/workspace/code/openchamber-config/.agents/skills/review/adversarial/doubt-driven-development/SKILL.md]
</skills>
<scope>
Already recorded in hostile4/raw/ (verify briefly by reading, do not rerun unless the log looks wrong): containment-harness.log (baseline exit 0 10/10; relTopAbove, relTopBelow, partialBelowVp, partialAboveVpInWindow, marginTopAbove, fixedBelow, hudContainerAbove all exit 1), smoke-opacityZeroBelow.log (FAIL observed), mutation/exits.txt (base 0, three m1421 mutants exit 1 — confirm the named failing tests in the logs and compare with fix4/mutation.md), signin-documented.log (documented password signs in, pass), undo-visible.log (360/1280 FR light/dark pass, 1280 gap 2px), npm-test.log 618/618, web-test.log 575/575, exits.txt typecheck 0.
Still to do:
1. Run the remaining injections from hostile4/scripts/containment-challenges.mjs: visibilityHiddenBelow, tinyScaleBelow, displayNoneReference (and opacityZeroBelow's exit code if not recorded). Edit the script only to select the remaining variants if needed. Decide and state whether visibility:hidden / display:none being skipped is acceptable (a hidden control is not a user-visible overflow) or a gap.
2. Inspect hostile4/screenshots/hud-crop-1280-*-fr.png and undo-visible-1280-*-fr.png: is the 2px Arrange/Undo gap visually acceptable? Report, do not fix.
3. H3-2/H3-3 doc checks: grep delivery docs (proof.md, human-review.md, live-switch.md, smoke-negative.md) for hyphenated password and for unasserted success claims ("ALL PASS" etc.).
4. Identity: `git diff 59e5d05 b88e198 -- web/` empty; `sha256sum -c --strict checksums.sha256` in the staged dir 13/13; :4041 /health 200 and PIDs unchanged; `readlink /workspace/releases/board/current` = 98261a8-20261103 (read-only).
5. Write hostile4/report.md (per item RESOLVED/OPEN with artifact paths, Spec PASS/FAIL, Quality APPROVED/NEEDS-FIXES, PROCEED/HALT) and commit ONLY hostile4/.
</scope>
<criteria>
Same as A-delivery-fix4-hostile.md criteria 1-6. If defects remain, report precise reproduction and stop without fixes. No extra workers.
</criteria>
<output>
Commit SHA, report path, verdict, findings. If PASS, also a plain French five-item human click checklist (one per issue #56-#60) and exact preview access instructions naming blockers. NOT RUN list at minimum: live GitHub writes, external preview access, live cutover, human tactile acceptance, real touch/Firefox/WebKit. Approval means ready for human validation only, never permission to publish.
</output>
