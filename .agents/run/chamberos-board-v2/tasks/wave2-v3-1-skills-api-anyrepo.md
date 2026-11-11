<env_preflight>
Repo: /workspace/code/openchamber-github-task-board
Worktree: /workspace/code/openchamber-github-task-board/.worktrees/team-dev-board-v3
Branch: feat/board-v3
Base commit: 4e92c01 (clean; brand-new worktree just created from 4e92c01; node_modules and web/node_modules not yet symlinked)
Main repo shared node_modules: /workspace/code/openchamber-github-task-board/node_modules and /workspace/code/openchamber-github-task-board/web/node_modules (if present; check `.worktrees/team-dev-chamberos-board-v2` symlink targets if root lacks `web/node_modules`)
Design skills source (READ ONLY): /workspace/code/prompt-and-furious-podcast/.worktrees/team-dev-prep-cockpit/.agents/skills/{frontend-design,ui-skills,web-design-guidelines,impeccable-critique}/
Key files: web/server/github.ts, web/server/repositories.ts, web/server/board.ts, web/server/app.ts, web/tests/fake-github.mjs, web/tests/v3-api-anyrepo.test.mjs
Test commands: npm test && node --test --test-timeout=30000 web/tests/*.test.mjs && npm run typecheck
Do not touch: panel/**, service/**, web/public/** (reserved for Stage V3-2), /workspace/code/openchamber-config/** (another session is working on global skills there), /workspace/code/prompt-and-furious-podcast/**, /workspace/releases/**, GitHub issue closures
Preflight facts are true and authoritative at dispatch: do not run initial discovery commands (git status, pwd, ls) to re-ground on startup. Re-inspect targeted state only for mutations/pre-commit verification, compaction/resume with stale facts, branch/location changes, or action failure.
</env_preflight>
<goal>Bootstrap `.worktrees/team-dev-board-v3`, install and ChamberOS-adapt the 4 design skills locally, and implement + regression-test GitHub API efficiency (`304 Not Modified`, zero-waste GraphQL skip, singleflight deduplication, HTTP ETag, passive rate-limit telemetry) and universal out-of-the-box usability for any vanilla GitHub repository.</goal>
<context_files>
[@/workspace/code/openchamber-github-task-board/.agents/run/chamberos-board-v2/decisions.md]
</context_files>
<skills>
[@/workspace/code/openchamber-config/.agents/skills/ship/worktree/management/SKILL.md]
[@/workspace/code/openchamber-config/.agents/skills/build/methodology/test-driven-development/SKILL.md]
[@/workspace/code/openchamber-config/.agents/skills/build/domain/api-and-interface-design/SKILL.md]
</skills>
<owned_paths>
.agents/skills/frontend-design/**
.agents/skills/ui-skills/**
.agents/skills/web-design-guidelines/**
.agents/skills/impeccable-critique/**
web/server/github.ts
web/server/repositories.ts
web/server/board.ts
web/server/app.ts
web/tests/fake-github.mjs
web/tests/v3-api-anyrepo.test.mjs
.agents/run/chamberos-board-v2/verifications/V3-1/**
</owned_paths>
<depends_on>
none
</depends_on>
<steps>
<step>1. Bootstrap worktree `.worktrees/team-dev-board-v3`: symlink `node_modules` (and `web/node_modules` if symlinked in `/workspace/code/openchamber-github-task-board/.worktrees/team-dev-chamberos-board-v2`) and register `/workspace/code/openchamber-github-task-board/.worktrees/team-dev-board-v3` in `~/.local/share/antigravity/antigravity.db` if that SQLite DB exists (adapting the `management` skill snippet to `~/.local/share/antigravity/antigravity.db`; skip gracefully if absent).</step>
<step>2. Copy and adapt the 4 design skills locally into `.worktrees/team-dev-board-v3/.agents/skills/{frontend-design,ui-skills,web-design-guidelines,impeccable-critique}/` (preserving all `SKILL.md`, `LICENSE.txt` if any, and `reference/*.md` files; NEVER write outside `.worktrees/team-dev-board-v3`). In each of the 4 `SKILL.md` files, remove `## Project Override (Prompt and Furious)` (which was written for a `#000000` video slide deck) and replace it with `## Project Override (ChamberOS Task Board)` codifying:
- Dual theme support: architectural high-craft Light and Dark palettes (no muddy `#F4F1EA` cream + terracotta AI tells; crisp neutral surfaces and hairlines).
- Typography & copy: sentence-case labels everywhere (zero ALL-CAPS tracked-out micro-labels, zero `A · B · C` middle-dot meta soup, zero slash-labels), `font-variant-numeric: tabular-nums` on all numbers/counts/percentages/timestamps, full EN + FR parity including `<html lang>`.
- Viewport & touch: `100dvh` zero-overhang app shell with `env(safe-area-inset-*)`, `>=44x44px` touch targets on coarse/narrow viewports, thumb-zone navigation on `<=768px`, single-row compact `#canvas-controls` strictly contained inside `#canvas-viewport`.
- Hard product invariants: preserve two-stop radial-gradient dot grid at `web/public/app.js:2268` untouched, Markdown sticky notes rendered under cards, topological `arrange.js`, views named `"Canvas"`/`"Canevas"` and `"List"`/`"Liste"` with sidebar navigation, zero `"n8n"`, zero word `"mobile"` anywhere in UI/DOM/CSS/code, zero emojis, no button with both a `+` icon and `"+"` text prefix, nothing fake/simulated, strict CSP `style-src 'self'` compatibility (zero inline HTML `style="..."` attributes).</step>
<step>3. Implement GitHub API efficiency in `web/server/github.ts`, `web/server/repositories.ts`, and `web/server/app.ts` (TDD with `web/tests/v3-api-anyrepo.test.mjs`):
- Conditional GET `If-None-Match` -> `304 Not Modified`: extend `GitHubClient.request` with optional `ifNoneMatch?: string | null` sending `'if-none-match'` header and returning `{ status: 304, headers, data: null }` on HTTP 304 without throwing.
- Support optional `ifNoneMatch` on `listRepositories` and page-1 `listIssues` (returning `{ notModified: true, etag, items: [], pages: 0, truncated: false, excludedPullRequests: 0 }` when page 1 returns 304). Fix the pagination fallback bug at `web/server/github.ts:414` where `state=all` was hardcoded instead of `state=${encodeURIComponent(stateFilter)}`.
- Track passive rate-limit telemetry on `GitHubClient` from response headers (`x-ratelimit-limit`, `x-ratelimit-remaining`, `x-ratelimit-reset`, `x-ratelimit-resource`) via `getRateLimitInfo()` with zero extra API calls.
- Populate `hasIssues: boolean`, `openIssuesCount: number | null`, and `pushedAt: string | null` on `GitHubRepositorySummary` and `RepositoryEntry` from `/user/repos`. In `RepositoryRegistry`, deduplicate concurrent `view()` calls (singleflight) and revalidate expired single-page cache with `If-None-Match` so unchanged repo lists cost 0 GitHub points on `304`.
- Zero-waste `repositoryBoard` & `repositoryClosedIssues` in `web/server/app.ts`:
  (a) Add singleflight in-flight deduplication (`Map<string, Promise<...>>`) per `repository.full` on both `repositoryBoard` and `repositoryClosedIssues`, cleared on completion and invalidated whenever any write mutates that repository.
  (b) When `repository.hasIssues === false`, return an empty complete board/closed result immediately (`0` REST calls, `0` GraphQL calls).
  (c) In `repositoryBoard`, add optional `{ forceRefresh?: boolean }`. When cache is within `defaultBoardCacheTtlMs` and `!forceRefresh`, return warm cache as today. When expired or `forceRefresh`, call `listIssues('open', { ifNoneMatch: cachedSinglePageEtag })` FIRST instead of blind parallel `Promise.all` with GraphQL:
      - If `listIssues` returns `notModified: true` (`304`), reuse `cached.rawIssues`, refresh `cachedAt = now()`, and if `!forceRefresh` and `cached.depsCachedAt` is within `Math.max(defaultBoardCacheTtlMs, 120_000)`, reuse `cached.deps` WITHOUT calling `/graphql`! (If `forceRefresh` or deps TTL expired AND `cached.issues.length > 0`, refresh `fetchRepoDependenciesGraphQL` and rebuild issue views).
      - If `listIssues` returns `200`, filter out PRs; if `0` open issues remain, skip `fetchRepoDependenciesGraphQL` completely (`0` GraphQL calls!). Only call `fetchRepoDependenciesGraphQL` when `>= 1` open non-PR issue exists!
- Server HTTP weak `ETag` + `If-None-Match` -> `304 Not Modified` on GET `/api/board`, `/api/repos/:owner/:name/board`, and `/api/combined/board`, plus `?refresh=1` query support to trigger conditional GitHub revalidation (`forceRefresh: true`) and include `rateLimit` metadata on board/repository responses.</step>
<step>4. Implement out-of-the-box usability for ANY vanilla GitHub repository in `web/server/board.ts` and `web/server/app.ts`:
- Preserve `issue.column = resolveIssueColumn(issue)` 100% unchanged so all existing tests (`board.test.mjs`, `a5-sections.test.mjs`, `a5-presentation-audit.test.mjs`) pass without regressions.
- Add `effectiveStage: 'draft' | 'backlog' | 'todo' | 'planned' | 'in-progress' | 'needs-human' | 'in-review' | 'done'` and `isExplicitDraft: boolean` on both `IssueSummary` and `IssueDetail` (exported helper `resolveEffectiveStage(issue)`):
  - `isExplicitDraft` is `true` ONLY when labels explicitly contain `'status:draft'` or `'draft'` (case-insensitive).
  - For `effectiveStage`: if `state === 'closed'` or `statusLabel === 'status:done'` -> `'done'`; else if `statusLabel` is present (`status:todo`, `status:in-progress`, etc.) -> `statusLabel.slice('status:'.length)`; else inspect standard non-prefixed GitHub labels case-insensitively (`in progress`/`in-progress`/`wip`/`doing` -> `'in-progress'`, `in review`/`in-review`/`review`/`needs-review` -> `'in-review'`, `needs-human`/`needs human`/`blocked`/`waiting` -> `'needs-human'`, `planned`/`ready` -> `'planned'`, `backlog`/`icebox`/`later` -> `'backlog'`, `draft` -> `'draft'`); otherwise default open vanilla GitHub issues to `'todo'`!
- Add `bodyMarkdown: string` on `IssueDetail` containing `stripHiddenMarkers(issue.body ?? '')` (without stripping normal Markdown headings, lists, links, or code fences) so Stage V3-2 can render rich vanilla GitHub issue bodies cleanly when ChamberOS contract sections are absent.
- Graceful label fallback on issue creation (`POST /api/issues` and `POST /api/repos/:owner/:name/issues`): if `createIssue({ title, body, labels })` fails with `GitHubApiError` status `403` or `422` when `labels` is non-empty (e.g. token can open issues on a repo where it lacks label-creation permission), retry `createIssue({ title, body })` without labels and return `201` with `labelFallback: true` instead of failing!</step>
<step>5. Upgrade `web/tests/fake-github.mjs` with opt-in `honorIfNoneMatch` support on `/user/repos` and `/repos/:owner/:repo/issues` (plus `x-ratelimit-*` headers) without altering default behavior for existing tests. Author `web/tests/v3-api-anyrepo.test.mjs` covering every new behavior above, run all 3 suites (`npm test`, `node --test --test-timeout=30000 web/tests/*.test.mjs`, `npm run typecheck`), write `.agents/run/chamberos-board-v2/verifications/V3-1/proof.md`, and commit cleanly on `feat/board-v3`.</step>
</steps>
<criteria>
1. All 4 adapted design skills + `reference/*.md` files exist under `.worktrees/team-dev-board-v3/.agents/skills/` with zero Prompt-and-Furious slide-deck overrides remaining and zero edits outside `.worktrees/team-dev-board-v3`.
2. `304 Not Modified` revalidation works on both `listRepositories` and single-page `listIssues`; repos with `has_issues: false` or `0` open issues trigger `0` GraphQL calls; concurrent requests are singleflight-deduplicated; GET board endpoints honor `If-None-Match` (`304`) and `?refresh=1`.
3. Vanilla GitHub issues without `status:*` labels keep `column` backward-compatible while exposing `effectiveStage: 'todo'` (or mapped standard label), `isExplicitDraft: false`, and `bodyMarkdown` on `IssueDetail`; issue creation retries cleanly without labels on `403`/`422`.
4. `panel/**`, `service/**`, and `web/public/**` have zero diff vs `4e92c01`.
5. `npm test` (618/618), `web/tests/*.test.mjs` (all pass including new `v3-api-anyrepo.test.mjs`), and `npm run typecheck` (exit 0) all pass on clean tree.
</criteria>
<verification>
npm test && node --test --test-timeout=30000 web/tests/*.test.mjs && npm run typecheck
</verification>
<output>
Respond in concise structured Markdown with:
- STATUS: PASS | FAIL
- COMMITS: exact commit SHAs on feat/board-v3
- DESIGN_SKILLS: installed skill paths and confirmation that Prompt-and-Furious overrides were replaced
- API_EFFICIENCY_PROOF: exact request-count reductions proven in v3-api-anyrepo.test.mjs (cold vs 304 revalidation, 0-open-issue GraphQL skip, has_issues=false skip, singleflight)
- ANY_REPO_PROOF: summary of effectiveStage, isExplicitDraft, bodyMarkdown, and 403/422 label fallback tests
- TEST_COUNTS: legacy tests, web tests, typecheck exit code
- NOT_VERIFIED: explicit items deferred to V3-2/V3-3 (frontend UI wiring, live browser smoke)
</output>
