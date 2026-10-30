<env_preflight>
Repo: /workspace/config/opencode
Worktree: /workspace/config/opencode/.worktrees/team-dev-issue-39-front-desk
Branch: feat/issue-39-front-desk
Candidate commit: fc120566caaec1e58fc81c86f66c65ec8049498b
Goal: Conduct adversarial hostile review (L4) on the candidate commit fc120566caaec1e58fc81c86f66c65ec8049498b.
Commands: npm test ; node tests/audit.mjs ; python3 / jq schema validation
</env_preflight>

<goal>
Conduct a hostile review of any edits or changes made in commit fc120566caaec1e58fc81c86f66c65ec8049498b to figure out what might have been missed or what might be broken. Don't assume that what was done is right.
</goal>

<scope>
1. Inspect git diff HEAD~1..HEAD.
2. Adversarially test:
   - Does `frontdesk` agent definition in `opencode.json` strictly enforce read-only/no-app-code guardrails?
   - Can the agent execute destructive shell commands or bypass git/gh restrictions?
   - Is the Zero-Emoji policy strictly maintained in prompts, templates, and skill documentation?
   - Does the issue management skill contradict `issue-lifecycle` or Issue Body Contract v1?
   - Are all skill references and file paths valid?
3. Report findings, test results, and final verdict: Security (APPROVED/NEEDS-FIXES), Spec (PASS/FAIL), Quality (APPROVED/NEEDS-FIXES), Recommendation (PROCEED/HALT).
</scope>

<output>
Report findings, test results, and final verdict: Security, Spec, Quality, Recommendation.
</output>
