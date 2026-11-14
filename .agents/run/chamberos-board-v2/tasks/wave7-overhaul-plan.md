# Wave 7 Plan — Canvas Flow, Question/Progress UX & Lightweight Caches (D43 + D44)

Prerequisites:
1. Close Wave 6d/6e (`discovery-legibility`): receive L4 verdict from `ses_e5524a140430e6e9043c4fdc`, fix any P0/P1 findings (e.g., `forbidden` 403 -> `auth`, duplicated notice), re-verify, deploy live, and push `master`.
2. Clean up old password artifacts (`board.env.bak-20261113T181638Z`, `initial-password`) via user-confirmed bash block.

All Wave 7 application waves execute sequentially in `.worktrees/team-dev-board-v3` (because `web/server/app.ts` and `web/public/app.js` are shared), with failing tests first and independent L4 review before live deployment.

## Wave 7a — Server Foundations: Lightweight Caches, Sub-Issues, Layout State & Session Activity
- **Option A GitHub caches**: per-page `If-None-Match` ETags for multi-page `listIssues` (stops re-downloading 3 pages every 30s on 232-issue repos); ETag on `getIssue` detail reads; short TTL (60s, invalidated on link mutations) for `getIssueDependencies` GraphQL.
- **Parent / sub-issue GraphQL**: fetch native GitHub `parent { number, repository { nameWithOwner } }` alongside `blockedBy` so cards know their parent issue for grouping.
- **Server-only canvas layout state**: persist `canvas-layout.json` atomically under `BOARD_STATE_DIR` (positions `x, y`, `direction: 'LR' | 'TD'`, collapsed/expanded group keys) — zero GitHub writes on Arrange or drag.
- **Manual order (`<!-- board-order: N -->`)**: keep `parseOrderMarker` / `setOrderMarker` / `stripOrderMarker` + expose clear-order endpoint so manual overrides can be reset to auto order (`dependencies -> priority -> createdAt`).
- **Active agent session status**: read active session mapping (from OpenChamber/OpenCode session state and/or `openchamber-triggers` `/state` when configured, graceful fallback when unavailable) so the client distinguishes `activeSession` vs `status:in-progress` without an active agent.

## Wave 7b — Canvas Flow Overhaul (Replace Columns)
- Remove status columns on the canvas; render an **execution + mind-map flow graph**.
- **Configurable orientation**: `LR` default on desktop (`>= 768px`), `TD` default on narrow viewports (`< 768px`), persisted per viewport/user preference.
- **Exceptional deterministic auto-layout**: topological layering from `blockedBy`, intra-layer ordering by `board-order` -> `priority` -> `createdAt`, clean spacing, zero card overlap, clean dependency wires.
- **Grouping by repository + parent issue**: collapsed by default for 345-issue calm entry, showing group counters (`total`, `running`, `needs me`, `done`), expandable per group, auto-expanding matching groups on search/filter, and legible scale on 390px without 20% unreadable zoom.
- **Running indicator (CSP-clean CSS in `theme.css`)**:
  - Confirmed active agent session -> animated rotating green border (`@keyframes`).
  - `status:in-progress` with no active agent session -> steady distinct green border/tag.
- **Defer Triggers launch buttons** ("Pas encore").

## Wave 7c — Unified Counts, Progress Visibility & Question Legibility (Usability Audit Closure)
- **Single unified "Needs me" count** across sidebar, list, filters, Decisions, and Blocked; resolve "Blocked" dock vs filter ambiguity.
- **Progress everywhere**: `done/total` checklist and `answered/total` question ratios on list rows, canvas cards, and collapsed group headers.
- **Question & review polish**:
  - Distinct labels & plain human copy for missing artifact vs malformed artifact (no raw schema prose).
  - Fix "Reviewable link" filter to match review artifact URLs.
  - Deduplicate "Waiting for you" chrome above gates, fix FR leaks (`open`, `phase: execution`, `needs decision`, `Question`, `1 action`), keep `Answer` above the fold at 390 with Details expanded, clear stale answered-question badge on canvas, and raise dark-mode badge/meta contrast to `>= 4.5:1`.

## Wave 7d — Independent Hostile L4 Review + Live Release
- Full test suites (`web/tests/*.test.mjs`, `npm test`, `tsc`, `esbuild`) + real Chromium matrix (390/1280, light/dark, EN/FR, including 345-issue collapsed groups & active vs idle `in-progress` border states).
- Independent L4 hostile review -> fixes if any -> live deploy -> push `master`.
