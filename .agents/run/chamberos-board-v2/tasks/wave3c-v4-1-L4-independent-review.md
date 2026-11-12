<env_preflight>
Repo: /workspace/code/openchamber-github-task-board
Worktree: /workspace/code/openchamber-github-task-board/.worktrees/team-dev-board-v3
Branch: feat/board-v3
Base commit: 28af19b is the last published commit on master. Review range: 28af19b..6535937 on branch feat/board-v3 (V4-1 build, its self-review fixes, and V4-1b framing), tree clean at dispatch.
Root checkout: /workspace/code/openchamber-github-task-board on ops/task-board-activation — read only, never commit there
Real Chromium launcher: .agents/run/chamberos-board-v2/verifications/A-delivery/hostile2/scripts/chromium-env.sh
Test commands (SEQUENTIAL, never parallel): npm test; node --test --test-timeout=30000 web/tests/*.test.mjs; npm run typecheck; npx esbuild web/server.ts --bundle --platform=node --format=esm --target=node20 --packages=external --outfile=/tmp/opencode/l4-server-check.mjs; node scripts/generate-delivery-smoke.mjs
Hard limits: no push, no deploy, no /workspace/releases/board, no /workspace/code/openchamber-config, no gh, no issue or PR changes, no branch switch in the root checkout. You may write ONLY under .agents/run/chamberos-board-v2/verifications/V4-1-L4/ and you may make local fix commits on feat/board-v3 if and only if you find a defect that must be fixed to give a verdict.
</env_preflight>
<goal>
Give two independent verdicts on the whole V4-1 + V4-1b increment (28af19b..HEAD): Spec PASS/FAIL against the user's feedback round, and Quality APPROVED/CHANGES REQUESTED, with empirical evidence rather than the builders' claims.
</goal>
<role>
You did not write this code. Treat every claim in the builders' reports as unproven until you reproduce it. The builders already ran a self-review; assume it missed the defects that matter. Your job is to find what a phone user would hit.
</role>
<context_files>
[@.agents/run/chamberos-board-v2/feedback-2026-11-11-v3-live.md]
[@.agents/run/chamberos-board-v2/decisions.md]
[@.agents/run/chamberos-board-v2/verifications/V4-1/design-plan.md]
[@.agents/run/chamberos-board-v2/verifications/V4-1-manager-screenshot-review.md]
[@.agents/run/chamberos-board-v2/tasks/wave3-v4-1-sheets-filters-dependencies.md]
[@.agents/run/chamberos-board-v2/tasks/wave3b-v4-1b-dependency-framing.md]
</context_files>
<skills>
[@.agents/skills/review/doubt-driven-development/SKILL.md]
[@.agents/skills/review/code-review-and-quality/SKILL.md]
[@.agents/skills/review/web-performance-audit/SKILL.md]
[@.agents/skills/ui/frontend-design/SKILL.md]
[@.agents/skills/ui/web-design-guidelines/SKILL.md]
</skills>
<attack_surface>
Reproduce from a real browser at 360, 390, 768 and 1280, light and dark, fr and en:
1. Every sheet opens, closes by button, Escape and backdrop; focus enters, wraps both ways, returns to the trigger; no scroll bleed behind; footer never clipped; two sheets never leave the page unlocked or the body class stale.
2. Dependency focus frames selected + blockers + dependents and restores the previous viewport on exit; edge labels fully inside the viewport, off card bodies, in both languages; zoom limits respected; reduced motion honoured.
3. Applying and removing filters frames the matching tasks; the filter count matches the number of rendered cards after every change; cleared filters restore the previous view.
4. Phone navigation: sidebar opens and closes by real clicks at 360/390 with and without a persisted collapsed preference; nothing overlays the hamburger.
5. Canvas invariants: drag persists after reload against the fake GitHub; status change persists; Arrange + Undo restores exact positions; sticky notes still render under the card; the dot grid is byte-identical to 28af19b.
6. Wording: zero "Atelier", zero "n8n", zero "mobile", zero emoji-range code points (use the repo's own regexes), no button with both a + icon and "+" text, no inline style attribute, CSP not relaxed.
7. Regression risk: refresh order, re-render while a dialog is open, keyboard only operation (Tab, Enter, Space, Escape), and a slow or failing GitHub response surfacing a definite error rather than a silent no-op.
8. Legibility floor on the fit (manager observation, decide it explicitly). At 360 the filter fit lands at 31–34 % and card titles are about 5 px: the three matches are technically inside the viewport but unreadable, which does not solve F3/F5. Either introduce a readable minimum (roughly 0.55–0.6) and, below it, centre on the group with an explicit "Tout afficher (N)" action that does the full fit, or state with measurements why the current behaviour is better for the user. Same question for dependency focus on a board whose neighbours are far apart. Judging legibility, not just containment, is your job here.
</attack_surface>
<criteria>
- Spec verdict: for each of F2 (sheets), F3 (Canvas dependency organisation), F4 (rename), F5 (spacing) say PASS or FAIL with the evidence that decided it. Quote the user's own words from the feedback file.
- Quality verdict: APPROVED only if you found no defect that a phone user would hit in the first minute, and no invariant regression. Otherwise CHANGES REQUESTED with each defect as severity, file:line, reproduction and the smallest fix.
- Every claim carries a path to evidence you produced yourself under verifications/V4-1-L4/, not a pointer to the builders' artifacts.
- Explicitly list what you could not verify and why.
</criteria>
<output>
SPEC: PASS|FAIL per requirement with evidence. QUALITY: APPROVED|CHANGES REQUESTED. DEFECTS: table severity/file:line/repro/smallest fix. FIX_COMMITS: SHAs you made, or none. INVARIANT_PROOF: commands and results (dot-grid diff empty, grep counts, CSP). TEST_COUNTS: final sequential run. UNVERIFIED: honest list. SHIP_RECOMMENDATION: whether this may go to master and live, and what a human must click to accept it.
</output>
