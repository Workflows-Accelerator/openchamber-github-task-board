<env_preflight>
Repo: /workspace/code/openchamber-github-task-board
Worktree: /workspace/code/openchamber-github-task-board/.worktrees/team-dev-board-v3
Branch: feat/board-v3
HEAD: 210c010. Tracked tree clean; untracked .agents/run/chamberos-board-v2/verifications/V4-1-L4/ is OFF LIMITS.
Root checkout on ops/task-board-activation: never edit, commit or switch there.
Live site: https://board.workflows.ac serves b85676f-20261113. Signed-out load only; never sign in against production, never read board.env, tokens or cookies.
Chromium: source .agents/run/chamberos-board-v2/verifications/V4-2/scripts/browser-env.sh.
Environment: the container was recreated today and workers have been killed mid-turn. Commit early, in small steps.
Forbidden: push, deploy, /workspace/releases/**, /workspace/code/openchamber-config/**, /workspace/.openchamber-data/**, GitHub writes, credential output, `git remote -v`, deletion, delegation, weakening a test.
</env_preflight>

<goal>
Make a discovery failure say what actually happened. Today the board shows one sentence for a refused token, a rate limit and a network failure, and `web/server/repositories.ts` throws the original error away (`catch {}` around line 91). The owner cannot tell whether to act or wait — that is part of why the board feels alarming.
</goal>

<context>
Evidence: .agents/run/chamberos-board-v2/verifications/b85676f-20261113/discovery-failure.md (read it first; it names the payload, the UI line `app.js:6315` and the discarded error).
`GitHubError` carries a `kind` — read the union in `web/server/github.ts` rather than guessing it, and read how `rate_limited` vs `server` vs `network` vs a refused credential are distinguished.
Today's real incident: a transient GitHub error latched `discoveryFailed` for 60 seconds; the payload carried only a generic English sentence and the registry kept no cause. Health, login and the token were fine.
</context>

<scope>
1. Server: keep the last discovery failure's kind and a short, safe reason in the registry view (never a token, never a raw upstream body). Keep the existing fields and their meaning; add rather than repurpose. The 60-second retention and the "last known identities retained" behaviour stay exactly as they are.
2. Payload: the discovery and aggregate responses must carry the cause in a machine-readable form the client can switch on, for example `errorKind: 'auth' | 'rate_limited' | 'network' | 'server'` alongside the existing `error` sentence.
3. Client: replace the single sentence at `web/public/app.js` (~line 6315) with four distinct, honest messages, EN and FR, key-for-key equal:
   - refused credential → the board cannot read GitHub because the token was refused; someone must renew it;
   - rate limited → GitHub is limiting the board temporarily, with the reset time when the server knows it;
   - network → GitHub is unreachable from the server; try again shortly;
   - anything else → the generic sentence that exists today.
   Each message says what the person should do or that nothing is required of them. No emoji, no exclamation, no "n8n", no "mobile", no inline style, no new dependency.
4. If the same generic sentence is used by the aggregate `failures[]` rows or the task drawer, make those consistent too — same wording, same source of truth.
</scope>

<steps>
1. Write the failing tests first: one per kind at the API level, plus one client test per kind in EN and FR. Extend the existing fake GitHub helpers to simulate a refused credential, a rate limit with a reset time, and a network failure; do not fake at the wrong layer.
2. Implement minimally. No refactor beyond what the tests need.
3. Run: focused new tests, the full web suite (`node --test --test-timeout=60000 web/tests/*.test.mjs`), `npm test`, `npm run typecheck`, esbuild for web/server.ts and the client.
4. Prove it in a real browser: at 390x844 and 1280x900, light and dark, EN and FR, force each of the four causes with the fixture and capture `discovery-{kind}-{width}-{theme}-{lang}.png`. Assert the visible sentence differs per kind, that no two kinds share a sentence, and zero console/page/CSP errors.
5. Record the evidence in .agents/run/chamberos-board-v2/verifications/discovery-legibility/README.md with the four sentences, the captures and the counts. Commit source and tests separately from the evidence, as `fix(board): name the cause of a discovery failure` and `test(board): record discovery failure legibility`.
</steps>

<output>
At most 12 lines: STATUS, KINDS (the four, with the sentence each shows in EN), FILES, TEST_COUNTS with exit codes, BROWSER (rows, failures, captures), WHAT_THE_PERSON_IS_TOLD_TO_DO per kind, COMMITS, NOT_VERIFIED. No claim of publication.
</output>
