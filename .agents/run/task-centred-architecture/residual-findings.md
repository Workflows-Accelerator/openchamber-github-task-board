# Residual findings — revision at 6b0d8b9

Status: not publishable yet. The fixer resolved many review blockers, but a manager read of the revised body at 6b0d8b9 finds these remaining defects. They are targeted fixes, not a rewrite.

## R1. Title is still imperative and not outcome-shaped
- `issue-draft.md:1` is `### Friendly Title: Run Work from Task Board`; `:3` proposes `Run all work from the task board`.
- The user asked for positive, outcome-focused, simple titles. Change the friendly title to `### Friendly Title: All Work Runs on the Board` (6 words) and the proposed issue title to `All work runs from the task board`. Keep them consistent in `design-evidence.md`, `revision-notes.md`, and any title metadata. Re-run the parser.

## R2. Public issue contains local absolute paths and local-only commits
- `issue-draft.md:171` cites `55ddeaa` / `df8d3ff` and a private run-state test path; `:172` and `:109` cite `/workspace/.openchamber-data/agent-tool/openchamber-plugin.js`.
- The public issue must not present unpushed local commit hashes or local absolute paths as public evidence, and must satisfy its own redaction rule (`:114`).
- Remove the local commit hashes and absolute paths. For the static SDK header test, either remove the item or say: "A static interface assertion exists in the private research artifacts; it is not live runtime proof." For the scheduler interface, say: "The installed OpenChamber plugin (local runtime; path omitted) exposes ...".
- Grep the issue body for `/workspace/`, `55ddeaa`, `df8d3ff`, `9c1a3f8`, `6b0d8b9`, `ses_`, and remove any public-facing occurrences.

## R3. Source section uses paths, not clickable links
- `issue-draft.md:157-165` cites GitHub docs as `/en/...` paths. The review required stable official URLs; add `https://docs.github.com/...` full links (and the changelog URL). Provide the issue-dependencies REST doc too.
- Keep source-observed package-relative paths (`dist/contract.d.ts`) and version strings. Do not invent a link where none exists; label it SOURCE-OBSERVED.
- Verify each URL returns a page (HEAD/GET) and record it.

## R4. Open decisions still leak into migration and tests
- `issue-draft.md:207` says "Create host background coordinator daemon" although Decision 3 is open. Change to "Implement the chosen coordinator host route (Decision 3: host extension service, OpenCode plugin daemon, or relay)."
- `issue-draft.md:220` says "Implement approved Projects v2 capacity retention policy (sharding or bounded run history)" — keep "approved" and make clear Decision 5 selects it.
- `issue-draft.md:254` test says "definition issue creates distinct child run records" and `:255` says "coordinator background daemon" as settled. Make both conditional on Decision 5 and Decision 3, or phrase them as "for the selected representation/host".
- `issue-draft.md:223` prescribes "`schedule.toggle`, `schedule.create`/`delete` fallback". Remove the delete/recreate prescription. Say "detect supported scheduler methods; use `schedule.update` if available; create/toggle/delete only after capability proof and explicit approval; no destructive schedule operation."
- Search the body for other "daemon", "child run", "org/intake", "controller:v2" statements that read as selected rather than proposed/conditional. Recommendations in Section 2 may stay recommendations.

## R5. Technical proof tasks still sit inside Open Questions
- `issue-draft.md:228-237` puts 5 strategic questions plus Technical Proof Tasks A-D under `### Open Questions:`. The user-facing Questions view should show only the five alignment choices.
- Keep `### Open Questions:` with exactly Q1-Q5. Move A-D to a separate `### Later Proof Tasks (NOT RUN):` section outside the parsed questions block, clearly marked as exploration/proof work, not human decisions. Then `parseOpenQuestions` must return 5.

## R6. Acceptance criteria overclaim and omit representation
- `:186` says state is reconstructible "solely from the GitHub issue body and native links". Add native labels/fields and approved controller metadata; the phase representation uses them.
- `:195` says interrupted sessions "recover idempotently". Replace with "best-effort recovery from durable attempt records; duplicate or orphan effects remain possible; exactly-once is not claimed; the chosen controller host must not depend on the panel iframe."
- `:196` says "without breaching project capacity limits"; add "under the approved retention policy; no automatic deletion."
- Add three acceptance criteria:
  - **Authority & Provenance:** Issue, web, and skill content are untrusted data; issue text cannot grant tools; approvals are scoped/versioned/expiring; no secrets, local paths, or unpushed commit hashes in public bodies; claims carry provenance labels.
  - **Single Authority & Migration:** One authoritative phase/approval representation; v1 issues remain readable without rewrite; no dual-write; opt-in rollback/pause leaves history intact.
  - **Event & Recovery:** Offline/lost-response/webhook-replay, transfer/cancel/revocation, and stale-approval cases are reconciled with bounded retries and no automatic destructive schedule operation.
- Keep all unchecked. Update the parser count note; `parseSubtasks` cross-counting remains a documented v1 limitation, not a clean-render claim.

