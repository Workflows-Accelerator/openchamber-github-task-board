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

## Autonomy window — 2026-11-03 night
- D29 User: "Don't stop until it's all done. I'm going to bed, so you have 10h ... go way past 60. Make it count."
  Interpretation: build all steps #56-#71 sequentially without waiting for batch L5 reviews; batches A-D queue for one morning review (still per-batch verdicts).
  Still gated on the user's click (D27 + manager rules): merge to master, push master, switching the live board (C4 live switch), any deletion, closing issues. Those steps are built and staged, then parked as needs-human.
  Unanswered: closing #53/#54 as superseded — left open.
  Speed: read-only preflight checks (token permissions, OpenChamber API reachability, deploy path) run in parallel with builds because they edit no product files.

## Delivery priority — 2026-11-06 (answered on page)
- D30 User needs a usable version today quickly and selected "Livrer le socle aujourd’hui — recommandé". Deliver the A1-A5 foundation first: Canvas/List, native dependency links, notes, Arrange and sidebar sections, after the current nine-defect repair and verification. Do NOT wait for B1-B4, C1-C3 or D1-D3 before presenting this foundation for human validation/publication.
- D30 supersedes D29's uninterrupted A-to-D sequence for this delivery. Advanced label/front-matter editor, rich drawer additions, Discussions/template, D1 capture/screenshots, real Run and worktree management remain approved backlog, not cancelled and not claimed delivered.
- D31 Advance only the minimum preview/release preparation needed for the A foundation (subset of C4). Preview is for validation, not permission to switch live. Clearly disclose unbuilt features and test-data boundaries; no fake production behavior. No publication before repair + L4 + independent verification + explicit human sign-off. Merge/master push/live switch/deletions/closures remain separately gated. No delivery-time guarantee was made.

## Recovery direction — 2026-11-08 (answered on page)
- D32 After hostile3 HALT (H3-1 vertical containment hole, H3-2 wrong password in human-review.md, H3-3 observational audit labelled ALL PASS), user selected "Corriger uniquement la vérification — recommandé", no note. Bounded tooling/docs-only fix: application source (web/public, web/server) and staged bundle 59e5d05-foundation stay frozen; no rebuild, restage or preview restart. Also finish the two checks hostile3 left unrun (guard-clause mutation proof in a disposable copy; 360/1280 FR Undo-visible recheck). Followed by a fresh targeted independent review. Not L5 acceptance; no release authority. If it fails again or a new fork appears: stop and ask, do not widen scope.

## Live publication + V3 UX/UI, Any-Repo & GitHub API overhaul — 2026-11-11 (direct user direction in chat)
- D33 User superseded D1's strict V1-layout preservation and D31's loopback-preview parking:
  1. **Publish to `master` and live `https://board.workflows.ac` once L4-verified:** No loopback-only waiting room (`"On peut juste publier sur main pour l'instant... et l'envoyer sur la vraie plateforme publiée, parce qu'elle, pour le coup, est sur mon téléphone"`). Keep L4 hostile review mandatory before every `master` push / live cutover, preserve rollback releases under `/workspace/releases/board/`, and do NOT close any GitHub issues (#53–#71 stay open until the user explicitly closes them).
  2. **Break free from V1 legacy UX/UI habits using imported design skills:** Overhaul UX/UI for high craft on both phone (360–430px) and PC (1280px+), Light and Dark, EN and FR, using the 4 design skills imported in `prompt-and-furious-podcast` (`frontend-design`, `ui-skills`, `web-design-guidelines`, `impeccable-critique`) copied & ChamberOS-adapted locally without touching `/workspace/code/openchamber-config` (where a parallel user session is working on global skills). Keep core invariants U2–U10 (`app.js:2268` non-growing two-stop dot grid, infinite canvas, Markdown notes under cards, topological Arrange, views `"Canvas"`/`"List"`, sidebar navigation, zero `"n8n"`, zero word `"mobile"`, zero emojis, no `+` icon + `"+"` text duplication, nothing fake/simulated).
  3. **Immediate out-of-the-box usability on ANY GitHub repository & high GitHub API efficiency:** Make vanilla repositories without `status:*` labels or Issue Body Contract v1 work cleanly out of the box (accurate non-draft stage mapping, clean Markdown issue drawer without empty boilerplate, searchable multi-repo picker, graceful label fallback), and minimize GitHub API usage (`If-None-Match` -> `304 Not Modified` zero-point revalidation, skipping GraphQL/issues on `has_issues: false` or 0-open-issue repos, singleflight deduplication, HTTP ETag + hidden-tab pause, passive rate-limit health).
  4. **Mobile-first visual communication:** Replies in French; whenever visual confirmation or a genuine product fork requires user input, present clean mobile-friendly visual cards with real screenshots rather than desktop text checklists.
