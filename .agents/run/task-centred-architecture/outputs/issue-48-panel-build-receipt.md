# #48 extension build receipt — NOT accepted, independent review next

Date: 2026-10-29
Builder: ses_cfa486c39fa33858987536fc (genius requested; actual unverified)
Worktree: /workspace/extensions/github-task-board/.worktrees/team-dev-issue-48-panel-simple-views
Branch: feat/issue-48-panel-simple-views, base cc083796c4bf62b57aaa76e2908f8b5cd47347dd
Candidate SHA: 253f9f23e4b4eda7f39ca0a059dff3a21e33eb84 (commits aa97661, 35f9450, 9302cf1, 253f9f2). Clean tree, no push/merge/deploy.

## Builder claims (unverified)
- typecheck 0, build:panel 0, root 590/590 (553 baseline +24 viewstate +13 panel integration), shipped-parity 18/18, diff --check 0.
- Built-panel Chromium fixture: five views, question answers reachable, Enter creates one status:draft with no session, Alt+Up/drag reorder PATCH moved issue only, 360px no overflow, add row in viewport, zero page errors.
- Logs in /tmp/opencode/issue48-*-final4.log and issue48-browser5.log (ephemeral; reviewer must reproduce, not trust).
- Screenshots: verifications/screenshots/issue-48-panel-{simple,cards,kanban,graph,pending,questions,drafts,drafts-narrow}.png.
- Removed: duplicate view buttons, attention presets, status tabs, Graph-local Show Done and theme filter, legacy grouping/priority/tag controls, "Select All with Tag" shortcut. Many existing tests rewritten to the new entry points (list in builder wake).

## Manager rulings on known gaps (before review)
1. Reorder refuses some destinations among unmarked drafts — SAME gap rejected on web. Not accepted; correction required (lazy neighbour marker initialisation).
2. Saved-draft project picker performs a real GitHub GraphQL transferIssue after confirmation. This is NOT close/recreate (history kept), but it is a new unapproved product choice and differs from web. Product fork: ask user whether saved drafts may be transferred between projects with an explicit confirm. Until answered, treat as unapproved.
3. Removal of "Select All with Tag", priority/tag controls and Graph theme filter is a functional loss not explicitly approved; reviewer to inventory; disclose at L5.
4. Rename overrides extension-local (already disclosed).
