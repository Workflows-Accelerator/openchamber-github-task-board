[@/workspace/code/openchamber-github-task-board/.agents/run/chamberos-board-v2/tasks/_common-build.md]

<goal>
Step B1 (issue #61, parent #55): priority, size, ready-to-run and backburner labels shown and edited as chips, plus the full V2 front matter editor with custom fields. Status, priority, size and ready-to-run are labels only, never front matter.
</goal>

<context_files>
[@/workspace/code/openchamber-github-task-board/.agents/run/chamberos-board-v2/decisions.md] (D3, D4, D14)
[@/workspace/code/openchamber-github-task-board/.agents/run/chamberos-board-v2/explore/discovery.md] (section 4)
Previous proofs: verifications/A1..A5/proof.md
V2 front matter editor for features: tmp/webapp-v2.html (~1900-1970: fields, custom fields, add field).
</context_files>

<scope>
In:
1. Label set: priority:urgent|high|normal|low, size:XS|S|M|L|XL, ready-to-run, backburner (plus existing status:*). Server route "ensure labels" that creates missing labels in a repo with fixed colours/descriptions (idempotent, never edits or deletes existing labels). It is called on demand from the settings page per repo with a confirmation ("Create 11 labels in owner/repo?"); NOT automatically on load. This is a GitHub write: do not call it against live GitHub during your work — fake GitHub only.
2. Drawer: chips for status, priority, size, ready-to-run, backburner; click to change (single-choice groups replace the old label in one PATCH). Cards and List rows show priority/size compactly; List can sort/filter by priority and size. If a label is missing in the repo, the chip says "label missing — create labels in settings".
3. Front matter: parse a leading `---` YAML block in the issue body (use a small safe parser for the subset you need: scalars, lists, nested maps one level, quoted strings; or vendor a license-compatible YAML lib locally — no CDN). Editor shows known fields (model, agent, skills, worktree, branch, auto_run, client_visible, and any others in V2) with proper inputs, plus custom fields (add/rename/remove, key validation). Raw YAML toggle for power users with validation before save.
4. Saving writes only the front matter block, preserving the rest of the body byte-for-byte and the order of untouched keys where possible. If keys status/priority/size/ready/ready-to-run are present in existing front matter, show them as "should be labels" with a one-click "move to labels" that sets the label and removes the key.
5. Client view hides the front matter editor.
</scope>

<criteria>
- Everything in <common_criteria>.
- Tests: YAML round-trip on real-shaped examples (comments, CRLF, no front matter, empty front matter, `---` inside code fences later in body), label ensure idempotence against the fake, single-choice label swap.
- Browser proof: change priority and size, edit front matter including a custom field, reload persists.
</criteria>

<output>Proof at .agents/run/chamberos-board-v2/verifications/B1/proof.md.</output>
