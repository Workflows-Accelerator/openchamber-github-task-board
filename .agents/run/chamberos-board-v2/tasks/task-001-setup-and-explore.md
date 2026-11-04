<env_preflight>
Repo: /workspace/code/openchamber-github-task-board
Worktree: /workspace/code/openchamber-github-task-board/.worktrees/team-dev-chamberos-board-v2
Branch: feat/chamberos-board-v2
Base commit: a8ccc7a
Files: /workspace/code/openchamber-github-task-board/tmp/chamberos_ai_native_github_openchamber_operating_system.html, /workspace/code/openchamber-github-task-board/tmp/webapp-v2.html, web/server/**, web/public/**
Test command: npm test
Do not touch: web/server/**, web/public/**, service/** (read-only during explore; only commit the untracked tmp/*.html files and set up the worktree)
Preflight facts are true and authoritative at dispatch: do not run initial discovery commands (git status, pwd, ls) to re-ground on startup. Re-inspect targeted state only for mutations/pre-commit verification, compaction/resume with stale facts, branch/location changes, or action failure.
</env_preflight>
<goal>Commit the untracked V1/V2 HTML prototypes into git, finish provisioning the new worktree, and produce a comprehensive technical discovery report comparing V1, V2, the current board backend/deployment, and the OpenChamber D1 (System 1) model configuration.</goal>
<context_files>
[@/workspace/code/openchamber-github-task-board/.agents/run/chamberos-board-v2/mission.md]
</context_files>
<skills>
[@/workspace/code/openchamber-config/.agents/skills/ship/worktree/management/SKILL.md]
[@/workspace/code/openchamber-config/.agents/skills/communication/terse/caveman-lite/SKILL.md]
</skills>
<owned_paths>
/workspace/code/openchamber-github-task-board/tmp/**
/workspace/code/openchamber-github-task-board/.worktrees/team-dev-chamberos-board-v2/**
/workspace/code/openchamber-github-task-board/.agents/run/chamberos-board-v2/**
</owned_paths>
<depends_on>
none
</depends_on>
<criteria>
1. In `/workspace/code/openchamber-github-task-board`, commit `tmp/chamberos_ai_native_github_openchamber_operating_system.html` and `tmp/webapp-v2.html` (and remove untracked `.agents/idle-nontext-state.json` if present) on `ops/task-board-activation`.
2. In `/workspace/code/openchamber-github-task-board/.worktrees/team-dev-chamberos-board-v2`, cherry-pick or merge that commit onto `feat/chamberos-board-v2` so `tmp/chamberos_ai_native_github_openchamber_operating_system.html` and `tmp/webapp-v2.html` are tracked and clean in the worktree.
3. Symlink `/workspace/code/openchamber-github-task-board/node_modules` to `/workspace/code/openchamber-github-task-board/.worktrees/team-dev-chamberos-board-v2/node_modules` (and `web/node_modules` if it exists).
4. Register `/workspace/code/openchamber-github-task-board/.worktrees/team-dev-chamberos-board-v2` in SQLite DB (`~/.local/share/antigravity/antigravity.db` and `/workspace/.local/share/opencode/opencode.db` if present) following the `worktree-lifecycle` skill.
5. Read V1 (`tmp/chamberos_ai_native_github_openchamber_operating_system.html`) and V2 (`tmp/webapp-v2.html`) completely and compare every section, feature, CSS rule, JS handler, data structure, mock/fake feature, and UI layout against all user feedback items:
   - Canvas de-zoom dots scaling bug (why dots get huge when zooming out in V1/V2).
   - Layout differences between V1 and V2 (why V1 UX/layout is cleaner, what V2 added: front matter, link viewer, media/youtube, questions, human tasks, discussions, sticky notes, etc., and what V2 broke).
   - Front matter & invisible HTML metadata (`<!-- ... -->`) vs GitHub labels/tags (priority, size, ready-to-run, status, repo, etc.) and what remains in body/front-matter (e.g. canvas coordinates, links, sticky notes, etc.).
   - Canvas "n8n" references and boundedness (fixed pixel dimensions vs infinite pan/zoom canvas).
   - Sticky notes / notes: markdown rendering support and z-index / DOM stacking order (notes appearing above tasks instead of under tasks).
   - Auto-positioning algorithm in V1/V2 (how it currently works and why it fails).
   - Buttons with a `+` icon AND text starting with `+` (exact locations in V1 and V2).
   - View naming ("Canvas" and "List" view; removing all mentions of "Mobile" view while ensuring full responsive mobile support).
   - Top bar -> Side bar transformation (what controls live in the top bar in V1/V2 and how they map to a sidebar).
   - Fake / simulated / hardcoded things in V1 and V2 that are not real (mock terminals, fake metrics, simulated agents, hardcoded repos/issues, localStorage-only vs real backend API `/api/board`, `/api/issues`, etc.).
   - Deleting links between issues (why deleting dependency/link edges in V2 fails or doesn't persist).
   - Seamless issue creation: typing ideas in a textarea + uploading screenshots/links, and automatic structuring via System 1 decision model ("D1"). Search `/workspace/code/openchamber-config` and environment/configs (NEVER print secret values/tokens!) for `D1` or System 1 model definitions, provider URLs, and env var conventions, as well as how `web/server/` and `/workspace/releases/board/current` are configured and deployed.
   - Template issue capabilities: every feature supported by the board (YouTube embeds/links, questions, deep human tasks, discussions, dependencies, labels/tags, frontmatter/metadata).
6. Write the complete discovery report to BOTH `/workspace/code/openchamber-github-task-board/.worktrees/team-dev-chamberos-board-v2/.agents/run/chamberos-board-v2/explore/discovery.md` and `/workspace/code/openchamber-github-task-board/.agents/run/chamberos-board-v2/explore/discovery.md`.
</criteria>
<verification>
git status --short in both root and worktree; test -f .agents/run/chamberos-board-v2/explore/discovery.md
</verification>
<output>
Concise 15-line summary of commit SHAs, worktree setup status, and pointer to `.agents/run/chamberos-board-v2/explore/discovery.md`.
</output>
