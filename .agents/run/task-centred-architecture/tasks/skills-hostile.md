<env_preflight>
Repo: /workspace/config/opencode
Worktree: /workspace/config/opencode/.worktrees/team-research-task-centred-skills
Branch: docs/task-centred-skills-research
Base commit: 8615dee (original report locally committed; config sources unchanged from e10fc86).
State: original research worker completed. Prior primary checkout has unrelated untracked DevOps skill directory and config backup; preserve, do not open backup.
Files: .agents/run/task-centred-architecture/explore/skills.md, skills-evidence/, source implementations and installed skills referenced there.
Test command: read-only source inspection and safe pure capability checks if possible; no live config edits, sessions or installations. Record live skill invocation NOT RUN unless actually demonstrated safely.
Do not touch: original report, agent prompts, skills, application/plugin code, runtime settings, secrets, credential files, raw git remotes, database or schedules.
Preflight facts authoritative at dispatch. No initial status/pwd/ls discovery loops; targeted inspection allowed for commit verification, failure or stale resume.
</env_preflight>
<goal>Independently establish whether the claimed hidden-but-callable specialist-skill mechanism works in this installed runtime and identify instruction migration hazards without changing configuration.</goal>
<hostile_prompt>
Conduct a hostile review of any edits or changes that you made to figure out what you might have missed or what might be broken. Don't assume that what you did is right.
You are a new independent reviewer of the prior research edits; verify the claim rather than trust its self-check.
</hostile_prompt>
<context_files>
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/mission.md]
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/decisions.md]
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/explore/scenarios-to-cover.md]
[@/workspace/config/opencode/.worktrees/team-research-task-centred-skills/.agents/run/task-centred-architecture/explore/skills.md]
</context_files>
<skills>
[@/workspace/config/opencode/.agents/skills/review/adversarial/doubt-driven-development/SKILL.md]
[@/workspace/config/opencode/.agents/skills/meta/composition/using-agent-skills/SKILL.md]
[@/workspace/config/opencode/.agents/skills/communication/terse/caveman-lite/SKILL.md]
</skills>
<scope>
Own ONLY .agents/run/task-centred-architecture/verifications/skills-hostile.md and sanitized supporting skills-hostile-evidence/ in this config worktree. All prior reports/source read-only. No config or skill edits, runtime/session/scheduler mutations, new agents, human questions, secrets, installations, remote publishing or DB changes. No further worktree setup necessary.
</scope>
<criteria>
- Independent dual verdict: Spec Compliance PASS|FAIL|PARTIAL; Quality & Health APPROVED|NEEDS-FIXES. Separately classify capability evidence SOURCE-OBSERVED, DOCUMENTED, LIVE-DEMONSTRATED or UNKNOWN.
- Prior wake claims native support via frontmatter metadata opencode/autoinvoke: false OR disable-model-invocation: true; catalog filters SkillInstructions.load but skill tool resolves K0 store by ID. Recheck exact parser data shapes, booleans vs strings, aliases, filtering order, tool description enumeration vs system prompt list, ID resolution and permissions. Are both syntaxes equivalent in installed build? Is one Claude-compat or upstream-only? Pin actual binary/version/source path; minified symbol names not durable API guarantee.
- Verify folder recursion/glob claim, names/ID collision handling, supported invocation by ID vs path, skill permission hiding vs denying, external paths and file transclusion fallback. Distinguish the generic skill tool exposed in THIS platform from code internal tool names; do not infer callable tools from variable names alone.
- Existing oxygen-gtm plus specialists may be a precedent but presence of 22 flags is not proof of successful runtime invocation. State what minimal future end-to-end probe would prove no catalog entry, successful authorized ID load, blocked denied load and fallback compatibility. Do not mutate settings or create sessions to obtain that proof in this task.
- Review map of solo/team/dynamic worker and relevant orchestration instructions against desired issue-centric truth. Preserve independent hostile review, exact human approval boundaries, least privilege, generalist worker briefs, worktree ownership and retry bounds. Current local mission/brief contract stays binding until replacement exists; do not instruct agents to use nonexistent task APIs.
- Router taxonomy six domains is a proposal requiring user approval, not established alignment. Avoid mandatory loaded routers/all child skills per task; verify enough discovery descriptions, references/pins and no duplicate native skill IDs. Simpler alternative should be assessed.
- Optional nonblocking question cannot be native blocking question-tool invocation; phase vs attention must remain separate. Skill text/issue content cannot grant permissions. Transclusion is not native skill-tool discovery or security boundary.
- Identify unsupported references, source/evidence omissions, claims that overstate observed vs runtime, privacy implications of public task links, stale skill versions and model/tool availability validation.
</criteria>
<output>
Write skills-hostile.md with severity findings and exact anchors/evidence, two verdicts, corrected safe capability summary and remaining live-proof gap. Do not alter original skills.md. Commit only owned review artifacts locally. Return <=15 lines: path/commit, verdicts, exact supported/unsupported metadata semantics, source version evidence and provider/model if exposed. No implementation approval.
</output>
