# Combined preview handoff — prepared, not authorised to deploy

## Readiness
- Batch #47 + #48, aligned D47–D54. #47 at268bd28 independently accepted; waiting for web and panel #48, no human verdict.
- Do not start integration while a #48 builder/correction owns affected files or before required per-surface reviews pass.
- Main root branch feat/v2-binding-and-ratelimit includes unrelated historic portfolio/run work; do not merge it wholesale into staging/master. Start staging from approved mastercc08379 and merge reviewed feature branches only. Preserve root run state through explicit artifact pointers/copies, not by smuggling unrelated source changes.
- Current local staging branch existence/topology not established. A release/integration worker must inspect git worktree/branch topology once, then use a dedicated integration worktree following management skill. Never switch the busy root checkout or reuse a branch checked out elsewhere.

## Integration requirements
1. Root manager inspects final feature diffs and independent proof; records exact accepted SHAs and two verdicts before dispatch.
2. Worker merges #47 and #48 reviewed branches normally (no rebase/reset/cherry-pick/force). Web correction should already contain #47; verify ancestry rather than duplicate changes. Panel branch startsmastercc08379 and owns panel/root-test updates.
3. Verify generated panel bundle deterministically matches TypeScript, keep human-action/state protections, run both typechecks, panel/server builds, root/full isolated web suites, hosting and shipped parity. New #48 server/browser test paths must isolate sessions AND project names. Any conflict affecting behaviour gets fresh hostile review, not an assumed cosmetic resolution.
4. Retain independent #47 proof/harnesses and both #48 proofs/screenshots before any worktree cleanup. Only preserve secret-free committed evidence. No live data, passwords/cookies/tokens in logs or argv.
5. Browser-run combined build on localhost with isolated private stores and synthetic GitHub data, exercising end-to-end UI/API paths. This proves runtime wiring, NOT real GitHub or installed extension authority. Also prove old SW cache upgrade in a real browser if runtime supports SW. Report unsupported capabilities as NOT RUN.

## Running preview constraints
- Need one stable combined preview reachable through the user's OpenChamber port-forwarding/current supported route, not just screenshots or a localhost URL in the assistant container that user cannot reach.
- Worker may start a localhost-only private preview on a free nonproduction port using synthetic credentials and fake GitHub. Must verify readiness via real HTTP and browser; retain PID/lifecycle ownership and shutdown instruction. Do not kill unrelated processes.
- Do not create domains, public exposure/proxy routes, modify live current symlink, restart production, read board.env or reuse tokens just to make preview reachable. If no supported private user-visible transport exists, report that as a concrete blocker and ask for one bounded decision. Never substitute production deploy for human review.
- Keep the extension preview honest: synthetic OpenChamber bridge is not the installed host. If user validation requires loading the extension in a dev instance and no isolated dev-host route exists, provide exact safe steps or ask, rather than silently updating the live extension checkout.

## One batched human review (draft, only send after every member L4 passes)
One user-visible URL and one numbered list:
1. Fresh app + sign-in (#47): open/reload preview; saved-password offer on desktop/phone; authenticate, coordinated preview restart then refresh without password prompt; sign out and refresh must stay signed out. Do not ask user to rotate production password or operate daemon to verify a preview.
2. Views + quick drafts (#48): switch five views using same filters/sort, answer an existing question in Pending items, capture title + optional description without session launch, choose project before saving, reorder up/down and reload/second browser, rename short project. All Projects must keep same-number tasks distinct. Verify phone layout genuinely feels simple.
3. Extension parity (#48): inspect identical View/Filter/Sort model, Pending items actions, Draft capture with no session and extension-only Align Drafts. Include safe actual dev host link/steps; no mocked-host completion claim.

Known limitations to disclose: project rename overrides separate between extension and web; graph dependency tree may not include fetched native GitHub sub-issue relationships; saved-task cross-project transfer unavailable if safest correction restricts destination to new drafts; numeric rank updates not a GitHub whole-list transaction; native sign-in without working JavaScript returns an error; physical autofill/installed-PWA before user review not proven; earlier unsafe-test effect UNKNOWN.
Verdicts per issue, never all-or-nothing forced. No human boxes checked by agent. No master push, live update or issue closure until explicit user approval of this batch. Prior #46 approval and general Continue do not satisfy L5.

## Queue
- Active workers from mission.md remain authoritative; no polling or duplicate builds.
- Prepared panel review brief dispatches only after panel completion and exact candidate receipt.
- Prepared web correction brief dispatches only after existing web review wake is folded in and full findings added.
- After correction: fresh independent reviewer, at most bounded configured attempts before human escalation.
