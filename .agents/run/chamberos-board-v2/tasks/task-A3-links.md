[@/workspace/code/openchamber-github-task-board/.agents/run/chamberos-board-v2/tasks/_common-build.md]

<goal>
Step A3 (issue #58, parent #55): links between issues on the canvas are GitHub's native "blocked by" issue dependencies. Show them as wires, add one by dragging from a card's port to another card, delete one by clicking the wire or a chip in the drawer. All persisted on GitHub.
</goal>

<context_files>
[@/workspace/code/openchamber-github-task-board/.agents/run/chamberos-board-v2/decisions.md] (D6)
[@/workspace/code/openchamber-github-task-board/.agents/run/chamberos-board-v2/explore/preflight.md] (Q1: exact dependency API, permissions)
[@/workspace/code/openchamber-github-task-board/.agents/run/chamberos-board-v2/explore/discovery.md] (section 11)
Previous step proof: .agents/run/chamberos-board-v2/verifications/A2/proof.md
Server: web/server/github.ts (client), web/server/board.ts (existing "Blocked by #N" text parsing ~line 172), web/server/app.ts, web/tests/fake-github.mjs (extend it to emulate the dependency endpoints faithfully, including error shapes).
</context_files>

<scope>
In:
1. Server: routes to list, add and remove blocked-by dependencies for an issue, CSRF-protected, using the exact GitHub endpoints recorded in preflight.md Q1. Cross-repo dependencies supported if the API allows them (issue id vs number — follow the API precisely). Include dependencies in the board payload (or a batched fetch) so wires render without N+1 requests per card on every load; cache sensibly and respect GitHub rate limits.
2. Existing text "Blocked by #N" lines: show them too, but visually distinct ("text link"), with an option in the drawer to convert to a native link. Do not delete text lines automatically.
3. Canvas: wires as smooth curves from blocker (left/right port) to blocked card, arrow toward the blocked card. Colour by blocker state (done = calm/green, open = neutral, blocker needs-human = warning). Wide transparent hit area; hover highlights and shows a small remove button; click remove -> confirm inline -> DELETE on GitHub -> wire disappears; failure reverts with a plain message.
4. Create: drag from a port to another card; preview wire follows the pointer; drop on a card creates "target blocked by source" (state this direction in the UI tooltip). Reject self-links and duplicates; detect and refuse a cycle with a plain message.
5. Drawer: "Blocked by" and "Blocking" chip lists with remove buttons, plus an "Add blocker" picker (search issues). Same server routes.
6. List view: small "blocked by N" indicator.
7. If the token lacks permission, every link control explains that plainly instead of failing silently.
Out: notes, Arrange.
</scope>

<criteria>
- Everything in <common_criteria>.
- Server tests against the fake GitHub: list, add, remove, duplicate, cycle refusal, 403/404/422 paths.
- Browser proof: existing links render; create by drag; delete by wire click; delete by drawer chip; reload shows GitHub's state; touch drag works.
- One READ-ONLY live call is allowed to confirm the response shape with the ambient gh auth; no live writes.
</criteria>

<output>Proof at .agents/run/chamberos-board-v2/verifications/A3/proof.md.</output>
