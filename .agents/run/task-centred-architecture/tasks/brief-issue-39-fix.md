<env_preflight>
Repo: /workspace/config/opencode
Worktree: /workspace/config/opencode/.worktrees/team-dev-issue-39-front-desk
Branch: feat/issue-39-front-desk
Base commit: fc120566caaec1e58fc81c86f66c65ec8049498b
Goal: Resolve hostile review Findings 1-8 for Issue #39 (Front Desk agent).
Commands: npm test ; node tests/audit.mjs ; python3 -c "import json; json.load(open('opencode.json'))"
Guardrails: Never log or print secret token/password values. Adhere to Zero-Emoji policy.
</env_preflight>

<goal>
Remediate all 8 findings from the hostile review on Issue #39:
1. Fix `git remote -v*` subcommand bypass by strictly scoping to `git remote -v` and denying remote modification subcommands.
2. Fix secret exfiltration via `gh issue*--attach*` by explicitly denying `gh issue*--attach*`.
3. Fix arbitrary file overwrite via `git log*--output*` and `git log*-o*` by denying them.
4. Fix destructive branch operations via `git branch*` by denying `git branch*-D*`, `git branch*-d*`, `git branch*-m*`, `git branch*-M*`, `git branch*-c*`, `git branch*-C*` (or allowing only read-only `git branch --list*`, `git branch -a*`, `git branch -r*`, and exact `git branch`).
5. Fix unsandboxed `openchamber` backdoor by denying `openchamber`, allowing `solo_openchamber` in `opencode.json`, and updating `plugins/solo-tools/index.ts` so `frontdesk` can safely invoke `solo_openchamber` for harmless read-only/linking actions without cross-session or spawning capabilities.
6. Fix omission of Section 2.6 `### Human Tasks:` and Section 2.8 `### Work Log:` in `agent-prompts/frontdesk/frontdesk.md` and `.agents/skills/meta/orchestration/front-desk/SKILL.md` to conform to Issue Body Contract v1 and v1.1.
7. Clarify status transitions and capability claims in `front-desk/SKILL.md` (workers handle in-progress to in-review; frontdesk links/monitors sessions rather than spawning them).
8. Add a comprehensive `verdict()` rule simulation test suite in `tests/config-shape.test.mjs` for `frontdesk` permissions with explicit `expectedAllow` and `expectedDeny`.
</goal>

<scope>
1. Edit `opencode.json`:
   - Under `frontdesk.permission.bash`:
     - Replace `git remote -v*` with `git remote -v` (and deny `git remote add*`, `git remote rm*`, `git remote remove*`, `git remote rename*`, `git remote set-url*`).
     - Add `"gh issue*--attach*": "deny"`.
     - Add `"git log*--output*": "deny"`, `"git log*-o*": "deny"`.
     - Deny `git branch*-D*`, `git branch*-d*`, `git branch*-m*`, `git branch*-M*`, `git branch*-c*`, `git branch*-C*`.
     - Ensure trailing catch-all denies (`*>*`, `*<*`, `*`*`, `*$(*`) remain at the bottom after all allow rules.
   - Under `frontdesk.permission`:
     - Set `"openchamber": "deny"`.
     - Set `"solo_openchamber": "allow"`.
2. Edit `plugins/solo-tools/index.ts`:
   - Update agent authorization check in `execute`: allow `toolContext.agent === "solo" || toolContext.agent === "frontdesk"`.
   - Update error message and description where appropriate.
3. Edit `agent-prompts/frontdesk/frontdesk.md`:
   - Update Section 3 required markdown sections to include Section 2.6 `### Human Tasks:` and Section 2.8 `### Work Log:`.
   - Update tool references: replace `openchamber` with `solo_openchamber`.
   - Clarify non-spawning session monitoring and linking.
4. Edit `.agents/skills/meta/orchestration/front-desk/SKILL.md`:
   - Include Section 2.6 `### Human Tasks:` and Section 2.8 `### Work Log:`.
   - Fix Protocol C (clarify workers perform L4 hostile review for `in-progress` -> `in-review`).
   - Fix Protocol D (linking and monitoring sessions instead of triggering launches).
5. Edit `tests/config-shape.test.mjs`:
   - Update `frontdesk agent has least privilege intake permissions` to reflect `openchamber: deny`, `solo_openchamber: allow`, and new bash deny rules.
   - Update `every non-solo agent explicitly denies solo_openchamber` test to reflect that `solo` and `frontdesk` allow `solo_openchamber`, while other agents deny it.
   - Add a dedicated `test('frontdesk shell rules resolve every probe command to the expected verdict')` using `verdict()` covering all allowed commands and all adversarial bypass probes.
6. Verify:
   - `npm test` passes all tests.
   - `node tests/audit.mjs` passes.
   - JSON syntax is 100% valid.
   - Zero emojis in all modified files.
7. Commit changes with a clean conventional commit.
</scope>

<criteria>
All 8 hostile review findings resolved; 0 test failures; 0 audit failures; valid JSON; zero emojis.
</criteria>

<output>
At most 10 lines:
Summary of edits across files; test pass counts; audit status; commit hash.
</output>
