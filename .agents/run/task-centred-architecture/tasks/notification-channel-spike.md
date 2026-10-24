<env_preflight>
Repo: /workspace/extensions/github-task-board (root checkout, branch feat/v2-binding-and-ratelimit). Read-only for all tracked code.
Board server code (read only): .worktrees/team-dev-issue-33-standalone-board (web/**, service/**, README). Another worker is editing it: do not write there.
OpenChamber install (read only): /usr/local/lib/node_modules/@openchamber/web/ (see server/lib/notifications/emit-route.js).
Throwaway prototypes only under /tmp/opencode/notify-spike/. No installs into the repo, no repo edits except your report, no deployment, no DNS/TLS, no OpenChamber config change, no live credentials. Never read or reuse voice-page authentication; if you meet it, note only that it exists.
</env_preflight>
<goal>
Give the owner an evidence-based choice for how "an agent needs you" reaches them: web push from the standalone board (installable PWA), OpenChamber's notification route, or both.
</goal>
<context_files>
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/decisions-2026-10-24.md]
[@/workspace/extensions/github-task-board/.worktrees/team-dev-issue-30-31-design/.agents/run/issue-30-31-design/proposal.md]
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/outputs/deployment-readiness.md]
</context_files>
<skills>
[@/workspace/config/opencode/.agents/skills/review/adversarial/doubt-driven-development/SKILL.md]
</skills>
<scope>
Constraints from the owner: the board is standalone (no agent control, no OpenChamber change, own password sign-in). Attention ("needs you") is separate from workflow phase; it comes from open questions/verifications in issues.
Answer, with evidence (code lines, spec/doc links, or a /tmp prototype run):
1. PWA web push from the board: requirements (HTTPS with valid cert — board.workflows.ac currently fails TLS; service worker; VAPID keys held server-side; subscription storage), what triggers a push (who detects a new question: the board server polling GitHub, a GitHub webhook, or nothing while no one is signed in), platform support (desktop Chrome/Firefox/Safari, Android, iOS only when installed to home screen), privacy (push body content-free or minimal), effort estimate labelled as estimate.
2. OpenChamber `POST /api/notifications/emit`: who may call it (auth model, from source), whether a standalone board server could call it without changing OpenChamber or reusing private auth, delivery when OpenChamber is not open, phone reach.
3. Both: overlap, duplicate suppression, which is simpler first.
4. Recommendation with the smallest first slice, and what stays unverified.
</scope>
<criteria>
Every claim backed by evidence or marked UNVERIFIED. No repo or host change. Plain-language summary the owner can decide from in one read.
</criteria>
<output>
Write /workspace/extensions/github-task-board/.agents/run/task-centred-architecture/outputs/notification-channel-spike.md. Do not commit. Return at most 15 lines: option comparison (requirements, phone reach, effort estimate, blockers), recommendation, unverified items, actual model.
</output>
