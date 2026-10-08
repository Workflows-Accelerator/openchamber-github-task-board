<goal>Conduct a hostile review of the board review-feedback fixes that currently sit UNCOMMITTED in this worktree's working tree on branch fix/review-feedback-views (base 3598c9e): distinct checklist icon for All Tasks, simplified-view friendly titles with explicit placeholder, Human Tasks/Questions queue population from real issue bodies, D13 follow-the-session repository selection with Current-session popover anchor, distinct empty/inaccessible/failed repo states. Find what might be broken or missed. Do not assume the implementation, its tests, or its screenshots are right — the implementing worker (ses_6b7c1c2086f540092b39965b) finished WITHOUT committing and the manager's shell is forbidden to stage application code, so your FIRST action (step 0) is a byte-verbatim preservation commit of the working tree before any review begins; only your own independent runs count as evidence.</goal>
<context_files>
<file path=.agents/run/board-lifecycle/feedback-2026-10-08.md>
# Human feedback and aligned scope — 2026-10-08

## Verdicts and state
- User reviewed running preview and found indistinguishable List/All Tasks icons, technical rather than friendly titles, empty Human Tasks/Questions, and missing/hard-to-switch repos from other sessions.
- Board views #23: BOUNCED / In Progress with this note. Contract #22: human proof incomplete, not PASS. Board V2 repository loading: reopened for investigation, not PASS. Voice remains awaiting verdict; no voice PASS inferred.
- Batch 2 ask was sent once on 2026-10-07. Do not re-send the full original asks. User now explicitly requests issue-linked review tasks and an actual question so positive queues can be tested.
- Root truth reconciled: board HEAD 3598c9e includes merge 8938494 + bundle 66a734a; voice HEAD 7c6f816. Tracked board tree clean at intake. Historical phantom/duplicate sessions in checkpoint are not active work.
- gh issue list/view now WORKING (previous exit-127 limitation obsolete). Remote bodies #22/#23 have Friendly Title but no Human Tasks and no labels. #23 Friendly Title is heading + following line. This establishes missing handoff data, NOT proof that renderers work.
- IMPORTANT issue identity correction: actual board #14 is 'notify agent when every human task is completed', NOT V2 efficiency. Do not use prior summary's #14 mapping. New repository-loading issue must be grounded in actual live issue list. Historical V2/voice issue identity needs reconciliation before any issue operations.

## Approved changes (user's own request)
1. Checklist-style icon for simplified All Tasks, visually distinct from existing List; retain accessible labels and existing modes.
2. Friendly titles in simplified list. Diagnose real issue body vs rendering: repair rendering if wrong and repair missing Friendly Titles for issues in OUR current scope. No bulk rewrite of unrelated issues or speculative AI title generation.
3. Populate real, issue-linked Human Tasks and Open Questions from current pending work, not dummy fabricated decisions. Preserve existing bodies and audit history, keep humans' boxes unchecked.
4. Diagnose repository discovery/context switching/cache loading, then repair proven defects to default to current session repository with an easy explicit repository switch. Preserve existing single-project and All Projects features. Ambiguity about a manual override's lifetime is an actual open question, not assumed resolved.
5. Investigate existing OpenChamber GitHub authentication, credential TYPE/PRESENCE ONLY, whether conditional headers actually survive host path, and safe credential reuse. No token extraction/copying into guest storage, no new login flow or auth config without alignment.
6. Parallelism approved. One application frontier per repo remains enforced; board changes one worker, credential/host audit separate read-only worker in chambervoice worktree. No parallel builders touching board files.

## Decisions
- Incremental GitHub since refresh: user willing to use it if best; retain approved changed-issues-only full-scope behavior. Treat manual Refresh reconciliation of deleted/transferred issues as accepted with disclosure, NOT authorization to add periodic timer polling or other freshness loss.
- PAT vs OAuth reuse: UNRESOLVED pending audit. User does not know credential type. Never ask them to paste credentials and never print credential values.
- Session switch after manual repo selection: UNRESOLVED. Recommendation to be evidence-based; surface as a real Open Question linked to repository-loading issue.

