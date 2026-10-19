<env_preflight>
Repo/worktree/branch/base: TO BE SET BEFORE DISPATCH
State: NOT READY. Fill exact report/draft commit and read-only evidence pointers after research/synthesis finishes.
Files: assigned report or architecture issue draft, captured user vision and source receipts.
Test command: documentation-only; targeted source/official-doc rechecks and deterministic requirement coverage review, no app mutation.
Do not touch: source code, agents, skills, runtime config, schedules, issue state or author's artifacts.
</env_preflight>
<goal>Independently identify what the assigned task-centred research or architecture draft missed, overstated, contradicted or overengineered before it is presented as ready for human alignment.</goal>
<hostile_prompt>
Conduct a hostile review of any edits or changes that you made to figure out what you might have missed or what might be broken. Don't assume that what you did is right.
You are a fresh independent reviewer, not the original author: apply the same doubt to the author's artifacts and verify them from evidence rather than trusting self-reporting.
</hostile_prompt>
<context_files>
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/mission.md]
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/decisions.md]
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/explore/scenarios-to-cover.md]
EXACT ARTIFACT/EVIDENCE POINTERS TO BE SET BEFORE DISPATCH.
</context_files>
<skills>
[@/workspace/config/opencode/.agents/skills/review/adversarial/doubt-driven-development/SKILL.md]
[@/workspace/config/opencode/.agents/skills/review/methodology/ponytail-review/SKILL.md]
[@/workspace/config/opencode/.agents/skills/communication/terse/caveman-lite/SKILL.md]
</skills>
<scope>
Own only a new hostile-review report under your worktree .agents/run/task-centred-architecture/verifications/ (exact file set before dispatch). Original research/draft and all source READ ONLY. No application edits, no runtime mutations, no publication, no worker spawns, no human questions, no pushes or merges. If review finds gaps document them; don't secretly fix author content.
</scope>
<criteria>
- Verify key claims from cited source and current capability distinction. Explicitly flag invented host APIs, unsupported hidden-but-callable skill behavior, GitHub unlimited counts/atomic leases/CAS assumptions, documentation confused with empirical installed-runtime proof or stale facts.
- Check all scoped user requirements with coverage and examples. Main concerns: issue as recoverable work truth; phase vs attention; actionable blocking vs optional question; output-focused titles; hierarchy vs dependency vs checklist; right-sized exploration with references/hypotheses/tools/model/skills/constraints; recurring/event work; repo-less/new-project intake; permissions and privacy.
- Challenge duplicate controllers/worker spawns, stale edits, canceled/closed/transferred tasks, restart/offline/webhook loss, idempotency and bounded retries, scheduler overlap, changing approvals mid-run, public/private context, source link evidence longevity and untrusted issue/web/skill content.
- Look for rigid overengineering: automatic expensive multi-agent swarm for trivial tasks; ten required bureaucratic phases; custom graph engine where GitHub native suffices; two durable work truths; unnecessary new service when current runtime supports it. Also flag oversimplification that loses real reliability or human authority.
- Ensure proposal has explicit open decisions instead of silent selections. No implementation/release/closure approval implied by design exploration. Prior test results and proof claims not recycled.
- Provide separate verdicts: Spec Compliance PASS/FAIL/PARTIAL and Quality & Health APPROVED/NEEDS-FIXES. A passing research review is not proof future architecture works; explicitly record runtime NOT RUN.
</criteria>
<output>
Write report with findings by severity, exact source/draft anchors, actionable corrections, strengths, unsupported assumptions/unknowns, two verdicts and evidence checks. Local commit only owned review report. Return <=15 lines with report path/commit, verdicts, blockers and model/provider if available. Do not mark user approval or implementation complete.
</output>
