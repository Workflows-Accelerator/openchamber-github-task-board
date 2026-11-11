# Verification Proof — Step V3-1: Universal Any-Repo Compatibility, Design Skills Adaptation & API Efficiency

## Summary
Step V3-1 establishes universal any-repo compatibility, adapts all design skills to the ChamberOS Task Board craft standards, improves GitHub API operational efficiency, and implements robust fallback mechanisms across the standalone task board server and client data projections:
1. **Design Skills Adaptation:** Replaced all project overrides in `.agents/skills/` from `Prompt and Furious` to authoritative `ChamberOS Task Board` standards across all 14 skill markdown documents.
2. **Universal Any-Repo Projections:** Extended issue representations with `EffectiveStage`, `resolveEffectiveStage`, `isExplicitDraft`, and `bodyMarkdown` while preserving `issue.column = resolveIssueColumn(issue)` unchanged for complete backward compatibility.
3. **GitHub API Efficiency & Conditional Revalidation:** Implemented weak ETags and conditional HTTP 304 Not Modified responses for `/api/repos`, `/api/board`, and `/api/combined/board` with `cache-control: no-cache`, while preserving `SECURITY_HEADERS['cache-control'] = 'no-store'` across all other routes.
4. **Force Refresh Bypass (`?refresh=1`):** Added explicit `?refresh=1` query parameter handling to bypass cached ETags and upstream 304s, forcing full synchronization.
5. **Zero-Waste GraphQL Dependency Skipping:** Upstream GraphQL `listRepositoryDependencies` queries are skipped entirely when a repository has 0 open issues, eliminating redundant API round-trips.
6. **Singleflight Request Coalescing:** Coalesced concurrent in-flight requests for repository boards, closed issues, and aggregate multi-repo boards to prevent burst rate-limit exhaustion.
7. **Rate Limit Telemetry:** Captured live GitHub API rate limit metrics (`limit`, `remaining`, `reset`, `resource`) via shared reference and exposed telemetry across repos and board endpoints without polluting deterministic ETag computation.
8. **Graceful Label Fallback:** Implemented automatic 403 and 422 retry on `POST /api/issues` and `POST /api/repos/:owner/:name/issues`, retrying without labels and returning `labelFallback: true` when target repositories restrict label permissions.

---

## Architectural & Design Implementations

### 1. Design Skills Adaptation
- Audited all 14 files in `.agents/skills/`:
  - `frontend-design/SKILL.md`
  - `web-design-guidelines/SKILL.md` & `web-design-guidelines/reference/guidelines.md`
  - `impeccable-critique/SKILL.md` & references (`adapt.md`, `craft-floor.md`, `critique.md`, `layout.md`, `polish.md`)
  - `ui-skills/SKILL.md` & references (`accessibility.md`, `design-critique.md`, `responsive.md`, `visual-polish.md`)
- Replaced `## Project Override (Prompt and Furious)` headers and references with `## Project Override (ChamberOS Task Board)`.
- Confirmed zero residual `Prompt and Furious` or podcast mentions across `.agents/skills/`.

### 2. Universal Any-Repo Projections & Backward Compatibility
- In `web/server/board.ts`:
  - Preserved `issue.column = resolveIssueColumn(issue)` byte-for-byte to maintain exact backward compatibility with existing board views and tests.
  - Exported `EffectiveStage` union type: `'draft' | 'backlog' | 'todo' | 'planned' | 'in-progress' | 'needs-human' | 'in-review' | 'done'`.
  - Added `resolveEffectiveStage(issue)` to map arbitrary repository issues (unlabeled, custom labels, closed states) into standardized operational stages.
  - Added `isExplicitDraft(labelsOrIssue)` to identify explicit draft markers (`status:draft` or `draft`).
  - Added `bodyMarkdown` on `IssueDetail` alongside `body` containing clean markdown text.
  - Exported `IssueSummary` type alias for `BoardListItem`.

### 3. API Efficiency, Weak ETags & 304 Handling
- In `web/server/github.ts`:
  - Added `ifNoneMatch` support to `listIssues` and `listRepositories`.
  - Upstream 304 responses return `{ items: [], notModified: true, etag }` without discarding cached entries.
  - Configured `rateLimitRef?: { current: RateLimitInfo }` to track rate limit headers on all responses.
