<env_preflight>
Repo /workspace/config/opencode; dispatch worktree /workspace/config/opencode/.worktrees/team-ops-board-entrypoint branch ops/board-entrypoint-hook candidate fb3e175b11b8754978a24f35f462c2bfb8caa98a tracked clean, untracked review reports/evidence must be preserved.
Integration root /workspace/config/opencode on master HEAD37f5b67 tracked clean,25 unrelated untracked files. Manager has inspected test/doc diff180197c..fb3e175; no product edits. Independent full runtime recheck180197c security APPROVED/specPASS; subsequent independent fb3e175 recheck ses_7896cfe1285972c43f256c49 actual9router/engineer Security APPROVED/SpecPASS/QualityAPPROVED/PROCEED, both mutants + KILL escalation killed,23/23/655+19/syntax9/zero leaks. Owner decisions20/21 explicitly authorise merge+push config master ONLY under this passed independent gate, now satisfied. This is internal default-OFF supervisor config work, no human UI surface; L5 waived solely for this merge by explicit decision21. Board L5 not waived.
At release boundary manager `git fetch origin` in config root timed out120s with no output, NOT success. You may perform ONE bounded fetch (max120s) to establish remote tip. If it fails/times out STOP with no merge/push; do not retry loop or assume remote unchanged. Do not print remote credential URLs.
No unrelated untracked read/stage/delete, no settings/secrets, no credential values, no reset/rebase/force, no remote branch deletion, no config application/restart/container/proxy/deployment. All root commands explicit workdir. No other release worker owns config root.
Tests: node --test tests/board-supervisor.test.mjs ; npm test ; sh -n/dash -n/bash -n on entrypoint.sh and both tools/board scripts. Build if actual package scripts require it; no speculative npm install.
Preflight authoritative; targeted branch/clean/ancestry checks at merge boundary required.
</env_preflight>
<goal>
Merge and publish only the independently approved default-off supervisor into config master, verify the merged tree and exact remote identity, and leave live deployment untouched.
</goal>
<context_files>
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/decisions-2026-10-24.md]
[@/workspace/config/opencode/.worktrees/team-ops-board-entrypoint/.agents/run/board-entrypoint-gap-recheck/report.md]
[@/workspace/config/opencode/.worktrees/team-ops-board-entrypoint/docs/BOARD_SUPERVISOR.md]
</context_files>
<skills>
[@/workspace/config/opencode/.agents/skills/ship/worktree/management/SKILL.md]
[@/workspace/config/opencode/.agents/skills/review/adversarial/doubt-driven-development/SKILL.md]
[@/workspace/config/opencode/.agents/skills/communication/terse/caveman-lite/SKILL.md]
</skills>
<scope>
1. Establish current master/root cleanliness and source unchanged, fetch once bounded as above. If origin/master moved relative local, MERGE origin/master, never rebase/reset; conflicts or changed board runtime => STOP/report. If source changed beyondfb3e175 => STOP. Do not overwrite manager/unrelated state.
2. Merge --no-ff ops/board-entrypoint-hook into master from root. Nontrivial conflicts => STOP; no product patch. Before push inspect merge diff for only approved script/entrypoint/tests/docs and innocuous existing run-state. Runtime default-off gate must remain unchanged. No live invocation of entrypoint/start against real env, only local fixtures scrubbed of credentials.
3. Full merged tests23 supervisor/root655+19, all nine syntax checks, default-off fixture no PID. Persist report and exact logs under root .agents/run/board-entrypoint-release/** (no secret/environment dump), stage only own evidence. Original reviewer reports remain private/untracked in source; do not publish raw private hosting findings.
4. If all green commit release proof explicitly, push origin master with no force and bounded timeout. If push fails, STOP/report statusUNKNOWN unless remote tip independently established; never blindly repeat push. On success verify exact published commit via ONE git ls-remote origin refs/heads/master. Record actual merge and proof hashes for immutable deployment receipt. No PR needed owner authorised direct merge.
5. No cleanup yet: source untracked reports must be preserved before removing worktree; manager handles it separately. Keep branch and no remote deletion.
</scope>
<criteria>
Independent-approved fb3e175 is ancestor of master; merged tests+syntax green; pushed exact master tip verified or clearly UNKNOWN; no deployment/service action/unrelated file change; immutable nonsecret manager-readable release receipt at .agents/run/board-entrypoint-release/report.md.
</criteria>
<output>
<=12lines: PASS/BLOCKED; fetch/merge/push exits+remote verification; merge/proof immutable hashes; test/syntax/default-off results; conflicts; changed paths; source reports preserved; actual provider/model; no-deployment statement. Any failed precondition => STOP, no fix.
</output>
