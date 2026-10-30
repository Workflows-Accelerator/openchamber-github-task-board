<env_preflight>
READY — owner human validation (L5) explicitly approved: "Approve and release both (Recommended)"
Hostile review (L4) passed with PROCEED verdict (ses_81214ff6b9b9ba7e3399417a).
Repo: /workspace/extensions/github-task-board
Worktree: /workspace/extensions/github-task-board/.worktrees/team-dev-issue-38-draft-default
Source branch: feat/issue-38-draft-default (HEAD 48d1fb29b1bf503e4e9b64b792d5c8cc5d9f132b)
Target branch: master (currently origin/master 95bcf97)
Origin/master is proven direct ancestor of feat/issue-38-draft-default (95bcf97 -> db53d40 -> 48d1fb2).
Commands: git checkout master ; git merge --ff-only feat/issue-38-draft-default ; npm test ; node --test web/tests/*.test.mjs ; npm run typecheck ; npx tsc -p web/tsconfig.json ; node --test test/shipped-parity.test.js ; git push origin master ; git checkout feat/issue-38-draft-default
</env_preflight>

<goal>
Fast-forward master to accepted feat/issue-38-draft-default (commit 48d1fb29b1bf503e4e9b64b792d5c8cc5d9f132b), verify full test suite and typechecks on master, push master to GitHub origin, verify published remote tip, and restore working branch to feat/issue-38-draft-default.
</goal>

<scope>
1. In /workspace/extensions/github-task-board/.worktrees/team-dev-issue-38-draft-default:
   Confirm working tree is clean.
2. Checkout master:
   git checkout master
3. Fast-forward master to feat/issue-38-draft-default:
   git merge --ff-only feat/issue-38-draft-default
   Verify git log -1 shows 48d1fb29b1bf503e4e9b64b792d5c8cc5d9f132b.
4. Run full test gates on master:
   - npm test
   - node --test web/tests/*.test.mjs
   - npm run typecheck
   - npx tsc -p web/tsconfig.json
   - node --test test/shipped-parity.test.js
5. Push master to origin:
   git push origin master
6. Verify published remote tip:
   git ls-remote origin refs/heads/master
7. Switch back to feat/issue-38-draft-default:
   git checkout feat/issue-38-draft-default
8. Record release receipt in /workspace/extensions/github-task-board/.agents/run/task-centred-architecture/outputs/issue-38-release-receipt.md.
</scope>

<criteria>
Master fast-forwarded to 48d1fb29b1bf503e4e9b64b792d5c8cc5d9f132b; all unit, web, typecheck, and parity tests pass; origin master pushed and verified via ls-remote; worktree restored to feat/issue-38-draft-default.
</criteria>

<output>
At most 10 lines:
Master commit SHA before and after; git push exit; ls-remote verified tip; test counts; typecheck exits; receipt path.
</output>
