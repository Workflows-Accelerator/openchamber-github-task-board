<env_preflight>
Repo and location: /workspace/extensions/github-task-board (root, READ ONLY for source and git refs).
Root branch: ops/task-board-activation at 532f679e72a82b7e87ee3a2142a32b49d337fa54 (claimed product tree identical to master ab7516c4a3634c3d69f7b82936ddb7655d327ebb; only .agents/run/task-centred-architecture/** restored from old feature f485a0a). Untracked .agents/idle-nontext-state.json unrelated: leave untouched.
Old feature branch feat/v2-binding-and-ratelimit must still exist at f485a0a or later manager commit 1e3a04c; verify, never modify.
Activation worker ses_ac7b1acca2cb629201061c01 actual 9router/engineer COMPLETED, claims: guest github-task-board recycled via PUT /api/guests/:id/enabled false->true, served panel/main.js equals disk, live host iframe controls, 0 console errors, chambervoice unaffected. All CLAIMS.
Manager observation of activation/verifications/screenshots/toolbar.png: Sort select renders with a white background and clipped value text ("riority"), project picker text clipped ("ecting re..."), "View Simple list" crowded against its border. Unknown whether real panel defect, crop artefact or headless-engine rendering gap.
Host source /usr/local/lib/node_modules/@openchamber/web/** may be read for supported guest APIs. Preserved prior panel evidence: .agents/run/task-centred-architecture/preserved-batch-simplify/issue-48-panel-simple-views/** (screenshots at 980px/360px).
Secrets wall: never read /workspace/.openchamber-data/**, board.env, .env*, process environments, cookies or credentials; never git remote -v. No GitHub writes, no draft creation, no agent starts, no guest toggles, no host restart, no root checkout/branch changes.
Preflight authoritative at startup; skip initial pwd/ls/status discovery. Targeted inspection allowed.
Write only .agents/run/task-centred-architecture/activation-audit/** and outputs/task-board-activation-audit.md; commit exactly those paths locally on the current branch (no other git mutation).
</env_preflight>
<goal>
Independently prove whether the OpenChamber host is actually running the reviewed task-board extension, and whether its live toolbar renders correctly.
</goal>
<context_files>
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/outputs/task-board-activation-receipt.md]
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/activation/verifications/proof.md]
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/outputs/batch-simplify-activation-approval.md]
</context_files>
<skills>
[@/workspace/config/opencode/.agents/skills/review/adversarial/doubt-driven-development/SKILL.md]
[@/workspace/config/opencode/.agents/skills/verify/ladder/verification-levels/SKILL.md]
[@/workspace/config/opencode/.agents/skills/communication/terse/caveman-lite/SKILL.md]
</skills>
<review_prompt>
Conduct a hostile review of any edits or changes that you made to figure out what you might have missed or what might be broken. Don't assume that what you did is right.
You did not perform the activation. Treat its receipt as claims. Challenge: is the running service child really from the root checkout and started after the toggle; is the iframe script served now equal to master; did any cache serve old code; does the toolbar render correctly in a normal Chromium-class engine at the panel's real width; were any writes or agent starts triggered.
</review_prompt>
<scope>
1. Git: verify root product tree (excluding .agents/run/task-centred-architecture/**) equals master ab7516c byte-for-byte, master and old feature branch unchanged, restored manager state equals the old branch's copy. Read-only commands only.
2. Runtime: via supported nonsecret host API/metadata and /proc, prove the extension service child start time is after the toggle and its cwd/entry is root service/main.js equal to master. Prove the served panel bundle hash via the host route equals master. Read-only requests only; no toggles.
3. Visual: open the real host panel read-only at realistic desktop width (e.g. 1280 and 980) and a phone width (360) if the host supports it; capture uncropped toolbar screenshots, redacting private project or task text before committing. Decide whether the Sort select white background, clipped labels and crowded View button are (a) real panel defects in master, (b) headless-engine artefacts, or (c) crop artefacts. Compare with preserved #48 panel screenshots and the panel CSS. If a defect is real, cite file:line and severity; do not fix.
4. Read-only interactions only: switch View and Sort, open/close Filter, select the Draft filter. Do not type into quick capture, reorder, move projects, align drafts, or open sessions. Capture console/page errors.
</scope>
<criteria>
Spec PASS/PARTIAL/FAIL, Quality APPROVED/NEEDS-FIXES, Activation VERIFIED/NOT VERIFIED. Any mismatch in hashes, start time or served code is a failure. Visual defect classification must be evidence-backed. Zero mutations beyond the audit evidence commit.
</criteria>
<output>
Return <=12 lines: three verdicts; product-tree diff result; service child start vs toggle time and served-bundle hash; visual classification for each toolbar observation with file:line if real; console errors; mutations; proof path and commit; actual provider/model. Full proof in activation-audit/verifications/proof.md and summary in outputs/task-board-activation-audit.md.
</output>
