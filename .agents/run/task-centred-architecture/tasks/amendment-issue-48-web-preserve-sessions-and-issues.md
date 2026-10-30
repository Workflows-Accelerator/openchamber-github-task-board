<env_preflight>
Repo: /workspace/extensions/github-task-board
Worktree: /workspace/extensions/github-task-board/.worktrees/team-dev-issue-48-web-simple-views
Branch: feat/issue-48-web-simple-views; base af9b39c.
State: web implementation worker ses_5ecd23a8361540b21b87243a already running; preserve its changes. This is an amendment, not a duplicate task.
Files: existing #48 web brief; do not alter auth.ts/config.ts/sw.js or login/SW-registration code.
Tests: existing #48 web brief commands.
Do not touch live service, production data, Git credentials, or close GitHub issues.
</env_preflight>
<goal>
Preserve the latest sign-in security work and human control over issue closure while finishing the already-running #48 web task.
</goal>
<scope>
#47 now has a newer hardening commit 4b3f4750bf20bf370bbdc4632a05714e8e3dd009 on fix/issue-47-fresh-app-stay-signed-in. It changes auth.ts, config.ts, a one-line passwordHash wiring in app.ts and auth tests. Do NOT merge or cherry-pick it while implementing; integration will merge complete branches later. Do not overwrite its wiring at integration; identify any app.ts overlap in your report.
Correction to original brief's cross-repo move suggestion: user approved choosing a project, NOT automatic closure/replacement of existing issues. New and queued drafts may choose their target project. Do not auto-close existing drafts or silently recreate them in another repository. For already-saved drafts, use only an existing safe transfer path preserving history and explicit confirmation if one is available; otherwise make destination assignment available before saving and report existing-issue transfer as a known limitation. Never invent approval or an agent Done transition.
Existing native no-JavaScript login POST returning invalid_json remains a separate low-severity follow-up; do not expand your board changes to redesign authentication.
</scope>
<output>
Continue the existing task and include these safeguards and any remaining project-assignment limitation in its final report.
</output>
