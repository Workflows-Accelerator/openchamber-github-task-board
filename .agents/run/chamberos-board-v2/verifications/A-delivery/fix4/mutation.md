# Fix4 — Guard-Clause Mutation Proof (hostile3 unfinished check)

Date: 2026-11-08. This proves that `web/tests/a5-sections.test.mjs` detects the removal or inversion of each clause in the outage guards in `web/server/app.ts`. The guards are at line 1332 (`archiveData`) and line 1421 (`operationsData`).

Original guard, identical at both sites:

```ts
      if (discovery.repositories.some((r) => r.available) && (board.repositoriesLoaded ?? 0) === 0) {
```

## Isolation

- Disposable copy: `git archive 59e5d05 | tar -x -C /tmp/opencode/fix4-mutation/base`, with `node_modules` symlinked to `/workspace/code/openchamber-github-task-board/node_modules`. No `git worktree` was used.
- `cmp /tmp/opencode/fix4-mutation/base/web/server/app.ts web/server/app.ts` shows no difference.
- Each mutant is a separate copy of `base/` (`/tmp/opencode/fix4-mutation/m-<line>-<kind>/`). Each copy has exactly one changed line, produced by `raw/mutation/mutate.mjs`. That script refuses to write if the exact original line is not present at the given line number.
- Each mutant's diff against `base` is 4 lines (one changed line): `raw/mutation/m-*.diff`.
- The real worktree's `web/server/app.ts` was never edited. `git diff 59e5d05 -- web/` is empty.

Command per copy (run inside the copy):

```bash
timeout 600 node --test --test-timeout=30000 web/tests/a5-sections.test.mjs
```

## Results

| Copy | Mutation | Exit | Tests | Failing test(s) (first failing assertion) |
|---|---|---|---|---|
| base | none | 0 | 11/11 pass | — |
| m-1332-dropAvailable | `if ((board.repositoriesLoaded ?? 0) === 0) {` | 1 | 10 pass, 1 fail | `multi-repo Operations and Archive failure modes: total outage, partial per-repo failure, and cached fallback`. Expected 200, got 502 at `a5-sections.test.mjs:601` (block 4, sole known repository becomes unavailable: archive) |
| m-1332-dropLoaded | `if (discovery.repositories.some((r) => r.available)) {` | 1 | 10 pass, 1 fail | same test. Expected 200, got 502 at `:470` (block 1, partial per-repo failure: archive) |
| m-1332-invert | `... && (board.repositoriesLoaded ?? 0) !== 0) {` | 1 | 10 pass, 1 fail | same test. Expected 200, got 502 at `:470` |
| m-1421-dropAvailable | `if ((board.repositoriesLoaded ?? 0) === 0) {` | 1 | 10 pass, 1 fail | same test. Expected 200, got 502 at `:597` (block 4, sole known repository becomes unavailable: operations) |
| m-1421-dropLoaded | `if (discovery.repositories.some((r) => r.available)) {` | 1 | 9 pass, 2 fail | `multi-repo All Projects Operations aggregates multiple repositories and handles discovery failure` (got 502 at `:394`) and the failure-modes test (got 502 at `:463`, block 1 partial per-repo failure: operations) |
| m-1421-invert | `... && (board.repositoriesLoaded ?? 0) !== 0) {` | 1 | 9 pass, 2 fail | same two tests as above. Got 502 at `:394` and `:463` |

Each of the six mutants (three mutations at each of two sites) fails at least one named test. The unmutated copy passes 11/11. Full TAP output is in `raw/mutation/<copy>.log`.

Limit: these mutants cover only the three requested clause mutations. Other guard mutations were not tested, for example removing the `discoveryFailed` check or changing `?? 0`.
