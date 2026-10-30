<env_preflight>
Repo: /workspace/extensions/github-task-board
Worktree: /workspace/extensions/github-task-board/.worktrees/team-dev-issue-46-mobile-parity-offline
Branch: feat/issue-46-mobile-parity-offline
Base commit: 8df6d7b5f79eaf6133cc51950996ffcac872d52e
Candidate commit: cc083796c4bf62b57aaa76e2908f8b5cd47347dd
Goal: Re-audit candidate commit cc08379 to confirm Finding TS2454 in web/server/app.ts is closed and verify 100% clean gates across the full issue diff.
Commands:
- npm run typecheck
- npx tsc -p web/tsconfig.json
- node --test web/tests/*.test.mjs
- node --test --test-concurrency=1 test/*.test.js
- node --test test/shipped-parity.test.js
</env_preflight>

<skills>
[@/workspace/config/opencode/.agents/skills/review/adversarial/doubt-driven-development/SKILL.md]
[@/workspace/config/opencode/.agents/skills/verify/ladder/verification-levels/SKILL.md]
</skills>

<goal>
Verify that the TS2454 finding is definitively resolved and conduct a final adversarial pass on the full diff (8df6d7b..cc08379).
Confirm:
1. `npx tsc -p web/tsconfig.json` exits 0 with 0 errors.
2. `npm run typecheck` exits 0 with 0 errors.
3. All unit and integration test suites pass.
4. Align Drafts button is removed from web board, polished in panel.
5. Task drawer, offline drafting, and PWA icons meet spec.
</goal>

<output>
At most 10 lines:
Verdicts: Spec Compliance (PASS/FAIL), Quality (APPROVED/NEEDS-FIXES).
Findings: None or list.
Test counts and compiler status.
</output>
