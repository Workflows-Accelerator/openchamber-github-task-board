[@/workspace/code/openchamber-github-task-board/.agents/run/chamberos-board-v2/tasks/_common-build.md]

<goal>
Step C4 (issue #68, parent #55), STAGING ONLY: document every environment variable, build a release artifact of the new board exactly the way live releases are built, and run it as a non-production preview so the user can review batches A-C in the morning. Do NOT switch the live board, do NOT touch /workspace/releases/board/current, do NOT push.
</goal>

<context_files>
[@/workspace/code/openchamber-github-task-board/.agents/run/chamberos-board-v2/decisions.md] (U10, D11, D29)
[@/workspace/code/openchamber-github-task-board/.agents/run/chamberos-board-v2/explore/preflight.md] (Q4: release build, supervisor, env names, rollback)
Previous proofs: verifications/A1..C3/proof.md
web/README.md, web/server/config.ts
</context_files>

<scope>
In:
1. web/README.md (and an env example file with NO values, e.g. web/board.env.example) listing every BOARD_* variable: purpose, required/optional, default, secret yes/no, and how to generate (e.g. hash-password tool).
2. Build the release artifact into a NEW directory under /tmp/opencode/board-v2-staging/<sha>-<date>/ (not /workspace/releases) using the same build + checksums procedure the live releases use; verify checksums.
3. Start it as a preview on a free loopback port (e.g. 127.0.0.1:4041) in the background with:
   - a throwaway BOARD_SESSION_FILE under /tmp/opencode/board-v2-staging/,
   - BOARD_GITHUB_TOKEN: do not read or print the live token. If preflight shows a safe way to run the preview against real GitHub read-mostly without exposing the token (e.g. the supervisor's env file can be passed to the process via the same mechanism the supervisor uses, without printing it), use it; otherwise run the preview against the fake GitHub with a rich synthetic dataset that covers every feature, and say clearly that the live-data check happens after approval.
   - D1 / OpenChamber settings in the same manner.
   Record exactly how to start/stop the preview and its URL. Leave it running.
4. Write the exact live switch + rollback procedure (commands, in order) into .agents/run/chamberos-board-v2/verifications/C4/live-switch.md for the manager to run after the user's approval. Include: merge feat/chamberos-board-v2 into master, push master, build release into /workspace/releases/board/<sha>-<date>, update env (new vars), point current to it, supervisor restart method, live checks (sign-in, List loads issues, Canvas, drawer), rollback to 98261a8-20261103.
Out: performing any live switch.
</scope>

<criteria>
- Everything in <common_criteria> that applies; npm test + type check on the final branch head.
- Preview reachable: curl -s http://127.0.0.1:<port>/health -> ok; a browser run through sign-in, List, Canvas, drawer on the preview with screenshots.
</criteria>

<output>Proof at .agents/run/chamberos-board-v2/verifications/C4/proof.md; live-switch.md as above. Reply includes the preview URL and how it is fed (real or fake data).</output>
