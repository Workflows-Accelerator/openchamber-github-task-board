[@/workspace/code/openchamber-github-task-board/.agents/run/chamberos-board-v2/tasks/_common-build.md]

<goal>
Step C2 (issue #66, parent #55): screenshots pasted, dropped or picked in quick capture, the body editor or a comment are committed to a separate `board-assets` branch in that issue's repository and linked into the issue.
</goal>

<context_files>
[@/workspace/code/openchamber-github-task-board/.agents/run/chamberos-board-v2/decisions.md] (D9, D20)
[@/workspace/code/openchamber-github-task-board/.agents/run/chamberos-board-v2/explore/preflight.md] (Q2: contents write permission)
Previous proofs: verifications/A1..C1/proof.md
</context_files>

<scope>
In:
1. Server route POST /api/assets (CSRF, size limit e.g. 10 MB, types png/jpeg/gif/webp only, sniff magic bytes, strip nothing else). Writes via the GitHub contents API to branch `board-assets` at path `assets/YYYY/MM/<sha256-prefix>-<safe-name>.<ext>`; creates the branch if missing as an ORPHAN-like branch (a commit with only a README explaining the branch) — never based on or merged into the default branch. Same content = same path (dedupe). Returns the https URL usable in markdown (raw or github.com/.../blob/...?raw=true — pick one that renders inside GitHub issues for private repos; document why).
2. Board shows these images: if the repo is private, raw URLs need auth — serve them through a board proxy route (GET /api/assets/:repo/*path) that fetches with the server token, with strict path validation and caching headers; the markdown in the issue uses the GitHub URL that works on github.com, and the board rewrites it to the proxy when rendering.
3. UI: paste/drop/pick in capture box, body editor and comment box; progress; insert markdown image at cursor; errors plain ("This repository does not allow the board to save files" for 403/404 on write).
4. Fake GitHub emulates the contents API and refs API.
</scope>

<criteria>
- Everything in <common_criteria>.
- Tests: type sniffing, size limit, path safety (../, encoded), dedupe, branch creation once, 403 path, proxy path validation.
- Browser proof on the fake: paste an image into capture, it appears in the created issue on the board.
- No live writes.
</criteria>

<output>Proof at .agents/run/chamberos-board-v2/verifications/C2/proof.md.</output>
