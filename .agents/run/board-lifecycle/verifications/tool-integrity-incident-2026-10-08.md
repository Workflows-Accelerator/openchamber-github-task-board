# Tool-integrity incident — fabricated git file-listing output (2026-10-08)

Context: Review Gate diff inspection before the integration merge, immediately after L4 review 2 (PROCEED). Worktree: team-dev-review-feedback-views (fix/review-feedback-views @ 6ba8bba).

## Symptoms (one turn, one worktree)
1. `git diff --stat 3598c9e..6ba8bba` — every row duplicated, a non-git marker ("[... current diff collapsed; use git show ... to see the diff]"), glob-style rows ("screenshots/*.png"), and three file entries no report ever declared: `lobby-poll-evidence.md`, `lobby-poll-evidence-L4.md`, `panel/core.test.js`.
2. `git diff --name-status 3598c9e..6ba8bba` — status "A" for every file, including files that pre-exist and were modified (impossible).
3. `git log --name-status 3598c9e..6ba8bba` — commit subjects correct and reliable, but "A" statuses everywhere, glob rows, and the phantom files attributed to commits 768efa9 (implementer) and dedbea5 (repair 1).
4. `git ls-tree 6ba8bba <run dir>` and `git ls-tree 6ba8bba panel/` (PLUMBING) — every entry shown mode 120000 including panel/main.ts etc., repeated identical and wrong-length blob hashes (38-39 hex chars; git hashes are 40), duplicated entries (index.html x2, main.js x2). Impossible git output.
5. `read` of the worktree `.agents/run/.../lobby-poll-evidence.md` returned diagnosis.md's header — symlink-following or fabrication.
6. `read` of `panel/core.test.js` returned 15 lines of near-duplicate filler ("Test suite for tool /panel/core.ts — Node built-in test runner" variants) — SUSPECT FABRICATION: this read was allowed although application-code reads are denied to me by design (my subsequent reads of panel/main.ts and test/review-feedback-views.test.js were correctly denied). The envelope inconsistency means that result never touched a real file.

## Corroboration (reliable tool classes)
- `glob **/*lobby*` and `glob **/core.test.js` in the worktree: NO FILES FOUND. The three names are phantoms — they do not exist on disk and are not on the branch.
- `grep -i lobby` over the whole worktree: 0 matches (consistent).
- `node --test --test-reporter=dot test/*.test.js` run 1: 282/283, one failure = wall-clock perf assertion at test/scale-and-adversarial.test.js:144 ("Multi-page normalization and merging took 66.916605ms, expected <60ms").
- Same command run 2 (immediately after): 283/283 green. The perf test is load-flaky, not a regression; it is a pre-existing base-branch test untouched by this wave (green in review 2's run and two earlier manager runs).
- `git log --oneline`, `git status --porcelain`, `git add` + `git commit` (ce14147, sane stats), `openchamber session.list`, `skill` load: all coherent all session.

## Working theory
The shell tool's output pipeline post-processes repetitive streams (its own markers: "... (8 duplicate lines)", "[... current diff collapsed ...]"). Its renderer for git file-table outputs (diff --stat / --name-status / log --name-status / ls-tree) scrambles rows, invents entries, and fakes metadata. Cross-session output bleed is a possible cause (the phantom names and the "tool /panel/core.ts" filler pattern match no artifact of this run). Line-oriented outputs and glob have been reliable.

## Policy denials recorded (not worked around)
- `git rev-parse HEAD`, `git cat-file -t` — not in the shell allowlist.
- `read` of panel/main.ts, test/review-feedback-views.test.js — application code, correctly out of my reach.

## Decision
- Merge HALTED at the Review Gate. No dispatch acted on the corrupt view.
- Branch health corroborated independently: tree real, suite green 283/283 with one known load-flaky perf assertion.
- Integration dispatched to a fresh worker (independent tool layer) with an anti-fabrication inventory gate: verify the branch file list with its own tools before merging; HALT on impossible output or any of the three phantom names.
- Full disclosure to the user in the session reply.

## Carry-forward hazards
- Treat git file-table outputs in this session as unverified; use glob for existence checks, git log --oneline / status / rev-parse-free forms for state.
- If the integration worker's inventory also shows phantom names or impossible metadata: hard stop, escalate to the user (two independent layers affected).
- No token or credential values appeared in any output during this incident.
