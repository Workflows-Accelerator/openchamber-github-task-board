<env_preflight>
Repository /workspace/extensions/github-task-board. Session worktree /workspace/extensions/github-task-board/.worktrees/team-dev-issue-37-multi-repo, branch feat/issue-37-multi-repo, HEAD cdc48b1 tracked clean except private untracked report. Target root /workspace/extensions/github-task-board branch feat/v2-binding-and-ratelimit; accepted product merge 8660d2154a7d0a2d2d376c736ee727387ca8b575 and proof 095768fc7160d66b61a1c019a6f7c332920bdfbf, with later manager-only .agents/run/** checkpoints allowed.
This is read-only independent review. No stage, commit, product edit, push, merge, deployment, credential read or live GitHub request. Only owned file: .agents/run/task-centred-architecture/outputs/issue-37-integration-audit.md in your session worktree; optional scratch under /tmp/opencode. Do not alter existing proof or reports.
Test command: node --test test/shipped-parity.test.js. For reproducibility, build copied source in scratch using the same installed esbuild, never overwrite root bundles. No startup discovery loop; preflight facts authoritative, targeted inspection for review allowed.
</env_preflight>
<goal>
Independently certify that the merged issue 37 tree and the unexpectedly changed generated panel bundle reproduce the reviewed source without hidden product changes or weak proof.
</goal>
<context_files>
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/outputs/issue-37-integration.md]
[@/workspace/extensions/github-task-board/.worktrees/team-dev-issue-37-multi-repo/.agents/run/task-centred-architecture/outputs/issue-37-fix-recheck-private.md]
</context_files>
<skills>
[@/workspace/config/opencode/.agents/skills/review/adversarial/doubt-driven-development/SKILL.md]
[@/workspace/config/opencode/.agents/skills/communication/terse/caveman-lite/SKILL.md]
</skills>
<scope>
Conduct a hostile review of any edits or changes that you made to figure out what you might have missed or what might be broken. Don't assume that what you did is right. You are the independent reviewer of the integration worker's changes, not their author.
1. Audit 8660d21 merge parents and 095768f proof diff. There were 305 changed lines in panel/main.js although this issue is web-only. Determine whether that is purely a deterministic rebuild of root panel/main.ts/core.ts (for example newly exported functions made visible under tree-shaking=false), or an unreviewed behavioural change. Rebuild in scratch with the installed toolchain, compare bytes, run shipped parity against root. Stop/FAIL if not reproducible; no edits.
2. Check the four saved merged probes under root verifications/issue-37-integration/probes actually import ROOT product modules, assert zero-upstream refusal, repo label/selection equality plus Refresh enabled, no uncertain mark on pre-dispatch 503, and 501 truncation/duplicate truncation. Run the four scripts as-is if safe and no credentials. Ensure no unconditional pass or lost assertion.
3. Audit report accuracy: root timing flake is scale-and-adversarial <60 ms, not the other parser <50 ms. Test counts, commands and bundle identity must agree with raw logs. Deployment was authorised in decision18 but not performed; note the report's last line outdated authority wording without requiring a product patch.
4. Verify product changes since source review are only merged reviewed web work plus the deterministic panel artifact; no private reports/secrets/unrelated manager files staged. Output verdict Spec PASS/PARTIAL/FAIL, Quality APPROVED/NEEDS-FIXES and PROCEED/HALT.
</scope>
<criteria>
Generated artifact byte-equal to fresh root source build; shipped parity and four probes pass; proof targets root and preserves assertions; no new product change, no private report publication. No claim of installed host, real token, TLS or deployment proof.
</criteria>
<output>
Write your owned report. Return <=12 lines: verdicts; reason for panel bundle changes and byte parity; four probes/exits and shipped parity; evidence discrepancies; actual provider/model; unverified areas. No self-approval and no code change.
</output>