## Verification requirement
- Source/fixture tests alone already missed human-observed failures. Board worker must execute real production code and capture browser DOM/screenshot proof with populated issues where possible, inspecting all modes' titles/icons/queues/repo selection.
- No live session/form/permission/DB mutation, no shared-service restart, no remote application publishing. Issue edits ONLY as explicitly requested for handoff/questions and receipts. Only human closes issues/moves Done.
- Checkpoint evidence did not prove minute-based automatic refresh: D11 says no timer polling exists. Do not repeat prior ask's 'within a minute while idle' as verified/approved cadence. Investigate actual events/refresh trigger.

## Planned workers
- board: investigate-first; approved icon/title fixes after causal proof; positive queue/repo-switch tests; no guessed product policy; report fork instead.
- auth: read-only actual host/sdk credential transport audit; no auth repairs until result reviewed.

</file>
<file path=.agents/run/board-lifecycle/decisions.md>
# Decisions — board-lifecycle (aligned 2026-09-26)

## D1. Human to-do source of truth: HYBRID
Agents write an explicit `### Human Tasks:` checklist when they block on a human.
Fallback when the section is absent/empty: derive items from unanswered
`### Open Questions:` plus the attached session's waiting reason
(`waiting-permission` / `waiting-question`).
Rationale: machine-readable for board + voice, forgiving of pre-existing issues.

## D2. Simplified views: THREE (user's own framing, supersedes my two-mode proposal)
1. **Human Tasks** — everything the human must do (from D1 extraction).
2. **All Tasks** — every issue, friendly titles only, grouped by status.
3. **Questions** — all open questions across issues, for fast alignment.
Existing list/kanban/graph/archive views remain untouched.

## D3. Review = AI step (RESOLVED 2026-09-26)
`in-review` = the agent is reviewing its own finished work (AI hostile-review gate).
`needs-human` = anything awaiting the human: permission, answers, or final validation.
Human to-do list reads exactly: everything in `needs-human` + open questions (any status).
Code changes required by this: labels.ts:155 description rewrite; the idle-session
auto-transition (labels.ts:403-468) moves issues to `needs-human` (awaiting validation),
NOT `in-review`; `in-review` is set by explicit `status:in-review` label while the agent
self-reviews.

## D4. Lifecycle skill: ONE skill in the shared library
`/workspace/config/opencode/.agents/skills/...` — one `issue-lifecycle` skill, backed
by a single written issue-body contract referenced by board parsers, the AI issue
prompt, and the voice prompt.

## D5. Build order: contract + to-do views first
Contract locked first (incl. Human Tasks section), then the three views. Lifecycle
skill written in parallel against the contract. Visual polish after the views exist.

## D6. Bugs: file all four now; fix the `__all_projects__` voice crash in this iteration
Issues to file: (1) voice 404 crash on All Projects mode [FIX NOW], (2) rate-limit
backoff missing on single-repo fetch + PATCH paths (main.ts:1219,1281), (3) full
re-render on streamed pages drops input focus (main.ts:1156,1161), (4) idle sessions
auto-move issues to in-review (labels.ts:403-468) [tied to D3].
Crash fix is voice-side defensive handling (chambervoice repo) — the board-side
storage contract tweak folds into the contract track to avoid two workers in one repo.

## D7. Portfolio access: user GRANTED direct access
gh is not installed anywhere (verified by explorer: `gh: command not found`);
workers can reach api.github.com with /workspace/.git-credentials. User chose to
grant the manager direct access. Until it is live, issue ops route through workers.

## D8. Voice multi-project routing (new tool `repo` argument) — NOT this iteration
Tracked as filed issue; the seam map has the gap analysis.

## D9. Contract v1 clarifications (surfaced by skill walkthroughs + its hostile review)
1. Human Tasks / Open Questions items must be **self-contained prose** — chambervoice
   reads raw issue bodies over REST and sees no drawer metadata.
2. Cross-repo dependencies use **full URLs**, never `#N` shorthand (wrong-repo links).
3. Issues **actively blocked awaiting alignment** sit in `status:needs-human`; passive
   ideas stay `status:draft` (they surface via the Questions view).
