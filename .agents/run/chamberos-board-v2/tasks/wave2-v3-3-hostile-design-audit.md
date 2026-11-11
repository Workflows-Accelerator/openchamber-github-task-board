<env_preflight>
Repo: /workspace/code/openchamber-github-task-board
Worktree: /workspace/code/openchamber-github-task-board/.worktrees/team-dev-board-v3
Branch: feat/board-v3
Base commit: [FILL_V3_2_SHA] (clean; V3-1 API/Any-Repo + V3-2 UX/UI redesign committed)
Real Chromium launcher: /workspace/code/openchamber-github-task-board/.worktrees/team-dev-board-v3/.agents/run/chamberos-board-v2/verifications/A-delivery/hostile2/scripts/chromium-env.sh
Test commands: npm test && node --test --test-timeout=30000 web/tests/*.test.mjs && npm run typecheck && npm run web:build
Do not touch: panel/**, service/**, dot-grid math at web/public/app.js:2268, /workspace/code/openchamber-config/**, /workspace/releases/**, GitHub issue closures
Preflight facts are true and authoritative at dispatch: do not run initial discovery commands (git status, pwd, ls) to re-ground on startup. Re-inspect targeted state only for mutations/pre-commit verification, compaction/resume with stale facts, branch/location changes, or action failure.
</env_preflight>
<goal>Conduct an independent L4 hostile code, API, and visual UX critique of `feat/board-v3` against `4e92c01`, fix any contained P0/P1/P2 defects found with regression tests and fresh Chromium proof, and deliver explicit Spec and Quality verdicts.</goal>
<context_files>
[@/workspace/code/openchamber-github-task-board/.agents/run/chamberos-board-v2/decisions.md]
[@/workspace/code/openchamber-github-task-board/.worktrees/team-dev-board-v3/.agents/run/chamberos-board-v2/verifications/V3-1/proof.md]
[@/workspace/code/openchamber-github-task-board/.worktrees/team-dev-board-v3/.agents/run/chamberos-board-v2/verifications/V3-2/proof.md]
</context_files>
<skills>
[@/workspace/code/openchamber-github-task-board/.worktrees/team-dev-board-v3/.agents/skills/impeccable-critique/SKILL.md]
[@/workspace/code/openchamber-github-task-board/.worktrees/team-dev-board-v3/.agents/skills/web-design-guidelines/SKILL.md]
[@/workspace/code/openchamber-config/.agents/skills/review/adversarial/doubt-driven-development/SKILL.md]
</skills>
<owned_paths>
web/**
scripts/generate-delivery-smoke.mjs
.agents/run/chamberos-board-v2/verifications/V3-3/**
</owned_paths>
<depends_on>
wave2-v3-2-ux-ui-overhaul
</depends_on>
<steps>
<step>1. Conduct a hostile review of all edits in `git diff 4e92c01..HEAD -- web scripts` assuming nothing works as claimed:
- Audit GitHub API efficiency edge cases: Could `If-None-Match` (`304`) serve stale data after a local mutation (`createIssue`, `updateIssue`, `status`, `canvas`, `dependencies`, `reopen`)? Verify every mutation invalidates `repoBoardCache` and `repoClosedCache` (including stored ETags if needed, or verify GitHub ETag changes on write and local cache invalidation clears stale entries). Could multi-page repos (`pages > 1`) falsely skip page 2 on `304`? Verify `If-None-Match` is ONLY trusted when previous load had `pages === 1` and `!truncated`! Could singleflight cache a rejected promise permanently if `.finally()` cleanup is missing?
- Audit Any-Repo usability edge cases: Open a synthetic vanilla GitHub repo (zero `status:*` labels, plain Markdown body with code fences, links, task lists, long titles, 0-issue repo, `has_issues: false` repo, `403`/`422` label-restricted repo). Verify `effectiveStage`, Client presentation visibility (explicit `status:draft` STILL hidden, vanilla unlabeled open issue VISIBLE!), Detail Drawer Markdown rendering (zero XSS, zero raw hidden markers, zero empty ChamberOS boilerplate), and Operations status breakdown consistency!
- Audit UX/UI & Accessibility via `impeccable-critique` Dual Assessment (Nielsen's 10 Heuristics 0–4 score + 5 Personas: Alex, Jordan, Sam, Riley, Casey) in real Chromium across `360x800`, `390x844`, `768x900`, `1280x900` Light/Dark EN/FR:
  - Inspect screenshots directly for text truncation, overlap, contrast failures, horizontal scrollbars, touch targets `<44px` on narrow screens, HUD overlap over cards, drawer z-index/backdrop issues, keyboard Escape/focus-visible, French untranslated strings, CSP console errors, or banned strings (`"n8n"`, `"mobile"`, emojis, double `+` prefix).</step>
<step>2. If ANY P0, P1, or P2 defects are found (up to 2 bounded fix passes): fix them surgically at root cause, add regression tests in `web/tests/`, re-capture affected real Chromium screenshots under `.agents/run/chamberos-board-v2/verifications/V3-3/screenshots/`, and re-run all verification suites from scratch on the final clean tree.</step>
<step>3. Run independent negative fault-injection checks on `scripts/generate-delivery-smoke.mjs` in a disposable `/tmp/antigravity/v3-smoke-check` copy (offscreen X/Y HUD control, `canvasViewNotShown` vacuity check, wrong `<html lang>`, CSP inline-style violation) to confirm each exits non-zero, while baseline exits 0.</step>
<step>4. Record `.agents/run/chamberos-board-v2/verifications/V3-3/report.md` (with Nielsen 10-heuristic score `/40`, all diffs/defects fixed, test counts, screenshot paths, and explicit NOT RUN list) and commit cleanly on `feat/board-v3`.</step>
</steps>
<criteria>
1. Spec Compliance Verdict = PASS and Code & Design Quality Verdict = APPROVED, with Nielsen usability score `>= 36/40` and zero open P0/P1/P2 defects.
2. `git diff 4e92c01..HEAD -- panel service` is empty; `app.js:2268` dot-grid formula untouched; zero `"mobile"`, zero `"n8n"`, zero emojis, zero CSP errors.
3. `npm test` (618/618), all `web/tests/*.test.mjs`, `npm run typecheck`, `npm run web:build`, and `scripts/generate-delivery-smoke.mjs` (plus negative fault injections) pass independently on clean tree.
</criteria>
<verification>
npm test && node --test --test-timeout=30000 web/tests/*.test.mjs && npm run typecheck && npm run web:build
</verification>
<output>
Respond in concise structured Markdown with:
- SPEC_VERDICT: PASS | FAIL
- QUALITY_VERDICT: APPROVED | NEEDS_FIXES
- NIELSEN_SCORE: X/40 with brief per-heuristic breakdown
- DEFECTS_FOUND_AND_FIXED: numbered list with file:line and fix commit SHA (or none)
- FINAL_HEAD_SHA: exact clean commit SHA on feat/board-v3 (plus latest application-code SHA)
- TEST_AND_SMOKE_COUNTS: legacy tests, web tests, typecheck, Chromium smoke + negative injections
- SCREENSHOTS: exact paths of final verified phone & desktop screenshots under `.agents/run/chamberos-board-v2/verifications/V3-2` or `V3-3`
- NOT_RUN: honest list of unverified surfaces
</output>
