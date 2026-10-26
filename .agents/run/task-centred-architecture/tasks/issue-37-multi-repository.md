<env_preflight>
READY — hosting slice is accepted and merged; web/** is free. A separate #35 reviewer runs read-only in .worktrees/team-dev-issue-35-write-refresh; do not read or touch it.
Repo /workspace/extensions/github-task-board
Worktree /workspace/extensions/github-task-board/.worktrees/team-dev-issue-37-multi-repo
Branch feat/issue-37-multi-repo; base commit752407a, tracked clean. Create the shared dependency link once: ln -s ../../node_modules node_modules (root node_modules already installed). No npm install, no env copy, no DB registration.
Key paths (ground them yourself in this tree): web/server/{config,github,board,app}.ts, web/public/app.js, web/tests/**, web/README.md.
Tests: node --test web/tests/*.test.mjs; npm test; npx tsc -p web/tsconfig.json; bundle npx esbuild web/server.ts --bundle --platform=node --format=esm --target=node20 --packages=external --outfile=web/dist/server.mjs (web/dist gitignored; npm run build:web does not exist).
Do not touch panel/**, service/**, test/**, shared skills/config, credentials, real GitHub beyond the configured token in existing fixtures, installed extension, other worktrees, master, proxy/TLS/container/deployment configs. No push/merge/close/deploy. Synthetic fixtures and localhost only.
Preflight authoritative at dispatch; no initial git status/pwd/ls. Targeted checks before commits and after failures expected.
</env_preflight>
<goal>
The board serves every repository the configured bot token can read, with a repository picker and one combined view, while every issue, cache, draft and write keeps repository-qualified identity.
</goal>
<context_files>
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/decisions-2026-10-24.md]
[@/workspace/extensions/github-task-board/docs/issue-body-contract.md]
Issue #37 body is the acceptance contract: every repository the token can read, archived visible and marked, empty selectable, last choice remembered, combined view naming each issue's repository, inaccessible known repository shown unavailable never empty, bounded disclosed refresh, no enumeration claim for hidden private repositories.
</context_files>
<skills>
[@/workspace/config/opencode/.agents/skills/build/methodology/test-driven-development/SKILL.md]
[@/workspace/config/opencode/.agents/skills/review/security/security-and-hardening/SKILL.md]
[@/workspace/config/opencode/.agents/skills/communication/terse/caveman-lite/SKILL.md]
</skills>
<scope>
Preserve the accepted #33 security base: separate board password session, server-held token, CSRF, redirect refusal, best-effort write semantics, UNKNOWN-never-repeat, exact question/revision binding, consumed-detail validation, mixed-indent code exclusion. This slice adds repository choice without weakening any of them.

1. Repository discovery. List token-visible repositories with bounded pagination (no unbounded loops; fail loudly on a malformed page instead of showing a partial list as complete). Each entry carries an immutable repository identity (owner/name, numeric id when available) plus archived flag and whether it has issues. Cache the discovered list with a short explicit freshness; a failed refresh must not silently empty the picker. Distinguish "no repositories visible" from "discovery failed".
2. Allowlist enforcement at the write boundary. Today the client cannot supply a repository at all. Replace that with: a repository may be named by the client only if it is in the current token-visible discovered set, and every read and write resolves that exact identity server-side. Repository-qualified routes must not accept a fabricated or case-variant name, must not fall back to the configured default, and must not trust a client-supplied numeric id alone. Keep BOARD_REPO as one entry, not special: removal of BOARD_REPO-dependent startup behaviour must not break existing single-repository configuration.
3. Repository-qualified identity everywhere. Issue identity becomes (repository id or owner/name, issue number) in every cache, draft, pending navigation, answer binding, label update, body update and combined row. Same number in two repositories must never share a row, draft, cached detail, optimistic update or write. Any place that currently keys by number alone must be found and corrected; add a mutation-discriminating regression that fails with number-only keys.
4. Picker and combined view. Remember the last repository; offer a combined view; combined rows name their repository. Empty repositories remain selectable and show an honest empty state. Archived repositories stay listed and clearly marked. A known repository that becomes inaccessible is shown as unavailable with its last known identity, never as empty or silently removed.
5. Bounded aggregate refresh. Fetch across repositories with a fixed small concurrency, a per-repository error boundary and a disclosed partial/failure state; no silent omissions, no unbounded parallel requests, no retry storm. Partial results must be visibly partial and must never be published as complete. Keep any existing #28/#34/#35 write-protection behaviour intact, including refusal to overwrite newer confirmed state.
6. Tests. Cover: token covering two repositories shows both; combined view lists and labels both; cross-repository same-number rows stay separate; a write in combined view lands only in the shown issue's repository; a fabricated/unknown/non-allowlisted repository is refused before any GitHub call; discovery failure does not present an empty picker; archived and empty repositories remain selectable with correct states; lost access shows unavailable; concurrency and partial states are honest. Include a red-before/green-after regression for at least the number-only identity mutant and the allowlist bypass.

No agent controls, no notification loop, no PWA, no hosting changes, no new authentication path. No claim that hidden private repositories are enumerable.
</scope>
<criteria>
All named tests pass; existing web and root suites stay green with no deleted, skipped or weakened assertions; both typechecks and the bundle build reproduce; report the fresh bundle hash and parity (gitignored, never force-added). Repository identity is provably qualified at every write path with a discriminating regression. The security base from #33 still passes its saved browser/HTTP matrices. Partial, unavailable and archived states are visually inspectable in a desktop and 360px screenshot and honestly labelled. No secret or repository value appears in browser storage, URLs or logs beyond what the board already displays. Independent hostile review follows; do not self-approve.
</criteria>
<steps>
Ground the actual current repository assumptions in source (config, github client, board state, app routes, UI state) and write a short mechanism map in your report before editing. Add failing regressions first. Implement in small green commits: discovery and allowlist, qualified identity, picker/combined UI, bounded aggregate. Rerun full suites, #33 saved matrices and screenshots. Commit report and proof; leave a clean tracked tree and stop for independent review.
</steps>
<output>
At most 12 lines: what was built per scope item, red-before/green-after evidence including the identity mutant and allowlist bypass, test totals and exit codes, typecheck/build/hash/parity, changed files and commits, #33 matrix result, screenshots inspected, blind spots (no real multi-repository token, no hidden private enumeration, no deployment), actual provider/model. No independent verdict, no merge/push/deploy/closure.
</output>
