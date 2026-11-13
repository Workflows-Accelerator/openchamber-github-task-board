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
- D34 First phone review of live V3 (2026-11-11). Global design accepted ("C'est beaucoup mieux"). Full parsed feedback in `feedback-2026-11-11-v3-live.md` (F1–F11). Binding consequences:
  1. **F1 is P0 and blocks acceptance:** dragging a canvas card does not persist and shows "unknown error". Fix at root cause with real-Chromium proof before any other UX batch lands.
  2. **F2/F4:** every bottom sheet (filters, settings, and any other) is to be redesigned as one coherent sheet system with legible groups and visible applied state; filters must be self-explanatory inside the Canvas. Spacing details are in scope.
  3. **F3:** Canvas dependency legibility is in scope (how cards organise, what arrows mean, upstream/downstream of a selected issue).
  4. **F5:** a quick note on the currently open issue is a product requirement; it must be visible to the agent working the issue ("prise en compte par le modèle"), and may be independent of canvas notes.
  5. **F6:** human validation must shrink to click-through artifacts only — validate a screenshot, open a link, watch a short video, give feedback. A task that requires code, a command, or a dev server must never be gated on a human. Any residual gate must be explicitly reviewable by clicking.
  6. **F7:** the "Atelier" wordmark/title must be replaced (name is a fork → asked).
  7. **F8/F9:** Decisions questions must render Markdown (described as "impératif") and must offer preset answer options with expandable details instead of a bare free-text answer.
  8. **F10:** OpenChamber interactive question → board issue transcription is a research draft only, explicitly optional ("ce n'est pas forcément quelque chose qu'on est obligé de développer").
  9. Issue policy unchanged: #53–#71 stay open until the user closes them.
- D35 User answered the four-card decision block on 2026-11-11:
  1. **Brand name = "Workflows Board"** ("Atelier" must disappear from title, sidebar, manifest, PWA install name).
  2. **Human validation = strict rule + reclassify the existing issues.** A human gate requires a click-through artifact (screenshot, short video, link) with a one-line instruction. Issues currently waiting without an artifact are reclassified deterministically, with a per-issue comment and a reverse mapping.
  3. **Quick note destination = GitHub comment.** Must be visible to the agent working the issue; canvas sticky notes stay a separate object.
  4. **OpenChamber questions = research + prototype.** Research document, converted prototype behind a dry-run default, and a draft issue filed by the manager after review — not an automatic product commitment.
- D36 Wave plan after D35 (strictly sequential in `.worktrees/team-dev-board-v3`, one worker at a time because every wave touches `web/public/app.js`):
  1. V3-6 P0 canvas-drag fix (running) — blocks everything else.
  2. V4-1 sheets + filters + Canvas dependency legibility + rename to "Workflows Board" + spacing pass (`tasks/wave3-v4-1-sheets-filters-dependencies.md`).
  3. V4-2 quick note by GitHub comment + Decisions Markdown + preset options with expandable details (`tasks/wave4-v4-2-notes-and-decisions.md`).
  4. V4-3 human-validation policy + deterministic reclassification of existing issues (`tasks/wave4-v4-3-human-validation-policy.md`).
  5. R1 OpenChamber question transcription research + prototype (`tasks/wave5-r1-openchamber-questions.md`).
  Each wave gets an independent hostile review before its commit reaches `master`; live deployment is a separate reviewed step.
