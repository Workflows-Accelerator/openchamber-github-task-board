[@/workspace/code/openchamber-github-task-board/.agents/run/chamberos-board-v2/tasks/_common-build.md]

<goal>
Step A4 (issue #59, parent #55): markdown notes on the canvas that always belong to an issue and sit under the cards, and a new Arrange button that lays out cards by their blocked-by links.
</goal>

<context_files>
[@/workspace/code/openchamber-github-task-board/.agents/run/chamberos-board-v2/decisions.md] (D5, D15, D21, U4, U5)
[@/workspace/code/openchamber-github-task-board/.agents/run/chamberos-board-v2/explore/discovery.md] (sections 6, 7)
Previous step proofs: verifications/A2/proof.md (canvas marker format) and verifications/A3/proof.md (dependency data).
V2 sticky notes for reference only: tmp/webapp-v2.html ~1340-1360.
</context_files>

<scope>
In — Notes:
1. A note is created from a card (card hover action "Add note" and drawer button) and is attached to that issue. Stored inside the same hidden canvas marker introduced in A2 (extend the JSON, e.g. notes: [{id, x, y, w, h, text, color}]), saved on drop/resize/blur. No free-floating notes.
2. Drawn in the notes layer, under all cards and above wires. A faint connector line from note to its issue card.
3. Markdown: rendered (headings, bold, italic, links opening in a new tab with rel=noopener, lists, checkboxes as display, inline code, code blocks). Safe: escape HTML first; no raw HTML; links only http/https/mailto. Write a small local renderer or a vendored, license-compatible minimal library (no CDN). This renderer will be reused for the issue body in B2, so put it in its own module with unit tests.
4. Double click / Edit to edit as plain textarea; blur or Ctrl+Enter saves; Escape cancels. Delete note asks for confirmation inline. Resize handle. A few muted V1-palette colours that also work in dark theme.
5. Long markers: keep the issue body sane (cap note length e.g. 4000 chars with a visible counter; refuse to save if the GitHub body limit would be exceeded, with a plain message).
In — Arrange:
6. Replace any existing auto-layout. Pure function module with unit tests: input cards (id, project, w, h, blockers), output positions.
   - Group by project: each project is a horizontal band, bands stacked vertically with a gap, project label drawn at band start.
   - Within a band: rank = longest path from roots over blocked-by edges within the band (cross-project links do not change rank but are still drawn). Cycles broken deterministically.
   - Columns left to right by rank; within a column order by barycenter of blockers' positions (a few sweeps) to reduce crossings, ties by issue number.
   - Spacing from V1 (about 370px column pitch, 195px row pitch for 250px cards); no overlaps guaranteed by construction; deterministic.
7. Arrange runs only when the button is pressed. It confirms first ("Arrange N cards? Cards you placed by hand will also move.") with an option "Only cards without a saved place" (default). Then saves positions in batches with progress and a failure summary; notes move with their issue. Undo last Arrange (restore previous positions) while the page is open.
8. Nothing moves on load, poll, or filter change.
Out: sidebar sections (A5).
</scope>

<criteria>
- Everything in <common_criteria>.
- Unit tests: layout (chains, diamonds, cycles, isolated cards, multi-project, 300 cards, determinism, no overlaps), markdown renderer (XSS payloads, javascript: links, nested lists), marker extension keeps unknown keys and A2 positions.
- Browser proof: note renders markdown, sits under a card when overlapping, survives reload; Arrange result screenshot on a fake dataset with chains across two projects; "only unplaced" mode leaves placed cards still.
</criteria>

<output>Proof at .agents/run/chamberos-board-v2/verifications/A4/proof.md.</output>