- In `web/server/app.ts`:
  - Implemented `computeWeakEtag(payload)` hashing payloads with sha1, explicitly omitting volatile `rateLimit` and `fetchedAt` fields so ETags remain deterministic.
  - Implemented `etagMatches(header, etag)` supporting RFC 7232 weak comparison (ignoring `W/` prefixes and handling comma-separated lists / wildcards).
  - Attached weak `etag` and `cache-control: no-cache` headers to `/api/repos`, `/api/board`, and `/api/combined/board`.
  - 304 responses terminate with empty bodies (`res.end()`).
  - `SECURITY_HEADERS['cache-control'] = 'no-store'` remains active as default across all other endpoints.

### 4. Zero-Waste GraphQL & Singleflight Coalescing
- In `web/server/app.ts`:
  - `repositoryBoard()` inspects `(repository.openIssuesCount !== 0) && listed.items.some(i => i.state === 'open')` before invoking `client.listRepositoryDependencies()`. When 0 open issues exist, the GraphQL query is skipped completely.
  - Managed `inFlightBoards` and `inFlightClosed` maps to deduplicate overlapping concurrent calls for the same repository.
  - Coalesced multi-repository board aggregation via `aggregateInFlight`.

### 5. 403/422 Graceful Label Fallback
- In `web/server/app.ts`:
  - Wrapped `scopedGithub.createIssue({ title, body, labels })` in a try/catch block.
  - When encountering `GitHubError` with status 403 or 422 and non-empty `labels`, retries creation with `labels: []`.
  - Response carries `status: 201`, `ok: true`, `labelFallback: true`, and the created issue.
  - Applied to both `POST /api/issues` and `POST /api/repos/:owner/:name/issues`.

---

## Verification Evidence

### Automated Test Suites

1. **New V3-1 Dedicated Test Suite (`node --test web/tests/v3-api-anyrepo.test.mjs`):**
   - **7 passing tests** (0 failures).
   ```text
   # Subtest: conditional 304 and weak ETag revalidation for /api/repos, /api/board, and /api/combined/board
   ok 1 - conditional 304 and weak ETag revalidation for /api/repos, /api/board, and /api/combined/board
   # Subtest: query parameter ?refresh=1 forces fresh fetch and bypasses ETag 304 match
   ok 2 - query parameter ?refresh=1 forces fresh fetch and bypasses ETag 304 match
   # Subtest: zero-waste GraphQL dependency query skipping when repository has 0 open issues
   ok 3 - zero-waste GraphQL dependency query skipping when repository has 0 open issues
   # Subtest: singleflight request coalescing ensures concurrent board requests share single GitHub fetch
   ok 4 - singleflight request coalescing ensures concurrent board requests share single GitHub fetch
   # Subtest: rateLimit telemetry is exposed on repos, board, and combined endpoints without polluting ETags
   ok 5 - rateLimit telemetry is exposed on repos, board, and combined endpoints without polluting ETags
   # Subtest: effectiveStage, isExplicitDraft, bodyMarkdown, and backward-compatible column projection
   ok 6 - effectiveStage, isExplicitDraft, bodyMarkdown, and backward-compatible column projection
   # Subtest: graceful 403 and 422 label fallback on issue creation
   ok 7 - graceful 403 and 422 label fallback on issue creation
   1..7
   # tests 7
   # pass 7
   # fail 0
   ```

2. **Full Automated Unit & Integration Suite (`npm test`):**
   - **618 passing tests** (0 failures, 0 skipped).
   ```text
   1..618
   # tests 618
   # suites 0
   # pass 618
   # fail 0
   # cancelled 0
   # skipped 0
   # todo 0
   ```

3. **Web Server & Client Tests (`node --test --test-timeout=30000 web/tests/*.test.mjs`):**
   - **582 passing tests** (0 failures, 0 skipped).
   ```text
   1..582
   # tests 582
   # suites 0
   # pass 582
   # fail 0
   # cancelled 0
   # skipped 0
   # todo 0
   ```

4. **TypeScript Strict Typecheck (`npm run typecheck`):**
   - Clean compilation, 0 errors.
   ```text
   > openchamber-github-task-board@1.2.1 typecheck
   > tsc --noEmit
   ```
