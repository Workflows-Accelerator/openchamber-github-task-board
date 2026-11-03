[@/workspace/code/openchamber-github-task-board/.agents/run/chamberos-board-v2/tasks/_common-build.md]

<goal>
Step C1 (issue #65, parent #55): quick capture. A text area (plus screenshots and links, the upload itself lands in C2) is all you fill in. The server asks the D1 model to structure it, the issue is created as a draft at once, and a "created — edit / undo" notice appears. Undo closes it as not planned and hides it.
</goal>

<context_files>
[@/workspace/code/openchamber-github-task-board/.agents/run/chamberos-board-v2/decisions.md] (U13, D8, D13, D19)
[@/workspace/code/openchamber-github-task-board/.agents/run/chamberos-board-v2/explore/discovery.md] (section 12; note the model there is wrong — use D13)
Previous proofs: verifications/A1..B4/proof.md
Server: web/server/config.ts (BOARD_* env pattern), web/server/app.ts (existing POST /api/issues), web/server/repositories.ts.
Existing D1 config shape (do NOT print the key; you may read field NAMES only): /workspace/.openchamber-data/classifier-endpoint.json
Issue body contract: /workspace/code/openchamber-config/.agents/skills/meta/orchestration/issue-lifecycle/SKILL.md
</context_files>

<scope>
In:
1. Config: BOARD_D1_MODEL (default openrouter/liquid/d1), BOARD_D1_BASE_URL (default https://ai.workflows.ac/v1/systemone), BOARD_D1_API_KEY (no default; never logged, never sent to the browser). Find from the existing classifier config/code how this endpoint is called (OpenAI-compatible chat completions path? check how OpenChamber's classifier calls it — search /workspace/code/openchamber-config and OpenChamber sources for "systemone"/"classifier-endpoint").
2. Server route POST /api/capture: input text (max ~8k chars), optional link list, optional asset URLs (from C2), optional repo hint (current project filter). Calls D1 with a strict JSON schema prompt: repo (must be one of the board's repos; else fall back to the hint or the default repo), technical title, friendly title (3-6 words), overview, acceptance criteria, open questions, priority, size. Validate and sanitise the reply (reject unknown repo, trim lengths, strip emoji, enforce label values). Timeout ~20s, one retry on invalid JSON. Then create the issue via the existing create path with labels status:draft + priority + size (only labels that exist; B1 labels may be missing), body in contract order, the user's raw text preserved verbatim in a "Original note" section, links and screenshots included.
3. If D1 is not configured or fails: do NOT invent structure. Create nothing automatically; show "D1 is unavailable (reason). Create as a plain draft with your text?" with a button that creates a draft whose title is the first line and body is the raw text. The text is never lost (keep it in the box and in local storage until success).
4. UI: sidebar "New issue" (icon, no "+" in text) and keyboard shortcut (n, or Ctrl/Cmd+K) open a compact capture box in V1 style. On success: card appears, notice "Created #N in repo — Edit / Undo" (Edit opens the drawer; Undo closes as not planned via state_reason=not_planned and removes it from view). Notice stays ~10s and is reachable by keyboard.
5. Replace any old multi-field create dialog from the old front end if any survived.
</scope>

<criteria>
- Everything in <common_criteria>.
- Server tests with a fake D1 server: good reply, invalid JSON then retry, unknown repo, timeout, missing key, emoji stripping, label filtering; key never appears in responses or logs (assert).
- Browser proof on the fake GitHub + fake D1: capture, notice, edit, undo.
- ONE real D1 call is allowed, if a key is available WITHOUT printing it: read the key from the classifier config into the env of a local test process only (e.g. a node script that reads the file and calls D1 with a harmless sample text), record the structured reply (no key) in the proof. Do not create a real GitHub issue.
</criteria>

<output>Proof at .agents/run/chamberos-board-v2/verifications/C1/proof.md.</output>
