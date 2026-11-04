[@/workspace/code/openchamber-github-task-board/.agents/run/chamberos-board-v2/tasks/_common-build.md]

<role>
You are the L4 hostile reviewer for Step A3 (issue #58, blocked-by links). The build was done by another session at tip cbe5634 (45d8c7f, 7b1e2e6, 7b255be, cbe5634 on top of dd9e8ac). Treat its work as yours to break. You are the ONLY session in this worktree. Wrap every test or long command in `timeout`.
</role>

[@/workspace/code/openchamber-github-task-board/.agents/run/chamberos-board-v2/tasks/_hostile.md]

<step_brief>
[@/workspace/code/openchamber-github-task-board/.agents/run/chamberos-board-v2/tasks/task-A3-links.md]
</step_brief>

<manager_findings>
From the manager's screenshot and git check. Verify each; fix it or prove it wrong with evidence.
1. INVISIBLE WIRE: #105 blocks #104 (the drawer shows it) and they sit in the same row with #104 to the left. In canvas-wires-360.png and the drawer screenshot only two stubs show (one entering #104 from the left, one leaving #105 to the right). The middle runs UNDER the cards and is hidden. In canvas-wires-1280.png it is not visible at all. Backward or same-row links must be routed visibly (around the cards, or with ports chosen by relative position: right->left when the target is to the right, left->right or bottom/top otherwise). Every link must be visible and clickable at 0.25, 1 and 2 zoom.
2. UGLY BACKWARD CURVE: the dashed text link #101 -> #104 leaves #101's right port, curls back over #101's own body and drops to #104's left side. Same fix: pick ports and control points by relative position so a wire never crosses its own source or target card.
3. WIRE LAYER SIZE: the wire layer was sized to 50000x50000px to stop Chromium culling. Check that cards at NEGATIVE coordinates (the canvas is infinite; drag a card far up/left, and Fit all) still get wires, and the memory/paint cost of a 50000px SVG. Prefer a layer sized and offset to the actual bounding box of the wires (recomputed on change), or an equivalent that works in every direction.
4. SAFETY CHECK BYPASSED: api() skips isValidMutationPayload for /dependencies/ URLs because the routes return {success:true}. That guard exists to catch writes with an unknown outcome. Remove the bypass; make the dependency routes return a proper, validated payload (e.g. the updated blockedBy/blocking lists for the issue) and validate that shape on the client.
5. DELETE CONFIRM: canvas-wire-del-confirm-1280.png shows only a tiny red square with an x at 68% zoom. The brief says "click remove -> confirm inline". Make the confirm plain and readable at any zoom (screen-space size, e.g. a small "Remove link? Remove / Cancel" pill in the overlay layer, not scaled with the plane), keyboard reachable, Escape cancels.
6. ADD BLOCKER PICKER: the drawer uses a native <select> labelled "Select task to block this..." (confusing wording). The brief says "picker (search issues)". With 300+ issues across 26 repos a select is unusable. Make it a type-to-search field over the loaded issues (title, #number, repo), clear wording such as "Add a blocker: search issues", showing repo for cross-repo items. Same rule: refuse self, duplicate and cycle with a plain message.
7. FONT CHANGE: every A3 screenshot renders in a different typeface than A2 (DejaVu-like vs the A2 sans). Find out whether the font stack in theme.css/index.html changed in A3 or only the screenshot environment. If the app's font changed, restore A1/A2's stack. If it is the environment, say so in proof.md and make the screenshot script consistent with A2.
8. CROSS-REPO: the card is titled "Cross-repo dependency synchronization" but every card is in Core. Prove a real cross-repo link (blocker in Studio, blocked in Core) with the fake GitHub: listing, wire, drawer chip with repo name, add and remove. Follow the exact API from preflight.md Q1 (issue id vs number).
9. 403 / missing permission: prove each link control explains plainly (canvas drag, wire remove, drawer chips, picker), with a screenshot.
10. Touch: prove a port drag-to-connect with CDP touch emulation (screenshot plus the resulting request), and that a touch on a port does not pan the canvas.
11. Rate limit/batching: on load, count GitHub calls for the dependency data with 26 repos x 50 issues in the fake. Make sure there is no N+1 per card, and that a GraphQL error or a missing field degrades to "no wires" plus a plain notice, not a broken board.
12. A2 double-drop fix (45d8c7f): confirm the queue cannot deadlock if a save fails mid-queue (next drop must still save; the card must revert correctly).
Re-shoot all A3 screenshots after fixes (360/768/1280, light/dark, FR at 1280), including a zoom 0.25 and 2 shot of the wires.
</manager_findings>
