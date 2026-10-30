# Aligned Decisions — Simplified Views, Draft List, Short Names, Stay Signed In

**Date:** Thu Oct 29 2026
**Source:** user message after the #46 release + question gate answers.

## Findings (manager, verified live)
- Live server (`https://board.workflows.ac`) already serves the #46 build: no Align Drafts in `/` or `/app.js`.
- User still sees the old UI because `web/public/sw.js` uses a fixed cache name (`workflows-board-v1`) with cache-first for `/`, `/app.js`, `/theme.css`. The installed app never picks up new releases. Uninstalling the PWA does not clear the cache.
- Logins drop because sessions live in an in-memory `Map` (`web/server/auth.ts`): 2h idle / 12h absolute, and every server restart signs everyone out.
- Chrome desktop does not offer the saved password: the login form has only a password field (no username field).

## Decisions
- D47 Updates reach users: the app must always load the newest release after a deploy (network-first for the app shell, versioned cache, old caches dropped, a visible "updated" path). This is a hotfix and ships first.
- D48 Stay signed in: 30 days per device, survives server restarts, sign out still revokes immediately.
- D49 Saved passwords work on desktop Chrome and phones (login form gets a username field Chrome recognises).
- D50 Draft order is stored on GitHub so phone, desktop and extension show the same order.
- D51 Short project names: derived automatically from the repo name (drop org and filler such as `openchamber-`, `github-`), renamable once per project in settings. Example: `Workflows-Accelerator/openchamber-github-task-board` -> `Task Board`. Used everywhere a repo name shows today.
- D52 One model for looking at tasks, identical in extension and web board: **View** + **Filter** + **Sort**.
  - Views: Simple list (default), Cards, Kanban board, Graph, Pending items (today's Human Tasks view, which the user likes — keep its feel).
  - Filters: Needs me / human tasks, questions, status/stage (Draft, To do, In progress, Review, Done...), project.
  - Sort: priority, recency (updated/created), manual order.
  - Replaces today's mix of view tabs, status tabs and presets. Must be super user friendly yet configurable.
- D53 Simple list + Draft filter = quick capture (user screenshot): plain rows, title + optional description line under it, add at the bottom, drag to reorder. In All Projects, each row shows its short project name and lets you pick the project. The description is inspiration for the AI, not a formal spec.
- D54 Align Drafts stays extension-only (D42 unchanged).
- D55 Saved-draft project change: user selected "Confirm then move (Recommended)" on 2026-10-29. BOTH surfaces must ask for explicit confirmation, then use GitHub native transfer preserving the issue history. Issue number/URL may change and permission restrictions must be shown without copying, recreating or closing the task. No blind retries after an ambiguous transfer result. Cancel performs no write. This was scope approval, NOT L5 or release approval.
- D56 Human release approval 2026-10-29: user replied "Approved" to the combined #47/#48 review of staging ab7516c and the explicit request to merge to master, push, deploy to https://board.workflows.ac and close both issues, then "Continue". Release of this exact reviewed batch is authorized. It does not claim physical-device verification or grant unrelated source/config changes. See outputs/batch-simplify-human-approval.md.
- D57 Activation + correction alignment 2026-10-30: user selected "Activate + prepare fix (Recommended)". Authorizes safe loading of the exact reviewed extension code, preserving old branch/history, switching root to the reviewed master tree and extension-only service off/on + panel refresh using supported host lifecycle, never a full host restart. Also authorizes preparing #49 narrow visual-only login-label correction for independent review. #49 publication/deploy remains NOT authorized before L4 and fresh L5. Preserve all manager state across root branch switch; local ops continuation branch based exactly on master may hold new manager state without changing master or runtime product files. Any other active root writer, source mismatch or unsafe lifecycle requires STOP.

## Shared contracts (panel and web must implement identically)
- **Short name:** take the part after `/`; split on `-`, `_`, `.`; drop tokens (case-insensitive) in `{openchamber, github, gh, repo}`; Title Case each remaining token; join with a space. If nothing remains, Title Case the whole repo part. `Workflows-Accelerator/openchamber-github-task-board` -> `Task Board`. A user rename overrides it. Full `owner/repo` stays available as a tooltip/secondary text.
- **Draft order on GitHub:** hidden marker on its own line at the end of the issue body: `<!-- board-order: <number> -->`. Lower number first. Items without a marker sort after ordered ones, oldest created first. Prefer moving only the item's marker using a midpoint (first/last: neighbour -/+ 1000), but the former moved-item-only constraint is superseded: lazily initialise/rebalance neighbouring markers where needed to allow every requested destination among unmarked/mixed/equal/exhausted ranks. Writes use the existing conflict-safe update path for each issue; never imply a multi-issue GitHub transaction. The marker is never shown in rendered bodies.
- **View/Filter/Sort state:** remembered per device; defaults View = Simple list, Filter = none, Sort = priority.

## Execution plan
- Wave 1 (parallel, no shared files): Hotfix (web: sw.js, auth/session store, login form) + Panel simplification (panel/** only).
- Wave 2: Web board simplification (web/public/**) after the hotfix merges, reusing the same contracts.
- Known limitation to tell the user: project renames are stored per surface (extension settings vs board server) unless a later issue unifies them.