FOLD INTO docs/issue-body-contract.md when the contract worker's output lands
(its brief predates these lines) — small follow-up patch at review time.

## D10. Gate ledger (this run)
| Work | L4 hostile review | L5 human review |
| --- | --- | --- |
| explore-board-map / explore-voice-seam | waived — read-only mapping, no code changes | waived |
| issue-lifecycle skill (ses_500dac19a1fa9ad474cb9429, commits 03f0b6e + c17c1f1, issue #21) | PASSED 2026-09-26 — 5 findings, all fixed (state-machine branch, section order, alignment-blocked status, L5 batching contract, issue #21 self-compliance) | queued for batch |
| voice crash fix + 4 filed issues (ses_909742d6a8b4139607f53184, issues #17-#20) | PASSED 2026-09-26 — 7 findings, all fixed (HIGH: getTask wrong-repo match + masked auth errors; slug validation, case-insensitive dedup, repo attribution in tool outputs, vacuous tests). chambervoice suite 427 green | queued for batch |
| contract + extraction (ses_cb7138841e2593d7a1f8bdff, commit 7196e06+, issue #22) | PASSED 2026-09-26 — 12 findings, all fixed (HIGH: main.ts resolveIssueColumn still routed idle->in-review; collectHumanTodos cross-issue session hijack; stale bundle). suite 217 green; D9 clarifications folded into docs | queued for batch |
| three views (ses_a666af59d1eb6423a9bc5d0c, issue #23) | RUNNING 2026-09-26 | queued for batch |

## Integration warning (updated after L4s)
The contract L4 had to touch panel/main.ts (resolveIssueColumn fix at main.ts:1767,1828) and
rebuild panel/main.js — the same files the views branch owns. BOTH branches now touch
main.ts + main.js. Merge procedure: merge contract branch first, then views; resolve
main.ts conflicts keeping the contract's idle->needs-human resolution; then REBUILD
panel/main.js once from merged sources and re-run shipped-parity + full suite. Never merge
the bundle by hand.

## D11. Request efficiency (aligned 2026-10-07)
- Incremental idle refresh across current scope: only changed issues, using since and conditional reads where actually supported. NOT targeted-only issue/repo refresh that misses other people's edits.
- Voice task reuse up to 30 seconds approved.
- No-loss bundle: conditional reads, comment reuse without feature loss, one PATCH for status/priority drag, optimistic create without full refetch, bounded retry defense, safe known-repo lookup. No hidden additional freshness loss or numeric-issue guessing.
- No timer polling exists; adaptive-polling option dropped.
- Source: specs/rate-limit-manager-review.md. Measured request savings and real browser conditional transport remain UNKNOWN.

## D12. GitHub caching route: DIRECT ORIGINS CAPABILITY (user, 2026-10-08)
Declare `capabilities: ["origins"]` + `contributes.origins: ["https://api.github.com"]` in the board manifest so the existing direct-fetch ETag/If-None-Match/304 path (main.ts:1094-1152) activates with the workspace token the user already provides. Rejected: host proxy upgrade (kept as possible later platform work; cleanest security but release-cycle cost), PAT-in-settings via proxy (proxy strips headers — cannot 304 regardless). Binding caveats: (a) implementation MUST empirically re-verify the CSP/origins claim in the real served panel and show an actual 304 in the network log before this counts as done; (b) no token values or prefixes in any log, test fixture or artifact; (c) the host.request fallback must remain intact for users without a workspace token.

## D13. Repo manual-override lifetime: FOLLOW THE SESSION (user, 2026-10-08)
Current-session repository is the default. A manual repo pick is scoped to the current session context: when the active session changes, selection resets to the new session's repository automatically. Explicit switching stays easy within a session context; the "Current session" control remains the anchor back to the default. (Manager had recommended keeping the manual pick; the user chose follow-the-session — this decision is authoritative.)

## Gate ledger correction (2026-10-07)
- Batch 1 contract/views/status and voice crash local integration landed, L4 passed as indexed in verifications/proof.md; human review pending, not Done. Older RUNNING rows above are historical.
- Batch 2 voice cd6ab18 and board 656cc4f: both independent hostile reviews HALT. No integration/acceptance; repair 1 dispatched into isolated worktrees. Worker/model/session details: status-l4-halts-2026-10-07.md.
- Per-issue human verdicts remain required. Agent closure/push prohibited. Do not infer approval from old batch request or green synthetic tests.
- Unsupported conditional transport or incremental deletion/transfer loss is a potential alignment fork, not approved new polling/auth/freshness policy; workers must report evidence/options.

# Issue body contract (v1 — canonical text in specs/issue-body-contract-v1.md)
- `### Friendly Title:` — 3-6 words plain English (parseFriendlyTitle, core.ts:85)
- Overview / description block
- `### Open Questions:` — checkboxes, parsed (core.ts:136)
- `### Actionable Subtasks Checklist:` — checkboxes (core.ts:175)
- `### Human Tasks:` — NEW, checkboxes; what a human must do (D1)
- `## Test Plan (Issue|Batch)` / `Blocked by #N`

</file>
<file path=.agents/run/board-lifecycle/issue-23-update-2026-10-08.md>
# Exact approved issue 23 update — 2026-10-08

Preserve existing Friendly Title/Overview/Acceptance Criteria. Append these exact sections once (replace stale handoff sections if already present). Title remains technical; Friendly Title is the human-facing title. Do NOT mark any human checkbox done.

### Human Tasks:
- [ ] Open Human Tasks in OpenChamber, select the task linked to issue 23 "Add Simplified Task Views", and confirm it opens this issue rather than another repository's issue with the same number. Report any missing task or wrong link in the managing session.
- [ ] After the view repair is available in the running preview, compare List with All Tasks and confirm the checklist icon is distinct and All Tasks displays "Add Simplified Task Views" instead of the technical title. Report pass or the problem in the managing session.
- [ ] Open Questions and confirm the unanswered list below appears under "Add Simplified Task Views" and opens this issue. Answer the question in the managing session; do not check it off until you have answered.

### Open Questions:
- [ ] When you manually select a repository and then switch to a session in another repository, should the board follow the new session automatically, or keep your manual selection until you choose "Current session"? The goal is to show the current session repository by default while keeping deliberate cross-repository review possible.

## Human review feedback — 2026-10-08
The human reports indistinguishable List/All Tasks icons, technical titles in the simplified list, empty human/question queues, and difficult or incomplete repository loading when switching sessions. Not accepted as Done. Checklist icon and friendly-title corrections approved; repository default/current-session workflow approved in principle, override lifetime awaiting answer. Human Tasks are real outstanding review actions; questions are real unresolved decisions, not demo filler.

</file>
</context_files>
<skills>
<skill path=/workspace/config/opencode/.agents/skills/review/adversarial/doubt-driven-development/SKILL.md>
# Skill: Doubt-Driven Development (Hostile Verification)

## OBJECTIVE
Subject proposed plans, implementations, claims of completion, or architectures to skeptical, adversarial scrutiny to uncover hidden failure modes, unoptimized paths, visual bugs, or runtime errors before they reach production. Operate strictly read-only and assume work is broken until proven otherwise.

## CORE DOUBT PRINCIPLES
1. **Doubt the User's Premise (Alignment & Brainstorming):**
   - The initial request may be ambiguous, unoptimized, or harmful to existing features.
   - Actively brainstorm alternatives, uncover unstated requirements, and evaluate if what is requested breaks other parts of the system.
   - Propose better solutions and present trade-offs at any point a fork or inconsistency appears.
2. **Doubt Claims of "Done" — Including Your Own:**
   - Never trust any self-reported success, least of all your own.
   - Audit the diff, run real commands, inspect console/server logs, and capture visual proof before accepting. In team missions, the prover must be independent of the builder.
3. **Doubt Shallow / Static Validation:**
   - Static schema validation (e.g. `n8ncli validate`, linter passing) is necessary but insufficient.
   - Demand live runtime execution: execute actual workflows, check live API payloads, and inspect terminal/browser console logs for silent errors or unhandled rejections.
4. **Doubt Visual & UX Quality:**
   - Code that runs without error can still look broken or degraded.
   - For UI changes, require Playwright DOM inspections and screenshot analyses to confirm alignment, visual hierarchy, responsiveness, and component rendering.
5. **Doubt Code Stability (Checkpoint & Rollback Discipline):**
   - Take frequent, atomic git micro-commits after every verified green step.
   - If hostile verification fails or regressions are detected, roll back cleanly (`git checkout` / `git restore`) instead of piling speculative patches on a broken state.

## SKEPTICISM CHECKLIST
1. **Visual & UX Integrity:**
   - Does the UI actually look right in real renders? (Check Playwright screenshot artifacts, layout spacing, visual regressions).
2. **Runtime Logs & Console Health:**
   - Are there hidden console errors, warnings, unhandled promise rejections, or memory leaks during real execution?
3. **Live Execution vs. Static Passing:**
   - Did the workflow/endpoint actually execute end-to-end with real data payloads (e.g. live n8n node execution vs just `n8ncli validate`)?
4. **Concurrency & Timing:**
   - What happens if two requests run simultaneously? (Race conditions, out-of-order execution, double mutations).
5. **Failure & Partial Outages:**
   - What happens when downstream services timeout, drop connections, or return 500s?
   - Is state cleanly recovered, or left corrupted / partially modified?
6. **Data Volume & Scale:**
   - What happens when a list returns 0 items? 100,000 items?
   - Any unbounded in-memory array growth or N+1 fetch cascades?
7. **Security Boundaries:**
   - Can a user manipulate IDs to access unauthorized resources (IDOR)?
   - Are trust boundaries respected across client, server, and third-party integrations?
8. **Assumption Stress Test:**
   - What unspoken assumptions does this design make about data cleanliness or environment invariants?

## VERDICT & RISK MATRIX STRUCTURE
List identified risks categorized by severity and conclude with a machine-readable verdict:
- **Verdict Options:** `PROCEED` | `PROCEED-WITH-CONDITIONS` | `HALT`
- **Catastrophic Risks (Must Address - Blocker for PROCEED):** Unrecoverable data loss, critical security vulnerabilities, broken core user flows, or fatal race conditions.
- **Moderate Risks (Mitigate - Requires PROCEED-WITH-CONDITIONS):** Visual UI flaws, unhandled edge cases, performance degradation under load, recoverable timeouts, or console warning cascades.
- **Low Risks / Minor:** Cosmetic edge cases, minor telemetry gaps.
</skill>
<skill path=/workspace/config/opencode/.agents/skills/communication/clarity/answer-first/SKILL.md>
# Answer-First User-Facing Output

For output the end user reads directly — receipts, reports, walkthroughs, status updates. NOT for interview or question rounds (`interview-me`, `idea-refine` own those) and NOT for internal subagent returns (caveman tiers own those).

## Rules

1. **Answer first.** First line = the answer, verdict, or result. Context after, never before. Never bury the lede.
2. **Next action last.** End with exactly one concrete user action, completable in under 2 minutes. One, not a menu.
3. **State every turn.** "Step 3 of 5 done." Progress visible and testable.
4. **Numbered bounded steps.** Multi-step instructions numbered; each step one bounded action.
5. **Errors matter-of-fact.** Location, cause, fix. No alarm, no apology padding.
6. **Cap lists at 5.** More than 5 items regroup into sections.
7. **Cut tangens.** Side findings go to a "Left for later" line, never inline detours.
8. **Concrete time.** Estimates in minutes or hours, never "soon" or "a bit".
9. **No preamble, no recap, no sign-off pleasantries.** The work is the message.
10. **Wins visible.** Completed items named so progress is verifiable at a glance.

## Format

````
```
<answer or verdict, one line>

What changed
- <area> — <what, plain words>

State: step X of Y
Next: <one concrete action>
```
````
</skill>
</skills>
<scope>You report; you do not fix. Read-only over application code EXCEPT: (a) the step-0 preservation commit — byte-verbatim, zero content edits, it freezes someone else's work and makes no decisions about it — and (b) writing this worktree's .agents/run/board-lifecycle/verifications/feedback-2026-10-08/l4-review.md (plus your own screenshots under that directory if you capture any), which you may commit on the current branch after the preservation commit. MUST NOT: any GitHub operation, git push, master, live OpenChamber host/DB/guest-storage/session/form/permission mutations, service restarts, authentication changes, timer polling. Never print token or credential values.</scope>
<checks>
- Diff audit: after your preservation commit, review the full diff 3598c9e..HEAD and confirm git status is clean; question every hunk against the four human complaints in feedback-2026-10-08.md. Confirm nothing outside the declared scope changed (panel/core.ts, panel/main.ts, panel/index.html, panel/main.js, test/, scripts/, and the evidence directory).
- Test-oracle authenticity: verify test/review-feedback-views.test.js executes REAL production functions or the established test-app-harness.js / production-orchestration.test.js bundle style. Re-implemented simulates (copied render logic, stubbed DOM like querySelector: () => null) are grounds for HALT — this defect class previously broke renderViews() while tests stayed green.
- Screenshot authenticity: verify scripts/generate-verification-screenshots.mjs drives the REAL built panel/main.js (a harness page loading the actual bundle) and not a mock re-enactment; open several captured PNGs (claims: 01-07) and confirm they actually show distinct List vs checklist All Tasks icons, friendly titles with the (No friendly title) placeholder, populated Human Tasks and Questions sourced from real issue-body sections, the repository popover with the Current-session default anchor, and the three visually distinct empty states.
- Extraction truth: queue extraction must work against the real live issue-body shapes (see issue-23-update-2026-10-08.md — the exact sections now live on #23/#24). A fixture that parses but real bodies don't is HALT. Only unchecked boxes surface; the same issue number existing in two repositories must never cross-link; items must link to the right issue in the right repo.
- D13 semantics (decisions.md D13, authoritative): active-session repository is the default; a manual pick must reset to the NEW session's repository when the active session changes; the Current session control anchors back to default. Hunt: stale override after switch, override surviving across sessions, wrong repo fetched after reset, cache leaking across repos, single-project and All Projects regressions.
- Title pipeline: resolveSimplifiedViewTitle must never elevate a conventional-commit slug to primary title; check the placeholder sentinel for inverted/leak behavior; verify friendly titles render as text (markdown/HTML injection and ragged-table themes were past hostile findings).
- Regression with your own runs: npm run typecheck, npm run build then panel/main.js parity (the committed bundle must match the rebuilt output), node --test test/*.test.js. Report exact counts (implementer claims 281 vs baseline 269; the manager's own dot-reporter run showed 281 pass marks). Any failure, flake, count mismatch or stale bundle is a finding. Also confirm no timer polling was added (D11).
</checks>
<steps>
<step>STEP 0 — PRESERVE FIRST, before any review action: run git status --porcelain and confirm the expected state (modified: panel/core.ts, panel/index.html, panel/main.js, panel/main.ts; untracked: test/review-feedback-views.test.js, scripts/, .agents/run/board-lifecycle/verifications/feedback-2026-10-08/). Then run these as separate commands (never && chaining): git add -A, then git commit -m "fix(board): review-feedback defects (icons, friendly titles, queues, D13 repos, empty states)" -m "Verbatim preservation of worker ses_6b7c1c2086f540092b39965b output; committed at manager instruction because the manager shell may not stage application code. Content unreviewed at commit time." Zero content edits before this commit. If git status shows anything beyond the expected paths, name it in your report and never commit credential-like files.</step>
<step>Read this worktree's .agents/run/board-lifecycle/verifications/feedback-2026-10-08/diagnosis.md and the full diff first; list every suspicious point before trusting any test or screenshot.</step>
<step>Execute every verification command yourself and record your own outputs; never copy the implementer's numbers.</step>
<step>Write findings to l4-review.md as a table (finding, severity, file:line, evidence, required fix) and return VERDICT PROCEED or HALT with exact required fixes.</step>
</steps>
<output>VERDICT (PROCEED/HALT); findings table (severity, file:line, evidence, required fix); commands run with exact counts; screenshots reviewed; preservation-commit SHA; NOT VERIFIED; no secrets.</output>
