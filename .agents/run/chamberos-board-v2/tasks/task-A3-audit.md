[@/workspace/code/openchamber-github-task-board/.agents/run/chamberos-board-v2/tasks/_audit.md]

<step>
Step A3, issue #58 (blocked-by links as canvas wires). Brief: [@/workspace/code/openchamber-github-task-board/.agents/run/chamberos-board-v2/tasks/task-A3-links.md]
Build dispatch notes: [@/workspace/code/openchamber-github-task-board/.agents/run/chamberos-board-v2/tasks/task-A3-dispatch.md]
Hostile-review findings handed to the builder: [@/workspace/code/openchamber-github-task-board/.agents/run/chamberos-board-v2/tasks/task-A3-hostile.md]
Proof: .agents/run/chamberos-board-v2/verifications/A3/proof.md (in the worktree)
Commits: dd9e8ac..351642d on feat/chamberos-board-v2 (45d8c7f, 7b1e2e6, 7b255be, cbe5634 build; 351642d hostile fixes).
You are the ONLY session in this worktree. Wrap every test or long command in `timeout`.
Tests: `npm test` runs test/*.test.js only (618). The board's own suite is `node --test web/tests/*.test.mjs` (506). Report BOTH counts plus typecheck.
</step>

<extra_focus>
You are AUTHORISED to fix items 1-5 yourself (small, client-side or a server message), commit each with "audit:".
1. Wire delete confirm: the "Remove" button text wraps to "Remov / e" (canvas-wire-del-confirm-1280.png). Buttons must never wrap; size the pill to its content in English and French.
2. 403 message is wrong: canvas-dependency-403-notice-1280.png shows "Outcome unknown -- refresh to check GitHub state" for a permission refusal. A 403 is a known refusal, not an unknown outcome. Show a plain message such as "You do not have permission to change links on this repository" (EN + FR), and reserve "outcome unknown" for real timeouts/network errors after the request was sent. Check every link control (canvas drag, wire remove, drawer chip remove, picker add, convert text link).
3. The notice banner appears BEHIND the drawer overlay (blurred) while the drawer is open, so the user cannot read the reason. Error notices must be readable whenever the action came from the drawer: show it inside the drawer next to the control, or raise the notice above the overlay.
4. Cross-repo chips: the drawer chip "#201 Distributed pub/sub event bus" is from repo Satellite but the chip shows no repo name. Cross-repo chips (and picker results) must show the repo (e.g. "Satellite #201 ..."), same-repo can stay short.
5. Inconsistent data across screenshots: canvas-wires-1280.png shows #104 "blocked by 1" with only the #201 wire and NO wire from #105, while the drawer screenshot shows #104 blocked by #201 AND #105 (and a #105->#104 wire is visible behind the drawer). Determine whether the screenshot script changed the data between shots (acceptable, say so in proof.md) or the canvas misses a link / the "blocked by N" count is wrong (defect: fix). The count on the card must always equal the number of native blockers (text links counted separately or not at all, say which).
6. Font: the builder states the theme.css font stack is unchanged and the A3 screenshots differ from A2 only because of headless fonts. Confirm via git (theme.css font-family across f7a4f73..HEAD) and confirm the A3 screenshot script uses the same environment/fonts as A2's; note the result.
7. Re-verify the hostile claims yourself, not from proof.md: no 50000px layer remains and wires render for cards at negative coordinates; isValidMutationPayload bypass is gone (grep app.js for any /dependencies/ special case); 26-repo load makes batched (not per-card) dependency calls; GraphQL failure degrades to "no wires" plus a plain notice; touch port drag does not pan.
8. 351642d is one large commit (app.js +~450). Read it for dead code, DOM-mock guards that leak into production logic (e.g. `typeof x.hasAttribute === 'function'` checks added only to satisfy test stubs: prefer fixing the stub), and listeners re-bound on every drawer open (open the drawer 5 times, then add one blocker: exactly one POST).
Re-shoot the screenshots you changed. Tree clean at the end.
</extra_focus>