- D37 APPROVED by user 2026-11-12 (render form): "Privilégier la lecture" — framing never goes below the 0.55 readable floor on its own; "Tout afficher (N)" / "Show all (N)" gives the full fit on demand. Accepted consequence: on 360/390 the dependency focus shows the selected card readable, other cards via Show all.
- D38 APPROVED by user 2026-11-12: desktop collapsed sidebar keeps an always-visible open/collapse toggle at the top of the rail (fixes the one-way collapse found in V4-1 self-review).
- D39 APPROVED by user 2026-11-12 (render form, no note): "Correction limitée (recommandé)" after final independent R1/R2 failure. Preserve global zoom bounds and existing pan navigation; after an incomplete full-fit retain truthful offscreen/zoom-limit feedback and suppress misleading labels for absent endpoints. Do NOT add linked-task list/jump navigation. Also fix filter/dependency return-view handoff R2. Scope is one bounded correction pass and fresh independent targeted review; if review fails again or a new product fork appears, stop and ask. D37 readability-first and D38 visible rail toggle remain unchanged; no publication before independent PASS/APPROVED.
- V4 SHIPPED 2026-11-12: release `26fbc00-20261112` LIVE (independent L4 PASS/APPROVED, 11/11 assets byte-identical, bundle rebuilt from source, rollback to `7339629-20261111` verified). origin/master `28af19b..d1eef33` pushed and confirmed. Awaiting user L5 review; issues #53–#71 remain open.
- L5 PROOF (user, 2026-11-12): on their real phone against real GitHub, a dragged card stays in place after reload on live `7339629-20261111`. First real-world proof of the V3-6 write fix. Closes the "real authenticated production drag unverified" gap.
- V4-2 SHIPPED 2026-11-12: release `e604b9e-20261112` LIVE (application `1d9f237`), two independent reviews (SPEC PASS / QUALITY APPROVED / PUBLISH YES after H1), 13/13 assets byte-identical, `sw.js` `1.2.1-d32d4abee5`, rollback target `26fbc00-20261112` verified. `origin/master d1eef33..a6f61f3` pushed and confirmed. Receipt #issuecomment-6837970237 on #55. Issues stay open.
- D40 APPROVED by user 2026-11-13 (UI block): "Enchaîner, écritures réelles autorisées" for V4-3. The owner authorizes real GitHub writes limited to the deterministic reclassification: `gh issue edit` label operations only, exactly one comment per changed issue carrying the policy and the previous status, a reverse mapping, nothing closed, no body rewritten, no comment deleted, no repository settings touched. Part A (the policy in the product) is code-only with no writes; Part B (dry run, then apply) runs after Part A and reports every refusal verbatim.
- V4-3 SHIPPED 2026-11-13: release `b85676f-20261113` LIVE, `current` repointed, 13/13 assets byte-identical over HTTPS, served `sw.js` CACHE_VERSION `1.2.1-d0c3700d96` (was `1.2.1-d32d4abee5`), health 200 loopback and HTTPS, supervisor 629540 / child 629586, 12 previous releases intact with passing checksums, rollback target `e604b9e-20261112` with `verifications/b85676f-20261113/rollback.sh`. `origin/master a6f61f3..007f342` pushed and confirmed. Incident receipt §7: the first post-cutover supervisor pair (607172/607214) disappeared with no shutdown log, ~10 s of 502, restart via start.sh, every proof re-run green afterwards; root cause unknown, not the bundle. Issues #53–#71 stay open; user L5 click-through pending.
- V4-3 RECLASSIFICATION APPLIED 2026-11-13 (user go: "Appliquez les 67 changements"): 67/67 issues moved to `status:todo` (45 from needs-human, 22 from in-review) across task-board 22, openchamber-config 17, devops-cockpit 14, ironcore-frontline 10, chambervoice 2, case-management-platform 2. Exactly one marker comment each (`<!-- board-reclassification:2026-11-13 -->`), 0 duplicates, 0 refused, nothing closed, no body or title touched, no label created. Reverse table `verifications/V4-3/reclassification-reverse.md`, undo per row with `gh issue edit <n> --repo <repo> --add-label '<old>' --remove-label status:todo`. Two issues (#23, #44) were reverted by a concurrent writer at 14:37Z and re-applied once. The 5 in-flight reviews in case-management-platform (#297–#301) were left alone. `origin/master 007f342..4e1374c` pushed and confirmed.
- BOARD INCIDENT 2 2026-11-13: the site was unreachable for roughly 40 minutes; supervisor 629540 and child 629586 were gone with no trap line, no OOM and no container restart — a SIGKILL-style group kill, same signature as incident 1. Restored by start.sh (supervisor 703108 / child 703153), public health 200, served bytes identical to the release. Who sent the kill is unprovable on this host (no dmesg, journald or audit). Prevention requires an external restarter (systemd `Restart=always` or a watchdog timer) outside the killable process group — awaiting the user's go, since it touches the host and the board configuration repository.
- BOARD INCIDENT 3 2026-11-13 (leading cause now supported): the board was launched from inside an agent session, so its session ID was the terminal daemon's (SID 3934). Today's platform restarts — the same events that killed three workers mid-turn — killed that session's whole process tree, taking supervisor 629540/703108 and their children with it, three times, with no trap line and no OOM. Hardening: relaunched with `setsid` (SID/PGID 823223, PPID 1) and a detached watchdog at `/tmp/opencode/board-supervisor/watchdog.sh` (PID 825993, 60 s tick, one restart per tick). Still unprotected: a kill by PID, and the identity of the killer is not proven. Stop the watchdog with `kill "$(cat /tmp/opencode/board-supervisor/watchdog.pid)"`. No systemd, cron or atd exists in the container.
- USABILITY AUDIT 2026-11-13 (user: "le board est effrayant, même pour moi"): 17 ranked findings with measurements in verifications/usability-audit-2026-11-13/. Top: phone canvas opens at the 20% clamp (2.02 px text, 74 actions); three different "needs me" counts (6/7/8); progress visible only inside the drawer; missing and malformed artifacts read identically; "Reviewable link" filter reports 0 against 3 real; duplicate "Waiting for you" labels; Answer pushed below the fold at 390 when Details is open; dark-mode contrast 2.92:1. Live captures impossible (502) — 304 synthetic, 8 live error shots, clearly labelled.
- D42 PENDING USER 2026-11-13: the owner says the board is scary even for them and that questions and progress tracking need substantial work ("we're far from done"). This outranks new features. Evidence being gathered in verifications/usability-audit-2026-11-13/; the three decisions that unblock the most will be put to the owner as questions before any implementation.
- D41 MANAGER DECISION 2026-11-13 (within D35/D40 intent, reversible, stated to the user): a question gate that makes a task wait for the human must offer at least one preset answer; the free-text path stays available alongside. Grounded in the user's own words ("une question avec des réponses préfaites") and enforced as `missing_options` (malformed). Ordinary open questions that do not gate the task may stay free-form. If the user objects, revert 982daab and the §2.9/prompt wording.
- V4-3 REVIEW CHAIN 2026-11-13: hostile review (genius) fixed 4 defects — 254a339 reopen, 947b80e answered question, 854522c http image, 7d8e354 failed image load. Independent L4 (genius, verifications/V4-3-L4/) = SPEC PASS, QUALITY CHANGES REQUIRED, PUBLISH NO on F1 (answering a gated question forced status:in-progress over any status). F1–F4 fixed (1ebd9e8, 42556ee, c318f33, 982daab, 0da2997). Delta L4 (verifications/V4-3-L4-delta/) = DELTA PASS, PUBLISH YES for a6f61f3..68c5053 with two Low residuals: a §2.5/§2.9 documentation contradiction and a stale probe expectation (the probe as committed fails 12 of 84 rows on the old URL string). Both closed before publication. Carried and known: F5 (Operations view and panel still say Needs human / In review), preset-less live gate needs answer then status control, saved custom AI prompt overrides the new default, review images load from their https host, four unnamed URL causes.
- D37 history — originally recorded as PROPOSAL (2026-11-12; manager correction). The manager prematurely chose and dispatched a behavioural fork based on L4: framing at a 0.55 minimum, with an explicit "Tout afficher (N)" / "Show all (N)" action when the group cannot fit readably. Alternative: automatic full-group framing even when titles shrink. Neither option is recorded as user-approved. V4-1c is already verifying a local implementation of the first option; no publication or further implementation of this fork until the user chooses. Clearing filters restoring the prior viewport is a regression fix, distinct from the unapproved framing choice. Evidence motivating the proposal: L4 measured 4px card titles at 31% and spread boards failing containment even at 20%. Cost if wrong: changed navigation and an extra action for the user. Ask explicitly; silence is not approval.
