<env_preflight>
Repo: /workspace/code/openchamber-github-task-board
Worktree (work ONLY here): /workspace/code/openchamber-github-task-board/.worktrees/team-dev-chamberos-board-v2
Branch: feat/chamberos-board-v2 (base a8ccc7a, prototypes committed at 62dd215). Clean at dispatch.
node_modules is symlinked from the root checkout. Test command: npm test (baseline 618/618 passing).
GitHub issue: Workflows-Accelerator/openchamber-github-task-board#56 (parent #55).
Do not touch: /workspace/releases/board/**, running processes (live board, OpenChamber on port 3000), /workspace/config/opencode/**, /workspace/.openchamber-data/**, any .env* / board.env / credential file, /proc/*/environ, panel/** and service/** (the OpenChamber panel must stay untouched), the root checkout outside this worktree. No git push. No live GitHub writes (no issue/label edits). Never print secrets. Zero emojis anywhere (code, UI text, commits).
Preflight facts are authoritative: do not re-run discovery commands (pwd, ls, git status) to re-ground on startup.
</env_preflight>

<goal>
Step A1 of the Board V2 rebuild: the V1 HTML prototype becomes the web board front end (web/public), wired to the existing web server (web/server), showing REAL issues in a List view, with a sidebar instead of a top bar, warm-paper light theme plus a matching dark theme that follows the device, and an English/French switch. Later steps add the canvas, links, notes, sidebar sections, etc. — build the shell so they slot in, but do not build them now.
</goal>

<context_files>
[@/workspace/code/openchamber-github-task-board/.agents/run/chamberos-board-v2/decisions.md]
[@/workspace/code/openchamber-github-task-board/.agents/run/chamberos-board-v2/PLAN.md]
[@/workspace/code/openchamber-github-task-board/.agents/run/chamberos-board-v2/explore/discovery.md]
V1 prototype (the design to follow): tmp/chamberos_ai_native_github_openchamber_operating_system.html
V2 prototype (reference only, later steps): tmp/webapp-v2.html
Server: web/server/app.ts (routes, CSP ~line 104 is script-src 'self'), web/server/config.ts, web/server/board.ts, web/server/sections.ts
Old front end being replaced: web/public/index.html, app.js, theme.css, sw.js, manifest.json; its tests under web/tests/
Prior history: the live board currently reports "The issues never load." (/workspace/code/openchamber-github-task-board/.agents/run/task-centred-architecture/mission.md, D66). Find the root cause in the current code path and make sure the new board cannot have it.
</context_files>

<skills>
[@/workspace/code/openchamber-config/.agents/skills/build/domain/frontend-ui-engineering/SKILL.md]
[@/workspace/code/openchamber-config/.agents/skills/build/methodology/lean-build/SKILL.md]
[@/workspace/code/openchamber-config/.agents/skills/verify/browser/browser-testing-with-devtools/SKILL.md]
[@/workspace/code/openchamber-config/.agents/skills/verify/ladder/verification-levels/SKILL.md]
[@/workspace/code/openchamber-config/.agents/skills/communication/terse/caveman-lite/SKILL.md]
</skills>

<owned_paths>
.worktrees/team-dev-chamberos-board-v2/web/public/**
.worktrees/team-dev-chamberos-board-v2/web/server/** (only what A1 needs; keep changes minimal)
.worktrees/team-dev-chamberos-board-v2/web/tests/**
.worktrees/team-dev-chamberos-board-v2/web/README.md
.worktrees/team-dev-chamberos-board-v2/package.json and build scripts (only if bundling local assets requires it)
.worktrees/team-dev-chamberos-board-v2/.agents/run/chamberos-board-v2/** (your proof)
</owned_paths>

<scope>
In:
1. Port V1's look and layout (typography, warm ivory/paper palette, spacing, drawer, popovers, restrained hover actions) into web/public. V1 loads Tailwind, Lucide and Google Fonts from CDNs; the CSP forbids that. Ship them locally: either a compiled static CSS file (preferred: only the classes used, built by a committed script or hand-written CSS) and inline SVG icons / a local icon subset, and local font files or a system font stack that keeps V1's feel. Do NOT loosen the CSP to allow CDNs.
2. Replace V1's top bar with a collapsible sidebar. Sidebar entries for all approved sections exist now: Canvas, List, Decisions, Blocked, Discussions, Operations overview, Archive/backburner, Client view switch, plus project/repo filter, refresh, settings, language switch, sign out. In A1 only List works; the others show an honest "coming in a later step" empty state (NOT fake content). Canvas may show the same honest placeholder.
3. Sign-in: keep the existing session/CSRF flow (/api/session GET/POST) and the no-sign-in-flash behaviour from #54.
4. List view: real issues from /api/combined/board (all repos) with V1 card/row styling, status shown from status:* labels, friendly titles, project grouping or filter, search. Clicking an issue opens the V1-style right drawer showing real issue detail from GET /api/issues/:n (title, status, labels, body as plain text or simple safe rendering — rich markdown comes in B2). Status change from the drawer via existing PATCH is fine if trivial; otherwise leave it.
5. Theme: light (V1 warm paper) and a matching dark version, following prefers-color-scheme, with a manual override saved locally.
6. Language: English and French UI strings with a switch (saved locally). Issue content is not translated.
7. Responsive at 360px, 768px, 1280px+: sidebar collapses into a slide-out on narrow widths; drawer becomes full width on narrow widths. The word "mobile" must not appear in UI text, ids, classes, or new code.
8. Purge: no "n8n" anywhere in web/public; no button with both a plus icon and text beginning with "+"; no hardcoded/sample issues, repos, metrics, terminals or simulated agents.
9. Service worker (web/public/sw.js): make sure it cannot serve a stale old board or break loading after deploy (cache version bump or network-first for HTML/API). Check whether it contributed to "issues never load".
10. Old front-end tests that assert the old UI: replace them with tests for the new UI. Do not silently delete: list each removed/rewritten test file and what now covers its intent in your proof file. Server tests must keep passing unchanged unless you changed server behaviour on purpose.
Out (later steps, do not build): canvas pan/zoom/positions, links/dependencies, notes, Arrange, Decisions/Blocked/Operations/Archive/Client content, labels editor, front matter, YouTube, discussions, quick capture, D1, screenshots, Run, worktrees, deployment.
</scope>

<criteria>
1. npm test passes (report counts vs baseline 618, explaining every removed/added test).
2. Type check passes for web/server if a tsconfig check exists (npx tsc --noEmit -p web/tsconfig.json or the repo's existing command).
3. Browser proof against a locally started server using the existing fake GitHub test helper (web/tests/fake-github.mjs) or equivalent synthetic data — NEVER the real token or real GitHub: sign in, List shows the fake issues from more than one repo, drawer opens with detail, theme switch, language switch, at 360/768/1280 widths, light and dark. Screenshots saved under .agents/run/chamberos-board-v2/verifications/A1/ in the worktree. Zero console errors and zero CSP violations in the page log.
4. grep proof: no "n8n", no "mobile" (case-insensitive) in web/public; no CDN URLs; no "+ " text next to a plus icon.
5. Written root cause of "issues never load" on the current live code, with file:line evidence, and why the new board does not have it.
6. Local micro-commits on feat/chamberos-board-v2 with conventional messages. Working tree clean at the end.
</criteria>

<output>
Write the full proof to .agents/run/chamberos-board-v2/verifications/A1/proof.md in the worktree (commands, counts, screenshot paths, test replacement list, root cause, known gaps).
Reply with at most 20 lines: final commit SHA, test counts, root cause in one line, what is NOT verified, and the proof path.
</output>
