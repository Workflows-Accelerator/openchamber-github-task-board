<env_preflight>
Repo: /workspace/code/openchamber-github-task-board
Worktree: /workspace/code/openchamber-github-task-board/.worktrees/team-dev-chamberos-board-v2
Branch: feat/chamberos-board-v2
Base commit: PENDING_A4_A5_PASS_AND_MANAGER_GIT_VERIFICATION — DO NOT DISPATCH UNTIL REPLACED.
Clean/dirty state: PENDING_MANAGER_VERIFICATION.
Files: web/server/app.ts, board.ts, github.ts and existing section/front-matter helpers; web/public/app.js, index.html, theme.css; web/tests/**; necessary B1 screenshot harness; worktree .agents/run/chamberos-board-v2/verifications/B1/**.
Test commands: timeout 900 npm test; timeout 900 node --test --test-timeout=30000 web/tests/*.test.mjs; timeout 600 npm run typecheck.
Do not touch: root checkout outside this worktree; panel/**; service/**; production processes (board/OpenChamber); /workspace/releases/**; /workspace/.openchamber-data/**; /workspace/config/opencode/**; .env*/credentials; /proc/*/environ; real GitHub issue data or repository settings. No pushes, PRs, merges, reset/rebase, deletion, issue closure or live switch. Zero emojis. No new dependencies without explicit approval; approved license-compatible local vendoring must include provenance/license.
These preflight facts are authoritative at dispatch: skip startup pwd/ls/git status discovery. Targeted checks allowed before/after mutations/commits, stale resume, location changes or action failure. There will be no other active worker in this worktree at dispatch.
</env_preflight>
<goal>
Implement B1 (#61): label chips and the full V2 front-matter editor with custom fields, preserving the V1 UX and all A1-A5 behavior.
</goal>
<context_files>
[@/workspace/code/openchamber-github-task-board/.agents/run/chamberos-board-v2/decisions.md]
Read the aligned specification at /workspace/code/openchamber-github-task-board/.agents/run/chamberos-board-v2/tasks/task-B1-labels-frontmatter.md (the scope is reproduced below; do not apply its generic stale startup preflight).
Read the worktree's latest A4 and A5 proof.md under .agents/run/chamberos-board-v2/verifications/ for current fingerprint/locking, presentation, marker byte-identity and note conflict invariants. Do not regress them.
V2 feature reference: tmp/webapp-v2.html, front-matter editor near lines 1900-1970. V1 UX reference: tmp/chamberos_ai_native_github_openchamber_operating_system.html.
</context_files>
<skills>
[@/workspace/code/openchamber-config/.agents/skills/build/domain/frontend-ui-engineering/SKILL.md]
[@/workspace/code/openchamber-config/.agents/skills/verify/browser/browser-testing-with-devtools/SKILL.md]
[@/workspace/code/openchamber-config/.agents/skills/communication/terse/caveman-lite/SKILL.md]
</skills>
<scope>
Own web/**, a narrowly needed scripts/generate-b1-screenshots.mjs harness, and worktree .agents/run/chamberos-board-v2/verifications/B1/**. Minimal diffs; reuse existing helpers rather than duplicate renderers/parsers.
1. Labels: priority:urgent|high|normal|low; size:XS|S|M|L|XL; ready-to-run; backburner; plus existing status:*. Idempotent server ensure-labels route creates missing labels with fixed colors/descriptions, never edits/deletes existing labels. Call only from Settings per repository after explicit count+repository confirmation, not on load. Fake GitHub only for verification. The original confirmation "Create 11 labels" is an example; display the actual number of missing labels.
2. Drawer chips for status/priority/size/ready-to-run/backburner. Single-choice groups replace the old label in one PATCH. Cards/List rows compact priority+size; List sort/filter for both. Missing repository label => explanatory chip: label missing — create labels in settings.
3. Leading YAML front matter: known fields model, agent, skills, worktree, branch, auto_run, client_visible and all other V2 fields; correct input types; custom add/rename/remove and key validation; raw YAML toggle validated before save. Safe subset parser for scalars/lists/nested maps one level/quoted strings, or approved license-compatible locally vendored parser. No CDN.
4. Save only the leading front-matter block, preserving remaining issue body byte-for-byte and untouched key order where possible. Existing status/priority/size/ready/ready-to-run YAML fields show should-be-labels and explicit move-to-labels action sets labels/removes the key. Never automatically migrate on read.
5. Client Presentation Mode hides front-matter editor and internal metadata globally, not just Client view.
</scope>
<standing_rules>
No fake/simulated production data or actions. Honest errors when unavailable. No banned product terms from decisions.md and no double-plus button text. Responsive 360/768/1280, English/French, light/dark; names Canvas/List; sidebar not top bar; V1 warm-paper design. Strict self-only script CSP/no CDN. Secrets stay server-side, never printed. Fake GitHub is only an upstream test boundary; screenshots use unmodified application assets through ordinary clicks, no injected proof-only CSS/DOM. Status/priority/size/ready are labels, never newly written as front matter. Preserve mandatory fingerprints, per-issue write locking, no remote-note overwrite by ordinary retry, marker set+strip byte identity and truthful cached/partial data warnings.
If a real fork or new scope is necessary, stop and report the choices. Do not invent approval. Local small commits autonomous. Do not call human acceptance passed or mark issues Done.
</standing_rules>
<criteria>
All scope items work with deterministic regression and real browser proof. YAML tests include comments, CRLF, no/empty leading front matter, quoted scalars, lists, one-level maps, invalid YAML and later fenced ---; unchanged body suffix byte-identical. Ensure labels idempotent, no edits to existing labels, missing-label behavior, single-choice swap, mandatory missing/stale fingerprint rejection and preservation of unrelated labels/body. Browser change priority+size, edit fields+custom field, raw validation, explicit move-to-labels, then reload to show persistence. Exercise missing/failed/permission-denied requests and preserve drafts. Screenshots 360/768/1280, light/dark, English/French; no console/CSP errors. Both suites+typecheck pass, no weakened/removed tests. Account for baseline->final test totals. Clean tree at finish. Live GitHub writes NOT RUN.
</criteria>
<verification>
timeout 900 npm test
timeout 900 node --test --test-timeout=30000 web/tests/*.test.mjs
timeout 600 npm run typecheck
Fresh browser interactions against fake GitHub-backed server with request/body traces. Record exact commands, exit codes, raw summary lines, screenshot paths and a NOT RUN matrix in worktree .agents/run/chamberos-board-v2/verifications/B1/proof.md. Verify every cited SHA exists with git show --stat. Include raw git log --oneline from verified base to HEAD and raw git status --short. Passing tests alone do not prove real browser behavior.
</verification>
<output>
Commit all scoped code/tests/evidence in small commits. Return <=20 lines: implemented/remaining, final SHA + commit list, legacy/web test totals/typecheck, browser proof paths, explicit NOT RUN and raw git log/status. This is the build only; manager inspection, hostile review and independent audit follow before awaiting combined human review.
</output>
