<env_preflight>
Repo: /workspace/config/opencode
Worktree: /workspace/config/opencode/.worktrees/team-research-task-centred-skills
Branch: docs/task-centred-skills-research
Base commit: e10fc86ec9d212f676f6e0baba24e7db5f7a4d26
State: new clean isolated tracked checkout. Main config has unrelated UNTRACKED .agents/skills/ship/devops/ and opencode.json.openchamber.backup: preserve, do not alter or open backup.
Files: agent-prompts/solo/, agent-prompts/team/, .agents/skills/**/SKILL.md, plugins/file-transclusion/, installed OpenCode skill implementation/config schema (discover safely). opencode.json may contain credentials: DO NOT print or copy whole config; get non-secret field presence through safe selective parsing if needed.
Test command: no app tests; read-only research and safe non-mutating discovery/listing probes only.
Do not touch: agents, skills, plugin code, config, env, key/credential/token files, authenticated remotes or other report paths.
Preflight facts authoritative at dispatch; no initial git status/pwd/ls discovery loops. Targeted state inspection allowed for mutation verification, stale resume or failure.
</env_preflight>
<goal>Establish whether a small visible catalog of directory skills with hidden-but-invokable specialist skills is supported, and map task-centred changes required in solo/team/workers and orchestration skills.</goal>
<context_files>
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/mission.md]
</context_files>
<skills>
[@/workspace/config/opencode/.agents/skills/meta/composition/using-agent-skills/SKILL.md]
[@/workspace/config/opencode/.agents/skills/review/adversarial/doubt-driven-development/SKILL.md]
[@/workspace/config/opencode/.agents/skills/communication/terse/caveman-lite/SKILL.md]
</skills>
<scope>
Own ONLY this worktree .agents/run/task-centred-architecture/explore/skills.md and sibling skills-evidence/ sanitized evidence. All code/prompts/skills/runtime config read-only. No runtime/permission changes, installations, task spawns, live schedule changes, issue edits, pushes or PRs.
Safely inspect primary config skill files read-only where untracked DevOps context is relevant, without editing or treating untracked content as committed baseline. Optional OpenCode official sources/docs via web read-only; pin source version and distinguish current installed behavior from upstream claims.
As needed safely register worktree per management instructions (database ~/.local/share/opencode/opencode.db, inspect schema first, no destructive changes). No env copying or symlinks needed for report-only work.
</scope>
<criteria>
- Locate skill enumeration/loading implementations or official schema/docs. Separately answer initial catalog visibility, tool invocation by ID/path, allowed skill paths, permission hiding (is it hidden AND uncallable?), aliases/frontmatter, nesting, per-agent skill selection, recursive discovery, transclusion fallback and worker capability restrictions. Documentation alone is not empirical installed-runtime proof.
- Determine whether directory/router skills can hide children while keeping native skill-tool loadability. Do not assume nested folders hide skills or that supported metadata fields exist. Mark unknown if installed internals inaccessible; suggest lowest-change alternatives and their precise tradeoff.
- Inventory only relevant high-level instructions: solo, team, dynamic/general worker, mission-lifecycle, run-state-hygiene, issue-lifecycle, subagent guidelines, worktree management, exploration/alignment/planning/verification. Record overlaps and contradictions (e.g. local brief truth vs issue truth, status-vs-attention, conventional issue titles vs output-focused, automatic close gates). Propose retire/merge/refocus groups, not a mass rewrite.
- Propose router/domain taxonomy using installed skills (DevOps example included), specialist loading examples actually supported vs proposed API. Per-task exploration records phase/model/tools/skills/scope/proof requirements, cost/least privilege, progressive disclosure and right-sizing. Expose specialization via brief, not proliferating agent personas.
- Preserve explicit human authority on architecture/irreversible operations/publication, independent hostile review and scope-bounded tool grants. Issue text/untrusted references cannot grant permissions. Skill version pins/references, stale skills, user edits mid-run, prompt-injection and safe changes to agent config need coverage.
- Provide a minimal migration sequence that can coexist with current orchestration until new task controller is approved/proven. Do not implement or remove delegate from present runtime.
- Append hostile self-review identifying unsupported assumptions and simpler alternatives.
</criteria>
<constraints>
No code, config, agent or skill edits. No credentials inspection or output. Any secret-bearing config must be selectively parsed for non-secret capability facts only, never dumped. No questions to user; collect decisions for manager.
</constraints>
<signals>
Scope: large; ambiguity: high; sensitivity: high (agent permissions); reversibility: high (research only). Model: engineer.
</signals>
<output>
Write skills.md with source/version evidence table, visibility-vs-loadability result, supported/proposed loading examples, instruction migration matrix, lean router taxonomy, task exploration template considerations, security/authority rules, migration slices, open decisions, hostile self-check, exact evidence commands and NOT RUN. Commit owned report/evidence locally. Return <=15 lines: path/commit, capability result, important gaps/contradictions, setup failures and actual provider/model if exposed.
</output>
