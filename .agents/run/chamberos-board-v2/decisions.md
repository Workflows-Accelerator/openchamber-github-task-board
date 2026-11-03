# Decisions — chamberos-board-v2 (user-approved)

## Round 1 — 2026-11-03 (answered on page)
Direct from user's original message (no question needed):
- U1 V1 UX/layout wins; V2 features ported one at a time and fixed.
- U2 Canvas dot grid must not grow when zooming out.
- U3 Canvas infinite (no fixed plane size); remove every "n8n" mention.
- U4 Canvas notes: real markdown; drawn UNDER task cards.
- U5 Auto-positioning rebuilt (current is garbage).
- U6 No button with both a plus icon and a "+" text prefix.
- U7 Views named "Canvas" and "List". The word "mobile" appears nowhere. Everything responsive.
- U8 Top bar becomes a sidebar.
- U9 Nothing fake / simulated in the shipped board.
- U10 Becomes the published board (board.workflows.ac) with proper env vars.
- U11 Template issue showing every capability (YouTube links, questions, deep human tasks, discussions, etc.).
- U12 Deleting links between issues must work.
- U13 Issue creation = textarea + screenshots/links; rest automatic via System 1 model "D1" from env var.

Round 1 answers:
- D1 Base: V1 file becomes the new board, wired to the current server (web/server). 
- D2 Sidebar sections ALL stay: Canvas/List, Decisions, Blocked, Discussions, Operations overview (real numbers only), Archive/backburner, Client view switch.
- D3 Labels: keep status:*; add priority:urgent|high|normal|low, size:XS|S|M|L|XL, ready-to-run.
- D4 Front matter: keep the FULL V2 front matter editor (incl. custom fields) — but per U-message, status/priority/size/ready are labels, never front matter.
- D5 Card positions + canvas notes: hidden HTML comment inside each issue, saved on drop.
- D6 Links between issues: GitHub native "blocked by" issue dependencies.
- D7 D1 model: user note = `openrouter/liquid/d1` and URL `https://openrouter.ai/api/v1/systemone`. (Existing OpenChamber classifier config uses `https://ai.workflows.ac/v1/systemone` + same model; clarify in round 2.)
- D8 Quick capture: create immediately as draft, then "created — edit / undo" notice.
- D9 Screenshots: commit into the project's repo in a board-assets folder (token permission to be verified).
- D10 Run button: must actually start an OpenChamber session (real).
- D11 Publish: web board only (board.workflows.ac). Panel untouched.
- D12 Theme: V1 warm paper look + matching dark version, follows device.

## Round 2 — 2026-11-03 (answered on page)
- D13 D1 endpoint: `https://ai.workflows.ac/v1/systemone`, model `openrouter/liquid/d1` (same as OpenChamber classifier, /workspace/.openchamber-data/classifier-endpoint.json — never print its key). Env: BOARD_D1_MODEL, BOARD_D1_BASE_URL, BOARD_D1_API_KEY.
- D14 Front matter: full V2 editor + custom fields; status/priority/size/ready-to-run shown as label chips above it, NEVER written to front matter.
- D15 Canvas notes: every note must be attached to an issue (no free-floating notes; no pinned notes issue).
- D16 Run: starts a real OpenChamber session in the repo's folder using issue front matter (model, agent, skills). Needs OpenChamber URL + auth + repo->folder map + secured route.
- D17 Discussions: GitHub Discussions (the forum tab), not issue comments.
- D18 Archive/backburner: closed issues + `backburner` label.
- D19 Quick-capture undo: close as "not planned" and hide.
- D20 Screenshots: separate `board-assets` branch in each repo.
- D21 Arrange: only on button press; left-to-right by blocked-by links, grouped by project, no overlaps; manually placed cards never move on their own.
- D22 Language: English AND French with a switch.
- D23 Tracking: one GitHub issue per step under one parent issue.
- D24 Review: 3 batches (A: V1 on real data + sidebar + Canvas/List + canvas fixes + link deletion; B: front matter, labels, link viewer, YouTube, questions, human tasks, discussions, template issue; C: quick capture D1, screenshots, Run, publish live).
- NEW SCOPE (user note): "perfect way to manage worktrees in OpenChamber from the task board": create branches (even pre-emptively when the next ready-to-run task is on a different branch), symlinks, branches, worktree cleanup, merging, commits, etc. -> scope fork asked in round 3.

## Round 3 — 2026-11-03 (answered on page)
- D25 Worktree management = its own 4th review batch (D), after Run works.
- D26 Board may: create worktree+branch; pre-create next ready-to-run task's branch; symlink shared deps + copy env files; commit in worktree; push feature branch + open PR; merge into master; clean up merged worktrees (remove, prune, branch -d, OpenChamber deregistration).
- D27 Confirmation: user click REQUIRED before merge, push to master, or any deletion. Everything else automatic.
- D28 Create parent issue + one issue per step on GitHub now (repo Workflows-Accelerator/openchamber-github-task-board).

alignment: CONFIRMED (2026-11-03, rounds 1-3)
