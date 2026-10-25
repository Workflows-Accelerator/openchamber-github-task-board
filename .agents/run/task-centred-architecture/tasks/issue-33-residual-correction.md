<env_preflight>
Repo /workspace/extensions/github-task-board
Worktree /workspace/extensions/github-task-board/.worktrees/team-dev-issue-33-standalone-board
Branch feat/issue-33-standalone-board; HEAD f6ee7da clean at dispatch (product 06ed4a3, docs-only hostile report on top). No worker owns this tree. Root suite baseline 466, NOT integrated panel542; do not merge integration into this tree. Root node_modules symlink present. No installs/env copy/DB registration.
Key files web/public/app.js (api(), mutation detail application, renderDetail), web/server/github.ts (status provenance), web/server/board.ts (web question scanner), web/server/sections.ts header comment, web/tests/protocol-corrections.test.mjs or one narrow new regression file, web/README.md only if needed to point at active report.
Tests node --test web/tests/protocol-corrections.test.mjs; node --test web/tests/*.test.mjs; npm test; npx tsc -p web/tsconfig.json; npx esbuild web/server.ts --bundle --platform=node --format=esm --target=node20 --packages=external --outfile=web/dist/server.mjs. npm run build:web DOES NOT EXIST. web/dist gitignored; report fresh hash and parity, do not claim committed bundle.
Own product files listed above, one focused test file if required, .agents/run/task-centred-architecture/outputs/issue-33-residual-correction.md and verifications/issue-33-residual/**. Prior reports/proofs immutable audit, no overwrite. Disposable probes /tmp/opencode.
Do not touch panel/** (including shared parser), service/**, root metadata/dependencies, shared skills/config, private reports/credentials, installed extension, other worktrees, production GitHub, master. No push/merge/close/deploy/secret reuse. Synthetic localhost upstreams only.
Preflight facts authoritative at startup; skip git status/pwd/ls discovery. Targeted mutation/failure/precommit checks allowed.
</env_preflight>
<goal>
Close the three owner-approved residual browser-board defects and correct active claims without reopening scope.
</goal>
<context_files>
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/decisions-2026-10-24.md]
[@/workspace/extensions/github-task-board/.worktrees/team-dev-issue-33-standalone-board/.agents/run/task-centred-architecture/outputs/issue-33-final-protocol-hostile.md]
[@/workspace/extensions/github-task-board/.worktrees/team-dev-issue-33-standalone-board/.agents/run/task-centred-architecture/outputs/issue-33-final-protocol-correction.md]
Reviewer probes and real gateway/browser fixtures: verifications/issue-33-protocol-final-review/{probes,browser-gateway,browser-baseline-relocated}.mjs. These already reproduce all three defects against 06ed4a3; reuse inputs but preserve their files.
</context_files>
<skills>
[@/workspace/config/opencode/.agents/skills/build/refactoring/surgical-patch/SKILL.md]
[@/workspace/config/opencode/.agents/skills/build/methodology/test-driven-development/SKILL.md]
[@/workspace/config/opencode/.agents/skills/review/adversarial/doubt-driven-development/SKILL.md]
[@/workspace/config/opencode/.agents/skills/verify/ladder/verification-levels/SKILL.md]
</skills>
<alignment>
Owner explicitly chose "Fix those three and recheck once (Recommended)" after failed f6ee7da. Binding decision16. Exactly one correction then one independent recheck. Failed recheck returns owner; no autonomous further loop. Authority excludes hosting, PWA, #37, shared parser or deployment.
</alignment>
<scope>
F1 Medium — invalid nominal-200 mutation detail must not corrupt view or become raw TypeError.
The success check currently accepts truthy payload.issue, so {issue:{}} is assigned before renderDetail dereferences missing arrays. Validate required detail schema before applying it for section, question and status saves. Required data: correct issue identity, fingerprint string, all arrays consumed by rendering (editableSections, openQuestions, humanTasks, acceptanceCriteria, subtests, statusOptions), plus any other actually dereferenced fields. Shape invalid or required data missing means write_outcome_unknown with refresh guidance, no assertion of success/rejection and no automatic resend. Preserve prior valid detail; do not replace it with invalid data or clear typed draft. Probe {} and partially valid/non-array fields through real HTTP gateway after one committed PATCH. Exactly one upstream write per click.
F2 Low — JSON 422 alone is not proof of a definitive validation refusal.
Classify recognisably GitHub validation body (e.g. message Validation Failed with errors array) as invalid; generic JSON object/string/array or gateway message after dispatch must remain unknown. Keep HTML422/malformed422 unknown, trusted precommit board conflict/auth/validation distinct. Do not broaden invalid status acceptance or demand atomic writes. Use existing GitHubError provenance rather than a parallel outcome classifier.
F3 Low — indented code checkboxes must not be offered or mutated.
Web-layer scanner only: four spaces/tab code sample checkbox excluded from list count, detail projection and mutation targeting. Direct answer index aimed at code must refuse 400 with zero PATCH. Preserve real questions before/after, normal list continuation and nested answer source offsets, completed/duplicate/index-shift/stale/CRLF semantics. Narrow code-indent detection/refusal, not a Markdown parser rewrite. panel/core.ts untouched.
F4/F5 reporting/comments — make the latest report truthful and correct stale headers saying all question parsing reuses panel/core.ts. Preserve previous review/proof files as immutable audit. Create a new active residual-correction report explicitly superseding prior closure claims. It must distinguish builder proof from independent verdict pending, list remaining blind spots, and not say "completely remediated" as an accepted conclusion. If README links old active report, update only that pointer.
No collateral formatting/refactoring, no new rendering features or fallback assigning answers to different questions. Preserve N2 redirect-before-forward, N3 whitespace/protected-byte checks, named fence protection, auth/session/CSRF/token-server-only and best-effort warning, attention separate from phase, human-only Done.
</scope>
<criteria>
Regression-first evidence for each F1/F2/F3 against 06ed4a3 and corrected tree, including actual user invocation through gateway/browser for three save paths. Invalid success data never assigned, raw TypeError absent, one PATCH only, UNKNOWN+refresh shown and original detail/draft preserved. Recognised validation still refuses and generic post-commit422 stays unknown. Indented code never actionable and direct code target zero PATCH. All targeted/web/root/types/build pass; inspect desktop/narrow screenshots and browser/server logs, report actual results not green totals alone. Fresh bundle hash, gitignored status accurate. Production writes/token/TLS/restart/focus NOT RUN unless genuinely executed. Stop after correction report.
</criteria>
<output>
Commit scoped fix, regressions and new report/proofs on feat/issue-33-standalone-board. Return at most12 lines: F1–F5 statuses (builder only), red/green counts and commands, browser evidence, hash, commit, residuals/blind spots, actual provider/model. Independent recheck next; do not self-approve or close issue.
</output>
