<env_preflight>
Worktree: /workspace/code/openchamber-github-task-board/.worktrees/team-dev-chamberos-board-v2, branch feat/chamberos-board-v2.
You are an INDEPENDENT auditor. You did not build this. Do not trust the builder's proof; reproduce it.
Do not touch: /workspace/releases/board/**, running processes, /workspace/config/opencode/**, /workspace/.openchamber-data/**, .env*/credentials, /proc/*/environ, panel/**, service/**. No push, no live GitHub writes. Zero emojis. Never print secrets.
</env_preflight>

<goal>Give two verdicts on one Board V2 step: Spec (PASS / PARTIAL / FAIL against the step brief + decisions.md) and Quality (APPROVED / NEEDS-FIXES).</goal>

<method>
1. Read the step brief, decisions.md, and the step's proof.md (paths given below).
2. Run npm test and the type check yourself; record counts.
3. Start the server against the fake GitHub helper and drive the browser yourself (360/768/1280, light/dark, English/French). Check each acceptance criterion and each standing rule (nothing fake, no n8n, no "mobile", no double plus, strict CSP, no secret in the browser).
4. Read the diff for this step (git log/diff between the commits named below). Look for corrupting writes to issue bodies, missing error handling, dead code, tests that would still pass if the feature were reverted.
5. You MAY fix small, clearly-scoped defects yourself (commit each with a message starting "audit:"), then re-verify. Larger problems: report, do not fix.
</method>

<skills>
[@/workspace/code/openchamber-config/.agents/skills/review/adversarial/doubt-driven-development/SKILL.md]
[@/workspace/code/openchamber-config/.agents/skills/verify/browser/browser-testing-with-devtools/SKILL.md]
[@/workspace/code/openchamber-config/.agents/skills/communication/terse/caveman-lite/SKILL.md]
</skills>

<output>
Append an "Independent audit" section to the step's proof.md (commit it). Working tree clean at the end.
Reply in at most 15 lines: Spec verdict, Quality verdict, defects found / fixed by you / left open (each with file:line), final SHA.
</output>
