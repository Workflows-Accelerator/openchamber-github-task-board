[@/workspace/code/openchamber-github-task-board/.agents/run/chamberos-board-v2/tasks/_common-build.md]

<goal>
Step A2 (issue #57, parent #55): the Canvas view. Infinite canvas with a dot grid that stays fine at any zoom, pan/zoom by mouse, trackpad and touch, real issue cards in V1's card style, and card positions saved on drop in a hidden HTML comment inside each issue body.
</goal>

<context_files>
[@/workspace/code/openchamber-github-task-board/.agents/run/chamberos-board-v2/decisions.md]
[@/workspace/code/openchamber-github-task-board/.agents/run/chamberos-board-v2/explore/discovery.md] (sections 2, 5, 6 — dot bug, bounds, layers)
Previous step proof: .agents/run/chamberos-board-v2/verifications/A1/proof.md
V1 canvas: tmp/chamberos_ai_native_github_openchamber_operating_system.html (canvas markup ~line 600-700, updateCanvasTransform ~2527, node body ~2271). V2 touch/pinch code for reference: tmp/webapp-v2.html ~1632-1675.
Server: web/server/board.ts (parseOrderMarker / setOrderMarker are the model for a hidden marker), web/server/app.ts (routes, CSRF), web/server/sections.ts.
</context_files>

<scope>
In:
1. Canvas view in the sidebar becomes real. Layers inside the plane in this order (bottom to top): wires (empty for now, A3), notes (empty for now, A4), cards, overlay. Plane has no fixed width/height.
2. Dot grid: never denser or darker when zoomed out. Either scale dot radius and opacity with zoom (fade out below ~0.5) or an SVG pattern that transforms with the plane; grid must pan with the content.
3. Zoom range about 0.2 to 2.5, zoom to cursor/pinch centre, zoom controls (zoom in/out, fit all, reset) in V1's restrained style. Pan by drag on empty space, wheel/trackpad scroll, two-finger touch; pinch zoom. Keyboard: +/- and 0 to reset when the canvas has focus.
4. Cards: real issues (same data as List, same project/search filter), V1 250px node style with friendly title, number, repo, status chip. Click opens the same drawer as List.
5. Positions: one hidden marker per issue, e.g. `<!-- board-canvas: {"x":420,"y":280} -->` (pick a name consistent with board-order; A4 will extend the same marker with notes, so make it a JSON object that can grow, e.g. {"x":..,"y":..,"notes":[...]} and preserve unknown keys). New server route (e.g. PUT /api/issues/:n/canvas with repo param like the existing routes, CSRF-protected) that reads the current body, replaces/inserts only the marker, writes back. Must not change anything else in the body (CRLF, code fences containing marker-like text, existing board-order marker). Unit tests for the marker parse/set like the existing order-marker tests, including a fenced-code example and a malformed marker.
6. Saved on drop only (not during drag); optimistic move, revert with a plain message if the save fails. Concurrent edit safety: re-read body right before writing (same approach as the order route).
7. Cards without a saved position: place them in a simple non-overlapping grid in free space to the right of positioned cards, NOT saved until the user drops them (the real Arrange comes in A4). Position is never written without a user action.
8. Canvas view state (pan/zoom) remembered locally per browser.
Out: links/wires, notes, Arrange, minimap (optional only if trivial and correct for an unbounded plane; skip otherwise).
</scope>

<criteria>
- Everything in <common_criteria> from the shared header.
- Browser proof: pan far in each direction with no edge; screenshots of the dot grid at zoom 0.25, 1, 2 showing dots do not grow or darken when zoomed out; drag a card, reload, it stays; the fake GitHub body contains exactly one marker and is otherwise byte-identical; touch pan/pinch proven via CDP touch emulation.
- Server tests: marker parse/set, route happy path, CSRF rejection, GitHub failure path.
</criteria>

<output>Proof at .agents/run/chamberos-board-v2/verifications/A2/proof.md.</output>
