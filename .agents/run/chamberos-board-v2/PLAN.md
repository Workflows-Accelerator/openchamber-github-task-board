# PLAN — chamberos-board-v2

Source of truth for decisions: [@decisions.md]. Technical ground: [@explore/discovery.md].
Repo: Workflows-Accelerator/openchamber-github-task-board. Worktree: `.worktrees/team-dev-chamberos-board-v2`, branch `feat/chamberos-board-v2` (base `a8ccc7a`).

## Ordering rule
Every step edits the same front end (`web/public/**`) and most edit `web/server/**`.
So steps run strictly ONE AT A TIME in the single worktree, in the order below.
Each step: build -> L4 hostile review (same worker) -> independent audit (fresh worker) -> "awaiting batch".
Each batch ends with ONE human review (L5). Nothing reaches master before batch C's publish step is approved.

## Batch A — the V1 board on real data
| Step | Title | Summary | Tier |
|---|---|---|---|
| A1 | New board shell on real data | V1 file becomes `web/public` board. Tailwind/icons/fonts bundled locally (CSP `script-src 'self'`). Sign-in kept. Sidebar replaces top bar. List view loads real issues from `/api/combined/board` (fixes "issues never load"). Light + matching dark theme follows device. English/French switch. No fake data, no "n8n", no "mobile", no double-plus buttons. Old front end + its tests replaced. | engineer |
| A2 | Infinite canvas | Canvas view: no fixed plane, dot grid stays fine at any zoom, pan/zoom (mouse, trackpad, touch). Cards placed by drag; position saved on drop in a hidden comment in the issue body (new server route). | engineer |
| A3 | Links you can add and delete | Wires = GitHub native "blocked by" dependencies. Read on load, create by dragging port to card, delete by clicking a wire or a chip in the drawer. Server routes for the dependencies API. | engineer |
| A4 | Notes and Arrange | Markdown notes attached to an issue, drawn under cards, saved in that issue's hidden comment. Arrange button: left-to-right by blocked-by, grouped by project, no overlaps, only on press. | engineer |
| A5 | Sidebar sections on real data | Decisions (open questions), Blocked (needs-human / human tasks), Operations overview (real counts only), Archive/backburner (closed + `backburner`), Client view switch. Discussions entry present but filled in B3. | worker |

## Batch B — issue features from V2, fixed
| Step | Title | Summary | Tier |
|---|---|---|---|
| B1 | Labels and front matter | Create/ensure labels `priority:*`, `size:*`, `ready-to-run`, `backburner`; show and edit as chips. Full front matter editor with custom fields; status/priority/size/ready never written to front matter. | engineer |
| B2 | Rich issue drawer | Markdown body, link viewer, YouTube embeds, questions answered in place, human tasks ticked in place. | engineer |
| B3 | Discussions | GitHub Discussions (forum tab) list, read, reply, start; "turn into issue". | engineer |
| B4 | Template issue | One real issue showing every capability (video link, questions, deep human tasks, discussion link, front matter, labels, links, notes). | worker |

## Batch C — capture, run, publish
| Step | Title | Summary | Tier |
|---|---|---|---|
| C1 | Quick capture with D1 | Text area + screenshots/links. Server calls D1 (`BOARD_D1_MODEL`, `BOARD_D1_BASE_URL`, `BOARD_D1_API_KEY`), fills title, repo, labels, sections. Created as draft at once; "created — edit / undo" notice; undo closes as not planned and hides. | engineer |
| C2 | Screenshots stored in GitHub | Uploads committed to a `board-assets` branch in the issue's repo; token write permission checked first. | worker |
| C3 | Real Run button | Starts a real OpenChamber session in the repo folder with the issue's model/agent/skills. Needs OpenChamber URL, auth, repo-to-folder map, secured route (env vars). | engineer |
| C4 | Publish the new board | Env var docs, release build, supervisor switch to new release, live check at board.workflows.ac. Requires user approval to merge and push master. | engineer |

## Batch D — worktree management
| Step | Title | Summary | Tier |
|---|---|---|---|
| D1 | Create and prepare worktrees | Create worktree + branch; pre-create next ready-to-run task's branch; symlink shared deps; copy env files; register in OpenChamber. | engineer |
| D2 | Commit, push and open PR | Commit in worktree, push feature branch, open PR, from the board. | engineer |
| D3 | Merge and clean up | Merge into master and clean merged worktrees (remove, prune, branch -d, deregister). Click required before merge, master push, any deletion. | engineer |

## Known risks / open points (resolve inside the step, ask user if a fork appears)
- A1: old front-end tests (`web/tests/*client*`, issue-48/53/54) assert the old UI; they are replaced, not silently deleted — the worker lists each removed test and what replaces it.
- A3: GitHub dependencies API availability for the token is unverified.
- C2: token may lack contents:write; step stops and asks if so.
- C3/D*: whether the board server can reach OpenChamber's API from where it runs is unverified.
- C4: live deploy path (supervisor, release dir, domain) must be re-inspected; master push needs the user's click.