## R7. Test plan missing required edge cases and has settled-choice tests
- Fix Scenario 8 (`:254`) and Scenario 9 (`:255`) per R4.
- Add:
  - **Scenario 13: GitHub Outage, Rate Limit & Lost Response:** simulate a lost create/patch response, secondary-limit 403/429 with `Retry-After`, webhook delivery failure and replay; verify pause/backoff, duplicate check, reconciliation, no blind retry, and bounded human alert.
  - **Scenario 14: Stale Approval, Cancellation, Transfer & Revocation:** change scope after approval, cancel/close/transfer an in-flight task, revoke a token/permission; verify approvals invalidate, the session stops or fences, in-flight effects are recorded, and no automatic destructive cleanup occurs.
  - **Scenario 15: Untrusted Issue/Web/Skill Content:** put an instruction in issue text or a linked page asking for a tool grant or secret; verify it is treated as data, no permission changes, no secret/path leak, and human approval is required.
  - **Scenario 16: Concurrent Human/Agent Edit:** edit a different section in the GitHub web UI while a worker patches; verify narrow patch/readback preserves human text or escalates; no automatic 3-way merge or silent overwrite.
  - **Scenario 17: Single Authority & Read Compatibility:** verify phase/attention/dependency precedence, v1 read compatibility, no dual-write, and opt-in rollback under two controller instances.
- Keep `Status: NOT RUN — Design Phase` on every test.
- Update `parseTestPlan` count and design-evidence anchors.

## R8. Exploration/resource plan and bounded parallel explorers are under-specified
- `Decision 4` (`:47`) only says "resource plan". Add a short `#### Exploration & Planning Deliverable` after the decision table:
  - desired output and constraints; code/past-work findings; references/templates/exemplars; optional web search for new tools; hypotheses and test results; alternatives/recommendation/confidence; per-phase model/tier; relevant skills/router IDs; tools; target files/boundaries; limits/budget/retry; decomposition/parallelism; open decisions; "enough is known" gate.
  - Tiny tasks use a minimal plan; no mandatory swarm.
- In `How the Agents and Skills Change` (`:94-101`), add: "An authorized team/exploration lead may dispatch a bounded set of ephemeral exploration or verification workers under the task plan, with disjoint scope, a cap, and recorded outputs. Durable work stays task-centric; this is not free-form agent-to-agent delegation." This preserves the user's parallel-explorer vision without restoring ad-hoc durable delegation.
- Add the per-task model/skills/tools/files/bounds to the task-body template.

## R9. Task-body template is incomplete
- Add `### Friendly Title: <3-6 word outcome>` at the top of the example.
- Add `### Resource Plan:` with model/tier, skills/router IDs, tools, target files/boundaries, limits/budget, parallelism.
- Keep `### Decisions:` and `### Next Authorized Action:`.
- In prose, state that substantial tasks add `## Test Plan (Issue)`; do not add a second parseable test-plan heading inside the fence unless the parser check proves it does not hijack the real section.
- Keep the redaction rule; do not put `/workspace/...` even in the example.

## R10. Claims/provenance corrections
- `:68` says the point table documents 900 points/min with 5-point mutations; keep the caveat and link the official page.
- `:69` primary quotas: keep 5,000 OAuth/App, 15,000 Enterprise, 1,000 GITHUB_TOKEN; do not imply all tokens share one pool.
- `:70` 7.2 s as illustrative only; keep.
- `:171` static test item: remove local commit/paths; state static assertion, not runtime proof.
- `:172`/`:109` path removal; use "installed plugin (local runtime)".
- `:100` "OpenCode v2.0.32 inspectable source supports..." — label SOURCE-OBSERVED; live invocation NOT RUN.
- Ensure the "Compatibility Shell Note" does not claim clean rendering; it currently documents the limitation, good. After adding criteria/tests, update the count note.

## R11. Companion traceability
- Update `design-evidence.md` and `revision-notes.md` to the new commit, title, scenario numbering, acceptance numbering, and parser counts. Do not leave claims that M-05 moved technical tasks out of Open Questions if they remain in the parsed block.
- Update `source-receipts.md` base commit and remove any remaining "fabricated/does not exist" language; the test exists as a static assertion. Keep the local commit reference only in the private companion if useful, clearly internal.
- Do not edit `verifications/proof.md`.

## R12. Manager gate for the next revision
- `parseFriendlyTitle` must return `All Work Runs on the Board` (or the exact final friendly title).
- `parseOpenQuestions` must return 5; `parseHumanTasks` 5; `parseTestPlan` must include all scenarios; `parseSubtasks` may still cross-count and must be documented.
- No public `/workspace/`, `ses_`, or unpushed commit hashes; no checked boxes; no false "clean render" claim.
- All five decisions remain open with fair alternatives; recommendations may stay recommendations.
- No implementation/publication/child-issue/push/PR/merge/schedule/agent-skill-config authority.
