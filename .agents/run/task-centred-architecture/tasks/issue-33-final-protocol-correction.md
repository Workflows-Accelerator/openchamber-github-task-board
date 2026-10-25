<env_preflight>
DRAFT QUEUED; manager must confirm clean HEAD before dispatch. No simultaneous repository implementation worker under frontier rule; #34 correction/check goes first.
Repo /workspace/extensions/github-task-board
Worktree /workspace/extensions/github-task-board/.worktrees/team-dev-issue-33-standalone-board
Branch feat/issue-33-standalone-board; expected HEAD 8818b94 report/proof, product f50519d. Expected clean, FILL_AT_DISPATCH.
Key paths web/public/app.js api/mutation feedback; web/server/github.ts request dispatch/parse provenance; web/server/app.ts mutation/readback; web/server/board.ts question projection/answer target; web/server/sections.ts serializer; web/README.md; tests and bundle web/dist/server.mjs. Root node_modules symlink; no env copy/DB registration.
Tests node --test web/tests/*.test.mjs; npm test; npx tsc -p web/tsconfig.json; node web/tests/browser-verify.mjs; build npx esbuild web/server.ts --bundle --platform=node --format=esm --target=node20 --packages=external --outfile=web/dist/server.mjs. npm run build:web does NOT exist.
Do not touch panel/**, service/**, root package metadata, shared skills/config, real GitHub, installed extension, credentials, private reports, other worktrees, master, push/merge/deploy/issue closure. Synthetic localhost upstream only.
Preflight authoritative at dispatch; skip startup git status/pwd/ls. Targeted commit/action failure checks allowed.
</env_preflight>
<goal>
Close exactly N1–N5 from the final browser-board hostile review without widening scope or claiming stronger guarantees.
</goal>
<context_files>
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/decisions-2026-10-24.md]
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/outputs/final-review-rulings-2026-10-25.md]
[@/workspace/extensions/github-task-board/.worktrees/team-dev-issue-33-standalone-board/.agents/run/task-centred-architecture/outputs/issue-33-final-hostile.md]
Review probe artifacts are in same worktree .agents/run/task-centred-architecture/verifications/issue-33-final/ (read only; write new proof elsewhere).
</context_files>
<skills>
[@/workspace/config/opencode/.agents/skills/build/refactoring/surgical-patch/SKILL.md]
[@/workspace/config/opencode/.agents/skills/build/methodology/test-driven-development/SKILL.md]
[@/workspace/config/opencode/.agents/skills/communication/terse/caveman-lite/SKILL.md]
</skills>
<scope>
Own only relevant web/** product/tests/bundle/docs and .agents/run/task-centred-architecture/outputs/issue-33-final-protocol-correction.md plus verifications/issue-33-correction/**. Prior reports immutable; new report supersedes incorrect closure claims.
Owner decision14 approves ONE focused pass, then ONE independent final check. Stop on real fork.
N1 Medium: For every browser mutation, malformed/empty/missing success payload, response parse/protocol failures and untrusted gateway/generic post-send failures MUST say UNKNOWN with refresh guidance. Known structured board pre-commit refusals remain distinct. Preserve login/logout semantics. Server must retain parse/provenance information: HTML/malformed post-commit 422 is not validation proof. Only trusted definitive pre-commit rejection may say failed. No blind status<500 rule for malformed/untrusted replies, no automatic repeat.
N2 Low: Prevent redirect forwarding BEFORE any hop: fetch redirect error or manual refuse, including 302 GET and 307 PATCH across same/different origin. Token AND body never forwarded on refusal. Redirect mutation outcome is conservatively UNKNOWN where possibly sent; no repeat. Real-HTTP regressions count requests at destination, not just check response.url afterward.
N3 Low: Replace broad trim readback equality with serializer-projection comparison normalizing only line ending/serializer blank padding, preserving meaningful indentation/trailing content whitespace. Expected projection comes from the actual patched body; retain successful CRLF behavior and protected suffix byte preservation. Indentation-only mismatch => UNKNOWN, never success.
N4 Low: Web-only safe handling of question candidates under fences. Shared panel parser must remain untouched. Use compatible robust fence state/discovery and targeting in web layer or refuse ambiguous fenced targets; ensure list/detail never offers code checkbox as actionable question, direct answer request cannot mutate it. Preserve real questions, indices and exact source-text conflict refusal. No new question identity/history/hash architecture.
N5 Low: Synchronize README queue4/deadline2 and numeric contract with actual code and qualified verification claims. No unbounded DOS guarantees or all-evidence-closed statements. State new report supersedes prior closure statuses; prior reports not rewritten.
Red tests BEFORE fix for each. Reuse real HTTP/browser review probes (copy into owned proof or tests as appropriate); verify 502 HTML/200 malformed/empty browser responses after committed PATCH; malformed upstream422; redirect destination not reached; indentation mismatch; malformed suffixed fence, longer backtick and tilde variants; docs/code checks. Keep tests meaningful, no weakening.
Not in scope: BOARD_HOST, /health, start hook, notifications/PWA, #37, deployment, parser refactor, new dependencies.
</scope>
<criteria>
N1–N5 red-before/green-after evidence, actual mutation request counts and visible browser feedback. Full web/root suites/types/build parity green; browser screenshots/logs inspected. Best-effort overwrite window remains disclosed, password/token separation unchanged, attention distinct from phase, human-only Done. Production GitHub/TLS/persistence/real keyboard focus stay NOT RUN.
</criteria>
<output>
Commit product/tests/bundle/docs/proof on feature branch. <=12 lines: commit, N1–N5 status/probe evidence paths, counts/build/hash, exact changed scope, blind spots and actual provider/model. Independent final check follows; no merge/push/closure/deploy.
</output>
