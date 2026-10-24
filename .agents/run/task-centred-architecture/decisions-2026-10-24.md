# Owner decisions — 2026-10-24

Asked once, answered in chat by the owner. These override the written #33 acceptance criteria where they conflict.

1. **Board sign-in: separate board password.** Keep the built password flow and the server-held GitHub token. The owner accepts that anyone with the board password gets access and that GitHub identity is not checked. #33 criterion "limited to the configured GitHub account / second account refused" is superseded by: access limited to holders of the board password; token stays server-side; one configured repository only.
2. **Concurrent edits: best-effort editing.** Keep editing. Refuse changes detected before saving (fingerprint mismatch -> 409). Show a clear warning that a simultaneous GitHub or agent edit can still be overwritten. #33 "concurrent edits fail closed" is relaxed to: detected conflicts refuse; undetectable window disclosed in the page and README; no claim of atomic or fail-closed writes; an ambiguous write outcome is reported as unknown and never silently repeated.
3. **Deployment: investigate how live.workflows.ac is deployed with OpenChamber using the DevOps CLI**, then propose the same shape for board.workflows.ac. Investigation is read-only; any deployment change still needs the owner's explicit go.

4. **#30 D1 work type: existing labels.** `bug` / `enhancement` labels are the single source of bug vs feature, plus one justification sentence in the Work Log. No body field, no `type:*` label.
5. **#31 D3 changed question: refuse and show new text.** If the question changed while answering, the answer is not saved; the user sees the new text and answers again.
6. **#31 D2 notifications: owner wants real notifications, not only in-board.** Owner asked "Web notifications? PWA? Through OpenChamber?". Action: a capability spike comparing (a) web push from the standalone board as an installable PWA, (b) OpenChamber's `POST /api/notifications/emit`, (c) both. Choice of channel goes back to the owner with evidence. In-board views/badge still ship as the base.

7. **#31 D2 channel (after spike): board push.** Installable board web app (PWA) with web push; OpenChamber /emit rejected (live tab only, no phone reach, breaks sign-in isolation). Detection: board server checks GitHub every 60s with conditional requests; no webhook. First slice: test-notification button, then real alerts when an issue starts needing attention. Push body minimal.
8. **Hosting shape: inside the OpenChamber container**, twin of live.workflows.ac (process in the OpenChamber container, dynamic proxy route, Let's Encrypt; infra detail in the local-only devops report). Owner accepted this over a dedicated container; recorded risks: agents in that container can read the board token/password, restart persistence unverified. Repository: Workflows-Accelerator/openchamber-github-task-board. Secrets: already in SOPS; deployment reads key names from there, values never printed. Bind address must become configurable (BOARD_HOST). Actual route/process change still needs an explicit owner "go" once #33 passes review.

Master and deployment remain human-gated.
