<env_preflight>
Repo: /workspace/code/openchamber-github-task-board
Worktree (work ONLY here): /workspace/code/openchamber-github-task-board/.worktrees/team-dev-chamberos-board-v2
Branch: feat/chamberos-board-v2. Previous steps are committed on this branch; read the previous step's proof under .agents/run/chamberos-board-v2/verifications/<step>/proof.md in the worktree before starting.
node_modules is symlinked from the root checkout. Test command: npm test. Run `git status --short` and `git log --oneline -5` once at start to confirm a clean tree (the previous step must have left it clean; if not, stop and report).
Do not touch: /workspace/releases/board/**, running processes (live board, OpenChamber on port 3000), /workspace/config/opencode/**, /workspace/.openchamber-data/**, any .env* / board.env / credential file, /proc/*/environ, panel/** and service/** (the OpenChamber panel stays untouched), the root checkout outside this worktree. No git push. No live GitHub writes unless the step brief explicitly allows one. Never print secrets. Zero emojis anywhere (code, UI text, commits).
</env_preflight>

<standing_rules>
Product rules that every step must keep true (from decisions.md):
- Nothing fake or simulated: no sample data, invented numbers, mock terminals or pretend actions. A feature that cannot work yet shows an honest message saying what is missing.
- No "n8n" anywhere; the word "mobile" appears nowhere (text, ids, classes, code); responsive at 360/768/1280.
- No button has both a plus icon and text starting with "+".
- Views are named Canvas and List. Sidebar, not top bar. V1 warm-paper look plus matching dark theme. Every new UI string exists in English and French.
- Status, priority, size and ready-to-run are labels, never front matter.
- CSP stays strict (script-src 'self'); no CDNs. Only widen a directive when the step needs it (e.g. YouTube frame-src) and say so.
- Server holds all secrets; nothing secret reaches the browser.
- Browser proof uses the fake GitHub helper (web/tests/fake-github.mjs) or equivalent synthetic data, never the real token.
- Keep the change minimal (lean-build). Reuse existing server helpers (board.ts, sections.ts, github.ts).
</standing_rules>

<skills>
[@/workspace/code/openchamber-config/.agents/skills/build/domain/frontend-ui-engineering/SKILL.md]
[@/workspace/code/openchamber-config/.agents/skills/build/methodology/lean-build/SKILL.md]
[@/workspace/code/openchamber-config/.agents/skills/verify/browser/browser-testing-with-devtools/SKILL.md]
[@/workspace/code/openchamber-config/.agents/skills/verify/ladder/verification-levels/SKILL.md]
[@/workspace/code/openchamber-config/.agents/skills/communication/terse/caveman-lite/SKILL.md]
</skills>

<common_criteria>
- npm test passes; report counts vs previous step and explain every removed test.
- Type check passes (the repo's existing command).
- Browser proof of every acceptance criterion at 360/768/1280, light and dark, screenshots under .agents/run/chamberos-board-v2/verifications/<step>/ in the worktree; zero console errors and zero CSP violations.
- Local micro-commits on feat/chamberos-board-v2 with conventional messages; working tree clean at the end.
- Proof file .agents/run/chamberos-board-v2/verifications/<step>/proof.md: commands, counts, screenshots, what is NOT verified.
- Reply in at most 20 lines: final SHA, test counts, what works, what is NOT verified, proof path.
</common_criteria>
