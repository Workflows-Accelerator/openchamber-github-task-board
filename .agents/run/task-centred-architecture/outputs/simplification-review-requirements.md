# Review requirements and rulings — simplified board batch

Date: 2026-10-29

## Scope guardrails (alignment, not extra functionality)
- User approved simple quick capture, short names, consistent View / Filter / Sort on both surfaces, cross-device ordering, and 30-day sign-in.
- User did NOT approve automatic issue closure or destructive cross-repository recreation. Original #48 web brief suggested closing and recreating saved drafts; this conflicts with the human-only closure invariant. Review must flag that path; correction must preserve issue history or restrict project choice to unsaved drafts with the limitation explicit. No silent auto-closure.
- Amendment file tasks/amendment-issue-48-web-preserve-sessions-and-issues.md was NOT delivered: delegate.send returned busy. Include it by pointer in post-completion review; do not duplicate or restart a running builder.
- New session hardening 4b3f475 must be integrated with the web branch based on af9b39c; no auth wiring loss. If web app.ts conflicts, a fresh integration worker resolves after both builders/reviews finish, not the manager.
- Project rename overrides are currently separate per surface. This was disclosed but not explicitly approved as a permanent limit; if user objects, align before building shared storage.
- Existing-session transfer across repos is a real product fork; do not implement new transfer semantics without explicit human confirmation. New draft repository picker is approved.

## Required empirical proof
- #47: distinct real config loads with same BOARD_PASSWORD/session secret keep session valid across process restart; a changed password rejects it; sign out revokes after restart; no usable authentication secrets on disk.
- Old installed SW recovery must be browser exercised, not merely text-matched. Claim only harness coverage until actual browser upgrade is shown.
- #48 extension and web: Simple list, Cards, Kanban, Graph, Pending items render; all use same filters and sort; Draft capture creates no agent session; descriptions and manual order persist without body loss; repository-qualified IDs prevent cross-project same-number collisions.
- Manual order must be visible and understandable: dragging while sort=priority must switch visibly to manual or explain why it is disabled, not appear to do nothing.
- Phone reorder needs real touch or accessible up/down controls, not mouse-only HTML drag events.
- Hidden board-order marker preserved by raw body writes, hidden from rendered summaries; fenced samples and similarly spelled comments must not be mutated.
- Pending items must preserve answer/complete interactions and source linkage; human actions never become automatic Done.
- Screenshots/console proof at phone/desktop sizes, drawer interactions, error paths, offline drafting; mocks are not physical iOS/Android proof.
- Integration must prove both #47 and #48 together; feature L4 before a single batch L5 ask. No new live switch or master push until user approves this batch.

## Operational boundaries
- No polling. Only completion wakes or concrete failure events justify follow-up; send failure busy is not a stalled worker.
- Model status call for new reviewer returned no provider/model. Do not claim engineer/genius fidelity without metadata. One-time check exhausted for ses_9b79521102d2101911053528.
- No printed remote URL: historic remote contained credentials. Do not run git remote -v or include raw transport errors. Potential previously exposed credential needs human rotation; never copy its value into any artifact.
- Manager edits only .agents/run/**; review code via git diff/grep, not application changes. Fresh workers handle fixes, merges and release. Preserve run evidence before future worktree cleanup.
