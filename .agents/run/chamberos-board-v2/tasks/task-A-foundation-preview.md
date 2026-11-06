<env_preflight>
Repo: /workspace/code/openchamber-github-task-board
Worktree: /workspace/code/openchamber-github-task-board/.worktrees/team-dev-chamberos-board-v2
Branch: feat/chamberos-board-v2
Base commit: PENDING_A4_A5_FINAL_PASS_AND_MANAGER_GIT_VERIFICATION — DO NOT DISPATCH UNTIL REPLACED.
Clean/dirty state: PENDING_MANAGER_VERIFICATION.
Files: package.json scripts; web/README.md; web/server/config.ts (read-only); existing release packaging helpers; worktree .agents/run/chamberos-board-v2/verifications/A-delivery/**.
Tests: verified foundation suites are recorded in final A4/A5 proof at base above. If any tracked app asset changes unexpectedly, stop and report. Verification here is packaging/build/checksum plus browser smoke against the packaged artifact. No new feature code.
Do not touch: root checkout outside this worktree, web app implementation, panel/**, service/**, live GitHub issue data, production processes, /workspace/releases/**, /workspace/.openchamber-data/**, .env* or credentials, /proc/*/environ, proxy configuration or repository settings. No push/PR/merge/reset/rebase, deletion, closure, live switch or credential changes. Reading names and loading already-approved environment into an isolated process without printing values is allowed only via the existing launcher mechanism; do not read secret values into tool output or project files.
Authoritative preflight: skip initial pwd/ls/git status discovery; targeted checks permitted before/after commits, stale resume, location change or action failure. Sole worker at dispatch.
</env_preflight>
<goal>
Prepare a reviewable packaged preview and a precise release/rollback plan for the A1-A5 foundation only, so the user can validate the urgent delivery without waiting for advanced features.
</goal>
<context_files>
[@/workspace/code/openchamber-github-task-board/.agents/run/chamberos-board-v2/decisions.md]
[@/workspace/code/openchamber-github-task-board/.agents/run/chamberos-board-v2/explore/preflight.md]
Read worktree final A4/A5 proof and A1-A3 proof under .agents/run/chamberos-board-v2/verifications/.
Read existing release/supervisor documentation and packaging scripts, web/README.md and configuration names (not secret values). Historical live current was 8b7e059-20261102, NOT 98261a8. Reconfirm actual link read-only; never assume a rollback target.
</context_files>
<skills>
[@/workspace/code/openchamber-config/.agents/skills/ship/release/shipping-and-launch/SKILL.md]
[@/workspace/code/openchamber-config/.agents/skills/verify/browser/browser-testing-with-devtools/SKILL.md]
[@/workspace/code/openchamber-config/.agents/skills/communication/terse/caveman-lite/SKILL.md]
</skills>
<scope>
Own worktree .agents/run/chamberos-board-v2/verifications/A-delivery/** and minimal web/README.md clarification if required. Build generated artifacts only under a new /tmp/opencode/board-v2-staging/<verified-sha>-foundation/ task output directory. No app code/features, no advancing B1-C3/D.
Use existing packaging procedure as verified from source; prior report may be wrong about build:service versus board build. Include package.json, web/dist/server.mjs, web/public and strict checksums.sha256 as actually required by installed supervisor. Verify packaged identity against source and all expected files; avoid secret/session/log files in manifest.
Start one isolated preview on a free loopback port with its own session file. Use fake GitHub for safe interactive review and label the dataset clearly as demonstration/test data (not delivered production data); no fake behavior in app source. Optionally verify real GitHub reads if existing approved launcher can pass ambient token safely without logging it, but perform zero GitHub writes. Do not alter or expose production credentials, bind publicly or weaken auth. Use existing approved preview access/forwarding if available; do not change proxy/service settings to create it. Report if loopback cannot be reached by the user; a loopback URL alone is not a usable remote review link.
</scope>
<criteria>
1. Packaged preview health/sign-in/List/Canvas/drawer/notes/links/sidebar smoke exercised with real browser and screenshots, exact build/checksum/health output, zero unexpected console/CSP/server errors. Application assets unchanged; no proof-only CSS/DOM injection. State fake versus real upstream explicitly.
2. Preview left running, with process identity, safe start/stop procedure and reachable review URL if available. Never stop unrelated processes; only preview processes created by this task may be stopped/restarted.
3. Concise release readiness and exact live-switch/rollback instructions on disk, no execution. Include current base/remote state and drift check, human-approved merge and master push prerequisites, release directory, manifest verification, atomic link switch, child reload using existing supervisor, live sign-in/read check and immediate rollback on failure. Record observed rollback target without assuming historical value.
4. Human review checklist is one numbered action per issue A1-A5 (what to click/what should happen), known blind spots, reopen-to-backlog policy note, clear advanced features not included. No claim that D1 capture, Run, Discussions, full label/front-matter editing or worktree management is delivered. No human validation/closure/production approval inferred from urgency.
5. All stated commands actually run or marked NOT RUN. Verify every cited SHA. Commit scoped reports/docs; clean tracked tree, no secret values in logs or reports. Full package review will follow before release request.
</criteria>
<output>
Write worktree .agents/run/chamberos-board-v2/verifications/A-delivery/proof.md, human-review.md and live-switch.md. Return <=15 lines: verified source SHA, package location/checksum result, preview URL/access limit, data source, smoke results/screenshots, actual current rollback target, known blockers/NOT RUN, git log/status. Do not publish, merge, close or change live. Do not call delivery complete.
</output>
