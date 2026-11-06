<env_preflight>
Repo: /workspace/code/openchamber-github-task-board
Worktree: /workspace/code/openchamber-github-task-board/.worktrees/team-dev-chamberos-board-v2
Branch: feat/chamberos-board-v2
Base commit: 81ed5b6159991823fcef7a2c0abd780b6b3af897 (clean)
Files: web/server/board.ts, web/server/app.ts, web/server/github.ts, web/public/app.js, web/public/index.html, web/public/theme.css, web/tests/a5-sections.test.mjs, web/tests/a5-audit.test.mjs, web/tests/a5-presentation-audit.test.mjs, web/tests/canvas.test.mjs, scripts/generate-a5-screenshots.mjs
Test command: timeout 900 npm test; timeout 900 node --test --test-timeout=30000 web/tests/*.test.mjs; timeout 600 npm run typecheck
Do not touch: /workspace/releases/board/**, running processes, /workspace/config/opencode/**, /workspace/.openchamber-data/**, .env*/credentials, /proc/*/environ, panel/**, service/**, main checkout outside this worktree. No git push, no live GitHub writes, no new npm dependencies. Zero emojis.
Preflight facts are true and authoritative at dispatch: do not run initial discovery commands (git status, pwd, ls) to re-ground on startup. Re-inspect targeted state only for mutations/pre-commit verification, compaction/resume with stale facts, branch/location changes, or action failure.
</env_preflight>
<goal>
Fix all nine open A4 and A5 defects proven by the independent audit at 81ed5b6, add regression tests for each, regenerate affected screenshots, and update the verification proof.
</goal>
<context_files>
[@/workspace/code/openchamber-github-task-board/.agents/run/chamberos-board-v2/tasks/task-A5-sidebar-sections.md]
[@/workspace/code/openchamber-github-task-board/.agents/run/chamberos-board-v2/decisions.md]
Worktree audit report: .agents/run/chamberos-board-v2/verifications/A5/independent/audit-findings.md
Worktree proofs: .agents/run/chamberos-board-v2/verifications/A5/proof.md and .agents/run/chamberos-board-v2/verifications/A4/proof.md
</context_files>
<skills>
[@/workspace/code/openchamber-config/.agents/skills/build/implementation/surgical-patch/SKILL.md]
[@/workspace/code/openchamber-config/.agents/skills/verify/browser/browser-testing-with-devtools/SKILL.md]
[@/workspace/code/openchamber-config/.agents/skills/communication/terse/caveman-lite/SKILL.md]
</skills>
<owned_paths>
web/server/board.ts
web/server/app.ts
web/server/github.ts
web/public/app.js
web/public/index.html
web/public/theme.css
web/tests/**
scripts/generate-a5-screenshots.mjs
scripts/audit-a5.mjs
scripts/audit-a5-data.mjs
.agents/run/chamberos-board-v2/verifications/A4/**
.agents/run/chamberos-board-v2/verifications/A5/**
</owned_paths>
<depends_on>
A5 independent audit 81ed5b6159991823fcef7a2c0abd780b6b3af897
</depends_on>
<defects_to_fix>
1. P1 Global Client Presentation Mode (web/public/app.js:6374-6387, 2058-2071, 5771-5772, 6006-6012; web/public/theme.css:3171-3174; web/server/board.ts if overview extraction leaks YAML):
When clientPresentationMode is active, hide internal detail across ALL views (Client, List, Canvas, issue drawer, Decisions, Blocked, Operations, Archive):
- Strip leading YAML front matter (`--- ... ---`) and hidden HTML markers before computing overview/previews; reuse the existing section parser and `window.renderMarkdown` instead of ad-hoc regex cleaners.
- In the issue drawer, hide the raw YAML/front-matter editor, internal labels (`ready-to-run`), worktree/agent/model metadata, Run/worktree controls, Open Questions, and Human Tasks when presentation mode is active.
- In Decisions and Blocked, do not expose raw internal Open Questions or Human Tasks when presentation mode is active (show the client-mode filtered state/notice instead).
- Do not hide `status:planned` or `status:todo` tasks as if they were `status:draft`; only hide actual `status:draft` tasks.
2. P1 A4 Note 409 Conflict Recovery (web/public/app.js:2706, 3123-3145; web/server/app.ts:1611-1615):
- Fix fingerprint extraction on 409 (`err.payload.issue.fingerprint` as well as `err.payload.fingerprint`).
- When a note save fails with 409 (remote issue changed), keep the user's unsaved `LOCAL_DRAFT` visible in the editor and do NOT let a background poll or Refresh overwrite it, AND do NOT let clicking Retry silently overwrite a changed remote note. If the remote note changed since the draft started, show the conflict notice and require explicit user confirmation (e.g. "Overwrite remote note" / "Écraser la note distante") or reload before writing with the new fingerprint; if only non-note parts of the issue changed and the target note on the server is identical to the base note the user started editing, Retry may safely save using the refreshed fingerprint.
3. P2 Rapid Human-Task Toggles on Same Issue (web/public/app.js:5938-5945):
- Serialize/queue human-task checkbox toggles per issue (or disable checkboxes on that issue card while a toggle is in flight and update the issue's in-memory fingerprint from the response before running the next queued toggle), so two quick clicks on distinct tasks of the same issue both succeed without a self-inflicted 409.
4. P2 Combined Board/Operations/Archive Cached `fetchedAt` (web/server/app.ts:1257):
- Do not fabricate `new Date(now()).toISOString()` when `combinedBoard`, `operationsData`, or `archiveData` returns cached repository data. Compute `fetchedAt` from the actual cached/fetched repository timestamps (e.g. the oldest `fetchedAt` among contributing repo boards, so stale cache is never reported as freshly fetched).
5. P2 Dedicated Bounded Closed Fetch & Partial/Truncated Warnings (web/server/github.ts, web/server/app.ts:1263-1294, web/public/app.js:6080-6153, 6157-6188):
- Add a bounded `state=closed` issue fetch on the GitHub client (and fake GitHub support) used by `archiveData` so closed issues remain reachable even when a repo has >1000 open issues, supporting paged `offset`/`limit` ("Load more").
- Render visible EN/FR warning banners in Operations and Archive when the API response reports `partial`, `truncated`, or repository `failures`.
6. P2 Blocked Badge vs Section Count & Closed Issues in Decisions/Blocked (web/public/app.js:5655-5670, 5771-5772, 6006-6012):
- Exclude closed issues (`issue.state === 'closed'`) from both Decisions and Blocked (and their sidebar badges).
- Use the exact same predicate for the Blocked sidebar badge and the Blocked section list (`status:needs-human`, unchecked Human Tasks, or open native `blockedBy` dependencies — do NOT include open-question-only issues in the Blocked section).
7. P2 A4 `setCanvasMarker` + `stripCanvasMarker` Exact Byte Identity (web/server/board.ts:230-249, 372-378):
- Ensure `stripCanvasMarker(setCanvasMarker(body, ...))` is 100% byte-identical to `body` for all original bodies: bodies without a trailing newline (`"Plain"` must restore `"Plain"`, not `"Plain\n"`), whitespace-only bodies (`" \n\n"` must restore `" \n\n"`, not `""`), and bodies already ending with LF or CRLF blank lines.Encode a minimal flag in the marker comment if needed (e.g. separator length/form added when inserting the marker) so stripping removes only the exact separator bytes that `setCanvasMarker` added.
8. P2 French Localization & 360px Client Disclaimer Wrapping (web/public/index.html:194, 212, 230, 270-277, 301; web/public/app.js:6153, 6188; web/public/theme.css:3139-3167):
- Localize the Operations status table column headers (`Draft`, `Backlog`, `Todo`, `Planned`, `In Progress`, `Needs Human`, `In Review`, `Done`), loading placeholders, and Operations/Archive/note error messages in French (`fr` dictionary + `data-i18n`).
- Fix `.client-disclaimer-banner` / title wrapping at 360px in `web/public/theme.css` so `"Presentation"` never splits mid-word (`overflow-wrap: break-word; word-break: normal;` and responsive flex stacking at narrow widths).
9. P2 Non-finite Archive Pagination (web/server/app.ts:1278-1280):
- Check `Number.isFinite` when parsing `offset` and `limit` in `archiveData` so `offset=Infinity` or `limit=Infinity` normalizes to finite bounds (`0` / default limit) instead of serializing `null`.
Note on Reopen (`web/server/app.ts:2191`): leave `status:backlog` on reopen unchanged (already flagged for morning review).
</defects_to_fix>
<criteria>
- All 9 defects above are fixed in small, atomic commits (`fix(a4): ...`, `fix(a5): ...`).
- Both `node scripts/audit-a5-data.mjs` and `env AUDIT_NO_SHOTS=1 node scripts/audit-a5.mjs` run with 0 FAIL findings.
- Regenerate affected screenshots in `.agents/run/chamberos-board-v2/verifications/A5/screenshots/` (including `17..20` client, `23..24` French, and any others that changed) and `.agents/run/chamberos-board-v2/verifications/A5/independent/screenshots/` via native Obscura CDP (`scripts/generate-a5-screenshots.mjs`).
- `timeout 900 npm test`, `timeout 900 node --test --test-timeout=30000 web/tests/*.test.mjs`, and `timeout 600 npm run typecheck` all pass with 0 failures and 0 skipped tests.
- Working tree is completely clean at finish. Every cited SHA exists in git.
</criteria>
<verification>
timeout 900 npm test
timeout 900 node --test --test-timeout=30000 web/tests/*.test.mjs
timeout 600 npm run typecheck
timeout 120 node scripts/audit-a5-data.mjs
timeout 240 env AUDIT_NO_SHOTS=1 node scripts/audit-a5.mjs
</verification>
<output>
Append a "Post-audit repair" section to `.agents/run/chamberos-board-v2/verifications/A5/proof.md` and `.agents/run/chamberos-board-v2/verifications/A4/proof.md` documenting each fix commit and rerun output.
Reply in at most 20 lines: status, each commit SHA with `git show --stat <sha>`, raw summary lines of `npm test`, `node --test web/tests/*.test.mjs`, `npm run typecheck`, `audit-a5-data.mjs`, `audit-a5.mjs`, and raw `git log --oneline 81ed5b6..HEAD` plus `git status --short`.
</output>
